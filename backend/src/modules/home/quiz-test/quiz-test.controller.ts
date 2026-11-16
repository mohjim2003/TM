import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { QuizTestService } from './quiz-test.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StripeService } from '../../payment/stripe/stripe.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('quiz-test')
export class QuizTestController {
  constructor(
    private readonly quizTestService: QuizTestService,
    private readonly stripeService: StripeService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private extractUserFromReq(req: any): { userId: string | null; email: string | null } {
    let userId: string | null = null;
    let email: string | null = null;

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtService.decode(token) as any;
        if (payload) {
          userId = payload.sub || payload.userId || payload.id || null;
          email = payload.email || null;
        }
      } catch (e) {
        console.warn('[QuizTestController] Token decode failed:', e.message);
      }
    }
    return { userId, email };
  }

  // Hämta frågor med stöd för kategorier och prenumerationsstatus
  @ApiOperation({ summary: 'Get questions with category and subscription gating' })
  @ApiBearerAuth()
  @Get('questions')
  async getQuestions(
    @Req() req: any,
    @Query('category') category?: string,
  ) {
    try {
      const { userId, email } = this.extractUserFromReq(req);

      // 100% Gratis för alla användare och elever!
      let isSubscribed = true;
      let userType = 'guest';

      if (userId) {
        // Kontrollera roll/typ på användaren i databasen
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, type: true },
        });

        if (user) {
          userType = user.type || 'user';
          if (user.type === 'admin') {
            userType = 'admin';
          }
        }
      }

      const result = await this.quizTestService.getQuestions({
        category: category || 'slutprov',
        isSubscribed,
        userId: userId || undefined,
      });

      return {
        success: true,
        isAuthenticated: !!userId,
        userType,
        ...result,
      };
    } catch (error) {
      console.error('[QuizTestController] Error fetching questions:', error);
      throw new HttpException('Failed to fetch questions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Lämna in svar och beräkna samt spara resultat i databasen
  @ApiOperation({ summary: 'Submit answers and save exam result to database' })
  @Post('submit-answers')
  async submitAnswers(
    @Req() req: any,
    @Body()
    data: {
      answers: (string | null)[];
      questions?: any[];
      category?: string;
      timeSpentSec?: number;
    },
  ) {
    try {
      const { userId } = this.extractUserFromReq(req);

      const result = await this.quizTestService.calculateResults({
        answers: data.answers,
        questions: data.questions,
        userId: userId || undefined,
        category: data.category,
        timeSpentSec: data.timeSpentSec,
      });

      return result;
    } catch (error) {
      console.error('[QuizTestController] Error submitting answers:', error);
      throw new HttpException('Failed to submit answers', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Hämta historik över genomförda prov för inloggad användare
  @ApiOperation({ summary: 'Get exam history for authenticated user' })
  @ApiBearerAuth()
  @Get('history')
  async getExamHistory(@Req() req: any) {
    const { userId } = this.extractUserFromReq(req);
    if (!userId) {
      throw new HttpException('Du måste vara inloggad för att se provhistorik.', HttpStatus.UNAUTHORIZED);
    }

    return await this.quizTestService.getUserHistory(userId);
  }

  // Hämta detaljer för ett specifikt genomfört prov
  @ApiOperation({ summary: 'Get single exam result details' })
  @ApiBearerAuth()
  @Get('history/:id')
  async getExamDetail(@Req() req: any, @Param('id') id: string) {
    const { userId } = this.extractUserFromReq(req);
    if (!userId) {
      throw new HttpException('Du måste vara inloggad.', HttpStatus.UNAUTHORIZED);
    }

    return await this.quizTestService.getExamDetail(id, userId);
  }

  // Smart AI-coach: hämtar analys av svagheter och rekommendationer
  @ApiOperation({ summary: 'Get AI Coach recommendations based on user performance' })
  @ApiBearerAuth()
  @Get('ai-coach')
  async getAiCoach(@Req() req: any) {
    const { userId } = this.extractUserFromReq(req);
    if (!userId) {
      return {
        hasData: false,
        headline: 'Välkommen till AI TeoriCoach!',
        message: 'Logga in och gör ett prov så analyserar jag dina svagheter och hjälper dig klara körkortet.',
        recommendedCategory: 'slutprov',
        recommendedActionText: 'Logga in & starta prov',
      };
    }

    return await this.quizTestService.getAiCoachRecommendation(userId);
  }
}
