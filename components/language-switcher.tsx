"use client";

import { Globe } from "lucide-react";
import { LOCALES, useT, type UiLocale } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ============================================================================
 * [PayCycle AI - i18n(다국어 시스템) 사용 가이드 및 LanguageSwitcher 컴포넌트]
 * ============================================================================
 *
 * 1. 📌 개요 및 지원 언어
 * ----------------------------------------------------------------------------
 * PayCycle AI는 한국에 거주하는 외국인 근로자를 위한 다국어(i18n) 시스템을 기본 탑재하고 있습니다.
 * - 한국어 (ko) - 기본 언어
 * - Tiếng Việt (vi) - 베트남어
 * - 中文 (zh) - 중국어
 * - English (en) - 영어
 *
 * 2. 🚀 컴포넌트에서 다국어(i18n) 사용하는 방법
 * ----------------------------------------------------------------------------
 * ```tsx
 * import { useT } from "@/i18n";
 *
 * export function MyComponent() {
 *   // 1) useT 훅 호출
 *   const { t, locale, setLocale } = useT();
 *
 *   return (
 *     <div>
 *       {/ * 기본 번역 키 호출 * /}
 *       <h1>{t("pay.title")}</h1>
 *
 *       {/ * 보간(Interpolation) 변수 전달 * /}
 *       <p>{t("pay.report.periodLabel", { month: "2026-08" })}</p>
 *
 *       {/ * 현재 활성화된 언어 코드 확인 * /}
 *       <span>Current Language: {locale}</span>
 *
 *       {/ * 프로그래밍 방식으로 언어 변경 * /}
 *       <button onClick={() => setLocale("vi")}>베트남어로 변경</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * 3. 📝 신규 번역 텍스트(Key) 추가 및 관리 위치
 * ----------------------------------------------------------------------------
 * - 기본/공통 사전: `i18n/dict.ts` (`BASE` 객체 및 `DICT[locale]` 매핑)
 * - 추가 메시지/도메인 사전: `i18n/extra.ts`
 * - 노동법 및 권리 구제 규칙 번역: `i18n/rules.*.ts`
 *
 * 4. ⚙️ 유틸 함수나 훅 외부(일반 TS 파일/서비스)에서 번역이 필요할 때
 * ----------------------------------------------------------------------------
 * ```ts
 * import { translate } from "@/i18n";
 *
 * const message = translate("common.error", { reason: "Timeout" });
 * ```
 *
 * 5. 💡 LanguageSwitcher 컴포넌트 안내
 * ----------------------------------------------------------------------------
 * 이 컴포넌트는 사용자가 클릭 시 드롭다운 메뉴를 통해 원클릭으로 언어를 전환할 수 있도록 지원하며,
 * 선택된 언어 설정은 브라우저 `localStorage`에 영구 저장(`paycycle-locale`)되어 새로고침 후에도 유지됩니다.
 * ============================================================================
 */
export function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const { locale, setLocale, t } = useT();
  const current = LOCALES.find((l) => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.language")}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
            className ?? ""
          }`}
        >
          <Globe className="size-3.5 text-muted-foreground" />
          <span>{current?.label ?? "한국어"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36 rounded-2xl p-1.5 shadow-xl">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLocale(l.code as UiLocale)}
            className={`cursor-pointer rounded-xl px-3 py-2 text-xs transition-colors ${
              l.code === locale
                ? "font-bold text-primary bg-primary/10"
                : "text-foreground hover:bg-muted"
            }`}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
