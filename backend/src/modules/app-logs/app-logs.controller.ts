import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AppLogsService } from './app-logs.service.js';
import { logger } from '../../libs/test.js';
import { Public } from '../../decorators/public.decorator.js';
import { CurrentUserId } from '../../decorators/current-user-id.decorator.js';
import { ApiKeyId } from '../../decorators/api-key-id.decorator.js';

@Controller('logs')
export class AppLogsController {
  constructor(private readonly logsService: AppLogsService) {}

  @Post('send')
  async sendLogs(
    @CurrentUserId() userId: string,
    @ApiKeyId() apiId: string,
    @Body() body: any,
  ) {
    return this.logsService.sendLogs(apiId, userId, body);
  }

  @Public()
  @Get()
  async send() {
    try {
      await logger.error({
        message: 'Something went wrong',
        importance: 'medium',
        service: 'auth-service',
      });

      return { success: true };
    } catch (err) {
      console.error(err);
    }
  }
}
