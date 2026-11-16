"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LanguageSwitcher from '../_components/LanguageSwitcher';
import { API_BASE_URL } from '../_lib/api';

export default function RegisterForm() {
  const router = useRouter();
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    type: "user", // Lagt till type så backenden blir nöjd
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "password") {
      validatePassword(value);
    }
  };

  const validatePassword = (password: string): string => {
    const errors = [];

    if (password.length < 8) errors.push("Minst 8 tecken");
    if (!/[A-Z]/.test(password)) errors.push("En stor bokstav");
    if (!/[a-z]/.test(password)) errors.push("En liten bokstav");
    if (!/\d/.test(password)) errors.push("En siffra");
    if (!/[\W_]/.test(password)) errors.push("Ett specialtecken");

    const errorMsg = errors.length > 0 ? `Lösenordet måste innehålla: ${errors.join(", ")}` : "";
    setPasswordError(errorMsg);
    return errorMsg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validationError = validatePassword(formData.password);
    if (validationError) {
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Lösenorden matchar inte!");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
          type: formData.type,
        }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        const token = data?.authorization?.token || data?.token;
        if (token) {
          localStorage.setItem('token', token);
          document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
        }

        const userObj = {
          email: formData.email,
          type: data.data?.type || 'user',
          name: `${formData.first_name} ${formData.last_name}`.trim() || formData.email.split('@')[0],
          isSubscribed: true, // Helt gratis för alla!
        };
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('userType', userObj.type);

        toast.success('Konto skapat! Välkommen till TeoriMaster.');
        setTimeout(() => {
          router.push('/theory-quiz');
        }, 500);
      } else {
        let errorMsg = 'Registrering misslyckades!';
        if (typeof data?.message === 'string') {
          if (data.message.includes('already exist') || data.message.includes('exist')) {
            errorMsg = 'E-postadressen är redan registrerad. Logga in istället!';
          } else {
            errorMsg = data.message;
          }
        } else if (data?.message?.message && typeof data.message.message === 'string') {
          errorMsg = data.message.message;
        }
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('Submission failed:', err);
      toast.error('Serverfel vid anslutning!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#04060b] p-4 font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Bakgrundsglöd */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[450px] h-[350px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Topp-bar med Språkväljare och tillbaka-länk */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between z-10">
        <Link
          href="/"
          className="text-xs font-bold text-slate-300 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl shadow-md hover:border-slate-700"
        >
          ← Startsidan
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="bg-slate-900/80 border border-slate-800 text-slate-100 p-8 rounded-3xl shadow-2xl w-full max-w-md backdrop-blur-xl z-10 space-y-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight text-center">Skapa gratiskonto</h2>
          <p className="text-slate-400 text-xs text-center mt-1">
            Få 100% fri tillgång till alla 65-frågors slutprov, delmoment och AI-coachen
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Namn</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="first_name"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
                placeholder="Förnamn"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="last_name"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
                placeholder="Efternamn"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">E-post</label>
            <input
              type="email"
              name="email"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="namn@doman.se"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Lösenord</label>
            <input
              type="password"
              name="password"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="Minst 8 tecken (stor bokstav, siffra)"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Bekräfta lösenord</label>
            <input
              type="password"
              name="confirmPassword"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="Upprepa lösenord"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {passwordError && (
            <p className="text-rose-400 text-xs font-semibold leading-relaxed bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">{passwordError}</p>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 rounded-xl text-sm transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Skapar konto..." : "Skapa mitt konto"}
            </button>
            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">Har du redan ett konto? </span>
              <Link href="/login" className="text-xs font-bold text-amber-400 hover:underline">
                Logga in här
              </Link>
            </div>
          </div>
        </form>
      </div>

      <ToastContainer position="top-right" autoClose={2000} theme="dark" />
    </div>
  );
}