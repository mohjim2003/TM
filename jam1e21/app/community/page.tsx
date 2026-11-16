"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  IoArrowBack,
  IoPersonCircleOutline,
  IoLogOutOutline,
  IoChatbubblesOutline,
  IoThumbsUpOutline,
  IoThumbsUp,
  IoSend,
  IoArrowForward,
  IoGlobeOutline,
  IoLockClosedOutline,
} from "react-icons/io5";
import { RiBookOpenLine } from "react-icons/ri";
import LanguageSwitcher from "../_components/LanguageSwitcher";
import { API_BASE_URL } from "../_lib/api";

interface LanguageRoom {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  description: string;
  topics: string[];
  messageCount: number;
  activeUsers: number;
  latestMessage?: {
    userName: string;
    text: string;
    createdAt: string;
  };
}

interface ForumMessage {
  id: string;
  userName: string;
  userRole: "admin" | "subscriber" | "user";
  userEmail?: string;
  topic: string;
  message: string;
  likesCount: number;
  parentId?: string;
  createdAt: string;
}

export default function CommunityPage() {
  const [rooms, setRooms] = useState<LanguageRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("Alla");
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Användarstatus
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("guest");

  // Skrivfält
  const [inputMessage, setInputMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [inputTopic, setInputTopic] = useState("Allmänt");
  const [isSending, setIsSending] = useState(false);
  const [likedMessageIds, setLikedMessageIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Hämta inloggningsuppgifter
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    if (storedToken) {
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data) {
            setUserEmail(data.data.email);
            const fullName = `${data.data.first_name || ""} ${data.data.last_name || ""}`.trim();
            setUserName(fullName || data.data.email?.split("@")[0] || "Medlem");
            setUserRole(data.data.type || "user");
          }
        })
        .catch(() => {});
    }
  }, []);

  // Hämta alla språkrum från backend
  const fetchRooms = useCallback(async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch(`${API_BASE_URL}/api/community/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {
      console.warn("Kunde inte hämta språkrum:", e);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Hämta meddelanden för ett valt rum
  const fetchMessages = useCallback(async (langId: string, topic?: string) => {
    try {
      setLoadingMessages(true);
      const topicQuery = topic && topic !== "Alla" ? `&topic=${encodeURIComponent(topic)}` : "";
      const res = await fetch(`${API_BASE_URL}/api/community/messages?language=${langId}${topicQuery}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.warn("Kunde inte hämta meddelanden:", e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Byt språkrum
  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedTopic("Alla");
    fetchMessages(roomId, "Alla");
  };

  // Filtrera efter ämne
  const handleFilterTopic = (topic: string) => {
    setSelectedTopic(topic);
    if (selectedRoomId) {
      fetchMessages(selectedRoomId, topic);
    }
  };

  // Skicka meddelande
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedRoomId || isSending) return;

    try {
      setIsSending(true);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/community/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          language: selectedRoomId,
          message: inputMessage.trim(),
          topic: inputTopic || "Allmänt",
          userName: userName || guestName.trim() || "Körkortselev",
        }),
      });

      if (res.ok) {
        setInputMessage("");
        await fetchMessages(selectedRoomId, selectedTopic);
        fetchRooms(); // Uppdatera meddelanderäknare
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (e) {
      console.error("Kunde inte skicka meddelande:", e);
    } finally {
      setIsSending(false);
    }
  };

  // Gilla meddelande
  const handleLikeMessage = async (msgId: string) => {
    if (likedMessageIds.has(msgId)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/community/messages/${msgId}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLikedMessageIds((prev) => new Set(prev).add(msgId));
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, likesCount: data.likesCount } : m))
        );
      }
    } catch (e) {
      console.error("Kunde inte gilla meddelande:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUserEmail(null);
    setUserRole("guest");
    window.location.reload();
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 selection:bg-amber-500 selection:text-slate-950">
      {/* Bakgrundseffekter */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[160px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-[140px]" />

      {/* HEADER / NAVIGATION */}
      <header className="z-10 mt-2 mb-8 flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/40 transition-all shadow-md backdrop-blur-md"
          >
            <IoArrowBack className="text-amber-500 text-sm transition-transform group-hover:-translate-x-1" />
            <span>Startsida</span>
          </Link>

          <Link
            href="/theory-quiz"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-bold text-amber-400 hover:border-amber-500/40 hover:text-amber-300 transition-all shadow-md backdrop-blur-md"
          >
            <RiBookOpenLine className="text-sm" />
            <span>Teoriprovet</span>
          </Link>

          <Link
            href="/battle"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:text-white transition-all shadow-md backdrop-blur-md"
          >
            <IoLockClosedOutline className="text-sm" />
            <span>TeoriDuellen (Låst)</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LanguageSwitcher />

          {token ? (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs backdrop-blur-md ${
                userRole === "admin"
                  ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                  : userRole === "subscriber"
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-800 bg-slate-900/80 text-slate-300"
              }`}
            >
              <IoPersonCircleOutline className="text-base text-amber-400" />
              <span className="font-semibold">
                {userName || userEmail || "Inloggad"} {userRole === "admin" ? "(Admin)" : userRole === "subscriber" ? "(Medlem)" : ""}
              </span>
              <button
                onClick={handleLogout}
                title="Logga ut"
                className="ml-2 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <IoLogOutOutline className="text-base" />
              </button>
            </div>
          ) : (
            <Link
              href="/login?redirect=/community"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:border-amber-500/40 hover:text-amber-400 transition-all shadow-md"
            >
              <IoPersonCircleOutline className="text-base text-amber-400" />
              <span>Logga in</span>
            </Link>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* VY 1: ÖVERSIKT ÖVER ALLA SPRÅKFORUM */}
      {/* ======================================================== */}
      {!selectedRoomId ? (
        <div className="w-full max-w-6xl space-y-8 animate-fade-in z-10">
          {/* Titel & Intro */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">
              <IoGlobeOutline className="text-sm" />
              Flerspråkig Gemenskap för Körkortstagare
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Hjälp varandra till <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">körkortet</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Välj ditt språk nedan för att gå med i forumet. Ställ frågor om svåra teorifrågor, diskutera Trafikverkets uppkörning och dela värdefulla tips med andra elever och instruktörer.
            </p>
          </div>

          {/* Grid av språkrum */}
          {loadingRooms ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              <p className="mt-4 text-xs font-semibold text-slate-400">Laddar språkforum...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleSelectRoom(room.id)}
                  className="group relative cursor-pointer rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md transition-all hover:border-amber-500/60 hover:bg-slate-900 hover:shadow-2xl hover:shadow-amber-500/10 hover:scale-[1.01] flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Flagga, Namn, Aktivitet */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl drop-shadow-md">{room.flag}</span>
                        <div>
                          <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                            {room.nativeName}
                          </h3>
                          <span className="text-xs text-slate-400 font-medium">
                            {room.name}
                          </span>
                        </div>
                      </div>

                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {room.activeUsers} aktiva
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {room.description}
                    </p>

                    {/* Senaste inlägg preview */}
                    {room.latestMessage && (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 mb-4 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-bold text-amber-400/90">
                            Senaste inlägg av {room.latestMessage.userName}:
                          </span>
                          <span>{new Date(room.latestMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-slate-300 italic line-clamp-2">
                          &quot;{room.latestMessage.text}&quot;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                      <IoChatbubblesOutline className="text-amber-400" />
                      {room.messageCount} inlägg
                    </span>

                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400 group-hover:translate-x-1 transition-transform">
                      <span>Öppna forum</span>
                      <IoArrowForward />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* VY 2: INNE I ETT SPECIFIKT SPRÅKFORUM */
        /* ======================================================== */
        <div className="w-full max-w-4xl space-y-6 animate-fade-in z-10">
          {/* Header för valt forum */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <button
                type="button"
                onClick={() => setSelectedRoomId(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/40 transition-all shadow-md"
              >
                <IoArrowBack className="text-amber-400" />
                <span>Alla språkrum</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedRoom?.flag}</span>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    {selectedRoom?.nativeName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {messages.length} meddelanden • Hjälpforum för körkortsteori
                  </p>
                </div>
              </div>

              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Forumet är aktivt</span>
              </div>
            </div>

            {/* Ämnesfilter (Piller) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                Ämne:
              </span>
              <button
                type="button"
                onClick={() => handleFilterTopic("Alla")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  selectedTopic === "Alla"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                }`}
              >
                Alla inlägg
              </button>
              {selectedRoom?.topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleFilterTopic(t)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                    selectedTopic === t
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* CHATTRUTA / MEDDELANDELISTA */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-4 min-h-[400px] max-h-[550px] overflow-y-auto">
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto mb-2" />
                <p className="text-xs text-slate-400">Laddar inlägg...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <IoChatbubblesOutline className="text-4xl text-slate-500 block mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">
                  Inga inlägg i detta ämne än.
                </p>
                <p className="text-xs text-slate-500">
                  Var först med att ställa en fråga eller dela ett tips i forumet!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isLiked = likedMessageIds.has(msg.id);
                const isMe = userEmail && msg.userEmail === userEmail;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      msg.userRole === "admin"
                        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-900"
                        : msg.userRole === "subscriber"
                        ? "border-emerald-500/30 bg-slate-950/70"
                        : "border-slate-800/80 bg-slate-950/60"
                    }`}
                  >
                    {/* Header i meddelandekort */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                            msg.userRole === "admin"
                              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                              : msg.userRole === "subscriber"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {msg.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm">
                              {msg.userName} {isMe ? "(Du)" : ""}
                            </span>

                            {msg.userRole === "admin" && (
                              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.2 text-[9px] font-black uppercase text-amber-300">
                                Lärare / Admin
                              </span>
                            )}
                            {msg.userRole === "subscriber" && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold uppercase text-emerald-300">
                                Medlem
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleString("sv-SE", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {msg.topic && (
                        <span className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                          {msg.topic}
                        </span>
                      )}
                    </div>

                    {/* Meddelandetext */}
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line mt-2 pl-1">
                      {msg.message}
                    </p>

                    {/* Footer / Gilla / Svara */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleLikeMessage(msg.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                          isLiked
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "text-slate-400 hover:text-amber-400 hover:bg-slate-900"
                        }`}
                        title="Markera som hjälpsamt svar"
                      >
                        {isLiked ? (
                          <IoThumbsUp className="text-sm text-amber-400" />
                        ) : (
                          <IoThumbsUpOutline className="text-sm" />
                        )}
                        <span className="font-bold">{msg.likesCount}</span>
                        <span className="hidden sm:inline font-medium">Hjälpsamt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInputMessage(`@${msg.userName} `);
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Svara
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* SKRIVFÄLT / INPUT */}
          <form
            onSubmit={handleSendMessage}
            className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <span>Skriv som:</span>
                {token ? (
                  <span className="text-amber-400 font-semibold">{userName}</span>
                ) : (
                  <input
                    type="text"
                    placeholder="Ditt namn / alias..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Välj ämne */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Ämne:</span>
                <select
                  value={inputTopic}
                  onChange={(e) => setInputTopic(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="Allmänt">Allmänt</option>
                  <option value="Teoriprovet">Teoriprovet</option>
                  <option value="Trafikregler & Skyltar">Trafikregler & Skyltar</option>
                  <option value="Uppkörning">Uppkörning</option>
                  <option value="Tips & Erfarenheter">Tips & Erfarenheter</option>
                </select>
              </div>
            </div>

            {/* Inmatningsfält & Skicka-knapp */}
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                placeholder={`Ställ en fråga eller ge ett råd i ${selectedRoom?.nativeName}...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                required
                className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="shrink-0 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <>
                    <span className="hidden sm:inline">Skicka</span>
                    <IoSend />
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Tips: Tryck <strong>Enter</strong> för att skicka. Håll god ton och hjälp varandra att klara körkortet!
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
