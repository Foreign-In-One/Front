'use client';

import { MessageCircle, SendHorizontal, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const SUGGESTIONS = [
  '내가 지금 확인해야 하는 건 뭐야?',
  '이번 달 월급이 왜 달라?',
  '올해 지금까지 월급 얼마 받았어?',
  '연말정산 때 뭘 준비해야 해?',
  '출국 전에 받을 돈이 뭐야?',
] as const;

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  action?: { label: string; href: string };
}

const PROFILE_ACTION = { label: '금융권리 프로필 만들기', href: '/onboarding' };

function answer(question: string): Omit<Message, 'id'> {
  const has = (...keys: string[]) => keys.some((key) => question.includes(key));

  if (has('출국', '귀국', '연금', '퇴직금')) {
    return {
      role: 'ai',
      text: '출국 전에는 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액 4가지를 확인하면 됩니다. 지금은 예시 답변이며, 프로필을 등록하면 실제 데이터로 안내해 드려요.',
      action: PROFILE_ACTION,
    };
  }
  if (has('연말정산', '세금', '환급', '공제')) {
    return {
      role: 'ai',
      text: '연말정산에서는 거주자 여부, 주택청약저축 소득공제, 19% 단일세율 특례 3가지를 확인하면 됩니다. 지금은 예시 답변이며, 프로필을 등록하면 실제 데이터로 안내해 드려요.',
      action: PROFILE_ACTION,
    };
  }
  if (has('올해', '누적', '얼마', '총 급여', '지금까지')) {
    return {
      role: 'ai',
      text: '급여 확인 기록이 쌓이면 올해 누적 급여를 계산해 드려요. 지금은 예시 답변입니다.',
      action: PROFILE_ACTION,
    };
  }
  if (has('일정', '캘린더', '언제')) {
    return {
      role: 'ai',
      text: '금융권리 캘린더에서 급여일과 세금·출국 준비 일정을 월별로 확인할 수 있어요. (준비 중인 기능입니다)',
    };
  }
  return {
    role: 'ai',
    text: '아직 실제 데이터와 연동되지 않은 예시 답변이에요. 프로필을 등록하면 급여·세금·출국 정보를 바탕으로 답변해 드릴게요.',
    action: PROFILE_ACTION,
  };
}

let messageSeq = 0;
function nextId(prefix: string) {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

export function ChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: '안녕하세요! 급여, 세금, 출국 정산에 대해 무엇이든 물어보세요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const send = (text: string) => {
    const question = text.trim();
    if (!question || typing) return;
    setMessages((previous) => [
      ...previous,
      { id: nextId('user'), role: 'user', text: question },
    ]);
    setInput('');
    setTyping(true);
    window.setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        { id: nextId('ai'), ...answer(question) },
      ]);
      setTyping(false);
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 450);
  };

  return (
    <>
      <button
        type="button"
        className="f1-chat-trigger"
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={18} />
        도우미에게 물어보기
      </button>

      {open ? (
        <div className="f1-chat-overlay">
          <button
            type="button"
            className="f1-chat-backdrop"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div
            className="f1-chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="금융권리 도우미 챗봇"
          >
            <header className="f1-chat-header">
              <span className="f1-chat-title">
                <Sparkles size={16} />
                금융권리 도우미
              </span>
              <button
                type="button"
                className="f1-chat-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </header>

            <div ref={scrollRef} className="f1-chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`f1-chat-row f1-chat-row--${message.role}`}
                >
                  <div className="f1-chat-bubble">
                    {message.text}
                    {message.action ? (
                      <Link
                        href={message.action.href}
                        onClick={() => setOpen(false)}
                        className="f1-chat-action"
                      >
                        {message.action.label} →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              {typing ? (
                <div className="f1-chat-row f1-chat-row--ai">
                  <div className="f1-chat-bubble f1-chat-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
              <div className="f1-chat-suggestions">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="f1-chat-suggestion"
                    onClick={() => send(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="f1-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
            >
              <input
                className="f1-chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="궁금한 점을 물어보세요"
                aria-label="메시지 입력"
              />
              <button type="submit" className="f1-chat-send" aria-label="전송">
                <SendHorizontal size={18} />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
