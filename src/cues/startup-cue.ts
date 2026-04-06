import { Autowired, Injectable, OnStartup } from "fragment-ts";
import { PlatformToolSyncService } from "../modules/tools/services/platform-tool-sync.service";

@Injectable()
class StartupCue {
  @Autowired()
  private platformToolSyncService!: PlatformToolSyncService;

  @OnStartup(10)
  async startup() {
    await this.platformToolSyncService.syncRegistry();
  }
}
