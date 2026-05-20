export function missPatternKey(raw: string): string {
  if (!raw || !raw.trim()) return '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).join('+');
}

export function collectMissPatterns(raws: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of raws) {
    const key = missPatternKey(raw);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
