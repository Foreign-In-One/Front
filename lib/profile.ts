export type EmploymentStatus =
  | 'PRE_EMPLOYMENT'
  | 'EMPLOYED'
  | 'SEPARATED'
  | 'CHANGING';

/** USER 테이블(ERD) 중 온보딩에서 실제로 수집하는 컬럼만 반영한 로컬 프로필. */
export interface StoredProfile {
  name: string;
  status: EmploymentStatus;
  nationality: string;
  visa: string;
  entry: string;
  workStart: string;
  workplace: string;
  currentStart: string;
  payday: string;
  exit: string;
}

const PROFILE_KEY = 'paycycle:profile';

export function saveProfile(profile: StoredProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage unavailable (private mode 등) — 저장 없이 진행
  }
}

export function readProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredProfile;
  } catch {
    return null;
  }
}
