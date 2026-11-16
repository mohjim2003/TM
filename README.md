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

- **`frontend/`** — Frontend (Next.js 15, React 19, Tailwind CSS 4, Radix UI, Lucide Icons)
- **`backend/`** — Backend API (NestJS, Prisma ORM, Neon PostgreSQL)

## Kom igång lokalt

### Frontend (`frontend`)
```bash
cd frontend
npm install
npm run dev
```
Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

### Backend (`backend`)
```bash
cd backend
npm install
npm run dev
```

## Distribution (Vercel Services)

Projektet är konfigurerat för **Vercel Services** med gemensam domän via [`vercel.json`](./vercel.json):
- **`frontend`** hanterar Next.js webbsidor och Next API routes (`/api/quiz-explanation`, `/api/quiz-translate`).
- **`backend`** hanterar alla NestJS backend-endpoints (`/api/(.*)`).
- Interna service-bindings injicerar `BACKEND_URL` i frontend och `FRONTEND_URL` i backend.
