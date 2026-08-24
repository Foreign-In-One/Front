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
import { isoDate, payDayIso, periodOf, uid } from "@/lib/paycycle/format";
import { buildSampleState } from "@/lib/paycycle/sample";
import { monthsWorked } from "@/lib/paycycle/rule-engine";
import type { NewResult, ResultKind, SavedResult } from "@/lib/paycycle/results";
import { profileSignature } from "@/lib/paycycle/results";
import { currentUserId, latestOf, localResultRepository } from "@/lib/paycycle/repository";

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
  updateTaxProfile: (patch: Partial<TaxProfile>) => void;
  updateExitProfile: (patch: Partial<ExitProfile>) => void;
  loadSample: () => void;
  resetAll: () => void;
  yearlyPay: number;
  monthsRecorded: number;
  totalMonths: number | null;
  currentPeriodRecord: PayRecord | undefined;
  /* 저장된 분석 결과 */
  results: SavedResult[];
  saveResult: (record: NewResult) => Promise<SavedResult>;
  removeResult: (id: string) => Promise<void>;
  latestResult: <K extends ResultKind>(kind: K) => Extract<SavedResult, { kind: K }> | undefined;
  signature: string;
  isStale: (record: SavedResult) => boolean;
}


const PayCycleContext = createContext<PayCycleContextValue | null>(null);

export function PayCycleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PayCycleState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState("local-user");
  const [results, setResults] = useState<SavedResult[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...(JSON.parse(raw) as PayCycleState) });
    } catch {
      /* 저장된 데이터가 손상된 경우 초기값 사용 */
    }
    const id = currentUserId();
    setUserId(id);
    void localResultRepository.list(id).then(setResults);
    setHydrated(true);
  }, []);


  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [state, hydrated]);

  const addEvent = useCallback((event: Omit<CalendarEvent, "id">) => {
    setState((prev) => ({ ...prev, events: [...prev.events, { ...event, id: uid("ev") }] }));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setState((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== id) }));
  }, []);

  const saveProfile = useCallback((profile: UserProfile, employment: EmploymentProfile) => {
    setState((prev) => {
      const events = prev.events.filter((e) => e.source !== "profile");
      events.push({
        id: uid("ev"),
        date: isoDate(new Date()),
        category: "프로필",
        source: "profile",
        title: "금융권리 프로필 저장",
        detail: `${profile.nationality} · ${profile.visa}`,
        auto: true,
        kind: "확정",
      });
      if (employment.exitDate.value && !employment.exitDate.unknown) {
        events.push({
          id: uid("ev"),
          date: employment.exitDate.value,
          category: "출국",
          source: "profile",
          title: "예상 출국일",
          detail: "출국 정산 항목을 미리 확인하세요.",
          auto: true,
          kind: "권장",
        });
      }
      return { ...prev, profile, employment, events, sampleMode: false };
    });
  }, []);

  const upsertPayRecord = useCallback((record: PayRecord) => {
    setState((prev) => {
      const payRecords = [
        ...prev.payRecords.filter((r) => r.period !== record.period),
        record,
      ].sort((a, b) => a.period.localeCompare(b.period));

      const events = prev.events.filter(
        (e) => !(e.source === "paycheck" && e.date.startsWith(record.period)),
      );
      const payDay = record.documents.contract?.fields.payDay ?? prev.employment?.payDay ?? 10;
      const depositDate = record.documents.deposit?.fields.payDate ?? payDayIso(record.period, payDay);

      events.push({
        id: uid("ev"),
        date: depositDate,
        category: "급여",
        source: "paycheck",
        title: record.paidAmount === null ? "급여 확인 (입금액 미확인)" : "급여 입금",
        detail: `${record.workplace || "사업장 미입력"} · ${record.analysis.headline}`,
        ...(record.paidAmount !== null ? { amount: record.paidAmount } : {}),
        auto: true,
        kind: "확정",
      });

      if (record.analysis.findings.some((f) => f.status === "EXPLANATION_REQUIRED")) {
        events.push({
          id: uid("ev"),
          date: isoDate(new Date()),
          category: "급여",
          source: "paycheck",
          title: "설명이 필요한 차이 확인",
          detail: record.analysis.findings
            .filter((f) => f.status === "EXPLANATION_REQUIRED")
            .map((f) => f.title)
            .join(" / "),
          auto: true,
          kind: "권장",
        });
      }

      return { ...prev, payRecords, events };
    });
  }, []);

  const updateTaxProfile = useCallback((patch: Partial<TaxProfile>) => {
    setState((prev) => ({ ...prev, taxProfile: { ...prev.taxProfile, ...patch } }));
  }, []);

  const updateExitProfile = useCallback((patch: Partial<ExitProfile>) => {
    setState((prev) => ({ ...prev, exitProfile: { ...prev.exitProfile, ...patch } }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setState((prev) =>
      prev.profile ? { ...prev, profile: { ...prev.profile, ...patch } } : prev,
    );
  }, []);

  /** 출국일 등 근로정보 수정은 캘린더 자동 이벤트도 함께 갱신한다. */
  const updateEmployment = useCallback((patch: Partial<EmploymentProfile>) => {
    setState((prev) => {
      if (!prev.employment) return prev;
      const employment = { ...prev.employment, ...patch };
      const events = prev.events.filter(
        (e) => !(e.source === "profile" && e.category === "출국"),
      );
      if (employment.exitDate.value && !employment.exitDate.unknown) {
        events.push({
          id: uid("ev"),
          date: employment.exitDate.value,
          category: "출국",
          source: "profile",
          title: "예상 출국일",
          detail: "출국 정산 항목을 미리 확인하세요.",
          auto: true,
          kind: "권장",
        });
      }
      return { ...prev, employment, events };
    });
  }, []);

  const loadSample = useCallback(() => setState(buildSampleState()), []);
  const resetAll = useCallback(() => {
    setState(initialState);
    setResults([]);
    void localResultRepository.clear(currentUserId());
  }, []);

  const yearlyPay = useMemo(() => {
    const year = String(new Date().getFullYear());
    return state.payRecords
      .filter((r) => r.period.startsWith(year))
      .reduce((sum, r) => sum + (r.paidAmount ?? 0), 0);
  }, [state.payRecords]);

  const monthsRecorded = useMemo(() => {
    const year = String(new Date().getFullYear());
    return state.payRecords.filter((r) => r.period.startsWith(year)).length;
  }, [state.payRecords]);

  const totalMonths = useMemo(() => monthsWorked(state.employment), [state.employment]);

  const currentPeriodRecord = useMemo(() => {
    const period = periodOf(new Date());
    return state.payRecords.find((r) => r.period === period);
  }, [state.payRecords]);

  const signature = useMemo(
    () => profileSignature(state.profile, state.employment),
    [state.profile, state.employment],
  );

  const saveResult = useCallback<PayCycleContextValue["saveResult"]>(
    async (input) => {
      const record = {
        ...input,
        id: uid("res"),
        userId,
        createdAt: new Date().toISOString(),
        profileSignature: signature,
      } as SavedResult;
      await localResultRepository.save(record);
      setResults((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
      return record;
    },
    [userId, signature],
  );

  const removeResult = useCallback(
    async (id: string) => {
      await localResultRepository.remove(userId, id);
      setResults((prev) => prev.filter((r) => r.id !== id));
    },
    [userId],
  );

  const latestResult = useCallback(
    <K extends ResultKind>(kind: K) => latestOf(results, kind),
    [results],
  );

  const isStale = useCallback(
    (record: SavedResult) => record.profileSignature !== signature,
    [signature],
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
    ],
  );


  return <PayCycleContext.Provider value={value}>{children}</PayCycleContext.Provider>;
}

export function usePayCycle() {
  const ctx = useContext(PayCycleContext);
  if (!ctx) throw new Error("usePayCycle must be used within PayCycleProvider");
  return ctx;
}
