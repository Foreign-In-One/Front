import type { ResultKind, SavedResult } from "./results";

/**
 * 결과 저장소 인터페이스.
 * 지금은 localStorage 구현을 사용하지만, 같은 인터페이스로
 * Postgres/Supabase 구현을 만들어 교체하면 화면 코드는 그대로 둘 수 있다.
 */
export interface ResultRepository {
  list(userId: string): Promise<SavedResult[]>;
  get(userId: string, id: string): Promise<SavedResult | null>;
  save(record: any): Promise<SavedResult>;
  remove(userIdOrId: string, id?: string): Promise<void>;
  clear(userId?: string): Promise<void>;
}

const STORAGE_KEY = "paycycle-results-v1";
const USER_KEY = "paycycle-user-id";

/** 로컬 단일 사용자 ID. 로그인 도입 시 실제 사용자 ID로 대체한다. */
export function currentUserId(): string {
  if (typeof window === "undefined") return "local-user";
  try {
    const saved = window.localStorage.getItem(USER_KEY);
    if (saved) return saved;
    const created = `u_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(USER_KEY, created);
    return created;
  } catch {
    return "local-user";
  }
}

function readAll(): SavedResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedResult[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: SavedResult[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* 저장 실패는 무시 */
  }
}

function byNewest(a: SavedResult, b: SavedResult) {
  return b.createdAt.localeCompare(a.createdAt);
}

export const localResultRepository: ResultRepository = {
  async list(userId) {
    return readAll()
      .filter((r) => r.userId === userId)
      .sort(byNewest);
  },
  async get(userId, id) {
    return readAll().find((r) => r.userId === userId && r.id === id) ?? null;
  },
  async save(record: any) {
    const userId = currentUserId();
    const savedRecord: SavedResult = {
      id: record.id || `r_${Math.random().toString(36).slice(2, 10)}`,
      userId: record.userId || userId,
      createdAt: record.createdAt || new Date().toISOString(),
      profileSignature: record.profileSignature || "v1",
      ...record,
    };
    const all = readAll().filter((r) => r.id !== savedRecord.id);
    all.push(savedRecord);
    writeAll(all);
    return savedRecord;
  },
  async remove(userIdOrId: string, id?: string) {
    const targetId = id || userIdOrId;
    writeAll(readAll().filter((r) => r.id !== targetId));
  },
  async clear(userId?: string) {
    if (userId) {
      writeAll(readAll().filter((r) => r.userId !== userId));
    } else {
      writeAll([]);
    }
  },
};

export function latestOf<K extends ResultKind>(
  results: SavedResult[],
  kind: K,
): Extract<SavedResult, { kind: K }> | undefined {
  return results
    .filter((r): r is Extract<SavedResult, { kind: K }> => r.kind === kind)
    .sort(byNewest)[0];
}
