import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { StripeService } from '../../payment/stripe/stripe.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private stripeService: StripeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const subscriptionStatus = await this.stripeService.checkSubscriptionStatus(userId);
    
    if (!subscriptionStatus.isActive) {
      throw new HttpException('Active subscription required', HttpStatus.PAYMENT_REQUIRED);
    }

    return true;
  }
} 