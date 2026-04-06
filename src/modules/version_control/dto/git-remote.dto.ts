import { Validate, Validators } from "fragment-ts";

export class GitRemoteDto {
  @Validate({ name: "enabled" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  enabled?: boolean;

  @Validate({ name: "provider" })
  @Validators.IsOptional()
  @Validators.IsString()
  provider?: string;

  @Validate({ name: "repositoryUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  repositoryUrl?: string;

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

  @Validate({ name: "accessToken" })
  @Validators.IsOptional()
  @Validators.IsString()
  accessToken?: string;

  @Validate({ name: "username" })
  @Validators.IsOptional()
  @Validators.IsString()
  username?: string;

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
