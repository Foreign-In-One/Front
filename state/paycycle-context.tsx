"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  CalendarEvent,
  EmploymentProfile,
  ExitProfile,
  PayCycleState,
  PayRecord,
  TaxProfile,
  UserProfile,
} from "@/lib/paycycle/types";
import { EMPTY_DATE } from "@/lib/paycycle/types";
import { buildSampleState } from "@/lib/paycycle/sample";
import type { NewResult, ResultKind, SavedResult } from "@/lib/paycycle/results";
import { profileSignature } from "@/lib/paycycle/results";
import { currentUserId, latestOf, localResultRepository } from "@/lib/paycycle/repository";
import {
  getCalendarEventsApi,
  getPaychecksApi,
  getProfileApi,
  updateProfileApi,
} from "@/services/api";

const STORAGE_KEY = "paycycle-ai-state-v2";

export const initialEmployment: EmploymentProfile = {
  status: "EMPLOYED",
  entryDate: EMPTY_DATE,
  workStartDate: EMPTY_DATE,
  currentWorkplaceStartDate: EMPTY_DATE,
  exitDate: EMPTY_DATE,
  payDay: null,
  workplace: "",
  previousWorkplace: "",
};

const initialState: PayCycleState = {
  profile: null,
  employment: null,
  payRecords: [],
  events: [],
  taxProfile: {
    housingSaving: null,
    housingSavingProof: null,
    isHomeless: null,
    usesDeductions: null,
  },
  exitProfile: {
    hasInsuranceRecord: null,
    pensionDeducted: null,
    hasExitProof: null,
    hasRecentPayslip: null,
    hasOwnAccount: null,
  },
  sampleMode: false,
};

interface PayCycleContextValue {
  state: PayCycleState;
  hydrated: boolean;
  userId: string;
  saveProfile: (profile: UserProfile, employment: EmploymentProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateEmployment: (patch: Partial<EmploymentProfile>) => void;
  upsertPayRecord: (record: PayRecord) => void;
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  removeEvent: (id: string) => void;
  toggleEvent: (id: string) => void;
  updateTaxProfile: (patch: Partial<TaxProfile>) => void;
  updateExitProfile: (patch: Partial<ExitProfile>) => void;
  loadSample: () => void;
  resetAll: () => void;
  yearlyPay: number;
  monthsRecorded: number;
  totalMonths: number | null;
  currentPeriodRecord: PayRecord | undefined;
  results: SavedResult[];
  saveResult: (record: NewResult) => Promise<SavedResult>;
  removeResult: (id: string) => Promise<void>;
  latestResult: <K extends ResultKind>(kind: K) => Extract<SavedResult, { kind: K }> | undefined;
  signature: string;
  isStale: (record: SavedResult) => boolean;
  refreshFromBackend: () => Promise<void>;
}

const PayCycleContext = createContext<PayCycleContextValue | null>(null);

export function PayCycleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PayCycleState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState("local-user");
  const [results, setResults] = useState<SavedResult[]>([]);

  const refreshFromBackend = useCallback(async () => {
    try {
      const [{ profile }, { events: backendEvents }, { paychecks: backendPaychecks }] =
        await Promise.all([
          getProfileApi(),
          getCalendarEventsApi(),
          getPaychecksApi(),
        ]);

      const mappedEvents: CalendarEvent[] = (backendEvents || []).map((e) => {
        const datePart = e.startAt ? e.startAt.split("T")[0] : "";
        const timePart =
          e.startAt && e.startAt.includes("T") ? e.startAt.split("T")[1]?.slice(0, 5) : "09:00";
        return {
          id: `be-${e.eventId}`,
          title: e.title,
          type: e.eventType,
          date: datePart,
          time: timePart,
          description: e.description,
          completed: e.status === "COMPLETED",
          auto: e.sourceType !== "USER",
        };
      });

      const mappedRecords: PayRecord[] = (backendPaychecks || []).map((p) => {
        const isMatch = p.status === "NORMAL";
        const isEx = p.status === "EXPLANATION_REQUIRED";
        const workplaceName = profile.companyName || "한국정밀";
        const dateStr = p.paymentDate ? p.paymentDate.split("T")[0] : p.expectedPaymentDate;

        return {
          id: `be-pay-${p.paycheckId}`,
          period: p.payPeriod,
          workplace: workplaceName,
          checkedAt: dateStr,
          paidAmount: p.actualAmount,
          documents: {
            contract: {
              kind: "contract",
              source: "manual",
              fileName: "contract.pdf",
              fields: {
                period: p.payPeriod,
                basePay: p.contractAmount,
                allowances: null,
                deductions: null,
                netPay: p.contractAmount,
                payDay: profile.payday ?? 25,
                payDate: null,
              },
              confirmed: true,
              masked: false,
              note: `계약 기본급 ${p.contractAmount?.toLocaleString()}원`,
            },
            statement: {
              kind: "statement",
              source: "manual",
              fileName: "payslip.pdf",
              fields: {
                period: p.payPeriod,
                basePay: p.contractAmount,
                allowances: null,
                deductions: null,
                netPay: p.payslipAmount,
                payDay: null,
                payDate: p.expectedPaymentDate,
              },
              confirmed: true,
              masked: false,
              note: `명세서 실지급액 ${p.payslipAmount?.toLocaleString()}원`,
            },
            deposit: {
              kind: "deposit",
              source: "manual",
              fileName: "deposit.png",
              fields: {
                period: p.payPeriod,
                basePay: null,
                allowances: null,
                deductions: null,
                netPay: p.actualAmount,
                payDay: null,
                payDate: dateStr,
              },
              confirmed: true,
              masked: false,
              note: `실제 입금액 ${p.actualAmount?.toLocaleString()}원`,
            },
          },
          analysis: {
            overallStatus: isMatch ? "MATCH" : isEx ? "EXPLANATION_REQUIRED" : "INSUFFICIENT_DATA",
            headline: p.analysisSummary || `${p.payPeriod} 급여 분석 결과`,
            detail: p.nextAction || "",
            steps: [
              {
                label: "근로계약서 확인",
                ok: true,
                detail: `기본급 ${p.contractAmount?.toLocaleString()}원 대조`,
              },
              {
                label: "임금명세서 판독",
                ok: true,
                detail: `실지급액 ${p.payslipAmount?.toLocaleString()}원 대조`,
              },
              {
                label: "실입금액 대조",
                ok: isMatch,
                detail: `통장 입금액 ${p.actualAmount?.toLocaleString()}원 (${
                  p.differenceAmount !== 0
                    ? `${p.differenceAmount?.toLocaleString()}원 차이`
                    : "일치"
                })`,
              },
            ],
            findings: [
              {
                id: "net",
                status: isMatch ? "MATCH" : isEx ? "EXPLANATION_REQUIRED" : "INSUFFICIENT_DATA",
                title: isMatch
                  ? "계약서, 명세서, 실입금액 정상 일치"
                  : `실제 입금액과 명세서 간 ${Math.abs(
                      p.differenceAmount || 0
                    ).toLocaleString()}원 차액 발생`,
                fact: p.analysisSummary || "",
                standard: "근로기준법 제43조 (임금 지급의 원칙)",
                limitation: "",
                nextActions: p.nextAction ? [p.nextAction] : [],
                comparison: isMatch ? "MATCH" : "EXPLANATION_REQUIRED",
                left: { label: "임금명세서 실지급액", amount: p.payslipAmount || 0 },
                right: { label: "통장 실입금액", amount: p.actualAmount || 0 },
                difference: p.differenceAmount || 0,
                requiredEvidence: ["임금명세서 사본", "은행 통장 거래내역서"],
                sources: ["statement", "deposit"],
                evidence: [],
              },
            ],
            rows: [
              {
                item: "기본급",
                contract: `${p.contractAmount?.toLocaleString()}원`,
                statement: `${p.contractAmount?.toLocaleString()}원`,
                deposit: "—",
                result: `${p.contractAmount?.toLocaleString()}원 일치`,
                status: "MATCH",
              },
              {
                item: "실지급액",
                contract: "—",
                statement: `${p.payslipAmount?.toLocaleString()}원`,
                deposit: `${p.actualAmount?.toLocaleString()}원`,
                result: isMatch
                  ? "정상 일치"
                  : `${Math.abs(p.differenceAmount || 0).toLocaleString()}원 차이`,
                status: isMatch ? "MATCH" : "EXPLANATION_REQUIRED",
              },
            ],
          },
        };
      });

      setState((prev) => {
        const prevRecordsMap = new Map(prev.payRecords.map((r) => [r.id, r]));
        const prevRecordsByPeriod = new Map(prev.payRecords.map((r) => [r.period, r]));
        const existingRecordKeys = new Set(mappedRecords.map((r) => r.period || r.id));
        const preservedRecords = mappedRecords.map((r) => {
          const local = prevRecordsMap.get(r.id) || (r.period ? prevRecordsByPeriod.get(r.period) : undefined);
          return local ? { ...r, ...local, analysis: r.analysis || local.analysis } : r;
        });
        const mergedRecords = [
          ...preservedRecords,
          ...prev.payRecords.filter((r) => !existingRecordKeys.has(r.period || r.id)),
        ];

        const prevEventsMap = new Map(prev.events.map((e) => [e.id, e]));
        const existingEventIds = new Set(mappedEvents.map((e) => e.id));
        const preservedEvents = mappedEvents.map((e) => {
          const local = prevEventsMap.get(e.id);
          return local ? { ...e, completed: local.completed ?? e.completed } : e;
        });
        const mergedEvents = [
          ...preservedEvents,
          ...prev.events.filter((e) => !existingEventIds.has(e.id)),
        ];

        return {
          ...prev,
          events: mergedEvents.length > 0 ? mergedEvents : prev.events,
          payRecords: mergedRecords.length > 0 ? mergedRecords : prev.payRecords,
          profile: profile?.name
            ? {
                nickname: profile.name,
                nationality: profile.nationality,
                visa: profile.visaType,
                language: (profile.language || prev.profile?.language || "ko") as any,
              }
            : prev.profile,
          employment: profile?.companyName
            ? {
                status: (profile.employmentStatus as any) || "EMPLOYED",
                entryDate: { value: profile.entryDate ?? "", unknown: !profile.entryDate },
                workStartDate: { value: profile.workStartDate ?? "", unknown: !profile.workStartDate },
                currentWorkplaceStartDate: {
                  value: profile.workStartDate ?? "",
                  unknown: !profile.workStartDate,
                },
                exitDate: { value: profile.expectedExitDate ?? "", unknown: !profile.expectedExitDate },
                payDay: profile.payday ?? 25,
                workplace: profile.companyName ?? "",
                previousWorkplace: "",
              }
            : prev.employment,
        };
      });
    } catch {
      /* 실패 시 기본값 유지 */
    }
  }, []);

  // 초기화: LocalStorage 및 Spring Boot 백엔드 API에서 최신 데이터 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((prev) => ({
          ...prev,
          ...parsed,
          payRecords: parsed.payRecords?.length ? parsed.payRecords : prev.payRecords,
          events: parsed.events?.length ? parsed.events : prev.events,
        }));
      }
    } catch {
      /* ignore */
    }

    async function init() {
      // 로컬 스토리지 복원은 이미 완료되었으므로 화면 차단을 방지하기 위해 즉시 hydrated 설정
      setHydrated(true);
      try {
        await refreshFromBackend();
      } catch (err) {
        console.warn("Backend refresh failed during init:", err);
      }
    }

    void init();
    const uid = currentUserId();
    setUserId(uid);
    void localResultRepository.list(uid).then(setResults);
  }, [refreshFromBackend]);

  // State 변경 시 LocalStorage에 자동 저장
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const saveProfile = useCallback((profile: UserProfile, employment: EmploymentProfile) => {
    setState((prev) => ({ ...prev, profile, employment, sampleMode: false }));
    // Spring Boot 백엔드 API 저장 (PATCH /api/profile)
    void updateProfileApi({
      employmentStatus: employment.status,
      companyName: employment.workplace,
      payday: employment.payDay ?? 25,
      expectedExitDate: employment.exitDate.value || null,
      language: profile.language || "ko",
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setState((prev) => {
      if (!prev.profile) return prev;
      const nextProfile = { ...prev.profile, ...patch };
      return { ...prev, profile: nextProfile };
    });
  }, []);

  const updateEmployment = useCallback((patch: Partial<EmploymentProfile>) => {
    setState((prev) => {
      if (!prev.employment) return prev;
      const nextEmp = { ...prev.employment, ...patch };
      return { ...prev, employment: nextEmp };
    });
  }, []);

  const upsertPayRecord = useCallback((record: PayRecord) => {
    setState((prev) => {
      const exists = prev.payRecords.some((r) => r.id === record.id || r.period === record.period);
      const nextRecords = exists
        ? prev.payRecords.map((r) => (r.id === record.id || r.period === record.period ? record : r))
        : [record, ...prev.payRecords];
      return { ...prev, payRecords: nextRecords };
    });
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, "id">) => {
    setState((prev) => {
      const exists = prev.events.find(
        (e) =>
          e.date === event.date &&
          e.type === event.type &&
          e.title === event.title &&
          (e.time || "") === (event.time || "")
      );
      if (exists) {
        return {
          ...prev,
          events: prev.events.map((e) => (e.id === exists.id ? { ...e, ...event } : e)),
        };
      }
      const newEvt: CalendarEvent = { ...event, id: `evt-${Date.now()}` };
      return { ...prev, events: [newEvt, ...prev.events] };
    });
  }, []);

  const removeEvent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
  }, []);

  const toggleEvent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)),
    }));
  }, []);

  const updateTaxProfile = useCallback((patch: Partial<TaxProfile>) => {
    setState((prev) => ({ ...prev, taxProfile: { ...prev.taxProfile, ...patch } }));
  }, []);

  const updateExitProfile = useCallback((patch: Partial<ExitProfile>) => {
    setState((prev) => ({ ...prev, exitProfile: { ...prev.exitProfile, ...patch } }));
  }, []);

  const loadSample = useCallback(() => {
    setState(buildSampleState());
  }, []);

  const resetAll = useCallback(() => {
    setState(initialState);
  }, []);

  const yearlyPay = useMemo(() => {
    return state.payRecords.reduce((acc, r) => acc + (r.documents.statement?.fields?.netPay ?? r.paidAmount ?? 0), 0);
  }, [state.payRecords]);

  const monthsRecorded = state.payRecords.length;
  const totalMonths = null;
  const currentPeriodRecord = state.payRecords[0];

  const saveResult = useCallback(async (record: NewResult) => {
    const saved = await localResultRepository.save(record);
    setResults((prev) => [...prev.filter((r) => r.id !== saved.id), saved]);
    return saved;
  }, []);

  const removeResult = useCallback(async (id: string) => {
    await localResultRepository.remove(id);
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const latestResult = useCallback(
    <K extends ResultKind>(kind: K) => {
      return latestOf(results, kind);
    },
    [results]
  );

  const signature = useMemo(() => {
    return profileSignature(state.profile, state.employment);
  }, [state.profile, state.employment]);

  const isStale = useCallback(
    (record: SavedResult) => {
      return record.profileSignature !== signature;
    },
    [signature]
  );

  const value = useMemo(
    () => ({
      state,
      hydrated,
      userId,
      saveProfile,
      updateProfile,
      updateEmployment,
      upsertPayRecord,
      addEvent,
      removeEvent,
      toggleEvent,
      updateTaxProfile,
      updateExitProfile,
      loadSample,
      resetAll,
      yearlyPay,
      monthsRecorded,
      totalMonths,
      currentPeriodRecord,
      results,
      saveResult,
      removeResult,
      latestResult,
      signature,
      isStale,
      refreshFromBackend,
    }),
    [
      state,
      hydrated,
      userId,
      saveProfile,
      updateProfile,
      updateEmployment,
      upsertPayRecord,
      addEvent,
      removeEvent,
      toggleEvent,
      updateTaxProfile,
      updateExitProfile,
      loadSample,
      resetAll,
      yearlyPay,
      monthsRecorded,
      totalMonths,
      currentPeriodRecord,
      results,
      saveResult,
      removeResult,
      latestResult,
      signature,
      isStale,
      refreshFromBackend,
    ]
  );

  return <PayCycleContext.Provider value={value}>{children}</PayCycleContext.Provider>;
}

export function usePayCycle() {
  const context = useContext(PayCycleContext);
  if (!context) {
    throw new Error("usePayCycle must be used within a PayCycleProvider");
  }
  return context;
}
