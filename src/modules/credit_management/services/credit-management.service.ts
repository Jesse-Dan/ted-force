import { Autowired, Service } from "fragment-ts";
import { CreditManagementRepository } from "../repositories/credit-management.repository";

@Service()
export class CreditManagementService {
  @Autowired()
  private creditManagementRepository!: CreditManagementRepository;

  async getOrganizationCreditSummary(organizationId: string) {
    const ledger = await this.creditManagementRepository.findLedgerByOrganizationId(
      organizationId,
    );
    const reports = await this.creditManagementRepository.findReportsByOrganizationId(
      organizationId,
    );
    const tokenUsage = await this.creditManagementRepository.findTokenUsageByRunIds(
      ledger.map((entry) => entry.billingRunKey),
    );

    const totalUsableTokens = tokenUsage.reduce(
      (sum, item) => sum + (item.usableTokens ?? 0),
      0,
    );
    const remainingTokens = tokenUsage.reduce(
      (sum, item) => sum + (item.availableTokensAfter ?? 0),
      0,
    );

    return {
      organizationId,
      ledgerCount: ledger.length,
      reportCount: reports.length,
      tokenSessions: tokenUsage.length,
      totals: {
        usableTokens: totalUsableTokens,
        remainingTokens,
      },
      recentLedger: ledger.slice(0, 10),
      recentReports: reports.slice(0, 10),
    };
  }

  async getOrganizationBillingHistory(organizationId: string) {
    const summary = await this.getOrganizationCreditSummary(organizationId);

    return {
      organizationId,
      history: {
        ledger: summary.recentLedger,
        reports: summary.recentReports,
      },
      totals: summary.totals,
    };
  }

  async getOrganizationUsage(organizationId: string) {
    const ledger = await this.creditManagementRepository.findLedgerByOrganizationId(
      organizationId,
    );
    const tokenUsage = await this.creditManagementRepository.findTokenUsageByRunIds(
      ledger.map((entry) => entry.billingRunKey),
    );

    return {
      organizationId,
      sessions: tokenUsage.length,
      usage: tokenUsage,
    };
  }
}
