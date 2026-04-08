import { Autowired, Body, Controller, Get, Param, Post, Query } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { ExecuteConnectorOperationDto } from "../dto/execute-connector-operation.dto";
import { ConnectorsService } from "../services/connectors.service";

@UseRequestContextPipeline()
@Controller("/api/public/connectors")
export class PublicConnectorsController {
  @Autowired()
  private connectorsService!: ConnectorsService;

  @Get()
  async list(@Query("agentId") agentId: string) {
    return this.connectorsService.listPublicConnectors(agentId);
  }

  @Get("/:id")
  async detail(
    @Param("id") id: string,
    @Query("agentId") agentId: string,
  ) {
    return this.connectorsService.getPublicConnector(agentId, id);
  }

  @Post("/:id/call")
  async call(
    @Param("id") id: string,
    @Body() body: ExecuteConnectorOperationDto,
  ) {
    if (!body.agentId?.trim()) {
      throw new Error("agentId is required.");
    }

    return this.connectorsService.executePublicConnectorCall({
      agentId: body.agentId.trim(),
      connectorId: id,
      operationId: body.operation_id,
      parameters: body.parameters ?? {},
      sessionId: body.sessionId,
    });
  }
}
