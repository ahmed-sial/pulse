import { ArgumentsHost, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

type BodyParserError = Error & {
  expected?: number;
  length?: number;
  limit?: number;
  status?: number;
  statusCode?: number;
  type?: string;
};

export class BodyParserExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(exception: BodyParserError, host: ArgumentsHost): void {
    if (exception?.type !== 'entity.too.larger')
      return super.catch(exception, host);

    const res = host.switchToHttp().getResponse();
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Request payload too large',
      error: 'Payload too larger',
    });
  }
}
