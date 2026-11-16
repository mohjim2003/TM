import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface RawQuestionItem {
  id?: number | string;
  question: string;
  options: string[];
  answer: string;
  category?: string;
  imageUrl?: string;
  originalQuestion?: string;
  originalOptions?: string[];
  originalAnswer?: string;
  language?: string;
}

export interface TranslatedQuestionItem extends RawQuestionItem {
  originalQuestion: string;
  originalOptions: string[];
  originalAnswer: string;
  language: string;
}

// In-memory cache för supersnabb återanvändning under drift
const memoryCache = new Map<string, TranslatedQuestionItem>();

// Filbaserad cache för beständig lagring mellan omstarter
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "translated-questions.json");

function loadFileCache(): Record<string, TranslatedQuestionItem> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // ignorera
  }
  return {};
}

function saveFileCache(cacheData: Record<string, TranslatedQuestionItem>) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), "utf-8");
  } catch {
    // ignorera
  }
}

// Ladda in filcache i minnet vid start
const persistentCache = loadFileCache();
for (const [k, v] of Object.entries(persistentCache)) {
  memoryCache.set(k, v);
}

const LANGUAGE_NAMES: Record<string, string> = {
  sv: "svenska",
  en: "English",
  ar: "العربية (Arabic)",
  so: "Af-Soomaali (Somali)",
  ti: "ትግርኛ (Tigrinya)",
  fa: "فارسی (Persian)",
  tr: "Türkçe (Turkish)",
  ku: "Kurdî (Kurdish)",
  pl: "Polski (Polish)",
  uk: "Українська (Ukrainian)",
  ru: "Русский (Russian)",
  es: "Español (Spanish)",
  de: "Deutsch (German)",
  fr: "Français (French)",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questions, targetLanguage = "sv" } = body as {
      questions: RawQuestionItem[];
      targetLanguage?: string;
    };

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: true, questions: [] });
    }

    // Om svenska, returnera direkt utan översättning
    if (targetLanguage === "sv") {
      return NextResponse.json({ success: true, questions });
    }

    const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const resultQuestions: RawQuestionItem[] = [];
    const questionsToTranslate: { index: number; q: RawQuestionItem }[] = [];

    // 1. Kolla om frågan redan finns i cachen
    questions.forEach((q, idx) => {
      const cacheKey = `${targetLanguage}_${q.id || q.question}`;
      if (memoryCache.has(cacheKey)) {
        resultQuestions[idx] = memoryCache.get(cacheKey)!;
      } else {
        questionsToTranslate.push({ index: idx, q });
      }
    });

    // Om alla frågor redan fanns i cachen, returnera direkt
    if (questionsToTranslate.length === 0) {
      return NextResponse.json({ success: true, questions: resultQuestions });
    }

    // 2. Anropa Gemini 2.5 Flash för att översätta frågorna som saknas
    const apiKey = process.env.GEMINI_API_KEY || "";
    const ai = new GoogleGenAI({ apiKey });

    // Förbered förenklat format för modellen
    const itemsToPrompt = questionsToTranslate.map(({ q }) => ({
      id: q.id,
      question: q.question,
      options: q.options || [],
      answer: q.answer,
    }));

    const prompt = `You are a certified driving theory exam translator for the official Swedish Transport Administration (Trafikverket) B-license tests.
Translate the following questions, their multiple-choice options, and the correct answer into ${langName}.
CRITICAL REQUIREMENTS:
1. Maintain accurate, official driving and traffic regulations terminology in ${langName}.
2. Keep the exact same order of options.
3. The 'answer' string MUST match the exact text of the translated correct option.
4. Return a JSON array of objects with the exact schema:
[
  {
    "id": number or string,
    "question": "translated question text",
    "options": ["translated option 1", "translated option 2", "translated option 3", "translated option 4"],
    "answer": "translated answer matching one of options"
  }
]

Questions to translate:
${JSON.stringify(itemsToPrompt)}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 2500,
        },
      });

      const responseText = response.text?.trim() || "[]";
      let translatedArray: { id?: string | number; question: string; options: string[]; answer: string }[] = [];
      try {
        translatedArray = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn("[quiz-translate] Failed to parse Gemini response as JSON:", parseErr);
      }

      // 3. Foga samman översättningarna och uppdatera cache
      let cacheDirty = false;

      questionsToTranslate.forEach(({ index, q }, i) => {
        const trans = translatedArray[i] || translatedArray.find((t) => t.id === q.id);
        if (trans && trans.question && Array.isArray(trans.options) && trans.options.length > 0) {
          // Säkerställ att svaret matchar ett alternativ
          let validAnswer = trans.answer;
          if (!trans.options.includes(validAnswer)) {
            // Om Gemini inte gav exakt samma sträng, mappa mot ursprungliga svarsindex
            const originalAnswerIdx = q.options.indexOf(q.answer);
            if (originalAnswerIdx >= 0 && originalAnswerIdx < trans.options.length) {
              validAnswer = trans.options[originalAnswerIdx];
            } else {
              validAnswer = trans.options[0];
            }
          }

          const merged: TranslatedQuestionItem = {
            ...q,
            question: trans.question,
            options: trans.options,
            answer: validAnswer,
            originalQuestion: q.question,
            originalOptions: q.options,
            originalAnswer: q.answer,
            language: targetLanguage,
          };

          const cacheKey = `${targetLanguage}_${q.id || q.question}`;
          memoryCache.set(cacheKey, merged);
          persistentCache[cacheKey] = merged;
          cacheDirty = true;
          resultQuestions[index] = merged;
        } else {
          // Fallback om enskild fråga inte kunde översättas
          resultQuestions[index] = { ...q, language: "sv" };
        }
      });

      if (cacheDirty) {
        saveFileCache(persistentCache);
      }
    } catch (aiError: unknown) {
      const msg = aiError instanceof Error ? aiError.message : "Okänt AI-fel";
      console.error("[quiz-translate] Gemini API error:", msg);
      // Fallback: använd originalfrågor om Gemini misslyckas
      questionsToTranslate.forEach(({ index, q }) => {
        resultQuestions[index] = { ...q, language: "sv" };
      });
    }

    return NextResponse.json({
      success: true,
      targetLanguage,
      questions: resultQuestions,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Okänt översättningsfel";
    console.error("[quiz-translate] Route error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
