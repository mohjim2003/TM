"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { IoIosEyeOff, IoIosEye } from "react-icons/io";
import { IoShieldCheckmark } from "react-icons/io5";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import { API_BASE_URL } from "../_lib/api";

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.token || data?.authorization?.token)) {
        const token = data.token || data?.authorization?.token;
        if (token) {
          localStorage.setItem("token", token);
          // Sätt cookie så även SSR eller Next.js requests kan läsa den
          document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
        }

        // Spara användardata för duell, quiz och profil
        const userObj = {
          email: formData.email,
          type: data.type || "user",
          name: formData.email.split("@")[0],
          isSubscribed: true, // 100% Gratis för alla användare!
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        localStorage.setItem("userType", data.type || "user");

        toast.success(
          data.type === "admin"
            ? "Välkommen tillbaka, Admin! Full tillgång aktiverad."
            : "Inloggad framgångsrikt!"
        );

        // Skicka till Quiz-sidan
        setTimeout(() => {
          router.push("/theory-quiz");
        }, 600);
      } else {
        // Säker meddelandehantering så inte råa objekt kraschar React
        let errorMsg = "Inloggningen misslyckades. Kontrollera dina uppgifter.";
        if (typeof data?.message === "string") {
          if (data.message.includes("Password not matched")) {
            errorMsg = "Fel lösenord. Vänligen kontrollera lösenordet och försök igen.";
          } else if (data.message.includes("Email not found")) {
            errorMsg = "Det finns inget konto med denna e-postadress.";
          } else {
            errorMsg = data.message;
          }
        } else if (data?.message?.message) {
          if (typeof data.message.message === "string") {
            if (data.message.message.includes("Password not matched")) {
              errorMsg = "Fel lösenord. Vänligen kontrollera lösenordet och försök igen.";
            } else if (data.message.message.includes("Email not found")) {
              errorMsg = "Det finns inget konto med denna e-postadress.";
            } else {
              errorMsg = data.message.message;
            }
          }
        }
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      toast.error("Kunde inte ansluta till servern. Kontrollera att backend körs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#04060b] flex flex-col lg:flex-row overflow-hidden font-sans text-slate-100">
      
      {/* Topp-bar med Språkväljare och tillbaka-länk */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
        <LanguageSwitcher />
        <Link
          href="/"
          className="text-xs font-semibold text-slate-300 hover:text-white transition-colors bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-md"
        >
          ← Startsidan
        </Link>
      </div>

      {/* Bakgrundseffekter */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* VÄNSTER SIDA: Visuell välkomstsida */}
      <div className="hidden lg:flex lg:w-1/2 p-16 flex-col justify-between relative z-10 select-none border-r border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
            T
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">
            TEORI<span className="text-amber-500">MASTER</span>
          </span>
        </div>

        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1 rounded-full">
            <IoShieldCheckmark /> Säker & Krypterad Inloggning
          </div>
          
          <h1 className="text-5xl font-black text-white leading-tight">
            Logga in och fortsätt <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">
              resan mot körkortet.
            </span>
          </h1>
          
          <p className="text-slate-400 text-base leading-relaxed">
            Dina sparade provresultat, delmoment, AI-coachens analys och dina duellpoäng sparas på ditt konto. Logga in för att fortsätta öva!
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-bold text-amber-400 block">Admin-konto</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Full tillgång till samtliga delmoment & prov</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-bold text-emerald-400 block">Snabbtest</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Gratis prov för alla oregistrerade & nya användare</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} TeoriMaster Sverige. Alla rättigheter reserverade.
        </div>
      </div>

      {/* HÖGER SIDA: Inloggningsformulär */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-md bg-slate-900/70 backdrop-blur-2xl p-8 rounded-3xl border border-slate-800/80 shadow-2xl space-y-6">
          
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Välkommen tillbaka
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Ange din e-post och lösenord för att logga in
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-postfält */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                E-postadress
              </label>
              <input
                type="email"
                name="email"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
                placeholder="namn@epost.se"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Lösenordsfält */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Lösenord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="w-full pl-4 pr-12 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute text-xl text-slate-400 hover:text-white top-1/2 right-4 -translate-y-1/2 cursor-pointer transition-colors"
                >
                  {showPassword ? <IoIosEyeOff /> : <IoIosEye />}
                </button>
              </div>
            </div>

            {/* Inloggningsknapp */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 text-sm uppercase tracking-wider"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Loggar in...</span>
                  </div>
                ) : (
                  "Logga in"
                )}
              </button>
            </div>

            <div className="text-center pt-4 border-t border-slate-800/60 mt-4">
              <p className="text-sm text-slate-400">
                Saknar du konto?{" "}
                <Link
                  href="/signup"
                  className="text-amber-400 hover:text-amber-300 font-bold transition-colors"
                >
                  Skapa ett konto här
                </Link>
              </p>
            </div>
          </form>

        </div>
      </div>

      <ToastContainer position="top-right" autoClose={2500} theme="dark" />
    </div>
  );
}
