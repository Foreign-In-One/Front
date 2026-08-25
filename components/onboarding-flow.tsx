'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Globe2,
  Info,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { saveProfile } from '@/lib/profile';

type Status = 'PRE_EMPLOYMENT' | 'EMPLOYED' | 'SEPARATED' | 'CHANGING';
type DateKey = 'entry' | 'workStart' | 'currentStart' | 'exit';
type StepKey =
  | 'name'
  | 'status'
  | 'nationality'
  | 'visa'
  | DateKey
  | 'workplace'
  | 'payday';
type Values = {
  name: string;
  status: Status | '';
  nationality: string;
  visa: string;
  entry: string;
  workStart: string;
  workplace: string;
  currentStart: string;
  payday: string;
  exit: string;
};

const languages = ['한국어', 'English', 'Tiếng Việt', '中文'] as const;
const VISA_CODES = ['E-9', 'E-7', 'H-2', 'F-2', 'F-4', 'D-2'] as const;
const visaDescriptions: Record<(typeof VISA_CODES)[number], string> = {
  'E-9':
    '비전문취업 비자입니다. 제조업·건설업·농축산업 등에서 일할 때 주로 사용하는 체류자격입니다.',
  'E-7':
    '특정활동 비자입니다. 전문 기술·지식이 필요한 직무로 초청받아 일할 때 사용합니다.',
  'H-2':
    '방문취업 비자입니다. 중국·구소련 지역 동포가 지정된 업종에서 일할 때 사용합니다.',
  'F-2':
    '거주 비자입니다. 장기 체류가 인정된 경우로, 취업 제한이 비교적 적습니다.',
  'F-4': '재외동포 비자입니다. 단순노무 등 일부 직종에는 제한이 있습니다.',
  'D-2': '유학 비자입니다. 일하려면 별도의 시간제 취업 허가가 필요합니다.',
};
const statusOptions: { value: Status; title: string; detail: string }[] = [
  {
    value: 'PRE_EMPLOYMENT',
    title: '아직 취업 전',
    detail: '입국했지만 근무를 시작하지 않았어요.',
  },
  {
    value: 'EMPLOYED',
    title: '근무 중',
    detail: '지금 사업장에서 일하고 있어요.',
  },
  {
    value: 'SEPARATED',
    title: '퇴사함',
    detail: '일을 그만두었고 정산을 확인하고 싶어요.',
  },
  {
    value: 'CHANGING',
    title: '이직 준비 중',
    detail: '사업장을 옮기는 중이에요.',
  },
];
const copy: Record<StepKey, { title: string; hint: string }> = {
  name: {
    title: '어떻게 불러 드릴까요?',
    hint: '이름 또는 별칭을 입력해 주세요.',
  },
  status: {
    title: '지금 근로 상태는 어떤가요?',
    hint: '상태에 따라 확인해야 할 항목이 달라집니다.',
  },
  nationality: {
    title: '어느 나라에서 오셨나요?',
    hint: '국적에 따라 확인해야 할 항목이 달라집니다.',
  },
  visa: {
    title: '현재 체류자격은 무엇인가요?',
    hint: 'ⓘ를 누르면 각 체류자격 설명을 볼 수 있습니다.',
  },
  entry: {
    title: '한국에 입국한 날짜는 언제인가요?',
    hint: '거주자 여부(연 183일) 판정에 사용됩니다.',
  },
  workStart: {
    title: '한국에서 처음 일을 시작한 날짜는?',
    hint: '근속기간과 퇴직금·출국만기보험 판단에 사용됩니다.',
  },
  workplace: {
    title: '지금 일하는 사업장은 어디인가요?',
    hint: '사업장 이름 또는 업종을 적어 주세요.',
  },
  currentStart: {
    title: '지금 사업장에는 언제 입사했나요?',
    hint: '최초 근무일보다 빠를 수 없습니다.',
  },
  payday: {
    title: '월급날은 언제인가요?',
    hint: "계약상 급여일 기준입니다. 모르면 '모름'을 선택하세요.",
  },
  exit: {
    title: '예상 출국일은 언제인가요?',
    hint: "출국 정산 로드맵의 기준이 됩니다. 정해지지 않았다면 '모름'을 선택하세요.",
  },
};
const today = new Date().toISOString().slice(0, 10);
const isDateKey = (key: StepKey): key is DateKey =>
  ['entry', 'workStart', 'currentStart', 'exit'].includes(key);

export function OnboardingFlow() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [language, setLanguage] =
    useState<(typeof languages)[number]>('한국어');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [openVisa, setOpenVisa] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<Record<DateKey, boolean>>({
    entry: false,
    workStart: false,
    currentStart: false,
    exit: false,
  });
  const [values, setValues] = useState<Values>({
    name: '',
    status: '',
    nationality: '',
    visa: '',
    entry: '',
    workStart: '',
    workplace: '',
    currentStart: '',
    payday: '',
    exit: '',
  });
  const steps = useMemo<StepKey[]>(() => {
    const shared: StepKey[] = [
      'name',
      'status',
      'nationality',
      'visa',
      'entry',
    ];
    if (values.status === 'EMPLOYED' || values.status === 'CHANGING')
      return [
        ...shared,
        'workStart',
        'workplace',
        'currentStart',
        'payday',
        'exit',
      ];
    if (values.status === 'SEPARATED')
      return [...shared, 'workStart', 'workplace', 'payday', 'exit'];
    return [...shared, 'exit'];
  }, [values.status]);
  const safeIndex = Math.min(index, steps.length - 1);
  const current = steps[safeIndex];
  const update = (key: keyof Values, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const dateError = isDateKey(current)
    ? validateDate(current, values, unknown)
    : null;
  const valid = current
    ? isDateKey(current)
      ? (unknown[current] || !dateError) &&
        (unknown[current] || Boolean(values[current]))
      : values[current].trim().length > 0
    : false;
  const next = () => {
    if (!valid) return;
    if (safeIndex === steps.length - 1) setDone(true);
    else setIndex(safeIndex + 1);
  };
  const autoSelect = (key: keyof Values, value: string) => {
    update(key, value);
    window.setTimeout(() => {
      if (safeIndex === steps.length - 1) setDone(true);
      else setIndex((previous) => Math.min(previous + 1, steps.length - 1));
    }, 180);
  };
  const back = () =>
    safeIndex === 0 ? router.push('/') : setIndex(safeIndex - 1);

  useEffect(() => {
    if (done && values.status) {
      saveProfile({ ...values, status: values.status });
    }
  }, [done, values]);

  if (done) {
    const status =
      statusOptions.find((item) => item.value === values.status)?.title ?? '';
    return (
      <div className="f1-screen">
        <main className="f1-wrap f1-onboarding">
          <section className="f1-complete">
            <span className="f1-complete__check">
              <Check size={33} />
            </span>
            <h1 className="mt-6 font-extrabold text-2xl">
              내 금융권리 프로필이
              <br />
              만들어졌어요.
            </h1>
            <p className="mt-4 text-[#647288] text-sm leading-6">
              {values.nationality} · {values.visa} · {status}
              <br />
              이제 어떤 혜택을 받을 수 있을지 함께 알아볼까요?
            </p>
            <button
              type="button"
              className="f1-next mt-8 w-full"
              onClick={() => router.push('/dashboard')}
            >
              내 금융권리 보러가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="f1-screen">
      <main className="f1-wrap f1-onboarding">
        <header className="f1-onboarding__top">
          <button
            type="button"
            className="f1-back"
            aria-label="이전"
            onClick={back}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="f1-progress">
            <span
              style={{ width: `${((safeIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
          <span className="f1-step-count">
            {safeIndex + 1}/{steps.length}
          </span>
          <div className="f1-language-menu">
            <button
              type="button"
              className="f1-language-pill"
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((open) => !open)}
            >
              <Globe2 size={14} />
              {language}
              <ChevronDown size={13} />
            </button>
            {languageOpen ? (
              <div className="f1-language-popover">
                {languages.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={item === language ? 'is-selected' : ''}
                    onClick={() => {
                      setLanguage(item);
                      setLanguageOpen(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        <section className="f1-question">
          <h1>{copy[current].title}</h1>
          <p>{copy[current].hint}</p>
          <div className="mt-8">
            {renderField(
              current,
              values,
              unknown,
              update,
              setUnknown,
              autoSelect,
              openVisa,
              setOpenVisa,
              dateError,
            )}
          </div>
        </section>
        <footer className="f1-onboarding__bottom">
          <button
            type="button"
            className="f1-next w-full"
            disabled={!valid}
            onClick={next}
          >
            {safeIndex === steps.length - 1 ? '완료' : '다음'}{' '}
            <ArrowRight size={18} />
          </button>
        </footer>
      </main>
    </div>
  );
}

function renderField(
  current: StepKey,
  values: Values,
  unknown: Record<DateKey, boolean>,
  update: (key: keyof Values, value: string) => void,
  setUnknown: React.Dispatch<React.SetStateAction<Record<DateKey, boolean>>>,
  autoSelect: (key: keyof Values, value: string) => void,
  openVisa: string | null,
  setOpenVisa: React.Dispatch<React.SetStateAction<string | null>>,
  dateError: string | null,
) {
  if (current === 'name')
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: each wizard step focuses its own first field on mount
        autoFocus
        className="f1-field"
        value={values.name}
        placeholder="예: 흐엉"
        onChange={(event) => update('name', event.target.value)}
      />
    );
  if (current === 'status')
    return (
      <div className="f1-options">
        {statusOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            className="f1-option"
            aria-pressed={values.status === item.value}
            onClick={() => autoSelect('status', item.value)}
          >
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
    );
  if (current === 'nationality')
    return (
      <div className="f1-grid">
        {['베트남', '캄보디아', '태국', '인도네시아', '네팔', '필리핀'].map(
          (item) => (
            <Choice
              key={item}
              value={item}
              selected={values.nationality}
              onSelect={(value) => autoSelect('nationality', value)}
            />
          ),
        )}
      </div>
    );
  if (current === 'visa')
    return (
      <div className="f1-grid f1-visa-grid">
        {VISA_CODES.map((item) => (
          <div
            key={item}
            className="f1-visa-item"
            data-selected={values.visa === item}
          >
            <button
              type="button"
              className="f1-option"
              aria-pressed={values.visa === item}
              onClick={() => autoSelect('visa', item)}
            >
              <strong>{item}</strong>
            </button>
            <button
              type="button"
              className="f1-info"
              aria-label={`${item} 설명`}
              onClick={() => setOpenVisa(openVisa === item ? null : item)}
            >
              <Info size={16} />
            </button>
            {openVisa === item ? (
              <p className="f1-visa-info">{visaDescriptions[item]}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  if (current === 'payday')
    return (
      <div className="f1-grid">
        {['5일', '10일', '15일', '20일', '25일', '말일'].map((item) => (
          <Choice
            key={item}
            value={item}
            selected={values.payday}
            onSelect={(value) => autoSelect('payday', value)}
          />
        ))}
        <button
          type="button"
          className="f1-unknown-choice"
          aria-pressed={values.payday === '모름'}
          onClick={() => autoSelect('payday', '모름')}
        >
          모름 / 계약서 확인 필요
        </button>
      </div>
    );
  if (current === 'workplace')
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: each wizard step focuses its own first field on mount
        autoFocus
        className="f1-field"
        value={values.workplace}
        placeholder="예: 한빛정밀 (제조업)"
        onChange={(event) => update('workplace', event.target.value)}
      />
    );
  const key = current as DateKey;
  return (
    <F1DateField
      value={values[key]}
      unknown={unknown[key]}
      onChange={(value) => update(key, value)}
      onUnknown={(next) => {
        setUnknown((previous) => ({ ...previous, [key]: next }));
        if (next) update(key, '');
      }}
      error={dateError}
      min={
        key === 'workStart'
          ? values.entry
          : key === 'currentStart'
            ? values.workStart
            : key === 'exit'
              ? today
              : undefined
      }
      max={key === 'exit' ? undefined : today}
      allowUnknown={key !== 'entry'}
    />
  );
}

function F1DateField({
  value,
  unknown,
  onChange,
  onUnknown,
  error,
  min,
  max,
  allowUnknown,
}: {
  value: string;
  unknown: boolean;
  onChange: (value: string) => void;
  onUnknown: (next: boolean) => void;
  error: string | null;
  min?: string;
  max?: string;
  allowUnknown: boolean;
}) {
  const [text, setText] = useState(value ? formatDate(value) : '');
  useEffect(() => {
    setText(value ? formatDate(value) : '');
  }, [value]);
  const commit = (raw: string) => {
    setText(raw);
    const parsed = parseDate(raw);
    if (parsed) onChange(parsed);
    else if (raw.replace(/[^0-9]/g, '').length === 8) onChange('');
  };
  return (
    <div className="f1-date-field">
      <div className="f1-date-row">
        <input
          className="f1-field"
          disabled={unknown}
          inputMode="numeric"
          value={text}
          placeholder="YYYY. MM. DD."
          onChange={(event) => commit(event.target.value)}
        />
        <input
          className="f1-date-picker"
          type="date"
          disabled={unknown}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {allowUnknown ? (
        <button
          type="button"
          className="f1-unknown-choice"
          aria-pressed={unknown}
          onClick={() => onUnknown(!unknown)}
        >
          모름 / 아직 정해지지 않음
        </button>
      ) : null}
      {error && !unknown ? <p className="f1-date-error">{error}</p> : null}
    </div>
  );
}

function Choice({
  value,
  selected,
  onSelect,
}: {
  value: string;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className="f1-option"
      aria-pressed={selected === value}
      onClick={() => onSelect(value)}
    >
      {value}
    </button>
  );
}
function formatDate(value: string) {
  return value ? `${value.replaceAll('-', '. ')}.` : '';
}
function parseDate(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  return Number.isNaN(new Date(`${iso}T00:00:00`).getTime()) ? null : iso;
}
function validateDate(
  key: DateKey,
  values: Values,
  unknown: Record<DateKey, boolean>,
) {
  if (unknown[key] && key !== 'entry') return null;
  const value = values[key];
  if (!value) return null;
  if (key !== 'exit' && value > today)
    return '오늘 이후 날짜는 입력할 수 없습니다.';
  if (key === 'exit' && value < today)
    return '오늘 이전 날짜는 입력할 수 없습니다.';
  const before =
    key === 'workStart'
      ? values.entry
      : key === 'currentStart'
        ? values.workStart
        : '';
  const label = key === 'workStart' ? '입국일' : '최초 근무일';
  return before && value < before
    ? `${label}(${formatDate(before)})보다 빠를 수 없습니다.`
    : null;
}
