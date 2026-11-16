"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  RiTranslate2,
  RiArrowDownSLine,
  RiCheckLine,
  RiSearchLine,
  RiCloseLine,
  RiGlobalLine,
} from "react-icons/ri";

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "sv", name: "Svenska", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "en", name: "Engelska", nativeName: "English", flag: "🇬🇧" },
  { code: "ar", name: "Arabiska", nativeName: "العربية", flag: "🇸🇦" },
  { code: "so", name: "Somaliska", nativeName: "Soomaali", flag: "🇸🇴" },
  { code: "ti", name: "Tigrinja", nativeName: "ትግርኛ", flag: "🇪🇷" },
  { code: "fa", name: "Persiska", nativeName: "فارسی", flag: "🇮🇷" },
  { code: "tr", name: "Turkiska", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "ku", name: "Kurdiska", nativeName: "Kurdî", flag: "☀️" },
  { code: "pl", name: "Polska", nativeName: "Polski", flag: "🇵🇱" },
  { code: "uk", name: "Ukrainska", nativeName: "Українська", flag: "🇺🇦" },
  { code: "ru", name: "Ryska", nativeName: "Русский", flag: "🇷🇺" },
  { code: "es", name: "Spanska", nativeName: "Español", flag: "🇪🇸" },
  { code: "de", name: "Tyska", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Franska", nativeName: "Français", flag: "🇫🇷" },
];

export const getSavedLanguageCode = (): string => {
  if (typeof window === "undefined") return "sv";

  // 1. Kolla localStorage
  const saved = localStorage.getItem("user_language");
  if (saved) return saved;

  // 2. Kolla googtrans kaka (format: /sv/en eller /auto/en)
  const match = document.cookie.match(/googtrans=\/([^/]+)\/([^;]+)/);
  if (match && match[2]) {
    return match[2];
  }

  return "sv";
};

export const applyTranslationLanguage = (langCode: string) => {
  if (typeof window === "undefined") return;

  localStorage.setItem("user_language", langCode);

  // Hantera textriktning för arabiska och persiska
  if (langCode === "ar" || langCode === "fa") {
    document.documentElement.dir = "rtl";
  } else {
    document.documentElement.dir = "ltr";
  }

  // Notifiera LanguageContext och komponenter
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: langCode }));

  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const domainParts = hostname.split(".");
  const rootDomain = domainParts.length > 1 ? `.${domainParts.slice(-2).join(".")}` : hostname;

  // Om användaren väljer svenska (originalspråk), rensa översättningskakan
  if (langCode === "sv") {
    const expireStr = "expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = `googtrans=; ${expireStr} path=/;`;
    if (!isLocalhost) {
      document.cookie = `googtrans=; ${expireStr} path=/; domain=${hostname};`;
      if (rootDomain) {
        document.cookie = `googtrans=; ${expireStr} path=/; domain=${rootDomain};`;
      }
    }

    const select =
      document.querySelector<HTMLSelectElement>("#google_translate_element select.goog-te-combo") ||
      document.querySelector<HTMLSelectElement>("select.goog-te-combo");
    if (select) {
      select.value = "sv";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // På provsidan växlar vi språk dynamiskt direkt i React utan omladdning
    if (window.location.pathname.includes("/theory-quiz")) {
      return;
    }

    setTimeout(() => {
      window.location.reload();
    }, 120);
    return;
  }

  // Sätt både /sv/ och /auto/ cookies för alla domänvarianter
  const c1 = `/sv/${langCode}`;
  const c2 = `/auto/${langCode}`;
  document.cookie = `googtrans=${c1}; path=/;`;
  document.cookie = `googtrans=${c2}; path=/;`;
  if (!isLocalhost) {
    document.cookie = `googtrans=${c1}; path=/; domain=${hostname};`;
    document.cookie = `googtrans=${c2}; path=/; domain=${hostname};`;
    if (rootDomain) {
      document.cookie = `googtrans=${c1}; path=/; domain=${rootDomain};`;
      document.cookie = `googtrans=${c2}; path=/; domain=${rootDomain};`;
    }
  }

  // Försök hitta Googles dolda select-element och trigga change
  const select =
    document.querySelector<HTMLSelectElement>("#google_translate_element select.goog-te-combo") ||
    document.querySelector<HTMLSelectElement>("select.goog-te-combo");

  if (select) {
    select.value = langCode;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === langCode) {
        select.selectedIndex = i;
        break;
      }
    }
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // På provsidan växlar vi frågor dynamiskt i React utan att ladda om sidan
  if (window.location.pathname.includes("/theory-quiz")) {
    return;
  }

  // Ladda om statiska sidor (t.ex. startsidan) så att Google Translate applicerar översättningen
  setTimeout(() => {
    window.location.reload();
  }, 120);
};

export interface LanguageSwitcherProps {
  className?: string;
  variant?: "default" | "compact" | "pill" | "banner";
  buttonText?: string;
}

export default function LanguageSwitcher({
  className = "",
  variant = "default",
  buttonText,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLangCode, setCurrentLangCode] = useState("sv");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    isUpward: boolean;
  }>({
    top: 0,
    left: 0,
    width: 290,
    isUpward: false,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Montera i klient
  useEffect(() => {
    setMounted(true);
    const saved = getSavedLanguageCode();
    setCurrentLangCode(saved);

    const handleLangChange = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setCurrentLangCode(custom.detail);
      }
    };
    window.addEventListener("languageChanged", handleLangChange);
    return () => window.removeEventListener("languageChanged", handleLangChange);
  }, []);

  // Uppdatera position för flytande dropdown på desktop
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const isMob = window.innerWidth < 640;
    setIsMobile(isMob);
    if (isMob) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 290;
    const menuHeight = 380;

    let isUpward = false;
    let top = rect.bottom + 8;

    // Om inte tillräckligt med plats nedanför och plats ovanför
    if (rect.bottom + menuHeight + 20 > window.innerHeight && rect.top > menuHeight + 20) {
      top = rect.top - menuHeight - 8;
      isUpward = true;
    }

    // Horisontell positionering: anpassa efter skärmkanter
    let left = rect.right - menuWidth;
    if (left < 16) {
      left = Math.max(16, rect.left);
    }
    if (left + menuWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - menuWidth - 16);
    }

    setCoords({
      top,
      left,
      width: menuWidth,
      isUpward,
    });
  }, []);

  // Lyssna på scroll och resize när öppen
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const handleScrollResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollResize, { passive: true });
    window.addEventListener("resize", handleScrollResize, { passive: true });

    // Fokusera sökfältet snabbt
    const t = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);

    return () => {
      window.removeEventListener("scroll", handleScrollResize);
      window.removeEventListener("resize", handleScrollResize);
      clearTimeout(t);
    };
  }, [isOpen, updatePosition]);

  // Stäng med Escape tangent
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (code: string) => {
    setCurrentLangCode(code);
    setIsOpen(false);
    setSearchQuery("");
    applyTranslationLanguage(code);
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setSearchQuery("");
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter((lang) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      lang.name.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative inline-block notranslate ${className}`}>
      {/* VÄLJAR-KNAPP BASERAT PÅ VARIANT */}
      {variant === "compact" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-label="Välj språk / Select language"
          title={`Valt språk: ${currentLang.nativeName}`}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/90 px-2.5 py-1.5 text-xs font-bold text-slate-200 shadow-md backdrop-blur-md hover:border-amber-500/50 hover:bg-slate-800 transition-all cursor-pointer select-none"
        >
          <span className="text-sm">{currentLang.flag}</span>
          <RiArrowDownSLine
            className={`text-slate-400 text-sm transition-transform duration-200 ${
              isOpen ? "rotate-180 text-amber-400" : ""
            }`}
          />
        </button>
      ) : variant === "pill" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-label="Välj språk / Select language"
          className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900/90 px-4 py-2 text-xs font-black text-amber-300 shadow-lg shadow-amber-500/10 backdrop-blur-md hover:border-amber-400 hover:scale-105 transition-all cursor-pointer select-none"
        >
          <RiGlobalLine className="text-amber-400 text-sm animate-pulse" />
          <span className="text-base">{currentLang.flag}</span>
          <span className="truncate max-w-[130px]">
            {buttonText || `${currentLang.nativeName} (${currentLang.code.toUpperCase()})`}
          </span>
          <RiArrowDownSLine
            className={`text-amber-400 text-sm transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-label="Välj språk / Select language"
          className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-slate-100 shadow-md backdrop-blur-md hover:border-amber-500/60 hover:bg-slate-800 transition-all cursor-pointer select-none"
        >
          <span className="text-base leading-none">{currentLang.flag}</span>
          <span className="font-semibold text-white truncate max-w-[100px] sm:max-w-[130px]">
            {currentLang.nativeName}
          </span>
          <RiArrowDownSLine
            className={`text-slate-400 text-sm transition-transform duration-200 ${
              isOpen ? "rotate-180 text-amber-400" : ""
            }`}
          />
        </button>
      )}

      {/* PORTAL-RENDERAD DROPDOWN/MODAL: ALDRIG BESKUREN AV PARENT OVERFLOW-HIDDEN */}
      {mounted &&
        isOpen &&
        createPortal(
          isMobile ? (
            /* MOBIL: MODERN BOTTOM SHEET MED SKUGGA OCH BACKDROP */
            <div className="fixed inset-0 z-[999999] notranslate flex flex-col justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
              <div
                className="absolute inset-0"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />

              <div className="relative z-10 w-full max-h-[85vh] rounded-t-3xl border-t border-slate-700 bg-slate-900 p-5 shadow-2xl flex flex-col">
                {/* Drag-indikator */}
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-700" />

                {/* Topp-rad med titel och stäng */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 text-lg border border-amber-500/30">
                      <RiTranslate2 />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Välj provspråk / Choose Language
                      </h3>
                      <p className="text-[11px] text-slate-400">14 tillgängliga språk</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <RiCloseLine className="text-xl" />
                  </button>
                </div>

                {/* Sökfält */}
                <div className="pt-3 pb-2">
                  <div className="relative">
                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Sök språk (t.ex. arab, soma, eng)..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista med språk */}
                <div className="overflow-y-auto py-1 divide-y divide-slate-800/60 max-h-[50vh] space-y-1">
                  {filteredLanguages.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Inga språk matchade &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredLanguages.map((lang) => {
                      const isSelected = lang.code === currentLangCode;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleSelectLanguage(lang.code)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all ${
                            isSelected
                              ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                              : "text-slate-200 hover:bg-slate-800 hover:text-white active:bg-slate-800/80"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{lang.flag}</span>
                            <div>
                              <span className="block text-sm font-bold text-white">
                                {lang.nativeName}
                              </span>
                              <span className="block text-xs text-slate-400">
                                {lang.name}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                              <RiCheckLine className="text-base" />
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* DESKTOP: FLYTANDE DROPDOWN MED FAST POSITION OCH Z-[999999] */
            <div className="fixed inset-0 z-[999999] notranslate pointer-events-none">
              <div
                className="fixed inset-0 pointer-events-auto"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />

              <div
                ref={menuRef}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: `${coords.width}px`,
                }}
                className="pointer-events-auto rounded-2xl border border-slate-700/80 bg-slate-900/98 p-2 shadow-2xl shadow-black/80 backdrop-blur-2xl max-h-[380px] flex flex-col animate-fade-in"
              >
                {/* Header */}
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800/80">
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <RiTranslate2 className="text-sm" /> Välj provspråk
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    14 språk
                  </span>
                </div>

                {/* Sökfält */}
                <div className="p-2 border-b border-slate-800/60">
                  <div className="relative">
                    <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Sök språk..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-1.5 pl-8 pr-7 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista med språk */}
                <div className="overflow-y-auto p-1 divide-y divide-slate-800/50 space-y-0.5 max-h-[260px]">
                  {filteredLanguages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Inga träffar på &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredLanguages.map((lang) => {
                      const isSelected = lang.code === currentLangCode;

                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleSelectLanguage(lang.code)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30"
                              : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{lang.flag}</span>
                            <div>
                              <span className="block text-xs font-semibold text-white">
                                {lang.nativeName}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                {lang.name}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <RiCheckLine className="text-amber-400 text-base font-bold shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ),
          document.body
        )}
    </div>
  );
}
