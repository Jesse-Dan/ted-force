import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { BillingReport } from "../../../entities/billing-report.entity";

@FragmentRepository()
export class BillingReportRepository {
  @InjectRepository(BillingReport)
  private billingReportRepository!: Repository<BillingReport>;

  async findByOrganizationId(organizationId: string): Promise<BillingReport[]> {
    return this.billingReportRepository.find({
      where: { organizationId },
      order: {
        createdAt: "DESC",
      },
      take: 100,
    });
  }

  async save(input: Partial<BillingReport>): Promise<BillingReport> {
    return this.billingReportRepository.save(input);
  }
}
