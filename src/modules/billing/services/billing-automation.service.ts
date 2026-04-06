import { Autowired, Service } from "fragment-ts";
import { OrganizationHealthStatus } from "../../../entities/enums/organization-health-status.enum";
import { OrganizationStrikeStatus } from "../../../entities/enums/organization-strike-status.enum";
import { OrganizationPlan } from "../../../entities/enums/organization-plan.enum";
import { BillableItem } from "../../../entities/enums/billable-item.enum";
import { BillingUsageService } from "./billing-usage.service";
import { OrganizationHealthRepository } from "../../organization/repositories/organization-health.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { BillingLedgerRepository } from "../repositories/billing-ledger.repository";
import { BillingReportRepository } from "../repositories/billing-report.repository";

@Service()
export class BillingAutomationService {
  private static readonly billingRates: Record<
    BillableItem,
    { hourlyCRD: number; included: number | "~ free"; billEnabled: boolean }
  > = {
    [BillableItem.PUBLIC_INSTANCES]: { hourlyCRD: 0, included: "~ free", billEnabled: false },
    [BillableItem.CREATED_INSTANCES]: { hourlyCRD: 1.389, included: 1, billEnabled: true },
    [BillableItem.TOOLS]: { hourlyCRD: 0.278, included: 2, billEnabled: true },
    [BillableItem.DATASOURCES]: { hourlyCRD: 1.389, included: 1, billEnabled: true },
    [BillableItem.MCP_SERVERS]: { hourlyCRD: 0.278, included: 1, billEnabled: true },
    [BillableItem.SEATS]: { hourlyCRD: 0.417, included: 1, billEnabled: true },
    [BillableItem.AGENTS]: { hourlyCRD: 0.694, included: 1, billEnabled: true },
    [BillableItem.AGENT_ASSETS]: { hourlyCRD: 0.139, included: 2, billEnabled: true },
    [BillableItem.AGENT_RESOURCES]: { hourlyCRD: 0.028, included: 5, billEnabled: true },
    [BillableItem.VISUAL_INPUT]: { hourlyCRD: 4.167, included: 0, billEnabled: false },
    [BillableItem.AUDIO_INPUT]: { hourlyCRD: 1.389, included: 0, billEnabled: false },
    [BillableItem.ENV_VARS]: { hourlyCRD: 0.028, included: 5, billEnabled: true },
    [BillableItem.MEMORY_AND_AWARENESS]: { hourlyCRD: 0.003, included: 100, billEnabled: true },
    [BillableItem.AI_HELPER]: { hourlyCRD: 50, included: 2, billEnabled: false },
  };

  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private billingUsageService!: BillingUsageService;

  @Autowired()
  private organizationHealthRepository!: OrganizationHealthRepository;

  @Autowired()
  private billingLedgerRepository!: BillingLedgerRepository;

  @Autowired()
  private billingReportRepository!: BillingReportRepository;

  async runBillingCycle() {
    const organizations = await this.organizationRepository.findAllForBilling();
    const processed: string[] = [];

    for (const organization of organizations) {
      const usage = await this.billingUsageService.getUsage(organization);
      const generatedAt = new Date();
      const billingRunKey = `BRK_${organization.id}_${generatedAt.getTime()}`;
      const report = Object.values(BillableItem)
        .filter((item) => BillingAutomationService.billingRates[item].billEnabled)
        .map((item) => {
          const rate = BillingAutomationService.billingRates[item];
          const units = usage[item] ?? 0;
          const included = organization.plan === OrganizationPlan.FREE ? rate.included : 0;
          const billableUnits =
            included === "~ free"
              ? 0
              : Math.max(0, units - Number(included || 0));

          return {
            item,
            units,
            billableUnits,
            hourlyRate: rate.hourlyCRD,
            hourlyCost: Number((billableUnits * rate.hourlyCRD).toFixed(3)),
            included,
            status: "SUCCESS",
            comment: "Automated v2 billing cycle snapshot.",
          };
        });

      await this.billingLedgerRepository.save({
        organizationId: organization.id,
        billingRunKey,
        triedAt: generatedAt,
        reportBillStatus: {
          items: report,
        },
      });

      await this.billingReportRepository.save({
        organizationId: organization.id,
        item: BillableItem.AGENTS,
        billingRunKey,
        comment: `Processed usage snapshot for ${Object.keys(usage).length} billable items.`,
      });

      processed.push(organization.id);
    }

    return {
      processedCount: processed.length,
      processedOrganizationIds: processed,
      timestamp: new Date().toISOString(),
    };
  }

  async runDebtRecoveryCycle() {
    const organizations = await this.organizationRepository.findAllForBilling();
    const recovered: string[] = [];

    for (const organization of organizations) {
      const health = await this.organizationHealthRepository.findByOrganizationId(
        organization.id,
      );

      if (!health || health.totalOwed <= 0) {
        continue;
      }

      await this.organizationHealthRepository.save({
        ...health,
        strike:
          health.totalOwed > 0
            ? OrganizationStrikeStatus.ONE
            : OrganizationStrikeStatus.NONE,
        health:
          health.totalOwed > 0
            ? OrganizationHealthStatus.DOWN
            : OrganizationHealthStatus.UP,
        message:
          health.totalOwed > 0
            ? "Outstanding billing balance requires attention."
            : "Debt recovered successfully.",
      });

      recovered.push(organization.id);
    }

    return {
      reviewedCount: organizations.length,
      affectedOrganizationIds: recovered,
      timestamp: new Date().toISOString(),
    };
  }

  async syncOrganizationHealth() {
    const organizations = await this.organizationRepository.findAllForBilling();
    const synced: string[] = [];

    for (const organization of organizations) {
      const existing = await this.organizationHealthRepository.findByOrganizationId(
        organization.id,
      );
      const totalOwed = existing?.totalOwed ?? 0;
      const health =
        totalOwed > 0 ? OrganizationHealthStatus.DOWN : OrganizationHealthStatus.UP;
      const strike =
        totalOwed > 0 ? OrganizationStrikeStatus.ONE : OrganizationStrikeStatus.NONE;

      await this.organizationHealthRepository.save({
        id: existing?.id,
        organizationId: organization.id,
        totalOwed,
        totalPaid: existing?.totalPaid ?? 0,
        health,
        strike,
        message:
          totalOwed > 0
            ? "Health synced from outstanding balance."
            : "Organization is healthy.",
      });

      synced.push(organization.id);
    }

    return {
      syncedCount: synced.length,
      organizationIds: synced,
      timestamp: new Date().toISOString(),
    };
  }
}
