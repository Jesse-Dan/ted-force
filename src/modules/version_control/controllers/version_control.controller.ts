import { Autowired, Body, Controller, Get, Param, Post, Put, Query } from "fragment-ts";
import { ConnectGitRepositoryDto } from "../dto/connect-git-repository.dto";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { CommitInstanceSnapshotDto } from "../dto/commit-instance-snapshot.dto";
import { CreateAgentInstanceDto } from "../dto/create-agent-instance.dto";
import { CreateVersionEntryDto } from "../dto/create-version-entry.dto";
import { VersionControlCommandService } from "../services/version-control-command.service";
import { AgentVcsService } from "../services/agent-vcs.service";
import { GithubAppService } from "../services/github-app.service";
import { VersionControlQueryService } from "../services/version-control-query.service";
import { VersionControlSnapshotService } from "../services/version-control-snapshot.service";

@UseAgentManagementPipeline()
@Controller("/version-control")
export class VersionControlController {
  @Autowired()
  private versionControlQueryService!: VersionControlQueryService;

  @Autowired()
  private versionControlCommandService!: VersionControlCommandService;

  @Autowired()
  private agentVcsService!: AgentVcsService;

  @Autowired()
  private versionControlSnapshotService!: VersionControlSnapshotService;

  @Autowired()
  private githubAppService!: GithubAppService;

  @Get("/agents/:agentId/instances")
  async getAgentInstances(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.getAgentInstances(agentId);
  }

  @Get("/repos/:agentId/branches")
  async getRepoBranches(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.getAgentInstances(agentId);
  }

  @Get("/instances/:instanceId/entries")
  async getInstanceVersionEntries(@Param("instanceId") instanceId: string) {
    return this.versionControlQueryService.getInstanceVersionEntries(instanceId);
  }

  @Get("/branches/:branchId/commits")
  async getBranchCommits(@Param("branchId") branchId: string) {
    return this.versionControlQueryService.getInstanceVersionEntries(branchId);
  }

  @Get("/agents/:agentId/commits")
  async listAgentCommits(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.listAgentCommits(agentId);
  }

  @Get("/repos/:agentId/commits")
  async listRepoCommits(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.listAgentCommits(agentId);
  }

  @Post("/agents/:agentId/instances")
  async createAgentInstance(
    @Param("agentId") agentId: string,
    @Body() body: CreateAgentInstanceDto,
  ) {
    return this.versionControlCommandService.createAgentInstance(agentId, body);
  }

  @Post("/repos/:agentId/branches")
  async createRepoBranch(
    @Param("agentId") agentId: string,
    @Body() body: CreateAgentInstanceDto,
  ) {
    return this.versionControlCommandService.createAgentInstance(agentId, body);
  }

  @Post("/instances/:instanceId/entries")
  async createVersionEntry(
    @Param("instanceId") instanceId: string,
    @Body() body: CreateVersionEntryDto,
  ) {
    return this.versionControlCommandService.createVersionEntry(instanceId, body);
  }

  @Post("/branches/:branchId/commits")
  async createBranchCommitEntry(
    @Param("branchId") branchId: string,
    @Body() body: CreateVersionEntryDto,
  ) {
    return this.versionControlCommandService.createVersionEntry(branchId, body);
  }

  @Post("/instances/:instanceId/commit")
  async commitInstanceSnapshot(
    @Param("instanceId") instanceId: string,
    @Body() body: CommitInstanceSnapshotDto,
  ) {
    return this.versionControlSnapshotService.commitInstanceSnapshot(instanceId, body);
  }

  @Post("/branches/:branchId/commit")
  async commitBranchSnapshot(
    @Param("branchId") branchId: string,
    @Body() body: CommitInstanceSnapshotDto,
  ) {
    return this.versionControlSnapshotService.commitInstanceSnapshot(branchId, body);
  }

  @Post("/instances/:instanceId/publish")
  async publishInstance(@Param("instanceId") instanceId: string) {
    return this.versionControlSnapshotService.publishInstance(instanceId);
  }

  @Post("/branches/:branchId/make-main")
  async makeBranchMain(@Param("branchId") branchId: string) {
    return this.versionControlSnapshotService.publishInstance(branchId);
  }

  @Post("/instances/:instanceId/revert")
  async revertInstance(@Param("instanceId") instanceId: string) {
    return this.versionControlSnapshotService.revertInstance(instanceId);
  }

  @Post("/branches/:branchId/reset-main")
  async resetMainToBranch(@Param("branchId") branchId: string) {
    return this.versionControlSnapshotService.revertInstance(branchId);
  }

  @Get("/agents/:agentId/commits/:commitHash")
  async getSnapshotByCommitHash(
    @Param("agentId") agentId: string,
    @Param("commitHash") commitHash: string,
  ) {
    return this.versionControlSnapshotService.getSnapshotByCommitHash(agentId, commitHash);
  }

  @Get("/repos/:agentId/commits/:commitHash")
  async getRepoCommitSnapshot(
    @Param("agentId") agentId: string,
    @Param("commitHash") commitHash: string,
  ) {
    return this.versionControlSnapshotService.getSnapshotByCommitHash(agentId, commitHash);
  }

  @Get("/agents/:agentId/commits/:commitHash/review")
  async getCommitReview(
    @Param("agentId") agentId: string,
    @Param("commitHash") commitHash: string,
  ) {
    return this.versionControlQueryService.getCommitReview(agentId, commitHash);
  }

  @Get("/repos/:agentId/commits/:commitHash/review")
  async getRepoCommitReview(
    @Param("agentId") agentId: string,
    @Param("commitHash") commitHash: string,
  ) {
    return this.versionControlQueryService.getCommitReview(agentId, commitHash);
  }

  @Get("/agents/:agentId/diff/commits")
  async diffByCommits(
    @Param("agentId") agentId: string,
    @Query("fromCommitHash") fromCommitHash: string,
    @Query("toCommitHash") toCommitHash: string,
  ) {
    return this.versionControlSnapshotService.diffByCommitHashes(
      agentId,
      fromCommitHash,
      toCommitHash,
    );
  }

  @Get("/repos/:agentId/diff/commits")
  async diffRepoCommits(
    @Param("agentId") agentId: string,
    @Query("fromCommitHash") fromCommitHash: string,
    @Query("toCommitHash") toCommitHash: string,
  ) {
    return this.versionControlSnapshotService.diffByCommitHashes(
      agentId,
      fromCommitHash,
      toCommitHash,
    );
  }

  @Get("/diff/instances")
  async diffByInstances(
    @Query("fromInstanceId") fromInstanceId: string,
    @Query("toInstanceId") toInstanceId: string,
  ) {
    return this.versionControlSnapshotService.diffByInstances(
      fromInstanceId,
      toInstanceId,
    );
  }

  @Get("/diff/branches")
  async diffBranches(
    @Query("fromBranchId") fromBranchId: string,
    @Query("toBranchId") toBranchId: string,
  ) {
    return this.versionControlSnapshotService.diffByInstances(
      fromBranchId,
      toBranchId,
    );
  }

  @Get("/agents/:agentId/git")
  async getGitConnection(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.getGitConnection(agentId);
  }

  @Get("/repos/:agentId/git")
  async getRepoGitConnection(@Param("agentId") agentId: string) {
    return this.versionControlQueryService.getGitConnection(agentId);
  }

  @Put("/agents/:agentId/git")
  async connectGitRepository(
    @Param("agentId") agentId: string,
    @Body() body: ConnectGitRepositoryDto,
  ) {
    return this.versionControlCommandService.connectGitRepository(agentId, body);
  }

  @Put("/repos/:agentId/git")
  async connectRepoGit(
    @Param("agentId") agentId: string,
    @Body() body: ConnectGitRepositoryDto,
  ) {
    return this.versionControlCommandService.connectGitRepository(agentId, body);
  }

  @Post("/agents/:agentId/git/init")
  async initializeGitRepository(@Param("agentId") agentId: string) {
    return this.versionControlCommandService.initializeGitRepository(agentId);
  }

  @Post("/repos/:agentId/git/init")
  async initializeRepo(@Param("agentId") agentId: string) {
    return this.versionControlCommandService.initializeGitRepository(agentId);
  }

  @Get("/agents/:agentId/git/github/connect-url")
  async getGithubConnectUrl(
    @Param("agentId") agentId: string,
    @Query("redirectUri") redirectUri?: string,
    @Query("repoName") repoName?: string,
    @Query("defaultBranch") defaultBranch?: string,
  ) {
    return this.githubAppService.getConnectUrl({
      connectionScope: "agent",
      agentId,
      redirectUri,
      repoName,
      defaultBranch,
    });
  }

  @Get("/repos/:agentId/git/github/connect-url")
  async getRepoGithubConnectUrl(
    @Param("agentId") agentId: string,
    @Query("redirectUri") redirectUri?: string,
    @Query("repoName") repoName?: string,
    @Query("defaultBranch") defaultBranch?: string,
  ) {
    return this.githubAppService.getConnectUrl({
      connectionScope: "agent",
      agentId,
      redirectUri,
      repoName,
      defaultBranch,
    });
  }

  @Get("/organizations/:organizationId/git/github/connect-url")
  async getOrganizationGithubConnectUrl(
    @Param("organizationId") organizationId: string,
    @Query("redirectUri") redirectUri?: string,
    @Query("defaultBranch") defaultBranch?: string,
  ) {
    return this.githubAppService.getConnectUrl({
      connectionScope: "organization",
      organizationId,
      redirectUri,
      defaultBranch,
    });
  }

  @Get("/agents/:agentId/git/github/callback")
  async completeGithubConnection(
    @Param("agentId") agentId: string,
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    const payload = this.githubAppService.verifyState(state);
    if (payload.connectionScope !== "agent" || payload.agentId !== agentId) {
      throw new Error("GitHub App state does not match the target agent.");
    }

    const token = await this.githubAppService.exchangeCode(code, payload.redirectUri);
    const user = await this.githubAppService.getAuthenticatedUser(token.accessToken);
    const installations = await this.githubAppService.getInstallations(token.accessToken);
    const githubLogin = user.login?.trim() || "";
    const repoName = payload.repoName?.trim() || undefined;
    const repositoryUrl = githubLogin && repoName
      ? `https://github.com/${githubLogin}/${repoName}`
      : "";

    return this.agentVcsService.updateAgentRemote(
      agentId,
      {
        provider: "github",
        repositoryUrl,
        githubLogin,
        githubAvatarUrl: user.avatarUrl ?? undefined,
        repoName,
        defaultBranch: payload.defaultBranch?.trim() || "main",
        installationType: "app",
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? undefined,
        tokenExpiresAt: token.expiresIn
          ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
          : undefined,
        username: user.login ?? undefined,
        installationId:
          installations.find((installation) => installation.accountLogin === githubLogin)?.id ??
          installations[0]?.id ??
          undefined,
        appInstallationUrl:
          this.githubAppService.getInstallationUrl({ owner: githubLogin }) ?? undefined,
        appInstallations: installations,
        visibility: "private",
        autoCreateRepository: true,
      },
      { autoPublish: true },
    );
  }

  @Get("/repos/:agentId/git/github/callback")
  async completeRepoGithubConnection(
    @Param("agentId") agentId: string,
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    return this.completeGithubConnection(agentId, code, state);
  }

  @Get("/organizations/:organizationId/git/github/callback")
  async completeOrganizationGithubConnection(
    @Param("organizationId") organizationId: string,
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    const payload = this.githubAppService.verifyState(state);
    if (
      payload.connectionScope !== "organization" ||
      payload.organizationId !== organizationId
    ) {
      throw new Error("GitHub App state does not match the target organization.");
    }

    const token = await this.githubAppService.exchangeCode(code, payload.redirectUri);
    const user = await this.githubAppService.getAuthenticatedUser(token.accessToken);
    const installations = await this.githubAppService.getInstallations(token.accessToken);
    const githubLogin = user.login?.trim() || "";

    return this.agentVcsService.updateOrganizationRemote(organizationId, {
      enabled: true,
      provider: "github",
      githubLogin,
      githubAvatarUrl: user.avatarUrl ?? undefined,
      defaultBranch: payload.defaultBranch?.trim() || "main",
      accessToken: token.accessToken,
      username: user.login ?? undefined,
      authType: "github_app",
      appInstallationId:
        installations.find((installation) => installation.accountLogin === githubLogin)?.id ??
        installations[0]?.id ??
        undefined,
      appClientId: process.env.GIT_APP_CLIENT_ID?.trim() ?? undefined,
    });
  }
}
