import { Service } from "fragment-ts";
import jwt from "jsonwebtoken";

type GitHubAppStatePayload = {
  agentId: string;
  redirectUri: string;
  repoName?: string | null;
  defaultBranch?: string | null;
};

type ExchangeCodeResult = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  refreshTokenExpiresIn?: number | null;
  tokenType?: string | null;
  scope?: string | null;
};

@Service()
export class GithubAppService {
  private get redirectUri() {
    return process.env.GIT_APP_REDIRECT_URI?.trim() || "";
  }

  private get clientId() {
    return process.env.GIT_APP_CLIENT_ID?.trim() || "";
  }

  private get clientSecret() {
    return process.env.GIT_APP_CLIENT_SECRET?.trim() || "";
  }

  private get appSlug() {
    return process.env.GIT_APP_SLUG?.trim() || process.env.GIT_APP_NAME?.trim() || "";
  }

  private get stateSecret() {
    return process.env.GIT_APP_STATE_SECRET?.trim() || this.clientSecret || "tuul-git-app";
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  getConnectUrl(payload: Omit<GitHubAppStatePayload, "redirectUri"> & { redirectUri?: string | null }) {
    this.ensureConfigured();

    const resolvedRedirectUri = payload.redirectUri?.trim() || this.redirectUri;
    const state = this.signState({
      ...payload,
      redirectUri: resolvedRedirectUri,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", resolvedRedirectUri);
    url.searchParams.set("scope", "repo read:user user:email admin:repo_hook");
    url.searchParams.set("state", state);
    url.searchParams.set("allow_signup", "true");

    return {
      authorizeUrl: url.toString(),
      installationUrl: this.getInstallationUrl(),
      configured: true,
    };
  }

  getInstallationUrl(payload: { owner?: string | null } = {}) {
    if (!this.appSlug) return null;

    const url = new URL(`https://github.com/apps/${this.appSlug}/installations/new`);
    if (payload.owner?.trim()) {
      url.searchParams.set("target_id", payload.owner.trim());
    }
    return url.toString();
  }

  verifyState(state: string): GitHubAppStatePayload {
    return jwt.verify(state, this.stateSecret) as GitHubAppStatePayload;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<ExchangeCodeResult> {
    this.ensureConfigured();

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub OAuth exchange failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (!payload.access_token || typeof payload.access_token !== "string") {
      throw new Error("GitHub OAuth exchange did not return an access token.");
    }

    return {
      accessToken: payload.access_token,
      refreshToken:
        typeof payload.refresh_token === "string" ? payload.refresh_token : null,
      expiresIn:
        typeof payload.expires_in === "number" ? payload.expires_in : null,
      refreshTokenExpiresIn:
        typeof payload.refresh_token_expires_in === "number"
          ? payload.refresh_token_expires_in
          : null,
      tokenType: typeof payload.token_type === "string" ? payload.token_type : null,
      scope: typeof payload.scope === "string" ? payload.scope : null,
    };
  }

  async getAuthenticatedUser(accessToken: string) {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub user lookup failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      id: typeof payload.id === "number" ? payload.id : null,
      login: typeof payload.login === "string" ? payload.login : null,
      name: typeof payload.name === "string" ? payload.name : null,
      avatarUrl:
        typeof payload.avatar_url === "string" ? payload.avatar_url : null,
    };
  }

  async getInstallations(accessToken: string) {
    const response = await fetch("https://api.github.com/user/installations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      installations?: Array<Record<string, unknown>>;
    };

    return (payload.installations ?? []).map((installation) => ({
      id: typeof installation.id === "number" ? installation.id : null,
      accountLogin:
        typeof installation.account === "object" &&
        installation.account &&
        typeof (installation.account as Record<string, unknown>).login === "string"
          ? ((installation.account as Record<string, unknown>).login as string)
          : null,
      targetType:
        typeof installation.target_type === "string" ? installation.target_type : null,
      permissions:
        typeof installation.permissions === "object" && installation.permissions
          ? (installation.permissions as Record<string, unknown>)
          : {},
    }));
  }

  async getAuthenticatedLogin(accessToken: string) {
    const user = await this.getAuthenticatedUser(accessToken);
    return user.login ?? null;
  }

  private signState(payload: GitHubAppStatePayload) {
    return jwt.sign(payload, this.stateSecret, {
      algorithm: "HS256",
      expiresIn: "15m",
    });
  }

  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new Error("GitHub App client credentials or redirect URI are not configured.");
    }
  }
}
