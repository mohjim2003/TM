"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import { API_BASE_URL } from "../_lib/api";
import {
  IoFlame,
  IoFlash,
  IoPeople,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoCopyOutline,
  IoCheckmark,
  IoArrowBack,
  IoPlay,
  IoSparkles,
  IoRefreshOutline,
  IoTimeOutline,
  IoTrophy,
  IoChatbubblesOutline,
  IoLockClosedOutline,
  IoArrowForward,
} from "react-icons/io5";
import {
  RiBookOpenLine,
  RiFocus3Line,
  RiSpeedUpLine,
  RiLoader4Line,
  RiHandHeartLine,
} from "react-icons/ri";

interface DuelQuestion {
  id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
  explanation?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  wins: number;
  winRate: number;
  score: number;
  tier: string;
  badge: string;
}

// Ljudgenerator med Web Audio API (Inga externa filer behövs!)
function playSfx(type: "correct" | "wrong" | "victory" | "countdown") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "correct") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "wrong") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "victory") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.35);
      });
    }
  } catch {
    // Tyst ignorera om web audio blockeras
  }
}

function BattleContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const tabParam = searchParams.get("tab");

  // Status: 'lobby' | 'waiting_friend' | 'in_game' | 'results'
  const [gameState, setGameState] = useState<"lobby" | "waiting_friend" | "in_game" | "results">("lobby");
  const [activeTab, setActiveTab] = useState<"play" | "guide" | "leaderboard">(
    tabParam === "guide" ? "guide" : "play"
  );
  const [showLockedModal, setShowLockedModal] = useState<boolean>(false);

  // Spelaruppgifter
  const [playerName, setPlayerName] = useState<string>("Du");
  const [opponentName, setOpponentName] = useState<string>("AI-Trafikläraren");
  const [isVsAi, setIsVsAi] = useState<boolean>(true);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "master">("medium");
  const [gameMode, setGameMode] = useState<"quick" | "classic" | "slutprov">("quick");

  // Duell-kod & länkar
  const [duelCode, setDuelCode] = useState<string>("");
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Matchläge & Frågor
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [playerCorrect, setPlayerCorrect] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [opponentCorrect, setOpponentCorrect] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);

  // Per-fråga timer
  const QUESTION_TIME = 15;
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>("");

  // Topplista
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Hämta topplista från backend
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/duel/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        if (data.leaderboard) setLeaderboard(data.leaderboard);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Ladda användare vid start & kolla om det finns en inbjudningskod
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.name) setPlayerName(parsed.name);
          else if (parsed.email) setPlayerName(parsed.email.split("@")[0]);
        } catch {
          // ignore
        }
      }
    }

    if (codeParam) {
      setJoinCodeInput(codeParam.toUpperCase());
      setShowLockedModal(true);
    }

    fetchLeaderboard();
  }, [codeParam, fetchLeaderboard]);

  // Starta spelet
  const startMatch = () => {
    setCurrentIndex(0);
    setPlayerScore(0);
    setPlayerCorrect(0);
    setOpponentScore(0);
    setOpponentCorrect(0);
    setCombo(0);
    setMaxCombo(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setTimeLeft(QUESTION_TIME);
    setGameState("in_game");
  };

  // Starta en demofråga så användare kan se hur duell-arenan ser ut i praktiken
  const handleStartDemoQuestion = () => {
    setDuelCode("DEMO-1v1");
    setOpponentName("AI-Trafikläraren (Demo)");
    setIsVsAi(true);
    setQuestions([
      {
        id: 9991,
        question: "Vad innebär denna vägmarkering (små trianglar / hajtänder) vid en korsning?",
        options: [
          "Väjningsplikt mot korsande fordon",
          "Stopplikt före linjen",
          "Förbud mot vänstersväng",
          "Huvudled börjar här",
        ],
        answer: "Väjningsplikt mot korsande fordon",
        category: "Trafikregler",
        explanation: "Väjningslinjen anger att du måste lämna företräde åt korsande trafik.",
      },
      {
        id: 9992,
        question: "Hur lång är reaktionssträckan vid 50 km/h om reaktionstiden är 1 sekund?",
        options: ["Ca 14 meter", "Ca 25 meter", "Ca 8 meter", "Ca 35 meter"],
        answer: "Ca 14 meter",
        category: "Fordonskännedom",
        explanation: "Reaktionssträckan vid 50 km/h på 1 sekund är cirka 14 meter (5 x 3 = 15 m ca, exakt 13.9 m).",
      },
      {
        id: 9993,
        question: "Vad är högsta tillåtna hastighet för en bil med tillkopplad obromsad släpvagn vars totalvikt överstiger halva bilens tjänstevikt?",
        options: ["40 km/h", "80 km/h", "70 km/h", "90 km/h"],
        answer: "40 km/h",
        category: "Trafikregler",
        explanation: "När en obromsad släpvagn har en totalvikt som överstiger bilens halva tjänstevikt gäller max 40 km/h.",
      },
    ]);
    startMatch();
  };

  // Kopiera duell-länk till urklipp
  const copyDuelLink = () => {
    const url = `${window.location.origin}/battle?code=${duelCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAnswerSelectRef = useRef<((option: string | null, isTimeout?: boolean) => void) | null>(null);

  // Timer loop per fråga
  useEffect(() => {
    if (gameState !== "in_game" || isAnswerSubmitted) return;

    if (timeLeft <= 0) {
      // Tiden är ute -> registrera fel
      handleAnswerSelectRef.current?.(null, true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft, isAnswerSubmitted]);

  // Simulera motståndarens (AI) svar i realtid
  useEffect(() => {
    if (gameState !== "in_game" || !isVsAi || isAnswerSubmitted) return;

    // AI svarar inom 2.5 till 4 sekunder
    const aiDelay = 2200 + Math.random() * 2000;
    const aiTimeout = setTimeout(() => {
      // Beräkna om AI svarar rätt baserat på svårighetsgrad
      const accuracyProb = aiDifficulty === "master" ? 0.92 : aiDifficulty === "easy" ? 0.62 : 0.8;
      const isAiRight = Math.random() < accuracyProb;

      if (isAiRight) {
        const speedBonus = Math.floor(Math.random() * 40) + 10;
        setOpponentScore((prev) => prev + 100 + speedBonus);
        setOpponentCorrect((prev) => prev + 1);
      }
    }, aiDelay);

    return () => clearTimeout(aiTimeout);
  }, [currentIndex, gameState, isVsAi, aiDifficulty, isAnswerSubmitted]);

  // Hantera spelarens svar
  const handleAnswerSelect = (option: string | null, isTimeout: boolean = false) => {
    if (isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    setSelectedOption(option);

    const currentQ = questions[currentIndex];
    const isCorrect = !isTimeout && option === currentQ.answer;

    if (isCorrect) {
      playSfx("correct");
      const speedBonus = Math.max(0, timeLeft * 10); // Snabba svar ger upp till +150 bonuspoäng!
      const comboMultiplier = 1 + combo * 0.2; // 1.2x, 1.4x, 1.6x osv
      const pointsGained = Math.round((100 + speedBonus) * comboMultiplier);

      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);

      setPlayerScore((prev) => prev + pointsGained);
      setPlayerCorrect((prev) => prev + 1);
      setFeedbackText(`RÄTT! +${pointsGained}p (${timeLeft}s kvar)`);
    } else {
      playSfx("wrong");
      setCombo(0);
      setFeedbackText(isTimeout ? "Tiden ute! Inga poäng." : "Fel svar! Kombon bröts.");
    }

    // Gå till nästa fråga efter 1.8 sekunders feedback
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setTimeLeft(QUESTION_TIME);
        setFeedbackText("");
      } else {
        finishGame();
      }
    }, 1800);
  };
  handleAnswerSelectRef.current = handleAnswerSelect;

  // Avsluta duellen och visa resultatet
  const finishGame = async () => {
    setGameState("results");
    playSfx("victory");

    // Skicka till backend om vi har en kod
    if (duelCode) {
      try {
        await fetch(`${API_BASE_URL}/api/duel/${duelCode}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "creator",
            score: playerScore,
            correctCount: playerCorrect,
          }),
        });
      } catch {
        // ignore
      }
    }
  };

  const currentQ = questions[currentIndex];
  const isPlayerWinner = playerScore > opponentScore;
  const isDraw = playerScore === opponentScore;

  return (
    <div className="min-h-screen bg-[#04060b] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 pb-20">
      
      {/* GLOW BAKGRUNDER */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[450px] h-[350px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* 1. TOPPNAVIGERING */}
      <nav className="sticky top-0 z-50 bg-[#04060b]/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-all"
            >
              <IoArrowBack className="text-lg" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-amber-500/20">
                <IoFlash />
              </span>
              <h1 className="font-extrabold text-lg tracking-tight text-white hidden sm:block">
                TEORI<span className="text-amber-500">DUELLEN</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("guide")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "guide"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <RiBookOpenLine className="text-sm" />
              <span>Guide & Regler</span>
            </button>
            <button
              onClick={() => setActiveTab("play")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "play"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <IoLockClosedOutline className="text-sm" />
              <span>Arena (Låst)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("leaderboard");
                fetchLeaderboard();
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "leaderboard"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <IoTrophy className="text-sm" />
              <span>Duell-Ligan</span>
            </button>
            <Link
              href="/theory-quiz"
              className="text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-all hidden md:flex items-center gap-1.5"
            >
              <RiBookOpenLine className="text-sm text-amber-400" />
              <span>Slutprov</span>
            </Link>
            <Link
              href="/community"
              className="text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-all hidden lg:flex items-center gap-1.5"
            >
              <IoChatbubblesOutline className="text-sm text-slate-400" />
              <span>Forum</span>
            </Link>
            <LanguageSwitcher />
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-300 font-bold">
              <IoLockClosedOutline className="text-sm text-amber-400" />
              <span>Låst i pilotfasen</span>
            </div>
          </div>
        </div>
      </nav>

      {/* FELMEDDELANDE */}
      {errorMessage && (
        <div className="max-w-xl mx-auto mt-4 px-4">
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")} className="text-red-300 font-bold">✕</button>
          </div>
        </div>
      )}

      {/* 2. TOPPLISTA TAB */}
      {activeTab === "leaderboard" && (
        <div className="max-w-4xl mx-auto px-6 pt-10">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block mb-2">Hall of Fame</span>
            <h2 className="text-3xl font-black text-white">Duell-Ligan: Säsong 1</h2>
            <p className="text-slate-400 text-sm mt-1">Sveriges snabbaste och vassaste körkortselever</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Förare & Ranka</span>
              <div className="flex gap-8">
                <span>Vinster</span>
                <span>Vinst-ratio</span>
                <span className="hidden sm:inline">XP Poäng</span>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="p-8 text-center text-slate-400">
                <RiLoader4Line className="text-2xl animate-spin text-amber-400 inline-block mb-2" />
                <p className="text-sm">Hämtar Duell-Ligan...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <IoFlash className="text-3xl text-amber-400 block mx-auto mb-2" />
                <p className="text-sm font-bold text-white">Inga avslutade matcher ännu!</p>
                <p className="text-xs text-slate-400">Starta en 1v1-duell mot AI eller en vän för att ta förstaplatsen i Säsong 1.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {leaderboard.map((item) => (
                  <div
                    key={item.rank}
                    className={`flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors ${
                      item.rank === 1 ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-sm">
                        {item.badge}
                      </span>
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                          {item.name}
                          {item.rank === 1 && <IoTrophy className="text-xs text-amber-400" />}
                        </h4>
                        <span className="text-[11px] text-amber-500/80 font-medium">{item.tier}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 text-sm">
                      <span className="font-bold text-emerald-400">{item.wins} V</span>
                      <span className="text-slate-300 font-semibold">{item.winRate}%</span>
                      <span className="font-black text-amber-400 hidden sm:inline">{item.score.toLocaleString()} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2.5. GUIDE & REGLER TAB */}
      {activeTab === "guide" && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-16 space-y-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-4 py-1.5 rounded-full">
              <RiBookOpenLine className="text-sm" /> Officiell Guide · TeoriDuellen 1v1
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Allt om hur TeoriDuellen fungerar
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Här kan du läsa in dig på hur 1v1-matcherna spelas, hur poäng- och kombo-multiplikatorn beräknas och hur du klättrar i Duell-Ligan.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab("play")}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <IoLockClosedOutline className="text-amber-400 text-sm" />
                <span>Visa Arenan (Förhandsvisning)</span>
              </button>
              <Link
                href="/theory-quiz"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/15"
              >
                <IoTrophy className="text-slate-950 text-sm" />
                <span>Öva gratis i TeoriProvet</span>
              </Link>
            </div>
          </div>

          {/* Låst information callout */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-purple-500/10 border border-amber-500/30 rounded-3xl p-6 sm:p-7 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl shrink-0">
                <IoLockClosedOutline />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                  <span>Status: Låst under pilotfasen</span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Lanseras snart
                  </span>
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  För att säkerställa 100% stabil drift med blixtsnabb realtidsdata håller vi duellfunktionen låst under den inledande pilotfasen. Under tiden kan du läsa igenom hela reglementet nedan och förbereda dig genom att träna på alla delmoment i TeoriProvet!
                </p>
              </div>
            </div>
          </div>

          {/* Sektion 1: Hur en match går till */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-sm">
                1
              </span>
              <div>
                <h3 className="text-xl font-black text-white">Hur en match går till</h3>
                <p className="text-xs text-slate-400">Fyra steg från utmaning till seger</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Steg 1</span>
                <h4 className="font-bold text-white text-sm">Välj motståndare</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Starta en duell direkt mot AI-Trafikläraren eller skapa en privat matchkod som du skickar till en vän via WhatsApp, SMS eller länk.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Steg 2</span>
                <h4 className="font-bold text-white text-sm">Samma frågor i realtid</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Båda spelarna ser exakt samma frågor och svarsalternativ samtidigt. Frågorna slumpas från Trafikverkets 5 officiella delmoment.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Steg 3</span>
                <h4 className="font-bold text-white text-sm">Svara mot klockan</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Du har 15 sekunder på dig per fråga. Snabbare svar ger högre poängbonus, och flera rätt i rad bygger upp en kraftfull kombo-multiplikator!
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Steg 4</span>
                <h4 className="font-bold text-white text-sm">Seger & XP</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Den med högst totalpoäng vinner matchen. Vinsten ger XP till Säsongens Duell-Liga där du klättrar mot TeoriMästare-divisionen.
                </p>
              </div>
            </div>
          </div>

          {/* Sektion 2: Poäng- & Kombo-systemet */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-black text-sm">
                2
              </span>
              <div>
                <h3 className="text-xl font-black text-white">Poängberäkning & Kombo-multiplikator</h3>
                <p className="text-xs text-slate-400">Varje millisekund räknas</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Vänster: Poängformel */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <IoFlash className="text-amber-400" />
                  <span>Poängformel per fråga</span>
                </h4>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span>Grundpoäng (Korrekt svar)</span>
                    <span className="font-mono font-bold text-emerald-400">+1 000 p</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span>Snabbhetsbonus (Upp till 15 sek)</span>
                    <span className="font-mono font-bold text-amber-400">Upp till +500 p</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span>Fel svar / Tiden tar slut</span>
                    <span className="font-mono font-bold text-red-400">0 p (Bryter kombo)</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Formel: <code className="text-amber-300 bg-slate-950 px-2 py-0.5 rounded font-mono">Totalt = (1 000 + Tidsbonus) × KomboMultiplikator</code>
                </p>
              </div>

              {/* Höger: Kombo-multiplikator */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <IoFlame className="text-amber-400" />
                  <span>Kombo-stege vid rätt svar i rad</span>
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300">1 - 2 korrekta svar i rad</span>
                    <span className="font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800">1.0x (Normal)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-amber-500/20">
                    <span className="text-slate-300">3 - 4 korrekta svar i rad</span>
                    <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">1.5x Multi</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-amber-500/30">
                    <span className="text-slate-300">5 - 7 korrekta svar i rad</span>
                    <span className="font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">2.0x Super Multi</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-amber-950/40 border border-purple-500/40">
                    <span className="text-white font-semibold">8+ korrekta svar i rad</span>
                    <span className="font-black text-amber-400 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50">3.0x MÄSTAR-MULTI!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sektion 3: Matchlägen & AI-Nivåer */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Matchlägen */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RiFocus3Line className="text-amber-400 text-lg" />
                <h3 className="text-lg font-black text-white">Tre Matchlägen</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Snabbduell (10 Frågor)</h5>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">~2 min</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Korta, intensiva ronder. Perfekt för snabba mikropauser eller för att utmana en kompis under lunchrasten.
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Klassisk Duell (20 Frågor)</h5>
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">~5 min</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Det mest balanserade läget. Ger ett jämnt urval över alla Trafikverkets 5 delområden.
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Slutprovsduell (65 Frågor)</h5>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">~15 min</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Full skala med samma godkändgräns som Trafikverket (52 rätt av 65). Den ultimata prövningen!
                  </p>
                </div>
              </div>
            </div>

            {/* AI-Svårighetsgrader */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IoPeople className="text-amber-400 text-lg" />
                <h3 className="text-lg font-black text-white">AI-Trafiklärarens Nivåer</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Övningskörare (Lätt)</h5>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">65% träffsäkerhet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Svarar lugnt på 8–12 sekunder. Gör mänskliga misstag på svåra regler och ger dig utrymme att vinna.
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Trafiklärare (Medel)</h5>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">85% träffsäkerhet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Gedigen kunskap och snabba reflexer (5–8 sekunder). Kräver att du har bra koll på väjningsplikt och skyltar.
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-bold text-white text-sm">Trafikinspektör (Mästare)</h5>
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">96% träffsäkerhet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Blixtsnabb (2–4 sekunder) och nästan felfri. Kräver full kombo och felfria svar för att besegra!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sektion 4: Duell-Ligan & Divisioner */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-sm">
                3
              </span>
              <div>
                <h3 className="text-xl font-black text-white">Duell-Ligan & Divisioner</h3>
                <p className="text-xs text-slate-400">Samla säsongs-XP och klättra i graderna</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { name: "Brons", xp: "0 - 1 500 XP", color: "text-amber-700 border-amber-800/40 bg-amber-950/20" },
                { name: "Silver", xp: "1 501 - 3 500 XP", color: "text-slate-300 border-slate-600/40 bg-slate-900/40" },
                { name: "Guld", xp: "3 501 - 6 500 XP", color: "text-amber-400 border-amber-500/40 bg-amber-950/30" },
                { name: "Platina", xp: "6 501 - 10 000 XP", color: "text-cyan-300 border-cyan-500/40 bg-cyan-950/30" },
                { name: "Diamant", xp: "10 001 - 15 000 XP", color: "text-purple-300 border-purple-500/40 bg-purple-950/30" },
                { name: "Mästare", xp: "15 000+ XP", color: "text-rose-400 border-rose-500/40 bg-rose-950/30" },
              ].map((tier, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border text-center space-y-1 ${tier.color}`}>
                  <IoTrophy className="text-xl mx-auto mb-1 opacity-80" />
                  <h5 className="font-bold text-xs">{tier.name}</h5>
                  <span className="text-[10px] text-slate-400 block">{tier.xp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sektion 5: Vanliga frågor (FAQ) */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <IoChatbubblesOutline className="text-amber-400" />
              <span>Vanliga frågor om TeoriDuellen</span>
            </h3>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white text-sm">Kostar det något att spela när det öppnar?</h4>
                <p className="text-slate-400 leading-relaxed">
                  Nej, hela TeoriMaster är 100% kostnadsfritt! Du har obegränsad tillgång till alla prov, dueller och AI-stöd helt utan kostnad eller dolda avgifter.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white text-sm">Varför är funktionen låst just nu?</h4>
                <p className="text-slate-400 leading-relaxed">
                  Under vår pilotlansering fokuserar vi på att göra grundproven och teorifrågorna perfekta. Flerspelarsystemet med realtidsservrar finjusteras för minimal fördröjning innan den öppnas för allmänheten.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white text-sm">Kan man spela på mobilen?</h4>
                <p className="text-slate-400 leading-relaxed">
                  Ja, hela appen och duellarenan är byggd med responsiv mobil-design och touch-optimerade knappar för enkel användning i mobilen.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-2">
                <h4 className="font-bold text-white text-sm">Hur övar jag bäst medan duellen är låst?</h4>
                <p className="text-slate-400 leading-relaxed">
                  Gå till TeoriProvet där du har tillgång till över 3 000 frågor, fullskaligt 65-frågors slutprov, språkväljare och vår AI-coach med Gemini.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Box */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-amber-500/10 border border-amber-500/30 text-center space-y-4">
            <h3 className="text-2xl font-black text-white">
              Redo att sätta igång med körkortsteorin?
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
              Träna gratis på alla officiella frågor redan nu så är du redo när TeoriDuellen låses upp!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/theory-quiz"
                className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <IoTrophy className="text-slate-950" />
                <span>Öppna TeoriProvet (Gratis)</span>
                <IoArrowForward />
              </Link>
              <button
                onClick={() => setActiveTab("play")}
                className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                <IoLockClosedOutline className="text-amber-400" />
                <span>Inspektera Arenan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. LOBBY VIEW */}
      {activeTab === "play" && gameState === "lobby" && (
        <div className="max-w-4xl mx-auto px-6 pt-10">
          
          {/* LÅST NOTIS / BANNER */}
          <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900/80 to-purple-500/15 border border-amber-500/30 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl shrink-0">
                  <IoLockClosedOutline />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-black text-[10px] uppercase tracking-wider">
                      Låst under pilotfasen
                    </span>
                    <span className="text-xs text-slate-400">Förhandsvisning</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    TeoriDuellen lanseras inom kort
                  </h3>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                    Duellfunktionen är tillfälligt låst medan vi fintrimmar flerspelarsystemet och realtidsuppkopplingen. Du kan läsa om alla regler, matchformat och hur duellen fungerar i vår guide, eller öva på alla 3 000+ körkortsfrågor gratis i TeoriProvet!
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setActiveTab("guide")}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  <RiBookOpenLine className="text-sm" />
                  <span>Läs Guide & Regler</span>
                </button>
                <Link
                  href="/theory-quiz"
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <IoTrophy className="text-xs text-amber-400" />
                  <span>Öva i TeoriProvet</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Hero Banner */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
              <IoFlash className="text-sm" /> 1v1 Realtidsduell
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
              Vem klarar körkortet först?
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Utmana vänner eller vår intelligenta AI i ett intensivt teorislag. Svara rätt snabbt för kombo-multiplikator och klättra i Duell-ligan!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            
            {/* Vänster kolumn: Välj Matchformat & Spelarnamn */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl space-y-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Ditt förarnamn / alias
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Skriv in ditt namn"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Välj Antal Frågor / Matchtyp */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Välj Matchläge
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setGameMode("quick")}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      gameMode === "quick"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <RiSpeedUpLine className="text-xl text-amber-400 block mx-auto mb-1" />
                    <span className="block font-bold text-xs">Snabb</span>
                    <span className="block text-[10px] text-slate-500">10 frågor</span>
                  </button>

                  <button
                    onClick={() => setGameMode("classic")}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      gameMode === "classic"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <RiFocus3Line className="text-xl text-purple-400 block mx-auto mb-1" />
                    <span className="block font-bold text-xs">Klassisk</span>
                    <span className="block text-[10px] text-slate-500">20 frågor</span>
                  </button>

                  <button
                    onClick={() => setGameMode("slutprov")}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      gameMode === "slutprov"
                        ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <IoTrophy className="text-xl text-amber-400 block mx-auto mb-1" />
                    <span className="block font-bold text-xs">Slutprov</span>
                    <span className="block text-[10px] text-slate-500">65 frågor</span>
                  </button>
                </div>
              </div>

              {/* Action 1: SPELA MOT AI DIREKT */}
              <div className="border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Spela mot AI (Förhandsvisning)
                  </span>
                  <span className="text-[10px] font-bold text-amber-500/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <IoLockClosedOutline /> Låst
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["easy", "medium", "master"] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setAiDifficulty(diff)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                        aiDifficulty === diff
                          ? "bg-purple-600/20 border-purple-500 text-purple-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {diff === "easy" ? "Övningskörare" : diff === "medium" ? "Trafiklärare" : "Inspektör"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowLockedModal(true)}
                  className="w-full bg-slate-800/90 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-bold py-4 rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <IoLockClosedOutline className="text-lg text-amber-400" />
                  <span>Starta AI-Duell (Låst · Läs info)</span>
                </button>

                <button
                  onClick={handleStartDemoQuestion}
                  className="w-full mt-2.5 py-3 px-4 rounded-2xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/40 text-purple-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <IoPlay className="text-sm text-purple-400" />
                  <span>Provspela 3 testfrågor (Demo / Simulering)</span>
                </button>
              </div>

            </div>

            {/* Höger kolumn: VÄN-UTMANING & KOD-ANSLUTNING */}
            <div className="space-y-6">
              
              {/* Skapa länk för kompis */}
              <div className="bg-gradient-to-br from-slate-900/90 to-purple-950/20 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl">
                    <IoPeople />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Utmana en Vän</h3>
                    <p className="text-slate-400 text-xs">Skapa en unik matchlänk och se vem som är bäst</p>
                  </div>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Generera en privat matchkod. Skicka den via SMS, WhatsApp eller Discord så kör ni mot samma slumpade provfrågor!
                </p>

                <button
                  onClick={() => setShowLockedModal(true)}
                  className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold py-3.5 rounded-2xl text-sm border border-slate-700 hover:border-amber-500/40 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <IoLockClosedOutline className="text-base text-amber-400" />
                  <span>Skapa Utmaningslänk (Låst)</span>
                </button>
              </div>

              {/* Gå med i en duell */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl">
                <h3 className="font-extrabold text-white text-base mb-1">Har du fått en inbjudan?</h3>
                <p className="text-slate-400 text-xs mb-4">Klistra in koden du fått av din vän för att hoppa rakt in i matchen.</p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="T.ex. DUEL-4821"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white uppercase tracking-wider font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setShowLockedModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <IoLockClosedOutline className="text-sm text-amber-400" />
                    <span>Gå med</span>
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Läs mer om reglerna sektion längst ner i lobbyn */}
          <div className="mt-10 p-6 sm:p-8 bg-slate-900/40 border border-slate-800/80 rounded-3xl text-center space-y-3">
            <h4 className="text-white font-bold text-base sm:text-lg">
              Vill du läsa hur matcherna och poängen fungerar?
            </h4>
            <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Utforska vår officiella spelguide med regler, kombo-multiplikator, tidsgränser, AI-svårighetsgrader och Säsong 1 Duell-Ligan.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setActiveTab("guide")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/10"
              >
                <RiBookOpenLine className="text-sm" />
                <span>Öppna Spelguide & Regler</span>
                <IoArrowForward />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 4. VÄNTELOBBY FÖR VÄN */}
      {activeTab === "play" && gameState === "waiting_friend" && (
        <div className="max-w-xl mx-auto px-6 pt-16 text-center">
          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
            
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-3xl flex items-center justify-center mx-auto animate-pulse">
              <IoFlash />
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">Duellen är redo!</h3>
              <p className="text-slate-400 text-sm mt-1">Dela koden eller länken med din vän</p>
            </div>

            {/* Stor Kodbox */}
            <div className="bg-slate-950 border border-amber-500/40 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-widest">Duellkod</span>
              <span className="text-3xl font-mono font-black text-amber-400 tracking-wider select-all">{duelCode}</span>
            </div>

            {/* Kopiera Länk-knapp */}
            <div className="flex gap-3">
              <button
                onClick={copyDuelLink}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {copiedLink ? <IoCheckmark className="text-lg" /> : <IoCopyOutline className="text-lg" />}
                <span>{copiedLink ? "Länk Kopierad!" : "Kopiera Utmaningslänk"}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800 text-slate-400 text-xs flex flex-col gap-3">
              <span>Du kan börja spela direkt när din vän klickar på länken eller så kör du direkt själv:</span>
              <button
                onClick={() => startMatch()}
                className="text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                Starta mitt prov nu (Motståndaren kan köra efter) →
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. IN-GAME BATTLE ARENA HUD */}
      {activeTab === "play" && gameState === "in_game" && currentQ && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          
          {/* TOP VS BAR */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl backdrop-blur-xl mb-6 shadow-2xl">
            <div className="grid grid-cols-3 items-center">
              
              {/* Spelare 1 (Du) */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-amber-500/20 shrink-0">
                  {playerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold block truncate max-w-[100px] sm:max-w-none">{playerName} (Du)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-amber-400">{playerScore}p</span>
                    {combo > 1 && (
                      <span className="text-xs font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-0.5 animate-bounce">
                        <IoFlame /> x{combo}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mitten: VS & Timer */}
              <div className="text-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
                  Fråga {currentIndex + 1} / {questions.length}
                </span>

                {/* Cirkulär Timer */}
                <div className="inline-flex items-center justify-center gap-1.5 my-1 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                  <IoTimeOutline className={`text-base ${timeLeft <= 5 ? "text-red-400 animate-spin" : "text-amber-400"}`} />
                  <span className={`text-base font-mono font-black ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>
                    {timeLeft}s
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 max-w-[120px] mx-auto">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Spelare 2 (Motståndare) */}
              <div className="flex items-center justify-end gap-3 text-right">
                <div>
                  <span className="text-xs text-slate-400 font-bold block truncate max-w-[100px] sm:max-w-none">{opponentName}</span>
                  <span className="text-xl sm:text-2xl font-black text-purple-400">{opponentScore}p</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-purple-500/20 shrink-0">
                  {opponentName.charAt(0).toUpperCase()}
                </div>
              </div>

            </div>
          </div>

          {/* QUESTION CARD */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
            
            {/* Kategori-tagg */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                {currentQ.category || "Trafikregler"}
              </span>

              {feedbackText && (
                <span className="text-sm font-bold animate-pulse text-amber-300">
                  {feedbackText}
                </span>
              )}
            </div>

            {/* Frågetext */}
            <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug mb-8">
              {currentQ.question}
            </h3>

            {/* Alternativ-grid */}
            <div className="grid gap-3.5">
              {currentQ.options.map((opt, i) => {
                const isSelected = selectedOption === opt;
                const isCorrect = opt === currentQ.answer;

                let btnStyle = "bg-slate-950/70 border-slate-800 text-slate-200 hover:border-amber-500/60 hover:bg-slate-900";

                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    btnStyle = "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20";
                  } else if (isSelected && !isCorrect) {
                    btnStyle = "bg-red-950/60 border-red-500 text-red-300 shadow-lg shadow-red-500/20";
                  } else {
                    btnStyle = "opacity-40 bg-slate-950 border-slate-800 text-slate-500";
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswerSelect(opt)}
                    disabled={isAnswerSubmitted}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all text-sm sm:text-base font-semibold flex items-center justify-between group cursor-pointer ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:text-amber-400 shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </div>

                    {isAnswerSubmitted && isCorrect && (
                      <IoCheckmarkCircle className="text-2xl text-emerald-400 shrink-0 ml-2" />
                    )}
                    {isAnswerSubmitted && isSelected && !isCorrect && (
                      <IoCloseCircle className="text-2xl text-red-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

          </div>

        </div>
      )}

      {/* 6. RESULTAT-SKÄRM (VICTORY / DEFEAT) */}
      {activeTab === "play" && gameState === "results" && (
        <div className="max-w-2xl mx-auto px-6 pt-12 text-center">
          <div className="bg-slate-900/90 border border-slate-800 p-8 sm:p-10 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden space-y-8">
            
            {/* Vinst / Förlust Header */}
            <div>
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl shadow-amber-500/20 animate-bounce">
                {isPlayerWinner ? (
                  <IoTrophy className="text-amber-400 text-4xl" />
                ) : isDraw ? (
                  <RiHandHeartLine className="text-amber-400 text-4xl" />
                ) : (
                  <IoFlash className="text-amber-400 text-4xl" />
                )}
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {isPlayerWinner ? "SEGER! DU VANN MATCHEN!" : isDraw ? "OAVGJORT SLAG!" : "FÖRLUST DENNA GÅNG!"}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {isPlayerWinner
                  ? `Fantastiskt kört! Du besegrade ${opponentName} med vass kunskap och snabba reflexer.`
                  : `Bra kämpat! ${opponentName} tog hem denna omgång. Ta revansch direkt!`}
              </p>
            </div>

            {/* Score Jämförelse */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-5 rounded-2xl border ${isPlayerWinner ? "bg-amber-500/10 border-amber-500 text-white" : "bg-slate-950 border-slate-800"}`}>
                <span className="text-xs font-bold text-slate-400 block">{playerName} (Du)</span>
                <span className="text-3xl font-black text-amber-400 mt-1 block">{playerScore}p</span>
                <span className="text-xs text-slate-400 font-semibold mt-1 block">
                  {playerCorrect} av {questions.length} rätt
                </span>
              </div>

              <div className={`p-5 rounded-2xl border ${!isPlayerWinner && !isDraw ? "bg-purple-600/10 border-purple-500 text-white" : "bg-slate-950 border-slate-800"}`}>
                <span className="text-xs font-bold text-slate-400 block">{opponentName}</span>
                <span className="text-3xl font-black text-purple-400 mt-1 block">{opponentScore}p</span>
                <span className="text-xs text-slate-400 font-semibold mt-1 block">
                  {opponentCorrect} av {questions.length} rätt
                </span>
              </div>
            </div>

            {/* Extra Stats */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 block">Högsta Kombo</span>
                <span className="text-base font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                  <IoFlame /> {maxCombo} i rad
                </span>
              </div>
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 block">Förtjänad XP</span>
                <span className="text-base font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <IoSparkles /> +{Math.round(playerScore / 2)} XP
                </span>
              </div>
            </div>

            {/* Knappar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleStartDemoQuestion()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 rounded-xl text-sm transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <IoRefreshOutline className="text-lg" />
                <span>Kör Demo Igen</span>
              </button>

              <button
                onClick={() => setGameState("lobby")}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-4 rounded-xl text-sm border border-slate-700 transition-all cursor-pointer"
              >
                Tillbaka till Lobby
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. LÅST MODAL (POPUP NÄR MAN KLICKAR PÅ LÅSTA FUNKTIONER) */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowLockedModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl mb-4 mx-auto">
              <IoLockClosedOutline />
            </div>
            <h3 className="text-2xl font-black text-white text-center mb-2">
              TeoriDuellen är under förhandsvisning
            </h3>
            <p className="text-slate-300 text-sm text-center leading-relaxed mb-6">
              Realtidsduellen (1v1 mot AI och vänner) är tillfälligt låst under vår pilotfas medan flerspelarsystemet kalibreras. Du kan läsa hela regelboken och hur duellen fungerar i vår guide, eller öva gratis på alla 3 000+ körkortsfrågor i TeoriProvet!
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowLockedModal(false);
                  setActiveTab("guide");
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <RiBookOpenLine />
                <span>Läs Guide & Regler</span>
              </button>
              <Link
                href="/theory-quiz"
                className="flex-1 py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <IoTrophy className="text-amber-400" />
                <span>Öva i TeoriProvet</span>
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#04060b] text-white flex items-center justify-center">
          <div className="text-center">
            <RiLoader4Line className="text-4xl animate-spin text-amber-400 block mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">Laddar TeoriDuellen...</p>
          </div>
        </div>
      }
    >
      <BattleContent />
    </Suspense>
  );
}
