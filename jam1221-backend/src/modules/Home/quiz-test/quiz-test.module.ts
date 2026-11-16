import { Module } from '@nestjs/common';
import { QuizTestService } from './quiz-test.service';
import { QuizTestController } from './quiz-test.controller';
import { StripeModule } from '../../payment/stripe/stripe.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import appConfig from '../../../config/app.config';

@Module({
  imports: [
    StripeModule,
    PrismaModule,
    JwtModule.register({
      secret: appConfig().jwt.secret,
      signOptions: { expiresIn: appConfig().jwt.expiry },
    }),
  ],
  controllers: [QuizTestController],
  providers: [QuizTestService],
  exports: [QuizTestService],
})
export class QuizTestModule {}
