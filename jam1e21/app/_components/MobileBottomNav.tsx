"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiHome5Line,
  RiHome5Fill,
  RiFileTextLine,
  RiFileTextFill,
  RiSwordLine,
  RiSwordFill,
  RiChat3Line,
  RiChat3Fill,
} from "react-icons/ri";

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Dölj inte på några vanliga sidor, men dölj vid specifik provsession om det behövs
  // Behåll överallt för maximal friktionsfri navigering
  const navItems = [
    {
      label: "Hem",
      href: "/",
      icon: RiHome5Line,
      activeIcon: RiHome5Fill,
      isActive: pathname === "/",
    },
    {
      label: "Teoriprov",
      href: "/theory-quiz",
      icon: RiFileTextLine,
      activeIcon: RiFileTextFill,
      isActive: pathname.startsWith("/theory-quiz"),
    },
    {
      label: "Duellen",
      href: "/battle",
      icon: RiSwordLine,
      activeIcon: RiSwordFill,
      badge: "Låst",
      isActive: pathname.startsWith("/battle") || pathname.startsWith("/duel"),
    },
    {
      label: "Forum",
      href: "/community",
      icon: RiChat3Line,
      activeIcon: RiChat3Fill,
      isActive: pathname.startsWith("/community") || pathname.startsWith("/chat"),
    },
  ];

  return (
    <nav
      aria-label="Mobilnavigering"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#04060b]/90 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-2 safe-bottom select-none shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.isActive ? item.activeIcon : item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 ${
                item.isActive
                  ? "text-amber-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`text-xl transition-transform ${
                    item.isActive ? "scale-110 text-amber-400" : ""
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider scale-90">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-semibold tracking-tight">
                {item.label}
              </span>
              {item.isActive && (
                <span className="absolute -bottom-1 w-4 h-0.5 bg-amber-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
