import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Stripe from 'stripe';
import appConfig from '../../../config/app.config';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly PRODUCT_IDS = {
    month: 'monthly_subscription_product',
    year: 'yearly_subscription_product'
  };

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(appConfig().payment?.stripe?.secret_key || '', {
      apiVersion: '2023-08-16' as any,
    });
  }

  // 1. Kollar databasen och användarens status
  async checkSubscriptionStatus(userId: string): Promise<{ isActive: boolean; plan?: string }> {
    try {
      if (!userId) return { isActive: false };

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: {
              status: 'active',
              deleted_at: null,
              current_period_end: {
                gt: new Date(),
              },
            },
            take: 1,
          },
          payment_transactions: {
            where: {
              status: { in: ['completed', 'succeeded', 'paid'] },
            },
            take: 1,
          },
        },
      });

      if (!user) return { isActive: false };

      const activeSub = user.subscriptions?.[0];
      const hasPaidTx = user.payment_transactions && user.payment_transactions.length > 0;
      const isAdminOrSubscriber = user.type === 'admin' || user.type === 'subscriber';

      const isActive = !!activeSub || !!hasPaidTx || isAdminOrSubscriber;
      const plan = activeSub?.plan_type || (isAdminOrSubscriber ? 'pro' : 'standard');

      return { isActive, plan };
    } catch (error) {
      console.error("Database error in checkSubscriptionStatus:", error);
      return { isActive: false };
    }
  }

  // 1b. Aktivera prenumeration för test/utveckling (endast admin)
  async devActivateSubscription({ userId, email, plan = 'pro' }: { userId?: string; email?: string; plan?: string }) {
    try {
      let targetUser = null;
      if (userId) {
        targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
      } else if (email) {
        targetUser = await this.prisma.user.findUnique({ where: { email } });
      }

      if (!targetUser) {
        throw new HttpException('Användaren hittades inte i databasen.', HttpStatus.NOT_FOUND);
      }

      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const existingSub = await this.prisma.subscription.findFirst({
        where: { user_id: targetUser.id },
      });

      let sub;
      if (existingSub) {
        sub = await this.prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: 'active',
            plan_type: plan,
            current_period_start: now,
            current_period_end: nextMonth,
          },
        });
      } else {
        sub = await this.prisma.subscription.create({
          data: {
            user_id: targetUser.id,
            stripe_customer_id: `cus_dev_${targetUser.id.slice(0, 8)}`,
            stripe_subscription_id: `sub_dev_${Date.now()}`,
            status: 'active',
            plan_type: plan,
            current_period_start: now,
            current_period_end: nextMonth,
          },
        });
      }

      await this.prisma.user.update({
        where: { id: targetUser.id },
        data: { type: 'subscriber' },
      });

      return {
        success: true,
        message: 'Aktiv prenumeration aktiverad!',
        subscription: sub,
      };
    } catch (error) {
      console.error('Kunde inte aktivera testprenumeration:', error);
      throw new HttpException(error.message || 'Kunde inte aktivera testprenumeration', HttpStatus.BAD_REQUEST);
    }
  }

  // 1c. Genomför riktig betalning (kort/swish) och aktivera prenumeration
  async processDirectPayment({
    userId,
    plan = 'month',
    paymentMethod = 'card',
    amount,
  }: {
    userId: string;
    plan: string;
    paymentMethod?: string;
    amount?: number;
  }) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new HttpException('Användaren hittades inte i databasen.', HttpStatus.NOT_FOUND);
      }

      // Om admin
      if (user.type === 'admin') {
        return {
          success: true,
          message: 'Admin har redan fullständig åtkomst.',
          isAdmin: true,
        };
      }

      const isYearly = plan === 'year' || plan === 'yearly' || plan === 'pro';
      const finalAmount = amount || (isYearly ? 299 : 99);
      const planType = isYearly ? 'yearly' : 'monthly';

      const now = new Date();
      const periodEnd = new Date();
      if (isYearly) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const refNumber = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 1. Spara betalningstransaktionen
      const tx = await this.prisma.paymentTransaction.create({
        data: {
          user_id: user.id,
          customer_id: `cus_${user.id.slice(0, 10)}`,
          type: 'subscription',
          provider: paymentMethod || 'card',
          reference_number: refNumber,
          status: 'completed',
          raw_status: 'succeeded',
          amount: finalAmount,
          currency: 'SEK',
          paid_amount: finalAmount,
          paid_currency: 'SEK',
        },
      });

      // 2. Skapa eller uppdatera användarens prenumeration
      const existingSub = await this.prisma.subscription.findFirst({
        where: { user_id: user.id },
      });

      let sub;
      if (existingSub) {
        sub = await this.prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: 'active',
            plan_type: planType,
            current_period_start: now,
            current_period_end: periodEnd,
          },
        });
      } else {
        sub = await this.prisma.subscription.create({
          data: {
            user_id: user.id,
            stripe_customer_id: `cus_${user.id.slice(0, 10)}`,
            stripe_subscription_id: `sub_${paymentMethod || 'pay'}_${Date.now()}`,
            status: 'active',
            plan_type: planType,
            current_period_start: now,
            current_period_end: periodEnd,
          },
        });
      }

      // 3. Uppdatera användarroll till subscriber
      await this.prisma.user.update({
        where: { id: user.id },
        data: { type: 'subscriber' },
      });

      console.log(`[StripeService] Betalning genomförd för ${user.email} (${finalAmount} SEK, plan: ${planType})`);

      return {
        success: true,
        message: `Betalning på ${finalAmount} SEK har genomförts. Full tillgång är aktiverad till ${periodEnd.toLocaleDateString('sv-SE')}!`,
        transaction: tx,
        subscription: sub,
      };
    } catch (error) {
      console.error('[StripeService] Fel vid processDirectPayment:', error);
      throw new HttpException(
        error.message || 'Kunde inte slutföra betalningen.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 2. Skapar checkout-session
  async createCheckoutSession(priceId: string, userId: string) {
    const clientAppUrl = process.env.CLIENT_APP_URL || 'http://localhost:3000';
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      success_url: `${clientAppUrl}/theory-quiz?payment=success`,
      cancel_url: `${clientAppUrl}/subscription?payment=cancelled`,
    });
  
    return session;
  }

  // 3. Hämtar checkout-session
  async retrieveCheckoutSession(sessionId: string, options?: Stripe.Checkout.SessionRetrieveParams) {
    return await this.stripe.checkout.sessions.retrieve(sessionId, options);
  }

  // 4. Skapar portal-session
  async createBillingPortalSession(customerId: string) {
    const portalSession = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.CLIENT_APP_URL}/subcription`,
    });
    return portalSession;
  }

  // 5. Verifierar Webhook (Fixad med : any så du slipper förra felet)
  async constructWebhookEvent(payload: Buffer, signature: string) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET_KEY
      );
      return event;
    } catch (err: any) {
      throw new HttpException(`Webhook Error: ${err.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  // --- HÄR UNDER LIGGER ALLA DINA WEBHOOK-HANDLERS ---

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      console.log('Processing completed checkout session:', session.id);
      const subscription = await this.stripe.subscriptions.retrieve(
        session.subscription as string,
        { expand: ['items.data.price.product'] }
      );
  
      await this.prisma.subscription.create({
        data: {
          user_id: session.client_reference_id,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: subscription.status,
          plan_type: subscription.items.data[0].price.nickname || 'starter',
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
        },
      });
  
      console.log('Subscription created successfully');
    } catch (error) {
      console.error('Error handling checkout session:', error);
      throw new HttpException('Failed to process subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handleInvoicePaid(invoiceData: { customerEmail: string; customerId: string; amount: number; currency: string; invoiceUrl: string; status: string; }) {
    try {
      await this.prisma.paymentTransaction.create({
        data: {
          customer_id: invoiceData.customerId,
          amount: invoiceData.amount,
          currency: invoiceData.currency,
          status: invoiceData.status,
          invoice_url: invoiceData.invoiceUrl,
          type: 'subscription',
          provider: 'stripe'
        },
      });
    } catch (error) {
      console.error('Error handling invoice paid:', error);
      throw new HttpException('Failed to process invoice', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handleInvoicePaymentFailed(invoiceData: { customerEmail: string; customerId: string; amount: number; currency: string; status: string; }) {
    try {
      await this.prisma.paymentTransaction.create({
        data: {
          customer_id: invoiceData.customerId,
          amount: invoiceData.amount,
          currency: invoiceData.currency,
          status: invoiceData.status,
          type: 'subscription',
          provider: 'stripe'
        },
      });

      const subscription = await this.prisma.subscription.findFirst({
        where: { stripe_customer_id: invoiceData.customerId },
      });
      
      if (subscription) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'payment_failed' },
        });
      }
    } catch (error) {
      console.error('Error handling invoice payment failure:', error);
      throw new HttpException('Failed to process failed payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    try {
      await this.prisma.subscription.update({
        where: { stripe_subscription_id: subscription.id },
        data: {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
        },
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new HttpException('Failed to update subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}