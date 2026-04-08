import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  Response,
} from "fragment-ts";
import { UseOrganizationRequestPipeline } from "../../../common/decorators/use-organization-request-pipeline.decorator";
import { OrganizationRole } from "../../../entities/enums/organization-role.enum";
import { AcceptOrganizationInvitationDto } from "../dto/accept-organization-invitation.dto";
import { CreateOrganizationDto } from "../dto/create-organization.dto";
import { CreateOrganizationInvitationDto } from "../dto/create-organization-invitation.dto";
import { OrganizationService } from "../services/organization.service";

@UseOrganizationRequestPipeline()
@Controller("/organizations")
export class OrganizationController {
  @Autowired()
  private organizationService!: OrganizationService;

  @Get()
  async listOrganizations() {
    return this.organizationService.listOrganizations();
  }

  @Get("/user/:userId")
  async getUserOrganizations(@Param("userId") userId: string) {
    return this.organizationService.getUserOrganizations(userId);
  }

  @Get("/:organizationId")
  async getOrganization(@Param("organizationId") organizationId: string) {
    return this.organizationService.getOrganization(organizationId);
  }

  @Post()
  async createOrganization(@Body() body: CreateOrganizationDto) {
    return this.organizationService.createOrganization(body);
  }

  @Patch("/:organizationId")
  async updateOrganization(
    @Param("organizationId") organizationId: string,
    @Body() body: Partial<CreateOrganizationDto>,
  ) {
    return this.organizationService.updateOrganization(organizationId, body);
  }

  @Delete("/:organizationId")
  async deleteOrganization(@Param("organizationId") organizationId: string) {
    return this.organizationService.deleteOrganization(organizationId);
  }

  @Get("/:organizationId/members")
  async getMembers(@Param("organizationId") organizationId: string) {
    return this.organizationService.getOrganizationMembers(organizationId);
  }

  @Get("/:organizationId/invitations")
  async getInvitations(@Param("organizationId") organizationId: string) {
    return this.organizationService.getOrganizationInvitations(organizationId);
  }

  @Post("/:organizationId/invitations")
  async createInvitation(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateOrganizationInvitationDto,
  ) {
    return this.organizationService.createOrganizationInvitation(organizationId, body);
  }

  @Delete("/invitations/:invitationId")
  async revokeInvitation(@Param("invitationId") invitationId: string) {
    return this.organizationService.revokeInvitation(invitationId);
  }

  @Get("/invitations/email/:email")
  async getInvitationsByEmail(@Param("email") email: string) {
    return this.organizationService.getInvitationsByEmail(email);
  }

  @Post("/verify-invitation")
  async verifyInvitation(@Body() body: { invitationId: string; email: string }) {
    return this.organizationService.verifyInvitation(body.invitationId, body.email);
  }

  @Post("/:organizationId/members")
  async addUser(
    @Param("organizationId") organizationId: string,
    @Body() body: { userId: string; role?: OrganizationRole },
  ) {
    return this.organizationService.addUserToOrganization(
      organizationId,
      body.userId,
      body.role,
    );
  }

  @Get("/:organizationId/members/:userId")
  async getMembership(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
  ) {
    return this.organizationService.getMembership(organizationId, userId);
  }

  @Delete("/:organizationId/members/:userId")
  async removeUser(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
  ) {
    return this.organizationService.removeUserFromOrganization(organizationId, userId);
  }

  @Patch("/:organizationId/members/:userId/role")
  async updateRole(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Body() body: { role: OrganizationRole },
  ) {
    return this.organizationService.updateUserRole(organizationId, userId, body.role);
  }

  @Post("/:organizationId/transfer-ownership")
  async transferOwnership(
    @Param("organizationId") organizationId: string,
    @Body() body: { targetUserId: string; previousOwnerUserId?: string },
  ) {
    return this.organizationService.transferOwnership(
      organizationId,
      body.targetUserId,
      body.previousOwnerUserId,
    );
  }

  @Post("/:organizationId/access")
  async setLastAccessedOrganization(
    @Param("organizationId") organizationId: string,
    @Body() body: { userId: string },
  ) {
    return this.organizationService.setLastAccessedOrganization(
      body.userId,
      organizationId,
    );
  }

  @Post("/invitations/:invitationId/accept")
  async acceptInvitation(
    @Param("invitationId") invitationId: string,
    @Body() body: AcceptOrganizationInvitationDto,
    @Res() response: Response,
  ) {
    await this.organizationService.acceptInvitationWithSse(
      invitationId,
      body,
      response,
    );
    return response;
  }
}
