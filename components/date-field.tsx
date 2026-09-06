'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';
import {
  type DateRule,
  formatKDate,
  parseKDate,
  validateDate,
} from '@/lib/paycycle/format';
import type { DateValue } from '@/lib/paycycle/types';

/** YYYY.MM.DD 직접입력 + 달력 선택 + 모름/미정 을 함께 지원하는 날짜 입력 */
export function DateField({
  value,
  onChange,
  rule,
  allowUnknown = true,
  label = '날짜',
}: {
  value: DateValue;
  onChange: (next: DateValue) => void;
  rule?: DateRule;
  allowUnknown?: boolean;
  label?: string;
}) {
  const { t, locale } = useT();
  const [text, setText] = useState(value.value ? formatKDate(value.value) : '');

  useEffect(() => {
    setText(value.value ? formatKDate(value.value) : '');
  }, [value.value]);

  const error = value.unknown
    ? null
    : value.value
      ? validateDate(value.value, rule)
      : null;
  const typedButUnparsed =
    !value.unknown && text.replace(/[^0-9]/g, '').length === 8 && !value.value;

  const commitText = (raw: string) => {
    setText(raw);
    const iso = parseKDate(raw);
    onChange({ value: iso ?? '', unknown: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={text}
          disabled={value.unknown}
          inputMode="numeric"
          placeholder="YYYY.MM.DD"
          aria-label={t('date.manualAria', { label })}
          onChange={(e) => commitText(e.target.value)}
          className="h-14 flex-1 text-lg"
        />
        <Input
          type="date"
          lang={locale}
          disabled={value.unknown}
          aria-label={t('date.calendarAria', { label })}
          value={value.value}
          onChange={(e) => onChange({ value: e.target.value, unknown: false })}
          className="h-14 w-[9.5rem] text-base"
        />
      </div>

      {allowUnknown ? (
        <button
          type="button"
          onClick={() =>
            onChange(
              value.unknown
                ? { value: '', unknown: false }
                : { value: '', unknown: true },
            )
          }
          className={`rounded-full border px-3.5 py-2 font-semibold text-xs transition-colors ${
            value.unknown
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {t('date.unknown')}
        </button>
      ) : null}

      {typedButUnparsed ? (
        <p className="font-semibold text-warn-foreground text-xs">
          {t('date.invalidExample')}
        </p>
      ) : null}
      {error ? (
        <p className="font-semibold text-warn-foreground text-xs">{error}</p>
      ) : null}
    </div>
  );
}

export function dateFieldValid(
  value: DateValue,
  rule?: DateRule,
  allowUnknown = true,
): boolean {
  if (value.unknown) return allowUnknown;
  if (!value.value) return false;
  return validateDate(value.value, rule) === null;
}
