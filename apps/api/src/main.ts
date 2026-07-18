import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import helmet from "helmet";
import { AppModule } from "./app.module";

const envFile = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", "..", ".env")]
  .find((candidate) => existsSync(candidate));
if (envFile) dotenv.config({ path: envFile });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new Logger("EduRecallApi"));
  app.setGlobalPrefix("api");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: [process.env.WEB_URL ?? "http://localhost:3000"], credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  const config = new DocumentBuilder()
    .setTitle("EduRecall Core Platform API")
    .setDescription("Business owner, personalization orchestrator and human review workflow")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  Logger.log(JSON.stringify({ event: "api_started", port, docs: `/api/docs` }), "Bootstrap");
}

void bootstrap();
