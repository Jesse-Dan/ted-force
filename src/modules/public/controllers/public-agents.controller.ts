import {
  Autowired,
  Body,
  Controller,
  Param,
  Post,
  Res,
  Response,
} from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { BootstrapPublicAgentDto } from "../dto/bootstrap-public-agent.dto";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/agents")
export class PublicAgentsController {
  @Autowired()
  private publicService!: PublicService;

  @Post("/:slug/bootstrap")
  async bootstrap(
    @Param("slug") slug: string,
    @Body() body: BootstrapPublicAgentDto,
    @Res() response: Response,
  ) {
    await this.publicService.bootstrapAgentSessionWithSse(slug, body, response);
    return response;
  }
}
