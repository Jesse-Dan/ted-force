import { Autowired, Controller, Get, Param } from 'fragment-ts';
import { AgentService } from '../services/agent.service';

@Controller('/api/v2/agents')
export class AgentController {
  @Autowired()
  private agentService!: AgentService;

  @Get('/')
  getAgents() {
    return {
      data: this.agentService.getAll(),
      meta: {
        total: this.agentService.getAll().length,
      },
    };
  }

  @Get('/:agentId')
  getAgent(@Param('agentId') agentId: string) {
    const agent = this.agentService.getById(agentId);

    return {
      data: agent ?? null,
    };
  }
}
