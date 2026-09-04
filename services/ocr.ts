import {
  uploadDocumentApi,
  runDocumentOcrApi,
  type DocumentTypeEnum,
  type CandidateAmountDto,
} from "@/services/api";
import type { DocFields, DocKind } from "@/lib/paycycle/types";
import { emptyFields } from "@/lib/paycycle/types";

export interface OcrResult {
  ok: boolean;
  /** 백엔드 업로드된 Document ID */
  documentId?: number;
  /** 실제 AI 판독이 아니라 샘플(Mock) 값인지 */
  mock: boolean;
  fields: DocFields;
  candidateAmounts?: CandidateAmountDto[];
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
        documentId: docId,
        mock: uploadRes.isMock || ocrRes.isMock,
        fields,
        candidateAmounts: (ext.candidateAmounts && ext.candidateAmounts.length > 0)
          ? ext.candidateAmounts.map((c) => {
              let targetField = c.targetField;
              if (!targetField) {
                const norm = (c.label || "").trim().toLowerCase();
                if (norm.includes("기본급") || norm.includes("base") || norm.includes("월급")) {
                  targetField = "basePay";
                } else if (norm.includes("실지급") || norm.includes("실수령") || norm.includes("차인지급") || norm.includes("net") || norm.includes("입금")) {
                  targetField = "netPay";
                } else if (norm.includes("수당") || norm.includes("연장") || norm.includes("식대")) {
                  targetField = "allowances";
                } else if (norm.includes("공제")) {
                  targetField = "deductions";
                }
              }
              return { ...c, targetField };
            })
          : (ext.baseSalary || ext.netPay || ext.overtimeAllowance || ext.deduction || ext.totalPayment ? [
              ...(ext.baseSalary ? [{ label: "기본급", amount: ext.baseSalary, targetField: "basePay" as const }] : []),
              ...(ext.overtimeAllowance ? [{ label: "연장근로수당", amount: ext.overtimeAllowance, targetField: "allowances" as const }] : []),
              ...(ext.totalPayment ? [{ label: "지급총액", amount: ext.totalPayment }] : []),
              ...(ext.deduction ? [{ label: "공제총액", amount: ext.deduction, targetField: "deductions" as const }] : []),
              ...(ext.netPay ? [{ label: "실지급액", amount: ext.netPay, targetField: "netPay" as const }] : []),
            ] : undefined),
        confidence: ocrRes.data.ocrStatus === "SUCCESS" || ocrRes.data.ocrStatus === "COMPLETED" ? "high" : "low",
        message: `${file.name} OCR 판독이 완료되었습니다.`,
      };
    } catch (err) {
      console.error("Document OCR failed:", err);
      return {
        ok: false,
        mock: false,
        fields: emptyFields(period),
        confidence: "low",
        message: err instanceof Error ? err.message : "문서 판독에 실패했습니다.",
      };
    }
  }

  return {
    ok: false,
    mock: false,
    fields: emptyFields(period),
    confidence: "low",
    message: "업로드된 문서가 없습니다.",
  };
}
