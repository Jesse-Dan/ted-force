import { Autowired, Controller, Get, Param } from 'fragment-ts';
import { AgentToolService } from '../services/agent-tool.service';

@Controller('/api/v2/agents/:agentId/tools')
export class AgentToolController {
  @Autowired()
  private toolService!: AgentToolService;

  @Get('/')
  getTools(@Param('agentId') agentId: string) {
    const tools = this.toolService.list(agentId);

    return {
      data: tools,
      meta: {
        total: tools.length,
      },
    };
  }

  @Get('/bundle')
  getToolBundle(@Param('agentId') agentId: string) {
    return {
      data: this.toolService.getBundle(agentId),
    };
  }
}
