import { Autowired, Controller, Get, Param } from 'fragment-ts';
import { AgentKnowledgeService } from '../services/agent-knowledge.service';

@Controller('/api/v2/agents/:agentId/knowledge')
export class AgentKnowledgeController {
  @Autowired()
  private knowledgeService!: AgentKnowledgeService;

  @Get('/')
  getKnowledge(@Param('agentId') agentId: string) {
    const items = this.knowledgeService.listByAgent(agentId);

    return {
      data: items,
      meta: {
        total: items.length,
      },
    };
  }
}
