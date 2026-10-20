// Runs the pipeline over the mock samples and scores the output against expected.json.
// Usage: bun run scripts/eval.ts [samplesDir] [resultsDir]
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig } from "../src/config";
import { bindLlm, createModel } from "../src/llm";
import { compareValue, countVerdicts, mean, type Leaf } from "../src/grading";
import { runPipeline, type ExtractionResult } from "../src/pipeline";

const samplesDir = resolve(Bun.argv[2] ?? "../mock/samples");
const resultsDir = resolve(Bun.argv[3] ?? join(samplesDir, "results"));
const expectedPath = join(samplesDir, "expected.json");

type Expected = {
  document_type: string;
  fields: Record<string, { value: unknown; confidence_band: string }>;
  validation_errors_expected: string[];
};

const config = loadConfig();
const llm = bindLlm(createModel(config));
// EVAL_SCORE_ONLY=1 re-scores the JSON already in resultsDir without calling the LLM.
const scoreOnly = Bun.env.EVAL_SCORE_ONLY === "1";
const expectedAll = JSON.parse(await Bun.file(expectedPath).text()) as Record<string, Expected>;

const files = (await readdir(samplesDir)).filter((f) => /\.(pdf|png|jpe?g|webp)$/.test(f) && f in expectedAll).sort();
const outputs = await Promise.all(
  files.map(async (file) => {
    const jsonPath = join(resultsDir, file.replace(/\.[^.]+$/, ".json"));
    if (scoreOnly) return [file, (await Bun.file(jsonPath).json()) as ExtractionResult] as const;
    const bytes = new Uint8Array(await Bun.file(join(samplesDir, file)).arrayBuffer());
    const result = await runPipeline(bytes, llm, config.maxPages);
    await Bun.write(jsonPath, JSON.stringify(result, null, 2) + "\n");
    return [file, result] as const;
  }),
);

const perDocument: Record<string, unknown> = {};
const totals = { correct: 0, wrong: 0, hallucinated: 0, missing: 0 };
const confidenceBands = { above_0_9: 0, fields: 0 };
const bandScores: Record<string, number[]> = { high: [], medium: [], low: [] };
let classificationOk = 0;

for (const [file, result] of outputs as Array<readonly [string, ExtractionResult]>) {
  const expected = expectedAll[file]!;
  const leaves: Leaf[] = [];
  for (const [name, spec] of Object.entries(expected.fields)) {
    compareValue(spec.value, result.fields[name]?.value, name, leaves);
    const actualField = result.fields[name];
    if (actualField) {
      confidenceBands.fields++;
      if (actualField.confidence > 0.9) confidenceBands.above_0_9++;
      bandScores[spec.confidence_band]?.push(actualField.confidence);
    }
  }
  const counts = countVerdicts(leaves);
  for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += counts[key];

  const classificationOkThis = result.document_type === expected.document_type;
  if (classificationOkThis) classificationOk++;

  const expectedErrors = expected.validation_errors_expected;
  const actualErrors = result.validation_errors;
  const caught = expectedErrors.every((e) => actualErrors.some((a) => a.split(":")[0] === e.split(":")[0]));
  perDocument[file] = {
    classification: { expected: expected.document_type, actual: result.document_type, ok: classificationOkThis, confidence: result.confidence },
    leaves: counts,
    problems: leaves.filter((l) => l.verdict !== "correct"),
    validation: { expected: expectedErrors, actual: actualErrors, all_expected_caught: caught },
  };
}

const report = {
  run_at: new Date().toISOString(),
  model: scoreOnly ? "score-only (existing results)" : config.model,
  classification: { correct: classificationOk, total: outputs.length },
  leaf_totals: totals,
  confidence: {
    fields_scored: confidenceBands.fields,
    share_above_0_9: Number((confidenceBands.above_0_9 / confidenceBands.fields).toFixed(3)),
    mean_by_expected_band: Object.fromEntries(Object.entries(bandScores).map(([band, xs]) => [band, mean(xs)])),
  },
  per_document: perDocument,
};

await Bun.write(join(resultsDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ classification: report.classification, leaf_totals: totals, confidence: report.confidence }, null, 2));
