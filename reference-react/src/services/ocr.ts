import { extractDocumentFields } from "@/lib/paycycle/ai.functions";
import { emptyFields } from "@/lib/paycycle/types";
import type { DocFields, DocKind } from "@/lib/paycycle/types";
import { payDayIso } from "@/lib/paycycle/format";

export interface OcrResult {
  ok: boolean;
  /** 실제 AI 판독이 아니라 샘플(Mock) 값인지 */
  mock: boolean;
  fields: DocFields;
  confidence: "high" | "low";
  message: string;
}

/**
 * 문서 판독 서비스.
 * 1순위: Lovable AI 게이트웨이 멀티모달 판독(별도 키 불필요)
 * 실패 시: 값 없는 폼으로 되돌려 사용자가 직접 입력 (없는 값을 추정하지 않는다)
 * 샘플 모드에서는 데모용 Mock 값을 반환한다.
 */
export async function readDocument(input: {
  kind: DocKind;
  dataUrl: string;
  period: string;
  useMock?: boolean;
}): Promise<OcrResult> {
  const { kind, dataUrl, period, useMock } = input;

  if (useMock) {
    return {
      ok: true,
      mock: true,
      fields: mockFields(kind, period),
      confidence: "low",
      message: "샘플 판독 값입니다. 실제 자료의 값으로 수정해 주세요.",
    };
  }

  try {
    const result = await extractDocumentFields({ data: { kind, dataUrl, period } });
    if (result.ok && result.fields) {
      return {
        ok: true,
        mock: false,
        fields: { ...result.fields, period },
        confidence: result.confidence,
        message:
          result.confidence === "low"
            ? "AI가 읽었지만 확신이 낮습니다. 값을 꼭 확인해 주세요."
            : "AI가 문서에서 읽은 값입니다. 확인 후 저장해 주세요.",
      };
    }
    return {
      ok: false,
      mock: false,
      fields: emptyFields(period),
      confidence: "low",
      message: result.error ?? "판독에 실패했습니다. 값을 직접 입력해 주세요.",
    };
  } catch {
    return {
      ok: false,
      mock: false,
      fields: emptyFields(period),
      confidence: "low",
      message: "판독 서버에 연결하지 못했습니다. 값을 직접 입력해 주세요.",
    };
  }
}

function mockFields(kind: DocKind, period: string): DocFields {
  const base = emptyFields(period);
  if (kind === "contract") {
    return { ...base, basePay: 2_200_000, allowances: 0, payDay: 25 };
  }
  if (kind === "statement") {
    return {
      ...base,
      basePay: 2_200_000,
      allowances: 380_000,
      deductions: 200_000,
      netPay: 2_380_000,
      payDate: payDayIso(period, 25),
    };
  }
  return { ...base, netPay: 2_260_000, payDate: payDayIso(period, 27) };
}
