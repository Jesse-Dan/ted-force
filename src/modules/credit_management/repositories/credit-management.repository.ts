import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { BillingLedgerEntry } from "../../../entities/billing-ledger-entry.entity";
import { BillingReport } from "../../../entities/billing-report.entity";
import { TokenUsageSession } from "../../../entities/token-usage-session.entity";

@FragmentRepository()
export class CreditManagementRepository {
  @InjectRepository(BillingLedgerEntry)
  private ledgerRepository!: Repository<BillingLedgerEntry>;

  @InjectRepository(BillingReport)
  private reportRepository!: Repository<BillingReport>;

  @InjectRepository(TokenUsageSession)
  private tokenUsageRepository!: Repository<TokenUsageSession>;

  async findLedgerByOrganizationId(organizationId: string) {
    return this.ledgerRepository.find({
      where: { organizationId },
      order: { createdAt: "DESC" },
    });
  }

  async findReportsByOrganizationId(organizationId: string) {
    return this.reportRepository.find({
      where: { organizationId },
      order: { createdAt: "DESC" },
    });
  }

  async findTokenUsageByRunIds(runIds: string[]) {
    if (runIds.length === 0) {
      return [];
    }

    return this.tokenUsageRepository.find({
      where: runIds.map((runId) => ({ runId })),
      order: { createdAt: "DESC" },
    });
  }
}
