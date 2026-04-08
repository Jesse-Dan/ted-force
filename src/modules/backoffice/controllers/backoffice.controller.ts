import {
  Autowired,
  Body,
  Controller,
  FragmentMiddleware,
  Get,
  Param,
  Patch,
} from "fragment-ts";
import { UseManagedRequestPipeline } from "../../../common/decorators/use-managed-request-pipeline.decorator";
import { PlatformAdminMiddleware } from "../../../common/middlewares/platform-admin.middleware";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { BackofficeService } from "../services/backoffice.service";

@UseManagedRequestPipeline()
@FragmentMiddleware(PlatformAdminMiddleware, { order: -70 })
@Controller("/backoffice")
export class BackofficeController {
  @Autowired()
  private backofficeService!: BackofficeService;

  @Get("/me")
  async getAccess() {
    return this.backofficeService.getAccess();
  }

  @Get("/users")
  async listUsers() {
    return this.backofficeService.listUsers();
  }

  @Get("/agents")
  async listAgents() {
    return this.backofficeService.listAgents();
  }

  @Get("/organizations")
  async listOrganizations() {
    return this.backofficeService.listOrganizations();
  }

  @Patch("/agents/:agentId/status")
  async updateAgentStatus(
    @Param("agentId") agentId: string,
    @Body()
    body: {
      status: AgentStatus.ACTIVE | AgentStatus.BLOCKED;
      blockReason?: string;
    },
  ) {
    if (![AgentStatus.ACTIVE, AgentStatus.BLOCKED].includes(body.status)) {
      throw new Error("Backoffice status toggle only supports `active` and `blocked`.");
    }

    return this.backofficeService.updateAgentStatus(
      agentId,
      body.status,
      body.blockReason,
    );
  }

  @Patch("/agents/:agentId/visibility")
  async updateAgentVisibility(
    @Param("agentId") agentId: string,
    @Body()
    body: {
      visibility: "private" | "public" | "internal" | "domain-available";
    },
  ) {
    return this.backofficeService.updateAgentVisibility(agentId, body.visibility);
  }

  @Get("/agents/:agentId/domain-template")
  async getAgentDomainTemplate(@Param("agentId") agentId: string) {
    return this.backofficeService.getAgentDomainTemplate(agentId);
  }

  @Patch("/agents/:agentId/domain-template")
  async upsertAgentDomainTemplate(
    @Param("agentId") agentId: string,
    @Body()
    body: {
      icon: string;
      title: string;
      description: string;
      complexity: string;
      useCases: string[];
      dataRequirements?: string | null;
    },
  ) {
    return this.backofficeService.upsertAgentDomainTemplate(agentId, body);
  }

  @Patch("/organizations/:organizationId/build-type")
  async updateOrganizationBuildType(
    @Param("organizationId") organizationId: string,
    @Body() body: { buildType: "none" | "digitwhale" },
  ) {
    return this.backofficeService.updateOrganizationBuildType(
      organizationId,
      body.buildType,
    );
  }

  @Get("/admin-access/users")
  async listAdminAccessUsers() {
    return this.backofficeService.listAdminAccessUsers();
  }

  @Patch("/admin-access/users/:userId")
  async updateAdminAccess(
    @Param("userId") userId: string,
    @Body() body: { isPlatformAdmin: boolean },
  ) {
    return this.backofficeService.setUserPlatformAdmin(
      userId,
      Boolean(body.isPlatformAdmin),
    );
  }
}
