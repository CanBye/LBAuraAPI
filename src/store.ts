import { LanyardPresence } from "./types";

const presences = new Map<string, LanyardPresence>();
const kvStore = new Map<string, Map<string, string>>();
const apiKeys = new Map<string, string>();

export function setPresence(userId: string, presence: LanyardPresence): void {
  presences.set(userId, presence);
}

export function getPresence(userId: string): LanyardPresence | null {
  return presences.get(userId) || null;
}

export function getAllPresences(): Record<string, LanyardPresence> {
  const result: Record<string, LanyardPresence> = {};
  for (const [id, p] of presences) result[id] = p;
  return result;
}

export function getMonitoredCount(): number {
  return presences.size;
}

export function setKV(userId: string, key: string, value: string): void {
  if (!kvStore.has(userId)) kvStore.set(userId, new Map());
  kvStore.get(userId)!.set(key, value);
}

export function getKV(userId: string): Record<string, string> {
  const map = kvStore.get(userId);
  if (!map) return {};
  return Object.fromEntries(map);
}

export function deleteKV(userId: string, key: string): void {
  kvStore.get(userId)?.delete(key);
}

export function getKVCount(userId: string): number {
  return kvStore.get(userId)?.size || 0;
}

export function setApiKey(userId: string, apiKey: string): void {
  apiKeys.set(apiKey, userId);
}

export function getUserIdByApiKey(apiKey: string): string | null {
  return apiKeys.get(apiKey) || null;
}
