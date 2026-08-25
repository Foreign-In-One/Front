"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, SendHorizontal, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayCycle } from "@/state/paycycle-context";
import {
  getSuggestions,
  buildChatContext,
  localAnswer,
  type ChatAnswer,
} from "@/lib/paycycle/chat-intent";
import { askAssistant } from "@/services/ai";
import { useT } from "@/i18n";
import { uid } from "@/lib/paycycle/format";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  action?: ChatAnswer["action"];
}

export function ChatDock() {
  const { state, yearlyPay, monthsRecorded } = usePayCycle();
  const { locale, t } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "ai", text: t("chat.welcome") },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ text?: string }>) => {
      setOpen(true);
      if (e.detail?.text) {
        void send(e.detail.text);
      }
    };
    window.addEventListener("open-paycycle-chat" as any, handleOpenChat);
    return () => window.removeEventListener("open-paycycle-chat" as any, handleOpenChat);
  }, []);

  const push = (answer: ChatAnswer) =>
    setMessages((prev) => [
      ...prev,
      {
        id: uid("m"),
        role: "ai" as const,
        text: answer.text,
        ...(answer.action ? { action: answer.action } : {}),
      },
    ]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || typing) return;
    setMessages((prev) => [...prev, { id: uid("m"), role: "user", text: question }]);
    setInput("");
    setTyping(true);
    const fallback = localAnswer(question, state, yearlyPay, monthsRecorded, locale);
    try {
      const context = buildChatContext(state, yearlyPay, monthsRecorded, locale);
      const result = await askAssistant(question, context, locale);
      push(
        result.text
          ? { text: result.text, ...(fallback.action ? { action: fallback.action } : {}) }
          : fallback,
      );
    } catch {
      push(fallback);
    } finally {
      setTyping(false);
    }
  };

  const suggestions = getSuggestions(locale);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-22 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
        >
          <MessageCircle className="size-4" />
          {t("chat.open")}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-info" />
            {t("chat.open")}
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="h-[calc(85vh-9.5rem)] space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`pc-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground shadow-sm"
                }`}
              >
                {m.text}
                {m.action ? (
                  <Link
                    href={m.action.to}
                    onClick={() => setOpen(false)}
                    className="mt-3 inline-flex rounded-full bg-info-soft px-3 py-1.5 text-xs font-semibold text-info hover:underline"
                  >
                    {m.action.label} →
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
          {typing ? (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl bg-card px-4 py-3 shadow-sm">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 border-t bg-card px-4 py-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
          />
          <Button type="submit" size="icon" aria-label={t("chat.send")}>
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
