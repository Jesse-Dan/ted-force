import { Autowired, Service } from "fragment-ts";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import type { Agent, AgentMetadata } from "../../../entities/agent.entity";
import type { AgentInstance } from "../../../entities/agent-instance.entity";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentInstanceRepository } from "../repositories/agent-instance.repository";
import { AgentVersionEntryRepository } from "../repositories/agent-version-entry.repository";

type RepoConnection = NonNullable<NonNullable<AgentMetadata["repository"]>>;

@Service()
export class GitSyncService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentInstanceRepository!: AgentInstanceRepository;

  @Autowired()
  private agentVersionEntryRepository!: AgentVersionEntryRepository;

  async syncCommitToRepository(
    agent: Agent,
    instance: AgentInstance,
    versionEntry: {
      version: string;
      message: string | null;
      commitHash: string | null;
      releasedAt: Date;
    },
    snapshot: unknown,
  ) {
    const repository = agent.metadata?.repository;
    if (!repository?.isConnected) {
      return { pushed: false, reason: "Repository not connected" };
    }

    await this.ensureRemoteRepository(repository);

    const repoDir = await this.prepareWorkspace(agent.id);
    const git = simpleGit(repoDir);

    if (!(await git.checkIsRepo())) {
      await git.init();
    }

    const remoteUrl = this.buildAuthenticatedRemoteUrl(repository);
    if (remoteUrl) {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((remote) => remote.name === "origin");
      if (!origin) {
        await git.addRemote("origin", remoteUrl);
      } else if (origin.refs.fetch !== remoteUrl) {
        await git.remote(["set-url", "origin", remoteUrl]);
      }
    }

    await this.writeRepositorySnapshot(repoDir, agent, instance, versionEntry, snapshot, repository);

    const branch =
      instance.version.gitBranch?.trim() || (repository.defaultBranch ?? "main");
    await this.checkoutBranch(git, branch);
    await git.add(".");
    await git.commit(versionEntry.message?.trim() || "Tuul Orchestrator", undefined, {
      "--allow-empty": null,
    });

    let pushed = false;
    if (remoteUrl) {
      await git.push("origin", branch, { "-u": null });
      pushed = true;
    }

    const pullRequestUrl =
      repository.commitMode === "pull_request"
        ? await this.createOrUpdatePullRequest(repository, branch, versionEntry.message)
        : null;

    await this.updateRepositoryMetadata(agent.id, {
      ...repository,
      initializedAt:
        repository.initializedAt ?? (pushed ? new Date().toISOString() : null),
      lastPushAt: pushed ? new Date().toISOString() : repository.lastPushAt ?? null,
      lastPushStatus: pushed ? "success" : "failed",
      lastPushMessage:
        pushed
          ? versionEntry.message?.trim() || "Tuul Orchestrator"
          : "Backend sync did not push to the remote repository.",
      lastPullRequestUrl: pushed ? pullRequestUrl : repository.lastPullRequestUrl ?? null,
    });

    return {
      pushed,
      remoteUrl: repository.repositoryUrl,
      branch,
      pullRequestUrl,
      localPath: repoDir,
    };
  }

  async syncInstanceToRepository(
    agent: Agent,
    instance: AgentInstance,
    versionEntry: {
      version: string;
      message: string | null;
      commitHash: string | null;
      releasedAt: Date;
    },
    snapshot: unknown,
  ) {
    return this.syncCommitToRepository(agent, instance, versionEntry, snapshot);
  }

  async initializeRepositoryFromCurrentState(agent: Agent) {
    const currentInstances = await this.agentInstanceRepository.findCurrentByAgent(agent.id);
    const allInstances = currentInstances.length
      ? currentInstances
      : await this.agentInstanceRepository.findByAgentId(agent.id);
    const instance = allInstances[0];

    if (!instance) {
      return { pushed: false, reason: "No branch available" };
    }

    const latest = await this.agentVersionEntryRepository.findLatestForInstance(instance.id);
    const snapshot = latest?.metadata?.snapshot ?? {
      commitHash: null,
      parameter: {},
      tools: [],
    };

    return this.syncCommitToRepository(
      agent,
      instance,
      {
        version: instance.version?.version ?? "main",
        message: "Tuul Orchestrator",
        commitHash: latest?.commitHash ?? null,
        releasedAt: latest?.releasedAt ?? new Date(),
      },
      snapshot,
    );
  }

  private async prepareWorkspace(agentId: string) {
    const repoDir = join(tmpdir(), "tuul-git", agentId);
    await mkdir(repoDir, { recursive: true });
    return repoDir;
  }

  private async writeRepositorySnapshot(
    repoDir: string,
    agent: Agent,
    instance: AgentInstance,
    versionEntry: { version: string; message: string | null; commitHash: string | null; releasedAt: Date },
    snapshot: unknown,
    repository: RepoConnection,
  ) {
    await mkdir(join(repoDir, "tuul"), { recursive: true });
    await mkdir(join(repoDir, "tuul", "commits"), { recursive: true });

    const commitHash = versionEntry.commitHash ?? "working";
    const manifest = {
      agent: {
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
      },
      repository: {
        provider: repository.provider,
        slug: repository.slug,
        branch:
          instance.version.gitBranch?.trim() || (repository.defaultBranch ?? "main"),
        url: repository.repositoryUrl,
      },
      instance: {
        id: instance.id,
        version: instance.version?.version,
        projection: instance.projection,
        status: instance.status,
      },
      commit: {
        hash: commitHash,
        version: versionEntry.version,
        message: versionEntry.message ?? "Tuul Orchestrator",
        releasedAt: versionEntry.releasedAt,
      },
      snapshot,
    };

    await writeFile(
      join(repoDir, "README.md"),
      `# ${agent.name}\n\nManaged by Tuul Core.\n`,
      "utf8",
    );
    await writeFile(
      join(repoDir, ".gitignore"),
      [
        "node_modules/",
        ".DS_Store",
        ".env",
        ".env.local",
        ".env.*.local",
        "dist/",
        "build/",
        ".cache/",
        ".turbo/",
        ".next/",
        "coverage/",
        "*.log",
        "npm-debug.log*",
        "yarn-debug.log*",
        "yarn-error.log*",
        "pnpm-debug.log*",
      ].join("\n") + "\n",
      "utf8",
    );
    await writeFile(
      join(repoDir, ".gitattributes"),
      ["* text=auto", "*.sh text eol=lf", "*.ts text eol=lf", "*.tsx text eol=lf"].join("\n") + "\n",
      "utf8",
    );
    await writeFile(
      join(repoDir, "tuul.config.json"),
      JSON.stringify(
        {
          agentId: agent.id,
          agentSlug: agent.slug,
          currentInstanceId: instance.id,
          currentBranch:
            instance.version.gitBranch?.trim() || (repository.defaultBranch ?? "main"),
          managedBy: "tuul-core",
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      join(repoDir, "tuul", "latest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    await writeFile(
      join(repoDir, "tuul", "commits", `${commitHash}.json`),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
  }

  private buildAuthenticatedRemoteUrl(repository: RepoConnection) {
    if (!repository.accessToken || !repository.cloneUrlHttps) {
      return null;
    }

    try {
      const url = new URL(repository.cloneUrlHttps);
      url.username = "x-access-token";
      url.password = repository.accessToken;
      return url.toString();
    } catch {
      return repository.cloneUrlHttps;
    }
  }

  private async checkoutBranch(git: ReturnType<typeof simpleGit>, branch: string) {
    const localBranches = await git.branchLocal();
    if (localBranches.all.includes(branch)) {
      await git.checkout(branch);
      return;
    }

    try {
      await git.checkoutLocalBranch(branch);
    } catch {
      await git.checkout(["-b", branch]);
    }
  }

  private async ensureRemoteRepository(repository: RepoConnection) {
    if (!repository.autoCreateRepository) return;
    if (!repository.accessToken) return;
    const owner = repository.githubLogin ?? repository.owner ?? null;
    if (!owner || !repository.repoName) return;

    if (repository.provider === "github") {
      const createUrl =
        owner && repository.username && owner !== repository.username
          ? `https://api.github.com/orgs/${encodeURIComponent(owner)}/repos`
          : "https://api.github.com/user/repos";

      await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${repository.accessToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repository.repoName,
          private: repository.visibility !== "public",
          auto_init: true,
        }),
      }).catch(() => null);
      return;
    }

    if (repository.provider === "gitlab") {
      await fetch("https://gitlab.com/api/v4/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${repository.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repository.repoName,
          path: repository.repoName,
          visibility: repository.visibility ?? "private",
          initialize_with_readme: true,
        }),
      }).catch(() => null);
      return;
    }

    if (repository.provider === "bitbucket") {
      await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repository.repoName)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repository.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scm: "git",
            is_private: repository.visibility !== "public",
            project: { key: owner.slice(0, 3).toUpperCase() || "TUL" },
          }),
        },
      ).catch(() => null);
    }
  }

  private async createOrUpdatePullRequest(
    repository: RepoConnection,
    branch: string,
    message: string | null,
  ) {
    const owner = repository.githubLogin ?? repository.owner ?? null;
    if (!repository.accessToken || !owner || !repository.repoName) {
      return null;
    }

    const base = repository.defaultBranch ?? "main";
    if (branch === base) {
      return null;
    }

    const title = message?.trim() || "Tuul Orchestrator";
    const body = "Automated Tuul sync from the active instance branch.";

    try {
      const existingResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.repoName)}/pulls?head=${encodeURIComponent(owner + ":" + branch)}&base=${encodeURIComponent(base)}&state=open`,
        {
          headers: {
            Authorization: `Bearer ${repository.accessToken}`,
            Accept: "application/vnd.github+json",
          },
        },
      );

      if (existingResponse.ok) {
        const existing = (await existingResponse.json()) as Array<Record<string, unknown>>;
        const existingUrl =
          typeof existing[0]?.html_url === "string" ? (existing[0].html_url as string) : null;
        if (existingUrl) {
          return existingUrl;
        }
      }

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository.repoName)}/pulls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repository.accessToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            body,
            head: branch,
            base,
          }),
        },
      );

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return typeof payload.html_url === "string" ? payload.html_url : null;
    } catch {
      return null;
    }
  }

  private async updateRepositoryMetadata(agentId: string, repository: RepoConnection) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) return;
    await this.agentRepository.updateMetadata(agentId, {
      ...(agent.metadata ?? {}),
      repository,
    });
  }
}
