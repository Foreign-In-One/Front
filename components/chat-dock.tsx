'use client';

import { MessageCircle, SendHorizontal, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { dDay, formatKDate } from '@/lib/date';
import { readProfile, type StoredProfile } from '@/lib/profile';

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
const EDIT_PROFILE_ACTION = {
  label: '프로필에 날짜 추가하기',
  href: '/onboarding',
};
const EXIT_CHECK_ACTION = { label: '출국 정산 확인하기', href: '/exitcheck' };

const STATUS_LABEL: Record<StoredProfile['status'], string> = {
  PRE_EMPLOYMENT: '취업 준비 중',
  EMPLOYED: '근무 중',
  SEPARATED: '퇴사함',
  CHANGING: '이직 준비 중',
};

function answer(
  question: string,
  profile: StoredProfile | null,
): Omit<Message, 'id'> {
  const has = (...keys: string[]) => keys.some((key) => question.includes(key));

  if (!profile) {
    return {
      role: 'ai',
      text: '아직 등록된 금융권리 프로필이 없어요. 국적·체류자격·근로 상태·주요 날짜를 등록하면 급여·세금·출국 정보를 바탕으로 답변해 드릴게요.',
      action: PROFILE_ACTION,
    };
  }

  const statusLabel = STATUS_LABEL[profile.status];

  if (has('출국', '귀국', '연금', '퇴직금')) {
    if (profile.status === 'PRE_EMPLOYMENT') {
      return {
        role: 'ai',
        text: '아직 취업 전이라 출국 정산 항목은 근무를 시작한 뒤에 의미가 있어요. 취업 후 다시 물어봐 주세요.',
      };
    }
    if (!profile.exit) {
      return {
        role: 'ai',
        text: '예상 출국일이 아직 등록되지 않았어요. 출국 예정일을 등록하면 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액 4가지를 D-day와 함께 안내해 드려요.',
        action: EDIT_PROFILE_ACTION,
      };
    }
    const dd = dDay(profile.exit);
    return {
      role: 'ai',
      text:
        dd >= 0
          ? `예상 출국일(${formatKDate(profile.exit)})까지 D-${dd}입니다. 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액 4가지를 순서대로 확인해 보세요.`
          : `등록하신 예상 출국일(${formatKDate(profile.exit)})이 이미 지났어요. 출국만기보험, 귀국비용보험, 국민연금 반환일시금, 퇴직금 차액을 아직 못 받으셨다면 지금 확인해 보세요.`,
      action: EXIT_CHECK_ACTION,
    };
  }

  if (has('연말정산', '세금', '환급', '공제')) {
    if (!profile.entry) {
      return {
        role: 'ai',
        text: '입국일이 아직 등록되지 않아 거주자 여부를 판단할 수 없어요. 입국일을 등록하면 연 183일 기준으로 거주자/비거주자 여부를 안내해 드려요.',
        action: EDIT_PROFILE_ACTION,
      };
    }
    const daysSinceEntry = -dDay(profile.entry);
    const isResident = daysSinceEntry >= 183;
    return {
      role: 'ai',
      text: isResident
        ? `입국일(${formatKDate(profile.entry)}) 기준 ${daysSinceEntry}일째 체류 중이라 세법상 거주자로 볼 가능성이 높아요. 연말정산에서는 주택청약저축 소득공제, 19% 단일세율 특례 2가지를 비교해서 유리한 쪽을 확인해 보세요.`
        : `입국일(${formatKDate(profile.entry)}) 기준 ${daysSinceEntry}일째 체류 중이에요. 183일(거주자 기준)까지 D-${183 - daysSinceEntry} 남았어요. 그 전까지는 19% 단일세율 특례를 우선 확인해 보세요.`,
    };
  }

  if (has('이번', '왜 달라', '차이', '적게', '적었')) {
    return {
      role: 'ai',
      text: profile.payday
        ? `계약서·임금명세서·입금액 3중 대조 기능은 아직 준비 중이에요. 등록하신 급여일(매월 ${profile.payday}일) 기준으로 입금이 늦거나 금액이 다른지 먼저 확인해 보세요.`
        : '급여일이 아직 등록되지 않았어요. 급여일을 등록하면 입금 지연이나 금액 차이를 더 정확히 안내해 드려요.',
      action: profile.payday ? undefined : EDIT_PROFILE_ACTION,
    };
  }

  if (has('올해', '누적', '얼마', '총 급여', '지금까지')) {
    if (profile.status === 'PRE_EMPLOYMENT') {
      return {
        role: 'ai',
        text: '아직 취업 전이라 확인할 급여 기록이 없어요. 취업 후 급여일이 지나면 누적 급여를 계산해 드릴게요.',
      };
    }
    return {
      role: 'ai',
      text: `은행 계좌 연동 전이라 아직 실제 입금 내역을 불러올 수 없어요. ${profile.workplace ? `${profile.workplace}에서 ` : ''}매월 ${profile.payday || '등록된'} 일 급여일 기준으로 누적 급여를 계산하는 기능은 준비 중입니다.`,
    };
  }

  if (has('일정', '캘린더', '언제')) {
    return {
      role: 'ai',
      text: profile.payday
        ? `매월 ${profile.payday}일 급여일과 세금·출국 준비 일정을 한 캘린더에서 보여주는 기능은 준비 중이에요.`
        : '금융권리 캘린더에서 급여일과 세금·출국 준비 일정을 월별로 확인할 수 있어요. (준비 중인 기능입니다)',
    };
  }

  if (has('지금', '확인해야')) {
    if (profile.status === 'PRE_EMPLOYMENT') {
      return {
        role: 'ai',
        text: `현재 상태는 '${statusLabel}'이에요. 취업하면 근로계약서 내용과 첫 급여일부터 확인해 보세요.`,
      };
    }
    if (profile.status === 'CHANGING') {
      return {
        role: 'ai',
        text: `현재 상태는 '${statusLabel}'이에요. 이전 사업장에서 받을 정산이 남아있는지, 새 사업장 입사일이 확정됐는지부터 확인해 보세요.`,
      };
    }
    if (profile.status === 'SEPARATED') {
      const dd = profile.exit ? dDay(profile.exit) : null;
      return {
        role: 'ai',
        text:
          dd !== null
            ? `현재 상태는 '${statusLabel}'이에요. 예상 출국일까지 D-${dd}, 출국 전 정산 4가지 항목을 확인해 보세요.`
            : `현재 상태는 '${statusLabel}'이에요. 출국 전 정산 4가지 항목(출국만기보험·귀국비용보험·국민연금 반환일시금·퇴직금 차액)을 확인해 보세요.`,
        action: EXIT_CHECK_ACTION,
      };
    }
    return {
      role: 'ai',
      text: `현재 상태는 '${statusLabel}'${profile.payday ? `이고 급여일은 매월 ${profile.payday}일` : ''}이에요. 이번 급여일에 계약대로 입금됐는지부터 확인해 보세요.`,
    };
  }

  return {
    role: 'ai',
    text: `등록된 프로필(${profile.nationality} · ${profile.visa} · ${statusLabel}) 기준으로 답변드리고 싶은데, 급여·세금·출국 확인 기능은 아직 준비 중이에요. 추천 질문을 눌러보시겠어요?`,
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
        { id: nextId('ai'), ...answer(question, readProfile()) },
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
