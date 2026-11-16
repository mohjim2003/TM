import type { Metadata } from "next";
import { LanguageProvider } from "./_components/LanguageContext";
import MobileBottomNav from "./_components/MobileBottomNav";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeoriMaster – Körkortsappen (100% Gratis)",
  description: "Öva på Trafikverkets 65-frågors slutprov, 1v1 TeoriDuellen, AI-coach med Gemini och alla delmoment helt kostnadsfritt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className="dark scroll-smooth">
      <head></head>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen pb-16 md:pb-0">
        
        {/* Google Translate Init Script */}
        <Script id="google-translate-init" strategy="beforeInteractive">
          {`
            window.googleTranslateElementInit = function() {
              if (window.google && window.google.translate && window.google.translate.TranslateElement) {
                new window.google.translate.TranslateElement({
                  pageLanguage: 'sv',
                  autoDisplay: false
                }, 'google_translate_element');
              }
            };
          `}
        </Script>

        <Script
          src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />

        <LanguageProvider>
          {/* Dold container för Google Translate gadget (används programmatiskt av LanguageSwitcher) */}
          <div
            id="google_translate_element"
            style={{
              position: "fixed",
              top: "-9999px",
              left: "-9999px",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              opacity: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          />

          {children}

          {/* Friktionsfri mobilbottenmeny */}
          <MobileBottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}