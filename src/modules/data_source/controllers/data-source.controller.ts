import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { CreateDataSourceDto } from "../dto/create-data-source.dto";
import { UpdateDataSourceDto } from "../dto/update-data-source.dto";
import { DataSourceCommandService } from "../services/data-source-command.service";
import { DataSourceQueryService } from "../services/data-source-query.service";

@UseAgentManagementPipeline()
@Controller("/data-source")
export class DataSourceController {
  @Autowired()
  private dataSourceQueryService!: DataSourceQueryService;

  @Autowired()
  private dataSourceCommandService!: DataSourceCommandService;

  @Get("/:agentId")
  async getAgentDataSources(@Param("agentId") agentId: string) {
    return this.dataSourceQueryService.getAgentDataSources(agentId);
  }

  @Post("/:agentId")
  async createDataSource(
    @Param("agentId") agentId: string,
    @Body() body: CreateDataSourceDto,
  ) {
    return this.dataSourceCommandService.createDataSource(agentId, body);
  }

  @Put("/connections/:dataSourceId")
  async updateDataSource(
    @Param("dataSourceId") dataSourceId: string,
    @Body() body: UpdateDataSourceDto,
  ) {
    return this.dataSourceCommandService.updateDataSource(dataSourceId, body);
  }

  @Delete("/connections/:dataSourceId")
  async deleteDataSource(@Param("dataSourceId") dataSourceId: string) {
    return this.dataSourceCommandService.deleteDataSource(dataSourceId);
  }
}
