import { Autowired, Controller, Get, Param } from "fragment-ts";
import { UseManagedRequestPipeline } from "../../../common/decorators/use-managed-request-pipeline.decorator";
import { WaitlistService } from "../services/waitlist.service";

@UseManagedRequestPipeline()
@Controller("/waitlist")
export class WaitlistController {
  @Autowired()
  private waitlistService!: WaitlistService;

  @Get()
  async getAll() {
    return this.waitlistService.getAll();
  }

  @Get("/:email")
  async getByEmail(@Param("email") email: string) {
    return this.waitlistService.getByEmail(email);
  }
}
