import { Module } from '@nestjs/common';
import { AppLogsController } from './app-logs.controller.js';
import { AppLogsService } from './app-logs.service.js';

@Module({
  controllers: [AppLogsController],
  providers: [AppLogsService],
})
export class AppLogsModule {}
