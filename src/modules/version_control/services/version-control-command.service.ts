import { Autowired, Service } from "fragment-ts";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import { InstanceStatus } from "../../../entities/enums/instance-status.enum";
import type { AgentMetadata } from "../../../entities/agent.entity";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { ConnectGitRepositoryDto } from "../dto/connect-git-repository.dto";
import { CreateAgentInstanceDto } from "../dto/create-agent-instance.dto";
import { CreateVersionEntryDto } from "../dto/create-version-entry.dto";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";
import { GitConnectionService } from "./git-connection.service";
import { GithubAppService } from "./github-app.service";
import { GitSyncService } from "./git-sync.service";
import { AgentParameterVersionRepository } from "../repositories/agent-parameter-version.repository";
import { AgentToolVersionRepository } from "../repositories/agent-tool-version.repository";
import { AgentVcsService } from "./agent-vcs.service";

@Service()
export class VersionControlCommandService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  @Autowired()
  private gitConnectionService!: GitConnectionService;

  @Autowired()
  private githubAppService!: GithubAppService;

  @Autowired()
  private gitSyncService!: GitSyncService;

  @Autowired()
  private agentParameterVersionRepository!: AgentParameterVersionRepository;

  @Autowired()
  private agentToolVersionRepository!: AgentToolVersionRepository;

  @Autowired()
  private agentVcsService!: AgentVcsService;

  async createAgentInstance(agentId: string, payload: CreateAgentInstanceDto) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const created = await this.agentInstanceRepository.save({
      agentId,
      version: {
        version: payload.version.trim(),
        apiUrl: payload.apiUrl.trim(),
        guiUrl: payload.guiUrl?.trim(),
        deployedAt: payload.deployedAt ?? new Date().toISOString(),
      },
      status: payload.status ?? InstanceStatus.ACTIVE,
      projection: payload.projection ?? InstanceProjection.CURRENT,
      reference: payload.reference ?? null,
      commitHash: payload.commitHash ?? null,
    });

    const gitBranch = this.buildInstanceBranchName(created);
    const instance = await this.agentInstanceRepository.save({
      ...created,
      version: {
        ...created.version,
        gitBranch,
      },
    });

    if (agent.metadata?.repository?.isConnected) {
      const snapshot = await this.buildLiveSnapshot(agentId);
      await this.gitSyncService
        .syncInstanceToRepository(
          agent,
          instance,
          {
            version: instance.version.version,
            message: "Tuul Orchestrator",
            commitHash: instance.commitHash ?? null,
            releasedAt: new Date(),
          },
          snapshot,
        )
        .catch(() => null);
    }

    return instance;
  }

  async createVersionEntry(instanceId: string, payload: CreateVersionEntryDto) {
    const instance = await this.agentInstanceRepository.findById(instanceId);

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found.`);
    }

    return this.agentVersionEntryRepository.save({
      instanceId,
      version: payload.version.trim(),
      releasedAt: payload.releasedAt ? new Date(payload.releasedAt) : new Date(),
      message: payload.message?.trim() ?? null,
      commitHash: payload.commitHash ?? null,
      author: payload.author ?? null,
    });
  }

  async connectGitRepository(agentId: string, payload: ConnectGitRepositoryDto) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const currentMetadata: AgentMetadata = agent.metadata ?? {};
    const githubLoginFromToken = payload.accessToken
      ? await this.githubAppService.getAuthenticatedLogin(payload.accessToken).catch(() => null)
      : null;
    const githubLogin =
      githubLoginFromToken ??
      payload.githubLogin?.trim() ??
      currentMetadata.repository?.githubLogin ??
      payload.username?.trim() ??
      null;
    const repoName =
      payload.repoName?.trim() ||
      currentMetadata.repository?.repoName ||
      agent.slug;
    const repositoryUrl =
      githubLogin && repoName
        ? `https://github.com/${githubLogin}/${repoName}`
        : payload.repositoryUrl;
    return this.agentVcsService.updateAgentRemote(agentId, {
      provider: "github",
      repositoryUrl,
      githubLogin,
      githubAvatarUrl: payload.githubAvatarUrl,
      repoName,
      defaultBranch: payload.defaultBranch,
      installationType: "app",
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      tokenExpiresAt: payload.tokenExpiresAt,
      username: payload.username,
      installationId: payload.installationId,
      appInstallationUrl:
        payload.appInstallationUrl ??
        this.githubAppService.getInstallationUrl({ owner: githubLogin }),
      appInstallations: payload.appInstallations ?? null,
      visibility: payload.visibility as "private" | "public" | "internal" | undefined,
      autoCreateRepository: payload.autoCreateRepository,
      commitMode: payload.commitMode as "direct" | "pull_request" | undefined,
    });
  }

  async initializeGitRepository(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const currentInstances = await this.agentInstanceRepository.findCurrentByAgent(agentId);
    const allInstances = currentInstances.length
      ? currentInstances
      : await this.agentInstanceRepository.findByAgentId(agentId);
    const instance = allInstances[0];

    if (!instance) {
      throw new Error("Create an instance before initializing the repository.");
    }

    const gitBranch = instance.version.gitBranch || this.buildInstanceBranchName(instance);
    const resolvedInstance =
      gitBranch === instance.version.gitBranch
        ? instance
        : await this.agentInstanceRepository.save({
            ...instance,
            version: {
              ...instance.version,
              gitBranch,
            },
          });

    const snapshot = await this.buildLiveSnapshot(agentId);
    return this.gitSyncService.syncInstanceToRepository(
      agent,
      resolvedInstance,
      {
        version: resolvedInstance.version.version,
        message: "Tuul Orchestrator",
        commitHash: resolvedInstance.commitHash ?? null,
        releasedAt: new Date(),
      },
      snapshot,
    );
  }

  private buildInstanceBranchName(instance: { id: string; version: { version: string } }) {
    const sanitizedVersion = instance.version.version
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `instances/${sanitizedVersion || "instance"}-${instance.id.slice(0, 8)}`;
  }

  private async buildLiveSnapshot(agentId: string) {
    return {
      commitHash: null,
      parameter: await this.agentParameterVersionRepository.findLiveByAgentId(agentId),
      tools: await this.agentToolVersionRepository.findLiveByAgentId(agentId),
    };
  }
}
