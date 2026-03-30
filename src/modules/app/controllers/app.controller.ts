import { Controller, Get } from 'fragment-ts';
import { AppService } from '../services/app.service';
import { Autowired } from 'fragment-ts';

@Controller('/api/v2')
export class AppController {
  @Autowired()
  private appService!: AppService;

  @Get('/health')
  health() {
    return {
      status: 'ok',
      service: 'digitwhale_tuul_service_v2',
      timestamp: new Date().toISOString(),
      message: this.appService.getMessage()
    };
  }
}
