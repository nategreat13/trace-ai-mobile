/**
 * Typo-tolerant word match. A query word matches a token when it's within a
 * small edit distance of the token or of the token's start, so a half-typed
 * "mism" still finds "miami". Short words (codes, "nyc") must match exactly:
 * at three letters one edit turns almost anything into anything.
 */
export function fuzzyIncludes(tokens: string[], word: string): boolean {
  if (word.length < 4) return tokens.some((t) => t.startsWith(word));
  const allowed = word.length >= 7 ? 2 : 1;
  return tokens.some((t) => {
    if (t.includes(word)) return true;
    for (let len = word.length - 1; len <= word.length + 1; len++) {
      if (len < 3 || len > t.length) continue;
      if (editDistance(word, t.slice(0, len)) <= allowed) return true;
    }
    return false;
  });
}

/** Optimal-string-alignment distance: Levenshtein plus adjacent swaps. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
