import 'reflect-metadata';
import { FragmentApplication, FragmentWebApplication } from 'fragment-ts';

@FragmentApplication({
  port: parseInt(process.env.PORT || '3000', 10),
  autoScan: true
})
class Application {}

async function bootstrap() {
  const app = new FragmentWebApplication();
  await app.bootstrap(Application);
}

bootstrap().catch(console.error);
