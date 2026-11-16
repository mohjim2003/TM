"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations } from "@/app/_Translationdata/translations";

interface LanguageContextProps {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<string>("sv");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_language") || "sv";
      setLanguage(saved);

      const handleLangChange = (e: Event) => {
        const custom = e as CustomEvent<string>;
        if (custom.detail) {
          setLanguage(custom.detail);
        }
      };
      window.addEventListener("languageChanged", handleLangChange);
      return () => window.removeEventListener("languageChanged", handleLangChange);
    }
  }, []);

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["sv"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
