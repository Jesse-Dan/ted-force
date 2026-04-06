import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { SoftDeletableEntity } from "./base/soft-deletable.entity";
import { FileResourceType } from "./enums/file-resource-type.enum";

export interface StoredFileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  tags?: string[];
  extractedTextPreview?: string;
  parser?: string;
  custom?: Record<string, unknown>;
}

export interface StoredFileTransformations {
  applied: boolean;
  thumbnails?: string[];
  optimized?: boolean;
}

@Entity("stored_files")
export class StoredFile extends SoftDeletableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  @Index()
  agentId?: string | null;

  @ManyToOne(() => Agent, (agent) => agent.files, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  sessionId?: string | null;

  @Column({ name: "original_filename", type: "varchar", length: 255 })
  originalFilename!: string;

  @Column({ name: "stored_filename", type: "varchar", length: 255 })
  storedFilename!: string;

  @Column({ name: "file_url", type: "varchar", length: 2048 })
  fileUrl!: string;

  @Column({ name: "public_id", type: "varchar", length: 255, nullable: true })
  publicId?: string | null;

  @Column({ name: "cloudinary_url", type: "varchar", length: 2048, nullable: true })
  cloudinaryUrl?: string | null;

  @Column({ type: "varchar", length: 64 })
  format!: string;

  @Column({ type: "bigint" })
  size!: number;

  @Column({
    name: "resource_type",
    type: "enum",
    enum: FileResourceType,
    default: FileResourceType.AUTO,
  })
  resourceType!: FileResourceType;

  @Column({ type: "json", nullable: true })
  metadata?: StoredFileMetadata | null;

  @Column({ name: "extracted_text", type: "longtext", nullable: true })
  extractedText?: string | null;

  @Column({ type: "json", nullable: true })
  transformations?: StoredFileTransformations | null;

  @Column({ default: 0 })
  downloads!: number;

  @Column({ default: 0 })
  views!: number;

  @Column({ name: "uploaded_by_user_id", type: "varchar", length: 255, nullable: true })
  uploadedByUserId?: string | null;

  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt?: Date | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
}
