import { readDocumentOcrApi } from "@/services/api";
import type { DocFields, DocKind } from "@/lib/paycycle/types";

export interface OcrResult {
  ok: boolean;
  /** 실제 AI 판독이 아니라 샘플(Mock) 값인지 */
  mock: boolean;
  fields: DocFields;
  confidence: "high" | "low";
  message: string;
}

export async function readDocument(input: {
  kind: DocKind;
  dataUrl: string;
  period: string;
  useMock?: boolean;
}): Promise<OcrResult> {
  const { kind, dataUrl, period } = input;
  const res = await readDocumentOcrApi({ kind, dataUrl, period });
  return {
    ok: res.ok,
    mock: res.mock,
    fields: res.fields,
    confidence: res.confidence,
    message: res.message,
  };
}
