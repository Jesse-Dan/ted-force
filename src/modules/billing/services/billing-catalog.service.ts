import { Service } from "fragment-ts";

type BillingFrequency = "perHourContinuous" | "perEvent" | "perActiveHour";

type BillingMetric = {
  included: number | null;
  costPerUnit: number;
  frequency?: BillingFrequency;
};

type BillingPlan = {
  id: string;
  appId: string;
  name: string;
  description: string;
  price: string;
  durationDays: number;
  allowTrial: boolean;
  popular: boolean;
  trialDays: number;
  allowAddonPrice: boolean;
  createdAt: string;
  updatedAt: string;
  creditPerMonth: number;
  customPricing: string;
  features: Array<{
    id: string;
    appId: string;
    name: string;
    description?: string;
    createdAt: string;
  }>;
  billing: Record<string, BillingMetric>;
  previewMonthlyCost: number;
};

const HOURS_PER_MONTH = 720;
const CRD_PER_DOLLAR = 100;
const APP_ID = "tuul-platform-id";

@Service()
export class BillingCatalogService {
  private convertMonthlyDollarsToCrdPerHour(dollarsPerMonth: number): number {
    return (dollarsPerMonth * CRD_PER_DOLLAR) / HOURS_PER_MONTH;
  }

  private convertHourlyDollarsToCrdPerHour(dollarsPerHour: number): number {
    return dollarsPerHour * CRD_PER_DOLLAR;
  }

  private calculateMetricExtraCost(metric: BillingMetric, usage: number): number {
    const extra = Math.max(0, usage - (metric.included ?? 0));

    if (metric.frequency === "perEvent" || metric.frequency === "perActiveHour") {
      return extra * metric.costPerUnit;
    }

    return extra * metric.costPerUnit * HOURS_PER_MONTH;
  }

  private calculatePlanMonthlyCost(
    billing: Record<string, BillingMetric>,
    usage: Record<string, number>,
  ): number {
    return Object.keys(billing).reduce((total, key) => {
      return total + this.calculateMetricExtraCost(billing[key], usage[key] ?? 0);
    }, 0);
  }

  getPublicCatalog() {
    const now = new Date().toISOString();
    const demoUsage = {
      publicInstances: 0,
      createdInstances: 3,
      tools: 2,
      dataSources: 2,
      mcpServers: 2,
      orgSeats: 1,
      orgAgents: 1,
      agentAssets: 2,
      resourcesInAgent: 20,
      visualInputStreams: 0,
      audioInputStreams: 0,
      envVariables: 10,
      memoryAwareness: 100,
      aiHelperHours: 2,
    };

    const freeBilling = {
      publicInstances: { included: 0, costPerUnit: 0, frequency: "perHourContinuous" as const },
      createdInstances: { included: 2, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(10), frequency: "perHourContinuous" as const },
      tools: { included: 2, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(2), frequency: "perHourContinuous" as const },
      dataSources: { included: 1, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(10), frequency: "perHourContinuous" as const },
      mcpServers: { included: 1, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(2), frequency: "perHourContinuous" as const },
      orgSeats: { included: 1, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(3), frequency: "perHourContinuous" as const },
      orgAgents: { included: 1, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(5), frequency: "perHourContinuous" as const },
      agentAssets: { included: 2, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(1), frequency: "perHourContinuous" as const },
      resourcesInAgent: { included: 5, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(0.2), frequency: "perHourContinuous" as const },
      visualInputStreams: { included: 0, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(30), frequency: "perHourContinuous" as const },
      audioInputStreams: { included: 0, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(10), frequency: "perHourContinuous" as const },
      envVariables: { included: 10, costPerUnit: this.convertMonthlyDollarsToCrdPerHour(0.2), frequency: "perHourContinuous" as const },
      memoryAwareness: { included: 0, costPerUnit: 0.02 * CRD_PER_DOLLAR, frequency: "perEvent" as const },
      aiHelperHours: { included: 0, costPerUnit: this.convertHourlyDollarsToCrdPerHour(0.5), frequency: "perActiveHour" as const },
    };

    const paygoBilling = Object.fromEntries(
      Object.entries(freeBilling).map(([key, value]) => [
        key,
        { ...value, included: null },
      ]),
    ) as Record<string, BillingMetric>;

    const customBilling = { ...paygoBilling };

    const plans: BillingPlan[] = [
      {
        id: "plan-free",
        appId: APP_ID,
        name: "Free Tier",
        description: "Ideal for testing and prototypes.",
        price: "0.00",
        durationDays: 36500,
        allowTrial: false,
        popular: false,
        trialDays: 0,
        allowAddonPrice: false,
        createdAt: now,
        updatedAt: now,
        creditPerMonth: 0,
        customPricing: "Starts at 0 CRD/unit/hr",
        features: [],
        billing: freeBilling,
        previewMonthlyCost: Number(this.calculatePlanMonthlyCost(freeBilling, demoUsage).toFixed(2)),
      },
      {
        id: "plan-paygo",
        appId: APP_ID,
        name: "Pay-As-You-Go",
        description: "Scale easily with usage-based billing.",
        price: "0.00",
        durationDays: 30,
        allowTrial: false,
        popular: true,
        trialDays: 0,
        allowAddonPrice: true,
        createdAt: now,
        updatedAt: now,
        creditPerMonth: 0,
        customPricing: "Starts at 0 CRD/unit/hr",
        features: [],
        billing: paygoBilling,
        previewMonthlyCost: Number(this.calculatePlanMonthlyCost(paygoBilling, demoUsage).toFixed(2)),
      },
      {
        id: "plan-custom",
        appId: APP_ID,
        name: "Enterprise",
        description: "Dedicated resources and custom SLAs for large organizations.",
        price: "0.00",
        durationDays: 365,
        allowTrial: false,
        popular: false,
        trialDays: 0,
        allowAddonPrice: false,
        createdAt: now,
        updatedAt: now,
        creditPerMonth: 0,
        customPricing: "Contact Sales",
        features: [],
        billing: customBilling,
        previewMonthlyCost: Number(this.calculatePlanMonthlyCost(customBilling, demoUsage).toFixed(2)),
      },
    ];

    return {
      appId: APP_ID,
      generatedAt: now,
      demoUsage,
      subscription: {
        id: "sub-123",
        planId: "plan-free",
        appId: APP_ID,
        referenceId: "user-ref-id",
        startDate: now,
        endDate: "2099-12-31",
        trial: false,
        active: true,
        autoRenew: true,
        createdAt: now,
        updatedAt: now,
      },
      plans,
    };
  }
}
