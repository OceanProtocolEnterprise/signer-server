import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    HttpExceptionFilter.name,
  );

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException =
      exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = isHttpException
      ? exception.getResponse()
      : undefined;
    const message = this.getResponseMessage(
      exception,
      errorResponse,
    );
    const stack =
      exception instanceof Error
        ? exception.stack
        : undefined;

    this.logger.error(
      `${request.method} ${request.url} ${status}: ${message}`,
      stack,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private getResponseMessage(
    exception: unknown,
    errorResponse?: string | object,
  ) {
    if (typeof errorResponse === 'string') {
      return errorResponse;
    }

    if (
      errorResponse &&
      typeof errorResponse === 'object' &&
      'message' in errorResponse
    ) {
      return (
        errorResponse as { message: string | string[] }
      ).message;
    }

    if (
      exception instanceof Error &&
      process.env.NODE_ENV !== 'production'
    ) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
