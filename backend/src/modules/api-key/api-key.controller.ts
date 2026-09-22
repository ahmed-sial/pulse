import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import { CreateApiKeyDto } from './dtos/create-api-key.dto.js';
import { CurrentUserId } from '../../decorators/current-user-id.decorator.js';

@Controller('apikeys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('/create')
  async createApiKey(
    @CurrentUserId() id: string,
    @Body('apiKeyProps') apiKeyProps: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(id, apiKeyProps.name);
  }

  @Get()
  async getAllApiKeys(@CurrentUserId() id: string) {
    return this.apiKeyService.getAllApiKeys(id);
  }

  @Get(':id')
  async getApiKeyLastUsedAtTimestamp(
    @CurrentUserId() id: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) apiId: string,
  ) {
    return this.apiKeyService.getApiKeyLastUsedAtTimestamp(id, apiId);
  }

  @Delete(':id')
  async deleteApiKey(
    @CurrentUserId() id: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) apiKeyId: string,
  ) {
    return this.apiKeyService.deleteApiKey(id, apiKeyId);
  }
}
