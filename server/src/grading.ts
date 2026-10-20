// Compares extracted fields with an answer key, leaf by leaf. Used by scripts/eval.ts.

export type Verdict = "correct" | "wrong" | "missing" | "hallucinated";
export type Leaf = { path: string; verdict: Verdict; expected: unknown; actual: unknown };

export const isEmpty = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

// Honorifics such as "Dr." are printed on the document and copied verbatim, so they are not a mismatch.
export function normalizeText(v: unknown): unknown {
  return typeof v === "string"
    ? v.trim().replace(/\s+/g, " ").replace(/^(dr|bs|ts)\.?\s+/i, "").toLowerCase()
    : v;
}

export function compareValue(expected: unknown, actual: unknown, path = "", out: Leaf[] = []): Leaf[] {
  if (isEmpty(expected)) {
    out.push({ path, verdict: isEmpty(actual) ? "correct" : "hallucinated", expected, actual });
    return out;
  }
  if (Array.isArray(expected)) {
    const list = Array.isArray(actual) ? actual : [];
    expected.forEach((item, index) => compareValue(item, list[index], `${path}[${index}]`, out));
    if (list.length > expected.length) {
      out.push({ path: `${path}[extra]`, verdict: "hallucinated", expected: null, actual: list.slice(expected.length) });
    }
    return out;
  }
  if (expected !== null && typeof expected === "object") {
    const obj = (actual && typeof actual === "object" ? actual : {}) as Record<string, unknown>;
    for (const key of Object.keys(expected)) {
      compareValue((expected as Record<string, unknown>)[key], obj[key], `${path}.${key}`, out);
    }
    return out;
  }
  if (isEmpty(actual)) {
    out.push({ path, verdict: "missing", expected, actual });
    return out;
  }
  const same =
    typeof expected === "number" ? Number(actual) === expected : normalizeText(actual) === normalizeText(expected);
  out.push({ path, verdict: same ? "correct" : "wrong", expected, actual });
  return out;
}

export function countVerdicts(leaves: Leaf[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { correct: 0, wrong: 0, hallucinated: 0, missing: 0 };
  for (const leaf of leaves) counts[leaf.verdict]++;
  return counts;
}

export function mean(xs: number[]): number | null {
  return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : null;
}
