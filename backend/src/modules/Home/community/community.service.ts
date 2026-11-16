import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface LanguageRoom {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  description: string;
  topics: string[];
  messageCount: number;
  activeUsers: number;
  latestMessage?: {
    userName: string;
    text: string;
    createdAt: string;
  };
}

export const LANGUAGE_ROOMS: Omit<LanguageRoom, 'messageCount' | 'activeUsers' | 'latestMessage'>[] = [
  {
    id: 'sv',
    name: 'Svenska',
    nativeName: 'Svenska Körkortsforumet',
    flag: '🇸🇪',
    description: 'Diskutera Trafikverkets teoriprov, svåra trafikregler, uppkörningstips och hjälpsamma råd.',
    topics: ['Allmänt', 'Teoriprovet', 'Trafikregler & Skyltar', 'Uppkörning', 'Tips & Erfarenheter'],
  },
  {
    id: 'en',
    name: 'English',
    nativeName: 'English Driver Community',
    flag: '🇬🇧',
    description: 'Help & advice for getting your driving license in Sweden. Theory questions, rules and test experiences.',
    topics: ['General', 'Theory Test', 'Rules & Signs', 'Driving Test', 'Tips & FAQ'],
  },
  {
    id: 'ar',
    name: 'Arabiska',
    nativeName: 'العربية (منتدى التيوري)',
    flag: '🇸🇦',
    description: 'المنتدى العربي لمساعدة الطلاب في اجتياز امتحان رخصة القيادة السويدية (التيوري والفحص العملي).',
    topics: ['عام', 'امتحان التيوري', 'قواعد المرور والإشارات', 'الفحص العملي (القيادة)', 'نصائح وتجارب'],
  },
  {
    id: 'fa',
    name: 'Persiska / Dari',
    nativeName: 'فارسی / دری (گواهینامه سوئد)',
    flag: '🇮🇷',
    description: 'انجمن همیاری برای گواهینامه رانندگی در سوئد. سوالات آزمون تئوری، علائم و تجارب امتحان شهر.',
    topics: ['عمومی', 'آزمون تئوری', 'قوانین و تابلوها', 'آزمون رانندگی (شهر)', 'راهنمایی و تجربیات'],
  },
  {
    id: 'so',
    name: 'Somaliska',
    nativeName: 'Soomaali (Wadista Gaariga)',
    flag: '🇸🇴',
    description: 'Qeybta luuqada Soomaaliga ee shatiga baabuurta Iswiidhan. Iska caawi su’aalaha iyo shuruucda.',
    topics: ['Guud', 'Imtixaanka Aragtida (Teori)', 'Sharciyada & Calaamadaha', 'Imtixaanka Wadista', 'Talooyin'],
  },
  {
    id: 'ti',
    name: 'Tigrinja',
    nativeName: 'ትግርኛ (ፈተና መምርሒ ማኪና)',
    flag: '🇪🇷',
    description: 'ናይ ትግርኛ መድረኽ ምምይያጥን ምትሕግጋዝን ንፈተና መምርሒ ማኪና ኣብ ሽወደን።',
    topics: ['ሓፈሻዊ', 'ፈተና ቲዮሪ', 'ሕግታትን ምልክታትን', 'ፈተና ምዝዋር', 'ምኽርን ተሞክሮን'],
  },
  {
    id: 'tr',
    name: 'Turkiska',
    nativeName: 'Türkçe (İsveç Ehliyet Forumu)',
    flag: '🇹🇷',
    description: 'İsveç ehliyet sınavına hazırlananlar için yardımlaşma ve soru-cevap forumu.',
    topics: ['Genel', 'Teori Sınavı', 'Trafik Kuralları & Levhalar', 'Direksiyon Sınavı', 'İpuçları & Deneyimler'],
  },
  {
    id: 'uk',
    name: 'Ukrainska',
    nativeName: 'Українська (Водійські права)',
    flag: '🇺🇦',
    description: 'Форум взаємодопомоги для складання іспитів на водійські права у Швеції.',
    topics: ['Загальне', 'Теоретичний іспит', 'Правила дорожнього руху', 'Практичний іспиت', 'Поради'],
  },
  {
    id: 'es',
    name: 'Spanska',
    nativeName: 'Español (Licencia de Conducir)',
    flag: '🇪🇸',
    description: 'Comunidad en español para preparar la licencia de conducir en Suecia (teoría y práctica).',
    topics: ['General', 'Examen Teórico', 'Reglas y Señales', 'Examen Práctico', 'Consejos y Experiencias'],
  },
];

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Hämta alla tillgängliga språkrum med realtidsstatistik från databasen
  async getRooms(): Promise<LanguageRoom[]> {
    try {
      const counts = await this.prisma.communityMessage.groupBy({
        by: ['language'],
        _count: {
          id: true,
        },
      });

      const countMap: Record<string, number> = {};
      counts.forEach((c) => {
        countMap[c.language] = c._count.id;
      });

      const rooms: LanguageRoom[] = [];

      for (const roomDef of LANGUAGE_ROOMS) {
        const totalCount = countMap[roomDef.id] || 0;

        // Hämta senaste meddelande om det finns i databasen
        let latestMsg: { userName: string; text: string; createdAt: string } | undefined;
        try {
          const latest = await this.prisma.communityMessage.findFirst({
            where: { language: roomDef.id },
            orderBy: { created_at: 'desc' },
            select: { user_name: true, message: true, created_at: true },
          });
          if (latest) {
            latestMsg = {
              userName: latest.user_name,
              text: latest.message.length > 60 ? latest.message.substring(0, 57) + '...' : latest.message,
              createdAt: latest.created_at.toISOString(),
            };
          }
        } catch {
          // fallback
        }

        rooms.push({
          ...roomDef,
          messageCount: totalCount,
          activeUsers: totalCount > 0 ? Math.min(25, Math.max(1, totalCount)) : 0,
          latestMessage: latestMsg,
        });
      }

      return rooms;
    } catch (error) {
      console.error('[CommunityService] Error getting rooms:', error);
      return LANGUAGE_ROOMS.map((r) => ({
        ...r,
        messageCount: 0,
        activeUsers: 0,
      }));
    }
  }

  // 2. Hämta meddelanden för ett visst språkrum (endast äkta från DB)
  async getMessages(language: string = 'sv', topic?: string) {
    try {
      const cleanLang = (language || 'sv').toLowerCase();

      const whereClause: any = { language: cleanLang };
      if (topic && topic !== 'Alla' && topic !== 'Allmänt' && topic !== 'All') {
        whereClause.topic = topic;
      }

      const dbMessages = await this.prisma.communityMessage.findMany({
        where: whereClause,
        orderBy: { created_at: 'asc' },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              type: true,
              avatar: true,
            },
          },
        },
      });

      return {
        success: true,
        language: cleanLang,
        room: LANGUAGE_ROOMS.find((r) => r.id === cleanLang) || LANGUAGE_ROOMS[0],
        total: dbMessages.length,
        messages: dbMessages.map((m) => ({
          id: m.id,
          userName: m.user ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user_name : m.user_name,
          userRole: m.user?.type || m.user_role || 'user',
          userEmail: m.user?.email || m.user_email || undefined,
          avatar: m.user?.avatar || undefined,
          topic: m.topic || 'Allmänt',
          message: m.message,
          likesCount: m.likes_count,
          parentId: m.parent_id,
          createdAt: m.created_at,
        })),
      };
    } catch (error) {
      console.error('[CommunityService] Error fetching messages:', error);
      throw new HttpException('Kunde inte hämta meddelanden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 3. Posta ett nytt meddelande
  async postMessage(data: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    language: string;
    message: string;
    topic?: string;
    parentId?: string;
  }) {
    try {
      if (!data.message || data.message.trim().length === 0) {
        throw new HttpException('Meddelandet får inte vara tomt.', HttpStatus.BAD_REQUEST);
      }

      const cleanLang = (data.language || 'sv').toLowerCase();
      let senderName = data.userName || 'Körkortselev';
      let senderRole = data.userRole || 'user';
      let senderEmail = data.userEmail;

      if (data.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true, first_name: true, last_name: true, email: true, type: true },
        });

        if (user) {
          senderName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email?.split('@')[0] || senderName;
          senderRole = user.type || 'user';
          senderEmail = user.email || senderEmail;

          if (user.type === 'admin') {
            senderRole = 'admin';
          }
        }
      }

      const newMsg = await this.prisma.communityMessage.create({
        data: {
          language: cleanLang,
          user_id: data.userId || null,
          user_name: senderName,
          user_email: senderEmail || null,
          user_role: senderRole,
          topic: data.topic || 'Allmänt',
          message: data.message.trim(),
          parent_id: data.parentId || null,
          likes_count: 0,
        },
      });

      return {
        success: true,
        message: newMsg,
      };
    } catch (error) {
      console.error('[CommunityService] Error posting message:', error);
      throw new HttpException(error.message || 'Kunde inte skicka meddelandet', HttpStatus.BAD_REQUEST);
    }
  }

  // 4. Gilla ett meddelande
  async likeMessage(messageId: string) {
    try {
      const updated = await this.prisma.communityMessage.update({
        where: { id: messageId },
        data: {
          likes_count: {
            increment: 1,
          },
        },
      });

      return {
        success: true,
        likesCount: updated.likes_count,
      };
    } catch (error) {
      console.error('[CommunityService] Error liking message:', error);
      throw new HttpException('Meddelandet kunde inte gillas', HttpStatus.BAD_REQUEST);
    }
  }
}
