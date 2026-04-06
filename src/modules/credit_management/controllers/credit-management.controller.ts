import { Autowired, Controller, Get, Param } from "fragment-ts";
import { UseOrganizationRequestPipeline } from "../../../common/decorators/use-organization-request-pipeline.decorator";
import { CreditManagementService } from "../services/credit-management.service";

@UseOrganizationRequestPipeline()
@Controller("/credit-management")
export class CreditManagementController {
  @Autowired()
  private creditManagementService!: CreditManagementService;

  @Get("/organizations/:organizationId/summary")
  async getSummary(@Param("organizationId") organizationId: string) {
    return this.creditManagementService.getOrganizationCreditSummary(organizationId);
  }

  @Get("/organizations/:organizationId/history")
  async getHistory(@Param("organizationId") organizationId: string) {
    return this.creditManagementService.getOrganizationBillingHistory(organizationId);
  }

  @Get("/organizations/:organizationId/usage")
  async getUsage(@Param("organizationId") organizationId: string) {
    return this.creditManagementService.getOrganizationUsage(organizationId);
  }
}
