import { Test, TestingModule } from '@nestjs/testing';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

describe('StripeController', () => {
  let controller: StripeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [
        {
          provide: StripeService,
          useValue: {
            checkSubscriptionStatus: jest.fn().mockResolvedValue({ isActive: true, plan: 'pro' }),
            processDirectPayment: jest.fn().mockResolvedValue({ success: true }),
            devActivateSubscription: jest.fn().mockResolvedValue({ success: true }),
            retrieveCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_test' }),
            createBillingPortalSession: jest.fn().mockResolvedValue({ url: 'http://test' }),
            createSubscriptionCheckoutSession: jest.fn().mockResolvedValue({ url: 'http://test' }),
          },
        },
      ],
    }).compile();

    controller = module.get<StripeController>(StripeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
