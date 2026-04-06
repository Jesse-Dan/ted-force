import { Autowired, Service } from "fragment-ts";
import type { StoredFile } from "../../../entities/stored-file.entity";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository";
import { AgentRuntimePersistenceService } from "./agent-runtime-persistence.service";

@Service()
export class AgentRuntimeFileContextService {
  @Autowired()
  private runtimeRepository!: AgentRuntimeRepository;

  @Autowired()
  private runtimePersistence!: AgentRuntimePersistenceService;

  async resolveRequestFiles(fileIds?: string[]): Promise<StoredFile[]> {
    if (!fileIds || fileIds.length === 0) {
      return [];
    }

    return this.runtimeRepository.findFilesByIds(fileIds);
  }

  async linkRequestFilesToMessage(input: {
    conversationMessage: import("../../../entities/agent-conversation-message.entity").AgentConversationMessage;
    fileIds?: string[];
  }): Promise<StoredFile[]> {
    const files = await this.resolveRequestFiles(input.fileIds);

    if (files.length === 0) {
      return [];
    }

    await this.runtimePersistence.linkFilesToConversationMessage({
      conversationMessage: input.conversationMessage,
      files,
    });

    return files;
  }

  async buildConversationFileContext(input: {
    conversationId: string;
    conversationVersionId: string;
  }): Promise<string | undefined> {
    const linkedFiles = await this.runtimeRepository.findLinkedFilesForConversation(
      input.conversationId,
      input.conversationVersionId,
    );

    if (linkedFiles.length === 0) {
      return undefined;
    }

    const lines = linkedFiles.map(({ link, file }, index) => {
      const meta = [
        `name=${file.originalFilename}`,
        `format=${file.format}`,
        `size=${file.size}`,
        file.fileUrl ? `url=${file.fileUrl}` : null,
        file.resourceType ? `resourceType=${file.resourceType}` : null,
        link.attachmentLabel ? `label=${link.attachmentLabel}` : null,
      ]
        .filter(Boolean)
        .join(", ");

      const extractedText = file.extractedText?.trim()
        ? `\nextracted_text=${file.extractedText.trim().slice(0, 4000)}`
        : "";

      return `${index + 1}. ${meta}${extractedText}`;
    });

    return [
      "Linked conversation files are available for this run.",
      "Use them as persistent context without asking the user to resend them.",
      ...lines,
    ].join("\n");
  }
}
