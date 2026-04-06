import { RequiredString, Validate, Validators } from "fragment-ts";

export class CreateBillingLedgerEntryDto {
  @RequiredString(1, { name: "billingRunKey", required: true })
  billingRunKey!: string;

  @Validate({ name: "reportBillStatus" })
  @Validators.IsOptional()
  @Validators.IsObject()
  reportBillStatus?: Record<string, unknown>;

  @Validate({ name: "triedAt" })
  @Validators.IsOptional()
  @Validators.IsDateString()
  triedAt?: string;
}
