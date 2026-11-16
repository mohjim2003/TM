"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import img from "../../public/img1.jpeg";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "../_lib/api";
import { useLanguage } from "../_components/LanguageContext";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import {
  IoShieldCheckmarkOutline,
  IoPersonOutline,
  IoCarSportOutline,
  IoLeafOutline,
  IoSparklesOutline,
  IoStar,
  IoStarOutline,
  IoLockClosedOutline,
  IoArrowForward,
  IoFlash,
  IoFlame,
  IoTrophy,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoChatbubblesOutline,
  IoLogOutOutline,
  IoPlay,
} from "react-icons/io5";

interface FeedbackItem {
  id: string;
  name?: string;
  email?: string;
  rating: number;
  category: string;
  message: string;
  created_at: string;
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const router = useRouter();
  const { t } = useLanguage();

  // Hero Interaktivt Mini-Quiz ("Spela på 10 sekunder")
  const [heroQuizAnswered, setHeroQuizAnswered] = useState<number | null>(null);
  const [heroQuizSuccess, setHeroQuizSuccess] = useState<boolean>(false);

  // Live realtidsstatistik från Neon-databasen
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalExams: number;
    totalPassed: number;
    totalDuels: number;
    totalMessages: number;
    passRate: number;
    avgRating: number;
    feedbacksCount: number;
  }>({
    totalUsers: 0,
    totalExams: 0,
    totalPassed: 0,
    totalDuels: 0,
    totalMessages: 0,
    passRate: 0,
    avgRating: 5.0,
    feedbacksCount: 0,
  });

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [modalRating, setModalRating] = useState<number>(5);
  const [modalName, setModalName] = useState<string>("");
  const [modalEmail, setModalEmail] = useState<string>("");
  const [modalMessage, setModalMessage] = useState<string>("");
  const [modalCategory, setModalCategory] = useState<string>("Slutprov");
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalSuccess, setModalSuccess] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        setIsLoggedIn(true);
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const u = JSON.parse(storedUser);
            setUserName(u.name || u.email?.split("@")[0] || null);
          } catch {}
        }
      }
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/feedback/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/feedback`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.feedbacks) setFeedbacks(data.feedbacks);
      })
      .catch(() => {});
  }, []);

  const handleModalFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMessage.trim()) return;
    setModalSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modalName.trim() || "Körkortselev",
          email: modalEmail.trim() || undefined,
          rating: modalRating,
          category: modalCategory,
          message: modalMessage.trim(),
        }),
      });
      if (res.ok) {
        setModalSuccess(true);
        fetch(`${API_BASE_URL}/api/feedback`)
          .then((r) => r.json())
          .then((d) => setFeedbacks(d.feedbacks || []));
        setTimeout(() => {
          setShowFeedbackModal(false);
          setModalSuccess(false);
          setModalMessage("");
        }, 1500);
      }
    } catch {}
    setModalSubmitting(false);
  };

  // Animerad realtidsgraf på Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const render = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);

      // Bakgrundsgrid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vågform / Datapuls
      ctx.beginPath();
      ctx.lineWidth = 3;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(245, 158, 11, 0.15)");
      gradient.addColorStop(0.5, "#f59e0b");
      gradient.addColorStop(1, "rgba(245, 158, 11, 0.15)");
      ctx.strokeStyle = gradient;

      for (let x = 0; x < width; x++) {
        const y =
          height / 2 +
          Math.sin((x + step) * 0.02) * 25 +
          Math.cos((x + step * 0.8) * 0.01) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Text och statuspunkt
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(40, 35, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 20px Inter, sans-serif";
      ctx.fillText("AI ANALYS: AKTIV FRAMSTEGSSPÅRNING", 56, 42);

      step += 2;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#04060b] text-slate-200 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 scroll-smooth relative overflow-x-hidden">
      
      {/* BAKGRUNDSEFFEKTER (CYBERPUNK NEON GLOW) */}
      <div className="fixed top-0 left-1/3 -translate-x-1/2 w-[650px] h-[350px] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-96 right-10 w-[500px] h-[400px] bg-purple-600/8 rounded-full blur-[180px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-[450px] h-[350px] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none" />

      {/* 0. LIVE REALTIDS TICKER (FRÅN DATABASEN) */}
      <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-purple-950/40 border-b border-amber-500/20 py-2 px-4 text-xs font-medium text-slate-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto whitespace-nowrap gap-6 no-scrollbar">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-bold">{stats.totalUsers} elever</span> registrerade i databasen
          </div>
          <div className="hidden md:flex items-center gap-6 text-slate-400">
            <span className="flex items-center gap-1.5"><IoFlash className="text-amber-400 text-xs" /> {stats.totalDuels} genomförda TeoriDueller</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><IoTrophy className="text-amber-400 text-xs" /> {stats.totalPassed} godkända Slutprov</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><IoStar className="text-amber-400 text-xs" /> {stats.avgRating}/5 i betyg ({stats.feedbacksCount} recensioner)</span>
          </div>
          <Link
            href="/battle"
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 shrink-0"
          >
            <IoLockClosedOutline className="text-xs" />
            <span>TeoriDuellen (Läs mer)</span>
            <IoArrowForward className="text-xs" />
          </Link>
        </div>
      </div>

      {/* 1. NAVBAR */}
      <nav className="sticky top-0 left-0 right-0 bg-[#04060b]/85 backdrop-blur-2xl border-b border-slate-800/80 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 select-none group shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl sm:text-2xl shadow-lg shadow-amber-500/25 group-hover:scale-105 group-hover:rotate-3 transition-transform">
              T
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white block">
                TEORI<span className="text-amber-500">MASTER</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block -mt-1">
                Gamified Körkortsteori
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-sm font-semibold text-slate-300">
            
            {/* DUEL-LÄNK MED LÅST INDIKATOR */}
            <Link
              href="/battle"
              className="relative px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10 hover:scale-105"
            >
              <IoLockClosedOutline className="text-amber-400 text-sm" />
              <span className="hidden xs:inline">TeoriDuellen</span>
              <span className="text-[9px] bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Låst
              </span>
            </Link>

            <Link
              href="/theory-quiz"
              className="hover:text-amber-400 transition-colors hidden sm:flex items-center gap-1.5"
            >
              <IoTrophy className="text-amber-500 text-base" />
              <span>Slutprov (65q)</span>
            </Link>

            <Link
              href="/community"
              className="hover:text-amber-400 transition-colors hidden md:flex items-center gap-1.5"
            >
              <IoChatbubblesOutline className="text-blue-400 text-base" />
              <span>Chattforum</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="hover:text-amber-400 transition-colors hidden lg:flex items-center gap-1.5 cursor-pointer text-amber-300 font-bold"
            >
              <IoStar className="text-amber-400 text-sm" />
              <span>Lämna Feedback</span>
            </button>

            {/* Språkväljare */}
            <LanguageSwitcher />

            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/theory-quiz"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm transition-all shadow-xl shadow-amber-500/20 hover:scale-105 cursor-pointer flex items-center gap-1.5"
                >
                  <IoPlay className="text-sm" />
                  <span>Öva Teori {userName ? `(${userName})` : ""}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    localStorage.removeItem("userType");
                    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                    setIsLoggedIn(false);
                    setUserName(null);
                  }}
                  title="Logga ut"
                  className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors p-2 rounded-xl border border-slate-800 bg-slate-900/80 cursor-pointer"
                >
                  <IoLogOutOutline className="text-base" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-6 py-2.5 rounded-xl text-sm transition-all shadow-xl shadow-amber-500/20 hover:scale-105 cursor-pointer active:scale-95"
              >
                Logga in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header className="relative pt-20 pb-20 overflow-hidden border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          
          <div className="text-center max-w-4xl mx-auto mb-12">
            
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2.5 bg-slate-900/90 border border-amber-500/30 text-amber-400 text-xs font-bold px-4 py-2 rounded-full mb-6 backdrop-blur-xl shadow-lg shadow-amber-500/10 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Sveriges mest beroendeframkallande teoriverktyg</span>
              <span className="text-slate-600">•</span>
              <span className="text-white">Uppdaterad för 2026</span>
            </div>

            {/* Brutal Hero Title */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08] mb-6">
              Klara körkortet direkt. <br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                Utan tråkiga böcker.
              </span>
            </h1>

            <p className="text-slate-400 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
              Spela 1v1-dueller, bemästra Trafikverkets 65-frågors slutprov och låt vår personliga AI-coach identifiera dina misstag tills du har 100% koll.
            </p>

            {/* Call To Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => router.push("/theory-quiz")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base px-8 py-4 rounded-2xl transition-all cursor-pointer shadow-2xl shadow-amber-500/25 hover:scale-105 group active:scale-95"
              >
                <IoTrophy className="text-xl" />
                <span>Kör TeoriProvet (3 000+ frågor)</span>
                <IoArrowForward className="text-lg transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => router.push("/battle")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-bold text-base px-8 py-4 rounded-2xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-amber-500/40 backdrop-blur-xl transition-all cursor-pointer hover:scale-105"
              >
                <IoLockClosedOutline className="text-amber-400 text-lg" />
                <span>Läs om TeoriDuellen (Låst)</span>
              </button>
            </div>

            {/* Social Proof (Realtidsdata från Neon DB) */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-400">
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
                <div className="flex text-amber-400 text-sm">
                  {[...Array(Math.round(stats.avgRating || 5))].map((_, i) => (
                    <IoStar key={i} />
                  ))}
                </div>
                <span className="text-white ml-1">{stats.avgRating}/5</span>
                <span>({stats.feedbacksCount} sparade recensioner)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
                <IoCheckmarkCircle className="text-emerald-400 text-sm" />
                <span className="text-white">{stats.totalPassed} godkända</span> prov i databasen
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
                <IoFlame className="text-amber-500 text-sm" />
                <span className="text-white">{stats.totalUsers} registrerade elever</span>
              </div>
            </div>

          </div>

          {/* 3. INTERAKTIV MINI-QUIZ TEASER DIREKT I HERO! ("TESTA DIG PÅ 10 SEKUNDER") */}
          <div className="max-w-2xl mx-auto bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <IoSparklesOutline /> Live Teaser • Svara direkt
              </span>
              <span className="text-xs font-bold text-slate-400">+100 XP Belöning</span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white mb-5 leading-snug">
              Vad gäller när du kör in i en cirkulationsplats?
            </h3>

            {/* Alternativ */}
            <div className="grid gap-2.5 mb-5">
              {[
                { id: 1, text: "Högerregeln gäller alltid inne i cirkulationen", correct: false },
                { id: 2, text: "Du har väjningsplikt mot all fordonstrafik inne i cirkulationen", correct: true },
                { id: 3, text: "Du kör först om du blinkar vänster innan infart", correct: false },
                { id: 4, text: "Stopplikt gäller alltid vid samtliga infarter", correct: false },
              ].map((opt) => {
                const isSelected = heroQuizAnswered === opt.id;
                let optStyle = "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-amber-500/50 hover:bg-slate-900";

                if (heroQuizAnswered !== null) {
                  if (opt.correct) {
                    optStyle = "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20";
                  } else if (isSelected && !opt.correct) {
                    optStyle = "bg-red-950/60 border-red-500 text-red-300";
                  } else {
                    optStyle = "opacity-40 bg-slate-950 border-slate-800 text-slate-500";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (heroQuizAnswered !== null) return;
                      setHeroQuizAnswered(opt.id);
                      setHeroQuizSuccess(opt.correct);
                    }}
                    disabled={heroQuizAnswered !== null}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${optStyle}`}
                  >
                    <span>{opt.text}</span>
                    {heroQuizAnswered !== null && opt.correct && (
                      <IoCheckmarkCircle className="text-xl text-emerald-400 shrink-0 ml-2" />
                    )}
                    {heroQuizAnswered !== null && isSelected && !opt.correct && (
                      <IoCloseCircle className="text-xl text-red-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Dopamine Feedback */}
            {heroQuizAnswered !== null && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center animate-fade-in space-y-3">
                <div className="flex items-center justify-center gap-2">
                  {heroQuizSuccess ? (
                    <IoCheckmarkCircle className="text-2xl text-emerald-400 shrink-0" />
                  ) : (
                    <IoCloseCircle className="text-2xl text-amber-400 shrink-0" />
                  )}
                  <span className="font-black text-white text-base">
                    {heroQuizSuccess
                      ? "RÄTT SVAR! +100 XP TJÄNAT!"
                      : "NÄSTAN! Du har väjningsplikt mot fordon inne i cirkulationen."}
                  </span>
                </div>
                <p className="text-slate-400 text-xs">
                  {heroQuizSuccess
                    ? "Du har redan bättre koll än 74% av alla elever! Vill du testa en hel duell eller köra Trafikverkets slutprov?"
                    : "Ingen fara! Med vår AI-coach repeterar du sånt här automatiskt tills det sitter i ryggmärgen."}
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => router.push("/battle")}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <IoLockClosedOutline className="text-amber-400 text-xs" />
                    <span>Läs om TeoriDuellen</span>
                  </button>
                  <button
                    onClick={() => router.push("/theory-quiz")}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                  >
                    Kör 65-frågors Slutprov →
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </header>

      {/* 4. THE 4 POWER PILLARS (BEROENDEFRAMKALLANDE FUNKTIONER) */}
      <section className="py-24 border-b border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black text-amber-500 uppercase tracking-widest block mb-3">
              Byggt som ett spel • Lärande på riktigt
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Varför elever inte kan sluta plugga
            </h2>
            <p className="text-slate-400 text-base mt-3">
              Kombinationen av tävlingsinstinkt, AI-analys och gemenskap gör att du lär dig tre gånger snabbare.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Kort 1: TeoriDuellen 1v1 (Låst förhandsvisning) */}
            <div className="bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-950/80 border border-amber-500/30 p-7 rounded-3xl backdrop-blur-xl relative group hover:border-amber-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/10">
                <IoLockClosedOutline />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-2">
                <IoLockClosedOutline className="text-xs" /> Låst · Förhandsvisning
              </div>
              <h3 className="font-extrabold text-white text-xl mb-2">TeoriDuellen</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                1v1 realtidsdueller mot vänner eller AI. Funktionen är låst under pilotfasen medan servrarna finjusteras. Läs hela guiden inför lanseringen!
              </p>
              <Link
                href="/battle"
                className="text-amber-400 font-bold text-xs flex items-center gap-1 group-hover:underline"
              >
                <span>Läs om hur duellen fungerar</span>
                <IoArrowForward />
              </Link>
            </div>

            {/* Kort 2: Trafikverkets 65-Frågors Slutprov */}
            <div className="bg-gradient-to-b from-purple-500/10 via-slate-900/60 to-slate-950/80 border border-slate-800 p-7 rounded-3xl backdrop-blur-xl relative group hover:border-purple-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 text-2xl mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/10">
                <IoTrophy />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider mb-2">
                Officiellt Format
              </div>
              <h3 className="font-extrabold text-white text-xl mb-2">Slutprov (65 Frågor)</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Exakt simulerat som det riktiga provet. Krav på minst 52 rätt (80%). Alla dina provresultat sparas med djupgående statistik och misstagsanalys.
              </p>
              <Link
                href="/theory-quiz"
                className="text-purple-400 font-bold text-xs flex items-center gap-1 group-hover:underline"
              >
                <span>Öppna slutprovet</span>
                <IoArrowForward />
              </Link>
            </div>

            {/* Kort 3: AI-TeoriCoach (Gemini) */}
            <div className="bg-gradient-to-b from-blue-500/10 via-slate-900/60 to-slate-950/80 border border-slate-800 p-7 rounded-3xl backdrop-blur-xl relative group hover:border-blue-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-2xl mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
                <IoSparklesOutline />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider mb-2">
                Smart Inlärning
              </div>
              <h3 className="font-extrabold text-white text-xl mb-2">AI TeoriCoach</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                &quot;Jag ser att du ofta tvekar på bromssträcka och datumparkering.&quot; Vår AI identifierar dina mönster och ger skräddarsydda pedagogiska förklaringar.
              </p>
              <span className="text-blue-400 font-bold text-xs flex items-center gap-1">
                <span>Inbyggd i alla prov</span>
              </span>
            </div>

            {/* Kort 4: Flerspråkigt Forum i 9 Språk */}
            <div className="bg-gradient-to-b from-emerald-500/10 via-slate-900/60 to-slate-950/80 border border-slate-800 p-7 rounded-3xl backdrop-blur-xl relative group hover:border-emerald-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
                <IoChatbubblesOutline />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-2">
                9 Språkforum
              </div>
              <h3 className="font-extrabold text-white text-xl mb-2">Körkortsgemenskap</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Svenska, Engelska, Arabiska, Persiska, Somaliska, Tigrinska, Turkiska, Ukrainska och Spanska. Ställ frågor, dela uppkörningstips och hjälp varandra!
              </p>
              <Link
                href="/community"
                className="text-emerald-400 font-bold text-xs flex items-center gap-1 group-hover:underline"
              >
                <span>Öppna Chattforumet</span>
                <IoArrowForward />
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* 5. GAMIFIED LEVELING & DAILY STREAK PREVIEW */}
      <section className="py-20 border-b border-slate-800/80 bg-slate-950/60 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-amber-950/20 border border-amber-500/20 p-8 sm:p-12 rounded-3xl backdrop-blur-2xl">
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-black text-amber-500 uppercase tracking-widest block mb-2">
                  Dopamin-boostad Inlärning
                </span>
                <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
                  Håll igång din streak & lås upp hemliga belöningar
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Öva minst 10 frågor varje dag för att bibehålla din dagliga streak. Samla XP, lås upp exklusiva förartitlar och gå från nybörjare till Trafikmästare.
                </p>

                {/* Nivåer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white">Nivå 7: Landsvägsförare</span>
                    <span className="text-amber-400">2 850 / 3 500 XP</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full w-[82%]" />
                  </div>
                </div>
              </div>

              {/* 7-Day Streak Tracker */}
              <div className="bg-slate-950/90 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <IoFlame className="text-amber-500 text-base" /> 7-Dagars Streak
                  </span>
                  <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    +500 XP Bonus
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center">
                  {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((day, idx) => (
                    <div
                      key={day}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                        idx < 4
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/10"
                          : idx === 4
                          ? "bg-amber-500 border-amber-400 text-slate-950 font-black animate-pulse"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                      }`}
                    >
                      <span className="text-[10px] font-bold">{day}</span>
                      <span className="text-base flex items-center justify-center">
                        {idx < 4 ? (
                          <IoFlame className="text-amber-400 text-sm" />
                        ) : idx === 4 ? (
                          <IoStar className="text-slate-950 text-sm" />
                        ) : (
                          <IoLockClosedOutline className="text-slate-600 text-sm" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-center">
                  <span className="text-xs text-slate-400">
                    Öva idag för att säkra din <strong className="text-amber-400">5-dagars streak</strong>!
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 6. PROVETS DELMOMENT ENLIGT TRAFIKVERKET */}
      <section id="funktioner" className="py-24 border-b border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-8">
              <div>
                <span className="text-xs font-bold text-amber-500 tracking-widest uppercase mb-2 block">
                  Provstruktur
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Öva på specifika delmoment eller kör hela slutprovet
                </h2>
              </div>
              
              <p className="text-slate-400 leading-relaxed text-base">
                Klicka dig in i specifika områden som Trafikregler, Miljö eller Skyltar när du vill repetera. När du känner dig redo kör du det kompletta slutprovet på 65 frågor!
              </p>

              {/* Stats Kort */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md">
                  <h4 className="text-3xl font-black text-amber-400">98.4%</h4>
                  <p className="text-slate-400 text-xs mt-1 font-medium">Klarar provet på 1:a försöket</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md">
                  <h4 className="text-3xl font-black text-amber-400">3 000+</h4>
                  <p className="text-slate-400 text-xs mt-1 font-medium">Aktuella och granskade frågor</p>
                </div>
              </div>

              <div>
                <Link
                  href="/theory-quiz"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
                >
                  <span>Öppna Översikten för Delmoment</span>
                  <IoArrowForward />
                </Link>
              </div>
            </div>

            {/* Media & Canvas Kort */}
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-full relative group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-2.5 backdrop-blur-xl shadow-2xl overflow-hidden">
                <Image
                  src={img}
                  alt="TeoriMaster Applikation"
                  className="w-full h-auto object-cover rounded-xl opacity-90 transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>

              {/* Dynamisk Canvas */}
              <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-xl">
                <canvas
                  ref={canvasRef}
                  className="w-full h-24 sm:h-28 rounded-lg block"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. KÄRNOMRÅDEN KORT */}
      <section className="py-24 border-b border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-500 tracking-widest uppercase block mb-2">
              Körkortsmål
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Fyra grundpelare för att klara teorin
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Strukturerat innehåll anpassat exakt efter Trafikverkets officiella kunskapsmål.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4 group-hover:scale-110 transition-transform">
                <IoShieldCheckmarkOutline />
              </div>
              <h4 className="font-bold text-white text-base mb-1">Trafikregler & Vägmärken</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t("rule") || "Förståelse för väjningsregler, skyltar och lagstiftning."}
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4 group-hover:scale-110 transition-transform">
                <IoPersonOutline />
              </div>
              <h4 className="font-bold text-white text-base mb-1">Mänskliga faktorer</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t("human") || "Riskmedvetenhet, alkohol, trötthet och reaktionstid."}
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4 group-hover:scale-110 transition-transform">
                <IoCarSportOutline />
              </div>
              <h4 className="font-bold text-white text-base mb-1">Fordonets funktion</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t("vehicle") || "Säkerhetskontroller, däck, bromsar och mekanik."}
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-md hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4 group-hover:scale-110 transition-transform">
                <IoLeafOutline />
              </div>
              <h4 className="font-bold text-white text-base mb-1">Miljö & Ecodriving</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t("environment") || "Sparsam körning, utsläpp och miljöpåverkan."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ELEVRECENSIONER (FRÅN DATABASEN) */}
      <section className="py-24 border-b border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-500 tracking-widest uppercase block mb-2">
              Verifierade Elevrecensioner
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Vad våra elever tycker om TeoriMaster
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              Samtliga recensioner sparas direkt i databasen från verifierade körkortselever.
            </p>
          </div>

          {feedbacks.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {feedbacks.slice(0, 6).map((fb: FeedbackItem) => (
                <div
                  key={fb.id}
                  className="bg-slate-900/40 border border-slate-800/80 p-7 rounded-2xl backdrop-blur-md flex flex-col justify-between hover:border-amber-500/40 transition-all"
                >
                  <div>
                    <div className="flex text-amber-400 text-sm mb-3">
                      {[...Array(fb.rating || 5)].map((_, i) => (
                        <IoStar key={i} />
                      ))}
                    </div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full mb-3">
                      {fb.category || "Teoriprov"}
                    </span>
                    <p className="text-slate-300 text-sm leading-relaxed italic">
                      &quot;{fb.message}&quot;
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white">{fb.name || "Elev"}</h5>
                      <span className="text-[11px] text-slate-500">
                        {new Date(fb.created_at).toLocaleDateString("sv-SE")}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">✓ Sparad recension</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto space-y-4">
              <IoChatbubblesOutline className="text-4xl text-slate-500 block mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Bli först med att lämna feedback!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vi har nyligen lanserat den nya 100% gratis plattformen. Dela din upplevelse med andra körkortselever!
              </p>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                <span>Skriv en recension</span>
                <IoArrowForward />
              </button>
            </div>
          )}

          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-8 py-3.5 text-xs font-bold text-amber-300 transition-all cursor-pointer shadow-lg shadow-amber-500/10 hover:scale-105"
            >
              <IoStar className="text-amber-400 text-base" />
              <span>Har du provat TeoriMaster? Skriv din recension och feedback här</span>
            </button>
          </div>
        </div>
      </section>

      {/* 9. BRUTAL CALL TO ACTION BANNER */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="bg-gradient-to-b from-amber-500/15 via-slate-900/80 to-slate-950 border border-amber-500/40 p-10 sm:p-16 rounded-3xl backdrop-blur-2xl shadow-2xl">
            <span className="text-amber-400 font-mono text-xs uppercase tracking-widest font-black block mb-3">
              Börja öva på 30 sekunder
            </span>
            <h3 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">
              Redo att ta körkortet på första försöket?
            </h3>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
              Full tillgång till alla 3 000+ frågor, 1v1 TeoriDuellen, AI-Coachen och flerspråkigt forum. Ingen bindningstid.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href={isLoggedIn ? "/theory-quiz" : "/signup"}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base px-10 py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/25 hover:scale-105 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <span>{isLoggedIn ? "Fortsätt öva prov →" : "Skapa gratiskonto nu"}</span>
              </Link>
              <Link
                href="/battle"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-base px-8 py-4 rounded-2xl border border-slate-700 transition-all cursor-pointer inline-flex items-center justify-center gap-2 hover:border-amber-500/40"
              >
                <IoLockClosedOutline className="text-amber-400" />
                <span>Läs om TeoriDuellen (Låst)</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#030407] py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm">
              T
            </div>
            <span className="text-slate-300 font-extrabold text-sm">TeoriMaster 2026</span>
          </div>

          <div className="flex gap-6 font-semibold text-slate-400">
            <Link href="/battle" className="hover:text-amber-400">TeoriDuellen</Link>
            <Link href="/theory-quiz" className="hover:text-amber-400">Slutprov</Link>
            <Link href="/community" className="hover:text-amber-400">Forum</Link>
            <Link href="/subscription" className="hover:text-amber-400">Medlemskap</Link>
          </div>

          <p>&copy; {new Date().getFullYear()} TeoriMaster Sverige. Alla rättigheter reserverade.</p>
        </div>
      </footer>

      {/* MODAL FÖR ATT LÄMNA FEEDBACK */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-slate-900 p-6 sm:p-8 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <IoSparklesOutline className="text-2xl text-amber-400" />
                <div>
                  <h3 className="text-lg font-black text-white">Lämna din feedback</h3>
                  <p className="text-xs text-slate-400">Ditt omdöme sparas och visas på sidan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-white p-1 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalSuccess ? (
              <div className="py-8 text-center space-y-3">
                <IoCheckmarkCircle className="text-4xl text-emerald-400 block mx-auto mb-2" />
                <h4 className="text-lg font-black text-emerald-400">Tack för din feedback!</h4>
                <p className="text-xs text-slate-300">
                  Ditt omdöme har sparats i databasen och hjälper andra elever.
                </p>
              </div>
            ) : (
              <form onSubmit={handleModalFeedbackSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Ditt betyg:</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setModalRating(star)}
                        className="text-2xl hover:scale-125 transition-transform cursor-pointer flex items-center justify-center"
                      >
                        {star <= modalRating ? (
                          <IoStar className="text-amber-400" />
                        ) : (
                          <IoStarOutline className="text-slate-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Ditt namn:</label>
                    <input
                      type="text"
                      value={modalName}
                      onChange={(e) => setModalName(e.target.value)}
                      placeholder="Ditt förnamn eller alias"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Område:</label>
                    <select
                      value={modalCategory}
                      onChange={(e) => setModalCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                    >
                      <option value="Slutprov">Slutprov (65q)</option>
                      <option value="Trafikregler">Trafikregler</option>
                      <option value="Miljö">Miljö & Ecodriving</option>
                      <option value="TeoriDuellen">TeoriDuellen 1v1</option>
                      <option value="AI-Coach">AI TeoriCoach</option>
                      <option value="Allmänt">Allmänt</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">E-post (frivilligt):</label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="din@epost.se"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Din recension:</label>
                  <textarea
                    rows={3}
                    value={modalMessage}
                    onChange={(e) => setModalMessage(e.target.value)}
                    placeholder="Vad tycker du om appen? Vad hjälpte dig mest inför provet?"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    {modalSubmitting ? "Skickar..." : "Publicera feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
