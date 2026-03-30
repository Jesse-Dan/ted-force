import {
  Autowired,
  Body,
  Controller,
  FragmentGuard,
  Param,
  Post,
} from 'fragment-ts';
import { AgentRuntimeKeyGuard } from '../../security/guards/agent-runtime-key.guard';
import { AgentToolBundleService } from '../../agent_tools/services/agent-tool-bundle.service';

@FragmentGuard(AgentRuntimeKeyGuard)
@Controller('/runtime/v1/agents/:agentId')
export class AgentRuntimeController {
  @Autowired()
  private bundleService!: AgentToolBundleService;

  @Post('/responses')
  createResponse(
    @Param('agentId') agentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return {
      data: {
        agentId,
        accepted: true,
        input: body,
        toolBundle: this.bundleService.buildForAgent(agentId),
      },
    };
  }
}
