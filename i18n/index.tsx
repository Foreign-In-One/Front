'use client';

import i18n from 'i18next';
import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from 'react-i18next';
import {
  BASE,
  DICT,
  type DictKey,
  LOCALES,
  QUESTION_LANGUAGE,
  type UiLocale,
} from './dict';
import { EXTRA } from './extra';
import { RULES } from './rules';

export { LOCALES, QUESTION_LANGUAGE };
export type { UiLocale };
/** 번역 키. 사전에 정의된 키를 우선 쓰되 동적 키도 허용한다. */
export type TKey = DictKey | (string & {});
export type { DictKey };

const STORAGE_KEY = 'paycycle-locale';

function resourcesFor(locale: UiLocale) {
  return {
    translation: {
      ...BASE,
      ...(RULES.ko ?? {}),
      ...(EXTRA.ko ?? {}),
      ...(DICT[locale] ?? {}),
      ...(RULES[locale] ?? {}),
      ...(EXTRA[locale] ?? {}),
    },
  };
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'ko',
    fallbackLng: 'ko',
    resources: Object.fromEntries(
      LOCALES.map((l) => [l.code, resourcesFor(l.code)]),
    ),
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
      prefix: '{',
      suffix: '}',
    },
    react: { useSuspense: false },
  });
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as UiLocale | null;
    if (
      saved &&
      LOCALES.some((l) => l.code === saved) &&
      saved !== i18n.language
    ) {
      void i18n.changeLanguage(saved);
    }
  }, []);

  // <html lang>을 현재 언어와 동기화한다. 네이티브 <input type="date"> 등
  // 브라우저 기본 UI는 i18next가 아니라 이 속성을 보고 표시 언어를 정한다.
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    const handleLanguageChanged = (lng: string) => {
      document.documentElement.lang = lng;
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export interface Translator {
  locale: UiLocale;
  setLocale: (next: UiLocale) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

export function useT(): Translator {
  const { t: raw, i18n: instance } = useTranslation();
  const locale = (instance.language as UiLocale) ?? 'ko';

  const setLocale = useCallback(
    (next: UiLocale) => {
      void instance.changeLanguage(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* 저장 실패는 무시 */
      }
    },
    [instance],
  );

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) =>
      raw(key, vars ?? {}) as string,
    [raw],
  );

  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}

/** 훅 밖(유틸/서비스)에서 쓰는 번역 함수. */
export function translate(
  key: TKey,
  vars?: Record<string, string | number>,
  locale?: UiLocale,
): string {
  return i18n.getFixedT(locale ?? (i18n.language as UiLocale) ?? 'ko')(
    key,
    vars ?? {},
  ) as string;
}

export type TFn = Translator['t'];
