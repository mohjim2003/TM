import { Module } from '@nestjs/common';
import { DuelController } from './duel.controller';
import { DuelService } from './duel.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DuelController],
  providers: [DuelService],
  exports: [DuelService],
})
export class DuelModule {}
