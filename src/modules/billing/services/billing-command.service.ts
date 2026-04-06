import { Autowired, Service } from "fragment-ts";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { CreateBillingLedgerEntryDto } from "../dto/create-billing-ledger-entry.dto";
import { CreateBillingReportDto } from "../dto/create-billing-report.dto";
import { BillingLedgerRepository } from "../repositories/billing-ledger.repository";
import { BillingReportRepository } from "../repositories/billing-report.repository";

@Service()
export class BillingCommandService {
  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private billingLedgerRepository!: BillingLedgerRepository;

  @Autowired()
  private billingReportRepository!: BillingReportRepository;

  async createLedgerEntry(organizationId: string, payload: CreateBillingLedgerEntryDto) {
    await this.ensureOrganization(organizationId);

    return this.billingLedgerRepository.save({
      organizationId,
      billingRunKey: payload.billingRunKey.trim(),
      reportBillStatus: payload.reportBillStatus ?? null,
      triedAt: payload.triedAt ? new Date(payload.triedAt) : null,
    });
  }

  async createReport(organizationId: string, payload: CreateBillingReportDto) {
    await this.ensureOrganization(organizationId);

    return this.billingReportRepository.save({
      organizationId,
      item: payload.item,
      billingRunKey: payload.billingRunKey.trim(),
      comment: payload.comment.trim(),
    });
  }

  private async ensureOrganization(organizationId: string) {
    const organization = await this.organizationRepository.findById(organizationId);

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }
  }
}
