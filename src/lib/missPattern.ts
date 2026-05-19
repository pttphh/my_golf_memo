/** 집계용 패턴 키: "풀" → "풀", "풀, 훅" → "풀+훅" (항목별 분리 카운트 아님) */
export function missPatternKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join('+');
}

export function incrementMissPattern(
  counts: Record<string, number>,
  raw: string | null | undefined,
): void {
  const key = missPatternKey(raw);
  if (key) counts[key] = (counts[key] ?? 0) + 1;
}

export interface MissEntry {
  label: string;
  count: number;
}

export function collectMissPatterns(raws: (string | null | undefined)[]): MissEntry[] {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    incrementMissPattern(counts, raw);
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
