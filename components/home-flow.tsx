'use client';

import {
  ArrowRight,
  Check,
  PlaneTakeoff,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const languages = ['한국어', 'English', 'Tiếng Việt', '中文'] as const;

export function HomeFlow() {
  const router = useRouter();
  const [language, setLanguage] =
    useState<(typeof languages)[number]>('한국어');
  const [intro, setIntro] = useState(false);

  if (intro) {
    return (
      <div className="f1-screen">
        <main className="f1-wrap f1-home">
          <Brand label="PayCycle AI · 금융권리 Agent" />
          <h1 className="f1-home__headline">
            한국에서 일하면서,
            <br />
            내가 받을 돈을
            <br />
            놓치고 있지는 않나요?
          </h1>
          <p className="f1-home__description">
            급여 확인부터 연말정산, 출국 전 정산까지 외국인 근로자의 금융권리를
            한곳에서 관리하세요.
          </p>
          <section className="f1-benefits" aria-label="서비스 안내">
            <Benefit
              icon={<WalletCards size={22} />}
              label="💰 매월"
              title="급여가 제대로 들어왔는지 확인"
            />
            <Benefit
              icon={<ReceiptText size={22} />}
              label="🧾 연 1회"
              title="연말정산과 세금 혜택 확인"
            />
            <Benefit
              icon={<PlaneTakeoff size={22} />}
              label="✈️ 출국 전"
              title="내가 받을 돈과 필요한 서류 확인"
            />
          </section>
          <div className="f1-home__actions">
            <button
              type="button"
              className="f1-next"
              onClick={() => router.push('/onboarding')}
            >
              내 금융권리 관리 시작하기 <ArrowRight size={18} />
            </button>
            <button type="button" className="f1-sample">
              ✨&nbsp; 샘플 데이터로 체험하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="f1-screen">
      <main className="f1-wrap f1-landing">
        <Brand label="PayCycle AI" />
        <h1 className="f1-landing__title">언어를 선택해 주세요</h1>
        <p className="f1-landing__subtitle">Select your language</p>
        <div className="f1-language-list">
          {languages.map((item) => (
            <button
              key={item}
              type="button"
              className="f1-language"
              aria-pressed={language === item}
              onClick={() => setLanguage(item)}
            >
              <span>{item}</span>
              {language === item ? <Check size={20} /> : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="f1-next f1-language-next"
          onClick={() => setIntro(true)}
        >
          다음 <ArrowRight size={18} />
        </button>
      </main>
    </div>
  );
}

function Brand({ label }: { label: string }) {
  return (
    <span className="f1-brand">
      <ShieldCheck size={16} color="#0aa26c" strokeWidth={2.2} />
      {label}
    </span>
  );
}

function Benefit({
  icon,
  label,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <article className="f1-benefit">
      <span className="f1-benefit__icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{title}</strong>
      </div>
    </article>
  );
}
