import { RequiredString, Validate, Validators } from "fragment-ts";

export class ConnectGitRepositoryDto {
  @RequiredString(1, { name: "provider", required: true })
  provider!: string;

  @RequiredString(1, { name: "repositoryUrl", required: true })
  repositoryUrl!: string;

  @Validate({ name: "githubLogin" })
  @Validators.IsOptional()
  @Validators.IsString()
  githubLogin?: string;

  @Validate({ name: "githubAvatarUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  githubAvatarUrl?: string;

  @Validate({ name: "repoName" })
  @Validators.IsOptional()
  @Validators.IsString()
  repoName?: string;

  @Validate({ name: "defaultBranch" })
  @Validators.IsOptional()
  @Validators.IsString()
  defaultBranch?: string;

  @Validate({ name: "installationType" })
  @Validators.IsOptional()
  @Validators.IsString()
  installationType?: string;

  @Validate({ name: "accessToken" })
  @Validators.IsOptional()
  @Validators.IsString()
  accessToken?: string;

  @Validate({ name: "refreshToken" })
  @Validators.IsOptional()
  @Validators.IsString()
  refreshToken?: string;

  @Validate({ name: "username" })
  @Validators.IsOptional()
  @Validators.IsString()
  username?: string;

  @Validate({ name: "installationId" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  installationId?: number;

  @Validate({ name: "appInstallationUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  appInstallationUrl?: string;

  @Validate({ name: "tokenExpiresAt" })
  @Validators.IsOptional()
  @Validators.IsString()
  tokenExpiresAt?: string;

  @Validate({ name: "appInstallations" })
  @Validators.IsOptional()
  appInstallations?: Array<Record<string, unknown>>;

  @Validate({ name: "visibility" })
  @Validators.IsOptional()
  @Validators.IsString()
  visibility?: string;

  @Validate({ name: "autoCreateRepository" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  autoCreateRepository?: boolean;

  @Validate({ name: "commitMode" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitMode?: string;
}
