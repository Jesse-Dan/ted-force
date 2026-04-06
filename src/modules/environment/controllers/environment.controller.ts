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
import { CreateAgentEnvironmentDto } from "../dto/create-agent-environment.dto";
import { UpdateAgentEnvironmentDto } from "../dto/update-agent-environment.dto";
import { EnvironmentService } from "../services/environment.service";

@UseAgentManagementPipeline()
@Controller("/environment")
export class EnvironmentController {
  @Autowired()
  private environmentService!: EnvironmentService;

  @Get("/:agentId")
  async listByAgent(@Param("agentId") agentId: string) {
    return this.environmentService.getAgentEnvironments(agentId);
  }

  @Post("/:agentId")
  async create(
    @Param("agentId") agentId: string,
    @Body() body: CreateAgentEnvironmentDto,
  ) {
    return this.environmentService.createAgentEnvironment(agentId, body);
  }

  @Put("/:environmentVariableId")
  async update(
    @Param("environmentVariableId") environmentVariableId: string,
    @Body() body: UpdateAgentEnvironmentDto,
  ) {
    return this.environmentService.updateAgentEnvironment(environmentVariableId, body);
  }

  @Delete("/:environmentVariableId")
  async delete(@Param("environmentVariableId") environmentVariableId: string) {
    return this.environmentService.deleteAgentEnvironment(environmentVariableId);
  }
}
