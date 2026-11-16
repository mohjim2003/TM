import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import generalQuestion from '../../../data/generalQuestion';
import { PrismaService } from '../../../prisma/prisma.service';

export interface QuizQuestionItem {
  id: number;
  question: string;
  options: string[];
  answer: string;
  category: 'miljo' | 'trafikregler' | 'vagmärken' | 'fordon' | 'manniskan';
  imageUrl?: string;
}

export const CATEGORIES = [
  {
    id: 'slutprov',
    name: 'Slutprov (Trafikverket)',
    description: '65 slumpade frågor – kräver minst 52 rätt för godkänt (80%)',
    icon: '🏆',
    totalQuestions: 65,
    passingScore: 52,
  },
  {
    id: 'trafikregler',
    name: 'Trafikregler & Vägar',
    description: 'Hastighet, väjningsplikt, omkörning och placering',
    icon: '🚦',
    totalQuestions: 30,
    passingScore: 24,
  },
  {
    id: 'miljo',
    name: 'Miljö & Ecodriving',
    description: 'Bränslesnål körning, utsläpp och miljöpåverkan',
    icon: '🌲',
    totalQuestions: 30,
    passingScore: 24,
  },
  {
    id: 'vagmärken',
    name: 'Vägmärken & Skyltar',
    description: 'Varnings-, förbuds-, påbuds- och anvisningsmärken',
    icon: '🛑',
    totalQuestions: 30,
    passingScore: 24,
  },
  {
    id: 'fordon',
    name: 'Fordon & Säkerhet',
    description: 'Däck, bromsar, belysning, last och kontroll',
    icon: '🚗',
    totalQuestions: 30,
    passingScore: 24,
  },
  {
    id: 'manniskan',
    name: 'Människan i trafiken',
    description: 'Alkohol, trötthet, reaktionstid och distraktioner',
    icon: '🧠',
    totalQuestions: 30,
    passingScore: 24,
  },
];

function categorizeQuestion(q: { question: string; options?: string[] }): 'miljo' | 'trafikregler' | 'vagmärken' | 'fordon' | 'manniskan' {
  const text = (q.question + ' ' + (q.options || []).join(' ')).toLowerCase();
  if (
    text.includes('miljö') ||
    text.includes('bränsle') ||
    text.includes('katalysator') ||
    text.includes('avgaser') ||
    text.includes('försurn') ||
    text.includes('koldioxid') ||
    text.includes('eco-driving') ||
    text.includes('ecodriving') ||
    text.includes('utsläpp')
  ) {
    return 'miljo';
  }

  if (
    text.includes('skylt') ||
    text.includes('märke') ||
    text.includes('vägmärke') ||
    text.includes('linje') ||
    text.includes('heldragen') ||
    text.includes('signal') ||
    text.includes('ljussignal') ||
    text.includes('pil') ||
    text.includes('symbol')
  ) {
    return 'vagmärken';
  }

  if (
    text.includes('däck') ||
    text.includes('broms') ||
    text.includes('belysning') ||
    text.includes('lampa') ||
    text.includes('lykta') ||
    text.includes('dimljus') ||
    text.includes('helljus') ||
    text.includes('halvljus') ||
    text.includes('släp') ||
    text.includes('last') ||
    text.includes('motor') ||
    text.includes('service') ||
    text.includes('olja') ||
    text.includes('besiktning')
  ) {
    return 'fordon';
  }

  if (
    text.includes('alkohol') ||
    text.includes('promille') ||
    text.includes('trött') ||
    text.includes('mobil') ||
    text.includes('telefon') ||
    text.includes('reaktion') ||
    text.includes('syn') ||
    text.includes('medicin') ||
    text.includes('droger') ||
    text.includes('stress')
  ) {
    return 'manniskan';
  }

  return 'trafikregler';
}

@Injectable()
export class QuizTestService {
  private allQuestions: QuizQuestionItem[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.loadQuestions();
  }

  private loadQuestions() {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'src', 'data', 'questionData.json'),
        path.resolve(process.cwd(), 'dist', 'data', 'questionData.json'),
        path.resolve(process.cwd(), '..', 'frontend', 'public', 'questionData.json'),
      ];

      let rawQuestions: any[] = [];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            const content = fs.readFileSync(candidate, 'utf-8');
            rawQuestions = JSON.parse(content);
            if (rawQuestions && rawQuestions.length > 0) break;
          } catch (e) {
            // continue
          }
        }
      }

      if (!rawQuestions || rawQuestions.length === 0) {
        rawQuestions = generalQuestion as any[];
      }

      this.allQuestions = rawQuestions.map((q, index) => ({
        id: index + 1,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        category: categorizeQuestion(q),
        imageUrl: q.imageUrl || undefined,
      }));

      console.log(`[QuizTestService] Loaded ${this.allQuestions.length} questions.`);
    } catch (error) {
      console.error('[QuizTestService] Failed to load questions:', error);
      this.allQuestions = (generalQuestion as any[]).map((q, index) => ({
        id: index + 1,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        category: categorizeQuestion(q),
      }));
    }
  }

  getCategories(isSubscribed: boolean = true) {
    return CATEGORIES.map((cat) => ({
      ...cat,
      isLocked: false, // 100% gratis och upplåst för alla elever!
    }));
  }

  async getQuestions({
    category = 'slutprov',
    isSubscribed = true,
    userId,
  }: {
    category?: string;
    isSubscribed?: boolean;
    userId?: string;
  }) {
    if (this.allQuestions.length === 0) {
      this.loadQuestions();
    }

    const categoriesWithLock = this.getCategories(true);

    let activeCategory = (category || 'slutprov').toLowerCase();
    if (activeCategory === 'alla') {
      activeCategory = 'slutprov';
    }

    let pool: QuizQuestionItem[] = [];
    let passingScore = 24;
    let targetCount = 30;

    if (activeCategory === 'slutprov') {
      // Slutprov: 65 frågor slumpas med balanserad fördelning över Trafikverkets delar
      targetCount = 65;
      passingScore = 52; // Trafikverkets officiella gräns: 52 av 65 (80%)
      pool = this.generateSlutprovQuestions(65);
    } else if (activeCategory === 'weaknesses' || activeCategory === 'svagheter') {
      // Anpassad träning baserad på användarens svagheter
      targetCount = 30;
      passingScore = 24;
      pool = await this.generateWeaknessQuestions(userId, 30);
    } else {
      // Specifik kategori (t.ex. miljo, trafikregler, etc.)
      const filtered = this.allQuestions.filter((q) => q.category === activeCategory);
      const shuffled = [...(filtered.length > 0 ? filtered : this.allQuestions)].sort(() => Math.random() - 0.5);
      pool = shuffled.slice(0, 30);
      targetCount = pool.length;
      passingScore = Math.ceil(pool.length * 0.8);
    }

    const catInfo = CATEGORIES.find((c) => c.id === activeCategory) || {
      id: activeCategory,
      name: activeCategory === 'weaknesses' ? 'AI-Träning: Svaga Områden' : 'Övningsprov',
      description: 'Anpassade teorifrågor',
      icon: '⚡',
      totalQuestions: targetCount,
      passingScore,
    };

    return {
      isSubscribed: true,
      isTestMode: false,
      category: activeCategory,
      categoryTitle: catInfo.name,
      totalQuestions: pool.length,
      passingScore,
      questions: pool,
      categories: categoriesWithLock,
    };
  }

  // Genererar 65 frågor till Slutprov med balanserad fördelning
  private generateSlutprovQuestions(total: number = 65): QuizQuestionItem[] {
    const categories: ('trafikregler' | 'vagmärken' | 'miljo' | 'fordon' | 'manniskan')[] = [
      'trafikregler',
      'vagmärken',
      'miljo',
      'fordon',
      'manniskan',
    ];

    // Trafikverkets fördelning: ~16 regler, ~15 vägmärken, ~12 fordon, ~11 miljö, ~11 människan
    const quota: Record<string, number> = {
      trafikregler: 16,
      vagmärken: 15,
      fordon: 12,
      miljo: 11,
      manniskan: 11,
    };

    const selected: QuizQuestionItem[] = [];
    const usedIds = new Set<number>();

    for (const cat of categories) {
      const needed = quota[cat] || 13;
      const catQuestions = this.allQuestions.filter((q) => q.category === cat && !usedIds.has(q.id));
      const shuffled = [...catQuestions].sort(() => Math.random() - 0.5);
      const take = shuffled.slice(0, needed);
      for (const q of take) {
        selected.push(q);
        usedIds.add(q.id);
      }
    }

    // Om vi behöver fler för att nå exakt 65, fyll på från resterande slumpade frågor
    if (selected.length < total) {
      const remaining = this.allQuestions.filter((q) => !usedIds.has(q.id)).sort(() => Math.random() - 0.5);
      for (const q of remaining) {
        selected.push(q);
        usedIds.add(q.id);
        if (selected.length >= total) break;
      }
    }

    // Slumpa slutordningen så frågor från olika områden blandas naturligt
    return selected.sort(() => Math.random() - 0.5).slice(0, total);
  }

  // Hämtar frågor med fokus på användarens svaga områden
  private async generateWeaknessQuestions(userId: string | undefined, count: number = 30): Promise<QuizQuestionItem[]> {
    let targetCat: 'miljo' | 'trafikregler' | 'vagmärken' | 'fordon' | 'manniskan' = 'miljo';

    if (userId) {
      try {
        const coach = await this.getAiCoachRecommendation(userId);
        if (coach?.weakestCategory) {
          targetCat = coach.weakestCategory as any;
        }
      } catch (e) {
        // fallback to default
      }
    }

    const filtered = this.allQuestions.filter((q) => q.category === targetCat);
    const pool = filtered.length >= count ? filtered : this.allQuestions;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  }

  private getRepresentativeTestQuestions(count: number = 5): QuizQuestionItem[] {
    const cats: ('trafikregler' | 'miljo' | 'vagmärken' | 'fordon' | 'manniskan')[] = [
      'trafikregler',
      'vagmärken',
      'miljo',
      'fordon',
      'manniskan',
    ];

    const chosen: QuizQuestionItem[] = [];

    for (const cat of cats) {
      const match = this.allQuestions.find((q) => q.category === cat && !chosen.some((c) => c.id === q.id));
      if (match) {
        chosen.push(match);
      }
    }

    if (chosen.length < count) {
      for (const q of this.allQuestions) {
        if (!chosen.some((c) => c.id === q.id)) {
          chosen.push(q);
          if (chosen.length >= count) break;
        }
      }
    }

    return chosen.slice(0, count);
  }

  // Beräknar resultat och sparar i databasen om userId skickas med
  async calculateResults(data: {
    answers: (string | null)[];
    questions?: QuizQuestionItem[];
    userId?: string;
    category?: string;
    timeSpentSec?: number;
  }) {
    try {
      const answers = data.answers || [];
      const questions = data.questions || [];
      const category = (data.category || 'slutprov').toLowerCase();

      let correctCount = 0;
      let incorrectCount = 0;
      let skippedCount = 0;

      // Kategori-sammanställning
      const categoryStats: Record<string, { correct: number; total: number; name: string }> = {
        trafikregler: { correct: 0, total: 0, name: 'Trafikregler & Vägar' },
        vagmärken: { correct: 0, total: 0, name: 'Vägmärken & Skyltar' },
        miljo: { correct: 0, total: 0, name: 'Miljö & Ecodriving' },
        fordon: { correct: 0, total: 0, name: 'Fordon & Säkerhet' },
        manniskan: { correct: 0, total: 0, name: 'Människan i trafiken' },
      };

      const detailedResults = questions.map((q, index) => {
        const userAnswer = answers[index] || null;
        const correctAnswer = q.answer;
        const isCorrect =
          userAnswer !== null &&
          userAnswer.trim().toLowerCase() === (correctAnswer || '').trim().toLowerCase();

        const catKey = q.category || 'trafikregler';
        if (!categoryStats[catKey]) {
          categoryStats[catKey] = { correct: 0, total: 0, name: catKey };
        }
        categoryStats[catKey].total++;

        if (userAnswer === null) {
          skippedCount++;
        } else if (isCorrect) {
          correctCount++;
          categoryStats[catKey].correct++;
        } else {
          incorrectCount++;
        }

        return {
          questionNumber: index + 1,
          question: q.question,
          options: q.options,
          correctAnswer,
          userAnswer: userAnswer || 'Ej besvarad',
          isCorrect,
          category: q.category,
        };
      });

      const totalQuestions = questions.length || answers.length || 1;
      const percentageScore = Math.round((correctCount / totalQuestions) * 100);

      // Trafikverkets godkänd-regel:
      // Slutprov (65 frågor): Kräver minst 52 rätt (80%).
      // Delmoment är enskild träning (oftast 30 frågor).
      const isSlutprov = (category === 'slutprov' || category === 'alla') && totalQuestions >= 60;
      const requiredScore = isSlutprov ? 52 : Math.ceil(totalQuestions * 0.8);
      const passed = isSlutprov ? correctCount >= 52 : percentageScore >= 80;

      // Bygg breakdown-objekt
      const categoryBreakdown: Record<string, { correct: number; total: number; percent: number; name: string }> = {};
      for (const [key, val] of Object.entries(categoryStats)) {
        if (val.total > 0) {
          categoryBreakdown[key] = {
            correct: val.correct,
            total: val.total,
            percent: Math.round((val.correct / val.total) * 100),
            name: val.name,
          };
        }
      }

      const categoryTitle = isSlutprov
        ? 'Slutprov (Trafikverket)'
        : CATEGORIES.find((c) => c.id === category)?.name || 'Övningsmoment';

      let savedRecordId: string | null = null;

      // Spara i databasen ENDAST för fullständiga Slutprov (65 frågor).
      // Enskilda delmoment sparas INTE i historiken enligt användarens krav.
      if (data.userId && isSlutprov) {
        try {
          const saved = await this.prisma.quizResult.create({
            data: {
              user_id: data.userId,
              category: 'slutprov',
              category_title: 'Slutprov (Trafikverket)',
              total_questions: totalQuestions,
              correct_count: correctCount,
              incorrect_count: incorrectCount,
              score_percent: percentageScore,
              passed: passed,
              time_spent_sec: data.timeSpentSec || 0,
              category_breakdown: categoryBreakdown,
              details: detailedResults,
            },
          });
          savedRecordId = saved.id;
          console.log(`[QuizTestService] Slutprov sparat i DB för användare ${data.userId}, id: ${saved.id}`);
        } catch (dbErr) {
          console.error('[QuizTestService] Kunde inte spara provresultat i DB:', dbErr);
        }
      }

      return {
        success: true,
        savedToDb: !!savedRecordId,
        isPracticeOnly: !isSlutprov,
        resultId: savedRecordId,
        correctCount,
        incorrectCount,
        skippedCount,
        totalQuestions,
        percentageScore,
        requiredScore,
        passed,
        isSlutprov,
        category,
        categoryTitle,
        categoryBreakdown,
        detailedResults,
      };
    } catch (error) {
      console.error('[QuizTestService] Failed to calculate results:', error);
      throw new HttpException('Failed to calculate results', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Hämta användarens tidigare provhistorik från databasen (endast fullständiga 65-frågors slutprov)
  async getUserHistory(userId: string) {
    try {
      const records = await this.prisma.quizResult.findMany({
        where: {
          user_id: userId,
          OR: [
            { category: 'slutprov' },
            { category: 'alla' },
            { total_questions: { gte: 60 } },
          ],
        },
        orderBy: { created_at: 'desc' },
        take: 40,
        select: {
          id: true,
          category: true,
          category_title: true,
          total_questions: true,
          correct_count: true,
          incorrect_count: true,
          score_percent: true,
          passed: true,
          time_spent_sec: true,
          category_breakdown: true,
          details: true,
          created_at: true,
        },
      });

      const totalAttempts = records.length;
      const passedAttempts = records.filter((r) => r.passed).length;
      const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
      const averageScore =
        totalAttempts > 0
          ? Math.round(records.reduce((acc, curr) => acc + curr.score_percent, 0) / totalAttempts)
          : 0;
      const bestScore = totalAttempts > 0 ? Math.max(...records.map((r) => r.score_percent)) : 0;

      return {
        success: true,
        stats: {
          totalAttempts,
          passedAttempts,
          passRate,
          averageScore,
          bestScore,
        },
        history: records,
      };
    } catch (error) {
      console.error('[QuizTestService] Fel vid hämtning av användarhistorik:', error);
      throw new HttpException('Kunde inte hämta provhistorik', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Hämta detaljer för ett specifikt prov
  async getExamDetail(resultId: string, userId: string) {
    try {
      const record = await this.prisma.quizResult.findFirst({
        where: { id: resultId, user_id: userId },
      });

      if (!record) {
        throw new HttpException('Provresultatet hittades inte.', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        result: record,
      };
    } catch (error) {
      throw new HttpException(error.message || 'Kunde inte hämta provdetaljer', HttpStatus.BAD_REQUEST);
    }
  }

  // Smart AI Coach: analyserar användarens svaga områden och genererar anpassade råd
  async getAiCoachRecommendation(userId: string) {
    try {
      const records = await this.prisma.quizResult.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          category: true,
          score_percent: true,
          passed: true,
          category_breakdown: true,
        },
      });

      // Om användaren inte har gjort några prov än
      if (records.length === 0) {
        return {
          hasData: false,
          headline: 'Välkommen till din personliga AI-coach!',
          message:
            'Gör ditt första Slutprov (65 frågor) så att jag kan analysera dina styrkor och svagheter och skräddarsy din träning.',
          recommendedCategory: 'slutprov',
          recommendedActionText: 'Starta ditt första Slutprov nu',
        };
      }

      // Samla ihop statistik per kategori från alla prov
      const aggregated: Record<string, { correct: number; total: number; name: string }> = {
        miljo: { correct: 0, total: 0, name: 'Miljö & Ecodriving' },
        trafikregler: { correct: 0, total: 0, name: 'Trafikregler & Vägar' },
        vagmärken: { correct: 0, total: 0, name: 'Vägmärken & Skyltar' },
        fordon: { correct: 0, total: 0, name: 'Fordon & Säkerhet' },
        manniskan: { correct: 0, total: 0, name: 'Människan i trafiken' },
      };

      for (const rec of records) {
        const breakdown = rec.category_breakdown as Record<string, { correct: number; total: number }> | null;
        if (breakdown) {
          for (const [catKey, val] of Object.entries(breakdown)) {
            if (aggregated[catKey]) {
              aggregated[catKey].correct += val.correct || 0;
              aggregated[catKey].total += val.total || 0;
            }
          }
        }
      }

      // Hitta kategorin med lägst träffsäkerhet
      let weakestKey = 'miljo';
      let lowestAccuracy = 100;
      let highestAccuracy = 0;
      let strongestKey = 'trafikregler';

      for (const [key, val] of Object.entries(aggregated)) {
        if (val.total >= 3) {
          const acc = Math.round((val.correct / val.total) * 100);
          if (acc < lowestAccuracy) {
            lowestAccuracy = acc;
            weakestKey = key;
          }
          if (acc > highestAccuracy) {
            highestAccuracy = acc;
            strongestKey = key;
          }
        }
      }

      const weakestName = aggregated[weakestKey]?.name || 'Miljö & Ecodriving';
      const strongestName = aggregated[strongestKey]?.name || 'Trafikregler';

      const pedagogicalTips: Record<string, string[]> = {
        miljo: [
          'Katalysatorn fungerar först när den når 400–600 °C – undvik onödiga korta körsträckor.',
          'Använd motorvärmare redan vid +10 °C för att minska bränsleförbrukning och kalla avgaser.',
          'Kör på högsta möjliga växel och motorbromsa i god tid fram mot korsningar.',
        ],
        trafikregler: [
          'Högerregeln gäller överallt där inget annat märke eller signal styr.',
          'Vid vänstersväng har du alltid väjningsplikt mot mötande trafik.',
          'Körfältsbyte kräver alltid god uppsikt, blinkers i god tid och kontroll av döda vinkeln.',
        ],
        vagmärken: [
          'Varningsmärken varnar för fara – sänk farten och öka uppmärksamheten.',
          'Förbudsmärken har gul botten med röd bård och gäller fram till nästa korsning om inget annat anges.',
          'Påbudsmärken har blå botten och visar vad du MÅSTE göra (t.ex. påbjuden körriktning).',
        ],
        fordon: [
          'Minsta mönsterdjup på sommardäck är 1,6 mm (rekommenderat minst 3 mm).',
          'Vinterdäck kräver minst 3,0 mm mönsterdjup.',
          'Kontrollera däcktrycket regelbundet för bättre säkerhet och lägre bränsleförbrukning.',
        ],
        manniskan: [
          'Gränsen för rattfylleri i Sverige är 0,2 promille alkohol i blodet.',
          'Trötthet i trafiken är lika farligt som alkohol – ta paus varannan timme vid långkörning.',
          'Vid 90 km/h rör sig bilen 25 meter på bara en sekund – håll alltid 3-sekundersregeln.',
        ],
      };

      let dynamicCoachMessage = `Jag har analyserat dina senaste prov och ser att du har lägst resultat inom **${weakestName}** (${lowestAccuracy === 100 ? 55 : lowestAccuracy}% rätt). Vill du göra ett anpassat träningspass med fokus på just detta så du säkrar godkänt på Trafikverket?`;

      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMENI_API_KEY || '';
        if (apiKey) {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          const prompt = `Du är en svensk personlig AI-trafiklärare och teoricoach.
En körkortselev har gjort prov och statistiken visar:
- Svagaste delmoment: ${weakestName} (${lowestAccuracy === 100 ? 55 : lowestAccuracy}% rätt)
- Starkaste delmoment: ${strongestName} (${highestAccuracy}% rätt)
Skriv ett personligt, pedagogiskt och uppmuntrande meddelande till eleven (högst 70 ord).
Inkludera:
1. "Jag märker att du ofta får fel på ${weakestName}..."
2. En konkret svensk trafikregel eller minnesregel för ${weakestName}.
3. Uppmana eleven att köra ett övningspass på ${weakestName} nu.`;

          const aiRes = await model.generateContent(prompt);
          const text = aiRes.response.text();
          if (text && text.trim().length > 15) {
            dynamicCoachMessage = text.trim();
          }
        }
      } catch (aiErr) {
        console.warn('[QuizTestService] Gemini coach API warning (using fallback):', aiErr?.message || aiErr);
      }

      return {
        hasData: true,
        weakestCategory: weakestKey,
        weakestCategoryName: weakestName,
        weakestAccuracy: lowestAccuracy === 100 ? 55 : lowestAccuracy,
        strongestCategoryName: strongestName,
        strongestAccuracy: highestAccuracy,
        headline: `AI-Analys: Jag märker att du ofta får fel på ${weakestName}`,
        message: dynamicCoachMessage,
        recommendedCategory: weakestKey,
        recommendedActionText: `Öva mer på ${weakestName} nu`,
        keyTips: pedagogicalTips[weakestKey] || pedagogicalTips['miljo'],
      };
    } catch (error) {
      console.error('[QuizTestService] Fel i getAiCoachRecommendation:', error);
      return {
        hasData: false,
        headline: 'AI Coach redo!',
        message: 'Gör ett prov så analyserar jag dina svagheter och ger personliga råd.',
        recommendedCategory: 'slutprov',
        recommendedActionText: 'Starta Slutprov',
      };
    }
  }
}
