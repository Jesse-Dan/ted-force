import {
  Autowired,
  Body,
  Controller,
  FragmentMiddleware,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
} from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";
import { ConnectorRequestContextMiddleware } from "../middlewares/connector-request-context.middleware";
import { ConnectorsService } from "../services/connectors.service";

@UseRequestContextPipeline()
@FragmentMiddleware(ConnectorRequestContextMiddleware, { order: -80 })
@Controller("/live")
export class LiveConnectorsController {
  @Autowired()
  private connectorsService!: ConnectorsService;

  @Get("/:agentReference/connectors/:connectorSlug")
  async executeGet(
    @Param("agentReference") agentReference: string,
    @Param("connectorSlug") connectorSlug: string,
  ) {
    return this.connectorsService.executeLiveConnector(
      agentReference,
      connectorSlug,
      ConnectorHttpMethod.GET,
      {},
    );
  }

  @Post("/:agentReference/connectors/:connectorSlug")
  async executePost(
    @Param("agentReference") agentReference: string,
    @Param("connectorSlug") connectorSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.executeLiveConnector(
      agentReference,
      connectorSlug,
      ConnectorHttpMethod.POST,
      body,
    );
  }

  @Put("/:agentReference/connectors/:connectorSlug")
  async executePut(
    @Param("agentReference") agentReference: string,
    @Param("connectorSlug") connectorSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.executeLiveConnector(
      agentReference,
      connectorSlug,
      ConnectorHttpMethod.PUT,
      body,
    );
  }

  @Patch("/:agentReference/connectors/:connectorSlug")
  async executePatch(
    @Param("agentReference") agentReference: string,
    @Param("connectorSlug") connectorSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.executeLiveConnector(
      agentReference,
      connectorSlug,
      ConnectorHttpMethod.PATCH,
      body,
    );
  }

  @Delete("/:agentReference/connectors/:connectorSlug")
  async executeDelete(
    @Param("agentReference") agentReference: string,
    @Param("connectorSlug") connectorSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectorsService.executeLiveConnector(
      agentReference,
      connectorSlug,
      ConnectorHttpMethod.DELETE,
      body,
    );
  }
}
