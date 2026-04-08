import cors from "cors";
import express from "express";
import { FragmentApplication, FragmentWebApplication } from "fragment-ts";
import "reflect-metadata";


@FragmentApplication({
  port: Number(process.env.PORT) || 4000,
  autoScan: true,
})
class Application {}

async function bootstrap() {
  const app = new FragmentWebApplication({
    defaultMiddleware: {
      cors: false,
      json: false,
      urlencoded: false,
    },
  });

  app.configureExpress((expressApp) => {
    expressApp.use(
      cors({
        origin: true,
        credentials: true,
        optionsSuccessStatus: 200,
      }),
    );

    expressApp.use(express.json({ limit: "100mb" }));
    expressApp.use(express.urlencoded({ limit: "500mb", extended: true }));
  });
  await app.bootstrap(Application);
}

bootstrap().catch(console.error);
