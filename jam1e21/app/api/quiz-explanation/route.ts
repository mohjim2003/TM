import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY || "";

  try {
    const body = await request.json();
    const { question, selectedAnswer, correctAnswer, language = "sv" } = body;

    if (!question || !correctAnswer) {
      return NextResponse.json({ error: "Ogiltigt frågeunderlag." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Definiera instruktion baserat på valt språk
    const languageNames: Record<string, string> = {
      sv: "svenska",
      en: "engelska (English)",
      ar: "arabiska (العربية)",
      so: "somaliska (Af-Soomaali)",
      ti: "tigrinja (ትግርኛ)",
      fa: "persiska/farsi (فارسی)",
      tr: "turkiska (Türkçe)",
      ku: "kurdiska (Kurdî)",
      pl: "polska (Polski)",
      uk: "ukrainska (Українська)",
      es: "spanska (Español)",
      de: "tyska (Deutsch)",
      fr: "franska (Français)",
    };

    const targetLang = languageNames[language] || "svenska";

    const prompt = `Du är en certifierad, pedagogisk och uppmuntrande svensk trafiklärare och AI-coach för Trafikverkets teoriprov (B-körkort).
En elev har besvarat följande teorifråga:

Fråga: "${question}"
Elevens valda svar: "${selectedAnswer || "Inget svar angivet"}"
Rätt svar: "${correctAnswer}"

Ge en tydlig, pedagogisk och lättförståelig förklaring på ${targetLang}.
Strukturera svaret med:
1. Varför rätt svar är rätt enligt gällande svenska trafikregler.
2. Varför elevens svar inte stämmer (om eleven svarade fel).
3. Minnesregel för att komma ihåg detta på det riktiga teoriprovet.

Håll det pedagogiskt, konkret och koncist (högst 90 ord).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 350,
        temperature: 0.3,
      },
    });

    const explanation = response.text?.trim() || "Kunde inte generera en förklaring just nu.";

    return NextResponse.json({ explanation });
  } catch (error: unknown) {
    console.error("Fel vid skapande av AI-förklaring:", error);
    return NextResponse.json(
      {
        explanation:
          "Rätt svar baseras på Trafikverkets officiella körkortsregler. Tänk på att alltid prioritera säkerhet och väjningsregler i trafiken.",
      },
      { status: 200 }
    );
  }
}