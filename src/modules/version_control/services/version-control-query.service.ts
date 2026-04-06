import { Autowired, Service } from "fragment-ts";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";
import { VersionControlCommandService } from "./version-control-command.service";
import { GitConnectionService } from "./git-connection.service";
import { VersionControlSnapshotService } from "./version-control-snapshot.service";

@Service()
export class VersionControlQueryService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  @Autowired()
  private versionControlSnapshotService!: VersionControlSnapshotService;

  @Autowired()
  private gitConnectionService!: GitConnectionService;

  @Autowired()
  private versionControlCommandService!: VersionControlCommandService;

  async getAgentInstances(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    const defaultBranch =
      agent?.metadata?.repository?.defaultBranch?.trim() || "main";
    const instances = await this.agentInstanceRepository.findByAgentId(agentId);

    return instances.map((instance) =>
      this.attachInstanceGitContext(instance, defaultBranch),
    );
  }

  async getInstanceVersionEntries(instanceId: string) {
    return this.agentVersionEntryRepository.findByInstanceId(instanceId);
  }

  async listAgentCommits(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    const defaultBranch =
      agent?.metadata?.repository?.defaultBranch?.trim() || "main";
    const entries =
      await this.agentVersionEntryRepository.findByAgentId(agentId);

    return entries.map((entry) => ({
      id: entry.id,
      version: entry.version,
      releasedAt: entry.releasedAt,
      message: entry.message ?? null,
      commitHash: entry.commitHash ?? null,
      author: entry.author ?? null,
      git: entry.metadata?.git ?? null,
      instance: entry.instance
        ? this.attachInstanceGitContext(entry.instance, defaultBranch)
        : null,
    }));
  }

  async getCommitReview(agentId: string, commitHash: string) {
    const agent = await this.agentRepository.findById(agentId);
    const defaultBranch =
      agent?.metadata?.repository?.defaultBranch?.trim() || "main";
    const target = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      commitHash,
    );

    if (!target) {
      throw new Error(`Commit ${commitHash} not found for agent ${agentId}.`);
    }

    const previous = target.instanceId
      ? await this.agentVersionEntryRepository.findPreviousForInstance(
          target.instanceId,
          target.releasedAt,
        )
      : null;

    const snapshot =
      await this.versionControlSnapshotService.getSnapshotByCommitHash(
        agentId,
        commitHash,
      );

    const review = previous?.commitHash
      ? await this.versionControlSnapshotService.diffByCommitHashes(
          agentId,
          previous.commitHash,
          commitHash,
        )
      : {
          meta: {
            type: "commit" as const,
            from: null,
            to: commitHash,
          },
          from: null,
          to: snapshot,
          diff: {
            parameterFieldsChanged: Object.keys(snapshot?.parameter ?? {}),
            tools: {
              added: (snapshot?.tools ?? []).map(
                (tool: { name: string }) => tool.name,
              ),
              removed: [],
              changed: [],
            },
          },
        };

    return {
      commit: {
        id: target.id,
        version: target.version,
        releasedAt: target.releasedAt,
        message: target.message ?? null,
        commitHash: target.commitHash ?? null,
        author: target.author ?? null,
        instanceId: target.instanceId ?? null,
        branch:
          target.instance?.projection === "current"
            ? defaultBranch
            : (target.instance?.version?.gitBranch ?? defaultBranch),
        branchDisplay:
          target.instance?.projection === "current"
            ? "main"
            : (target.instance?.version?.gitBranch ?? defaultBranch),
        defaultBranch,
      },
      previousCommitHash: previous?.commitHash ?? null,
      snapshot,
      review,
    };
  }

  async getGitConnection(agentId: string) {
    let agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const currentRepository = agent.metadata?.repository;
    const shouldAttemptInitialization = Boolean(
      currentRepository?.isConnected &&
      currentRepository?.githubLogin &&
      currentRepository?.repoName &&
      currentRepository?.health?.readyForAutomaticPush &&
      !currentRepository?.initializedAt,
    );

    if (shouldAttemptInitialization) {
      try {
        await this.versionControlCommandService.initializeGitRepository(
          agentId,
        );
      } catch (error) {
        await this.agentRepository.updateMetadata(agentId, {
          ...(agent.metadata ?? {}),
          repository: {
            ...(agent.metadata?.repository ?? {}),
            lastPushStatus: "failed",
            lastPushMessage:
              error instanceof Error
                ? error.message
                : "Tuul could not initialize the remote repository.",
          },
        });
      }

      const refreshedAgent = await this.agentRepository.findById(agentId);
      if (refreshedAgent) {
        agent = refreshedAgent;
      }
    }

    const repository = agent.metadata?.repository
      ? this.gitConnectionService.normalize({
          provider: agent.metadata.repository.provider,
          repositoryUrl: agent.metadata.repository.repositoryUrl ?? "",
          githubLogin: agent.metadata.repository.githubLogin ?? undefined,
          owner: agent.metadata.repository.owner ?? undefined,
          repoName: agent.metadata.repository.repoName ?? undefined,
          defaultBranch: agent.metadata.repository.defaultBranch ?? undefined,
          installationType: agent.metadata.repository.installationType,
          accessToken: agent.metadata.repository.accessToken ?? undefined,
          refreshToken: agent.metadata.repository.refreshToken ?? undefined,
          tokenExpiresAt: agent.metadata.repository.tokenExpiresAt ?? undefined,
          username: agent.metadata.repository.username ?? undefined,
          installationId: agent.metadata.repository.installationId,
          appInstallationUrl: agent.metadata.repository.appInstallationUrl,
          appInstallations: agent.metadata.repository.appInstallations,
          visibility: agent.metadata.repository.visibility,
          autoCreateRepository: agent.metadata.repository.autoCreateRepository,
          commitMode: agent.metadata.repository.commitMode,
          connectedAt: agent.metadata.repository.connectedAt,
          initializedAt: agent.metadata.repository.initializedAt,
          lastPushAt: agent.metadata.repository.lastPushAt,
          lastPushStatus: agent.metadata.repository.lastPushStatus,
          lastPushMessage: agent.metadata.repository.lastPushMessage,
          lastPullRequestUrl: agent.metadata.repository.lastPullRequestUrl,
        })
      : {
          provider: "github",
          repositoryUrl: null,
          githubLogin: null,
          owner: null,
          repoName: null,
          slug: null,
          host: null,
          defaultBranch: "main",
          installationType: "app",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          username: null,
          installationId: null,
          appClientId: process.env.GIT_APP_CLIENT_ID?.trim() || null,
          appInstallationUrl: null,
          appInstallations: [],
          visibility: "private",
          autoCreateRepository: true,
          commitMode: "direct",
          isConnected: false,
          connectedAt: null,
          initializedAt: null,
          lastPushAt: null,
          lastPushStatus: "idle",
          lastPushMessage: null,
          lastPullRequestUrl: null,
          webUrl: null,
          cloneUrlHttps: null,
          cloneUrlSsh: null,
          branchUrl: null,
          compareUrlTemplate: null,
          health: {
            isValidUrl: false,
            ownerResolved: false,
            repoResolved: false,
            providerSupported: true,
            readyForAutomaticPush: false,
            readyForManualPush: false,
          },
        };

    const hasRepositoryTarget = Boolean(
      (repository.githubLogin ?? repository.owner) && repository.repoName,
    );
    const hasGithubAuth = Boolean(repository.health?.readyForAutomaticPush);
    const needsInitialization =
      Boolean(hasGithubAuth) &&
      hasRepositoryTarget &&
      !repository.initializedAt;

    return {
      ...repository,
      scopedAgentId: agentId,
      actions: {
        canConnectGithub: !hasGithubAuth,
        canInitializeRepo: needsInitialization,
        canManageRepo: hasRepositoryTarget,
      },
      deploy: {
        mode: repository.commitMode === "pull_request" ? "create_pr" : "direct",
        branch: repository.defaultBranch,
        defaultBranch: repository.defaultBranch,
      },
    };
  }

  private attachInstanceGitContext(instance: any, defaultBranch: string) {
    const isDefaultInstance = instance.projection === "current";
    const branch = isDefaultInstance
      ? defaultBranch
      : (instance.version?.gitBranch ?? defaultBranch);

    return {
      ...instance,
      branch,
      branchDisplay: isDefaultInstance ? "main" : branch,
      isDefaultBranch: isDefaultInstance,
      defaultBranch,
    };
  }
}
