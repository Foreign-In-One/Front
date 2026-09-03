"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatKDate, parseKDate, validateDate, type DateRule } from "@/lib/paycycle/format";
import type { DateValue } from "@/lib/paycycle/types";

/** YYYY.MM.DD 직접입력 + 달력 선택 + 모름/미정 을 함께 지원하는 날짜 입력 */
export function DateField({
  value,
  onChange,
  rule,
  allowUnknown = true,
  label = "날짜",
}: {
  value: DateValue;
  onChange: (next: DateValue) => void;
  rule?: DateRule;
  allowUnknown?: boolean;
  label?: string;
}) {
  const [text, setText] = useState(value.value ? formatKDate(value.value) : "");

  useEffect(() => {
    setText(value.value ? formatKDate(value.value) : "");
  }, [value.value]);

  const error = value.unknown ? null : value.value ? validateDate(value.value, rule) : null;
  const typedButUnparsed = !value.unknown && text.replace(/[^0-9]/g, "").length === 8 && !value.value;

  const commitText = (raw: string) => {
    setText(raw);
    const iso = parseKDate(raw);
    onChange({ value: iso ?? "", unknown: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={text}
          disabled={value.unknown}
          inputMode="numeric"
          placeholder="YYYY.MM.DD"
          aria-label={`${label} 직접 입력`}
          onChange={(e) => commitText(e.target.value)}
          className="h-14 flex-1 text-lg"
        />
        <Input
          type="date"
          disabled={value.unknown}
          aria-label={`${label} 달력 선택`}
          value={value.value}
          onChange={(e) => onChange({ value: e.target.value, unknown: false })}
          className="h-14 w-[9.5rem] text-base"
        />
      </div>

      {allowUnknown ? (
        <button
          type="button"
          onClick={() => onChange(value.unknown ? { value: "", unknown: false } : { value: "", unknown: true })}
          className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
            value.unknown
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          모름 / 아직 정해지지 않음
        </button>
      ) : null}

      {typedButUnparsed ? (
        <p className="text-xs font-semibold text-warn-foreground">
          존재하지 않는 날짜입니다. 예: 2025.03.01
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-warn-foreground">{error}</p> : null}
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
