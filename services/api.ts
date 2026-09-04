import { payDayIso } from '@/lib/paycycle/format';
import type { DocFields, DocKind } from '@/lib/paycycle/types';
import { emptyFields } from '@/lib/paycycle/types';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

/** 백엔드 표준 ApiResponse 래퍼 인터페이스 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

/** Spring Boot 백엔드 Profile DTO 규격 */
export interface ProfileResponseDto {
  userId: number;
  name: string;
  phone: string;
  nationality: string;
  visaType: string;
  entryDate: string | null;
  employmentStatus: string;
  companyName: string;
  workStartDate: string | null;
  payday: number;
  expectedExitDate: string | null;
  language: string;
}

export interface ProfileUpdateRequestDto {
  name?: string;
  nationality?: string;
  visaType?: string;
  entryDate?: string | null;
  employmentStatus?: string;
  companyName?: string;
  workStartDate?: string | null;
  payday?: number;
  expectedExitDate?: string | null;
  language?: string;
}

/** Spring Boot 백엔드 Calendar Event DTO 규격 */
export interface CalendarEventResponseDto {
  eventId: number;
  eventType: 'PAYDAY' | 'PAYCHECK' | 'TAX' | 'EXIT' | 'PERSONAL';
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  sourceType?: string;
  sourceId?: number;
  status?: string;
}

/** Spring Boot 백엔드 Paycheck DTO 규격 */
export interface PaycheckResponseDto {
  paycheckId: number;
  payPeriod: string;
  contractAmount: number;
  payslipAmount: number;
  actualAmount: number;
  differenceAmount: number;
  expectedPaymentDate: string;
  paymentDate: string;
  status:
    | 'NORMAL'
    | 'EXPLANATION_REQUIRED'
    | 'INSUFFICIENT_DATA'
    | 'CONFIRMATION_REQUIRED'
    | 'NOT_RECEIVED';
  analysisSummary?: string;
  nextAction?: string;
}

export interface PaycheckAnalyzeRequestDto {
  payPeriod: string;
  contractAmount?: number;
  payslipAmount?: number;
  actualAmount?: number;
  differenceAmount?: number;
  expectedPaymentDate?: string;
  paymentDate?: string;
  transactionId?: number;
  contractDocumentId?: number;
  payslipDocumentId?: number;
  bankReceiptDocumentId?: number;
}

export interface EmployerQuestionCardDto {
  language?: string;
  title?: string;
  koreanScript: string;
  nativeScript: string;
}

export interface PaycheckExplainResponseDto {
  paycheckId?: number;
  caseType?: string;
  summary: string;
  reasons: string[];
  nextActions: string[];
  employerQuestionCards?: EmployerQuestionCardDto[];
}

export type DocumentTypeEnum =
  | 'EMPLOYMENT_CONTRACT'
  | 'PAYSLIP'
  | 'BANK_RECEIPT'
  | 'TAX_DOCUMENT'
  | 'INSURANCE_DOCUMENT'
  | 'PENSION_DOCUMENT'
  | 'OTHER';

export interface DocumentUploadResponseDto {
  documentId: number;
  fileName?: string;
  documentType: DocumentTypeEnum;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'SUCCESS' | 'FAILED';
  createdAt?: string;
}

export interface CandidateAmountDto {
  label: string;
  amount: number;
  targetField?: keyof Omit<DocFields, 'period'>;
}

export interface DocumentOcrExtractedDataDto {
  payPeriod?: string;
  baseSalary?: number;
  totalPayment?: number;
  overtimeAllowance?: number;
  deduction?: number;
  netPay?: number;
  companyName?: string;
  paymentDate?: string;
  payday?: number;
  workStartDate?: string;
  contractDurationMonths?: number;
  bankName?: string;
  depositAmount?: number;
  depositDate?: string;
  sender?: string;
  candidateAmounts?: CandidateAmountDto[];
  [key: string]: any;
}

export interface DocumentOcrResponseDto {
  documentId: number;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'SUCCESS' | 'FAILED';
  extractedData: DocumentOcrExtractedDataDto;
}

export interface MockBankTransactionDto {
  bankTranId: string;
  bankTranDate: string;
  tranTime: string;
  inoutType: string;
  tranType: string;
  printedContent: string;
  tranAmt: string;
  afterBalanceAmt: string;
  branchName: string;
  bankName: string;
  fintechUseNum: string;
}

export interface MockBankResponseDto {
  apiTranId: string;
  rspCode: string;
  resList: MockBankTransactionDto[];
}

/** 급여 자동 감지 모니터링 배치 응답 DTO (`POST /api/batch/salary-monitoring`) */
export interface BatchSalaryMonitoringResponseDto {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
}

export interface OcrRequestDto {
  kind: DocKind;
  dataUrl?: string;
  period: string;
}

export interface OcrResponseDto {
  ok: boolean;
  mock: boolean;
  confidence: 'high' | 'low';
  message: string;
  fields: DocFields;
  candidateAmounts?: CandidateAmountDto[];
}

export interface AiTranslateRequestDto {
  korean: string;
  targetLanguage: string;
}

export interface AiTranslateResponseDto {
  ok: boolean;
  mock: boolean;
  text: string;
}

export interface AgentChatResponseDto {
  ok: boolean;
  text: string | null;
  error: string | null;
}

/**
 * API 호출 헬퍼: 백엔드 접속 가능 시 Spring Boot API 사용 (ApiResponse unwrapping 지원),
 * 미실행/실패 시 DTO와 100% 동일한 Fallback 데이터 반환
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackData?: T,
): Promise<{ data: T; isMock: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Demo-User-Id': '1',
        ...options?.headers,
      },
      ...options,
    });
    if (res.ok) {
      const json = await res.json();
      if (
        json &&
        typeof json === 'object' &&
        'success' in json &&
        'data' in json
      ) {
        return { data: json.data as T, isMock: false };
      }
      return { data: json as T, isMock: false };
    }
  } catch {
    /* 백엔드 미실행 시 Fallback 처리 */
  }

  if (fallbackData !== undefined) {
    return { data: fallbackData, isMock: true };
  }
  throw new Error(`API call failed to ${endpoint} and no fallback provided.`);
}

/** 프로필 정보 백엔드 조회 (`GET /api/profile`) */
export async function getProfileApi(): Promise<{
  profile: ProfileResponseDto;
  isMock: boolean;
}> {
  const res = await fetchApi<ProfileResponseDto>(
    '/api/profile',
    { method: 'GET' },
  );

  return {
    profile: res.data,
    isMock: false,
  };
}

/** 프로필 정보 백엔드 수정 (`PATCH /api/profile`) */
export async function updateProfileApi(
  payload: ProfileUpdateRequestDto,
): Promise<{ success: boolean; data?: ProfileResponseDto; isMock: boolean }> {
  const res = await fetchApi<ProfileResponseDto>(
    '/api/profile',
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return { success: true, data: res.data, isMock: false };
}

/** 캘린더 이벤트 백엔드 조회 (`GET /api/calendar/events`) */
export async function getCalendarEventsApi(
  from?: string,
  to?: string,
): Promise<{
  events: CalendarEventResponseDto[];
  isMock: boolean;
}> {
  const query = from && to ? `?from=${from}&to=${to}` : '';
  const res = await fetchApi<CalendarEventResponseDto[]>(
    `/api/calendar/events${query}`,
    { method: 'GET' },
    [],
  );

  return { events: res.data || [], isMock: false };
}

/** PayCheck 검증 기록 조회 (`GET /api/paychecks`) */
export async function getPaychecksApi(
  from?: string,
  to?: string,
): Promise<{
  paychecks: PaycheckResponseDto[];
  isMock: boolean;
}> {
  const query = from && to ? `?from=${from}&to=${to}` : '';
  const res = await fetchApi<PaycheckResponseDto[]>(
    `/api/paychecks${query}`,
    { method: 'GET' },
    [],
  );
  return { paychecks: res.data, isMock: res.isMock };
}

/** PayCheck 분석 실행 (`POST /api/paychecks/analyze`) */
export async function analyzePaycheckApi(
  payload: PaycheckAnalyzeRequestDto,
): Promise<{ paycheck: PaycheckResponseDto; isMock: boolean }> {
  const res = await fetchApi<PaycheckResponseDto>(
    '/api/paychecks/analyze',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return { paycheck: res.data, isMock: false };
}

/** PayCheck AI 이상징후 원인 설명 및 사장님 질문카드 생성 (`POST /api/paychecks/{paycheckId}/explain`) */
export async function explainPaycheckApi(
  paycheckId: number,
  options?: {
    locale?: string;
    workplace?: string;
    finding?: any;
    period?: string;
  },
): Promise<{
  data: PaycheckExplainResponseDto;
  isMock: boolean;
}> {
  const res = await fetchApi<PaycheckExplainResponseDto>(
    `/api/paychecks/${paycheckId}/explain`,
    {
      method: 'POST',
      body: JSON.stringify(options || {}),
    },
  );
  return { data: res.data, isMock: false };
}

/** 1) 문서 업로드 API (`POST /api/documents`) */
export async function uploadDocumentApi(
  file: File,
  documentType: DocumentTypeEnum,
): Promise<{ data: DocumentUploadResponseDto; isMock: boolean }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);

    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'X-Demo-User-Id': '1',
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload document: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data =
      json && typeof json === 'object' && 'success' in json && 'data' in json
        ? (json.data as DocumentUploadResponseDto)
        : (json as DocumentUploadResponseDto);

    return { data, isMock: false };
  } catch (err) {
    throw err instanceof Error ? err : new Error('Document upload failed');
  }
}

/** 2) OCR 실행 및 필드 추출 API (`POST /api/documents/{documentId}/ocr`) */
export async function runDocumentOcrApi(documentId: number): Promise<{
  data: DocumentOcrResponseDto;
  isMock: boolean;
}> {
  const res = await fetchApi<DocumentOcrResponseDto>(
    `/api/documents/${documentId}/ocr`,
    { method: 'POST' },
  );
  return { data: res.data, isMock: false };
}

/** 3) OCR 추출 데이터 수정 API (`PATCH /api/documents/{documentId}/extracted-data`) */
export async function updateDocumentExtractedDataApi(
  documentId: number,
  extractedData: DocumentOcrExtractedDataDto,
): Promise<{ data: DocumentOcrResponseDto; isMock: boolean }> {
  const res = await fetchApi<DocumentOcrResponseDto>(
    `/api/documents/${documentId}/extracted-data`,
    {
      method: 'PATCH',
      body: JSON.stringify({ extractedData }),
    },
  );
  return { data: res.data, isMock: false };
}

/** 캘린더 개인 일정 등록 (`POST /api/calendar/events`) */
export async function createCalendarEventApi(payload: {
  title: string;
  eventType: 'PAYDAY' | 'PAYCHECK' | 'TAX' | 'EXIT' | 'PERSONAL';
  startAt: string;
  endAt?: string;
  description?: string;
  sourceType?: string;
  sourceId?: number;
}): Promise<{ data: CalendarEventResponseDto; isMock: boolean }> {
  const bodyPayload = {
    ...payload,
    endAt: payload.endAt || payload.startAt,
  };

  const res = await fetchApi<CalendarEventResponseDto>(
    '/api/calendar/events',
    { method: 'POST', body: JSON.stringify(bodyPayload) },
  );
  return { data: res.data, isMock: false };
}

/** 캘린더 일정 수정 (`PATCH /api/calendar/events/{eventId}`) */
export async function updateCalendarEventApi(
  eventId: number,
  payload: Partial<CalendarEventResponseDto>,
): Promise<{ data: CalendarEventResponseDto; isMock: boolean }> {
  const res = await fetchApi<CalendarEventResponseDto>(
    `/api/calendar/events/${eventId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
  return { data: res.data, isMock: false };
}

/** 캘린더 일정 삭제 (`DELETE /api/calendar/events/{eventId}`) */
export async function deleteCalendarEventApi(eventId: number): Promise<{
  success: boolean;
  isMock: boolean;
}> {
  const res = await fetchApi<any>(
    `/api/calendar/events/${eventId}`,
    { method: 'DELETE' },
    { success: true },
  );
  return { success: true, isMock: res.isMock };
}

/** [개발 편의] 시드 데이터 초기화 (`POST /api/dev/reset-seed`) */
export async function resetSeedDataApi(): Promise<{
  success: boolean;
  isMock: boolean;
}> {
  const res = await fetchApi<any>(
    '/api/dev/reset-seed',
    { method: 'POST' },
    { success: true },
  );
  return { success: true, isMock: res.isMock };
}

/** [데모/수동 시뮬레이션] 급여 자동 감지 모니터링 배치 실행 (`POST /api/batch/salary-monitoring`) */
export async function triggerSalaryMonitoringBatchApi(
  userId?: number,
): Promise<{
  result: BatchSalaryMonitoringResponseDto;
  isMock: boolean;
}> {
  const query = userId ? `?userId=${userId}` : '';
  const fallbackResult: BatchSalaryMonitoringResponseDto = {
    processedCount: 3,
    createdCount: 1,
    updatedCount: 2,
  };

  const res = await fetchApi<BatchSalaryMonitoringResponseDto>(
    `/api/batch/salary-monitoring${query}`,
    { method: 'POST' },
    fallbackResult,
  );

  return { result: res.data, isMock: res.isMock };
}

/** Mock Bank 거래내역 조회 (`GET /api/mock/bank/transactions`) */
export async function getMockBankTransactionsApi(
  from?: string,
  to?: string,
): Promise<{
  transactions: MockBankResponseDto;
  isMock: boolean;
}> {
  const query = from && to ? `?from=${from}&to=${to}` : '';
  const res = await fetchApi<MockBankResponseDto>(
    `/api/mock/bank/transactions${query}`,
    { method: 'GET' },
    {
      apiTranId: 'mock-001',
      rspCode: 'A0000',
      resList: [
        {
          bankTranId: 'F123456789U4BC34239Z002',
          bankTranDate: '20260825',
          tranTime: '091400',
          inoutType: '입금',
          tranType: '급여',
          printedContent: '한국정밀 8월 급여',
          tranAmt: '2260000',
          afterBalanceAmt: '6760000',
          branchName: '분당점',
          bankName: '하나은행',
          fintechUseNum: '123456789012345678901234',
        },
      ],
    },
  );
  return { transactions: res.data, isMock: res.isMock };
}

/** OCR 판독 API 서비스 */
export async function readDocumentOcrApi(
  req: OcrRequestDto,
): Promise<OcrResponseDto> {
  const base = emptyFields(req.period);
  let mockFields: DocFields = base;
  let candidates: CandidateAmountDto[] = [];

  if (req.kind === 'contract') {
    mockFields = { ...base, basePay: 2_200_000, allowances: 0, payDay: 25 };
    candidates = [
      { label: '기본급', amount: 2_200_000, targetField: 'basePay' },
      { label: '식대보조', amount: 150_000, targetField: 'allowances' },
      { label: '월급여총액', amount: 2_350_000 },
    ];
  } else if (req.kind === 'statement') {
    mockFields = {
      ...base,
      basePay: 2_200_000,
      allowances: 380_000,
      deductions: 200_000,
      netPay: 2_380_000,
      payDate: payDayIso(req.period, 25),
    };
    candidates = [
      { label: '기본급', amount: 2_200_000, targetField: 'basePay' },
      { label: '연장근로수당', amount: 380_000, targetField: 'allowances' },
      { label: '지급총액', amount: 2_580_000 },
      { label: '공제총액', amount: 200_000, targetField: 'deductions' },
      { label: '실지급액', amount: 2_380_000, targetField: 'netPay' },
    ];
  } else {
    mockFields = {
      ...base,
      netPay: 2_260_000,
      payDate: payDayIso(req.period, 27),
    };
    candidates = [
      { label: '실입금액', amount: 2_260_000, targetField: 'netPay' },
    ];
  }

  return {
    ok: true,
    mock: true,
    confidence: 'low',
    message: '판독이 완료되었습니다. 필요시 값을 수정해 주세요.',
    fields: mockFields,
    candidateAmounts: candidates,
  };
}

/** AI 번역 API 서비스 */
export async function translateAiApi(
  req: AiTranslateRequestDto,
): Promise<AiTranslateResponseDto> {
  return {
    ok: true,
    mock: true,
    text: req.korean,
  };
}

/** 챗봇 질문 응답 (백엔드 POST /api/agent/chat 연동, 서버가 직접 사용자 데이터로 컨텍스트 구성) */
export async function chatAssistantApi(
  question: string,
  locale?: string,
): Promise<{ data: AgentChatResponseDto; isMock: boolean }> {
  const fallback: AgentChatResponseDto = { ok: false, text: null, error: null };
  const res = await fetchApi<AgentChatResponseDto>(
    '/api/agent/chat',
    { method: 'POST', body: JSON.stringify({ question, locale }) },
    fallback,
  );
  return { data: res.data, isMock: res.isMock };
}

/** ExitCheck 분석 요청 DTO */
export interface ExitCheckAnalyzeRequestDto {
  expectedExitDate?: string;
  hasInsuranceRecord?: boolean | null;
  hasOwnAccount?: boolean | null;
  hasExitProof?: boolean | null;
  pensionDeducted?: boolean | null;
  hasRecentPayslip?: boolean | null;
  exitDocumentId?: number;
}

/** ExitCheck 분석 응답 DTO */
export interface ExitCheckResponseDto {
  exitCheckId: number;
  expectedExitDate: string;
  workDurationMonths: number;
  insuranceStatus: string;
  pensionStatus: string;
  retirementStatus: string;
  readinessScore: number;
  status: string;
  analysisSummary: string;
  nextAction: string;
}

/** 출국 정산 분석 API (`POST /api/exit-checks/analyze`) */
export async function analyzeExitCheckApi(
  payload: ExitCheckAnalyzeRequestDto,
): Promise<{ data: ExitCheckResponseDto; isMock: boolean }> {
  const res = await fetchApi<ExitCheckResponseDto>(
    '/api/exit-checks/analyze',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return { data: res.data, isMock: false };
}

