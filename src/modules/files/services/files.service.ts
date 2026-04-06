import { Autowired, Service } from "fragment-ts";
import { StoredFile } from "../../../entities/stored-file.entity";
import { LinkConversationFileDto } from "../dto/link-conversation-file.dto";
import { ConversationMessageFileRepository } from "../repositories/conversation-message-file.repository";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { ObjectStorageService } from "./object-storage.service";

@Service()
export class FilesService {
  @Autowired()
  private storedFileRepository!: StoredFileRepository;

  @Autowired()
  private conversationMessageFileRepository!: ConversationMessageFileRepository;

  @Autowired()
  private objectStorageService!: ObjectStorageService;

  async linkConversationFile(payload: LinkConversationFileDto) {
    const conversationMessage =
      await this.conversationMessageFileRepository.findConversationMessageById(
        payload.conversationMessageId,
      );

    if (!conversationMessage) {
      throw new Error(
        `Conversation message ${payload.conversationMessageId} not found.`,
      );
    }

    const storedFile = await this.storedFileRepository.findById(payload.storedFileId);

    if (!storedFile) {
      throw new Error(`Stored file ${payload.storedFileId} not found.`);
    }

    return this.conversationMessageFileRepository.save({
      conversationMessageId: conversationMessage.id,
      conversationMessage,
      storedFileId: storedFile.id,
      storedFile,
      attachmentLabel: payload.attachmentLabel ?? null,
    });
  }

  async listByAgent(agentId: string) {
    return this.storedFileRepository.findByAgentId(agentId);
  }

  async listBySession(sessionId: string) {
    return this.storedFileRepository.findBySessionId(sessionId);
  }

  async getFile(fileId: string) {
    return this.requireFile(fileId);
  }

  async getFileAccessUrl(fileId: string) {
    const storedFile = await this.requireFile(fileId);
    return this.buildAccessPayload(storedFile);
  }

  async getFileDownload(fileId: string) {
    const storedFile = await this.requireFile(fileId);
    return this.buildAccessPayload(storedFile, true);
  }

  async searchFiles(term: string) {
    return this.storedFileRepository.search(term);
  }

  async getExpiredFiles() {
    return this.storedFileRepository.findExpired(new Date());
  }

  async deleteFile(fileId: string) {
    const existing = await this.storedFileRepository.findById(fileId);
    if (!existing) {
      throw new Error(`Stored file ${fileId} not found.`);
    }

    await this.objectStorageService.deleteObject(existing.publicId);
    await this.storedFileRepository.deleteById(fileId);
    return { id: fileId, deleted: true };
  }

  async updateFileState(fileId: string, isActive: boolean) {
    const existing = await this.requireFile(fileId);

    return this.storedFileRepository.save({
      ...existing,
      isActive,
    });
  }

  private async requireFile(fileId: string) {
    const storedFile = await this.storedFileRepository.findById(fileId);
    if (!storedFile) {
      throw new Error(`Stored file ${fileId} not found.`);
    }

    return storedFile;
  }

  private buildAccessPayload(storedFile: StoredFile, download = false) {
    const objectUrl = this.objectStorageService.resolveObjectUrl(storedFile.publicId);
    return {
      id: storedFile.id,
      filename: storedFile.originalFilename,
      size: storedFile.size,
      contentType: storedFile.format,
      download: Boolean(download),
      objectKey: storedFile.publicId,
      bucket: this.objectStorageService.getBucketName(),
      fileUrl: storedFile.fileUrl || objectUrl,
      accessUrl: objectUrl,
      downloadUrl: objectUrl,
      proxyUrl: `/files/${storedFile.id}/download`,
      expiresAt: storedFile.expiresAt,
      isExpired: Boolean(
        storedFile.expiresAt && new Date(storedFile.expiresAt) < new Date(),
      ),
    };
  }
}
