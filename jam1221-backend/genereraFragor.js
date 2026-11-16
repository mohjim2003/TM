import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import dotenv from "dotenv";

// Läs in .env från backend-mappen
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Läs in Gemini API-nyckel från miljövariabler
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function laddaMeraFrigor() {
  // Sökväg direkt till din questionData.json i frontend
  const filSokvag = path.resolve(process.cwd(), "..", "jam1e21", "public", "questionData.json");
  let existerandeFrigor = [];

  // 1. Läs in frågorna från din questionData.json
  if (fs.existsSync(filSokvag)) {
    try {
      const filInnehall = fs.readFileSync(filSokvag, "utf-8");
      existerandeFrigor = JSON.parse(filInnehall);
      console.log(`[${new Date().toLocaleTimeString()}] Hittade questionData.json! Läste in ${existerandeFrigor.length} befintliga frågor.`);
    } catch (e) {
      console.error("Kunde inte läsa JSON-filen, startar med tom lista.");
    }
  } else {
    console.log(`Varning: Hittade inte filen på: ${filSokvag}`);
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] Startar gratismodell: Genererar 20 nya frågor...`);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Generera 20 helt nya, unika och bilteoretiska körkortsfrågor på svenska.
    Returnera enbart en ren JSON-array (inget markdown, inga \`\`\`json block).
    Varje objekt MÅSTE följa denna struktur exakt:
    {
      "question": "Frågetexten här?",
      "options": ["Alternativ 1", "Alternativ 2", "Alternativ 3", "Alternativ 4"],
      "answer": "Det exakta korrekta alternativet i text-form"
    }`;

    const result = await model.generateContent(prompt);
    const textSvar = result.response.text();
    
    const nyaFrigor = JSON.parse(textSvar);
    const uppdateradLista = [...existerandeFrigor, ...nyaFrigor];

    // 2. Skriv tillbaka till frontend-filen
    fs.writeFileSync(filSokvag, JSON.stringify(uppdateradLista, null, 2), "utf-8");
    console.log(`[KLART] Gratismodellen har lagt till frågorna! Totalt antal nu: ${uppdateradLista.length}\n`);

  } catch (error) {
    console.error("Något gick fel vid anropet till gratismodellen:", error);
  }
}

// Kör varje minut för att testa direkt nu!
cron.schedule("* * * * *", () => {
  laddaMeraFrigor();
});

console.log("====================================================");
console.log("Automatiskt AI-jobb (GRATISMODELL) är aktivt!");
console.log("====================================================");