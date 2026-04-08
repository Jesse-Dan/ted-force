import { Autowired, Service } from "fragment-ts";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import simpleGit from "simple-git";
import { Agent, type AgentMetadata } from "../../../entities/agent.entity";
import { type AgentConfig } from "../../../entities/agent-config.entity";
import { type AgentInstance } from "../../../entities/agent-instance.entity";
import { type AgentParameter } from "../../../entities/agent-parameter.entity";
import { type AgentTool } from "../../../entities/agent-tool.entity";
import { type AgentConnector } from "../../../entities/agent-connector.entity";
import { type Asset } from "../../../entities/asset.entity";
import { type DataSourceConnection } from "../../../entities/data-source-connection.entity";
import { type ExternalResource } from "../../../entities/external-resource.entity";
import { CodeHelper } from "../../../common/helpers/code.helper";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import { InstanceReference } from "../../../entities/enums/instance-reference.enum";
import { InstanceStatus } from "../../../entities/enums/instance-status.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentConfigRepository } from "../../config/repositories/agent-config.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationRepositoryConnectionRepository } from "../../organization/repositories/organization-repository-connection.repository";
import { AssetRepository } from "../../assets_and_resources/repositories/asset.repository";
import { ExternalResourceRepository } from "../../assets_and_resources/repositories/external-resource.repository";
import { AgentConnectorRepository } from "../../connectors/repositories/agent-connector.repository";
import { PlatformConnectorRepository } from "../../connectors/repositories/platform-connector.repository";
import { DataSourceRepository } from "../../data_source/repositories/data-source.repository";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentParameterVersionRepository } from "../repositories/agent-parameter-version.repository";
import { AgentRepositoryConnectionRepository } from "../repositories/agent-repository-connection.repository";
import { AgentToolVersionRepository } from "../repositories/agent-tool-version.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";
import { GitConnectionService } from "./git-connection.service";

type SnapshotShape = {
  schemaVersion: 1;
  agent: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    domainLabel?: string | null;
    version: string;
  };
  config: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
    isSystemHealthy: boolean;
    runtimeLimits?: AgentConfig["runtimeLimits"] | null;
    sdkSecurity?: AgentConfig["sdkSecurity"] | null;
  } | null;
  parameter: {
    persona?: string[];
    niche?: any;
    overview?: string | null;
    documentation?: string | null;
    corePrompts?: string[];
    responseFormat?: any;
    voiceProfile?: any;
    capabilityProfile?: any;
    contextRuleSet?: any;
  } | null;
  tools: Array<{
    name: string;
    description?: string | null;
    schema?: any;
    code?: string | null;
    enabled: boolean;
    executionPolicy?: any;
    stateManagement?: any;
    safetyPolicy?: any;
    trigger?: any;
  }>;
  connectors: Array<{
    name: string;
    slug: string;
    description?: string | null;
    source: string;
    isLive?: boolean;
    isPublic?: boolean;
    authConfig?: Record<string, unknown> | null;
    operations?: Array<Record<string, unknown>>;
    dependencyGraph?: Record<string, unknown> | null;
    envConfig?: Record<string, unknown> | null;
    envRefs?: Array<Record<string, unknown>>;
    logoUrl?: string | null;

    // Legacy connector fields kept to support historical snapshots.
    httpMethod: string;
    toolName: string;
    toolId?: string | null;
    argumentMode: string;
    argumentMappings?: Record<string, string> | null;
    defaultArgs?: Record<string, unknown> | null;
    requestSchema?: Record<string, unknown> | null;
    isExposed: boolean;
    enabled: boolean;
    platformConnectorId?: string | null;
    platformConnectorKey?: string | null;
  }>;
  assets: Array<{
    name: string;
    type: string;
    size: number;
    url: string;
    tags?: string[];
  }>;
  sources: Array<{
    name: string;
    url: string;
    description: string;
    category: string;
  }>;
  datasources: Array<{
    name: string;
    type: string;
    config?: Record<string, unknown> | null;
  }>;
  mcps: Array<{
    slug: string;
    config?: Record<string, unknown> | null;
  }>;
};

type SnapshotFile = {
  path: string;
  content: string;
};

type BranchResponse = {
  id: string;
  name: string;
  displayName: string;
  branch: string;
  isCurrent: boolean;
  isDefault: boolean;
  commitHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CommitResponse = {
  id: string;
  hash: string;
  shortHash: string;
  message: string;
  source: "tuul" | "external";
  author: {
    userId?: string;
    userName?: string;
  } | null;
  timestamp: string;
  branch: {
    id: string | null;
    name: string;
    isDefault: boolean;
  };
  git: NonNullable<
    NonNullable<
      import("../../../entities/agent-version-entry.entity").VersionEntryMetadata["git"]
    >
  >;
};

type RemoteConfig = NonNullable<NonNullable<AgentMetadata["repository"]>>;

@Service()
export class AgentVcsService {
  private readonly queues = new Map<string, Promise<unknown>>();
  private static cachedVcsRootDir: string | null = null;

  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private organizationRepositoryConnectionRepository!: OrganizationRepositoryConnectionRepository;

  @Autowired()
  private agentConfigRepository!: AgentConfigRepository;

  @Autowired()
  private gitConnectionService!: GitConnectionService;

  @Autowired()
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentRepositoryConnectionRepository!: AgentRepositoryConnectionRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  @Autowired()
  private agentParameterVersionRepository!: AgentParameterVersionRepository;

  @Autowired()
  private agentToolVersionRepository!: AgentToolVersionRepository;

  @Autowired()
  private assetRepository!: AssetRepository;

  @Autowired()
  private externalResourceRepository!: ExternalResourceRepository;

  @Autowired()
  private dataSourceRepository!: DataSourceRepository;

  @Autowired()
  private agentConnectorRepository!: AgentConnectorRepository;

  @Autowired()
  private platformConnectorRepository!: PlatformConnectorRepository;

  async bootstrapAgentRepository(
    agentId: string,
    author?: { userId?: string | null; userName?: string | null },
  ) {
    const branch = await this.ensureDefaultBranch(agentId);
    const commits = await this.agentVersionEntryRepository.findByInstanceId(
      branch.id,
    );
    if (commits.length > 0) {
      return {
        branch: this.serializeBranch(branch, "main", branch.id),
        skipped: true,
      };
    }

    return this.commit(agentId, {
      branchId: branch.id,
      message: "Initial commit",
      authorUserId: author?.userId ?? undefined,
      authorName: author?.userName ?? undefined,
      initializeRepository: true,
    });
  }

  async getBranches(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const branches = await this.agentInstanceRepository.findByAgentId(agentId);
    const defaultBranch = this.getDefaultBranchName(agent);
    const currentBranchId = agent.metadata?.repository?.currentBranchId ?? null;
    return branches.map((branch) =>
      this.serializeBranch(branch, defaultBranch, currentBranchId),
    );
  }

  async createBranch(
    agentId: string,
    payload: {
      name: string;
      fromBranchId?: string;
      fromBranchName?: string;
      pushAfterCreate?: boolean;
    },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const defaultBranch = this.getDefaultBranchName(agent);
      const currentRepository = agent.metadata?.repository ?? null;
      const normalizedBranchName = this.normalizeBranchName(
        payload.name,
        defaultBranch,
      );

      const existingByName =
        await this.agentInstanceRepository.findByBranchName(
          agentId,
          normalizedBranchName,
        );
      if (existingByName) {
        throw new Error(`Branch ${normalizedBranchName} already exists.`);
      }

      const sourceBranch = await this.resolveBranch(agentId, {
        branchId: payload.fromBranchId,
        branchName: payload.fromBranchName,
        allowDefaultFallback: true,
      });

      const createdBranch = await this.agentInstanceRepository.save({
        agentId,
        version: {
          version: normalizedBranchName,
          apiUrl: `/agents/${agentId}`,
          guiUrl: `/app/overview`,
          deployedAt: new Date().toISOString(),
          gitBranch: normalizedBranchName,
        },
        status: InstanceStatus.ACTIVE,
        projection: InstanceProjection.ARCHIVED,
        reference: InstanceReference.DEPLOYMENT,
        commitHash: sourceBranch?.commitHash ?? null,
      });

      const sourceCommit = sourceBranch
        ? await this.agentVersionEntryRepository.findLatestForInstance(
            sourceBranch.id,
          )
        : null;

      if (sourceCommit?.metadata?.snapshot) {
        const commitHash = this.generateCommitHash();
        const files =
          sourceCommit.metadata.files ??
          this.generateRepositoryFiles(
            sourceCommit.metadata.snapshot as SnapshotShape,
            normalizedBranchName,
          );
        const entry = await this.agentVersionEntryRepository.save({
          instanceId: createdBranch.id,
          version: normalizedBranchName,
          releasedAt: new Date(),
          message: `Create branch ${normalizedBranchName}${sourceBranch ? ` from ${sourceBranch.version.gitBranch ?? sourceBranch.version.version}` : ""}`,
          commitHash,
          metadata: {
            branch: {
              id: createdBranch.id,
              name: normalizedBranchName,
              isDefault: normalizedBranchName === defaultBranch,
            },
            parentCommitHash: sourceCommit.commitHash ?? null,
            snapshot: sourceCommit.metadata.snapshot,
            files,
            git: {
              status: "pending",
              pushed: false,
              syncedAt: null,
              message: null,
              remoteUrl: null,
              branch: normalizedBranchName,
            },
          },
        });
        await this.agentInstanceRepository.save({
          ...createdBranch,
          commitHash,
        });
        let gitResult: any = null;
        if (payload.pushAfterCreate) {
          gitResult = await this.syncCommitToGit(agent, createdBranch, entry).catch(
            () => null,
          );

          const previousBranchName =
            currentRepository?.currentBranchName ??
            sourceBranch?.version.gitBranch ??
            sourceBranch?.version.version ??
            defaultBranch;
          const previousBranchId = currentRepository?.currentBranchId ?? null;
          const repoPath = this.getRepoPath(agent.id);
          const git = simpleGit(repoPath);
          await this.checkoutBranch(git, previousBranchName).catch(() => null);
          await this.updateRepositoryMetadata(agent, {
            currentBranchId: previousBranchId,
            currentBranchName: previousBranchName,
          });
        }
        return {
          branch: this.serializeBranch(
            { ...createdBranch, commitHash },
            defaultBranch,
            agent.metadata?.repository?.currentBranchId ?? null,
          ),
          commit: this.serializeCommit(
            entry,
            normalizedBranchName,
            normalizedBranchName === defaultBranch,
          ),
          git: gitResult,
        };
      }

      return {
        branch: this.serializeBranch(
          createdBranch,
          defaultBranch,
          agent.metadata?.repository?.currentBranchId ?? null,
        ),
      };
    });
  }

  async switchBranch(
    agentId: string,
    payload: { branchId?: string; branchName?: string },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        branchId: payload.branchId,
        branchName: payload.branchName,
        allowDefaultFallback: false,
      });
      if (!branch) {
        throw new Error("Branch not found.");
      }

      const snapshot = await this.getBranchHeadSnapshot(agentId, branch.id);
      if (snapshot) {
        await this.applySnapshot(agent, snapshot);
        await this.syncRepositoryRepresentations(
          this.getRepoPath(agentId),
          snapshot,
          branch.version.gitBranch ?? branch.version.version,
        );
      }

      const branches =
        await this.agentInstanceRepository.findByAgentId(agentId);
      for (const candidate of branches) {
        await this.agentInstanceRepository.save({
          ...candidate,
          projection:
            candidate.id === branch.id
              ? InstanceProjection.CURRENT
              : InstanceProjection.ARCHIVED,
        });
      }

      const metadata: AgentMetadata = {
        ...(agent.metadata ?? {}),
        repository: {
          ...(agent.metadata?.repository ?? {}),
          mode: agent.metadata?.repository?.mode ?? "internal",
          currentBranchId: branch.id,
          currentBranchName: branch.version.gitBranch ?? branch.version.version,
          defaultBranch: this.getDefaultBranchName(agent),
        },
      };
      await this.agentRepository.updateMetadata(agentId, metadata);

      const refreshed = await this.agentInstanceRepository.findById(branch.id);
      return {
        branch: this.serializeBranch(
          refreshed ?? branch,
          this.getDefaultBranchName(agent),
          branch.id,
        ),
        reloaded: true,
      };
    });
  }

  async deleteBranch(agentId: string, branchId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.agentInstanceRepository.findById(branchId);
      if (!branch || branch.agentId !== agentId) {
        throw new Error("Branch not found.");
      }
      const defaultBranch = this.getDefaultBranchName(agent);
      const branchName = branch.version.gitBranch ?? branch.version.version;
      if (branchName === defaultBranch) {
        throw new Error("The default branch cannot be deleted.");
      }

      await this.agentInstanceRepository.deleteById(branchId);
      return { id: branchId, deleted: true };
    });
  }

  async getLog(agentId: string, branchId?: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const defaultBranch = this.getDefaultBranchName(agent);

    // Self-heal legacy commits that were stored without `instance_id` by backfilling
    // from the branch id/name captured in metadata.
    await this.repairOrphanedVersionEntries(agentId);

    const repoPath = this.getRepoPath(agentId);
    const git = simpleGit(repoPath);
    const isRepo = await git.checkIsRepo().catch(() => false);

    const branches = await this.agentInstanceRepository.findByAgentId(agentId);
    const branchIdByName = new Map<string, string>();
    for (const b of branches) {
      const name = (b.version.gitBranch ?? b.version.version ?? "").trim();
      if (name) branchIdByName.set(name, b.id);
    }

    const serializeEntries = (entries: any[]) =>
      entries.map((entry) =>
        this.serializeCommit(
          entry,
          entry.instance?.version?.gitBranch ??
            entry.instance?.version?.version ??
            defaultBranch,
          (entry.instance?.version?.gitBranch ??
            entry.instance?.version?.version ??
            defaultBranch) === defaultBranch,
        ),
      );

    const tuulEntries = branchId
      ? await this.agentVersionEntryRepository.findByInstanceId(branchId)
      : await this.agentVersionEntryRepository.findByAgentId(agentId);

    const tuulSerialized = serializeEntries(tuulEntries);
    const tuulHashes = new Set<string>();
    const tuulCommitMirrors = tuulEntries.map((entry) => ({
      message: String(entry.message ?? "").trim(),
      branchName: String(
        entry.metadata?.branch?.name ??
          entry.metadata?.git?.branch ??
          entry.instance?.version?.gitBranch ??
          entry.instance?.version?.version ??
          defaultBranch,
      ).trim(),
      timestamp:
        entry.releasedAt instanceof Date
          ? entry.releasedAt.getTime()
          : new Date(entry.releasedAt).getTime(),
      nativeCommitHash: String(
        entry.metadata?.git?.nativeCommitHash ?? "",
      ).trim(),
      status: String(entry.metadata?.git?.status ?? "pending").trim(),
    }));
    for (const entry of tuulEntries) {
      const dbHash = String(entry.commitHash ?? "").trim();
      const nativeHash = String(entry.metadata?.git?.nativeCommitHash ?? "").trim();
      if (dbHash) tuulHashes.add(dbHash);
      if (nativeHash) tuulHashes.add(nativeHash);
    }

    // Also surface commits made outside of Tuul (directly in Git).
    // These are read-only in Tuul since we don't have persisted snapshots for them.
    const externalCommitsByHash = new Map<
      string,
      {
        hash: string;
        message: string;
        authorName: string | null;
        timestamp: string;
        branchName: string;
      }
    >();

    if (isRepo) {
      const refsToScan: Array<{ branchName: string; isDefault: boolean }> = [];
      if (branchId) {
        const branch = branches.find((b) => b.id === branchId) ?? null;
        const branchName = (
          branch?.version.gitBranch ??
          branch?.version.version ??
          defaultBranch
        ).trim();
        if (branchName)
          refsToScan.push({
            branchName,
            isDefault: branchName === defaultBranch,
          });
      } else {
        for (const branch of branches) {
          const branchName = (
            branch.version.gitBranch ??
            branch.version.version ??
            defaultBranch
          ).trim();
          if (!branchName) continue;
          refsToScan.push({
            branchName,
            isDefault: branchName === defaultBranch,
          });
        }
      }

      for (const ref of refsToScan) {
        const gitCommits = await this.readGitLogCommits(
          git,
          ref.branchName,
          200,
        );
        for (const commit of gitCommits) {
          if (!commit.hash || tuulHashes.has(commit.hash)) continue;
          const commitTimestamp = Number(new Date(commit.timestamp).getTime()) || 0;
          const normalizedMessage = String(commit.message ?? "").trim();
          const isMirroredTuulCommit = tuulCommitMirrors.some((entry) => {
            if (entry.nativeCommitHash && entry.nativeCommitHash === commit.hash) {
              return true;
            }
            if (entry.branchName !== ref.branchName) return false;
            if (entry.message !== normalizedMessage) return false;
            if (entry.status !== "success") return false;
            if (!entry.timestamp || !commitTimestamp) return false;
            return Math.abs(entry.timestamp - commitTimestamp) <= 5 * 60 * 1000;
          });
          if (isMirroredTuulCommit) continue;
          const existing = externalCommitsByHash.get(commit.hash);
          if (!existing) {
            externalCommitsByHash.set(commit.hash, {
              ...commit,
              branchName: ref.branchName,
            });
            continue;
          }
          // Prefer default-branch association when possible.
          if (ref.isDefault && existing.branchName !== defaultBranch) {
            externalCommitsByHash.set(commit.hash, {
              ...commit,
              branchName: ref.branchName,
            });
          }
        }
      }
    }

    const externalSerialized = Array.from(externalCommitsByHash.values()).map(
      (commit) => {
        const isDefault = commit.branchName === defaultBranch;
        const branchIdForCommit = branchIdByName.get(commit.branchName) ?? null;
        return this.serializeExternalCommit(
          commit,
          commit.branchName,
          isDefault,
          branchIdForCommit,
        );
      },
    );

    const combined = [...tuulSerialized, ...externalSerialized].sort((a, b) => {
      const ta = Number(new Date(a.timestamp).getTime()) || 0;
      const tb = Number(new Date(b.timestamp).getTime()) || 0;
      return tb - ta;
    });

    return combined;
  }

  async getCommit(agentId: string, commitHash: string) {
    await this.repairOrphanedVersionEntries(agentId);
    const commit = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      commitHash,
    );
    if (!commit) {
      // Fallback: commit exists in Git but was not created by Tuul.
      return this.getExternalCommit(agentId, commitHash);
    }

    return {
      commit: this.serializeCommit(
        commit,
        commit.instance?.version?.gitBranch ??
          commit.instance?.version?.version ??
          "main",
        Boolean(commit.metadata?.branch?.isDefault),
      ),
      snapshot: commit.metadata?.snapshot ?? null,
      files: commit.metadata?.files ?? [],
    };
  }

  async getCommitReview(agentId: string, commitHash: string) {
    await this.repairOrphanedVersionEntries(agentId);
    const commit = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      commitHash,
    );
    if (!commit) {
      // Fallback: commit exists in Git but was not created by Tuul.
      return this.getExternalCommitReview(agentId, commitHash);
    }

    const parentHash = commit.metadata?.parentCommitHash ?? null;
    const previous = parentHash
      ? await this.agentVersionEntryRepository.findByCommitHash(
          agentId,
          parentHash,
        )
      : null;

    return {
      commit: this.serializeCommit(
        commit,
        commit.instance?.version?.gitBranch ??
          commit.instance?.version?.version ??
          "main",
        Boolean(commit.metadata?.branch?.isDefault),
      ),
      previousCommitHash: parentHash,
      snapshot: commit.metadata?.snapshot ?? null,
      review: this.buildFileDiff(
        previous?.metadata?.files ?? [],
        commit.metadata?.files ?? [],
        {
          type: "commit",
          from: parentHash ?? "empty",
          to: commitHash,
        },
      ),
    };
  }

  async commit(
    agentId: string,
    payload: {
      message: string;
      branchId?: string;
      branchName?: string;
      authorUserId?: string;
      authorName?: string;
      initializeRepository?: boolean;
    },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch =
        (await this.resolveBranch(agentId, {
          branchId: payload.branchId,
          branchName: payload.branchName,
          allowDefaultFallback: true,
        })) ?? (await this.ensureDefaultBranch(agentId));
      const defaultBranch = this.getDefaultBranchName(agent);
      const snapshot = await this.buildLiveSnapshot(agentId);
      const files = this.generateRepositoryFiles(
        snapshot,
        branch.version.gitBranch ?? branch.version.version,
      );
      const commitHash = this.generateCommitHash();
      const previous =
        await this.agentVersionEntryRepository.findLatestForInstance(branch.id);

      const entry = await this.agentVersionEntryRepository.save({
        instanceId: branch.id,
        version: branch.version.version,
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
          branch: {
            id: branch.id,
            name: branch.version.gitBranch ?? branch.version.version,
            isDefault:
              (branch.version.gitBranch ?? branch.version.version) ===
              defaultBranch,
          },
          parentCommitHash: previous?.commitHash ?? null,
          snapshot,
          files,
          git: {
            status: "pending",
            pushed: false,
            syncedAt: null,
            message: null,
            remoteUrl: null,
            branch: branch.version.gitBranch ?? branch.version.version,
          },
        },
      });

      await this.agentInstanceRepository.save({
        ...branch,
        commitHash,
        projection: InstanceProjection.CURRENT,
      });

      const gitResult = await this.syncCommitToGit(agent, branch, entry, {
        initializeRepository: payload.initializeRepository ?? false,
      });
      if (gitResult) {
        await this.agentVersionEntryRepository.updateMetadata(entry.id, {
          ...(entry.metadata ?? {}),
          git: {
            status: gitResult.success ? "success" : "failed",
            pushed: gitResult.pushed,
            syncedAt: gitResult.success ? new Date().toISOString() : null,
            message: gitResult.message,
            remoteUrl: gitResult.remoteUrl,
            branch: gitResult.branch,
            nativeCommitHash: gitResult.nativeCommitHash ?? null,
          },
        });
      }

      const refreshedEntry =
        await this.agentVersionEntryRepository.findByCommitHash(
          agentId,
          commitHash,
        );
      return {
        branch: this.serializeBranch(branch, defaultBranch, branch.id),
        commit: this.serializeCommit(
          refreshedEntry ?? entry,
          branch.version.gitBranch ?? branch.version.version,
          (branch.version.gitBranch ?? branch.version.version) ===
            defaultBranch,
        ),
        dirty: false,
      };
    });
  }

  async initRepository(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      await this.ensureDefaultBranch(agentId);
      const repoPath = this.getRepoPath(agentId);
      await mkdir(repoPath, { recursive: true });

      const branches =
        await this.agentInstanceRepository.findByAgentId(agentId);
      const defaultBranch = this.getDefaultBranchName(agent);
      const git = simpleGit(repoPath);
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        await git.init();
      }

      const remote = await this.getEffectiveRemote(agent);
      await this.ensureRemote(git, remote);

      const orderedBranches = [
        ...branches.filter(
          (branch) =>
            (branch.version.gitBranch ?? branch.version.version) ===
            defaultBranch,
        ),
        ...branches.filter(
          (branch) =>
            (branch.version.gitBranch ?? branch.version.version) !==
            defaultBranch,
        ),
      ];

      for (const branch of orderedBranches) {
        const branchName = branch.version.gitBranch ?? branch.version.version;
        await this.checkoutBranch(git, branchName);
        let commits =
          await this.agentVersionEntryRepository.findByInstanceIdAsc(branch.id);
        if (commits.length === 0) {
          const bootstrapEntry = await this.ensureBranchBootstrapCommit(
            agent,
            branch,
            "Initial commit",
          );
          commits = [bootstrapEntry];
        }

        for (const commit of commits) {
          const files =
            commit.metadata?.files ??
            this.generateRepositoryFiles(
              (commit.metadata?.snapshot as SnapshotShape | null) ??
                (await this.buildLiveSnapshot(agentId)),
              branchName,
            );
          await this.writeManagedFiles(repoPath, files);
          await git.add(".");
          await git
            .commit(commit.message?.trim() || "Update agent", undefined, {
              "--allow-empty": null,
            })
            .catch(() => null);
        }

        if (remote?.repositoryUrl) {
          if (remote.autoCreateRepository) {
            await this.ensureRemoteRepository(remote);
          }
          await git
            .push("origin", branchName, { "-u": null })
            .catch(() => null);
        }
      }

      await this.updateRepositoryMetadata(agent, {
        mode: "git",
        localRepoPath: repoPath,
        initializedAt: new Date().toISOString(),
        currentBranchId:
          agent.metadata?.repository?.currentBranchId ??
          orderedBranches[0]?.id ??
          null,
        currentBranchName:
          agent.metadata?.repository?.currentBranchName ??
          orderedBranches[0]?.version.gitBranch ??
          orderedBranches[0]?.version.version ??
          defaultBranch,
      });

      return {
        initialized: true,
        localRepoPath: repoPath,
        branchCount: orderedBranches.length,
      };
    });
  }

  async push(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available to push.");
      }

      // Ensure legacy commits are linked to a branch so we can push the right history.
      await this.repairOrphanedVersionEntries(agentId);

      const repository = await this.getEffectiveRemote(agent);
      if (!repository?.repositoryUrl) {
        return {
          pushed: false,
          pendingCommits: 0,
          branch:
            branch.version.gitBranch ??
            branch.version.version ??
            this.getDefaultBranchName(agent),
          remoteUrl: null,
          message: "No remote repository configured.",
        };
      }

      const branchName =
        branch.version.gitBranch ??
        branch.version.version ??
        this.getDefaultBranchName(agent);

      let entries = await this.agentVersionEntryRepository.findByInstanceIdAsc(
        branch.id,
      );
      if (entries.length === 0) {
        const bootstrap = await this.ensureBranchBootstrapCommit(
          agent,
          branch,
          "Sync current branch",
        );
        entries = [bootstrap];
      }

      const pending = entries.filter((entry) => {
        const pushed = Boolean(entry.metadata?.git?.pushed);
        const status = entry.metadata?.git?.status ?? "pending";
        return !pushed || status !== "success";
      });

      if (pending.length === 0) {
        return {
          pushed: true,
          pendingCommits: 0,
          pushedCommits: 0,
          branch: branchName,
          remoteUrl: repository.repositoryUrl ?? null,
          message: "No pending commits to push.",
        };
      }

      const repoPath = this.getRepoPath(agentId);
      await mkdir(repoPath, { recursive: true });
      const git = simpleGit(repoPath);
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        await git.init().catch(() => null);
      }
      await this.ensureRemote(git, repository);
      await this.checkoutBranch(git, branchName);

      // Guard: if the remote branch is ahead, pushing would be rejected (non-fast-forward).
      // We expect users to Fetch/Pull (or resolve via PR) before retrying push.
      const preflightFetchError = await git
        .fetch("origin", branchName)
        .then(() => null)
        .catch((error) =>
          this.readErrorMessage(
            error,
            "Git fetch failed. Check your remote connection and try again.",
          ),
        );
      if (preflightFetchError) {
        const disconnected = await this.disconnectRemoteOnAuthFailure(
          agentId,
          agent,
          preflightFetchError,
        );
        return {
          pushed: false,
          pendingCommits: pending.length,
          pushedCommits: 0,
          branch: branchName,
          remoteUrl: repository.repositoryUrl ?? null,
          message: disconnected
            ? "Git authentication failed. GitHub account was disconnected. Reconnect and retry."
            : preflightFetchError,
          requiresReconnect: disconnected,
        };
      }
      const aheadBehind = await this.getAheadBehindCounts(git, branchName);
      if (aheadBehind.remoteAheadBy > 0) {
        const message = `Remote branch has ${aheadBehind.remoteAheadBy} new commit${aheadBehind.remoteAheadBy === 1 ? "" : "s"}. Pull before pushing.`;
        await this.updateRepositoryMetadata(agent, {
          lastPushStatus: "failed",
          lastPushMessage: message,
        });

        const now = new Date().toISOString();
        for (const entry of pending) {
          await this.agentVersionEntryRepository.updateMetadata(entry.id, {
            ...(entry.metadata ?? {}),
            git: {
              ...(entry.metadata?.git ?? {}),
              status: "failed",
              pushed: false,
              syncedAt: null,
              message,
              remoteUrl: repository.repositoryUrl ?? null,
              branch: branchName,
            },
          });
        }

        return {
          pushed: false,
          pendingCommits: pending.length,
          pushedCommits: 0,
          branch: branchName,
          remoteUrl: repository.repositoryUrl ?? null,
          message,
          requiresPull: true,
          remoteAheadBy: aheadBehind.remoteAheadBy,
        };
      }

      // Make retries safe/idempotent: reset local branch to remote before replaying commits.
      // Failed attempts should not accumulate extra git commits in `.tuul-vcs`.
      await git
        .raw(["reset", "--hard", `origin/${branchName}`])
        .catch(() => null);

      // Replay pending commits in order so the remote gets the same history as Tuul.
      for (const entry of pending) {
        const files =
          entry.metadata?.files ??
          this.generateRepositoryFiles(
            (entry.metadata?.snapshot as SnapshotShape | null) ??
              (await this.buildLiveSnapshot(agentId)),
            branchName,
          );
        await this.writeManagedFiles(repoPath, files);
        await git.add(".");
        await git
          .commit(entry.message?.trim() || "Update agent", undefined, {
            "--allow-empty": null,
          })
          .catch(() => null);
      }

      let pushed = false;
      let pushMessage = `Pushed ${pending.length} commit${pending.length === 1 ? "" : "s"}.`;

      if (repository.autoCreateRepository) {
        await this.ensureRemoteRepository(repository);
      }

      try {
        await git.push("origin", branchName, { "-u": null });
        pushed = true;
      } catch (error: any) {
        pushed = false;
        pushMessage = this.readErrorMessage(
          error,
          `Failed to push branch ${branchName} to remote repository.`,
        );
      }

      let disconnected = false;
      if (!pushed) {
        disconnected = await this.disconnectRemoteOnAuthFailure(
          agentId,
          agent,
          pushMessage,
        );
        if (disconnected) {
          pushMessage =
            "Git authentication failed. GitHub account was disconnected. Reconnect and retry.";
        }
      }

      const now = new Date().toISOString();
      for (const entry of pending) {
        await this.agentVersionEntryRepository.updateMetadata(entry.id, {
          ...(entry.metadata ?? {}),
          git: {
            ...(entry.metadata?.git ?? {}),
            status: pushed ? "success" : "failed",
            pushed,
            syncedAt: pushed ? now : null,
            message: pushed
              ? entry.message?.trim?.() || "Update agent"
              : pushMessage,
            remoteUrl: repository.repositoryUrl ?? null,
            branch: branchName,
          },
        });
      }

      await this.updateRepositoryMetadata(agent, {
        mode: "git",
        localRepoPath: repoPath,
        currentBranchId: branch.id,
        currentBranchName: branchName,
        initializedAt: agent.metadata?.repository?.initializedAt ?? null,
        lastPushAt: pushed
          ? now
          : (agent.metadata?.repository?.lastPushAt ?? null),
        lastPushStatus: pushed ? "success" : "failed",
        lastPushMessage: pushMessage,
      });

      return {
        pushed,
        pendingCommits: pending.length,
        pushedCommits: pushed ? pending.length : 0,
        branch: branchName,
        remoteUrl: repository.repositoryUrl ?? null,
        message: pushMessage,
        requiresReconnect: disconnected,
      };
    });
  }

  async pull(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available to pull.");
      }

      const repoPath = this.getRepoPath(agentId);
      const git = simpleGit(repoPath);
      const remote = await this.getEffectiveRemote(agent);
      if (!remote?.repositoryUrl) {
        return { pulled: false, reason: "No remote configured." };
      }

      await mkdir(repoPath, { recursive: true });
      await this.ensureRemote(git, remote);

      const branchName = branch.version.gitBranch ?? branch.version.version;
      await this.checkoutBranch(git, branchName);
      try {
        // Server-side pulls must never merge/rebase.
        // We only allow fast-forwarding the working repo to the remote branch.
        const preflightFetchError = await git
          .fetch("origin", branchName)
          .then(() => null)
          .catch((error) =>
            this.readErrorMessage(
              error,
              "Git fetch failed. Check your remote connection and try again.",
            ),
          );
        if (preflightFetchError) {
          const disconnected = await this.disconnectRemoteOnAuthFailure(
            agentId,
            agent,
            preflightFetchError,
          );
          return {
            pulled: false,
            branch: branchName,
            conflict: false,
            diverged: false,
            reason: disconnected
              ? "Git authentication failed. GitHub account was disconnected. Reconnect and retry."
              : preflightFetchError,
            requiresReconnect: disconnected,
            details: {
              message: preflightFetchError,
            },
          };
        }

        const counts = await this.getAheadBehindCounts(git, branchName);
        if (counts.localAheadBy > 0 && counts.remoteAheadBy > 0) {
          return {
            pulled: false,
            branch: branchName,
            conflict: false,
            diverged: true,
            reason:
              "Local and remote have diverged. Tuul won't merge/rebase on the server. Resolve it on your machine (or via PR), merge, then come back and Fetch/Pull again.",
            details: {
              localAheadBy: counts.localAheadBy,
              remoteAheadBy: counts.remoteAheadBy,
            },
          };
        }

        if (counts.remoteAheadBy > 0) {
          // Fast-forward only.
          await git.raw(["merge", "--ff-only", `origin/${branchName}`]);
        }
      } catch (error: any) {
        const message = this.readErrorMessage(
          error,
          "Git pull failed. Please resolve the conflict in your Git provider and try again.",
        );

        // We should not leave the server-side repo in a conflicted merge state,
        // since users resolve conflicts on their machine (out of scope for Tuul UI).
        await git.raw(["merge", "--abort"]).catch(() => null);

        const disconnected = await this.disconnectRemoteOnAuthFailure(
          agentId,
          agent,
          message,
        );
        if (disconnected) {
          return {
            pulled: false,
            branch: branchName,
            conflict: false,
            diverged: false,
            reason:
              "Git authentication failed. GitHub account was disconnected. Reconnect and retry.",
            requiresReconnect: true,
            details: {
              message,
            },
          };
        }

        const looksLikeConflict =
          /CONFLICT|merge conflict|Automatic merge failed|unmerged/i.test(
            message,
          );
        const looksLikeDiverged =
          /divergent branches|Need to specify how to reconcile divergent branches|Not possible to fast-forward/i.test(
            message,
          );

        return {
          pulled: false,
          branch: branchName,
          conflict: looksLikeConflict,
          diverged: looksLikeDiverged,
          reason: looksLikeConflict
            ? "Merge conflict. Resolve it locally, open a PR, merge, then come back to Tuul and Fetch/Pull again."
            : looksLikeDiverged
              ? "Local and remote have diverged. Tuul won't merge/rebase on the server. Resolve it on your machine (or via PR), merge, then come back to Tuul and Fetch/Pull again."
              : message,
          details: {
            message,
          },
        };
      }

      const snapshot = await this.readSnapshotFromRepo(repoPath);
      if (snapshot) {
        await this.applySnapshot(agent, snapshot);
        await this.syncRepositoryRepresentations(repoPath, snapshot, branchName);
      }

      await this.updateRepositoryMetadata(agent, {
        lastPullAt: new Date().toISOString(),
      });

      return { pulled: true, branch: branchName };
    });
  }

  async replaceLocalWithRemote(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available to replace.");
      }

      const repoPath = this.getRepoPath(agentId);
      const git = simpleGit(repoPath);
      const remote = await this.getEffectiveRemote(agent);
      if (!remote?.repositoryUrl) {
        return { replaced: false, reason: "No remote configured." };
      }

      await mkdir(repoPath, { recursive: true });
      await this.ensureRemote(git, remote);

      const branchName = branch.version.gitBranch ?? branch.version.version;
      await this.checkoutBranch(git, branchName);
      await git.fetch("origin", branchName).catch(() => null);
      await git.raw(["reset", "--hard", `origin/${branchName}`]);

      const snapshot = await this.readSnapshotFromRepo(repoPath);
      if (snapshot) {
        await this.applySnapshot(agent, snapshot);
        await this.syncRepositoryRepresentations(repoPath, snapshot, branchName);
      }

      await this.markBranchPendingCommitsReplaced(
        branch.id,
        remote.repositoryUrl ?? null,
        branchName,
      );

      const now = new Date().toISOString();
      await this.updateRepositoryMetadata(agent, {
        lastFetchAt: now,
        lastPullAt: now,
        lastPushStatus: "idle",
        lastPushMessage: "Local repository replaced with remote branch state.",
      });

      return {
        replaced: true,
        branch: branchName,
        action: "replace-local-with-remote",
        message: "Local branch was replaced with the remote branch state.",
      };
    });
  }

  async replaceRemoteWithLocal(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available to replace.");
      }

      const repository = await this.getEffectiveRemote(agent);
      if (!repository?.repositoryUrl) {
        return { replaced: false, reason: "No remote configured." };
      }

      let entries = await this.agentVersionEntryRepository.findByInstanceIdAsc(
        branch.id,
      );
      if (entries.length === 0) {
        const bootstrap = await this.ensureBranchBootstrapCommit(
          agent,
          branch,
          "Sync current branch",
        );
        entries = [bootstrap];
      }

      const pending = entries.filter((entry) => {
        const pushed = Boolean(entry.metadata?.git?.pushed);
        const status = String(entry.metadata?.git?.status ?? "pending");
        return !pushed || (status !== "success" && status !== "replaced");
      });

      const repoPath = this.getRepoPath(agentId);
      await mkdir(repoPath, { recursive: true });
      const git = simpleGit(repoPath);
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        await git.init().catch(() => null);
      }
      await this.ensureRemote(git, repository);

      const branchName = branch.version.gitBranch ?? branch.version.version;
      await this.checkoutBranch(git, branchName);
      await git.fetch("origin", branchName).catch(() => null);

      for (const entry of pending) {
        const files =
          entry.metadata?.files ??
          this.generateRepositoryFiles(
            (entry.metadata?.snapshot as SnapshotShape | null) ??
              (await this.buildLiveSnapshot(agentId)),
            branchName,
          );
        await this.writeManagedFiles(repoPath, files);
        await git.add(".");
        await git
          .commit(entry.message?.trim() || "Update agent", undefined, {
            "--allow-empty": null,
          })
          .catch(() => null);
      }

      if (repository.autoCreateRepository) {
        await this.ensureRemoteRepository(repository);
      }

      let pushed = false;
      let pushMessage =
        pending.length > 0
          ? `Force-published ${pending.length} commit${pending.length === 1 ? "" : "s"}.`
          : "Remote branch replaced with local branch state.";

      try {
        await git.push("origin", branchName, {
          "-u": null,
          "--force-with-lease": null,
        });
        pushed = true;
      } catch (error: any) {
        pushed = false;
        pushMessage =
          error?.message?.trim?.() ||
          `Failed to replace remote branch ${branchName} with local state.`;
      }

      const now = new Date().toISOString();
      for (const entry of pending) {
        await this.agentVersionEntryRepository.updateMetadata(entry.id, {
          ...(entry.metadata ?? {}),
          git: {
            ...(entry.metadata?.git ?? {}),
            status: pushed ? "success" : "failed",
            pushed,
            syncedAt: pushed ? now : null,
            message: pushed
              ? entry.message?.trim?.() || "Update agent"
              : pushMessage,
            remoteUrl: repository.repositoryUrl ?? null,
            branch: branchName,
          },
        });
      }

      await this.updateRepositoryMetadata(agent, {
        mode: "git",
        localRepoPath: repoPath,
        currentBranchId: branch.id,
        currentBranchName: branchName,
        initializedAt: agent.metadata?.repository?.initializedAt ?? null,
        lastPushAt: pushed
          ? now
          : (agent.metadata?.repository?.lastPushAt ?? null),
        lastPushStatus: pushed ? "success" : "failed",
        lastPushMessage: pushMessage,
      });

      return {
        replaced: pushed,
        branch: branchName,
        action: "replace-remote-with-local",
        message: pushMessage,
      };
    });
  }

  async getConflictReview(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available for conflict review.");
      }

      const repoPath = this.getRepoPath(agentId);
      const git = simpleGit(repoPath);
      const remote = await this.getEffectiveRemote(agent);
      if (!remote?.repositoryUrl) {
        throw new Error("No remote configured.");
      }

      await mkdir(repoPath, { recursive: true });
      await this.ensureRemote(git, remote);

      const branchName = branch.version.gitBranch ?? branch.version.version;
      await this.checkoutBranch(git, branchName);
      await git.fetch("origin", branchName).catch(() => null);

      const counts = await this.getAheadBehindCounts(git, branchName);
      const codeExtensions = await this.readToolCodeExtensions(repoPath);
      const localSnapshot = await this.buildLiveSnapshot(agentId);
      const localFiles = this.generateRepositoryFiles(localSnapshot, branchName, {
        codeExtensions,
      }).filter((file) => this.isUserMergeableFile(file.path));
      const remoteFiles = (
        await this.readRepoFilesAtRef(git, `origin/${branchName}`)
      ).filter((file) => this.isUserMergeableFile(file.path));

      return {
        branch: branchName,
        localAheadBy: counts.localAheadBy,
        remoteAheadBy: counts.remoteAheadBy,
        diverged: counts.localAheadBy > 0 && counts.remoteAheadBy > 0,
        review: this.buildFileDiff(remoteFiles, localFiles, {
          type: "conflict",
          from: `origin/${branchName}`,
          to: branchName,
        }),
      };
    });
  }

  async resolveConflictMerge(
    agentId: string,
    payload: {
      message?: string;
      resolutions?: Record<string, "local" | "remote">;
    },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available for conflict merge.");
      }

      const repoPath = this.getRepoPath(agentId);
      const git = simpleGit(repoPath);
      const remote = await this.getEffectiveRemote(agent);
      if (!remote?.repositoryUrl) {
        throw new Error("No remote configured.");
      }

      await mkdir(repoPath, { recursive: true });
      await this.ensureRemote(git, remote);

      const branchName = branch.version.gitBranch ?? branch.version.version;
      await this.checkoutBranch(git, branchName);
      await git.fetch("origin", branchName).catch(() => null);

      const counts = await this.getAheadBehindCounts(git, branchName);
      if (!(counts.localAheadBy > 0 && counts.remoteAheadBy > 0)) {
        throw new Error("Branch is not in a diverged state.");
      }

      const status = await git.status().catch(() => null);
      const hasWorkingChanges = Boolean(
        status &&
          (status.files?.length ||
            status.created?.length ||
            status.deleted?.length ||
            status.modified?.length ||
            status.renamed?.length ||
            status.not_added?.length ||
            status.conflicted?.length),
      );
      if (hasWorkingChanges) {
        throw new Error(
          "Repository has pending working-tree changes. Refresh branch state before resolving conflicts.",
        );
      }

      const codeExtensions = await this.readToolCodeExtensions(repoPath);
      const localSnapshot = await this.buildLiveSnapshot(agentId);
      const localFiles = this.generateRepositoryFiles(localSnapshot, branchName, {
        codeExtensions,
      }).filter((file) => this.isUserMergeableFile(file.path));
      const remoteFiles = (
        await this.readRepoFilesAtRef(git, `origin/${branchName}`)
      ).filter((file) => this.isUserMergeableFile(file.path));

      let mergeStarted = false;
      try {
        await git.raw(["merge", "--no-commit", "--no-ff", `origin/${branchName}`]);
        mergeStarted = true;
      } catch (error: any) {
        const message = String(error?.message ?? "");
        const looksRecoverable =
          /CONFLICT|Automatic merge failed|content conflict|add\/add|modify\/delete|rename\/delete/i.test(
            message,
          );
        if (!looksRecoverable) {
          await git.raw(["merge", "--abort"]).catch(() => null);
          throw error;
        }
        mergeStarted = true;
      }

      try {
        const mergedFiles = this.buildResolvedMergeFiles(
          localFiles,
          remoteFiles,
          payload.resolutions ?? {},
        );
        const tempDir = join(
          "/tmp",
          `tuul-conflict-merge-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        );
        await mkdir(tempDir, { recursive: true });
        await this.writeManagedFiles(tempDir, mergedFiles);

        const mergedSnapshot = await this.readSnapshotFromRepo(tempDir);
        await rm(tempDir, { recursive: true, force: true }).catch(() => null);
        if (!mergedSnapshot) {
          throw new Error("Unable to build merged agent snapshot.");
        }

        await this.writeManagedFiles(repoPath, mergedFiles);
        await git.add(".");
        await git.commit(
          payload.message?.trim() || "Resolve conflict and merge",
          undefined,
          { "--no-edit": null },
        );

        const nativeCommitHash = await git
          .revparse(["HEAD"])
          .then((value) => value.trim())
          .catch(() => null);

        await this.applySnapshot(agent, mergedSnapshot);
        await this.syncRepositoryRepresentations(repoPath, mergedSnapshot, branchName);

        const defaultBranch = this.getDefaultBranchName(agent);
        const previous =
          await this.agentVersionEntryRepository.findLatestForInstance(branch.id);
        const files = this.generateRepositoryFiles(mergedSnapshot, branchName, {
          codeExtensions,
        });
        const commitHash = this.generateCommitHash();
        const entry = await this.agentVersionEntryRepository.save({
          instanceId: branch.id,
          version: branch.version.version,
          releasedAt: new Date(),
          message: payload.message?.trim() || "Resolve conflict and merge",
          commitHash,
          metadata: {
            branch: {
              id: branch.id,
              name: branchName,
              isDefault: branchName === defaultBranch,
            },
            parentCommitHash: previous?.commitHash ?? null,
            snapshot: mergedSnapshot,
            files,
            git: {
              status: "success",
              pushed: false,
              syncedAt: new Date().toISOString(),
              message: payload.message?.trim() || "Resolve conflict and merge",
              remoteUrl: remote.repositoryUrl ?? null,
              branch: branchName,
              nativeCommitHash,
            },
          },
        });

        await this.agentInstanceRepository.save({
          ...branch,
          commitHash,
          projection: InstanceProjection.CURRENT,
        });

        await this.updateRepositoryMetadata(agent, {
          mode: "git",
          localRepoPath: repoPath,
          currentBranchId: branch.id,
          currentBranchName: branchName,
          lastPushStatus: "idle",
          lastPushMessage: "Conflict resolved locally. Push when ready.",
        });

        return {
          merged: true,
          branch: branchName,
          commit: this.serializeCommit(entry, branchName, branchName === defaultBranch),
          nativeCommitHash,
          message: "Conflict resolved and merged locally. Push when ready.",
        };
      } catch (error) {
        if (mergeStarted) {
          await git.raw(["merge", "--abort"]).catch(() => null);
        }
        throw error;
      }
    });
  }

  async fetch(agentId: string) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const branch = await this.resolveBranch(agentId, {
        allowDefaultFallback: true,
      });
      if (!branch) {
        throw new Error("No branch available to fetch.");
      }

      const remote = await this.getEffectiveRemote(agent);
      if (!remote?.repositoryUrl) {
        return {
          fetched: false,
          remoteConfigured: false,
          reason: "No remote configured.",
        };
      }

      const repoPath = this.getRepoPath(agentId);
      await mkdir(repoPath, { recursive: true });
      const git = simpleGit(repoPath);

      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        await git.init().catch(() => null);
      }

      await this.ensureRemote(git, remote);

      const branchName =
        branch.version.gitBranch ??
        branch.version.version ??
        this.getDefaultBranchName(agent);

      try {
        await git.fetch("origin", branchName);
      } catch (error: any) {
        const message = this.readErrorMessage(
          error,
          "Git fetch failed. Check your remote connection and try again.",
        );
        const disconnected = await this.disconnectRemoteOnAuthFailure(
          agentId,
          agent,
          message,
        );
        return {
          fetched: false,
          remoteConfigured: true,
          branch: branchName,
          reason: disconnected
            ? "Git authentication failed. GitHub account was disconnected. Reconnect and retry."
            : message,
          requiresReconnect: disconnected,
        };
      }

      await this.checkoutBranch(git, branchName);

      const counts = await this.getAheadBehindCounts(git, branchName);
      const now = new Date().toISOString();
      await this.updateRepositoryMetadata(agent, {
        lastFetchAt: now,
      });

      return {
        fetched: true,
        remoteConfigured: true,
        branch: branchName,
        localAheadBy: counts.localAheadBy,
        remoteAheadBy: counts.remoteAheadBy,
        hasRemoteChanges: counts.remoteAheadBy > 0,
        hasLocalOnlyCommits: counts.localAheadBy > 0,
        fetchedAt: now,
      };
    });
  }

  async revert(
    agentId: string,
    commitHash: string,
    author?: { userId?: string; userName?: string },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const target = await this.agentVersionEntryRepository.findByCommitHash(
        agentId,
        commitHash,
      );
      if (!target?.metadata?.snapshot) {
        throw new Error("Commit snapshot not found.");
      }

      await this.applySnapshot(
        agent,
        target.metadata.snapshot as SnapshotShape,
      );

      return this.commit(agentId, {
        branchId: target.instanceId ?? undefined,
        message: `Revert to ${commitHash.slice(0, 7)}`,
        authorUserId: author?.userId,
        authorName: author?.userName,
      });
    });
  }

  async diffCommits(
    agentId: string,
    fromCommitHash: string,
    toCommitHash: string,
  ) {
    const fromCommit = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      fromCommitHash,
    );
    const toCommit = await this.agentVersionEntryRepository.findByCommitHash(
      agentId,
      toCommitHash,
    );
    if (!fromCommit || !toCommit) {
      throw new Error("One or both commits were not found.");
    }

    return this.buildFileDiff(
      fromCommit.metadata?.files ?? [],
      toCommit.metadata?.files ?? [],
      {
        type: "commits",
        from: fromCommitHash,
        to: toCommitHash,
      },
    );
  }

  async diffBranches(
    agentId: string,
    fromBranchId: string,
    toBranchId: string,
  ) {
    const fromCommit =
      await this.agentVersionEntryRepository.findLatestForInstance(
        fromBranchId,
      );
    const toCommit =
      await this.agentVersionEntryRepository.findLatestForInstance(toBranchId);

    return this.buildFileDiff(
      fromCommit?.metadata?.files ?? [],
      toCommit?.metadata?.files ?? [],
      {
        type: "branches",
        from: fromBranchId,
        to: toBranchId,
      },
    );
  }

  async getStatus(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const currentBranch = await this.resolveBranch(agentId, {
      allowDefaultFallback: true,
    });
    const snapshot = await this.buildLiveSnapshot(agentId);
    const currentHead = currentBranch
      ? await this.agentVersionEntryRepository.findLatestForInstance(
          currentBranch.id,
        )
      : null;
    const currentFiles = this.generateRepositoryFiles(
      snapshot,
      currentBranch?.version.gitBranch ??
        currentBranch?.version.version ??
        this.getDefaultBranchName(agent),
    );
    const headFiles = currentHead?.metadata?.files ?? [];

    const remote = await this.getEffectiveRemote(agent);
    const remoteConfigured = Boolean(remote?.repositoryUrl);
    const repoPath = this.getRepoPath(agentId);
    let remoteAheadBy: number | null = null;
    let localAheadBy: number | null = null;
    if (remoteConfigured) {
      const git = simpleGit(repoPath);
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (isRepo && currentBranch) {
        const branchName =
          currentBranch.version.gitBranch ??
          currentBranch.version.version ??
          this.getDefaultBranchName(agent);
        const counts = await this.getAheadBehindCounts(git, branchName);
        remoteAheadBy = counts.remoteAheadBy;
        localAheadBy = counts.localAheadBy;
      }
    }

    return {
      branch: currentBranch
        ? this.serializeBranch(
            currentBranch,
            this.getDefaultBranchName(agent),
            currentBranch.id,
          )
        : null,
      hasUncommittedChanges:
        JSON.stringify(this.normalizeFilesForDiff(headFiles)) !==
        JSON.stringify(this.normalizeFilesForDiff(currentFiles)),
      remoteConfigured,
      remoteAheadBy,
      localAheadBy,
      repository: agent.metadata?.repository ?? null,
    };
  }

  async getAgentRemote(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const agentRemote = await this.getPersistedAgentRemote(agent);
    const organizationRemote = agent.organizationId
      ? await this.getOrganizationRemote(agent.organizationId)
      : null;
    const effective = agentRemote ?? ((organizationRemote as RemoteConfig | null) ?? null);
    return {
      mode: agentRemote?.mode ?? "internal",
      agentRemote,
      effectiveRemote: effective,
      organizationRemote,
      defaultBranch: this.getDefaultBranchName(agent),
    };
  }

  async disconnectAgentRemote(
    agentId: string,
    payload?: { reason?: string | null },
  ) {
    const agent = await this.getAgentOrThrow(agentId);
    const existingConnection =
      await this.agentRepositoryConnectionRepository.findByAgentId(agentId);

    if (existingConnection) {
      await this.agentRepositoryConnectionRepository.save({
        ...existingConnection,
        isEnabled: false,
        githubLogin: null,
        githubAvatarUrl: null,
        repositoryUrl: null,
        repoName: null,
        installationType: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        username: null,
        appInstallationId: null,
        appInstallationUrl: null,
        appInstallations: null,
      });
    }

    await this.updateRepositoryMetadata(agent, {
      mode: "internal",
      repositoryUrl: null,
      githubLogin: null,
      githubAvatarUrl: null,
      owner: null,
      repoName: null,
      slug: null,
      installationType: "none",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      username: null,
      installationId: null,
      appInstallationUrl: null,
      appInstallations: null,
      isConnected: false,
      remoteEnabled: false,
      inheritsOrganizationRemote: false,
      remoteSource: "none",
      connectedAt: null,
      initializedAt: null,
      lastPushAt: null,
      lastPullAt: null,
      lastPullRequestUrl: null,
      webUrl: null,
      cloneUrlHttps: null,
      cloneUrlSsh: null,
      branchUrl: null,
      compareUrlTemplate: null,
      lastPushStatus: "failed",
      lastPushMessage:
        payload?.reason?.trim() ||
        "Git connection removed. Reconnect GitHub to continue.",
      health: {
        isValidUrl: false,
        ownerResolved: false,
        repoResolved: false,
        providerSupported: true,
        readyForAutomaticPush: false,
      },
    });

    return {
      disconnected: true,
      reason:
        payload?.reason?.trim() ||
        "Git connection removed. Reconnect GitHub to continue.",
      remote: await this.getAgentRemote(agentId),
    };
  }

  async updateAgentRemote(
    agentId: string,
    payload: Partial<RemoteConfig>,
    options?: { autoPublish?: boolean },
  ) {
    const agent = await this.getAgentOrThrow(agentId);
    const existingConnection =
      await this.agentRepositoryConnectionRepository.findByAgentId(agentId);
    const currentRepository = agent.metadata?.repository ?? null;
    const githubLogin =
      (payload.githubLogin as string | null | undefined)?.trim?.() ||
      existingConnection?.githubLogin ||
      currentRepository?.githubLogin ||
      currentRepository?.username ||
      null;
    const githubAvatarUrl =
      (payload.githubAvatarUrl as string | null | undefined)?.trim?.() ||
      existingConnection?.githubAvatarUrl ||
      currentRepository?.githubAvatarUrl ||
      null;
    const repoName =
      payload.repoName?.trim?.() ||
      existingConnection?.repoName ||
      currentRepository?.repoName ||
      agent.slug;
    const repositoryUrl =
      githubLogin && repoName
        ? `https://github.com/${githubLogin}/${repoName}`
        : (payload.repositoryUrl ?? currentRepository?.repositoryUrl ?? null);
    const normalized = this.gitConnectionService.normalize({
      provider:
        (payload.provider as string | null | undefined) ??
        existingConnection?.provider ??
        currentRepository?.provider ??
        "github",
      repositoryUrl: repositoryUrl ?? "",
      githubLogin,
      githubAvatarUrl,
      repoName,
      defaultBranch:
        payload.defaultBranch ??
        existingConnection?.defaultBranch ??
        currentRepository?.defaultBranch ??
        "main",
      installationType:
        (payload.installationType as string | null | undefined) ??
        existingConnection?.installationType ??
        currentRepository?.installationType ??
        "app",
      accessToken:
        payload.accessToken ??
        existingConnection?.accessToken ??
        currentRepository?.accessToken ??
        null,
      refreshToken:
        payload.refreshToken ??
        existingConnection?.refreshToken ??
        currentRepository?.refreshToken ??
        null,
      tokenExpiresAt:
        payload.tokenExpiresAt ??
        existingConnection?.tokenExpiresAt ??
        currentRepository?.tokenExpiresAt ??
        null,
      username:
        payload.username ??
        existingConnection?.username ??
        currentRepository?.username ??
        null,
      installationId:
        payload.installationId ??
        existingConnection?.appInstallationId ??
        currentRepository?.installationId ??
        null,
      appInstallationUrl:
        payload.appInstallationUrl ??
        existingConnection?.appInstallationUrl ??
        currentRepository?.appInstallationUrl ??
        null,
      appInstallations:
        payload.appInstallations ??
        existingConnection?.appInstallations ??
        currentRepository?.appInstallations ??
        null,
      visibility:
        (payload.visibility as string | null | undefined) ??
        existingConnection?.visibility ??
        currentRepository?.visibility ??
        "private",
      autoCreateRepository:
        payload.autoCreateRepository ??
        existingConnection?.autoCreateRepository ??
        currentRepository?.autoCreateRepository ??
        true,
      commitMode:
        (payload.commitMode as string | null | undefined) ??
        existingConnection?.commitMode ??
        currentRepository?.commitMode ??
        "direct",
      connectedAt:
        existingConnection?.connectedAt ??
        currentRepository?.connectedAt ??
        new Date().toISOString(),
      initializedAt: currentRepository?.initializedAt ?? null,
      lastPushAt: currentRepository?.lastPushAt ?? null,
      lastPushStatus: currentRepository?.lastPushStatus ?? "idle",
      lastPushMessage: currentRepository?.lastPushMessage ?? null,
      lastPullRequestUrl: currentRepository?.lastPullRequestUrl ?? null,
    });

    await this.agentRepositoryConnectionRepository.save({
      id: existingConnection?.id,
      agentId,
      isEnabled: true,
      provider: normalized.provider,
      connectionSource: "agent",
      githubLogin: normalized.githubLogin ?? null,
      githubAvatarUrl: normalized.githubAvatarUrl ?? null,
      repositoryUrl: normalized.repositoryUrl ?? null,
      repoName: normalized.repoName ?? null,
      defaultBranch: normalized.defaultBranch ?? "main",
      installationType: normalized.installationType ?? "app",
      accessToken: normalized.accessToken ?? null,
      refreshToken: normalized.refreshToken ?? null,
      tokenExpiresAt: normalized.tokenExpiresAt ?? null,
      username: normalized.username ?? null,
      appInstallationId: normalized.installationId ?? null,
      appClientId: normalized.appClientId ?? null,
      appInstallationUrl: normalized.appInstallationUrl ?? null,
      appInstallations: normalized.appInstallations ?? null,
      visibility: normalized.visibility ?? "private",
      autoCreateRepository: normalized.autoCreateRepository ?? true,
      commitMode: normalized.commitMode ?? "direct",
      connectedAt: normalized.connectedAt ?? new Date().toISOString(),
    });

    await this.updateRepositoryMetadata(agent, {
      ...normalized,
      mode: normalized.repositoryUrl || normalized.githubLogin ? "git" : "internal",
      localRepoPath: currentRepository?.localRepoPath ?? this.getRepoPath(agentId),
      currentBranchId: currentRepository?.currentBranchId ?? null,
      currentBranchName: currentRepository?.currentBranchName ?? null,
      lastFetchAt: (currentRepository as any)?.lastFetchAt ?? null,
      lastPullAt: currentRepository?.lastPullAt ?? null,
      remoteEnabled: true,
      inheritsOrganizationRemote: false,
      remoteSource: "agent",
    });

    if (options?.autoPublish) {
      await this.push(agentId).catch(() => null);
    }

    return this.getAgentRemote(agentId);
  }

  async getOrganizationRemote(organizationId: string) {
    const organization =
      await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    const connection =
      await this.organizationRepositoryConnectionRepository.findByOrganizationId(
        organizationId,
      );

    if (connection) {
      if (!connection.isEnabled) {
        return null;
      }
      return {
        enabled: connection.isEnabled,
        provider: connection.provider as
          | "github"
          | "gitlab"
          | "gitea"
          | "generic"
          | "bitbucket",
        repositoryUrl: null,
        githubLogin: connection.githubLogin ?? null,
        githubAvatarUrl: connection.githubAvatarUrl ?? null,
        owner: null,
        defaultBranch: connection.defaultBranch ?? "main",
        accessToken: connection.accessToken ?? null,
        username: connection.username ?? null,
        authType:
          (connection.authType as "token" | "github_app" | "none" | null) ??
          "none",
        appInstallationId: connection.appInstallationId ?? null,
        appClientId:
          connection.appClientId ??
          process.env.GIT_APP_CLIENT_ID?.trim() ??
          null,
        connectedAt: connection.connectedAt ?? null,
        remoteSource: "organization",
      };
    }

    const legacy = organization.metadata?.gitRemote ?? null;
    return legacy?.enabled === false
      ? null
      : legacy
      ? {
          ...legacy,
          remoteSource: "organization",
        }
      : null;
  }

  async updateOrganizationRemote(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const organization =
      await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    const existingConnection =
      await this.organizationRepositoryConnectionRepository.findByOrganizationId(
        organizationId,
      );
    await this.organizationRepositoryConnectionRepository.save({
      id: existingConnection?.id,
      organizationId,
      isEnabled:
        typeof payload.enabled === "boolean" ? payload.enabled : true,
      provider: String(payload.provider ?? existingConnection?.provider ?? "github"),
      githubLogin:
        typeof payload.githubLogin === "string"
          ? payload.githubLogin.trim()
          : (existingConnection?.githubLogin ?? null),
      githubAvatarUrl:
        typeof payload.githubAvatarUrl === "string"
          ? payload.githubAvatarUrl.trim()
          : (existingConnection?.githubAvatarUrl ?? null),
      defaultBranch:
        typeof payload.defaultBranch === "string"
          ? payload.defaultBranch.trim()
          : (existingConnection?.defaultBranch ?? "main"),
      accessToken:
        typeof payload.accessToken === "string"
          ? payload.accessToken
          : (existingConnection?.accessToken ?? null),
      username:
        typeof payload.username === "string"
          ? payload.username.trim()
          : (existingConnection?.username ?? null),
      authType:
        typeof payload.authType === "string"
          ? payload.authType.trim()
          : (existingConnection?.authType ?? "none"),
      appInstallationId:
        typeof payload.appInstallationId === "number"
          ? payload.appInstallationId
          : (existingConnection?.appInstallationId ?? null),
      appClientId:
        typeof payload.appClientId === "string"
          ? payload.appClientId.trim()
          : (existingConnection?.appClientId ??
            process.env.GIT_APP_CLIENT_ID?.trim() ??
            null),
      connectedAt:
        existingConnection?.connectedAt ?? new Date().toISOString(),
    });

    // Keep the legacy metadata mirror for soft compatibility during the transition.
    organization.metadata = {
      ...(organization.metadata ?? {}),
      gitRemote: {
        ...(organization.metadata?.gitRemote ?? {}),
        ...payload,
      },
    };
    await this.organizationRepository.save(organization);
    return this.getOrganizationRemote(organizationId);
  }

  async useOrganizationRemote(
    agentId: string,
    payload?: { repoName?: string; defaultBranch?: string; visibility?: string },
  ) {
    const agent = await this.getAgentOrThrow(agentId);
    if (!agent.organizationId) {
      throw new Error("Agent is not associated with an organization.");
    }

    const organizationRemote = await this.getOrganizationRemote(agent.organizationId);
    if (!organizationRemote?.githubLogin) {
      throw new Error("No organization GitHub connection is configured.");
    }

    const repoName = payload?.repoName?.trim() || agent.slug;
    const defaultBranch =
      payload?.defaultBranch?.trim() ||
      organizationRemote.defaultBranch?.trim() ||
      "main";
    const repositoryUrl = `https://github.com/${organizationRemote.githubLogin}/${repoName}`;
    const currentRepository = agent.metadata?.repository ?? null;
    const existingConnection =
      await this.agentRepositoryConnectionRepository.findByAgentId(agentId);
    const normalized = this.gitConnectionService.normalize({
      provider: "github",
      repositoryUrl,
      githubLogin: organizationRemote.githubLogin ?? null,
      githubAvatarUrl: organizationRemote.githubAvatarUrl ?? null,
      repoName,
      defaultBranch,
      installationType:
        organizationRemote.authType === "github_app" ? "app" : "app",
      accessToken: organizationRemote.accessToken ?? null,
      username: organizationRemote.username ?? null,
      installationId: organizationRemote.appInstallationId ?? null,
      visibility:
        (payload?.visibility as string | undefined) ??
        currentRepository?.visibility ??
        "private",
      autoCreateRepository: currentRepository?.autoCreateRepository ?? true,
      commitMode: currentRepository?.commitMode ?? "direct",
      connectedAt: new Date().toISOString(),
      initializedAt: currentRepository?.initializedAt ?? null,
      lastPushAt: currentRepository?.lastPushAt ?? null,
      lastPushStatus: currentRepository?.lastPushStatus ?? "idle",
      lastPushMessage: currentRepository?.lastPushMessage ?? null,
      lastPullRequestUrl: currentRepository?.lastPullRequestUrl ?? null,
    });

    await this.agentRepositoryConnectionRepository.save({
      id: existingConnection?.id,
      agentId,
      isEnabled: true,
      provider: normalized.provider,
      connectionSource: "organization",
      githubLogin: normalized.githubLogin ?? null,
      githubAvatarUrl: normalized.githubAvatarUrl ?? null,
      repositoryUrl: normalized.repositoryUrl ?? null,
      repoName: normalized.repoName ?? null,
      defaultBranch: normalized.defaultBranch ?? "main",
      installationType: normalized.installationType ?? "app",
      accessToken: normalized.accessToken ?? null,
      refreshToken: normalized.refreshToken ?? null,
      tokenExpiresAt: normalized.tokenExpiresAt ?? null,
      username: normalized.username ?? null,
      appInstallationId: normalized.installationId ?? null,
      appClientId:
        organizationRemote.appClientId ??
        process.env.GIT_APP_CLIENT_ID?.trim() ??
        null,
      appInstallationUrl: normalized.appInstallationUrl ?? null,
      appInstallations: normalized.appInstallations ?? null,
      visibility: normalized.visibility ?? "private",
      autoCreateRepository: normalized.autoCreateRepository ?? true,
      commitMode: normalized.commitMode ?? "direct",
      connectedAt: normalized.connectedAt ?? new Date().toISOString(),
    });

    await this.updateRepositoryMetadata(agent, {
      ...normalized,
      mode: "git",
      localRepoPath: currentRepository?.localRepoPath ?? this.getRepoPath(agentId),
      currentBranchId: currentRepository?.currentBranchId ?? null,
      currentBranchName: currentRepository?.currentBranchName ?? null,
      lastFetchAt: (currentRepository as any)?.lastFetchAt ?? null,
      lastPullAt: currentRepository?.lastPullAt ?? null,
      remoteEnabled: true,
      inheritsOrganizationRemote: true,
      remoteSource: "agent",
    });

    await this.push(agentId).catch(() => null);

    return this.getAgentRemote(agentId);
  }

  private async getAgentOrThrow(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }
    return agent;
  }

  private getDefaultBranchName(agent: Agent) {
    return agent.metadata?.repository?.defaultBranch?.trim() || "main";
  }

  private async ensureDefaultBranch(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const defaultBranch = this.getDefaultBranchName(agent);
    const existing =
      (await this.agentInstanceRepository.findByBranchName(
        agentId,
        defaultBranch,
      )) ??
      (await this.agentInstanceRepository.findCurrentByAgent(agentId))[0] ??
      (await this.agentInstanceRepository.findByAgentId(agentId))[0] ??
      null;

    if (existing) {
      if (
        (existing.version.gitBranch ?? existing.version.version) !==
        defaultBranch
      ) {
        return this.agentInstanceRepository.save({
          ...existing,
          version: {
            ...existing.version,
            version: defaultBranch,
            gitBranch: defaultBranch,
          },
          projection: InstanceProjection.CURRENT,
          status: InstanceStatus.ACTIVE,
        });
      }
      if (existing.projection !== InstanceProjection.CURRENT) {
        return this.agentInstanceRepository.save({
          ...existing,
          projection: InstanceProjection.CURRENT,
          status: InstanceStatus.ACTIVE,
        });
      }
      return existing;
    }

    return this.agentInstanceRepository.save({
      agentId,
      version: {
        version: defaultBranch,
        apiUrl: `/agents/${agentId}`,
        guiUrl: `/app/overview`,
        deployedAt: new Date().toISOString(),
        gitBranch: defaultBranch,
      },
      status: InstanceStatus.ACTIVE,
      projection: InstanceProjection.CURRENT,
      reference: InstanceReference.DEPLOYMENT,
      commitHash: null,
    });
  }

  private async resolveBranch(
    agentId: string,
    options: {
      branchId?: string;
      branchName?: string;
      allowDefaultFallback?: boolean;
    },
  ) {
    if (options.branchId) {
      const branch = await this.agentInstanceRepository.findById(
        options.branchId,
      );
      if (branch?.agentId === agentId) {
        return branch;
      }
    }

    if (options.branchName) {
      const branch = await this.agentInstanceRepository.findByBranchName(
        agentId,
        options.branchName,
      );
      if (branch) {
        return branch;
      }
    }

    const agent = await this.getAgentOrThrow(agentId);
    if (agent.metadata?.repository?.currentBranchId) {
      const branch = await this.agentInstanceRepository.findById(
        agent.metadata.repository.currentBranchId,
      );
      if (branch?.agentId === agentId) {
        return branch;
      }
    }

    if (options.allowDefaultFallback) {
      return this.ensureDefaultBranch(agentId);
    }

    return null;
  }

  private serializeBranch(
    branch: AgentInstance,
    defaultBranch: string,
    currentBranchId: string | null,
  ): BranchResponse {
    const branchName =
      branch.version.gitBranch ?? branch.version.version ?? defaultBranch;
    return {
      id: branch.id,
      name: branchName,
      displayName: branchName,
      branch: branchName,
      isCurrent: currentBranchId
        ? currentBranchId === branch.id
        : branch.projection === InstanceProjection.CURRENT,
      isDefault: branchName === defaultBranch,
      commitHash: branch.commitHash ?? null,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  private serializeCommit(
    entry: any,
    branchName: string,
    isDefault: boolean,
  ): CommitResponse {
    const metadataBranchId = entry.metadata?.branch?.id ?? null;
    const resolvedBranchName =
      entry.metadata?.branch?.name?.trim?.() ||
      entry.metadata?.git?.branch?.trim?.() ||
      branchName;
    return {
      id: entry.id,
      hash: entry.commitHash ?? "",
      shortHash: (entry.commitHash ?? "").slice(0, 7),
      message: entry.message?.trim() || "Update agent",
      source: "tuul",
      author: entry.author ?? null,
      timestamp: (entry.releasedAt instanceof Date
        ? entry.releasedAt
        : new Date(entry.releasedAt)
      ).toISOString(),
      branch: {
        id: entry.instanceId ?? metadataBranchId ?? null,
        name: resolvedBranchName,
        isDefault,
      },
      git: {
        status: entry.metadata?.git?.status ?? "pending",
        pushed: Boolean(entry.metadata?.git?.pushed),
        syncedAt: entry.metadata?.git?.syncedAt ?? null,
        message: entry.metadata?.git?.message ?? null,
        remoteUrl: entry.metadata?.git?.remoteUrl ?? null,
        branch: entry.metadata?.git?.branch ?? resolvedBranchName,
        nativeCommitHash: entry.metadata?.git?.nativeCommitHash ?? null,
      },
    };
  }

  private serializeExternalCommit(
    commit: {
      hash: string;
      message: string;
      authorName: string | null;
      timestamp: string;
    },
    branchName: string,
    isDefault: boolean,
    branchId: string | null,
  ): CommitResponse {
    return {
      id: `external-${commit.hash}`,
      hash: commit.hash,
      shortHash: commit.hash.slice(0, 7),
      message: commit.message?.trim() || "External commit",
      source: "external",
      author: commit.authorName ? { userName: commit.authorName } : null,
      timestamp: commit.timestamp,
      branch: {
        id: branchId,
        name: branchName,
        isDefault,
      },
      // External commits should never be treated as "pending push".
      git: {
        status: "success",
        pushed: true,
        syncedAt: null,
        message: "Commit made outside of Tuul.",
        remoteUrl: null,
        branch: branchName,
      } as any,
    };
  }

  private async readGitLogCommits(
    git: ReturnType<typeof simpleGit>,
    ref: string,
    maxCount: number,
  ): Promise<
    Array<{
      hash: string;
      message: string;
      authorName: string | null;
      timestamp: string;
    }>
  > {
    const output = await git
      .raw([
        "log",
        ref,
        `--max-count=${String(maxCount)}`,
        "--date=iso-strict",
        "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1e",
      ])
      .catch(() => "");

    const records = output
      .split("\x1e")
      .map((line) => line.trim())
      .filter(Boolean);
    const commits: Array<{
      hash: string;
      message: string;
      authorName: string | null;
      timestamp: string;
    }> = [];
    for (const record of records) {
      const [hash, authorNameRaw, dateRaw, subjectRaw] = record.split("\x1f");
      const hashTrimmed = (hash ?? "").trim();
      if (!hashTrimmed) continue;
      const date = (dateRaw ?? "").trim();
      commits.push({
        hash: hashTrimmed,
        authorName: (authorNameRaw ?? "").trim() || null,
        timestamp: date
          ? new Date(date).toISOString()
          : new Date().toISOString(),
        message: (subjectRaw ?? "").trim() || "External commit",
      });
    }
    return commits;
  }

  async getWorkingStatus(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const currentBranch = await this.resolveBranch(agentId, {
      allowDefaultFallback: true,
    });
    const defaultBranch = this.getDefaultBranchName(agent);
    const branchName =
      currentBranch?.version.gitBranch ??
      currentBranch?.version.version ??
      defaultBranch;
    const currentHead = currentBranch
      ? await this.agentVersionEntryRepository.findLatestForInstance(currentBranch.id)
      : null;
    const liveSnapshot = await this.buildLiveSnapshot(agentId);
    const liveFiles = this.generateRepositoryFiles(liveSnapshot, branchName);
    const headFiles = currentHead?.metadata?.files ?? [];
    const managedDiff = this.buildFileDiff(headFiles, liveFiles, {
      type: "working-tree",
      branch: branchName,
      base: currentHead?.commitHash ?? "head",
    });
    const repository = await this.getEffectiveRemote(agent);
    const repoPath = this.getRepoPath(agentId);
    await mkdir(repoPath, { recursive: true });
    const git = simpleGit(repoPath);

    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      return {
        isRepo: false,
        branch: branchName,
        tracking: null,
        ahead: 0,
        behind: 0,
        isClean: managedDiff.changes.length === 0,
        remoteConfigured: Boolean(repository?.repositoryUrl),
        repositoryUrl: repository?.repositoryUrl ?? null,
        connectionScope: repository?.inheritsOrganizationRemote
          ? "organization"
          : repository?.isConnected
            ? "agent"
            : "none",
        lastFetchAt: (agent.metadata?.repository as any)?.lastFetchAt ?? null,
        lastPushAt: agent.metadata?.repository?.lastPushAt ?? null,
        lastPushStatus: agent.metadata?.repository?.lastPushStatus ?? "idle",
        headCommitHash: currentHead?.commitHash ?? null,
        headCommitMessage: currentHead?.message ?? null,
        managedDiff: {
          changed: managedDiff.changes.length > 0,
          count: managedDiff.changes.length,
          files: managedDiff.changes.map((change) => ({
            path: change.path,
            status: change.status,
            oldContent: change.oldContent,
            newContent: change.newContent,
          })),
        },
        counts: {
          total: managedDiff.changes.length,
          conflicted: 0,
          staged: 0,
          modified: managedDiff.changes.filter((change) => change.status === "modified").length,
          created: managedDiff.changes.filter((change) => change.status === "added").length,
          deleted: managedDiff.changes.filter((change) => change.status === "removed").length,
          renamed: 0,
          untracked: 0,
        },
        files: [],
      };
    }

    const status = await git.status();
    const files = (status.files ?? []).map((file) => ({
      path: file.path,
      index: file.index,
      workingDir: (file as any).working_dir ?? (file as any).workingDir ?? "",
    }));

    return {
      isRepo: true,
      branch: status.current ?? branchName,
      tracking: status.tracking ?? null,
      ahead: status.ahead ?? 0,
      behind: status.behind ?? 0,
      isClean: Boolean(status.isClean?.()),
      remoteConfigured: Boolean(repository?.repositoryUrl),
      repositoryUrl: repository?.repositoryUrl ?? null,
      connectionScope: repository?.inheritsOrganizationRemote
        ? "organization"
        : repository?.isConnected
          ? "agent"
          : "none",
      lastFetchAt: (agent.metadata?.repository as any)?.lastFetchAt ?? null,
      lastPushAt: agent.metadata?.repository?.lastPushAt ?? null,
      lastPushStatus: agent.metadata?.repository?.lastPushStatus ?? "idle",
      headCommitHash: currentHead?.commitHash ?? null,
      headCommitMessage: currentHead?.message ?? null,
      managedDiff: {
        changed: managedDiff.changes.length > 0,
        count: managedDiff.changes.length,
        files: managedDiff.changes.map((change) => ({
          path: change.path,
          status: change.status,
          oldContent: change.oldContent,
          newContent: change.newContent,
        })),
      },
      counts: {
        total: files.length,
        conflicted: (status.conflicted ?? []).length,
        staged: (status.staged ?? []).length,
        modified: (status.modified ?? []).length,
        created: (status.created ?? []).length,
        deleted: (status.deleted ?? []).length,
        renamed: (status.renamed ?? []).length,
        untracked: (status.not_added ?? []).length,
      },
      conflicted: status.conflicted ?? [],
      created: status.created ?? [],
      deleted: status.deleted ?? [],
      modified: status.modified ?? [],
      renamed: status.renamed ?? [],
      notAdded: status.not_added ?? [],
      staged: status.staged ?? [],
      files,
    };
  }

  private async getExternalCommit(agentId: string, commitHash: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const defaultBranch = this.getDefaultBranchName(agent);
    const repoPath = this.getRepoPath(agentId);
    const git = simpleGit(repoPath);
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      throw new Error(`Commit ${commitHash} not found.`);
    }

    const commit = await this.readGitLogCommits(git, commitHash, 1)
      .then((items) => items[0])
      .catch(() => null);
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found.`);
    }

    return {
      commit: this.serializeExternalCommit(commit, defaultBranch, true, null),
      snapshot: null,
      files: await this.readRepoFilesAtCommit(git, commitHash),
    };
  }

  private async getExternalCommitReview(agentId: string, commitHash: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const defaultBranch = this.getDefaultBranchName(agent);
    const repoPath = this.getRepoPath(agentId);
    const git = simpleGit(repoPath);
    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      throw new Error(`Commit ${commitHash} not found.`);
    }

    const commit = await this.readGitLogCommits(git, commitHash, 1)
      .then((items) => items[0])
      .catch(() => null);
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found.`);
    }

    const parentHash = await git
      .raw(["rev-parse", `${commitHash}^`])
      .then((txt) => txt.trim())
      .catch(() => "");
    const previousCommitHash = parentHash || null;

    const previousFiles = previousCommitHash
      ? await this.readRepoFilesAtCommit(git, previousCommitHash)
      : [];
    const nextFiles = await this.readRepoFilesAtCommit(git, commitHash);

    return {
      commit: this.serializeExternalCommit(commit, defaultBranch, true, null),
      previousCommitHash,
      snapshot: null,
      review: this.buildFileDiff(previousFiles, nextFiles, {
        type: "commit",
        from: previousCommitHash ?? "empty",
        to: commitHash,
      }),
    };
  }

  private async readRepoFilesAtCommit(
    git: ReturnType<typeof simpleGit>,
    commitHash: string,
  ): Promise<SnapshotFile[]> {
    return this.readRepoFilesAtRef(git, commitHash);
  }

  private async readRepoFilesAtRef(
    git: ReturnType<typeof simpleGit>,
    ref: string,
  ): Promise<SnapshotFile[]> {
    const paths = await git
      .raw(["ls-tree", "-r", "--name-only", ref])
      .then((output) =>
        output
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      )
      .catch(() => []);
    const files: SnapshotFile[] = [];
    for (const path of paths) {
      const content = await git
        .raw(["show", `${ref}:${path}`])
        .catch(() => "");
      if (!content) continue;
      files.push({ path, content });
    }
    return files;
  }

  private async repairOrphanedVersionEntries(agentId: string) {
    const orphaned =
      await this.agentVersionEntryRepository.findOrphanedByAgentId(agentId);
    if (orphaned.length === 0) return;

    const branches = await this.agentInstanceRepository.findByAgentId(agentId);
    if (branches.length === 0) return;

    const branchIds = new Set(branches.map((branch) => branch.id));
    const branchByName = new Map<string, string>();
    for (const branch of branches) {
      const name = (
        branch.version.gitBranch ??
        branch.version.version ??
        ""
      ).trim();
      if (name) branchByName.set(name, branch.id);
    }

    await Promise.all(
      orphaned.map(async (entry) => {
        const metadata = (entry.metadata ?? {}) as any;
        const metadataBranchId = (metadata?.branch?.id ?? "").trim();
        const metadataBranchName = String(
          metadata?.branch?.name ??
            metadata?.git?.branch ??
            entry.version ??
            "",
        ).trim();

        let instanceId: string | null = null;
        if (metadataBranchId && branchIds.has(metadataBranchId)) {
          instanceId = metadataBranchId;
        } else if (metadataBranchName && branchByName.has(metadataBranchName)) {
          instanceId = branchByName.get(metadataBranchName) ?? null;
        }

        if (!instanceId) return;
        await this.agentVersionEntryRepository.updateInstanceId(
          entry.id,
          instanceId,
        );
      }),
    );
  }

  private async buildLiveSnapshot(agentId: string): Promise<SnapshotShape> {
    const agent = await this.getAgentOrThrow(agentId);
    const config = await this.agentConfigRepository.findByAgentId(agentId);
    const parameter =
      await this.agentParameterVersionRepository.findLiveByAgentId(agentId);
    const tools =
      await this.agentToolVersionRepository.findLiveByAgentId(agentId);
    const connectors = await this.agentConnectorRepository.listByAgentId(agentId);
    const assets = await this.assetRepository.findByAgentId(agentId);
    const sources = await this.externalResourceRepository.findByAgentId(agentId);
    const datasources = await this.dataSourceRepository.findByAgentId(agentId);
    const mcps = this.serializeMcpConfigs(agent.metadata);

    return {
      schemaVersion: 1,
      agent: {
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        description: agent.description ?? null,
        domainLabel: agent.domainLabel ?? null,
        version: agent.version,
      },
      config: config
        ? {
            provider: config.provider,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            topP: config.topP,
            topK: config.topK,
            isSystemHealthy: config.isSystemHealthy,
            runtimeLimits: config.runtimeLimits ?? null,
            sdkSecurity: config.sdkSecurity ?? null,
          }
        : null,
      parameter: this.serializeParameter(parameter),
      tools: tools.map((tool) => this.serializeTool(tool)),
      connectors: connectors.map((connector) => this.serializeConnector(connector)),
      assets: assets.map((asset) => this.serializeAsset(asset)),
      sources: sources.map((source) => this.serializeSource(source)),
      datasources: datasources.map((datasource) =>
        this.serializeDataSource(datasource),
      ),
      mcps,
    };
  }

  private async applySnapshot(agent: Agent, snapshot: SnapshotShape) {
    await this.agentRepository.save({
      ...agent,
      description: snapshot.agent.description ?? null,
      domainLabel: snapshot.agent.domainLabel ?? null,
      version: snapshot.agent.version || agent.version,
      metadata: {
        ...(agent.metadata ?? {}),
        custom: {
          ...(agent.metadata?.custom ?? {}),
          mcpServers: snapshot.mcps ?? [],
        },
      },
    });

    const existingConfig = await this.agentConfigRepository.findByAgentId(
      agent.id,
    );
    if (snapshot.config) {
      await this.agentConfigRepository.save({
        ...(existingConfig ?? {}),
        agentId: agent.id,
        provider: snapshot.config.provider as any,
        model: snapshot.config.model as any,
        temperature: snapshot.config.temperature,
        maxTokens: snapshot.config.maxTokens,
        topP: snapshot.config.topP,
        topK: snapshot.config.topK,
        isSystemHealthy: snapshot.config.isSystemHealthy,
        runtimeLimits: snapshot.config.runtimeLimits ?? null,
        sdkSecurity: snapshot.config.sdkSecurity ?? null,
        systemApiKey: existingConfig?.systemApiKey ?? null,
      });
    }

    await this.agentParameterVersionRepository.deleteLiveByAgentId(agent.id);
    if (snapshot.parameter) {
      await this.agentParameterVersionRepository.save({
        agentId: agent.id,
        instanceId: null,
        commitHash: null,
        persona: snapshot.parameter.persona ?? [],
        niche: snapshot.parameter.niche ?? null,
        overview: snapshot.parameter.overview ?? null,
        documentation: snapshot.parameter.documentation ?? null,
        corePrompts: snapshot.parameter.corePrompts ?? [],
        responseFormat: snapshot.parameter.responseFormat ?? { type: "auto" },
        voiceProfile: snapshot.parameter.voiceProfile as any,
        capabilityProfile: snapshot.parameter.capabilityProfile as any,
        contextRuleSet: snapshot.parameter.contextRuleSet as any,
      });
    }

    await this.agentToolVersionRepository.deleteLiveByAgentId(agent.id);
    const restoredToolIdByName = new Map<string, string>();
    if (snapshot.tools.length > 0) {
      const restoredTools = await this.agentToolVersionRepository.saveMany(
        snapshot.tools.map((tool) => ({
          agentId: agent.id,
          instanceId: null,
          commitHash: null,
          name: tool.name,
          description: tool.description ?? null,
          schema: tool.schema ?? null,
          code: tool.code ?? null,
          enabled: tool.enabled,
          executionPolicy: tool.executionPolicy ?? null,
          stateManagement: tool.stateManagement ?? null,
          safetyPolicy: tool.safetyPolicy ?? null,
          trigger: tool.trigger ?? null,
        })),
      );
      for (const tool of restoredTools) {
        const normalizedName = String(tool.name ?? "").trim().toLowerCase();
        if (normalizedName) {
          restoredToolIdByName.set(normalizedName, tool.id);
        }
      }
    }

    await this.agentConnectorRepository.deleteByAgentId(agent.id);
    if (snapshot.connectors.length > 0) {
      const connectorPayloads = await Promise.all(
        snapshot.connectors.map(async (connector) => {
          const requestedSource = String(connector.source ?? "manual")
            .trim()
            .toLowerCase();
          let resolvedPlatformConnectorId: string | null = null;

          if (requestedSource === "platform") {
            const platformId = String(connector.platformConnectorId ?? "").trim();
            const platformKey = String(connector.platformConnectorKey ?? "").trim();

            if (platformId) {
              const existingPlatformConnector =
                await this.platformConnectorRepository.findById(platformId);
              resolvedPlatformConnectorId = existingPlatformConnector?.id ?? null;
            }

            if (!resolvedPlatformConnectorId && platformKey) {
              const existingPlatformConnector =
                await this.platformConnectorRepository.findByKey(platformKey);
              resolvedPlatformConnectorId = existingPlatformConnector?.id ?? null;
            }
          }

          const normalizedToolName = String(connector.toolName ?? "")
            .trim()
            .toLowerCase();
          const remappedToolId =
            restoredToolIdByName.get(normalizedToolName) ?? null;
          const resolvedSource =
            requestedSource === "platform" && !resolvedPlatformConnectorId
              ? "manual"
              : requestedSource;

          return {
            agentId: agent.id,
            name: connector.name,
            slug: connector.slug,
            description: connector.description ?? null,
            source: resolvedSource as AgentConnector["source"],
            isLive:
              connector.isLive === undefined
                ? Boolean(connector.enabled)
                : Boolean(connector.isLive),
            isPublic:
              connector.isPublic === undefined
                ? Boolean(connector.isExposed)
                : Boolean(connector.isPublic),
            authConfig:
              (connector.authConfig as AgentConnector["authConfig"]) ?? null,
            operations:
              (connector.operations as AgentConnector["operations"]) ?? null,
            dependencyGraph:
              (connector.dependencyGraph as AgentConnector["dependencyGraph"]) ??
              null,
            envConfig:
              (connector.envConfig as AgentConnector["envConfig"]) ?? null,
            envRefs: (connector.envRefs as AgentConnector["envRefs"]) ?? null,
            logoUrl:
              typeof connector.logoUrl === "string" ? connector.logoUrl : null,

            httpMethod: connector.httpMethod as AgentConnector["httpMethod"],
            toolName: connector.toolName,
            toolId: remappedToolId,
            argumentMode: connector.argumentMode as AgentConnector["argumentMode"],
            argumentMappings: connector.argumentMappings ?? null,
            defaultArgs: connector.defaultArgs ?? null,
            requestSchema: connector.requestSchema ?? null,
            isExposed:
              connector.isExposed === undefined
                ? Boolean(connector.isPublic)
                : Boolean(connector.isExposed),
            enabled:
              connector.enabled === undefined
                ? Boolean(connector.isLive)
                : Boolean(connector.enabled),
            platformConnectorId: resolvedPlatformConnectorId,
          };
        }),
      );

      await this.agentConnectorRepository.saveMany(connectorPayloads);
    }

    await this.assetRepository.deleteByAgentId(agent.id);
    if (snapshot.assets.length > 0) {
      await this.assetRepository.saveMany(
        snapshot.assets.map((asset) => ({
          agentId: agent.id,
          name: asset.name,
          type: asset.type as Asset["type"],
          size: asset.size,
          url: asset.url,
          tags: asset.tags ?? [],
        })),
      );
    }

    await this.externalResourceRepository.deleteByAgentId(agent.id);
    if (snapshot.sources.length > 0) {
      await this.externalResourceRepository.saveMany(
        snapshot.sources.map((source) => ({
          agentId: agent.id,
          name: source.name,
          url: source.url,
          description: source.description,
          category: source.category as ExternalResource["category"],
        })),
      );
    }

    await this.dataSourceRepository.deleteByAgentId(agent.id);
    if (snapshot.datasources.length > 0) {
      await this.dataSourceRepository.saveMany(
        snapshot.datasources.map((datasource) => ({
          agentId: agent.id,
          name: datasource.name,
          type: datasource.type as DataSourceConnection["type"],
          config: datasource.config ?? null,
        })),
      );
    }
  }

  private serializeParameter(parameter: AgentParameter | null) {
    if (!parameter) return null;
    return {
      persona: parameter.persona ?? [],
      niche: parameter.niche ?? null,
      overview: parameter.overview ?? null,
      documentation: parameter.documentation ?? null,
      corePrompts: parameter.corePrompts ?? [],
      responseFormat: parameter.responseFormat ?? null,
      voiceProfile: parameter.voiceProfile
        ? {
            formality: (parameter.voiceProfile as any).formality,
            humor: (parameter.voiceProfile as any).humor,
            verbosity: (parameter.voiceProfile as any).verbosity,
            empathy: (parameter.voiceProfile as any).empathy,
            toneProfile: (parameter.voiceProfile as any).toneProfile ?? null,
          }
        : null,
      capabilityProfile: parameter.capabilityProfile
        ? {
            reasoningEnabled:
              (parameter.capabilityProfile as any).reasoningEnabled ?? null,
            toolUseEnabled:
              (parameter.capabilityProfile as any).toolUseEnabled ?? null,
            functionCallingEnabled:
              (parameter.capabilityProfile as any).functionCallingEnabled ??
              null,
            memoryEnabled:
              (parameter.capabilityProfile as any).memoryEnabled ?? null,
            toolPolicies: (
              (parameter.capabilityProfile as any).toolPolicies ?? []
            ).map((policy: any) => ({
              platformToolId: policy.platformToolId ?? null,
              enabled: policy.enabled ?? null,
            })),
          }
        : null,
      contextRuleSet: parameter.contextRuleSet
        ? JSON.parse(JSON.stringify(parameter.contextRuleSet))
        : null,
    };
  }

  private serializeTool(tool: AgentTool) {
    return {
      name: tool.name,
      description: tool.description ?? null,
      schema: tool.schema ?? null,
      code: tool.code ?? null,
      enabled: tool.enabled,
      executionPolicy: tool.executionPolicy ?? null,
      stateManagement: tool.stateManagement ?? null,
      safetyPolicy: tool.safetyPolicy ?? null,
      trigger: tool.trigger ?? null,
    };
  }

  private serializeConnector(connector: AgentConnector) {
    return {
      name: connector.name,
      slug: connector.slug,
      description: connector.description ?? null,
      source: connector.source,
      isLive: Boolean(connector.isLive ?? connector.enabled),
      isPublic: Boolean(connector.isPublic ?? connector.isExposed),
      authConfig: connector.authConfig ?? null,
      operations: connector.operations ?? [],
      dependencyGraph: connector.dependencyGraph ?? null,
      envConfig: connector.envConfig ?? null,
      envRefs: connector.envRefs ?? [],
      logoUrl: connector.logoUrl ?? null,

      httpMethod: connector.httpMethod,
      toolName: connector.toolName,
      toolId: connector.toolId ?? null,
      argumentMode: connector.argumentMode,
      argumentMappings: connector.argumentMappings ?? null,
      defaultArgs: connector.defaultArgs ?? null,
      requestSchema: connector.requestSchema ?? null,
      isExposed: connector.isExposed,
      enabled: connector.enabled,
      platformConnectorId: connector.platformConnectorId ?? null,
      platformConnectorKey: connector.platformConnector?.key ?? null,
    };
  }

  private serializeAsset(asset: Asset) {
    return {
      name: asset.name,
      type: asset.type,
      size: Number(asset.size ?? 0),
      url: asset.url,
      tags: asset.tags ?? [],
    };
  }

  private serializeSource(source: ExternalResource) {
    return {
      name: source.name,
      url: source.url,
      description: source.description,
      category: source.category,
    };
  }

  private serializeDataSource(dataSource: DataSourceConnection) {
    return {
      name: dataSource.name,
      type: dataSource.type,
      config: dataSource.config ?? null,
    };
  }

  private serializeMcpConfigs(metadata: AgentMetadata | null | undefined) {
    const value = metadata?.custom?.mcpServers;
    type McpSnapshot = SnapshotShape["mcps"][number];

    return Array.isArray(value)
      ? value
          .map<McpSnapshot | null>((entry) =>
            entry && typeof entry === "object"
              ? {
                  slug:
                    typeof (entry as any).slug === "string"
                      ? (entry as any).slug
                      : "",
                  config:
                    (entry as any).config &&
                    typeof (entry as any).config === "object"
                      ? (entry as any).config
                      : null,
                }
              : null,
          )
          .filter((entry): entry is McpSnapshot => !!entry?.slug)
      : [];
  }

  private generateRepositoryFiles(
    snapshot: SnapshotShape,
    branchName: string,
    options?: {
      codeExtensions?: Map<string, "ts" | "js">;
    },
  ): SnapshotFile[] {
    const repoSnapshot = this.serializeRepoSnapshot(snapshot);
    const agentJson = JSON.stringify(repoSnapshot, null, 2) + "\n";
    const exampleAgentJson =
      JSON.stringify(
        {
          ...repoSnapshot,
          notes:
            "This is a generated local development example file. Edit agent.json for live branch state.",
        },
        null,
        2,
      ) + "\n";
    const agentXml = this.buildAgentXml(snapshot, branchName);
    const namespaceFile = this.buildNamespaceFile(snapshot, branchName);
    const managedFiles: SnapshotFile[] = [
      {
        path: "agent.json",
        content: agentJson,
      },
      {
        path: "example.agent.json",
        content: exampleAgentJson,
      },
      {
        path: "agent.xml",
        content: agentXml,
      },
      {
        path: "namespace.agent",
        content: namespaceFile,
      },
      {
        path: ".gitignore",
        content:
          [
            ".DS_Store",
            "node_modules/",
            "dist/",
            "build/",
            ".env",
            "*.log",
            ".tuul-manifest.json",
            "agent.xml",
          ].join("\n") + "\n",
      },
      {
        path: "README.md",
        content: `# ${snapshot.agent.name}\n\nManaged by Tuul VCS.\n\nCurrent branch: ${branchName}\n`,
      },
      {
        path: ".tuul-manifest.json",
        content: "",
      },
      {
        path: "tools/.gitkeep",
        content: "",
      },
      {
        path: "connectors/.gitkeep",
        content: "",
      },
      {
        path: "sources/.gitkeep",
        content: "",
      },
      {
        path: "assets/.gitkeep",
        content: "",
      },
      {
        path: "datasources/.gitkeep",
        content: "",
      },
      {
        path: "mcps/.gitkeep",
        content: "",
      },
    ];

    for (const tool of snapshot.tools) {
      const safeName = this.slugify(tool.name);
      managedFiles.push({
        path: `tools/${safeName}.json`,
        content:
          JSON.stringify(
            {
              name: tool.name,
              description: tool.description ?? null,
              enabled: tool.enabled,
              schema: tool.schema ?? null,
            },
            null,
            2,
          ) + "\n",
      });
      if (tool.code) {
        const extension = options?.codeExtensions?.get(safeName) ?? "ts";
        managedFiles.push({
          path: `tools/${safeName}.${extension}`,
          content: `${tool.code.trim()}\n`,
        });
      }
    }

    if (snapshot.tools.length > 0) {
      this.removeGitkeep(managedFiles, "tools/.gitkeep");
    }

    for (const connector of snapshot.connectors) {
      const safeName = this.slugify(connector.slug || connector.name || "connector");
      managedFiles.push({
        path: `connectors/${safeName}.json`,
        content: JSON.stringify(connector, null, 2) + "\n",
      });
    }

    if (snapshot.connectors.length > 0) {
      this.removeGitkeep(managedFiles, "connectors/.gitkeep");
    }

    for (const source of snapshot.sources) {
      const safeName = this.slugify(source.name);
      managedFiles.push({
        path: `sources/${safeName}.json`,
        content: JSON.stringify(source, null, 2) + "\n",
      });
    }

    if (snapshot.sources.length > 0) {
      this.removeGitkeep(managedFiles, "sources/.gitkeep");
    }

    for (const asset of snapshot.assets) {
      const safeName = this.slugify(asset.name);
      managedFiles.push({
        path: `assets/${safeName}.json`,
        content: JSON.stringify(asset, null, 2) + "\n",
      });
    }

    if (snapshot.assets.length > 0) {
      this.removeGitkeep(managedFiles, "assets/.gitkeep");
    }

    for (const datasource of snapshot.datasources) {
      const safeName = this.slugify(datasource.name);
      managedFiles.push({
        path: `datasources/${safeName}.json`,
        content: JSON.stringify(datasource, null, 2) + "\n",
      });
    }

    if (snapshot.datasources.length > 0) {
      this.removeGitkeep(managedFiles, "datasources/.gitkeep");
    }

    for (const mcp of snapshot.mcps) {
      const safeName = this.slugify(mcp.slug);
      managedFiles.push({
        path: `mcps/${safeName}.json`,
        content: JSON.stringify(mcp, null, 2) + "\n",
      });
    }

    if (snapshot.mcps.length > 0) {
      this.removeGitkeep(managedFiles, "mcps/.gitkeep");
    }

    const manifest = {
      managedFiles: managedFiles.map((file) => file.path),
      generatedAt: new Date().toISOString(),
    };
    managedFiles[
      managedFiles.findIndex((file) => file.path === ".tuul-manifest.json")
    ] = {
      path: ".tuul-manifest.json",
      content: JSON.stringify(manifest, null, 2) + "\n",
    };

    return managedFiles;
  }

  private serializeRepoSnapshot(snapshot: SnapshotShape) {
    const {
      tools: _tools,
      connectors: _connectors,
      assets: _assets,
      sources: _sources,
      datasources: _datasources,
      mcps: _mcps,
      ...rest
    } = snapshot;
    return rest;
  }

  private removeGitkeep(files: SnapshotFile[], path: string) {
    const index = files.findIndex((file) => file.path === path);
    if (index >= 0) {
      files.splice(index, 1);
    }
  }

  private buildAgentXml(snapshot: SnapshotShape, branchName: string) {
    const escape = (value: string | null | undefined) =>
      (value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");

    const toolXml = snapshot.tools
      .map(
        (tool) =>
          `    <tool name="${escape(tool.name)}" enabled="${tool.enabled ? "true" : "false"}">\n      <description>${escape(tool.description)}</description>\n    </tool>`,
      )
      .join("\n");

    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<agent branch="${escape(branchName)}">`,
      `  <name>${escape(snapshot.agent.name)}</name>`,
      `  <slug>${escape(snapshot.agent.slug)}</slug>`,
      `  <version>${escape(snapshot.agent.version)}</version>`,
      `  <description>${escape(snapshot.agent.description)}</description>`,
      `  <overview>${escape(snapshot.parameter?.overview ?? "")}</overview>`,
      `  <tools>`,
      toolXml || "    <!-- no tools -->",
      `  </tools>`,
      `</agent>`,
      "",
    ].join("\n");
  }

  private buildNamespaceFile(snapshot: SnapshotShape, branchName: string) {
    return [
      `namespace ${snapshot.agent.slug}`,
      `agent "${snapshot.agent.name}"`,
      `branch "${branchName}"`,
      `version "${snapshot.agent.version}"`,
      "",
    ].join("\n");
  }

  private async ensureBranchBootstrapCommit(
    agent: Agent,
    branch: AgentInstance,
    message: string,
  ) {
    const defaultBranch = this.getDefaultBranchName(agent);
    const branchName =
      branch.version.gitBranch ?? branch.version.version ?? defaultBranch;
    const snapshot = await this.buildLiveSnapshot(agent.id);
    const files = this.generateRepositoryFiles(snapshot, branchName);
    const commitHash = this.generateCommitHash();

    const entry = await this.agentVersionEntryRepository.save({
      instanceId: branch.id,
      version: branch.version.version,
      releasedAt: new Date(),
      message,
      commitHash,
      metadata: {
        branch: {
          id: branch.id,
          name: branchName,
          isDefault: branchName === defaultBranch,
        },
        parentCommitHash: null,
        snapshot,
        files,
        git: {
          status: "pending",
          pushed: false,
          syncedAt: null,
          message: null,
          remoteUrl: null,
          branch: branchName,
        },
      },
    });

    await this.agentInstanceRepository.save({
      ...branch,
      commitHash,
    });

    return entry;
  }

  private async syncCommitToGit(
    agent: Agent,
    branch: AgentInstance,
    entry: any,
    options?: { initializeRepository?: boolean; pushOnly?: boolean },
  ) {
    const repository = await this.getEffectiveRemote(agent);
    const repoPath = this.getRepoPath(agent.id);
    await mkdir(repoPath, { recursive: true });
    const git = simpleGit(repoPath);
    const branchName =
      branch.version.gitBranch ??
      branch.version.version ??
      this.getDefaultBranchName(agent);

    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      await git.init().catch(() => null);
    }

    await this.ensureRemote(git, repository);
    await this.checkoutBranch(git, branchName);

    if (!options?.pushOnly) {
      const files =
        entry.metadata?.files ??
        this.generateRepositoryFiles(
          (entry.metadata?.snapshot as SnapshotShape | null) ??
            (await this.buildLiveSnapshot(agent.id)),
          branchName,
        );
      await this.writeManagedFiles(repoPath, files);
      await git.add(".");
      await git
        .commit(entry.message?.trim() || "Update agent", undefined, {
          "--allow-empty": null,
        })
        .catch(() => null);
    }

    const nativeCommitHash = await git
      .revparse(["HEAD"])
      .then((value) => value.trim())
      .catch(() => null);

    let pushed = false;
    let pushMessage = entry.message?.trim() || "Update agent";

    // Agent bootstrap / local init must never publish remotely.
    // We only want the `.tuul-vcs` repo + local commit materialized here.
    const allowRemotePush = !options?.initializeRepository;

    if (allowRemotePush && repository?.repositoryUrl) {
      if (repository.autoCreateRepository) {
        await this.ensureRemoteRepository(repository);
      }
      try {
        await git.push("origin", branchName, { "-u": null });
        pushed = true;
      } catch (error: any) {
        pushed = false;
        pushMessage =
          error?.message?.trim?.() ||
          `Failed to push branch ${branchName} to remote repository.`;
      }
    }

    await this.updateRepositoryMetadata(agent, {
      mode: "git",
      localRepoPath: repoPath,
      currentBranchId: branch.id,
      currentBranchName: branchName,
      initializedAt:
        agent.metadata?.repository?.initializedAt ??
        (options?.initializeRepository ? new Date().toISOString() : null),
      lastPushAt: pushed
        ? new Date().toISOString()
        : (agent.metadata?.repository?.lastPushAt ?? null),
      lastPushStatus: allowRemotePush && repository?.repositoryUrl
        ? pushed
          ? "success"
          : "failed"
        : "idle",
      lastPushMessage: allowRemotePush ? pushMessage : null,
    });

    await this.agentVersionEntryRepository.updateMetadata(entry.id, {
      ...(entry.metadata ?? {}),
      git: {
        ...(entry.metadata?.git ?? {}),
        nativeCommitHash,
      },
    });

    return {
      success: !allowRemotePush || !repository?.repositoryUrl || pushed,
      pushed,
      branch: branchName,
      message: allowRemotePush ? pushMessage : "Local repository initialized.",
      remoteUrl: allowRemotePush ? repository?.repositoryUrl ?? null : null,
      nativeCommitHash,
    };
  }

  private async writeManagedFiles(repoPath: string, files: SnapshotFile[]) {
    const manifestPath = join(repoPath, ".tuul-manifest.json");
    let previousManifest: { managedFiles?: string[] } | null = null;
    try {
      previousManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch {
      previousManifest = null;
    }

    for (const stalePath of previousManifest?.managedFiles ?? []) {
      if (!files.find((file) => file.path === stalePath)) {
        await rm(join(repoPath, stalePath), { force: true }).catch(() => null);
      }
    }

    for (const file of files) {
      const absolutePath = join(repoPath, file.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.content, "utf8");
    }
  }

  private async readSnapshotFromRepo(
    repoPath: string,
  ): Promise<SnapshotShape | null> {
    try {
      const raw = await readFile(join(repoPath, "agent.json"), "utf8");
      const snapshot = JSON.parse(raw) as Partial<SnapshotShape>;
      const repoTools = await this.readToolsFromRepo(repoPath);
      const repoConnectors = await this.readJsonCollectionFromRepo(
        repoPath,
        "connectors",
      );
      const repoSources = await this.readJsonCollectionFromRepo(repoPath, "sources");
      const repoAssets = await this.readJsonCollectionFromRepo(repoPath, "assets");
      const repoDatasources = await this.readJsonCollectionFromRepo(
        repoPath,
        "datasources",
      );
      const repoMcps = await this.readJsonCollectionFromRepo(repoPath, "mcps");
      const changedPaths = await this.readHeadChangedPaths(repoPath);

      return this.normalizeSnapshotShape({
        schemaVersion: 1,
        agent: snapshot.agent as SnapshotShape["agent"],
        config: (snapshot.config ?? null) as SnapshotShape["config"],
        parameter: (snapshot.parameter ?? null) as SnapshotShape["parameter"],
        tools:
          repoTools.length > 0
            ? repoTools
            : this.mergeSnapshotTools(
                snapshot.tools ?? [],
                repoTools,
                changedPaths,
              ),
        connectors: repoConnectors as SnapshotShape["connectors"],
        sources: repoSources as SnapshotShape["sources"],
        assets: repoAssets as SnapshotShape["assets"],
        datasources: repoDatasources as SnapshotShape["datasources"],
        mcps: repoMcps as SnapshotShape["mcps"],
      });
    } catch {
      return null;
    }
  }

  private async readHeadChangedPaths(repoPath: string): Promise<Set<string>> {
    const git = simpleGit(repoPath);
    const output = await git
      .raw(["show", "--pretty=", "--name-only", "HEAD"])
      .catch(() => "");

    return new Set(
      output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  private async readToolsFromRepo(repoPath: string): Promise<SnapshotShape["tools"]> {
    const toolsDir = join(repoPath, "tools");
    const entries = await readdir(toolsDir, { withFileTypes: true }).catch(() => []);
    if (!entries.length) {
      return [];
    }

    const jsonEntries = entries.filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"),
    );

    const tools: SnapshotShape["tools"] = [];

    for (const entry of jsonEntries) {
      const manifestPath = join(toolsDir, entry.name);
      const slug = entry.name.replace(/\.json$/i, "");

      try {
        const manifestRaw = await readFile(manifestPath, "utf8");
        const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
        const tsPath = join(toolsDir, `${slug}.ts`);
        const jsPath = join(toolsDir, `${slug}.js`);

        let code: string | null = null;
        const tsCode = await readFile(tsPath, "utf8").catch(() => null);
        const jsCode = await readFile(jsPath, "utf8").catch(() => null);
        code = tsCode ?? jsCode ?? null;

        tools.push({
          name:
            (typeof manifest.name === "string" && manifest.name.trim()) || slug,
          description:
            typeof manifest.description === "string"
              ? manifest.description
              : null,
          schema:
            manifest.schema && typeof manifest.schema === "object"
              ? manifest.schema
              : null,
          code,
          enabled:
            typeof manifest.enabled === "boolean" ? manifest.enabled : true,
          executionPolicy:
            manifest.executionPolicy && typeof manifest.executionPolicy === "object"
              ? manifest.executionPolicy
              : null,
          stateManagement:
            manifest.stateManagement && typeof manifest.stateManagement === "object"
              ? manifest.stateManagement
              : null,
          safetyPolicy:
            manifest.safetyPolicy && typeof manifest.safetyPolicy === "object"
              ? manifest.safetyPolicy
              : null,
          trigger:
            manifest.trigger && typeof manifest.trigger === "object"
              ? manifest.trigger
              : null,
        });
      } catch {
        continue;
      }
    }

    return tools;
  }

  private async readJsonCollectionFromRepo(
    repoPath: string,
    directory: string,
  ): Promise<Record<string, unknown>[]> {
    const targetDir = join(repoPath, directory);
    const entries = await readdir(targetDir, { withFileTypes: true }).catch(() => []);
    if (!entries.length) {
      return [];
    }

    const jsonEntries = entries.filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".json") &&
        entry.name !== ".gitkeep",
    );

    const values: Record<string, unknown>[] = [];
    for (const entry of jsonEntries) {
      try {
        const raw = await readFile(join(targetDir, entry.name), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          values.push(parsed as Record<string, unknown>);
        }
      } catch {
        continue;
      }
    }

    return values;
  }

  private async readToolCodeExtensions(
    repoPath: string,
  ): Promise<Map<string, "ts" | "js">> {
    const toolsDir = join(repoPath, "tools");
    const entries = await readdir(toolsDir, { withFileTypes: true }).catch(() => []);
    const extensions = new Map<string, "ts" | "js">();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(/^(.*)\.(ts|js)$/i);
      if (!match) continue;
      const [, slug, extension] = match;
      if (!extensions.has(slug)) {
        extensions.set(slug, extension.toLowerCase() as "ts" | "js");
      }
    }

    return extensions;
  }

  private async syncRepositoryRepresentations(
    repoPath: string,
    snapshot: SnapshotShape,
    branchName: string,
  ) {
    if (!existsSync(repoPath)) {
      return;
    }

    const codeExtensions = await this.readToolCodeExtensions(repoPath);
    const files = this.generateRepositoryFiles(snapshot, branchName, {
      codeExtensions,
    });
    await this.writeManagedFiles(repoPath, files);
  }

  private mergeSnapshotTools(
    agentJsonTools: SnapshotShape["tools"],
    repoTools: SnapshotShape["tools"],
    changedPaths: Set<string>,
  ): SnapshotShape["tools"] {
    const byKey = new Map<
      string,
      {
        agent?: SnapshotShape["tools"][number];
        repo?: SnapshotShape["tools"][number];
      }
    >();

    for (const tool of agentJsonTools ?? []) {
      const key = this.slugify(tool.name);
      const existing = byKey.get(key) ?? {};
      existing.agent = tool;
      byKey.set(key, existing);
    }

    for (const tool of repoTools ?? []) {
      const key = this.slugify(tool.name);
      const existing = byKey.get(key) ?? {};
      existing.repo = tool;
      byKey.set(key, existing);
    }

    const merged: SnapshotShape["tools"] = [];

    for (const [key, sources] of byKey.entries()) {
      const agentTool = sources.agent;
      const repoTool = sources.repo;
      if (!agentTool && !repoTool) continue;

      const manifestChanged = changedPaths.has(`tools/${key}.json`);
      const codeChanged =
        changedPaths.has(`tools/${key}.ts`) || changedPaths.has(`tools/${key}.js`);
      const agentJsonChanged = changedPaths.has("agent.json");
      const preferRepoCode = codeChanged && !agentJsonChanged;
      const preferAgentCode = agentJsonChanged && !codeChanged;

      const preferRepoMetadata =
        (manifestChanged || codeChanged) && !agentJsonChanged;
      const preferAgentMetadata =
        agentJsonChanged && !(manifestChanged || codeChanged);

      const base = preferRepoMetadata
        ? repoTool ?? agentTool!
        : agentTool ?? repoTool!;
      const secondary = base === agentTool ? repoTool : agentTool;

      merged.push({
        name: base?.name ?? secondary?.name ?? key,
        description: preferRepoMetadata
          ? repoTool?.description ?? agentTool?.description ?? null
          : preferAgentMetadata
            ? agentTool?.description ?? repoTool?.description ?? null
            : agentTool?.description ?? repoTool?.description ?? null,
        schema: preferRepoMetadata
          ? repoTool?.schema ?? agentTool?.schema ?? null
          : preferAgentMetadata
            ? agentTool?.schema ?? repoTool?.schema ?? null
            : agentTool?.schema ?? repoTool?.schema ?? null,
        code: preferRepoCode
          ? repoTool?.code ?? agentTool?.code ?? null
          : preferAgentCode
            ? agentTool?.code ?? repoTool?.code ?? null
            : repoTool?.code ?? agentTool?.code ?? null,
        enabled:
          (preferRepoMetadata
            ? repoTool?.enabled
            : preferAgentMetadata
              ? agentTool?.enabled
              : agentTool?.enabled ?? repoTool?.enabled) ?? true,
        executionPolicy: preferRepoMetadata
          ? repoTool?.executionPolicy ?? agentTool?.executionPolicy ?? null
          : preferAgentMetadata
            ? agentTool?.executionPolicy ?? repoTool?.executionPolicy ?? null
            : agentTool?.executionPolicy ?? repoTool?.executionPolicy ?? null,
        stateManagement: preferRepoMetadata
          ? repoTool?.stateManagement ?? agentTool?.stateManagement ?? null
          : preferAgentMetadata
            ? agentTool?.stateManagement ?? repoTool?.stateManagement ?? null
            : agentTool?.stateManagement ?? repoTool?.stateManagement ?? null,
        safetyPolicy: preferRepoMetadata
          ? repoTool?.safetyPolicy ?? agentTool?.safetyPolicy ?? null
          : preferAgentMetadata
            ? agentTool?.safetyPolicy ?? repoTool?.safetyPolicy ?? null
            : agentTool?.safetyPolicy ?? repoTool?.safetyPolicy ?? null,
        trigger: preferRepoMetadata
          ? repoTool?.trigger ?? agentTool?.trigger ?? null
          : preferAgentMetadata
            ? agentTool?.trigger ?? repoTool?.trigger ?? null
            : agentTool?.trigger ?? repoTool?.trigger ?? null,
      });
    }

    return merged;
  }

  private async getBranchHeadSnapshot(agentId: string, branchId: string) {
    const head =
      await this.agentVersionEntryRepository.findLatestForInstance(branchId);
    if (head?.metadata?.snapshot) {
      return this.normalizeSnapshotShape(head.metadata.snapshot);
    }
    const branch = await this.agentInstanceRepository.findById(branchId);
    if (branch?.commitHash) {
      const commit = await this.agentVersionEntryRepository.findByCommitHash(
        agentId,
        branch.commitHash,
      );
      if (commit?.metadata?.snapshot) {
        return this.normalizeSnapshotShape(commit.metadata.snapshot);
      }
    }
    return null;
  }

  private normalizeSnapshotShape(
    snapshot: Partial<SnapshotShape> | null | undefined,
  ): SnapshotShape {
    return {
      schemaVersion: 1,
      agent: snapshot?.agent as SnapshotShape["agent"],
      config: (snapshot?.config ?? null) as SnapshotShape["config"],
      parameter: (snapshot?.parameter ?? null) as SnapshotShape["parameter"],
      tools: snapshot?.tools ?? [],
      connectors: snapshot?.connectors ?? [],
      assets: snapshot?.assets ?? [],
      sources: snapshot?.sources ?? [],
      datasources: snapshot?.datasources ?? [],
      mcps: snapshot?.mcps ?? [],
    };
  }

  private buildFileDiff(
    fromFiles: Array<{ path: string; content: string }>,
    toFiles: Array<{ path: string; content: string }>,
    meta: Record<string, string>,
  ) {
    const fromMap = this.normalizeFilesForDiff(fromFiles);
    const toMap = this.normalizeFilesForDiff(toFiles);
    const changes = Array.from(
      new Set([...Object.keys(fromMap), ...Object.keys(toMap)]),
    )
      .filter((path) => (fromMap[path] ?? "") !== (toMap[path] ?? ""))
      .map((path) => ({
        path,
        status:
          fromMap[path] === undefined
            ? "added"
            : toMap[path] === undefined
              ? "removed"
              : "modified",
        oldContent: fromMap[path] ?? "",
        newContent: toMap[path] ?? "",
      }));

    return {
      meta,
      changes,
      from: fromFiles,
      to: toFiles,
    };
  }

  private buildResolvedMergeFiles(
    localFiles: SnapshotFile[],
    remoteFiles: SnapshotFile[],
    resolutions: Record<string, "local" | "remote">,
  ): SnapshotFile[] {
    const localMap = this.normalizeFilesForDiff(localFiles);
    const remoteMap = this.normalizeFilesForDiff(remoteFiles);
    const mergedPaths = Array.from(
      new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]),
    )
      .filter((path) => this.isUserMergeableFile(path))
      .sort((a, b) => a.localeCompare(b));

    return mergedPaths
      .map((path) => {
        const preferredSide = resolutions[path] ?? "local";
        const content =
          preferredSide === "remote" ? remoteMap[path] : localMap[path];
        if (content === undefined) {
          return null;
        }
        return { path, content };
      })
      .filter(Boolean) as SnapshotFile[];
  }

  private normalizeFilesForDiff(
    files: Array<{ path: string; content: string }>,
  ) {
    return files.reduce<Record<string, string>>((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {});
  }

  private isUserMergeableFile(path: string) {
    if (!path) return false;
    if (path === ".tuul-manifest.json") return false;
    if (path.endsWith("/.gitkeep")) return false;
    return true;
  }

  private async getEffectiveRemote(agent: Agent): Promise<RemoteConfig | null> {
    const persisted = await this.getPersistedAgentRemote(agent);
    if (persisted) {
      return persisted;
    }

    return (agent.metadata?.repository as RemoteConfig | null) ?? null;
  }

  private async getPersistedAgentRemote(agent: Agent): Promise<RemoteConfig | null> {
    const connection =
      await this.agentRepositoryConnectionRepository.findByAgentId(agent.id);
    if (!connection?.isEnabled) {
      return null;
    }

    const currentRepository = agent.metadata?.repository ?? null;
    const normalized = this.gitConnectionService.normalize({
      provider: connection.provider,
      repositoryUrl:
        connection.repositoryUrl ??
        (connection.githubLogin && connection.repoName
          ? `https://github.com/${connection.githubLogin}/${connection.repoName}`
          : ""),
      githubLogin: connection.githubLogin ?? null,
      githubAvatarUrl: connection.githubAvatarUrl ?? null,
      repoName: connection.repoName ?? agent.slug,
      defaultBranch: connection.defaultBranch ?? "main",
      installationType: connection.installationType ?? "app",
      accessToken: connection.accessToken ?? null,
      refreshToken: connection.refreshToken ?? null,
      tokenExpiresAt: connection.tokenExpiresAt ?? null,
      username: connection.username ?? null,
      installationId: connection.appInstallationId ?? null,
      appInstallationUrl: connection.appInstallationUrl ?? null,
      appInstallations: connection.appInstallations ?? null,
      visibility: connection.visibility ?? "private",
      autoCreateRepository: connection.autoCreateRepository,
      commitMode: connection.commitMode ?? "direct",
      connectedAt: connection.connectedAt ?? currentRepository?.connectedAt ?? null,
      initializedAt: currentRepository?.initializedAt ?? null,
      lastPushAt: currentRepository?.lastPushAt ?? null,
      lastPushStatus: currentRepository?.lastPushStatus ?? "idle",
      lastPushMessage: currentRepository?.lastPushMessage ?? null,
      lastPullRequestUrl: currentRepository?.lastPullRequestUrl ?? null,
    });

    return {
      ...normalized,
      mode: "git",
      localRepoPath: currentRepository?.localRepoPath ?? this.getRepoPath(agent.id),
      currentBranchId: currentRepository?.currentBranchId ?? null,
      currentBranchName: currentRepository?.currentBranchName ?? null,
      lastFetchAt: (currentRepository as any)?.lastFetchAt ?? null,
      lastPullAt: currentRepository?.lastPullAt ?? null,
      remoteEnabled: true,
      inheritsOrganizationRemote: connection.connectionSource === "organization",
      remoteSource: "agent",
    } as RemoteConfig;
  }

  private async ensureRemote(
    git: ReturnType<typeof simpleGit>,
    remote: RemoteConfig | null,
  ) {
    if (!remote?.repositoryUrl) {
      return;
    }
    const authenticatedUrl = this.buildAuthenticatedRemoteUrl(remote);
    const remotes = await git.getRemotes(true).catch(() => []);
    const origin = remotes.find((candidate) => candidate.name === "origin");
    if (!origin) {
      await git.addRemote("origin", authenticatedUrl).catch(() => null);
      return;
    }
    if (origin.refs.fetch !== authenticatedUrl) {
      await git
        .remote(["set-url", "origin", authenticatedUrl])
        .catch(() => null);
    }
  }

  private buildAuthenticatedRemoteUrl(remote: RemoteConfig) {
    if (!remote.accessToken || !remote.repositoryUrl) {
      return remote.repositoryUrl ?? "";
    }
    try {
      const url = new URL(remote.repositoryUrl);
      url.username = remote.username || "x-access-token";
      url.password = remote.accessToken;
      return url.toString();
    } catch {
      return remote.repositoryUrl;
    }
  }

  private async ensureRemoteRepository(remote: RemoteConfig) {
    if (
      !remote.autoCreateRepository ||
      !remote.repositoryUrl ||
      !remote.accessToken
    ) {
      return;
    }
    const owner = remote.githubLogin ?? remote.owner ?? null;
    if (remote.provider === "github" && owner && remote.repoName) {
      const url =
        remote.username && owner !== remote.username
          ? `https://api.github.com/orgs/${encodeURIComponent(owner)}/repos`
          : "https://api.github.com/user/repos";
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${remote.accessToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: remote.repoName,
          private: remote.visibility !== "public",
          // Important: auto_init creates a remote "initial commit" (README, etc),
          // which causes non-fast-forward push/divergence for Tuul's server-side VCS.
          // Tuul will create the initial commit locally and push it.
          auto_init: false,
        }),
      }).catch(() => null);
    }
  }

  private async checkoutBranch(
    git: ReturnType<typeof simpleGit>,
    branchName: string,
  ) {
    const branches = await git
      .branchLocal()
      .catch(() => ({ all: [] as string[] }));
    if (branches.all.includes(branchName)) {
      await git.checkout(branchName).catch(() => null);
      return;
    }
    await git.checkoutLocalBranch(branchName).catch(() => null);
  }

  private async updateRepositoryMetadata(
    agent: Agent,
    repositoryPatch: Partial<RemoteConfig>,
  ) {
    const nextRepository: RemoteConfig = {
      provider: agent.metadata?.repository?.provider ?? "github",
      mode: agent.metadata?.repository?.mode ?? "internal",
      localRepoPath:
        agent.metadata?.repository?.localRepoPath ?? this.getRepoPath(agent.id),
      repositoryUrl: agent.metadata?.repository?.repositoryUrl ?? null,
      githubLogin: agent.metadata?.repository?.githubLogin ?? null,
      githubAvatarUrl: agent.metadata?.repository?.githubAvatarUrl ?? null,
      owner: null,
      repoName: agent.metadata?.repository?.repoName ?? null,
      slug: agent.metadata?.repository?.slug ?? null,
      host: agent.metadata?.repository?.host ?? "github.com",
      defaultBranch: agent.metadata?.repository?.defaultBranch ?? "main",
      currentBranchId: agent.metadata?.repository?.currentBranchId ?? null,
      currentBranchName: agent.metadata?.repository?.currentBranchName ?? null,
      installationType: agent.metadata?.repository?.installationType ?? "none",
      accessToken: agent.metadata?.repository?.accessToken ?? null,
      refreshToken: agent.metadata?.repository?.refreshToken ?? null,
      tokenExpiresAt: agent.metadata?.repository?.tokenExpiresAt ?? null,
      username: agent.metadata?.repository?.username ?? null,
      appClientId:
        agent.metadata?.repository?.appClientId ??
        process.env.GIT_APP_CLIENT_ID?.trim() ??
        null,
      installationId: agent.metadata?.repository?.installationId ?? null,
      appInstallationUrl:
        agent.metadata?.repository?.appInstallationUrl ?? null,
      appInstallations: agent.metadata?.repository?.appInstallations ?? null,
      visibility: agent.metadata?.repository?.visibility ?? "private",
      autoCreateRepository:
        agent.metadata?.repository?.autoCreateRepository ?? true,
      commitMode: agent.metadata?.repository?.commitMode ?? "direct",
      isConnected: agent.metadata?.repository?.isConnected ?? false,
      remoteEnabled: agent.metadata?.repository?.remoteEnabled ?? false,
      inheritsOrganizationRemote:
        agent.metadata?.repository?.inheritsOrganizationRemote ?? false,
      remoteSource: agent.metadata?.repository?.remoteSource ?? "none",
      connectedAt: agent.metadata?.repository?.connectedAt ?? null,
      initializedAt: agent.metadata?.repository?.initializedAt ?? null,
      lastFetchAt: (agent.metadata?.repository as any)?.lastFetchAt ?? null,
      lastPushAt: agent.metadata?.repository?.lastPushAt ?? null,
      lastPullAt: agent.metadata?.repository?.lastPullAt ?? null,
      lastPushStatus: agent.metadata?.repository?.lastPushStatus ?? "idle",
      lastPushMessage: agent.metadata?.repository?.lastPushMessage ?? null,
      lastPullRequestUrl:
        agent.metadata?.repository?.lastPullRequestUrl ?? null,
      webUrl: agent.metadata?.repository?.webUrl ?? null,
      cloneUrlHttps: agent.metadata?.repository?.cloneUrlHttps ?? null,
      cloneUrlSsh: agent.metadata?.repository?.cloneUrlSsh ?? null,
      branchUrl: agent.metadata?.repository?.branchUrl ?? null,
      compareUrlTemplate:
        agent.metadata?.repository?.compareUrlTemplate ?? null,
      health: agent.metadata?.repository?.health ?? null,
      ...repositoryPatch,
    };

    await this.agentRepository.updateMetadata(agent.id, {
      ...(agent.metadata ?? {}),
      repository: nextRepository,
    });
  }

  private readErrorMessage(error: unknown, fallback: string) {
    if (!error) return fallback;
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    const candidate = (error as any)?.message;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    return fallback;
  }

  private isAuthFailureError(message: string) {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("authentication failed") ||
      normalized.includes("invalid username or token") ||
      normalized.includes("password authentication is not supported") ||
      normalized.includes("could not read username") ||
      normalized.includes("http basic: access denied") ||
      normalized.includes("bad credentials")
    );
  }

  private async disconnectRemoteOnAuthFailure(
    agentId: string,
    agent: Agent,
    message: string,
  ) {
    if (!this.isAuthFailureError(message)) {
      return false;
    }

    await this.disconnectAgentRemote(agentId, {
      reason:
        "Git authentication failed for this repository. Your GitHub connection was removed. Reconnect GitHub and try again.",
    });

    // Keep in-memory copy aligned if this call path continues using `agent`.
    if (agent.metadata?.repository) {
      agent.metadata.repository.isConnected = false;
      agent.metadata.repository.remoteEnabled = false;
      agent.metadata.repository.accessToken = null;
      agent.metadata.repository.refreshToken = null;
      agent.metadata.repository.repositoryUrl = null;
      agent.metadata.repository.githubLogin = null;
      agent.metadata.repository.repoName = null;
    }
    return true;
  }

  private getRepoPath(agentId: string) {
    return join(this.getVcsRootDir(), "agents", agentId);
  }

  private getVcsRootDir() {
    if (AgentVcsService.cachedVcsRootDir) {
      return AgentVcsService.cachedVcsRootDir;
    }

    const explicit =
      process.env.TUUL_VCS_ROOT?.trim() ||
      process.env.TUUL_VCS_DIR?.trim() ||
      "";
    if (explicit) {
      AgentVcsService.cachedVcsRootDir = explicit;
      return explicit;
    }

    // We want `.tuul-vcs/agents/<agentId>` to live at the TUUL workspace root.
    // In dev we usually run from `digitwhale_tuul_service_v2` (or sometimes from `dist/`).
    // This resolves the service root by walking up until we find `fragment.json` + `package.json`.
    let cursor = process.cwd();
    let serviceRoot = cursor;
    for (let depth = 0; depth < 8; depth += 1) {
      if (
        existsSync(join(cursor, "fragment.json")) &&
        existsSync(join(cursor, "package.json"))
      ) {
        serviceRoot = cursor;
        break;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }

    // If we are inside the TUUL monorepo, place `.tuul-vcs` at the monorepo root (parent directory).
    // Otherwise, fall back to storing within the service root.
    const base = basename(serviceRoot);
    const vcsRoot =
      base === "digitwhale_tuul_service_v2"
        ? join(dirname(serviceRoot), ".tuul-vcs")
        : join(serviceRoot, ".tuul-vcs");

    AgentVcsService.cachedVcsRootDir = vcsRoot;
    return vcsRoot;
  }

  private normalizeBranchName(rawValue: string, fallback = "main") {
    const normalized = rawValue
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  private slugify(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "tool"
    );
  }

  private generateCommitHash() {
    return CodeHelper.generate({
      length: 12,
      charset: "alphanumeric",
    }).toLowerCase();
  }

  private async runQueued<T>(
    agentId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.queues.get(agentId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.queues.set(agentId, next as Promise<unknown>);
    try {
      return await next;
    } finally {
      if (this.queues.get(agentId) === next) {
        this.queues.delete(agentId);
      }
    }
  }

  private async getAheadBehindCounts(
    git: ReturnType<typeof simpleGit>,
    branchName: string,
  ): Promise<{ localAheadBy: number; remoteAheadBy: number }> {
    try {
      // left = commits only on local branch, right = commits only on origin branch
      const raw = await git.raw([
        "rev-list",
        "--left-right",
        "--count",
        `${branchName}...origin/${branchName}`,
      ]);
      const [left, right] = raw
        .trim()
        .split(/\s+/)
        .map((value) => Number.parseInt(value, 10))
        .map((value) => (Number.isFinite(value) ? value : 0));
      return { localAheadBy: left ?? 0, remoteAheadBy: right ?? 0 };
    } catch {
      return { localAheadBy: 0, remoteAheadBy: 0 };
    }
  }

  private async markBranchPendingCommitsReplaced(
    branchId: string,
    remoteUrl: string | null,
    branchName: string,
  ) {
    const entries =
      await this.agentVersionEntryRepository.findByInstanceIdAsc(branchId);
    const pending = entries.filter((entry) => {
      const pushed = Boolean(entry.metadata?.git?.pushed);
      const status = String(entry.metadata?.git?.status ?? "pending");
      return !pushed || (status !== "success" && status !== "replaced");
    });

    for (const entry of pending) {
      await this.agentVersionEntryRepository.updateMetadata(entry.id, {
        ...(entry.metadata ?? {}),
        git: {
          ...(entry.metadata?.git ?? {}),
          status: "replaced" as any,
          pushed: false,
          syncedAt: null,
          message: "Replaced by remote branch state.",
          remoteUrl,
          branch: branchName,
        },
      });
    }
  }
}
