import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import {
  getServerPort,
  getTlsOptions,
  getTlsPaths,
  shouldWarnAboutPartialTlsConfig,
} from './server-startup';

const SWAGGER_PATH = 'api';

async function bootstrap() {
  const tlsPaths = getTlsPaths();
  const tlsOptions = getTlsOptions(tlsPaths);
  const app = await NestFactory.create(AppModule, {
    ...(tlsOptions ? { httpsOptions: tlsOptions } : {}),
  });
  const logger = new Logger('Bootstrap');

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS policies - adjust as needed for your deployment environment
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Signer Service')
    .setDescription(
      'Remote signing with Authentik authentication',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(
    app,
    config,
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = getServerPort();
  if (shouldWarnAboutPartialTlsConfig(tlsPaths)) {
    logger.warn(
      'Both HTTP_CERT_PATH and HTTP_KEY_PATH must be configured to enable HTTPS. Starting HTTP server.',
    );
  }

  await app.listen(port);
  logger.log(
    `Signer service running on ${tlsOptions ? 'HTTPS' : 'HTTP'} port ${port}`,
  );
  logger.log(`Swagger UI available at /${SWAGGER_PATH}`);
  logger.log(
    `OpenAPI JSON available at /${SWAGGER_PATH}-json`,
  );
}
bootstrap();
