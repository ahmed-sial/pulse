import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module.js';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { startLogsConsumer } from './nats/consumer.js';
import { createLogsTable } from './clickhouse/schema.js';
import { initNatsStream } from './nats/init-stream.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { BodyParserExceptionFilter } from './filters/body-parser-exception.filter.js';

const logger = new Logger('ApplicationBootstrap', { timestamp: true });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { limit: '3mb', extended: true });

  await createLogsTable();
  await initNatsStream();
  void startLogsConsumer().catch((err) => {
    logger.error('PLS logs consumer failed', err);
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({
    origin: '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new BodyParserExceptionFilter(app.getHttpAdapter()));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
