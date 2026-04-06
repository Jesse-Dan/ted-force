import { Autowired, Service } from "fragment-ts";
import { BillingLedgerRepository } from "../repositories/billing-ledger.repository";
import { BillingReportRepository } from "../repositories/billing-report.repository";
import { BillingUsageService } from "./billing-usage.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";

@Service()
export class BillingQueryService {
  @Autowired()
  private billingLedgerRepository!: BillingLedgerRepository;

  @Autowired()
  private billingReportRepository!: BillingReportRepository;

  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private billingUsageService!: BillingUsageService;

  async getOrganizationLedger(organizationId: string) {
    return this.billingLedgerRepository.findByOrganizationId(organizationId);
  }

  async getOrganizationReports(organizationId: string) {
    return this.billingReportRepository.findByOrganizationId(organizationId);
  }

  async getOrganizationBillingOverview(organizationId: string) {
    const organization = await this.organizationRepository.findById(organizationId);

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    const [ledger, reports, usage] = await Promise.all([
      this.billingLedgerRepository.findByOrganizationId(organizationId),
      this.billingReportRepository.findByOrganizationId(organizationId),
      this.billingUsageService.getUsage(organization),
    ]);

    return {
      organizationId,
      plan: organization.plan,
      health: organization.healthRecord ?? null,
      usage,
      latestLedgerEntry: ledger[0] ?? null,
      latestReports: reports.slice(0, 20),
      ledger,
    };
  }
}
