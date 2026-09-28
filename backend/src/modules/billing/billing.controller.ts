import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { UsageGuard } from '../../guards/usage.guard.js';
import { CurrentUserId } from '../../decorators/current-user-id.decorator.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('current')
  @UseGuards(UsageGuard)
  async getCurrentPlan(@Req() req: any) {
    this.billingService.getCurrentPlan(req);
  }

  @Get('invoices')
  async getInvoices(@CurrentUserId() id: string) {
    this.billingService.getCurrentPlan(id);
  }

  @Post()
  async createBillingSession(
    @CurrentUserId() id: string,
    @Body('plan') selectedPlan: string,
  ) {
    return this.billingService.createBillingSession(id, selectedPlan);
  }

  @Post('portal')
  async createBillingPortal(@CurrentUserId() id: string) {
    return this.billingService.createPortalSession(id);
  }
}
