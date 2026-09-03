'use client';

import { MessageCircle, SendHorizontal, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';
import {
  buildChatContext,
  type ChatAnswer,
  getSuggestions,
  localAnswer,
} from '@/lib/paycycle/chat-intent';
import { uid } from '@/lib/paycycle/format';
import { askAssistant } from '@/services/ai';
import { usePayCycle } from '@/state/paycycle-context';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  action?: ChatAnswer['action'];
}

export function ChatDock() {
  const { state, yearlyPay, monthsRecorded } = usePayCycle();
  const { locale, t } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'ai', text: t('chat.welcome') },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback(
    (answer: ChatAnswer) =>
      setMessages((prev) => [
        ...prev,
        {
          id: uid('m'),
          role: 'ai' as const,
          text: answer.text,
          ...(answer.action ? { action: answer.action } : {}),
        },
      ]),
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || typing) return;
      setMessages((prev) => [
        ...prev,
        { id: uid('m'), role: 'user', text: question },
      ]);
      setInput('');
      setTyping(true);
      const fallback = localAnswer(
        question,
        state,
        yearlyPay,
        monthsRecorded,
        locale,
      );
      try {
        const context = buildChatContext(
          state,
          yearlyPay,
          monthsRecorded,
          locale,
        );
        const result = await askAssistant(question, context, locale);
        push(
          result.text
            ? {
                text: result.text,
                ...(fallback.action ? { action: fallback.action } : {}),
              }
            : fallback,
        );
      } catch {
        push(fallback);
      } finally {
        setTyping(false);
      }
    },
    [typing, state, yearlyPay, monthsRecorded, locale, push],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/typing는 값을 읽지 않고 스크롤을 다시 실행시키기 위한 트리거로만 쓰인다.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, typing]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<{ text?: string }>) => {
      setOpen(true);
      if (e.detail?.text) {
        void send(e.detail.text);
      }
    };
    window.addEventListener(
      'open-paycycle-chat',
      handleOpenChat as EventListener,
    );
    return () =>
      window.removeEventListener(
        'open-paycycle-chat',
        handleOpenChat as EventListener,
      );
  }, [send]);

  const suggestions = getSuggestions(locale);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-22 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground text-sm shadow-lg shadow-primary/25 transition-transform active:scale-95"
      >
        <MessageCircle className="size-4" />
        {t('chat.open')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3">
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 border-0 bg-black/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('chat.open')}
            className="relative flex max-h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between border-b px-5 py-4">
              <span className="flex items-center gap-2 font-bold text-base">
                <Sparkles className="size-4 text-info" />
                {t('chat.open')}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-[18px]" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`pc-rise flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.text}
                    {m.action ? (
                      <Link
                        href={m.action.to}
                        onClick={() => setOpen(false)}
                        className="mt-3 inline-flex rounded-full bg-info-soft px-3 py-1.5 font-semibold text-info text-xs hover:underline"
                      >
                        {m.action.label} →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              {typing ? (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl bg-muted px-4 py-3">
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
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground text-xs"
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
                placeholder={t('chat.placeholder')}
                aria-label={t('chat.placeholder')}
              />
              <Button type="submit" size="icon" aria-label={t('chat.send')}>
                <SendHorizontal className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
