import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "fragment-ts";
import { LinkConversationFileDto } from "../dto/link-conversation-file.dto";
import { UploadFileDto } from "../dto/upload-file.dto";
import { FileIngestionService } from "../services/file-ingestion.service";
import { FilesService } from "../services/files.service";

// @UseAgentManagementPipeline()
@Controller("/files")
export class FilesController {
  @Autowired()
  private filesService!: FilesService;

  @Autowired()
  private fileIngestionService!: FileIngestionService;

  @Post("/upload")
  async upload(@Body() body: UploadFileDto) {
    return this.fileIngestionService.ingest(body);
  }

  @Post("/conversation-links")
  async linkConversationFile(@Body() body: LinkConversationFileDto) {
    return this.filesService.linkConversationFile(body);
  }

  @Get("/agents/:agentId")
  async listByAgent(@Param("agentId") agentId: string) {
    return this.filesService.listByAgent(agentId);
  }

  @Get("/sessions/:sessionId")
  async listBySession(@Param("sessionId") sessionId: string) {
    return this.filesService.listBySession(sessionId);
  }

  @Get("/search")
  async search(@Query("q") q: string) {
    return this.filesService.searchFiles(q ?? "");
  }

  @Get("/expired")
  async expired() {
    return this.filesService.getExpiredFiles();
  }

  @Get("/:fileId/url")
  async getFileAccessUrl(@Param("fileId") fileId: string) {
    return this.filesService.getFileAccessUrl(fileId);
  }

  @Get("/:fileId/download")
  async downloadFile(@Param("fileId") fileId: string) {
    return this.filesService.getFileDownload(fileId);
  }

  @Get("/:fileId")
  async getFile(@Param("fileId") fileId: string) {
    return this.filesService.getFile(fileId);
  }

  @Delete("/:fileId")
  async deleteFile(@Param("fileId") fileId: string) {
    return this.filesService.deleteFile(fileId);
  }

  @Patch("/:fileId/state")
  async updateState(
    @Param("fileId") fileId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.filesService.updateFileState(fileId, Boolean(body.isActive));
  }
}
