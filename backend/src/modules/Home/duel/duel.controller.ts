import { Controller, Post, Get, Body, Param, HttpStatus, Res } from '@nestjs/common';
import { DuelService } from './duel.service';

@Controller('duel')
export class DuelController {
  constructor(private readonly duelService: DuelService) {}

  @Post('create')
  async createDuel(@Body() body: any) {
    return this.duelService.createDuel({
      creatorId: body.creatorId,
      creatorName: body.creatorName || 'Spelare 1',
      gameMode: body.gameMode || 'quick',
      isVsAi: body.isVsAi,
      aiDifficulty: body.aiDifficulty,
    });
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.duelService.getLeaderboard();
  }

  @Get(':code')
  async getDuel(@Param('code') code: string) {
    return this.duelService.getDuel(code);
  }

  @Post(':code/join')
  async joinDuel(@Param('code') code: string, @Body() body: any) {
    return this.duelService.joinDuel(code, {
      challengerId: body.challengerId,
      challengerName: body.challengerName || 'Utmanare',
    });
  }

  @Post(':code/submit')
  async submitScore(@Param('code') code: string, @Body() body: any) {
    return this.duelService.submitScore(code, {
      role: body.role,
      score: body.score,
      correctCount: body.correctCount,
      answers: body.answers,
    });
  }
}
