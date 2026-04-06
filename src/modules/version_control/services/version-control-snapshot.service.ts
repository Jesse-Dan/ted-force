import { Autowired, Service } from "fragment-ts";
import { CodeHelper } from "../../../common/helpers/code.helper";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import type { AgentParameter } from "../../../entities/agent-parameter.entity";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import { CommitInstanceSnapshotDto } from "../dto/commit-instance-snapshot.dto";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentParameterVersionRepository } from "../repositories/agent-parameter-version.repository";
import { AgentToolVersionRepository } from "../repositories/agent-tool-version.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { GitSyncService } from "./git-sync.service";

type SnapshotState = {
  commitHash: string | null;
  parameter: AgentParameter | null;
  tools: AgentTool[];
};

@Service()
export class VersionControlSnapshotService {
  @Autowired()
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  @Autowired()
  private agentParameterVersionRepository!: AgentParameterVersionRepository;

  @Autowired()
  private agentToolVersionRepository!: AgentToolVersionRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private gitSyncService!: GitSyncService;

  async commitInstanceSnapshot(instanceId: string, payload: CommitInstanceSnapshotDto) {
    const instance = await this.agentInstanceRepository.findById(instanceId);

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found.`);
    }

    const liveParameter = await this.agentParameterVersionRepository.findLiveByAgentId(
      instance.agentId,
    );
    const liveTools = await this.agentToolVersionRepository.findLiveByAgentId(instance.agentId);
    const commitHash = CodeHelper.generate({ length: 33, charset: "alphanumeric" });

    if (liveParameter) {
      await this.agentParameterVersionRepository.save(
        this.cloneParameterSnapshot(liveParameter, instance.id, commitHash),
      );
    }

    if (liveTools.length > 0) {
      await this.agentToolVersionRepository.saveMany(
        liveTools.map((tool) => this.cloneToolSnapshot(tool, instance.id, commitHash)),
      );
    }

    const updatedInstance = await this.agentInstanceRepository.save({
      ...instance,
      commitHash,
    });

    const versionEntry = await this.agentVersionEntryRepository.save({
      instanceId: updatedInstance.id,
      version: updatedInstance.version.version,
      releasedAt: new Date(),
      message: payload.message.trim(),
      commitHash,
      author:
        payload.authorUserId || payload.authorName
          ? {
              userId: payload.authorUserId,
              userName: payload.authorName,
            }
          : null,
      metadata: {
        git: {
          status: "pending",
          pushed: false,
          syncedAt: null,
          message: null,
          remoteUrl: null,
          branch: null,
        },
      },
    });

    const snapshot = await this.getSnapshotByCommitHash(updatedInstance.agentId, commitHash);
    const agent = await this.agentRepository.findById(updatedInstance.agentId);
    const git = agent
      ? await this.gitSyncService.syncCommitToRepository(
          agent,
          updatedInstance,
          {
            version: updatedInstance.version.version,
            message: payload.message.trim(),
            commitHash,
            releasedAt: versionEntry.releasedAt,
          },
          snapshot,
        ).catch((error) => ({
          pushed: false,
          reason: error instanceof Error ? error.message : "Git sync failed",
        }))
      : { pushed: false, reason: "Agent not found for git sync" };

    const gitMetadata = {
      git: {
        status: git.pushed ? "success" : "failed",
        pushed: Boolean(git.pushed),
        syncedAt: git.pushed ? new Date().toISOString() : null,
        message:
          "reason" in git && typeof git.reason === "string"
            ? git.reason
            : payload.message.trim(),
        remoteUrl:
          "remoteUrl" in git && typeof git.remoteUrl === "string"
            ? git.remoteUrl
            : null,
        branch:
          "branch" in git && typeof git.branch === "string" ? git.branch : null,
      },
    } as const;

    await this.agentVersionEntryRepository.updateMetadata(versionEntry.id, gitMetadata);

    return {
      instance: updatedInstance,
      versionEntry: {
        ...versionEntry,
        metadata: gitMetadata,
      },
      snapshot,
      git,
    };
  }

  async getSnapshotByCommitHash(agentId: string, commitHash: string) {
    const state = await this.resolveSnapshotState(agentId, commitHash);
    const versionEntry = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      commitHash,
    );

    return this.buildSnapshotPayload(state, versionEntry?.metadata?.git ?? null);
  }

  async diffByCommitHashes(agentId: string, fromCommitHash: string, toCommitHash: string) {
    const fromState = await this.resolveSnapshotState(agentId, fromCommitHash);
    const toState = await this.resolveSnapshotState(agentId, toCommitHash);

    return this.buildDiffPayload(fromState, toState, {
      type: "commit",
      from: fromCommitHash,
      to: toCommitHash,
    });
  }

  async diffByInstances(fromInstanceId: string, toInstanceId: string) {
    const fromInstance = await this.agentInstanceRepository.findById(fromInstanceId);
    const toInstance = await this.agentInstanceRepository.findById(toInstanceId);

    if (!fromInstance || !toInstance) {
      throw new Error("One or both instances were not found.");
    }

    if (fromInstance.agentId !== toInstance.agentId) {
      throw new Error("Instance diff requires both instances to belong to the same agent.");
    }

    const fromState = await this.resolveSnapshotState(
      fromInstance.agentId,
      fromInstance.commitHash ?? null,
    );
    const toState = await this.resolveSnapshotState(
      toInstance.agentId,
      toInstance.commitHash ?? null,
    );

    return this.buildDiffPayload(fromState, toState, {
      type: "instance",
      from: fromInstanceId,
      to: toInstanceId,
    });
  }

  async publishInstance(instanceId: string) {
    const instance = await this.agentInstanceRepository.findById(instanceId);

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found.`);
    }

    const currentInstances = await this.agentInstanceRepository.findCurrentByAgent(
      instance.agentId,
      instance.reference,
    );

    for (const current of currentInstances.filter((item) => item.id !== instance.id)) {
      await this.agentInstanceRepository.save({
        ...current,
        projection: InstanceProjection.ARCHIVED,
      });
    }

    return this.agentInstanceRepository.save({
      ...instance,
      projection: InstanceProjection.CURRENT,
    });
  }

  async revertInstance(instanceId: string) {
    const instance = await this.agentInstanceRepository.findById(instanceId);

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found.`);
    }

    const snapshot = await this.resolveSnapshotState(instance.agentId, instance.commitHash ?? null);

    await this.promoteSnapshotToLiveLane(instance.agentId, instance.id, snapshot);

    const currentInstances = await this.agentInstanceRepository.findCurrentByAgent(
      instance.agentId,
      instance.reference,
    );

    for (const current of currentInstances.filter((item) => item.id !== instance.id)) {
      await this.agentInstanceRepository.save({
        ...current,
        projection: InstanceProjection.ARCHIVED,
      });
    }

    return this.agentInstanceRepository.save({
      ...instance,
      projection: InstanceProjection.CURRENT,
    });
  }

  private async resolveSnapshotState(
    agentId: string,
    commitHash: string | null,
  ): Promise<SnapshotState> {
    if (!commitHash) {
      return {
        commitHash: null,
        parameter: await this.agentParameterVersionRepository.findLiveByAgentId(agentId),
        tools: await this.agentToolVersionRepository.findLiveByAgentId(agentId),
      };
    }

    return {
      commitHash,
      parameter: await this.agentParameterVersionRepository.findByCommitHash(agentId, commitHash),
      tools: await this.agentToolVersionRepository.findByCommitHash(agentId, commitHash),
    };
  }

  private buildSnapshotPayload(
    state: SnapshotState,
    git?: Record<string, unknown> | null,
  ) {
    return {
      commitHash: state.commitHash,
      git: git ?? null,
      parameter: state.parameter
        ? {
            id: state.parameter.id,
            persona: state.parameter.persona ?? [],
            niche: state.parameter.niche ?? null,
            overview: state.parameter.overview ?? null,
            documentation: state.parameter.documentation ?? null,
            corePrompts: state.parameter.corePrompts ?? [],
            responseFormat: state.parameter.responseFormat,
            voiceProfile: state.parameter.voiceProfile ?? null,
            capabilityProfile: state.parameter.capabilityProfile ?? null,
            contextRuleSet: state.parameter.contextRuleSet ?? null,
          }
        : null,
      tools: state.tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description ?? null,
        enabled: tool.enabled,
        schema: tool.schema ?? null,
        code: tool.code ?? null,
        commitHash: tool.commitHash ?? null,
      })),
    };
  }

  private buildDiffPayload(
    fromState: SnapshotState,
    toState: SnapshotState,
    meta: { type: "commit" | "instance"; from: string; to: string },
  ) {
    const fromToolNames = new Set(fromState.tools.map((tool) => tool.name));
    const toToolNames = new Set(toState.tools.map((tool) => tool.name));

    const addedTools = toState.tools.filter((tool) => !fromToolNames.has(tool.name));
    const removedTools = fromState.tools.filter((tool) => !toToolNames.has(tool.name));
    const changedTools = toState.tools
      .filter((tool) => fromToolNames.has(tool.name))
      .map((tool) => {
        const previous = fromState.tools.find((candidate) => candidate.name === tool.name);

        if (!previous) {
          return null;
        }

        const changedFields = [
          previous.description !== tool.description ? "description" : null,
          previous.enabled !== tool.enabled ? "enabled" : null,
          JSON.stringify(previous.schema ?? null) !== JSON.stringify(tool.schema ?? null)
            ? "schema"
            : null,
          previous.code !== tool.code ? "code" : null,
        ].filter((value): value is string => Boolean(value));

        if (changedFields.length === 0) {
          return null;
        }

        return {
          name: tool.name,
          changedFields,
        };
      })
      .filter((value): value is { name: string; changedFields: string[] } => Boolean(value));

    const parameterFieldChanges = [
      this.fieldChanged("persona", fromState.parameter?.persona ?? [], toState.parameter?.persona ?? []),
      this.fieldChanged("niche", fromState.parameter?.niche ?? null, toState.parameter?.niche ?? null),
      this.fieldChanged(
        "overview",
        fromState.parameter?.overview ?? null,
        toState.parameter?.overview ?? null,
      ),
      this.fieldChanged(
        "documentation",
        fromState.parameter?.documentation ?? null,
        toState.parameter?.documentation ?? null,
      ),
      this.fieldChanged(
        "corePrompts",
        fromState.parameter?.corePrompts ?? [],
        toState.parameter?.corePrompts ?? [],
      ),
      this.fieldChanged(
        "responseFormat",
        fromState.parameter?.responseFormat ?? null,
        toState.parameter?.responseFormat ?? null,
      ),
      this.fieldChanged(
        "voiceProfile",
        fromState.parameter?.voiceProfile ?? null,
        toState.parameter?.voiceProfile ?? null,
      ),
      this.fieldChanged(
        "capabilityProfile",
        fromState.parameter?.capabilityProfile ?? null,
        toState.parameter?.capabilityProfile ?? null,
      ),
      this.fieldChanged(
        "contextRuleSet",
        fromState.parameter?.contextRuleSet ?? null,
        toState.parameter?.contextRuleSet ?? null,
      ),
    ].filter((value): value is string => Boolean(value));

    return {
      meta,
      from: this.buildSnapshotPayload(fromState),
      to: this.buildSnapshotPayload(toState),
      diff: {
        parameterFieldsChanged: parameterFieldChanges,
        tools: {
          added: addedTools.map((tool) => tool.name),
          removed: removedTools.map((tool) => tool.name),
          changed: changedTools,
        },
      },
    };
  }

  private fieldChanged(field: string, fromValue: unknown, toValue: unknown) {
    return JSON.stringify(fromValue) !== JSON.stringify(toValue) ? field : null;
  }

  private async promoteSnapshotToLiveLane(
    agentId: string,
    instanceId: string,
    snapshot: SnapshotState,
  ): Promise<void> {
    await this.agentParameterVersionRepository.deleteLiveByAgentId(agentId);
    await this.agentToolVersionRepository.deleteLiveByAgentId(agentId);

    if (snapshot.parameter) {
      await this.agentParameterVersionRepository.save({
        ...this.cloneParameterSnapshot(snapshot.parameter, instanceId, null as unknown as string),
        commitHash: null,
      });
    }

    if (snapshot.tools.length > 0) {
      await this.agentToolVersionRepository.saveMany(
        snapshot.tools.map((tool) => ({
          ...this.cloneToolSnapshot(tool, instanceId, null as unknown as string),
          commitHash: null,
        })),
      );
    }
  }

  private cloneParameterSnapshot(
    parameter: AgentParameter,
    instanceId: string,
    commitHash: string | null,
  ): Partial<AgentParameter> {
    return {
      agentId: parameter.agentId,
      instanceId,
      persona: parameter.persona ? [...parameter.persona] : undefined,
      niche: parameter.niche ? JSON.parse(JSON.stringify(parameter.niche)) : null,
      overview: parameter.overview ?? null,
      documentation: parameter.documentation ?? null,
      corePrompts: parameter.corePrompts ? [...parameter.corePrompts] : undefined,
      responseFormat: JSON.parse(JSON.stringify(parameter.responseFormat)),
      commitHash,
      voiceProfile: parameter.voiceProfile
        ? {
            coreVoiceProfile: parameter.voiceProfile.coreVoiceProfile
              ? JSON.parse(JSON.stringify(parameter.voiceProfile.coreVoiceProfile))
              : null,
            tonalPalette: parameter.voiceProfile.tonalPalette
              ? [...parameter.voiceProfile.tonalPalette]
              : undefined,
            behavioralGuardrails: parameter.voiceProfile.behavioralGuardrails
              ? [...parameter.voiceProfile.behavioralGuardrails]
              : undefined,
          } as any
        : undefined,
      capabilityProfile: parameter.capabilityProfile
        ? {
            capabilityFlags: JSON.parse(
              JSON.stringify(parameter.capabilityProfile.capabilityFlags),
            ),
            restrictions: parameter.capabilityProfile.restrictions
              ? [...parameter.capabilityProfile.restrictions]
              : undefined,
            toolPolicies:
              parameter.capabilityProfile.toolPolicies?.map((policy) => ({
                platformToolId: policy.platformToolId,
                userEnabled: policy.userEnabled,
              })) ?? [],
          } as any
        : undefined,
      contextRuleSet: parameter.contextRuleSet
        ? {
            preset: parameter.contextRuleSet.preset,
            historyDepth: parameter.contextRuleSet.historyDepth,
            persistentMemory: parameter.contextRuleSet.persistentMemory,
            customBehavioralRules: parameter.contextRuleSet.customBehavioralRules
              ? [...parameter.contextRuleSet.customBehavioralRules]
              : undefined,
          } as any
        : undefined,
    };
  }

  private cloneToolSnapshot(
    tool: AgentTool,
    instanceId: string,
    commitHash: string | null,
  ): Partial<AgentTool> {
    return {
      agentId: tool.agentId,
      instanceId,
      name: tool.name,
      description: tool.description ?? null,
      schema: tool.schema ? JSON.parse(JSON.stringify(tool.schema)) : null,
      code: tool.code ?? null,
      enabled: tool.enabled,
      lastTestedAt: tool.lastTestedAt ?? null,
      executionPolicy: tool.executionPolicy
        ? JSON.parse(JSON.stringify(tool.executionPolicy))
        : null,
      stateManagement: tool.stateManagement
        ? JSON.parse(JSON.stringify(tool.stateManagement))
        : null,
      safetyPolicy: tool.safetyPolicy
        ? JSON.parse(JSON.stringify(tool.safetyPolicy))
        : null,
      trigger: tool.trigger ? JSON.parse(JSON.stringify(tool.trigger)) : null,
      commitHash,
    };
  }
}
