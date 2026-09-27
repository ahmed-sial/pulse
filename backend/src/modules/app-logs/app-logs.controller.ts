import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AppLogsService } from './app-logs.service.js';
import { CurrentUserId } from '../../decorators/current-user-id.decorator.js';
import { ApiKeyId } from '../../decorators/api-key-id.decorator.js';
import type { Response } from 'express';
import { UsageGuard } from '../../guards/usage.guard.js';

@Controller('logs')
export class AppLogsController {
  constructor(private readonly logsService: AppLogsService) {}

  @Get()
  async getLogs(@CurrentUserId() userId: string, @Req() req: any) {
    return this.logsService.getLogs(req, userId);
  }

  @Post('send')
  @UseGuards(UsageGuard)
  async sendLogs(
    @Req() req: any,
    @CurrentUserId() userId: string,
    @ApiKeyId() apiId: string,
    @Body() body: any,
  ) {
    return this.logsService.sendLogs(apiId, userId, body, req.plan);
  }

  @Get('stream')
  async startServerSentEvents(
    @CurrentUserId() userId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    return this.logsService.startServerSentEvents(req, res, userId);
  }
}
