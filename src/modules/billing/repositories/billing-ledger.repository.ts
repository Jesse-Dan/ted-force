import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { BillingLedgerEntry } from "../../../entities/billing-ledger-entry.entity";

@FragmentRepository()
export class BillingLedgerRepository {
  @InjectRepository(BillingLedgerEntry)
  private billingLedgerRepository!: Repository<BillingLedgerEntry>;

  async findByOrganizationId(organizationId: string): Promise<BillingLedgerEntry[]> {
    return this.billingLedgerRepository.find({
      where: { organizationId },
      order: {
        createdAt: "DESC",
      },
      take: 100,
    });
  }

  async save(input: Partial<BillingLedgerEntry>): Promise<BillingLedgerEntry> {
    return this.billingLedgerRepository.save(input);
  }
}
