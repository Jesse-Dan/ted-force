import {
  CurrencyCode,
  Email,
  Phone,
  RequiredString,
  StrongPassword,
  Url,
  Validate,
} from 'fragment-ts';

export class CreateTestDto {
  @RequiredString(2, { name: 'fullName', required: true })
  name!: string;

  @Email({ name: 'email', required: true })
  email!: string;

  @Url({ name: 'website' })
  website?: string;

  @Phone(undefined, { name: 'phoneNumber' })
  phoneNumber?: string;

  @CurrencyCode({ name: 'currency', required: true })
  currency!: string;

  @StrongPassword({ name: 'password', required: true })
  password!: string;

  @Validate({ name: 'notes' })
  notes?: string;
}
