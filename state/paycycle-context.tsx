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
import { getProfileApi, updateProfileApi } from "@/services/api";

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
}

const PayCycleContext = createContext<PayCycleContextValue | null>(null);

export function PayCycleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PayCycleState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState("local-user");
  const [results, setResults] = useState<SavedResult[]>([]);

  // 초기화: Spring Boot 백엔드 API에서 최신 프로필 데이터 조회
  useEffect(() => {
    async function init() {
      try {
        const { profile, employment } = await getProfileApi();
        setState((prev) => ({
          ...prev,
          profile: {
            nickname: profile.nickname,
            nationality: profile.nationality,
            visa: profile.visa,
            language: (prev.profile?.language || "vi") as any,
          },
          employment: {
            status: (employment.status as any) || "EMPLOYED",
            entryDate: { value: employment.entryDate ?? "", unknown: !employment.entryDate },
            workStartDate: { value: employment.workStartDate ?? "", unknown: !employment.workStartDate },
            currentWorkplaceStartDate: {
              value: employment.currentWorkplaceStartDate ?? "",
              unknown: !employment.currentWorkplaceStartDate,
            },
            exitDate: { value: employment.exitDate ?? "", unknown: !employment.exitDate },
            payDay: employment.payDay,
            workplace: employment.workplace,
            previousWorkplace: employment.previousWorkplace,
          },
        }));
      } catch {
        /* 실패 시 기본값 사용 */
      } finally {
        setHydrated(true);
      }
    }

    void init();
    const uid = currentUserId();
    setUserId(uid);
    void localResultRepository.list(uid).then(setResults);
  }, []);

  const saveProfile = useCallback((profile: UserProfile, employment: EmploymentProfile) => {
    setState((prev) => ({ ...prev, profile, employment, sampleMode: false }));
    // Spring Boot 백엔드 API 저장
    void updateProfileApi({
      profile: {
        userId: "demo-user-1",
        nickname: profile.nickname,
        nationality: profile.nationality,
        visa: profile.visa,
        entryDate: employment.entryDate.value || null,
        visaExpiryDate: employment.exitDate.value || null,
      },
      employment: {
        status: employment.status,
        entryDate: employment.entryDate.value || null,
        workStartDate: employment.workStartDate.value || null,
        currentWorkplaceStartDate: employment.currentWorkplaceStartDate.value || null,
        exitDate: employment.exitDate.value || null,
        payDay: employment.payDay,
        workplace: employment.workplace,
        previousWorkplace: employment.previousWorkplace,
      },
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
      const exists = prev.payRecords.some((r) => r.id === record.id);
      const nextRecords = exists
        ? prev.payRecords.map((r) => (r.id === record.id ? record : r))
        : [...prev.payRecords, record];
      return { ...prev, payRecords: nextRecords };
    });
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, "id">) => {
    setState((prev) => {
      const newEvt: CalendarEvent = { ...event, id: `evt-${Date.now()}` };
      return { ...prev, events: [...prev.events, newEvt] };
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
