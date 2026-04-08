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
import { UseManagedRequestPipeline } from "../../../common/decorators/use-managed-request-pipeline.decorator";
import { ActivatePlatformConnectorDto } from "../dto/activate-platform-connector.dto";
import { CreateConnectorDto } from "../dto/create-connector.dto";
import { ExecuteConnectorOperationDto } from "../dto/execute-connector-operation.dto";
import { ImportOpenApiConnectorDto } from "../dto/import-openapi-connector.dto";
import { ImportPostmanConnectorsDto } from "../dto/import-postman-connectors.dto";
import { UpdateConnectorDto } from "../dto/update-connector.dto";
import { ConnectorsService } from "../services/connectors.service";

@UseManagedRequestPipeline()
@Controller("/api/connectors")
export class ConnectorsController {
  @Autowired()
  private connectorsService!: ConnectorsService;

  @Get()
  async list(
    @Query("agentId") agentId: string,
    @Query("liveOnly") liveOnly?: string,
  ) {
    return this.connectorsService.listAgentConnectors(agentId, {
      liveOnly: String(liveOnly ?? "").toLowerCase() === "true",
    });
  }

  @Post()
  async create(@Body() body: CreateConnectorDto) {
    return this.connectorsService.createConnector(body.agentId, body);
  }

  @Get("/:id")
  async get(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
  ) {
    return this.connectorsService.getConnector(agentId, id);
  }

  @Patch("/:id")
  async update(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
    @Body() body: UpdateConnectorDto,
  ) {
    return this.connectorsService.updateConnector(agentId, id, body);
  }

  @Delete("/:id")
  async remove(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
  ) {
    return this.connectorsService.deleteConnector(agentId, id);
  }

  @Get("/:id/schema")
  async schema(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
  ) {
    return this.connectorsService.getConnectorSchema(agentId, id);
  }

  @Get("/:id/graph")
  async graph(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
  ) {
    return this.connectorsService.getConnectorGraph(agentId, id);
  }

  @Get("/:id/logs")
  async logs(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
    @Query("limit") limit?: string,
  ) {
    return this.connectorsService.getConnectorLogs(
      agentId,
      id,
      Number(limit ?? 50),
    );
  }

  @Post("/:id/call")
  async call(
    @Param("id") id: string,
    @Body() body: ExecuteConnectorOperationDto,
  ) {
    if (!body.agentId?.trim()) {
      throw new Error("agentId is required.");
    }
    return this.connectorsService.executeConnectorCall({
      agentId: body.agentId.trim(),
      connectorId: id,
      operationId: body.operation_id,
      parameters: body.parameters ?? {},
      sessionId: body.sessionId,
    });
  }

  @Post("/import/openapi")
  async importOpenApi(@Body() body: ImportOpenApiConnectorDto) {
    return this.connectorsService.importOpenApiConnector(body);
  }

  @Post("/import/postman")
  async importPostman(@Body() body: ImportPostmanConnectorsDto) {
    return this.connectorsService.importPostmanConnectors({
      agentId: body.agentId,
      name: body.name,
      description: body.description,
      collectionJson: body.collectionJson,
      collectionObject: body.collectionObject,
      isLive: body.isLive,
      isPublic: body.isPublic,
    });
  }

  @Get("/template/postman")
  async getPostmanTemplate() {
    return this.connectorsService.getPostmanTemplate();
  }

  @Get("/platform")
  async listPlatformConnectors() {
    return this.connectorsService.listPlatformConnectors();
  }

  @Post("/platform/:platformConnectorId/activate")
  async activatePlatformConnector(
    @Param("platformConnectorId") platformConnectorId: string,
    @Body() body: ActivatePlatformConnectorDto,
  ) {
    return this.connectorsService.activatePlatformConnector(
      platformConnectorId,
      body,
    );
  }

  // Backward-compatible routes used by current workspace screens while the UI migration lands.
  @Get("/agents/:agentId")
  async listByAgent(@Param("agentId") agentId: string) {
    return this.connectorsService.listAgentConnectors(agentId);
  }

  @Get("/agents/:agentId/platform-tools")
  async listPlatformTools(@Param("agentId") agentId: string) {
    return this.connectorsService.listAgentConnectorPlatformTools(agentId);
  }

  @Post("/agents/:agentId")
  async createByAgent(
    @Param("agentId") agentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.createConnector(agentId, body as any);
  }

  @Patch("/agents/:agentId/:connectorId")
  async updateByAgent(
    @Param("agentId") agentId: string,
    @Param("connectorId") connectorId: string,
    @Body() body: UpdateConnectorDto,
  ) {
    return this.connectorsService.updateConnector(agentId, connectorId, body);
  }

  @Delete("/agents/:agentId/:connectorId")
  async deleteByAgent(
    @Param("agentId") agentId: string,
    @Param("connectorId") connectorId: string,
  ) {
    return this.connectorsService.deleteConnector(agentId, connectorId);
  }

  @Post("/agents/:agentId/import/postman")
  async importPostmanByAgent(
    @Param("agentId") agentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.importPostmanConnectors({
      ...(body as any),
      agentId,
    });
  }
}
