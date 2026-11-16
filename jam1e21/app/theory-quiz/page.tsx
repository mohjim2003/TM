"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IoArrowBack,
  IoPersonCircleOutline,
  IoLogOutOutline,
  IoChatbubblesOutline,
  IoShieldCheckmark,
  IoLockClosedOutline,
} from "react-icons/io5";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import QuizComponent from "./_component/QuizComponent";
import { API_BASE_URL } from "../_lib/api";

export default function TheoryQuiz() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
      // Försök hämta användaruppgifter om möjligt
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data) {
            setUserEmail(data.data.email || null);
            setUserType(data.data.type || null);
          }
        })
        .catch(() => {});
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserType(null);
    window.location.reload();
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden bg-slate-950 p-3 sm:p-6 font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Bakgrundseffekter */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 h-[350px] w-[650px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[140px] transform-gpu"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-10 left-10 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px] transform-gpu"
      />

      {/* Header / Navigering - Sticky med hög synlighet och snabb åtkomst till språk */}
      <header className="sticky top-2 z-40 mb-6 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/85 px-3 sm:px-5 py-2.5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-slate-200 shadow-md backdrop-blur-md transition-all hover:border-amber-500/40 hover:bg-slate-800"
          >
            <IoArrowBack className="text-base text-amber-500 transition-transform group-hover:-translate-x-1" />
            <span>Startsida</span>
          </Link>

          <Link
            href="/battle"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:text-white transition-all shadow-md backdrop-blur-md"
          >
            <IoLockClosedOutline className="text-sm text-amber-400" />
            <span>TeoriDuellen (Låst)</span>
          </Link>

          <Link
            href="/community"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all shadow-md backdrop-blur-md"
          >
            <IoChatbubblesOutline className="text-sm text-slate-400" />
            <span>Chattforum</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {isAuthenticated ? (
            <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs backdrop-blur-md ${
              userType === "admin"
                ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
            }`}>
              {userType === "admin" ? (
                <IoShieldCheckmark className="text-sm text-amber-400" />
              ) : (
                <IoPersonCircleOutline className="text-base text-emerald-400" />
              )}
              <span className="font-semibold truncate max-w-[110px] sm:max-w-[150px]">
                {userEmail || "Pilotmedlem"}
              </span>
              <button
                onClick={handleLogout}
                title="Logga ut"
                className="ml-1 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <IoLogOutOutline className="text-base" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:border-amber-500/40 hover:text-amber-400 transition-all"
            >
              <IoPersonCircleOutline className="text-base text-amber-400" />
              <span>Logga in</span>
            </Link>
          )}

          {/* TYDLIG SPRÅKVÄLJARE I HEADER */}
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 shadow-sm backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 hidden xs:inline">
              Språk:
            </span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Huvudinnehåll */}
      <main className="z-10 flex w-full max-w-5xl flex-col items-center">
        <QuizComponent />
      </main>
    </div>
  );
}