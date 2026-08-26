import {
  readDocumentOcrApi,
  uploadDocumentApi,
  runDocumentOcrApi,
  type DocumentTypeEnum,
} from "@/services/api";
import type { DocFields, DocKind } from "@/lib/paycycle/types";
import { emptyFields } from "@/lib/paycycle/types";

export interface OcrResult {
  ok: boolean;
  /** 실제 AI 판독이 아니라 샘플(Mock) 값인지 */
  mock: boolean;
  fields: DocFields;
  confidence: "high" | "low";
  message: string;
}

const KIND_TO_DOC_TYPE: Record<DocKind, DocumentTypeEnum> = {
  contract: "EMPLOYMENT_CONTRACT",
  statement: "PAYSLIP",
  deposit: "BANK_RECEIPT",
};

export async function readDocument(input: {
  kind: DocKind;
  file?: File;
  dataUrl?: string;
  period: string;
  useMock?: boolean;
}): Promise<OcrResult> {
  const { kind, file, dataUrl, period, useMock } = input;

  // 1. 실제 파일이 제공되고 Mock 모드가 아닌 경우 백엔드 실제 Document AI / OCR 호출
  if (file && !useMock) {
    try {
      const docType = KIND_TO_DOC_TYPE[kind];
      // Step A: 문서 업로드
      const uploadRes = await uploadDocumentApi(file, docType);
      const docId = uploadRes.data.documentId;

      // Step B: OCR 실행 및 필드 추출
      const ocrRes = await runDocumentOcrApi(docId);
      const ext = ocrRes.data.extractedData;

      const fields: DocFields = {
        period: ext.payPeriod || period,
        basePay: ext.baseSalary ?? null,
        allowances: ext.overtimeAllowance ?? null,
        deductions: ext.deduction ?? null,
        netPay: ext.netPay ?? ext.depositAmount ?? null,
        payDay: ext.payday ?? (kind === "contract" ? 25 : null),
        payDate: ext.paymentDate ?? ext.depositDate ?? null,
      };

      return {
        ok: true,
        mock: uploadRes.isMock || ocrRes.isMock,
        fields,
        confidence: ocrRes.data.ocrStatus === "SUCCESS" ? "high" : "low",
        message: `${file.name} OCR 판독이 완료되었습니다.`,
      };
    } catch (err) {
      console.warn("Real document OCR failed, falling back to local extractor:", err);
    }
  }

  // 2. Mock 또는 fallback 판독
  const res = await readDocumentOcrApi({ kind, dataUrl, period });
  return {
    ok: res.ok,
    mock: res.mock,
    fields: res.fields,
    confidence: res.confidence,
    message: res.message,
  };
}
