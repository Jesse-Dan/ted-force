import { Autowired, Service } from "fragment-ts";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import simpleGit from "simple-git";
import { Agent, type AgentMetadata } from "../../../entities/agent.entity";
import { type AgentConfig } from "../../../entities/agent-config.entity";
import { type AgentInstance } from "../../../entities/agent-instance.entity";
import { type AgentParameter } from "../../../entities/agent-parameter.entity";
import { type AgentTool } from "../../../entities/agent-tool.entity";
import { CodeHelper } from "../../../common/helpers/code.helper";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import { InstanceReference } from "../../../entities/enums/instance-reference.enum";
import { InstanceStatus } from "../../../entities/enums/instance-status.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentConfigRepository } from "../../config/repositories/agent-config.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationRepositoryConnectionRepository } from "../../organization/repositories/organization-repository-connection.repository";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentParameterVersionRepository } from "../repositories/agent-parameter-version.repository";
import { AgentToolVersionRepository } from "../repositories/agent-tool-version.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";

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
    accessPolicy?: AgentConfig["accessPolicy"] | null;
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
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  @Autowired()
  private agentParameterVersionRepository!: AgentParameterVersionRepository;

  @Autowired()
  private agentToolVersionRepository!: AgentToolVersionRepository;

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
    payload: { name: string; fromBranchId?: string; fromBranchName?: string },
  ) {
    return this.runQueued(agentId, async () => {
      const agent = await this.getAgentOrThrow(agentId);
      const defaultBranch = this.getDefaultBranchName(agent);
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
    const tuulHashes = new Set(
      tuulSerialized
        .map((c) => (c.hash ?? "").trim())
        .filter((hash) => hash.length > 0),
    );

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
      await git.fetch("origin", branchName).catch(() => null);
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
        pushMessage =
          error?.message?.trim?.() ||
          `Failed to push branch ${branchName} to remote repository.`;
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
        await git.fetch("origin", branchName).catch(() => null);

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
        const message =
          error?.message?.trim?.() ||
          "Git pull failed. Please resolve the conflict in your Git provider and try again.";

        // We should not leave the server-side repo in a conflicted merge state,
        // since users resolve conflicts on their machine (out of scope for Tuul UI).
        await git.raw(["merge", "--abort"]).catch(() => null);

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
      }

      await this.updateRepositoryMetadata(agent, {
        lastPullAt: new Date().toISOString(),
      });

      return { pulled: true, branch: branchName };
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
        return {
          fetched: false,
          remoteConfigured: true,
          branch: branchName,
          reason:
            error?.message?.trim?.() ||
            "Git fetch failed. Check your remote connection and try again.",
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
    const agentRemote = (agent.metadata?.repository as RemoteConfig | null) ?? null;
    const organizationRemote = agent.organizationId
      ? await this.getOrganizationRemote(agent.organizationId)
      : null;
    const effective =
      agentRemote?.isConnected || agentRemote?.repositoryUrl || agentRemote?.githubLogin
        ? agentRemote
        : ((organizationRemote as RemoteConfig | null) ?? null);
    return {
      mode: agentRemote?.mode ?? "internal",
      agentRemote,
      effectiveRemote: effective,
      organizationRemote,
      defaultBranch: this.getDefaultBranchName(agent),
    };
  }

  async updateAgentRemote(agentId: string, payload: Partial<RemoteConfig>) {
    const agent = await this.getAgentOrThrow(agentId);
    const currentRepository = agent.metadata?.repository ?? null;
    const githubLogin =
      (payload.githubLogin as string | null | undefined)?.trim?.() ||
      currentRepository?.githubLogin ||
      currentRepository?.username ||
      null;
    const githubAvatarUrl =
      (payload.githubAvatarUrl as string | null | undefined)?.trim?.() ||
      currentRepository?.githubAvatarUrl ||
      null;
    const repoName =
      payload.repoName?.trim?.() || currentRepository?.repoName || agent.slug;
    const repositoryUrl =
      githubLogin && repoName
        ? `https://github.com/${githubLogin}/${repoName}`
        : (payload.repositoryUrl ?? currentRepository?.repositoryUrl ?? null);
    const nextRepository: RemoteConfig = {
      provider:
        (payload.provider as RemoteConfig["provider"]) ??
        currentRepository?.provider ??
        "github",
      mode:
        repositoryUrl || githubLogin || repoName
          ? "git"
          : (currentRepository?.mode ?? "internal"),
      localRepoPath:
        currentRepository?.localRepoPath ?? this.getRepoPath(agentId),
      repositoryUrl,
      githubLogin,
      githubAvatarUrl,
      owner: null,
      repoName,
      slug:
        githubLogin && repoName
          ? `${githubLogin}/${repoName}`
          : (currentRepository?.slug ?? null),
      host: currentRepository?.host ?? "github.com",
      defaultBranch:
        payload.defaultBranch ?? currentRepository?.defaultBranch ?? "main",
      currentBranchId: currentRepository?.currentBranchId ?? null,
      currentBranchName: currentRepository?.currentBranchName ?? null,
      installationType: currentRepository?.installationType ?? "none",
      accessToken:
        payload.accessToken ?? currentRepository?.accessToken ?? null,
      refreshToken: currentRepository?.refreshToken ?? null,
      tokenExpiresAt: currentRepository?.tokenExpiresAt ?? null,
      username: payload.username ?? currentRepository?.username ?? null,
      appClientId:
        currentRepository?.appClientId ??
        process.env.GIT_APP_CLIENT_ID?.trim() ??
        null,
      installationId: currentRepository?.installationId ?? null,
      appInstallationUrl: currentRepository?.appInstallationUrl ?? null,
      appInstallations: currentRepository?.appInstallations ?? null,
      visibility:
        (payload.visibility as RemoteConfig["visibility"]) ??
        currentRepository?.visibility ??
        "private",
      autoCreateRepository:
        payload.autoCreateRepository ??
        currentRepository?.autoCreateRepository ??
        true,
      commitMode:
        (payload.commitMode as RemoteConfig["commitMode"]) ??
        currentRepository?.commitMode ??
        "direct",
      isConnected: Boolean(repositoryUrl && githubLogin),
      remoteEnabled: true,
      inheritsOrganizationRemote: false,
      remoteSource: "agent",
      connectedAt: currentRepository?.connectedAt ?? new Date().toISOString(),
      initializedAt: currentRepository?.initializedAt ?? null,
      lastPushAt: currentRepository?.lastPushAt ?? null,
      lastPullAt: currentRepository?.lastPullAt ?? null,
      lastPushStatus: currentRepository?.lastPushStatus ?? "idle",
      lastPushMessage: currentRepository?.lastPushMessage ?? null,
      lastPullRequestUrl: currentRepository?.lastPullRequestUrl ?? null,
      webUrl: repositoryUrl,
      cloneUrlHttps: repositoryUrl,
      cloneUrlSsh: currentRepository?.cloneUrlSsh ?? null,
      branchUrl: currentRepository?.branchUrl ?? null,
      compareUrlTemplate: currentRepository?.compareUrlTemplate ?? null,
      health: {
        isValidUrl: Boolean(repositoryUrl),
        ownerResolved: Boolean(githubLogin),
        repoResolved: Boolean(repoName),
        providerSupported: true,
        readyForAutomaticPush: Boolean(
          repositoryUrl &&
          githubLogin &&
          (payload.accessToken ?? currentRepository?.accessToken),
        ),
      },
    };
    await this.updateRepositoryMetadata(agent, nextRepository);
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

    await this.updateRepositoryMetadata(agent, {
      provider: "github",
      mode: "git",
      localRepoPath:
        agent.metadata?.repository?.localRepoPath ?? this.getRepoPath(agentId),
      repositoryUrl,
      githubLogin: organizationRemote.githubLogin ?? null,
      githubAvatarUrl: organizationRemote.githubAvatarUrl ?? null,
      owner: null,
      repoName,
      slug: `${organizationRemote.githubLogin}/${repoName}`,
      host: "github.com",
      defaultBranch,
      currentBranchId: agent.metadata?.repository?.currentBranchId ?? null,
      currentBranchName: agent.metadata?.repository?.currentBranchName ?? null,
      installationType:
        organizationRemote.authType === "github_app" ? "app" : "token",
      accessToken: organizationRemote.accessToken ?? null,
      username: organizationRemote.username ?? null,
      appClientId:
        organizationRemote.appClientId ??
        process.env.GIT_APP_CLIENT_ID?.trim() ??
        null,
      installationId: organizationRemote.appInstallationId ?? null,
      visibility:
        (payload?.visibility as RemoteConfig["visibility"] | undefined) ??
        agent.metadata?.repository?.visibility ??
        "private",
      autoCreateRepository:
        agent.metadata?.repository?.autoCreateRepository ?? true,
      commitMode: agent.metadata?.repository?.commitMode ?? "direct",
      isConnected: true,
      remoteEnabled: true,
      inheritsOrganizationRemote: true,
      remoteSource: "agent",
      connectedAt: new Date().toISOString(),
      initializedAt: agent.metadata?.repository?.initializedAt ?? null,
      lastPushAt: agent.metadata?.repository?.lastPushAt ?? null,
      lastPullAt: agent.metadata?.repository?.lastPullAt ?? null,
      lastPushStatus: agent.metadata?.repository?.lastPushStatus ?? "idle",
      lastPushMessage: agent.metadata?.repository?.lastPushMessage ?? null,
      lastPullRequestUrl:
        agent.metadata?.repository?.lastPullRequestUrl ?? null,
      webUrl: repositoryUrl,
      cloneUrlHttps: `${repositoryUrl}.git`,
      cloneUrlSsh: `git@github.com:${organizationRemote.githubLogin}/${repoName}.git`,
      branchUrl: `${repositoryUrl}/tree/${encodeURIComponent(defaultBranch)}`,
      compareUrlTemplate: `${repositoryUrl}/compare/{base}...{head}`,
      health: {
        isValidUrl: true,
        ownerResolved: true,
        repoResolved: true,
        providerSupported: true,
        readyForAutomaticPush: Boolean(
          organizationRemote.accessToken || organizationRemote.appInstallationId,
        ),
      },
    });

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
    const repoPath = this.getRepoPath(agentId);
    await mkdir(repoPath, { recursive: true });
    const git = simpleGit(repoPath);

    const isRepo = await git.checkIsRepo().catch(() => false);
    if (!isRepo) {
      return {
        isRepo: false,
        branch: this.getDefaultBranchName(agent),
        ahead: 0,
        behind: 0,
        files: [],
      };
    }

    const status = await git.status();
    return {
      isRepo: true,
      branch: status.current ?? this.getDefaultBranchName(agent),
      tracking: status.tracking ?? null,
      ahead: status.ahead ?? 0,
      behind: status.behind ?? 0,
      isClean: Boolean(status.isClean?.()),
      conflicted: status.conflicted ?? [],
      created: status.created ?? [],
      deleted: status.deleted ?? [],
      modified: status.modified ?? [],
      renamed: status.renamed ?? [],
      notAdded: status.not_added ?? [],
      staged: status.staged ?? [],
      files: (status.files ?? []).map((file) => ({
        path: file.path,
        index: file.index,
        workingDir: (file as any).working_dir ?? (file as any).workingDir ?? "",
      })),
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
    const paths = [
      "agent.json",
      "agent.xml",
      "namespace.agent",
      "example.agent.json",
      ".gitignore",
    ];
    const files: SnapshotFile[] = [];
    for (const path of paths) {
      const content = await git
        .raw(["show", `${commitHash}:${path}`])
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
            accessPolicy: config.accessPolicy ?? null,
          }
        : null,
      parameter: this.serializeParameter(parameter),
      tools: tools.map((tool) => this.serializeTool(tool)),
    };
  }

  private async applySnapshot(agent: Agent, snapshot: SnapshotShape) {
    await this.agentRepository.save({
      ...agent,
      description: snapshot.agent.description ?? null,
      domainLabel: snapshot.agent.domainLabel ?? null,
      version: snapshot.agent.version || agent.version,
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
        accessPolicy: snapshot.config.accessPolicy ?? null,
        apiKey: existingConfig?.apiKey ?? null,
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
    if (snapshot.tools.length > 0) {
      await this.agentToolVersionRepository.saveMany(
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

  private generateRepositoryFiles(
    snapshot: SnapshotShape,
    branchName: string,
  ): SnapshotFile[] {
    const agentJson = JSON.stringify(snapshot, null, 2) + "\n";
    const exampleAgentJson =
      JSON.stringify(
        {
          ...snapshot,
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
        managedFiles.push({
          path: `tools/${safeName}.ts`,
          content: `${tool.code.trim()}\n`,
        });
      }
    }

    const manifest = {
      managedFiles: managedFiles.map((file) => file.path),
      branch: branchName,
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

    let pushed = false;
    let pushMessage = entry.message?.trim() || "Update agent";
    if (repository?.repositoryUrl) {
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
      lastPushStatus: repository?.repositoryUrl
        ? pushed
          ? "success"
          : "failed"
        : "idle",
      lastPushMessage: pushMessage,
    });

    return {
      success: !repository?.repositoryUrl || pushed,
      pushed,
      branch: branchName,
      message: pushMessage,
      remoteUrl: repository?.repositoryUrl ?? null,
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
      return JSON.parse(raw) as SnapshotShape;
    } catch {
      return null;
    }
  }

  private async getBranchHeadSnapshot(agentId: string, branchId: string) {
    const head =
      await this.agentVersionEntryRepository.findLatestForInstance(branchId);
    if (head?.metadata?.snapshot) {
      return head.metadata.snapshot as SnapshotShape;
    }
    const branch = await this.agentInstanceRepository.findById(branchId);
    if (branch?.commitHash) {
      const commit = await this.agentVersionEntryRepository.findByCommitHash(
        agentId,
        branch.commitHash,
      );
      if (commit?.metadata?.snapshot) {
        return commit.metadata.snapshot as SnapshotShape;
      }
    }
    return null;
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

  private normalizeFilesForDiff(
    files: Array<{ path: string; content: string }>,
  ) {
    return files.reduce<Record<string, string>>((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {});
  }

  private async getEffectiveRemote(agent: Agent): Promise<RemoteConfig | null> {
    // IMPORTANT: Git connections are per-agent. We do not inherit organization-level
    // remotes or tokens, to avoid cross-organization leaks and accidental reuse.
    return (agent.metadata?.repository as RemoteConfig | null) ?? null;
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
}
