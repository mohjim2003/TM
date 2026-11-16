"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IoCheckmarkCircle,
  IoArrowBack,
  IoSparkles,
  IoCardOutline,
  IoPhonePortraitOutline,
  IoShieldCheckmarkOutline,
  IoShieldCheckmark,
} from "react-icons/io5";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import { API_BASE_URL } from "../_lib/api";

export default function PricingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Kassa / Modal-tillstånd
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"month" | "year">("year");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "swish" | "stripe">("card");

  // Formulärdata för betalning
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [swishPhone, setSwishPhone] = useState("");

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    if (storedToken) {
      // 1. Hämta användarens roll och profil
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data) {
            setUserEmail(data.data.email || null);
            if (data.data.type === "admin") {
              setIsAdmin(true);
              setIsSubscribed(true);
            }
          }
        })
        .catch(() => {});

      // 2. Kontrollera prenumerationsstatus
      fetch(`${API_BASE_URL}/api/payment/subscription/status`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.isActive || data.isSubscribed)) {
            setIsSubscribed(true);
          }
        })
        .catch((err) => console.error("Error checking subscription:", err))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const openCheckout = (plan: "month" | "year") => {
    if (!token) {
      router.push("/login?redirect=/subscription");
      return;
    }

    if (isAdmin) {
      router.push("/theory-quiz");
      return;
    }

    setSelectedPlan(plan);
    setPaymentError(null);
    setPaymentSuccess(false);
    setCheckoutModalOpen(true);
  };

  // Formatera kortnummer automatiskt med mellanslag (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})/g, "$1 ").trim();
    setCardNumber(formatted);
  };

  // Formatera utgångsdatum (MM/ÅÅ)
  const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + "/" + raw.slice(2);
    }
    setCardExp(raw);
  };

  // Slutför betalningen
  const handleProcessCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!token) {
      router.push("/login?redirect=/subscription");
      return;
    }

    // Grundläggande validering
    if (paymentMethod === "card") {
      const cleanNum = cardNumber.replace(/\s+/g, "");
      if (cleanNum.length < 13) {
        setPaymentError("Vänligen fyll i ett fullständigt kortnummer (16 siffror).");
        return;
      }
      if (!cardExp || !cardExp.includes("/")) {
        setPaymentError("Vänligen fyll i giltighetstid (MM/ÅÅ).");
        return;
      }
      if (!cardCvc || cardCvc.length < 3) {
        setPaymentError("Vänligen fyll i en 3-siffrig CVC-kod.");
        return;
      }
    } else {
      if (!swishPhone || swishPhone.trim().length < 8) {
        setPaymentError("Vänligen fyll i ditt mobilnummer för Swish.");
        return;
      }
    }

    try {
      setIsProcessingPayment(true);

      const res = await fetch(`${API_BASE_URL}/api/payment/checkout-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          paymentMethod,
          cardNumber,
          cardName: cardName || "Kortinnehavare",
          cardExp,
          cardCvc,
          phoneNumber: swishPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Betalningen kunde inte genomföras.");
      }

      setPaymentSuccess(true);
      setIsSubscribed(true);

      setTimeout(() => {
        router.push("/theory-quiz?payment=success");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ett fel uppstod vid betalningen. Kontrollera uppgifterna och försök igen.";
      setPaymentError(msg);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Starta Stripes officiella Hosted Checkout (Apple Pay, Google Pay, Kort, Link)
  const handleStripeHostedCheckout = async () => {
    if (!token) {
      router.push("/login?redirect=/subscription");
      return;
    }
    try {
      setIsProcessingPayment(true);
      setPaymentError(null);
      const res = await fetch(`${API_BASE_URL}/api/payment/subscribe?plan=${selectedPlan}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || "Kunde inte starta Stripe Checkout.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kunde inte ansluta till Stripe Checkout.";
      setPaymentError(msg);
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const planPrice = selectedPlan === "year" ? "299 kr" : "99 kr";
  const planPeriod = selectedPlan === "year" ? "helt år" : "månad";

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col items-center justify-start py-10 px-4 selection:bg-amber-500 selection:text-slate-950">
      {/* Bakgrundsglöd */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[160px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[140px]" />

      {/* Tillbaka-knapp & språk */}
      <div className="w-full max-w-5xl mb-8 flex items-center justify-between z-10">
        <Link
          href="/theory-quiz"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/40 transition-all shadow-lg backdrop-blur-md"
        >
          <IoArrowBack className="text-amber-500 text-sm" />
          <span>Tillbaka till provet</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {!token && (
            <Link
              href="/login"
              className="text-xs font-bold text-amber-400 hover:text-amber-300"
            >
              Har du redan ett konto? Logga in
            </Link>
          )}
        </div>
      </div>

      {/* ADMIN-KONTO BESKED */}
      {isAdmin ? (
        <div className="z-10 w-full max-w-xl text-center space-y-6 rounded-3xl border border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-950 p-8 shadow-2xl backdrop-blur-md my-auto">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/20 text-4xl text-amber-300 border border-amber-500/30">
            <IoShieldCheckmark className="text-4xl text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Admin-konto identifierat</h2>
            <p className="text-sm text-slate-300 mt-2">
              Inloggad som <strong className="text-amber-300">{userEmail}</strong>. Ditt admin-konto har obegränsad full tillgång till samtliga delprov och 65-frågors slutprov helt kostnadsfritt!
            </p>
          </div>
          <Link
            href="/theory-quiz"
            className="inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-105 transition-all"
          >
            Öppna Teoriprovet & Välj Delmoment
          </Link>
        </div>
      ) : isSubscribed ? (
        /* REDAN PRENUMERANT */
        <div className="z-10 w-full max-w-xl text-center space-y-6 rounded-3xl border border-emerald-500/40 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-md my-auto">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-4xl text-emerald-400 border border-emerald-500/20">
            <IoCheckmarkCircle className="text-4xl text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Du har redan aktiv behörighet!</h2>
          <p className="text-sm text-slate-300">
            Ditt konto har full tillgång till alla 5 delmoment (Miljö, Regler, Vägmärken, Fordon, Människan), över 1 000 frågor och skarpa slutprov.
          </p>
          <Link
            href="/theory-quiz"
            className="inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-105 transition-all"
          >
            Öppna Teoriprovet & Välj Delmoment
          </Link>
        </div>
      ) : (
        /* ICKE-PRENUMERANT: PRISPLANER */
        <div className="z-10 w-full max-w-5xl space-y-10 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>100% Kostnadsfritt för alla elever • Inga dolda avgifter</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Öva helt gratis med <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">TeoriMaster</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Alla 5 delmoment, 65-frågors Trafikverket-slutprov, 1v1 TeoriDuellen och vår personliga AI-coach är nu helt gratis för alla!
            </p>
            <div className="pt-2">
              <Link
                href="/theory-quiz"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-8 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-2xl shadow-amber-500/25 hover:scale-105 transition-all cursor-pointer"
              >
                <span>Öppna teoriproven gratis direkt →</span>
              </Link>
            </div>
          </div>

          {/* Pristabeller */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* MÅNADSKORT */}
            <div className="relative rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all hover:border-slate-700">
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Flexibel träning
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">Månadspaket</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Perfekt för dig som ska skriva provet inom 1–2 månader.
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">99 kr</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    / månad
                  </span>
                </div>

                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-emerald-400 text-lg shrink-0" />
                    <span>Alla 5 delmoment (Miljö, Regler, Vägmärken m.fl.)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-emerald-400 text-lg shrink-0" />
                    <span>Över 1 000 aktuella körkortsfrågor</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-emerald-400 text-lg shrink-0" />
                    <span>Trafikverkets officiella slutprov (65 frågor)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-emerald-400 text-lg shrink-0" />
                    <span>Pedagogiska AI-lösningsmetoder med Gemini</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-emerald-400 text-lg shrink-0" />
                    <span>Ingen bindningstid, avsluta när som helst</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={() => openCheckout("month")}
                  className="w-full rounded-xl border border-amber-500/40 bg-slate-800 py-4 text-center text-xs font-black uppercase tracking-wider text-amber-400 hover:bg-slate-700 hover:text-white transition-all shadow-md"
                >
                  Välj Månad – 99 kr
                </button>
              </div>
            </div>

            {/* ÅRSKORT / POPULÄRAST */}
            <div className="relative rounded-3xl border-2 border-amber-500 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-md flex flex-col justify-between">
              <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                Mest populär • Spara 75%
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Bästa värdet
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">Helårstillgång</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Träna i lugn och ro fram till uppkörningen och provdagen.
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">299 kr</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    / helt år
                  </span>
                </div>

                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-amber-400 text-lg shrink-0" />
                    <span><strong>Allt i månadspaketet ingår</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-amber-400 text-lg shrink-0" />
                    <span>Prioriterad AI-handledning dygnet runt</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-amber-400 text-lg shrink-0" />
                    <span>Garantiförberedelse inför Trafikverkets prov</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <IoCheckmarkCircle className="text-amber-400 text-lg shrink-0" />
                    <span>Obegränsade skarpa simulator-slutprov</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={() => openCheckout("year")}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-105 transition-all"
                >
                  Lås upp Helårstillgång – 299 kr
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SÄKER KASSA / CHECKOUT MODAL FÖR ALLA ICKE-ADMIN ANVÄNDARE */}
      {/* ======================================================== */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-2xl text-left">
            {/* Stäng kryss */}
            <button
              type="button"
              onClick={() => setCheckoutModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white text-xl p-1"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl text-amber-400 border border-amber-500/30">
                <IoCardOutline />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Säker Betalning</h3>
                <p className="text-xs text-slate-400">
                  {selectedPlan === "year" ? "Helårstillgång (365 dagar)" : "Månadspaket (30 dagar)"} • Belopp: <strong className="text-white">{planPrice}</strong>
                </p>
              </div>
            </div>

            {/* Val av betalmetod */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button
                type="button"
                onClick={() => setPaymentMethod("stripe")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === "stripe"
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-500/10"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                }`}
              >
                <IoSparkles className="text-base text-amber-400" />
                <span>Stripe Hosted</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === "card"
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-500/10"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                }`}
              >
                <IoCardOutline className="text-base text-amber-400" />
                <span>Direktkort</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("swish")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === "swish"
                    ? "border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-500/10"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                }`}
              >
                <IoPhonePortraitOutline className="text-base text-amber-400" />
                <span>Swish</span>
              </button>
            </div>

            {/* Felmeddelande */}
            {paymentError && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 font-medium">
                {paymentError}
              </div>
            )}

            {/* Bekräftelsemeddelande */}
            {paymentSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-xs text-emerald-300 font-bold text-center">
                Betalningen godkänd! Full behörighet aktiverad. Skickar dig till teoriprovet...
              </div>
            )}

            {paymentMethod === "stripe" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <IoCardOutline className="text-xl text-amber-400" />
                    <h4 className="font-bold text-white text-sm">Stripe Hosted Checkout</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Du omdirigeras säkert till Stripes officiella kassa för <strong>Teorimaster</strong>. Där kan du betala med Apple Pay, Google Pay, Visa, Mastercard, eller Link.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-amber-400 font-bold pt-1">
                    <IoShieldCheckmarkOutline className="text-base" />
                    <span>Officiellt Stripe Test-Konto (SEK)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStripeHostedCheckout}
                  disabled={isProcessingPayment}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      <span>Öppnar Stripe...</span>
                    </span>
                  ) : (
                    <span>Gå till Stripe Checkout ({planPrice}) →</span>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleProcessCharge} className="space-y-4">
                {paymentMethod === "card" ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Kortnummer
                      </label>
                      <input
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Giltighetstid
                        </label>
                        <input
                          type="text"
                          placeholder="MM/ÅÅ"
                          value={cardExp}
                          onChange={handleExpChange}
                          required
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          CVC / CVV
                        </label>
                        <input
                          type="password"
                          maxLength={3}
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                          required
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Kortinnehavarens namn
                      </label>
                      <input
                        type="text"
                        placeholder="Förnamn Efternamn"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Mobilnummer för Swish
                    </label>
                    <input
                      type="tel"
                      placeholder="070 123 45 67"
                      value={swishPhone}
                      onChange={(e) => setSwishPhone(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-2">
                      En betalningsförfrågan på {planPrice} skickas till din Swish-app vid godkännande.
                    </p>
                  </div>
                )}

                {/* Säkerhetsnotis och test-hjälp */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <IoShieldCheckmarkOutline className="text-sm" />
                    <span>Krypterad och säker anslutning (256-bit SSL)</span>
                  </div>
                  <p className="text-slate-500">
                    Testläge aktivt: Ange valfria testkortsuppgifter (t.ex. 4242 4242 4242 4242, 12/28, 123) för att genomföra betalningen.
                  </p>
                </div>

                {/* Betalknapp */}
                <button
                  type="submit"
                  disabled={isProcessingPayment || paymentSuccess}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      <span>Bearbetar betalning...</span>
                    </span>
                  ) : (
                    <span>Betala {planPrice} ({planPeriod})</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
