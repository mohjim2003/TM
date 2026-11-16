import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus, Headers, Param } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RawBodyRequest } from '@nestjs/common';

@Controller('payment')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // check that user subscriber or not
  @ApiOperation({ summary: 'check that user subscriber or not' })
  @Get('subscription/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async checkSubscriptionStatus(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }
    
    const result = await this.stripeService.checkSubscriptionStatus(userId);
    return {
      success: true,
      isActive: result.isActive,
      isSubscribed: result.isActive,
      plan: result.plan,
    };
  }

  // Genomför direkt kort- eller Swish-betalning för vanliga användare
  @ApiOperation({ summary: 'Process direct card or swish payment for subscription' })
  @Post('checkout-charge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async checkoutCharge(
    @Body()
    body: {
      plan?: string;
      paymentMethod?: string;
      cardNumber?: string;
      cardName?: string;
      cardExp?: string;
      cardCvc?: string;
      phoneNumber?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user.sub || req.user.userId;
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }

    // Validering
    if (body.paymentMethod === 'swish') {
      if (!body.phoneNumber || body.phoneNumber.trim().length < 8) {
        throw new HttpException('Vänligen ange ett giltigt telefonnummer för Swish.', HttpStatus.BAD_REQUEST);
      }
    } else {
      // Kortbetalning
      const cleanedCard = (body.cardNumber || '').replace(/\s+/g, '');
      if (cleanedCard.length < 13) {
        throw new HttpException('Vänligen ange ett giltigt kortnummer (minst 13 siffror).', HttpStatus.BAD_REQUEST);
      }
      if (!body.cardExp || !body.cardExp.includes('/')) {
        throw new HttpException('Vänligen ange kortets giltighetstid (MM/ÅÅ).', HttpStatus.BAD_REQUEST);
      }
      if (!body.cardCvc || body.cardCvc.trim().length < 3) {
        throw new HttpException('Vänligen ange en giltig CVC/CVV-kod (3 siffror).', HttpStatus.BAD_REQUEST);
      }
    }

    return await this.stripeService.processDirectPayment({
      userId,
      plan: body.plan || 'month',
      paymentMethod: body.paymentMethod || 'card',
    });
  }

  // dev/test helper för att aktivera prenumeration direkt (endast för manuell admin-testning)
  @ApiOperation({ summary: 'Activate dev/test subscription' })
  @Post('dev-activate')
  async devActivateSubscription(@Body() body: { email?: string; userId?: string; plan?: string }) {
    return await this.stripeService.devActivateSubscription(body);
  }

  @ApiOperation({ summary: 'Create subscription checkout session or activate test' })
  @Get('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createSubscriptionCheckout(
    @Query('plan') plan: string | string[],
    @Req() req: Request & { user: { sub?: string; userId?: string; email?: string; type?: string } },
  ) {
    return this.processSubscription(plan, req);
  }

  @ApiOperation({ summary: 'Create subscription checkout session via POST' })
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createSubscriptionCheckoutPost(
    @Query('plan') queryPlan: string | string[],
    @Body('plan') bodyPlan: string,
    @Req() req: Request & { user: { sub?: string; userId?: string; email?: string; type?: string } },
  ) {
    const plan = bodyPlan || queryPlan;
    return this.processSubscription(plan, req);
  }

  private async processSubscription(
    plan: string | string[],
    req: Request & { user: { sub?: string; userId?: string; email?: string; type?: string } },
  ) {
    const userId = req.user.sub || req.user.userId;
    console.log('[StripeController] Subscribe request for user:', userId, 'plan:', plan);

    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }

    // Admin behöver inte betala – har redan full tillgång
    if (req.user.type === 'admin') {
      return {
        success: true,
        isAdmin: true,
        url: `${process.env.CLIENT_APP_URL || 'http://localhost:3000'}/theory-quiz`,
        message: 'Admin har redan fullständig och obegränsad tillgång.',
      };
    }

    const rawPlan = Array.isArray(plan) ? plan[0] : plan;
    const planValue = rawPlan ? rawPlan.toLowerCase() : 'starter';

    let priceId = process.env.STRIPE_PRICE_MONTH || 'price_1UcABLEHPp4ufYXSqTsVHrvy';
    if (planValue === 'pro' || planValue === 'year' || planValue === 'yearly') {
      priceId = process.env.STRIPE_PRICE_YEAR || 'price_1UcABUEHPp4ufYXSwS3RpnXB';
    }

    // Försök först med Stripe Checkout om giltig session kan skapas
    try {
      const session = await this.stripeService.createCheckoutSession(priceId, userId);
      if (session && session.url) {
        return { success: true, url: session.url };
      }
    } catch (stripeError: any) {
      console.warn(
        `[StripeController] Stripe checkout ej tillgängligt (${stripeError?.message || stripeError}).`,
      );
    }

    // För icke-admin: Ge ALDRIG automatisk gratistillgång här!
    // Kasta istället ett tydligt fel så användaren kan slutföra betalningen i kort/Swish-kassan.
    throw new HttpException(
      'Stripe checkout är inte konfigurerat. Vänligen slutför betalningen med kort eller Swish i kassan.',
      HttpStatus.BAD_REQUEST,
    );
  }

  @Get('success')
  async handleSuccessfulPayment(
    @Query('session_id') sessionId: string,
    @Res() res: Response
  ) {
    try {
      if (!sessionId) {
        throw new HttpException('Session ID is required', HttpStatus.BAD_REQUEST);
      }

      const session = await this.stripeService.retrieveCheckoutSession(sessionId, {expand:['subscription', 'subscription.plan.product'] });
      console.log(session)
      return res.send('Subscribed successfully');
    } catch (_error) {
      throw new HttpException('Failed to process successful payment', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('cancel')
  async cancelSubscription(@Res() res: Response) {
    try {
      return res.redirect('/');
    } catch (_error) {
      throw new HttpException('Failed to cancel subscription', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('customers/:customerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createCustomerPortalSession(
    @Param('customerId') customerId: string,
    @Res() res: Response
  ) {
    try {
      const portalSession = await this.stripeService.createBillingPortalSession(customerId);
      return res.redirect(portalSession.url);
    } catch (_error) {
      throw new HttpException(
        'Failed to create customer portal session',
        HttpStatus.BAD_REQUEST
      );
    }
  }


  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response
  ) {
    try {
      console.log("in webhook")
      const event = await this.stripeService.constructWebhookEvent(req.rawBody, signature);
  
      switch (event.type) {
        case 'checkout.session.completed': {
          const checkoutSession = event.data.object as any;
          await this.stripeService.handleCheckoutSessionCompleted(checkoutSession);
          break;
        }

        case 'invoice.paid': {
          const paidInvoice = event.data.object as any;
          const customerId =
            typeof paidInvoice.customer === 'string'
              ? paidInvoice.customer
              : paidInvoice.customer?.id || '';
          await this.stripeService.handleInvoicePaid({
            customerEmail: paidInvoice.customer_email || '',
            customerId,
            amount: paidInvoice.amount_paid,
            currency: paidInvoice.currency,
            invoiceUrl: paidInvoice.invoice_pdf || '',
            status: 'succeeded',
          });
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          await this.stripeService.handleSubscriptionUpdated(subscription);
          break;
        }

        case 'invoice.payment_failed': {
          const failedInvoice = event.data.object as any;
          const customerId =
            typeof failedInvoice.customer === 'string'
              ? failedInvoice.customer
              : failedInvoice.customer?.id || '';
          await this.stripeService.handleInvoicePaymentFailed({
            customerEmail: failedInvoice.customer_email || '',
            customerId,
            amount: failedInvoice.amount_due,
            currency: failedInvoice.currency,
            status: 'failed',
          });
          break;
        }
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      throw new HttpException(
        `Webhook Error: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
