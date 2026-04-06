import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { GitBranchDto } from "../dto/git-branch.dto";
import { GitCommitDto } from "../dto/git-commit.dto";
import { GitRemoteDto } from "../dto/git-remote.dto";
import { GitSwitchBranchDto } from "../dto/git-switch-branch.dto";
import { AgentVcsService } from "../services/agent-vcs.service";

@UseAgentManagementPipeline()
@Controller("")
export class AgentGitController {
  @Autowired()
  private agentVcsService!: AgentVcsService;

  @Post("/agents/:agentId/git/init")
  async initialize(@Param("agentId") agentId: string) {
    return this.agentVcsService.initRepository(agentId);
  }

  @Post("/agents/:agentId/git/commit")
  async commit(@Param("agentId") agentId: string, @Body() body: GitCommitDto) {
    return this.agentVcsService.commit(agentId, body);
  }

  @Post("/agents/:agentId/git/push")
  async push(@Param("agentId") agentId: string) {
    return this.agentVcsService.push(agentId);
  }

  @Post("/agents/:agentId/git/pull")
  async pull(@Param("agentId") agentId: string) {
    return this.agentVcsService.pull(agentId);
  }

  @Post("/agents/:agentId/git/fetch")
  async fetch(@Param("agentId") agentId: string) {
    return this.agentVcsService.fetch(agentId);
  }

  @Get("/agents/:agentId/git/branches")
  async getBranches(@Param("agentId") agentId: string) {
    return this.agentVcsService.getBranches(agentId);
  }

  @Post("/agents/:agentId/git/branch")
  async createBranch(@Param("agentId") agentId: string, @Body() body: GitBranchDto) {
    return this.agentVcsService.createBranch(agentId, body);
  }

  @Delete("/agents/:agentId/git/branch/:branchId")
  async deleteBranch(
    @Param("agentId") agentId: string,
    @Param("branchId") branchId: string,
  ) {
    return this.agentVcsService.deleteBranch(agentId, branchId);
  }

  @Put("/agents/:agentId/git/branch/switch")
  async switchBranch(
    @Param("agentId") agentId: string,
    @Body() body: GitSwitchBranchDto,
  ) {
    return this.agentVcsService.switchBranch(agentId, body);
  }

  @Get("/agents/:agentId/git/log")
  async getLog(
    @Param("agentId") agentId: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.agentVcsService.getLog(agentId, branchId);
  }

  @Get("/agents/:agentId/git/commit/:hash")
  async getCommit(
    @Param("agentId") agentId: string,
    @Param("hash") hash: string,
  ) {
    return this.agentVcsService.getCommit(agentId, hash);
  }

  @Get("/agents/:agentId/git/commit/:hash/review")
  async getCommitReview(
    @Param("agentId") agentId: string,
    @Param("hash") hash: string,
  ) {
    return this.agentVcsService.getCommitReview(agentId, hash);
  }

  @Post("/agents/:agentId/git/revert/:hash")
  async revert(
    @Param("agentId") agentId: string,
    @Param("hash") hash: string,
    @Body() body?: { authorUserId?: string; authorName?: string },
  ) {
    return this.agentVcsService.revert(agentId, hash, {
      userId: body?.authorUserId,
      userName: body?.authorName,
    });
  }

  @Get("/agents/:agentId/git/status")
  async getStatus(@Param("agentId") agentId: string) {
    return this.agentVcsService.getStatus(agentId);
  }

  @Get("/agents/:agentId/git/working-status")
  async getWorkingStatus(@Param("agentId") agentId: string) {
    return this.agentVcsService.getWorkingStatus(agentId);
  }

  @Get("/agents/:agentId/git/remote")
  async getRemote(@Param("agentId") agentId: string) {
    return this.agentVcsService.getAgentRemote(agentId);
  }

  @Put("/agents/:agentId/git/remote")
  async updateRemote(@Param("agentId") agentId: string, @Body() body: GitRemoteDto) {
    return this.agentVcsService.updateAgentRemote(agentId, body as any);
  }

  @Post("/agents/:agentId/git/remote/use-organization")
  async useOrganizationRemote(
    @Param("agentId") agentId: string,
    @Body() body?: { repoName?: string; defaultBranch?: string; visibility?: string },
  ) {
    return this.agentVcsService.useOrganizationRemote(agentId, body);
  }

  @Get("/organizations/:organizationId/git/remote")
  async getOrganizationRemote(@Param("organizationId") organizationId: string) {
    return this.agentVcsService.getOrganizationRemote(organizationId);
  }

  @Put("/organizations/:organizationId/git/remote")
  async updateOrganizationRemote(
    @Param("organizationId") organizationId: string,
    @Body() body: GitRemoteDto,
  ) {
    return this.agentVcsService.updateOrganizationRemote(
      organizationId,
      body as unknown as Record<string, unknown>,
    );
  }

  @Get("/agents/:agentId/git/diff/commits")
  async diffCommits(
    @Param("agentId") agentId: string,
    @Query("from") fromCommitHash: string,
    @Query("to") toCommitHash: string,
  ) {
    return this.agentVcsService.diffCommits(agentId, fromCommitHash, toCommitHash);
  }

  @Get("/agents/:agentId/git/diff/branches")
  async diffBranches(
    @Param("agentId") agentId: string,
    @Query("fromBranchId") fromBranchId: string,
    @Query("toBranchId") toBranchId: string,
  ) {
    return this.agentVcsService.diffBranches(agentId, fromBranchId, toBranchId);
  }
}
