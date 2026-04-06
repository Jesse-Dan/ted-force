import { Service } from "fragment-ts";

type GitProvider = "github";
type GitInstallationType = "app";
type GitVisibility = "private" | "public" | "internal";
type GitPushStatus = "idle" | "success" | "failed";
type GitCommitMode = "direct" | "pull_request";

type NormalizeGitPayload = {
  provider?: string | null;
  repositoryUrl: string;
  githubLogin?: string | null;
  githubAvatarUrl?: string | null;
  owner?: string | null;
  repoName?: string | null;
  defaultBranch?: string | null;
  installationType?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  username?: string | null;
  installationId?: number | null;
  appInstallationUrl?: string | null;
  appInstallations?: Array<Record<string, unknown>> | null;
  visibility?: string | null;
  autoCreateRepository?: boolean | null;
  commitMode?: string | null;
  connectedAt?: string | null;
  initializedAt?: string | null;
  lastPushAt?: string | null;
  lastPushStatus?: string | null;
  lastPushMessage?: string | null;
  lastPullRequestUrl?: string | null;
};

@Service()
export class GitConnectionService {
  normalize(payload: NormalizeGitPayload) {
    const inputRepositoryUrl = payload.repositoryUrl.trim();
    const githubLogin = payload.githubLogin?.trim() || payload.username?.trim() || null;
    const githubAvatarUrl = payload.githubAvatarUrl?.trim() || null;
    const repositoryUrl = inputRepositoryUrl;
    const parsed = this.parseRepository(repositoryUrl);
    const provider: GitProvider = this.resolveProvider(payload.provider, parsed.host);
    const owner = githubLogin || payload.owner?.trim() || parsed.owner || null;
    const repoName = payload.repoName?.trim() || parsed.repoName || null;
    const resolvedRepositoryUrl =
      provider === "github" && owner && repoName
        ? `https://github.com/${owner}/${repoName}`
        : repositoryUrl || "";
    const defaultBranch = payload.defaultBranch?.trim() || "main";
    const installationType: GitInstallationType = this.resolveInstallationType(
      payload.installationType,
    );
    const accessToken = payload.accessToken?.trim() || null;
    const refreshToken = payload.refreshToken?.trim() || null;
    const tokenExpiresAt = payload.tokenExpiresAt?.trim() || null;
    const username = payload.username?.trim() || null;
    const installationId = payload.installationId ?? null;
    const appInstallationUrl = payload.appInstallationUrl?.trim() || null;
    const visibility = this.resolveVisibility(payload.visibility);
    const autoCreateRepository = payload.autoCreateRepository ?? true;
    const commitMode = this.resolveCommitMode(payload.commitMode);
    const slug = owner && repoName ? `${owner}/${repoName}` : null;
    const webUrl = slug ? this.buildWebUrl(provider, slug, resolvedRepositoryUrl) : resolvedRepositoryUrl;
    const cloneUrlHttps = slug ? this.buildHttpsCloneUrl(provider, slug, resolvedRepositoryUrl) : resolvedRepositoryUrl;
    const cloneUrlSsh = slug ? this.buildSshCloneUrl(provider, slug) : null;

    return {
      provider,
      repositoryUrl: resolvedRepositoryUrl || null,
      githubLogin,
      githubAvatarUrl,
      owner: null,
      repoName,
      slug,
      host: parsed.host ?? null,
      defaultBranch,
      installationType,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      username,
      installationId,
      appClientId: provider === "github" ? process.env.GIT_APP_CLIENT_ID?.trim() || null : null,
      appInstallationUrl,
      appInstallations: payload.appInstallations ?? null,
      visibility,
      autoCreateRepository,
      commitMode,
      isConnected: true,
      connectedAt: payload.connectedAt ?? new Date().toISOString(),
      initializedAt: payload.initializedAt ?? null,
      lastPushAt: payload.lastPushAt ?? null,
      lastPushStatus: this.resolvePushStatus(payload.lastPushStatus),
      lastPushMessage: payload.lastPushMessage ?? null,
      lastPullRequestUrl: payload.lastPullRequestUrl ?? null,
      webUrl,
      cloneUrlHttps,
      cloneUrlSsh,
      branchUrl: slug ? `${webUrl}/tree/${encodeURIComponent(defaultBranch)}` : null,
      compareUrlTemplate: slug
        ? `${webUrl}/compare/{base}...{head}`
        : null,
      health: {
        isValidUrl: Boolean(slug) || parsed.isValid,
        ownerResolved: Boolean(githubLogin),
        repoResolved: Boolean(repoName),
        providerSupported: true,
        readyForAutomaticPush: Boolean(
          owner &&
            repoName &&
            installationType === "app" &&
            (accessToken || installationId),
        ),
      },
    };
  }

  private parseRepository(repositoryUrl: string) {
    try {
      const url = new URL(repositoryUrl);
      const pathSegments = url.pathname.replace(/^\/|\/$/g, "").split("/");
      return {
        isValid: Boolean(url.hostname),
        host: url.hostname,
        owner: pathSegments[0] || null,
        repoName: pathSegments[1]?.replace(/\.git$/, "") || null,
      };
    } catch {
      const sshMatch = repositoryUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return {
          isValid: true,
          host: sshMatch[1],
          owner: sshMatch[2],
          repoName: sshMatch[3],
        };
      }

      return {
        isValid: false,
        host: null,
        owner: null,
        repoName: null,
      };
    }
  }

  private resolveProvider(
    _provider: string | null | undefined,
    _host: string | null,
  ): GitProvider {
    return "github";
  }

  private resolveInstallationType(
    _installationType: string | null | undefined,
  ): GitInstallationType {
    return "app";
  }

  private resolveVisibility(visibility: string | null | undefined): GitVisibility {
    const normalized = visibility?.trim().toLowerCase();
    if (normalized === "public" || normalized === "private" || normalized === "internal") {
      return normalized;
    }
    return "private";
  }

  private resolvePushStatus(status: string | null | undefined): GitPushStatus {
    const normalized = status?.trim().toLowerCase();
    if (normalized === "success" || normalized === "failed" || normalized === "idle") {
      return normalized;
    }
    return "idle";
  }

  private resolveCommitMode(mode: string | null | undefined): GitCommitMode {
    const normalized = mode?.trim().toLowerCase();
    if (normalized === "pull_request") return "pull_request";
    return "direct";
  }

  private buildWebUrl(provider: GitProvider, slug: string, fallback: string) {
    switch (provider) {
      case "github":
        return `https://github.com/${slug}`;
      default:
        return fallback;
    }
  }

  private buildHttpsCloneUrl(provider: GitProvider, slug: string, fallback: string) {
    switch (provider) {
      case "github":
        return `https://github.com/${slug}.git`;
      default:
        return fallback;
    }
  }

  private buildSshCloneUrl(provider: GitProvider, slug: string) {
    switch (provider) {
      case "github":
        return `git@github.com:${slug}.git`;
      default:
        return null;
    }
  }
}
