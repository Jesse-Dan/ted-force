import {
  Autowired,
  Body,
  Controller,
  Delete,
  FragmentMiddleware,
  Get,
  Param,
  Patch,
  Post,
} from "fragment-ts";
import { UseManagedRequestPipeline } from "../../../common/decorators/use-managed-request-pipeline.decorator";
import { PlatformAdminMiddleware } from "../../../common/middlewares/platform-admin.middleware";
import { CreatePlatformConnectorDto } from "../dto/create-platform-connector.dto";
import { UpdatePlatformConnectorDto } from "../dto/update-platform-connector.dto";
import { ConnectorsService } from "../services/connectors.service";

@UseManagedRequestPipeline()
@FragmentMiddleware(PlatformAdminMiddleware, { order: -70 })
@Controller("/backoffice/platform-connectors")
export class PlatformConnectorsAdminController {
  @Autowired()
  private connectorsService!: ConnectorsService;

  @Get()
  async listAll() {
    return this.connectorsService.listBackofficePlatformConnectors();
  }

  @Post()
  async create(@Body() body: CreatePlatformConnectorDto) {
    return this.connectorsService.createBackofficePlatformConnector(body);
  }

  @Patch("/:connectorId")
  async update(
    @Param("connectorId") connectorId: string,
    @Body() body: UpdatePlatformConnectorDto,
  ) {
    return this.connectorsService.updateBackofficePlatformConnector(
      connectorId,
      body,
    );
  }

  @Delete("/:connectorId")
  async delete(@Param("connectorId") connectorId: string) {
    return this.connectorsService.deleteBackofficePlatformConnector(connectorId);
  }
}
