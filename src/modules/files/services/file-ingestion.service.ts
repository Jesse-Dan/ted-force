import crypto from "node:crypto";
import { Autowired, Service } from "fragment-ts";
import { FileResourceType } from "../../../entities/enums/file-resource-type.enum";
import type { StoredFile } from "../../../entities/stored-file.entity";
import { UploadFileDto } from "../dto/upload-file.dto";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileParserService } from "./file-parser.service";
import { ObjectStorageService } from "./object-storage.service";

@Service()
export class FileIngestionService {
  @Autowired()
  private storedFileRepository!: StoredFileRepository;

  @Autowired()
  private fileParserService!: FileParserService;

  @Autowired()
  private objectStorageService!: ObjectStorageService;

  async ingest(payload: UploadFileDto): Promise<StoredFile> {
    const buffer = Buffer.from(payload.base64Content, "base64");
    const format = this.resolveFormat(payload.originalFilename, payload.mimeType);
    const storedFilename = this.buildStoredFilename(payload.originalFilename);
    const parsed = await this.fileParserService.parse({
      filename: payload.originalFilename,
      mimeType: payload.mimeType,
      buffer,
    });
    const uploadedObject = await this.objectStorageService.uploadObject({
      agentId: payload.agentId,
      filename: storedFilename,
      contentType: payload.mimeType,
      body: buffer,
      metadata: {
        originalFilename: payload.originalFilename,
        sessionId: payload.sessionId ?? "",
        uploadedByUserId: payload.uploadedByUserId ?? "",
      },
    });

    return this.storedFileRepository.save({
      agentId: payload.agentId ?? null,
      sessionId: payload.sessionId ?? null,
      originalFilename: payload.originalFilename,
      storedFilename,
      fileUrl: uploadedObject.url,
      publicId: uploadedObject.key,
      format,
      size: buffer.byteLength,
      resourceType: this.resolveResourceType(payload.mimeType, format),
      uploadedByUserId: payload.uploadedByUserId ?? null,
      isActive: true,
      extractedText: parsed.extractedText ?? null,
      metadata: {
        pages: parsed.pages,
        extractedTextPreview: parsed.extractedText?.slice(0, 500),
        parser: parsed.parser,
        custom: {
          mimeType: payload.mimeType ?? null,
          ingestion: "s3-base64",
          bucket: uploadedObject.bucket,
          objectKey: uploadedObject.key,
          checksum: crypto.createHash("sha1").update(buffer).digest("hex"),
        },
      },
    });
  }

  private buildStoredFilename(originalFilename: string): string {
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return `${Date.now()}-${safeName}`;
  }

  private resolveFormat(filename: string, mimeType?: string): string {
    const extension = filename.includes(".")
      ? filename.split(".").pop()?.toLowerCase()
      : undefined;

    if (extension) {
      return extension;
    }

    if (mimeType?.includes("/")) {
      return mimeType.split("/")[1];
    }

    return "bin";
  }

  private resolveResourceType(
    mimeType: string | undefined,
    format: string,
  ): FileResourceType {
    const lowerMime = (mimeType ?? "").toLowerCase();

    if (lowerMime.startsWith("image/")) {
      return FileResourceType.IMAGE;
    }

    if (lowerMime.startsWith("video/")) {
      return FileResourceType.VIDEO;
    }

    if (["png", "jpg", "jpeg", "gif", "webp"].includes(format)) {
      return FileResourceType.IMAGE;
    }

    if (["mp4", "mov", "avi", "webm"].includes(format)) {
      return FileResourceType.VIDEO;
    }

    return FileResourceType.RAW;
  }
}
