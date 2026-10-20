# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The repo has no code yet. It holds only the spec (`CHALLENGE_08.md`) and an empty `README.md`. No language, build system, test runner or linter has been picked. When those are chosen, add the build, lint and test commands (including how to run a single test) to this file.

## What is being built

A **medical document extraction pipeline**: it takes a PDF or image and returns structured JSON. It uses a vision-capable LLM (Claude, GPT-4o or Gemini; the API key is provided by the user). `CHALLENGE_08.md` is the source of truth. These are the parts that affect the architecture:

1. **Classify** each document as exactly one of `receipt`, `discharge_summary`, `lab_report` or `prescription`, with a confidence score.
2. **Extract** the fields defined for that type:
   - receipt: `hospital_name, patient_name, date, items[{description, quantity, unit_price, total}], grand_total, payment_method`
   - discharge_summary: `hospital_name, patient_name, admission_date, discharge_date, diagnosis{primary, secondary}, procedures_performed, attending_physician, discharge_instructions`
   - lab_report: `lab_name, patient_name, date, tests[{test_name, result, unit, reference_range, flag: normal|high|low}]`
   - prescription: `doctor_name, patient_name, date, medications[{name, dosage, frequency, duration, quantity}]`
3. **Validate** the extracted data with deterministic code, not the LLM:
   - Dates must be real dates.
   - Amounts must be positive.
   - Flag a receipt when the sum of item totals differs from `grand_total` by more than 5%.
   - Every field needs a confidence score between 0.0 and 1.0.

### Output contract

```json
{
  "document_type": "receipt",
  "confidence": 0.95,
  "fields": { "<field>": { "value": ..., "confidence": 0.0-1.0 } },
  "validation_errors": []
}
```

### Hard evaluation constraints

These shape the design:

- **No hallucination.** If a field is not visible in the document, return `value: null` with low confidence. Never invent a value.
- **Confidence must mean something.** Uncertain fields should get low scores; scores should not all be high.
- **Reusable.** The pipeline must work on any document of these four types. Nothing may be hardcoded to the sample documents.

## Deliverables

These also go in the repo:

- 10 sample documents. Mock HTML→PDF documents are acceptable. The mix:
  - 3 receipts/invoices
  - 3 discharge summaries
  - 2 lab reports
  - 2 prescriptions
- The extraction result for each sample document
- A short writeup of the prompt engineering approach

## Commit Rules
Format: Commit subject: '<type>(<scope>): <Subject>'
