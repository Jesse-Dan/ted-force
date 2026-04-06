import { RequiredString, Validate, Validators } from "fragment-ts";
import { BillableItem } from "../../../entities/enums/billable-item.enum";

export class CreateBillingReportDto {
  @Validate({ name: "item" })
  @Validators.IsIn(Object.values(BillableItem))
  item!: BillableItem;

  @RequiredString(1, { name: "billingRunKey", required: true })
  billingRunKey!: string;

  @RequiredString(1, { name: "comment", required: true })
  comment!: string;
}
