import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller.js';
import { ApiKeyService } from './api-key.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [],
})
export class ApiKeyModule {}
