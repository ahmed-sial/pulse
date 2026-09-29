import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CurrentUserId } from '../../decorators/current-user-id.decorator.js';
import { Public } from '../../decorators/public.decorator.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('current')
  async getCurrentPlan(@CurrentUserId() id: string) {
    return this.billingService.getCurrentPlan(id);
  }

  @Get('plans')
  async getPlans(): Promise<{
    plans: Array<{
      name: string;
      eventsLimit: number;
      unitAmount: number | null;
      currency: string | null;
      interval: string | null;
      intervalCount: number | null;
    }>;
  }> {
    return this.billingService.getPlans();
  }

  @Get('invoices')
  async getInvoices(@CurrentUserId() id: string) {
    return this.billingService.getInvoices(id);
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

  @Post('confirm')
  async confirmCheckout(
    @CurrentUserId() id: string,
    @Body('sessionId') sessionId?: string,
  ) {
    return this.billingService.confirmCheckout(id, sessionId);
  }

  @Post('webhook')
  @Public()
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.handleStripeWebhook(req.rawBody, signature);
  }
}
