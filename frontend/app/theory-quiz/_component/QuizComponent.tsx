"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import LanguageSwitcher, {
  getSavedLanguageCode,
  applyTranslationLanguage,
  SUPPORTED_LANGUAGES,
} from "../../_components/LanguageSwitcher";
import { getQuizText } from "../../_Translationdata/quizUiTranslations";
import { API_BASE_URL } from "../../_lib/api";
import {
  RiResetRightFill,
  RiSparklingFill,
  RiCheckLine,
  RiCloseLine,
  RiArrowRightLine,
  RiHistoryLine,
  RiRobot2Line,
  RiAwardLine,
  RiTimeLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiArrowLeftLine,
  RiDashboardLine,
  RiBookOpenLine,
  RiTrafficLightLine,
  RiLeafLine,
  RiErrorWarningLine,
  RiCarLine,
  RiMentalHealthLine,
  RiFlashlightLine,
  RiFocus3Line,
  RiCloseCircleLine,
  RiCheckboxCircleLine,
  RiRefreshLine,
  RiBarChartBoxLine,
  RiTranslate2,
  RiGlobalLine,
} from "react-icons/ri";
import {
  IoShieldCheckmark,
  IoTrophy,
  IoSparkles,
  IoCheckmarkCircle,
  IoStar,
  IoStarOutline,
  IoChatbubblesOutline,
} from "react-icons/io5";

interface QuizQuestion {
  id: number;
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

interface DetailedResult {
  questionNumber: number;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  category?: string;
}

interface CategoryStatBreakdown {
  correct: number;
  total: number;
  percent: number;
  name: string;
}

interface SubmissionResult {
  success: boolean;
  savedToDb?: boolean;
  isPracticeOnly?: boolean;
  resultId?: string;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  totalQuestions: number;
  percentageScore: number;
  requiredScore?: number;
  passed: boolean;
  isSlutprov?: boolean;
  category?: string;
  categoryTitle?: string;
  categoryBreakdown?: Record<string, CategoryStatBreakdown>;
  detailedResults: DetailedResult[];
}

interface HistoryItem {
  id: string;
  category: string;
  category_title: string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  score_percent: number;
  passed: boolean;
  time_spent_sec?: number;
  category_breakdown?: Record<string, CategoryStatBreakdown>;
  details?: DetailedResult[];
  created_at: string;
}

interface HistoryResponse {
  success: boolean;
  stats: {
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
    averageScore: number;
    bestScore: number;
  };
  history: HistoryItem[];
}

interface AiCoachData {
  hasData: boolean;
  weakestCategory?: string;
  weakestCategoryName?: string;
  weakestAccuracy?: number;
  strongestCategoryName?: string;
  strongestAccuracy?: number;
  headline: string;
  message: string;
  recommendedCategory?: string;
  recommendedActionText?: string;
  keyTips?: string[];
}

// Inline AI-förklaringskort vid felaktiga frågor i genomgången
function InlineAiReviewCard({
  question,
  selectedAnswer,
  correctAnswer,
}: {
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleFetch = async () => {
    setOpen(true);
    if (explanation || loading) return;
    setLoading(true);
    try {
      const userLang = (typeof window !== "undefined" ? localStorage.getItem("user_language") : "sv") || "sv";
      const res = await fetch("/api/quiz-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, selectedAnswer, correctAnswer, language: userLang }),
      });
      const data = await res.json();
      setExplanation(data.explanation || "Ingen pedagogisk förklaring kunde hämtas.");
    } catch {
      setExplanation("Kunde inte ansluta till AI-tjänsten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
      {!open ? (
        <button
          type="button"
          onClick={handleFetch}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all cursor-pointer shadow-sm"
        >
          <RiSparklingFill className="text-amber-400" />
          <span>Få AI-förklaring på varför detta svar är fel</span>
        </button>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-slate-300 space-y-1">
          <span className="font-black text-amber-400 flex items-center gap-1.5">
            <RiSparklingFill /> Pedagogisk AI-lösningsmetod:
          </span>
          {loading ? (
            <p className="animate-pulse text-amber-300 py-1">Hämtar pedagogisk förklaring från AI-coachen...</p>
          ) : (
            <p className="whitespace-pre-line leading-relaxed text-slate-200 mt-1">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuizComponent() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"quiz" | "history" | "coach">("quiz");

  // Provvy-tillstånd: 'overview' (visar delmoment & prov), 'active_quiz' (inne i ett prov), 'result' (efter prov)
  const [quizStage, setQuizStage] = useState<"overview" | "active_quiz" | "result">("overview");

  // Quiz State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [rawQuestions, setRawQuestions] = useState<QuizQuestion[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>("slutprov");
  const [categoryTitle, setCategoryTitle] = useState<string>("Slutprov (Trafikverket)");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(true); // 100% Gratis för alla!
  const [userType, setUserType] = useState<string>("user");

  // Språk- och översättningstillstånd
  const [currentLang, setCurrentLang] = useState<string>("sv");
  const [isTranslatingQuestion, setIsTranslatingQuestion] = useState<boolean>(false);
  const [selectedOptionIndices, setSelectedOptionIndices] = useState<(number | null)[]>([]);
  const translationCache = React.useRef<Record<string, Record<string | number, QuizQuestion>>>({});

  // Lyssna på språkändring
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getSavedLanguageCode();
    setCurrentLang(saved);

    const handleLang = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail && custom.detail !== currentLang) {
        setCurrentLang(custom.detail);
      }
    };
    window.addEventListener("languageChanged", handleLang);
    return () => window.removeEventListener("languageChanged", handleLang);
  }, [currentLang]);

  // Funktion för att översätta en enskild fråga med caching
  const translateSingleQuestion = useCallback(
    async (q: QuizQuestion, targetLang: string): Promise<QuizQuestion> => {
      if (targetLang === "sv") {
        return {
          ...q,
          question: q.originalQuestion || q.question,
          options: q.originalOptions || q.options,
          answer: q.originalAnswer || q.answer,
          language: "sv",
        };
      }

      const cacheKey = q.id || q.question;
      if (translationCache.current[targetLang]?.[cacheKey]) {
        return translationCache.current[targetLang][cacheKey];
      }

      try {
        const res = await fetch("/api/quiz-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetLanguage: targetLang,
            questions: [q],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.questions?.[0]) {
            const translated = data.questions[0];
            if (!translationCache.current[targetLang]) {
              translationCache.current[targetLang] = {};
            }
            translationCache.current[targetLang][cacheKey] = translated;
            return translated;
          }
        }
      } catch (err) {
        console.warn("Kunde inte översätta fråga:", err);
      }
      return q;
    },
    []
  );

  // Feedback State (Obligatorisk feedback för att gå vidare)
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [feedbackName, setFeedbackName] = useState<string>("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string>("");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>([]);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [startingQuiz, setStartingQuiz] = useState<boolean>(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);

  // Resultat
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  // AI-förklaring
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState<boolean>(false);
  const [showAiExplanation, setShowAiExplanation] = useState<boolean>(false);

  // Betalningsbekräftelse
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Provhistorik data (Endast för fullständiga 65-frågors slutprov)
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // AI Coach data
  const [aiCoach, setAiCoach] = useState<AiCoachData | null>(null);
  const [loadingCoach, setLoadingCoach] = useState<boolean>(false);

  // Nyckel för att spara och återställa pågående provsession vid språkväxling / sidomladdning
  const ACTIVE_QUIZ_STORAGE_KEY = "teorimaster_active_quiz_progress";

  // Återställ provsession från sessionStorage vid reload / språkväxling
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(ACTIVE_QUIZ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          setQuestions(parsed.questions);
          if (Array.isArray(parsed.rawQuestions)) {
            setRawQuestions(parsed.rawQuestions);
          } else {
            setRawQuestions(parsed.questions);
          }
          if (parsed.currentLang) {
            setCurrentLang(parsed.currentLang);
          }
          setCurrentCategory(parsed.currentCategory || "slutprov");
          setCategoryTitle(parsed.categoryTitle || "Slutprov (Trafikverket)");
          setCurrentQuestionIndex(typeof parsed.currentQuestionIndex === "number" ? parsed.currentQuestionIndex : 0);
          setSelectedOptions(Array.isArray(parsed.selectedOptions) ? parsed.selectedOptions : new Array(parsed.questions.length).fill(null));
          if (Array.isArray(parsed.selectedOptionIndices)) {
            setSelectedOptionIndices(parsed.selectedOptionIndices);
          }
          setTimeSpentSeconds(typeof parsed.timeSpentSeconds === "number" ? parsed.timeSpentSeconds : 0);
          setIsAnswerSubmitted(Boolean(parsed.isAnswerSubmitted));
          setQuizStage("active_quiz");
        }
      }
    } catch (e) {
      console.warn("Kunde inte återställa provsession från sessionStorage:", e);
    }
  }, []);

  // Dynamisk översättning av aktiv fråga när språket växlas
  useEffect(() => {
    if (quizStage !== "active_quiz" || rawQuestions.length === 0) return;

    let isMounted = true;
    const translateActive = async () => {
      const rawQ = rawQuestions[currentQuestionIndex];
      if (!rawQ) return;

      if (currentLang === "sv") {
        setQuestions((prev) => {
          const updated = [...prev];
          updated[currentQuestionIndex] = {
            ...rawQ,
            question: rawQ.originalQuestion || rawQ.question,
            options: rawQ.originalOptions || rawQ.options,
            answer: rawQ.originalAnswer || rawQ.answer,
            language: "sv",
          };
          return updated;
        });

        const selIdx = selectedOptionIndices[currentQuestionIndex];
        if (typeof selIdx === "number" && rawQ.options[selIdx]) {
          setSelectedOptions((prev) => {
            const up = [...prev];
            up[currentQuestionIndex] = rawQ.options[selIdx];
            return up;
          });
        }
        return;
      }

      setIsTranslatingQuestion(true);
      try {
        const translated = await translateSingleQuestion(rawQ, currentLang);
        if (isMounted) {
          setQuestions((prev) => {
            const updated = [...prev];
            updated[currentQuestionIndex] = translated;
            return updated;
          });

          const selIdx = selectedOptionIndices[currentQuestionIndex];
          if (typeof selIdx === "number" && translated.options?.[selIdx]) {
            setSelectedOptions((prev) => {
              const up = [...prev];
              up[currentQuestionIndex] = translated.options[selIdx];
              return up;
            });
          }
        }
      } finally {
        if (isMounted) setIsTranslatingQuestion(false);
      }

      // Prefetch nästa 2 frågor i bakgrunden
      for (let i = 1; i <= 2; i++) {
        const nextIdx = currentQuestionIndex + i;
        if (nextIdx < rawQuestions.length && isMounted) {
          translateSingleQuestion(rawQuestions[nextIdx], currentLang).catch(() => {});
        }
      }
    };

    translateActive();

    return () => {
      isMounted = false;
    };
  }, [currentLang, currentQuestionIndex, quizStage, rawQuestions, selectedOptionIndices, translateSingleQuestion]);

  // Spara aktiv provsession kontinuerligt
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (quizStage === "active_quiz" && questions.length > 0) {
      try {
        sessionStorage.setItem(
          ACTIVE_QUIZ_STORAGE_KEY,
          JSON.stringify({
            questions,
            rawQuestions: rawQuestions.length > 0 ? rawQuestions : questions,
            currentLang,
            currentCategory,
            categoryTitle,
            currentQuestionIndex,
            selectedOptions,
            selectedOptionIndices,
            timeSpentSeconds,
            isAnswerSubmitted,
          })
        );
      } catch (e) {
        console.warn("Kunde inte spara provsession till sessionStorage:", e);
      }
    }
  }, [quizStage, questions, rawQuestions, currentLang, currentCategory, categoryTitle, currentQuestionIndex, selectedOptions, selectedOptionIndices, timeSpentSeconds, isAnswerSubmitted]);

  // Timer för provtid
  useEffect(() => {
    if (quizStage !== "active_quiz" || startingQuiz) return;
    const interval = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [quizStage, startingQuiz]);

  // Kolla URL om betalning lyckades
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success") {
        setShowSuccessToast(true);
      }
    }
  }, []);

  // Hämta AI Coach
  const fetchAiCoach = useCallback(async () => {
    try {
      setLoadingCoach(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/quiz-test/ai-coach`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAiCoach(data);
      }
    } catch (e) {
      console.warn("Kunde inte hämta AI-coach:", e);
    } finally {
      setLoadingCoach(false);
    }
  }, []);

  // Hämta provhistorik från databasen (endast fullständiga 65-frågors slutprov)
  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/quiz-test/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (e) {
      console.warn("Kunde inte hämta historik:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Hämta initial behörighetsstatus och kategorier
  const checkAccessAndInit = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/quiz-test/questions?category=slutprov`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(true); // Alla användare har full gratis tillgång!
        setUserType(data.userType || "user");
      }
      if (token) {
        fetchAiCoach();
      }
    } catch (err) {
      console.warn("Fel vid kontroll av behörighet:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchAiCoach]);

  useEffect(() => {
    checkAccessAndInit();
  }, [checkAccessAndInit]);

  // Byt flik och ladda data om behövs
  const handleTabChange = (tab: "quiz" | "history" | "coach") => {
    setActiveTab(tab);
    if (tab === "history") {
      fetchHistory();
    } else if (tab === "coach") {
      fetchAiCoach();
    }
  };

  // Starta ett valt prov eller delmoment (100% GRATIS)
  const handleStartExam = async (catId: string, customName?: string) => {
    const isSlutprov = catId === "slutprov" || catId === "alla";

    try {
      setStartingQuiz(true);
      setFeedbackSubmitted(false);
      setFeedbackMessage("");
      setFeedbackError("");
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = `${API_BASE_URL}/api/quiz-test/questions?category=${encodeURIComponent(catId)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Kunde inte hämta frågor");

      const data = await res.json();
      const fetchedQuestions: QuizQuestion[] = data.questions || [];

      if (fetchedQuestions.length === 0) {
        throw new Error("Inga frågor returnerades");
      }

      setRawQuestions(fetchedQuestions);
      let initQuestions = fetchedQuestions;

      // Om valt språk inte är svenska, översätt första frågan direkt
      if (currentLang !== "sv" && fetchedQuestions.length > 0) {
        setIsTranslatingQuestion(true);
        try {
          const firstTrans = await translateSingleQuestion(fetchedQuestions[0], currentLang);
          initQuestions = [...fetchedQuestions];
          initQuestions[0] = firstTrans;
        } finally {
          setIsTranslatingQuestion(false);
        }

        // Prefetch fråga 2 och 3 i bakgrunden
        if (fetchedQuestions.length > 1) {
          translateSingleQuestion(fetchedQuestions[1], currentLang).catch(() => {});
        }
        if (fetchedQuestions.length > 2) {
          translateSingleQuestion(fetchedQuestions[2], currentLang).catch(() => {});
        }
      }

      setQuestions(initQuestions);
      setSelectedOptions(new Array(fetchedQuestions.length).fill(null));
      setSelectedOptionIndices(new Array(fetchedQuestions.length).fill(null));
      setCurrentQuestionIndex(0);
      setIsAnswerSubmitted(false);
      setCurrentCategory(data.category || catId);
      setCategoryTitle(data.categoryTitle || customName || (isSlutprov ? "Slutprov (Trafikverket)" : "Delmoment"));
      setTimeSpentSeconds(0);
      setAiExplanation(null);
      setShowAiExplanation(false);
      setQuizStage("active_quiz");
    } catch (e) {
      console.warn("Kunde inte ladda frågor från servern, använder reservfrågor:", e);
      const fallbackQuestions: QuizQuestion[] = [
        { id: 1, question: "Vad innebär högerregeln i en korsning utan skyltar?", options: ["Du har väjningsplikt mot fordon som kommer från höger", "Du har alltid företräde", "Vänster fordon kör först", "Den som kör snabbast kör först"], answer: "Du har väjningsplikt mot fordon som kommer från höger", category: "trafikregler" },
        { id: 2, question: "Vilket ämne i bilens avgaser bidrar till försurning av skog och sjöar?", options: ["Koldioxid", "Svaveldioxid", "Kväveoxid", "Metangas"], answer: "Svaveldioxid", category: "miljo" },
        { id: 3, question: "Vad är den lagliga promillegränsen för rattfylleri i Sverige?", options: ["0.0 promille", "0.2 promille", "0.5 promille", "1.0 promille"], answer: "0.2 promille", category: "manniskan" },
        { id: 4, question: "Vilket är minsta tillåtna mönsterdjup för sommardäck enligt lag?", options: ["1.0 mm", "1.6 mm", "3.0 mm", "4.0 mm"], answer: "1.6 mm", category: "fordon" },
        { id: 5, question: "Vad betyder en tresidig vägmärkesskylt med spetsen nedåt?", options: ["Huvudled", "Stopplikt", "Väjningsplikt", "Förbud mot fordon"], answer: "Väjningsplikt", category: "vagmärken" },
      ];
      setRawQuestions(fallbackQuestions);
      let initQ = fallbackQuestions;
      if (currentLang !== "sv") {
        try {
          const trans = await translateSingleQuestion(fallbackQuestions[0], currentLang);
          initQ = [...fallbackQuestions];
          initQ[0] = trans;
        } catch {}
      }
      setQuestions(initQ);
      setSelectedOptions(new Array(fallbackQuestions.length).fill(null));
      setSelectedOptionIndices(new Array(fallbackQuestions.length).fill(null));
      setCurrentQuestionIndex(0);
      setIsAnswerSubmitted(false);
      setCurrentCategory(catId);
      setCategoryTitle(customName || "Testprov");
      setTimeSpentSeconds(0);
      setQuizStage("active_quiz");
    } finally {
      setStartingQuiz(false);
    }
  };

  // Återvänd till översikten över alla delmoment
  const handleBackToOverview = () => {
    if (quizStage === "active_quiz" && selectedOptions.some((opt) => opt !== null)) {
      const confirmLeave = window.confirm(getQuizText(currentLang, "leaveConfirm"));
      if (!confirmLeave) return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY);
    }
    setQuizStage("overview");
    setQuestions([]);
    setRawQuestions([]);
    setSelectedOptionIndices([]);
    setCurrentQuestionIndex(0);
    setIsAnswerSubmitted(false);
  };

  // Välj svarsalternativ
  const handleOptionSelect = (option: string, optionIndex?: number) => {
    if (isAnswerSubmitted) return;

    const newOptions = [...selectedOptions];
    newOptions[currentQuestionIndex] = option;
    setSelectedOptions(newOptions);

    const newIndices = [...selectedOptionIndices];
    const resolvedIndex = typeof optionIndex === "number" ? optionIndex : questions[currentQuestionIndex]?.options.indexOf(option);
    newIndices[currentQuestionIndex] = resolvedIndex >= 0 ? resolvedIndex : null;
    setSelectedOptionIndices(newIndices);

    setIsAnswerSubmitted(true);
    setAiExplanation(null);
    setShowAiExplanation(false);
  };

  // Hämta pedagogisk AI-förklaring (Gemini 2.5 Flash)
  const handleFetchAiExplanation = async () => {
    setShowAiExplanation(true);
    if (aiExplanation || isLoadingExplanation) return;

    const currentQ = questions[currentQuestionIndex];
    const selectedAns = selectedOptions[currentQuestionIndex];
    if (!currentQ || !selectedAns) return;

    try {
      setIsLoadingExplanation(true);
      const userLang = (typeof window !== "undefined" ? localStorage.getItem("user_language") : "sv") || "sv";
      const res = await fetch("/api/quiz-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQ.question,
          selectedAnswer: selectedAns,
          correctAnswer: currentQ.answer,
          language: userLang,
        }),
      });

      const data = await res.json();
      setAiExplanation(data.explanation || data.error || "Pedagogisk förklaring kunde inte hämtas just nu.");
    } catch (e) {
      console.error("Fel vid hämtning av AI-förklaring:", e);
      setAiExplanation("Kunde inte ansluta till AI-tjänsten.");
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  // Skicka obligatorisk feedback och spara i databasen
  const handleSubmitFeedback = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!feedbackMessage.trim() || feedbackMessage.trim().length < 4) {
      setFeedbackError("Vänligen skriv en kort recension/feedback (minst 4 tecken) för att låsa upp nästa steg.");
      return;
    }

    setFeedbackError("");
    setIsSubmittingFeedback(true);
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      let userName = feedbackName.trim();
      let userEmail: string | undefined = undefined;
      let userId: string | undefined = undefined;

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed) {
            userName = userName || parsed.name || parsed.email?.split("@")[0] || "Körkortselev";
            userEmail = parsed.email || userEmail;
            userId = parsed.id || undefined;
          }
        } catch {}
      }

      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName || "Körkortselev",
          email: userEmail,
          rating: feedbackRating || 5,
          category: categoryTitle || "Slutprov",
          message: feedbackMessage.trim(),
          userId,
        }),
      });

      if (res.ok) {
        setFeedbackSubmitted(true);
      } else {
        setFeedbackError("Kunde inte spara feedback just nu. Försök igen!");
      }
    } catch {
      setFeedbackError("Nätverksfel vid anslutning till feedbackservern.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Gå till nästa fråga eller slutför provet
  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setIsAnswerSubmitted(false);
      setAiExplanation(null);
      setShowAiExplanation(false);

      // Om valt språk inte är svenska, se till att nästa fråga översätts/hämtas från cache
      if (currentLang !== "sv" && rawQuestions[nextIdx]) {
        const nextRaw = rawQuestions[nextIdx];
        const cacheKey = nextRaw.id || nextRaw.question;
        const cached = translationCache.current[currentLang]?.[cacheKey];
        if (cached) {
          setQuestions((prev) => {
            const up = [...prev];
            up[nextIdx] = cached;
            return up;
          });
        } else {
          setIsTranslatingQuestion(true);
          try {
            const trans = await translateSingleQuestion(nextRaw, currentLang);
            setQuestions((prev) => {
              const up = [...prev];
              up[nextIdx] = trans;
              return up;
            });
          } finally {
            setIsTranslatingQuestion(false);
          }
        }

        // Prefetch frågan efter i bakgrunden
        const nextNextIdx = nextIdx + 1;
        if (nextNextIdx < rawQuestions.length) {
          translateSingleQuestion(rawQuestions[nextNextIdx], currentLang).catch(() => {});
        }
      }
    } else {
      handleFinishQuiz();
    }
  };

  // Slutför quiz och beräkna resultat (Sparas endast i DB om det är Slutprov 65 frågor)
  const handleFinishQuiz = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY);
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Mappa översatta svar tillbaka till svenskt format för backend så att rättning blir 100% korrekt
      const answersForBackend = selectedOptions.map((ans, idx) => {
        if (!ans) return null;
        const q = questions[idx];
        const rawQ = rawQuestions[idx] || q;
        if (q && q.options && rawQ && rawQ.options) {
          const optIdx = q.options.indexOf(ans);
          if (optIdx >= 0 && optIdx < rawQ.options.length) {
            return rawQ.options[optIdx];
          }
        }
        return ans;
      });

      const res = await fetch(`${API_BASE_URL}/api/quiz-test/submit-answers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category: currentCategory,
          answers: answersForBackend,
          questions: rawQuestions.length > 0 ? rawQuestions : questions,
          timeSpentSec: timeSpentSeconds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmissionResult(data);
      } else {
        fallbackCalculate();
      }
    } catch {
      fallbackCalculate();
    } finally {
      setQuizStage("result");
      fetchAiCoach(); // Uppdatera AI-coach i bakgrunden
    }
  };

  const fallbackCalculate = () => {
    let correct = 0;
    const detailed = questions.map((q, idx) => {
      const userAns = selectedOptions[idx] || "Ej besvarad";
      const rawQ = rawQuestions[idx] || q;
      const correctIdx = rawQ.options ? rawQ.options.indexOf(rawQ.answer) : q.options.indexOf(q.answer);
      const isCorr =
        userAns.trim().toLowerCase() === q.answer.trim().toLowerCase() ||
        (q.options.indexOf(userAns) >= 0 && q.options.indexOf(userAns) === correctIdx);

      if (isCorr) correct++;
      return {
        questionNumber: idx + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.answer,
        userAnswer: userAns,
        isCorrect: isCorr,
        category: q.category,
      };
    });
    const percentage = Math.round((correct / questions.length) * 100);
    const isSlutprov = (currentCategory === "slutprov" || currentCategory === "alla") && questions.length >= 60;
    const passed = isSlutprov ? correct >= 52 : percentage >= 80;

    setSubmissionResult({
      success: true,
      correctCount: correct,
      incorrectCount: questions.length - correct,
      skippedCount: 0,
      totalQuestions: questions.length,
      percentageScore: percentage,
      requiredScore: isSlutprov ? 52 : Math.ceil(questions.length * 0.8),
      passed,
      isSlutprov,
      isPracticeOnly: !isSlutprov,
      category: currentCategory,
      categoryTitle,
      detailedResults: detailed,
    });
  };

  const handleRestartCurrent = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ACTIVE_QUIZ_STORAGE_KEY);
    }
    handleStartExam(currentCategory, categoryTitle);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-300">Laddar behörighet och delmoment...</p>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];
  const selectedAns = selectedOptions[currentQuestionIndex];
  const isWrong = isAnswerSubmitted && selectedAns !== currentQ?.answer;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* BETALNINGSBEKRÄFTELSE-BANNER */}
      {showSuccessToast && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/90 to-emerald-900/80 p-4 text-emerald-200 shadow-2xl backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-3">
            <IoCheckmarkCircle className="text-3xl text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-300 text-sm sm:text-base">
                Betalning genomförd – Välkommen som full medlem!
              </p>
              <p className="text-xs text-emerald-400/90 mt-0.5">
                Alla delprov och över 1 000 körkortsfrågor har nu låsts upp. Klicka på valfritt delmoment eller Slutprov nedan för att börja öva.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSuccessToast(false)}
            className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-800/40 hover:text-white transition-colors"
            title="Stäng"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOPP-NAVIGERING (FLIKAR: PROV & DELMOMENT, HISTORIK, AI-COACH) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              handleTabChange("quiz");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "quiz"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <RiDashboardLine className="text-base" />
            <span>Delmoment & Prov</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("history")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "history"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <RiHistoryLine className="text-base" />
            <span>Senaste Resultat (65 frågor)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("coach")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "coach"
                ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/20"
                : "border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-purple-300 hover:bg-slate-800"
            }`}
          >
            <RiRobot2Line className="text-base text-purple-400" />
            <span>AI TeoriCoach</span>
          </button>

          <Link
            href="/community"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs sm:text-sm font-bold text-slate-300 hover:text-amber-400 hover:border-amber-500/40 hover:bg-slate-800 transition-all"
          >
            <IoChatbubblesOutline className="text-base text-slate-400" />
            <span>Chattforum</span>
          </Link>
        </div>

        {/* Status märke */}
        {userType === "admin" && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
            <IoShieldCheckmark className="text-xs text-amber-400" /> Admin – Fri Tillgång
          </span>
        )}
      </div>

      {/* ======================================================== */}
      {/* FLIK 1: DELMOMENT & PROV */}
      {/* ======================================================== */}
      {activeTab === "quiz" && (
        <>
          {/* LÄGE 1: ÖVERSIKT ÖVER DELMOMENT OCH SLUTPROV (Man ser inte frågor direkt utan kan klicka sig in i varje del!) */}
          {quizStage === "overview" && (
            <div className="space-y-6 animate-fade-in">
              {/* STATUS-BANNER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl border ${
                      userType === "admin"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : isSubscribed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {userType === "admin" ? (
                      <IoShieldCheckmark className="text-amber-400 text-2xl" />
                    ) : isSubscribed ? (
                      <IoCheckmarkCircle className="text-emerald-400 text-2xl" />
                    ) : (
                      <RiFlashlightLine className="text-amber-400 text-2xl" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-black text-white text-base sm:text-lg">
                        {userType === "admin"
                          ? "Admin – Samtliga Delmoment & Slutprov Upplåsta"
                          : isSubscribed
                          ? "Full Medlem – Samtliga Delmoment & Slutprov Upplåsta"
                          : "Gratis Testkonto"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isSubscribed
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {isSubscribed ? "Aktiv Behörighet" : "Testläge"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isSubscribed
                        ? "Klicka på ett delmoment nedan för att öva specifika regler, eller gör ett skarpt Slutprov på 65 frågor."
                        : "Du har begränsad tillgång. Gör ett gratis snabbtest eller lås upp alla delprov och fullständiga slutprov."}
                    </p>
                  </div>
                </div>

                {!isSubscribed && (
                  <Link
                    href="/subscription"
                    className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-105"
                  >
                    <IoShieldCheckmark className="text-base" />
                    <span>Lås upp alla delmoment</span>
                  </Link>
                )}
              </div>

              {/* AI COACH SMART RECOMMENDATION BANNER */}
              {aiCoach?.hasData && isSubscribed && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/40 p-4 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-xl text-purple-300 border border-purple-500/30">
                      <RiRobot2Line />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-400">
                          Smart AI-Coach Rekommendation
                        </span>
                        <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.2 text-[10px] font-bold text-rose-300">
                          Svagt område identifierat
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium mt-0.5">
                        {aiCoach.message}
                      </p>
                    </div>
                  </div>

                  {aiCoach.recommendedCategory && (
                    <button
                      type="button"
                      disabled={startingQuiz}
                      onClick={() => handleStartExam(aiCoach.recommendedCategory!, aiCoach.weakestCategoryName)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-purple-500/20 hover:scale-105 transition-all"
                    >
                      {aiCoach.recommendedActionText || "Öva på svagheten"}
                    </button>
                  )}
                </div>
              )}

              {/* TYDLIG OCH PROFFSIG SPRÅKVÄLJARE FÖR TEORIPROVET MED SNABBVAL & MODAL */}
              <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-900/95 via-slate-950 to-slate-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl text-amber-400 border border-amber-500/30">
                      <RiGlobalLine />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">
                          {getQuizText(currentLang, "languageLabel")}
                        </span>
                        <span className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                          {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.flag}{" "}
                          {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.nativeName || "Svenska"} ({SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.name || "Svenska"})
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Alla 65 frågor, svarsalternativ, rättningsresultat och AI-coach anpassas automatiskt till det valda språket.
                      </p>
                    </div>
                  </div>

                  {/* Öppna full språkväljare med alla 14 språk */}
                  <div className="shrink-0 w-full sm:w-auto">
                    <LanguageSwitcher
                      variant="pill"
                      buttonText="Alla 14 språk ▾"
                      className="w-full sm:w-auto"
                    />
                  </div>
                </div>

                {/* SNABBVAL: DE MEST POPULÄRA SPRÅKEN DIREKT MED ETT KLICK */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Snabbval:
                  </span>
                  {[
                    { code: "sv", label: "Svenska", flag: "🇸🇪" },
                    { code: "en", label: "English", flag: "🇬🇧" },
                    { code: "ar", label: "العربية", flag: "🇸🇦" },
                    { code: "so", label: "Soomaali", flag: "🇸🇴" },
                    { code: "ti", label: "ትግርኛ", flag: "🇪🇷" },
                    { code: "fa", label: "فارسی", flag: "🇮🇷" },
                    { code: "tr", label: "Türkçe", flag: "🇹🇷" },
                    { code: "uk", label: "Українська", flag: "🇺🇦" },
                  ].map((quick) => {
                    const isActive = currentLang === quick.code;
                    return (
                      <button
                        key={quick.code}
                        type="button"
                        onClick={() => applyTranslationLanguage(quick.code)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                          isActive
                            ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 scale-105"
                            : "bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/40"
                        }`}
                      >
                        <span>{quick.flag}</span>
                        <span>{quick.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HUVUDKORT: TRAFIKVERKETS SLUTPROV (65 FRÅGOR) */}
              <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/80 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-orange-500/10 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                        {getQuizText(currentLang, "officialSimulation")}
                      </span>
                      <span className="text-xs font-bold text-amber-400">
                        {getQuizText(currentLang, "savesInHistory")}
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                      <IoTrophy className="text-amber-400 text-2xl sm:text-3xl shrink-0" />
                      <span>{getQuizText(currentLang, "slutprovTitle")}</span>
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {getQuizText(currentLang, "slutprovDesc")}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300 pt-1">
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5">
                        <RiBookOpenLine className="text-amber-400" />
                        <span>{getQuizText(currentLang, "randomQuestions65")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5">
                        <RiAwardLine className="text-emerald-400" />
                        <span>{getQuizText(currentLang, "passRequirement")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5">
                        <RiTimeLine className="text-blue-400" />
                        <span>{getQuizText(currentLang, "timingIncluded")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-auto shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={startingQuiz}
                      onClick={() => handleStartExam("slutprov", "Slutprov (Trafikverket)")}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-105 hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer"
                    >
                      {startingQuiz && currentCategory === "slutprov" ? (
                        <span>{getQuizText(currentLang, "loadingQuestions")}</span>
                      ) : (
                        <>
                          <span>{getQuizText(currentLang, "startSlutprov")}</span>
                          <RiArrowRightLine className="text-lg" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* SEKTION: ÖVA PÅ DELMOMENT */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <RiBookOpenLine className="text-amber-400" />
                      <span>{getQuizText(currentLang, "categorySectionTitle")}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getQuizText(currentLang, "categorySectionDesc")}
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <IoSparkles className="text-amber-400 text-xs" /> Alla delmoment är 100% gratis
                  </span>
                </div>

                {/* GRID MED DELMOMENT-KORT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. TRAFIKREGLER */}
                  <div
                    onClick={() => handleStartExam("trafikregler", "Trafikregler & Vägar")}
                    className="group relative cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-md transition-all hover:border-amber-500/60 hover:bg-slate-900 hover:shadow-amber-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-2xl border border-amber-500/20 text-amber-400">
                          <RiTrafficLightLine />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                            Trafikregler & Vägar
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-400">
                            30 övningsfrågor
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Högerregeln, väjningsplikt, hastigheter, omkörning, cirkulationsplatser och placering på vägen.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400">
                      <span>Öva på Trafikregler</span>
                      <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* 2. MILJÖ */}
                  <div
                    onClick={() => handleStartExam("miljo", "Miljö & Ecodriving")}
                    className="group relative cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-md transition-all hover:border-emerald-500/60 hover:bg-slate-900 hover:shadow-emerald-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl border border-emerald-500/20 text-emerald-400">
                          <RiLeafLine />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                            Miljö & Ecodriving
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-400">
                            30 övningsfrågor
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Miljövänlig körning, bränsleförbrukning, katalysator, tomgångskörning och minskade utsläpp.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>Öva på Miljö</span>
                      <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* 3. VÄGMÄRKEN */}
                  <div
                    onClick={() => handleStartExam("vagmärken", "Vägmärken & Skyltar")}
                    className="group relative cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-md transition-all hover:border-rose-500/60 hover:bg-slate-900 hover:shadow-rose-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-2xl border border-rose-500/20 text-rose-400">
                          <RiErrorWarningLine />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-rose-400 transition-colors">
                            Vägmärken & Skyltar
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-400">
                            30 övningsfrågor
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Varningsmärken, förbudsmärken, påbudsmärken, anvisningsmärken, vägmarkeringar och tilläggstavlor.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-rose-400">
                      <span>Öva på Vägmärken</span>
                      <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* 4. FORDON & SÄKERHET */}
                  <div
                    onClick={() => handleStartExam("fordon", "Fordon & Säkerhet")}
                    className="group relative cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-md transition-all hover:border-blue-500/60 hover:bg-slate-900 hover:shadow-blue-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl border border-blue-500/20 text-blue-400">
                          <RiCarLine />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                            Fordon & Säkerhet
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-400">
                            30 övningsfrågor
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Däck och mönsterdjup, bromssystem, belysning, lastning, släpvagn och säkerhetskontroll.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-blue-400">
                      <span>Öva på Fordon & Säkerhet</span>
                      <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* 5. MÄNNISKAN I TRAFIKEN */}
                  <div
                    onClick={() => handleStartExam("manniskan", "Människan i trafiken")}
                    className="group relative cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-md transition-all hover:border-purple-500/60 hover:bg-slate-900 hover:shadow-purple-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-2xl border border-purple-500/20 text-purple-400">
                          <RiMentalHealthLine />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base group-hover:text-purple-400 transition-colors">
                            Människan i trafiken
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-400">
                            30 övningsfrågor
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Alkohol och droger, trötthet, reaktionstid, synfält, mobilanvändning och grupptryck.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-purple-400">
                      <span>Öva på Människan</span>
                      <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* 6. AI SVAGHETSTRÄNING ELLER GRATIS TESTPROV */}
                  {!isSubscribed ? (
                    <div
                      onClick={() => handleStartExam("test", "Gratis Testprov")}
                      className="group relative cursor-pointer rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-slate-900/90 p-5 shadow-lg backdrop-blur-md transition-all hover:border-amber-400 hover:bg-slate-900 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-2xl border border-amber-500/30 text-amber-400">
                            <RiFlashlightLine />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors">
                              Gratis Testprov
                            </h4>
                            <span className="text-[11px] font-semibold text-amber-300">
                              5 representativa frågor
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Testa provsystemet helt gratis med ett urval av frågor från alla olika kategorier innan du låser upp.
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-300">
                        <span>Gör Gratis Testprov</span>
                        <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartExam("weaknesses", "AI-Träning: Dina svagheter")}
                      className="group relative cursor-pointer rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-slate-900/90 p-5 shadow-lg backdrop-blur-md transition-all hover:border-purple-400 hover:bg-slate-900 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-2xl border border-purple-500/30 text-purple-400">
                            <RiFocus3Line />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base group-hover:text-purple-300 transition-colors">
                              AI-Träning: Svagheter
                            </h4>
                            <span className="text-[11px] font-semibold text-purple-300">
                              Skräddarsydd träning
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          AI analyserar dina tidigare prov och plockar automatiskt fram frågor från de områden där du senast svarat fel.
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-purple-500/30 flex items-center justify-between text-xs font-bold text-purple-300">
                        <span>Starta Svaghetsträning</span>
                        <RiArrowRightLine className="transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LÄGE 2: INNE I ETT AKTIVT PROV ELLER DELMOMENT */}
          {quizStage === "active_quiz" && currentQ && (
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-fade-in">
              {/* Översta navigering med TILLBAKA-knapp & Verktygsrad */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-slate-800/60 pb-4 mb-6">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/40 transition-all shadow-md"
                >
                  <RiArrowLeftLine className="text-base text-amber-400" />
                  <span>{getQuizText(currentLang, "cancelQuiz")}</span>
                </button>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs font-bold text-slate-300">
                    <RiTimeLine className="text-amber-400" />
                    <span>{formatTime(timeSpentSeconds)}</span>
                  </div>

                  <LanguageSwitcher />

                  <button
                    type="button"
                    onClick={handleRestartCurrent}
                    title="Börja om provet"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-700 transition-all"
                  >
                    <RiResetRightFill />
                    <span className="hidden sm:inline">Starta om</span>
                  </button>
                </div>
              </div>

              {/* Titel & Info */}
              <div className="mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  {categoryTitle}
                </span>
                <div className="flex items-center flex-wrap gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-200">
                    {getQuizText(currentLang, "question")} {currentQuestionIndex + 1} {getQuizText(currentLang, "of")} {questions.length}
                  </span>
                  {currentCategory === "slutprov" && (
                    <span className="text-xs text-slate-400 font-medium">
                      ({getQuizText(currentLang, "passRequirementShort")})
                    </span>
                  )}
                  {isTranslatingQuestion && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 animate-pulse">
                      <RiTranslate2 className="text-xs text-amber-400 animate-spin" />
                      <span>{getQuizText(currentLang, "translatingQuestion")}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800 mb-6">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>

              {/* Frågetext */}
              <h2 className="text-lg sm:text-xl font-bold text-white leading-relaxed mb-6">
                {currentQ.question}
              </h2>

              {/* Valfri bild */}
              {currentQ.imageUrl && (
                <div className="relative mb-6 h-48 sm:h-64 w-full overflow-hidden rounded-2xl border border-slate-800">
                  <Image
                    src={currentQ.imageUrl}
                    alt="Frågebild"
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Svarsalternativ */}
              <div className="space-y-3 mb-8">
                {currentQ.options.map((option, index) => {
                  const rawQ = rawQuestions[currentQuestionIndex] || currentQ;
                  const correctIdx = rawQ.options ? rawQ.options.indexOf(rawQ.answer) : currentQ.options.indexOf(currentQ.answer);
                  const isSelected = selectedAns === option || selectedOptionIndices[currentQuestionIndex] === index;
                  const isCorrectOption = index === correctIdx || option.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

                  let cardStyle =
                    "border-slate-800/90 bg-slate-950/60 text-slate-200 hover:border-amber-500/40 hover:bg-slate-800/50";

                  if (isAnswerSubmitted) {
                    if (isCorrectOption) {
                      cardStyle =
                        "border-emerald-500/60 bg-emerald-950/40 text-emerald-200 font-bold shadow-md shadow-emerald-950/50";
                    } else if (isSelected && !isCorrectOption) {
                      cardStyle =
                        "border-rose-500/60 bg-rose-950/40 text-rose-200 font-bold";
                    } else {
                      cardStyle = "border-slate-800/40 bg-slate-950/30 text-slate-500 opacity-60";
                    }
                  } else if (isSelected) {
                    cardStyle = "border-amber-500 bg-amber-500/10 text-white font-bold";
                  }

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={isAnswerSubmitted}
                      onClick={() => handleOptionSelect(option, index)}
                      className={`w-full flex items-center justify-between rounded-xl border p-4 text-left text-sm sm:text-base transition-all select-none ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                            isAnswerSubmitted && isCorrectOption
                              ? "border-emerald-400 bg-emerald-500 text-slate-950"
                              : isAnswerSubmitted && isSelected && !isCorrectOption
                              ? "border-rose-400 bg-rose-500 text-white"
                              : isSelected
                              ? "border-amber-400 bg-amber-500 text-slate-950"
                              : "border-slate-700 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {isAnswerSubmitted && isCorrectOption ? (
                            <RiCheckLine className="text-sm font-black" />
                          ) : isAnswerSubmitted && isSelected && !isCorrectOption ? (
                            <RiCloseLine className="text-sm font-black" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </div>
                        <span>{option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* AI-FÖRKLARINGSRUTA VID FEL SVAR */}
              {isWrong && (
                <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 font-bold text-amber-400">
                      <RiSparklingFill className="text-base text-amber-400" />
                      {getQuizText(currentLang, "aiExplanation")}
                    </span>
                    {!showAiExplanation && (
                      <button
                        type="button"
                        onClick={handleFetchAiExplanation}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
                      >
                        Visa förklaring
                      </button>
                    )}
                  </div>

                  {showAiExplanation && (
                    <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs sm:text-sm leading-relaxed text-slate-300">
                      {isLoadingExplanation ? (
                        <p className="animate-pulse text-amber-300 font-medium">
                          {getQuizText(currentLang, "aiExplanationLoading")}
                        </p>
                      ) : (
                        <p className="whitespace-pre-line">{aiExplanation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* KNAPPAR / NAVIGERING */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 flex-wrap gap-3">
                <div className="text-xs text-slate-400">
                  {isAnswerSubmitted ? (
                    isWrong ? (
                      <span className="text-rose-400 font-semibold inline-flex items-center gap-1.5">
                        <RiCloseCircleLine className="text-sm shrink-0" />
                        <span>{getQuizText(currentLang, "incorrect")} {currentQ.answer}</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold inline-flex items-center gap-1.5">
                        <RiCheckboxCircleLine className="text-sm shrink-0" />
                        <span>{getQuizText(currentLang, "correct")}</span>
                      </span>
                    )
                  ) : (
                    getQuizText(currentLang, "selectAnOption")
                  )}
                </div>

                <button
                  type="button"
                  disabled={!isAnswerSubmitted}
                  onClick={handleNextQuestion}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                    isAnswerSubmitted
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <span>{currentQuestionIndex === questions.length - 1 ? getQuizText(currentLang, "finishExam") : getQuizText(currentLang, "nextQuestion")}</span>
                  <RiArrowRightLine className="text-base" />
                </button>
              </div>
            </div>
          )}

          {/* LÄGE 3: RESULTATVY EFTER SLUTFÖRT PROV ELLER DELMOMENT */}
          {quizStage === "result" && submissionResult && (
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 sm:p-10 shadow-2xl backdrop-blur-md text-center space-y-8 animate-fade-in">
              <div>
                <div
                  className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border text-4xl shadow-xl ${
                    submissionResult.passed
                      ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                      : "border-rose-500/40 bg-rose-950/40 text-rose-400"
                  }`}
                >
                  {submissionResult.passed ? (
                    <IoTrophy className="text-4xl text-amber-400" />
                  ) : (
                    <RiBookOpenLine className="text-4xl text-blue-400" />
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {submissionResult.passed
                    ? getQuizText(currentLang, "passed")
                    : getQuizText(currentLang, "failed")}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {categoryTitle} • Provtid: {formatTime(timeSpentSeconds)}
                </p>

                {submissionResult.isSlutprov ? (
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    Trafikverkets godkänd-gräns: Minst 52 av 65 rätt (80%)
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {submissionResult.passed ? getQuizText(currentLang, "passedDesc") : getQuizText(currentLang, "failedDesc")}
                  </p>
                )}
              </div>

              {/* Poängkort */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Antal rätt
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
                    {submissionResult.correctCount} / {submissionResult.totalQuestions}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Krav: {submissionResult.requiredScore || 52} rätt
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Resultat
                  </span>
                  <span
                    className={`text-2xl sm:text-3xl font-black mt-1 block ${
                      submissionResult.passed ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {submissionResult.percentageScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {submissionResult.passed ? "Godkänd nivå" : "Kräver 80%"}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Provhistorik
                  </span>
                  <span className="text-xs font-bold mt-2 block">
                    {submissionResult.isSlutprov ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <RiCheckboxCircleLine className="text-sm" />
                        <span>Sparat i historik</span>
                      </span>
                    ) : (
                      <span className="text-amber-400/90">Övningsmoment</span>
                    )}
                  </span>
                  {submissionResult.isSlutprov ? (
                    <button
                      type="button"
                      onClick={() => handleTabChange("history")}
                      className="mt-1 text-[11px] text-amber-400 hover:underline block mx-auto font-medium"
                    >
                      Visa historik →
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Endast 65-frågors prov sparas i historiken
                    </span>
                  )}
                </div>
              </div>

              {/* KATEGORI-BREAKDOWN (Visar hur man presterade i varje del) */}
              {submissionResult.categoryBreakdown && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-left max-w-lg mx-auto">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <RiAwardLine className="text-amber-400" />
                    Resultat per delområde:
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(submissionResult.categoryBreakdown).map(([catKey, stat]) => (
                      <div key={catKey}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-300">{stat.name}</span>
                          <span
                            className={`font-bold ${
                              stat.percent >= 80 ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {stat.correct}/{stat.total} ({stat.percent}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              stat.percent >= 80 ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${stat.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OBLIGATORISK FEEDBACK FÖR ATT GÅ VIDARE */}
              {!feedbackSubmitted ? (
                <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl max-w-xl mx-auto">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-400">
                    <IoSparkles className="text-amber-400 text-sm" />
                    <span>100% Gratis TeoriMaster • Lämna din feedback för att gå vidare</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Hur upplevde du frågorna och provet?
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Appen är helt gratis för alla elever! Allt vi ber om är din ärliga feedback och betyg så vi kan göra provet ännu bättre för dig och dina vänner.
                  </p>

                  <form onSubmit={handleSubmitFeedback} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 text-center">
                        Ditt betyg (klicka för att välja):
                      </label>
                      <div className="flex items-center justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackRating(star)}
                            className="p-1 text-2xl sm:text-3xl transition-transform hover:scale-125 focus:outline-none cursor-pointer flex items-center justify-center"
                          >
                            {star <= feedbackRating ? (
                              <IoStar className="text-amber-400" />
                            ) : (
                              <IoStarOutline className="text-slate-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Ditt namn (valfritt):
                      </label>
                      <input
                        type="text"
                        value={feedbackName}
                        onChange={(e) => setFeedbackName(e.target.value)}
                        placeholder="Ditt förnamn eller alias"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Din kommentar / feedback (obligatoriskt):
                      </label>
                      <textarea
                        rows={3}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Skriv dina tankar (t.ex. vad var bra, vilka frågor var svåra, vad kan bli bättre?)..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        required
                      />
                    </div>

                    {feedbackError && (
                      <p className="text-xs text-rose-400 font-semibold text-center">{feedbackError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/25 hover:scale-[1.02] transition-all cursor-pointer"
                    >
                      {isSubmittingFeedback ? (
                        <span>Sparar din feedback...</span>
                      ) : (
                        <>
                          <span>Skicka feedback och gå vidare</span>
                          <RiArrowRightLine className="text-base" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-5 text-center space-y-2 max-w-md mx-auto animate-fade-in">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 text-2xl mx-auto mb-2">
                    <IoCheckmarkCircle />
                  </div>
                  <h4 className="text-sm font-black text-emerald-300">
                    Tack för din feedback! Den har sparats i databasen.
                  </h4>
                  <p className="text-xs text-slate-300">
                    Du har nu låst upp samtliga delar och kan fortsätta öva helt gratis.
                  </p>
                </div>
              )}

              {/* KNAPPAR ATT FORTSÄTTA */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-6 py-3.5 text-xs font-bold text-slate-200 hover:text-white hover:border-amber-500/40 transition-all shadow-md cursor-pointer"
                >
                  <RiArrowLeftLine className="text-base text-amber-400" />
                  <span>{getQuizText(currentLang, "backToOverview")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestartCurrent}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105 transition-all cursor-pointer"
                >
                  <RiResetRightFill className="text-base" />
                  <span>{getQuizText(currentLang, "restartExam")}</span>
                </button>

                {submissionResult.isSlutprov && (
                  <button
                    type="button"
                    onClick={() => handleTabChange("history")}
                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-6 py-3.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <RiHistoryLine className="text-base text-amber-400" />
                    <span>Se din provhistorik</span>
                  </button>
                )}
              </div>

              {/* DETALJERAD GENOMGÅNG AV FRÅGORNA */}
              <div className="text-left pt-6 border-t border-slate-800/80 space-y-4">
                <h3 className="text-base font-bold text-white">Genomgång av frågor:</h3>
                <div className="space-y-4">
                  {submissionResult.detailedResults?.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-4 transition-all ${
                        item.isCorrect
                          ? "border-emerald-500/30 bg-emerald-950/20"
                          : "border-rose-500/30 bg-rose-950/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Fråga {item.questionNumber}
                        </span>
                        <span
                          className={`text-xs font-black uppercase ${
                            item.isCorrect ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {item.isCorrect ? "✓ Rätt" : "✕ Fel"}
                        </span>
                      </div>

                      <p className="font-bold text-white text-sm sm:text-base mt-1">
                        {item.question}
                      </p>

                      <div className="mt-3 text-xs space-y-1">
                        <p className="text-slate-300">
                          Ditt svar:{" "}
                          <span className={item.isCorrect ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>
                            {item.userAnswer}
                          </span>
                        </p>
                        {!item.isCorrect && (
                          <div className="space-y-1.5 mt-2">
                            <p className="text-emerald-400 font-semibold">
                              Rätt svar: {item.correctAnswer}
                            </p>
                            <InlineAiReviewCard
                              question={item.question}
                              selectedAnswer={item.userAnswer}
                              correctAnswer={item.correctAnswer}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* FLIK 2: SENASTE RESULTAT & PROVHISTORIK (Endast för Slutprov 65 frågor) */}
      {/* ======================================================== */}
      {activeTab === "history" && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <RiHistoryLine className="text-amber-400" />
                  <span>Historik över Slutprov (65 frågor)</span>
                </h2>
                <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                  Officiella prov
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Här sparas och visas endast dina fullständiga 65-frågors Trafikverket-slutprov (krav 52 rätt för godkänt). Enskilda delmoment räknas som övning och visas inte här.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchHistory}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-md"
            >
              <RiRefreshLine className="text-sm text-amber-400" />
              <span>Uppdatera</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto mb-2" />
              Laddar provhistorik från databasen...
            </div>
          ) : !historyData || historyData.history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <RiBarChartBoxLine className="text-4xl text-slate-500 block mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Inga sparade slutprov än.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Gör ett fullständigt Slutprov (65 frågor) så sparas ditt resultat och din delmoment-analys automatiskt här i databasen.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("quiz");
                  handleStartExam("slutprov", "Slutprov (Trafikverket)");
                }}
                className="mt-3 rounded-xl bg-amber-500 px-6 py-3 text-xs font-black text-slate-950 uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md"
              >
                Starta ditt första Slutprov (65 frågor)
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* STATISTIK-ÖVERSIKT */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Gjorda Slutprov
                  </span>
                  <span className="text-2xl font-black text-white mt-1 block">
                    {historyData.stats.totalAttempts}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Godkända Prov
                  </span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">
                    {historyData.stats.passedAttempts}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {historyData.stats.passRate}% godkännandegrad
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Snittresultat
                  </span>
                  <span className="text-2xl font-black text-amber-400 mt-1 block">
                    {historyData.stats.averageScore}%
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Bästa Resultat
                  </span>
                  <span className="text-2xl font-black text-emerald-300 mt-1 block">
                    {historyData.stats.bestScore}%
                  </span>
                </div>
              </div>

              {/* LISTA MED KLICKBARA PROVKORT */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Dina genomförda slutprov (Klicka för att granska):
                </h3>

                {historyData.history.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  const dateStr = new Date(item.created_at).toLocaleString("sv-SE", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl ${
                              item.passed
                                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                                : "border-rose-500/40 bg-rose-950/40 text-rose-400"
                            }`}
                          >
                            {item.passed ? (
                              <IoTrophy className="text-amber-400 text-lg" />
                            ) : (
                              <RiCloseCircleLine className="text-rose-400 text-lg" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm sm:text-base">
                                {item.category_title}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                  item.passed
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {item.passed ? "Godkänd (minst 52 rätt)" : "Underkänd"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {dateStr} • {item.correct_count}/{item.total_questions} rätt ({item.score_percent}%) • Provtid: {formatTime(item.time_spent_sec || 0)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-xs font-semibold hidden sm:inline">
                            {isExpanded ? "Dölj detaljer" : "Visa detaljer"}
                          </span>
                          {isExpanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
                        </div>
                      </button>

                      {/* EXPANDERAD DETALJVY */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 space-y-4">
                          {item.category_breakdown && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Prestation per delområde i provet:
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {Object.entries(item.category_breakdown).map(([k, br]) => (
                                  <div
                                    key={k}
                                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-2.5"
                                  >
                                    <span className="text-slate-300 font-medium">{br.name}</span>
                                    <span
                                      className={`font-bold ${
                                        br.percent >= 80 ? "text-emerald-400" : "text-amber-400"
                                      }`}
                                    >
                                      {br.correct}/{br.total} ({br.percent}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("quiz");
                                handleStartExam("slutprov", "Slutprov (Trafikverket)");
                              }}
                              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition-all shadow-md"
                            >
                              Gör ett nytt Slutprov
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* FLIK 3: AI TEORICOACH (SMART SVAGHETSANALYS) */}
      {/* ======================================================== */}
      {activeTab === "coach" && (
        <div className="rounded-3xl border border-purple-500/30 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl text-white shadow-lg shadow-purple-500/20">
              <RiRobot2Line />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">AI TeoriCoach – Personlig Analys</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                AI analyserar dina svar och hittar dina mönster för att hjälpa dig klara Trafikverkets prov.
              </p>
            </div>
          </div>

          {loadingCoach ? (
            <div className="py-12 text-center text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mx-auto mb-2" />
              Analyserar dina svagheter och provresultat...
            </div>
          ) : !aiCoach ? (
            <div className="text-center py-8 text-slate-400">Kunde inte ladda AI Coach.</div>
          ) : !aiCoach.hasData ? (
            <div className="py-8 text-center text-slate-300 space-y-4">
              <RiFocus3Line className="text-4xl text-purple-400 block mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">{aiCoach.headline}</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                {aiCoach.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("quiz");
                  handleStartExam("slutprov", "Slutprov (Trafikverket)");
                }}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:scale-105 transition-all shadow-md"
              >
                {aiCoach.recommendedActionText || "Starta Slutprov"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* HUVUDKORT FÖR SVAGHET */}
              <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-950 to-purple-950/40 p-5 sm:p-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-black uppercase text-rose-300">
                    Identifierat svagt område
                  </span>
                  <span className="text-xs text-slate-400">
                    Lägst träffsäkerhet: {aiCoach.weakestAccuracy}%
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-white">
                  {aiCoach.headline}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                  {aiCoach.message}
                </p>

                <div className="pt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (aiCoach.recommendedCategory) {
                        setActiveTab("quiz");
                        handleStartExam(aiCoach.recommendedCategory, aiCoach.weakestCategoryName);
                      }
                    }}
                    className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-purple-500/20 hover:scale-105 transition-all"
                  >
                    {aiCoach.recommendedActionText || "Starta specialprov nu"}
                  </button>
                </div>
              </div>

              {/* PEDAGOGISKA AI-TIPS FÖR ATT UNDVIKA KUGGNING */}
              {aiCoach.keyTips && aiCoach.keyTips.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-left space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <RiSparklingFill />
                    AI-Tips: Så bemästrar du {aiCoach.weakestCategoryName}:
                  </h4>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                    {aiCoach.keyTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
