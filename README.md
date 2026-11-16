# TeoriMaster (TM)

Modern, kostnadsfri plattform för körkortsteori och slutprovssimulering i Sverige.

## Funktioner

- **Fullständigt Slutprov (65 frågor):** Matchar Trafikverkets officiella provformat med 50 minuters tidsgräns och 52 rätt för godkänt.
- **Över 3 000 teorifrågor:** Kategoriserade inom Trafikregler, Vägmärken, Fordonskännedom, Miljö samt Personliga förutsättningar.
- **AI-Coach med Gemini:** Pedagogiska och detaljerade förklaringar till varje provfråga i realtid.
- **Flerspråkigt Stöd:** Stöd för 14 språk (Svenska, Engelska, Arabiska, Somaliska, Tigrinja, Persiska, Kurdiska, Polska, Turkiska, Spanska, Ryska, Bosniska, Finska och Ukrainska) med anpassat höger-till-vänster-stöd (RTL).
- **TeoriDuellen 1v1 (Förhandsvisning):** Realtidsdueller mot AI och vänner med poängmultiplikator och säsongsliga.
- **Flerspråkigt Communityforum:** Diskutera svåra trafiksituationer och dela tips inför uppkörningen.

## Projektstruktur

- **`jam1e21/`** — Frontend (Next.js 15, React 19, Tailwind CSS 4, Radix UI, Lucide Icons)
- **`jam1221-backend/`** — Backend API (NestJS, Prisma ORM, Neon PostgreSQL)

## Kom igång lokalt

### Frontend (`jam1e21`)
```bash
cd jam1e21
npm install
npm run dev
```
Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

### Backend (`jam1221-backend`)
```bash
cd jam1221-backend
npm install
npm run dev
```

## Distribution (Deployment)

- **Frontend (Vercel):** Importera detta GitHub-repo till Vercel och ange **Root Directory** till `jam1e21`. Lägg till miljövariablerna `GEMINI_API_KEY` och `NEXT_PUBLIC_API_URL`.
- **Backend (Render / Railway):** Distribuera `jam1221-backend` som en Node.js-tjänst med anslutning till PostgreSQL.
