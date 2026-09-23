import { Body, Controller, Post, Req } from '@nestjs/common';
import { AppLogsService } from './app-logs.service.js';

@Controller('logs')
export class AppLogsController {
  constructor(private readonly logsService: AppLogsService) {}

  @Post('send')
  async sendLogs(@Req() req: any, @Body() body: any) {
    return this.logsService.sendLogs(body, req.user.keyId);
  }
}
