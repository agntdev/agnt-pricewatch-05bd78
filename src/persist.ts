import type { StorageAdapter } from "grammy";
import { MemorySessionStorage } from "./toolkit/session/memory.js";

/**
 * Persistent storage for durable domain data (watchlist items, alerts, user
 * settings, aggregate stats). Uses Redis in production (via the toolkit's
 * Redis-backed adapter), in-memory in dev/test.
 *
 * Keys are namespaced to avoid collisions:
 *   user:<telegramId>  → UserProfileData
 *   global:stats       → AggregateStats
 *   global:userIds     → { ids: number[] }
 */

export interface WatchlistItem {
  ticker: string;
  displayName: string;
  coinId: string;
  lastPrice: number | null;
  lastChecked: number;
}

export interface AlertRule {
  id: string;
  ticker: string;
  coinId: string;
  type: "above" | "below" | "percent_change";
  value: number;
  enabled: boolean;
  lastFired: number | null;
}

export interface UserProfileData {
  telegramId: number;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  summaryTime: string;
  alertCooldown: number;
  watchlist: WatchlistItem[];
  alerts: AlertRule[];
}

export interface AggregateStats {
  userCount: number;
  alertFireCount: number;
}

export interface UserIndex {
  ids: number[];
}

const DEFAULT_PROFILE: UserProfileData = {
  telegramId: 0,
  timezone: "UTC",
  quietHoursStart: 22,
  quietHoursEnd: 7,
  summaryTime: "08:00",
  alertCooldown: 30,
  watchlist: [],
  alerts: [],
};

const storeKey = "__agntdev_persist_store";

function getStoreRef(): StorageAdapter<unknown> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (process as any)[storeKey] as StorageAdapter<unknown> | null ?? null;
}

function setStoreRef(s: StorageAdapter<unknown> | null): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as any)[storeKey] = s;
}

/** Reset the store singleton. Test-only hook; never call from bot code. */
export function _resetPersistStore(): void {
  setStoreRef(null);
}

async function getStore(): Promise<StorageAdapter<unknown>> {
  const existing = getStoreRef();
  if (existing) return existing;
  let s: StorageAdapter<unknown>;
  const url =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>).REDIS_URL : undefined;
  if (url) {
    const { defaultRedisStorage } = await import("./toolkit/session/redis.js");
    s = defaultRedisStorage<unknown>(url);
  } else {
    s = new MemorySessionStorage<unknown>();
  }
  setStoreRef(s);
  return s;
}

export async function getUserProfile(telegramId: number): Promise<UserProfileData> {
  const s = await getStore();
  const data = (await s.read(`user:${telegramId}`)) as UserProfileData | undefined;
  if (!data) {
    return { ...DEFAULT_PROFILE, telegramId };
  }
  return data;
}

export async function saveUserProfile(profile: UserProfileData): Promise<void> {
  const s = await getStore();
  await s.write(`user:${profile.telegramId}`, profile);
}

export async function getAggregateStats(): Promise<AggregateStats> {
  const s = await getStore();
  const data = (await s.read("global:stats")) as AggregateStats | undefined;
  return data ?? { userCount: 0, alertFireCount: 0 };
}

export async function saveAggregateStats(stats: AggregateStats): Promise<void> {
  const s = await getStore();
  await s.write("global:stats", stats);
}

export async function getUserIndex(): Promise<UserIndex> {
  const s = await getStore();
  const data = (await s.read("global:userIds")) as UserIndex | undefined;
  return data ?? { ids: [] };
}

export async function saveUserIndex(index: UserIndex): Promise<void> {
  const s = await getStore();
  await s.write("global:userIds", index);
}

export async function ensureUserRegistered(telegramId: number): Promise<boolean> {
  const profile = await getUserProfile(telegramId);
  const isNew = profile.telegramId === 0;
  if (isNew) {
    profile.telegramId = telegramId;
    await saveUserProfile(profile);
    const index = await getUserIndex();
    if (!index.ids.includes(telegramId)) {
      index.ids.push(telegramId);
      await saveUserIndex(index);
    }
    const stats = await getAggregateStats();
    stats.userCount = index.ids.length;
    await saveAggregateStats(stats);
  }
  return isNew;
}

export async function incrementAlertFireCount(): Promise<void> {
  const stats = await getAggregateStats();
  stats.alertFireCount += 1;
  await saveAggregateStats(stats);
}

export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
