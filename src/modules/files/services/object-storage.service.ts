import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Service } from "fragment-ts";

type UploadObjectInput = {
  agentId?: string | null;
  filename: string;
  contentType?: string;
  body: Buffer;
  metadata?: Record<string, string>;
};

type UploadObjectResult = {
  bucket: string;
  key: string;
  url: string;
};

@Service()
export class ObjectStorageService {
  private readonly bucket = process.env.MINIO_BUCKET_NAME || "tuul";
  private readonly endpoint =
    process.env.MINIO_SERVER_URL || "https://apps-verity-drive.ckugq3.easypanel.host";
  private readonly client = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint: this.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || "admin",
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "password",
    },
  });

  async uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
    const key = this.buildKey(input.agentId, input.filename);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType || "application/octet-stream",
        Metadata: input.metadata,
      }),
    );

    return {
      bucket: this.bucket,
      key,
      url: this.buildUrl(key),
    };
  }

  async deleteObject(key?: string | null): Promise<void> {
    if (!key) {
      return;
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getBucketName(): string {
    return this.bucket;
  }

  resolveObjectUrl(key?: string | null): string {
    if (!key) {
      return "";
    }

    return this.buildUrl(key);
  }

  private buildKey(agentId: string | null | undefined, filename: string): string {
    const scopedAgentId = agentId?.trim() || "unassigned";
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return `agent-uploads/${scopedAgentId}/${randomUUID()}-${safeFilename}`;
  }

  private buildUrl(key: string): string {
    return `${this.endpoint.replace(/\/+$/, "")}/${this.bucket}/${key}`;
  }
}
