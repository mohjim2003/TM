import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import generalQuestion from '../../../data/generalQuestion';

export interface DuelQuestionItem {
  id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
  imageUrl?: string;
}

@Injectable()
export class DuelService {
  private allQuestions: DuelQuestionItem[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.loadQuestions();
  }

  private loadQuestions() {
    try {
      this.allQuestions = (generalQuestion as any[]).map((q, idx) => ({
        id: idx + 1,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        category: q.category || 'trafikregler',
        imageUrl: q.imageUrl || undefined,
      }));
    } catch {
      this.allQuestions = [
        { id: 1, question: 'Vad gäller när du närmar dig en cirkulationsplats?', options: ['Du har väjningsplikt mot trafik i cirkulationen', 'Högerregeln gäller alltid', 'Du kör först om du blinkar vänster', 'Stopplikt gäller alltid'], answer: 'Du har väjningsplikt mot trafik i cirkulationen' },
        { id: 2, question: 'Vad innebär en rund blå skylt med vita siffror (t.ex. 50)?', options: ['Påbjuden lägsta hastighet', 'Högsta tillåtna hastighet', 'Rekommenderad hastighet', 'Avstånd till nästa avfart'], answer: 'Påbjuden lägsta hastighet' },
        { id: 3, question: 'Hur påverkas rörelseenergin om du fördubblar hastigheten från 30 km/h till 60 km/h?', options: ['Den blir 4 gånger så stor', 'Den fördubblas', 'Den förblir densamma', 'Den blir 8 gånger så stor'], answer: 'Den blir 4 gånger så stor' },
        { id: 4, question: 'När är det lagkrav på dubbdäck eller friktionsdäck (vinterdäck) vid vinterväglag?', options: ['1 december – 31 mars', '1 november – 30 april', '15 oktober – 15 april', '1 januari – 28 februari'], answer: '1 december – 31 mars' },
        { id: 5, question: 'Vad är promillegränsen för grovt rattfylleri i Sverige?', options: ['1.0 promille', '0.2 promille', '0.5 promille', '1.5 promille'], answer: '1.0 promille' },
      ];
    }
  }

  // Slumpa frågor för duellen
  private pickRandomQuestions(count: number): DuelQuestionItem[] {
    if (this.allQuestions.length === 0) this.loadQuestions();
    const shuffled = [...this.allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // 1. Skapa en ny duell
  async createDuel(data: {
    creatorId?: string;
    creatorName: string;
    gameMode: 'quick' | 'classic' | 'slutprov';
    isVsAi?: boolean;
    aiDifficulty?: 'easy' | 'medium' | 'master';
  }) {
    try {
      const mode = data.gameMode || 'quick';
      const questionCount = mode === 'quick' ? 10 : mode === 'classic' ? 20 : 65;
      const questions = this.pickRandomQuestions(questionCount);

      const duelCode = `DUEL-${Math.floor(1000 + Math.random() * 9000)}`;

      const isVsAi = !!data.isVsAi;
      const aiDiff = data.aiDifficulty || 'medium';

      let aiName = 'AI-Utmanaren 🤖';
      let aiScore = 0;
      let aiCorrect = 0;
      let aiFinished = false;

      // Om duellen är mot AI, simulera AI-motståndarens resultat i förväg
      if (isVsAi) {
        if (aiDiff === 'easy') {
          aiName = 'AI-Övningsköraren 🚗';
          aiCorrect = Math.round(questionCount * (0.6 + Math.random() * 0.15));
        } else if (aiDiff === 'master') {
          aiName = 'AI-Trafikinspektören 👑';
          aiCorrect = Math.min(questionCount, Math.round(questionCount * (0.9 + Math.random() * 0.08)));
        } else {
          aiName = 'AI-Trafikläraren 🤖';
          aiCorrect = Math.round(questionCount * (0.78 + Math.random() * 0.12));
        }
        aiScore = aiCorrect * 100 + Math.floor(Math.random() * 350);
        aiFinished = true;
      }

      const duel = await this.prisma.duel.create({
        data: {
          code: duelCode,
          game_mode: mode,
          creator_id: data.creatorId || null,
          creator_name: data.creatorName || 'Spelare 1',
          creator_score: 0,
          creator_correct: 0,
          creator_finished: false,

          challenger_id: isVsAi ? 'ai_bot' : null,
          challenger_name: isVsAi ? aiName : null,
          challenger_score: aiScore,
          challenger_correct: aiCorrect,
          challenger_finished: aiFinished,

          is_vs_ai: isVsAi,
          ai_difficulty: isVsAi ? aiDiff : null,
          status: isVsAi ? 'active' : 'waiting',
          questions: questions as any,
        },
      });

      return {
        success: true,
        duel: {
          id: duel.id,
          code: duel.code,
          gameMode: duel.game_mode,
          questionCount,
          creatorName: duel.creator_name,
          challengerName: duel.challenger_name,
          isVsAi: duel.is_vs_ai,
          status: duel.status,
          questions: duel.questions,
        },
      };
    } catch (error) {
      console.error('[DuelService] Error creating duel:', error);
      throw new HttpException('Kunde inte skapa duellen', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 2. Hämta duellstatus och frågor
  async getDuel(code: string) {
    const duel = await this.prisma.duel.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!duel) {
      throw new HttpException('Duellen hittades inte eller har löpt ut.', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      duel: {
        id: duel.id,
        code: duel.code,
        gameMode: duel.game_mode,
        creatorName: duel.creator_name,
        creatorScore: duel.creator_score,
        creatorCorrect: duel.creator_correct,
        creatorFinished: duel.creator_finished,
        challengerName: duel.challenger_name,
        challengerScore: duel.challenger_score,
        challengerCorrect: duel.challenger_correct,
        challengerFinished: duel.challenger_finished,
        isVsAi: duel.is_vs_ai,
        status: duel.status,
        winnerName: duel.winner_name,
        questions: duel.questions,
      },
    };
  }

  // 3. Motståndare går med i duellen
  async joinDuel(code: string, data: { challengerId?: string; challengerName: string }) {
    const cleanCode = code.toUpperCase();
    const duel = await this.prisma.duel.findUnique({ where: { code: cleanCode } });

    if (!duel) {
      throw new HttpException('Duellen hittades inte.', HttpStatus.NOT_FOUND);
    }

    if (duel.status === 'completed') {
      throw new HttpException('Denna duell är redan avslutad.', HttpStatus.BAD_REQUEST);
    }

    const updated = await this.prisma.duel.update({
      where: { code: cleanCode },
      data: {
        challenger_id: data.challengerId || null,
        challenger_name: data.challengerName || 'Utmanare',
        status: 'active',
      },
    });

    return {
      success: true,
      duel: updated,
    };
  }

  // 4. Lämna in resultat för en spelare
  async submitScore(code: string, data: {
    role: 'creator' | 'challenger';
    score: number;
    correctCount: number;
    answers?: any[];
  }) {
    const cleanCode = code.toUpperCase();
    const duel = await this.prisma.duel.findUnique({ where: { code: cleanCode } });

    if (!duel) {
      throw new HttpException('Duellen hittades inte.', HttpStatus.NOT_FOUND);
    }

    let updateData: any = {};
    if (data.role === 'creator') {
      updateData.creator_score = data.score;
      updateData.creator_correct = data.correctCount;
      updateData.creator_finished = true;
      updateData.creator_answers = data.answers || [];
    } else {
      updateData.challenger_score = data.score;
      updateData.challenger_correct = data.correctCount;
      updateData.challenger_finished = true;
      updateData.challenger_answers = data.answers || [];
    }

    // Kolla om båda spelarna nu är färdiga
    const creatorDone = data.role === 'creator' ? true : duel.creator_finished;
    const challengerDone = data.role === 'challenger' ? true : duel.challenger_finished;

    if (creatorDone && challengerDone) {
      const finalCreatorScore = data.role === 'creator' ? data.score : duel.creator_score;
      const finalChallengerScore = data.role === 'challenger' ? data.score : duel.challenger_score;

      let winner = 'Oavgjort';
      if (finalCreatorScore > finalChallengerScore) {
        winner = duel.creator_name;
      } else if (finalChallengerScore > finalCreatorScore) {
        winner = duel.challenger_name || 'Utmanaren';
      }

      updateData.status = 'completed';
      updateData.winner_name = winner;
    }

    const updated = await this.prisma.duel.update({
      where: { code: cleanCode },
      data: updateData,
    });

    return {
      success: true,
      isCompleted: updated.status === 'completed',
      winnerName: updated.winner_name,
      duel: {
        code: updated.code,
        status: updated.status,
        creatorName: updated.creator_name,
        creatorScore: updated.creator_score,
        creatorCorrect: updated.creator_correct,
        creatorFinished: updated.creator_finished,
        challengerName: updated.challenger_name,
        challengerScore: updated.challenger_score,
        challengerCorrect: updated.challenger_correct,
        challengerFinished: updated.challenger_finished,
        winnerName: updated.winner_name,
      },
    };
  }

  // 5. Topplista / Duell-ligan (Hall of Fame baserad på verkliga dueller i databasen)
  async getLeaderboard() {
    try {
      const totalDuels = await this.prisma.duel.count();
      const completedDuels = await this.prisma.duel.findMany({
        where: { status: 'completed' },
        orderBy: { updated_at: 'desc' },
      });

      // Aggregera vinster och poäng per förare
      const playerStats: Record<string, { wins: number; totalScore: number; games: number }> = {};

      completedDuels.forEach((d) => {
        if (d.creator_name) {
          if (!playerStats[d.creator_name]) playerStats[d.creator_name] = { wins: 0, totalScore: 0, games: 0 };
          playerStats[d.creator_name].games++;
          playerStats[d.creator_name].totalScore += d.creator_score;
          if (d.winner_name === d.creator_name) playerStats[d.creator_name].wins++;
        }
        if (d.challenger_name && !d.is_vs_ai) {
          if (!playerStats[d.challenger_name]) playerStats[d.challenger_name] = { wins: 0, totalScore: 0, games: 0 };
          playerStats[d.challenger_name].games++;
          playerStats[d.challenger_name].totalScore += d.challenger_score;
          if (d.winner_name === d.challenger_name) playerStats[d.challenger_name].wins++;
        }
      });

      // Konvertera till sorterad lista
      const sorted = Object.entries(playerStats)
        .map(([name, stat]) => ({
          name,
          wins: stat.wins,
          games: stat.games,
          winRate: stat.games > 0 ? Math.round((stat.wins / stat.games) * 100) : 0,
          score: stat.totalScore,
        }))
        .sort((a, b) => b.score - a.score || b.wins - a.wins);

      const badges = ['🥇', '🥈', '🥉'];
      const leaderboard = sorted.slice(0, 10).map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        wins: p.wins,
        winRate: p.winRate,
        score: p.score,
        tier: idx === 0 ? 'Trafikmästare 👑' : idx < 3 ? 'Guld-Förare 💎' : 'Silver-Förare ⚡',
        badge: badges[idx] || String(idx + 1),
      }));

      return {
        success: true,
        season: 'Säsong 1 – 2026',
        totalDuelsPlayed: totalDuels,
        leaderboard,
      };
    } catch (err) {
      console.error('[DuelService] Error calculating leaderboard:', err);
      return {
        success: true,
        season: 'Säsong 1 – 2026',
        totalDuelsPlayed: 0,
        leaderboard: [],
      };
    }
  }
}
