import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('StripeService', () => {
  let service: StripeService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    // Sätt en dummy-nyckel så att Stripe-klienten inte kraschar vid initialisering i constructorn
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mockkey123';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            subscription: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            paymentTransaction: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            // Lägg till fler modeller här ifall din service använder dem (t.ex. order, invoice etc.)
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(prismaService).toBeDefined();
  });
});