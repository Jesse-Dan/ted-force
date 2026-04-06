import { Autowired, Body, Controller, Get, Param, Post } from "fragment-ts";
import { UseOrganizationRequestPipeline } from "../../../common/decorators/use-organization-request-pipeline.decorator";
import { CreateBillingLedgerEntryDto } from "../dto/create-billing-ledger-entry.dto";
import { CreateBillingReportDto } from "../dto/create-billing-report.dto";
import { BillingCommandService } from "../services/billing-command.service";
import { BillingQueryService } from "../services/billing-query.service";

@UseOrganizationRequestPipeline()
@Controller("/billing")
export class BillingController {
  @Autowired()
  private billingQueryService!: BillingQueryService;

  @Autowired()
  private billingCommandService!: BillingCommandService;

  @Get("/organizations/:organizationId/ledger")
  async getLedger(@Param("organizationId") organizationId: string) {
    return this.billingQueryService.getOrganizationLedger(organizationId);
  }

  @Get("/organizations/:organizationId/reports")
  async getReports(@Param("organizationId") organizationId: string) {
    return this.billingQueryService.getOrganizationReports(organizationId);
  }

  @Get("/organizations/:organizationId/overview")
  async getOverview(@Param("organizationId") organizationId: string) {
    return this.billingQueryService.getOrganizationBillingOverview(organizationId);
  }

  @Get("/history/:organizationId")
  async getBillingHistory(@Param("organizationId") organizationId: string) {
    return this.billingQueryService.getOrganizationReports(organizationId);
  }

  @Post("/organizations/:organizationId/ledger")
  async createLedger(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateBillingLedgerEntryDto,
  ) {
    return this.billingCommandService.createLedgerEntry(organizationId, body);
  }

  @Post("/organizations/:organizationId/reports")
  async createReport(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateBillingReportDto,
  ) {
    return this.billingCommandService.createReport(organizationId, body);
  }
}
