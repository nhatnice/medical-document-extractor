import { z } from "zod";

export const DOCUMENT_TYPES = ["receipt", "discharge_summary", "lab_report", "prescription"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const FIELD_SCHEMAS: Record<DocumentType, Record<string, z.ZodType>> = {
  receipt: {
    hospital_name: z.string().describe("Name of the hospital or clinic that issued the bill"),
    patient_name: z.string().describe("Name of the patient the bill is for"),
    date: z.string().describe("Date of service or issue, as YYYY-MM-DD"),
    items: z
      .array(
        z.object({
          description: z.string().nullable().describe("Item or service name as printed"),
          quantity: z.number().nullable().describe("Quantity as a plain number"),
          unit_price: z.number().nullable().describe("Price per unit as a plain number"),
          total: z.number().nullable().describe("Line total as a plain number"),
        }),
      )
      .describe("One entry per line item, in document order"),
    grand_total: z.number().describe("Final amount payable, not the subtotal"),
    payment_method: z.string().describe("How the bill was paid, e.g. Cash, Card, Bank transfer"),
  },
  discharge_summary: {
    hospital_name: z.string().describe("Name of the hospital that issued the summary"),
    patient_name: z.string().describe("Name of the patient"),
    admission_date: z.string().describe("Admission date as YYYY-MM-DD"),
    discharge_date: z.string().describe("Discharge date as YYYY-MM-DD"),
    diagnosis: z
      .object({
        primary: z.string().nullable().describe("Primary diagnosis, verbatim, including any ICD code printed"),
        secondary: z.array(z.string()).nullable().describe("Secondary diagnoses; null if none are listed"),
      })
      .describe("Primary and secondary diagnoses"),
    procedures_performed: z.array(z.string()).describe("Procedures performed during the stay, one entry each"),
    attending_physician: z.string().describe("Name of the attending or discharging physician"),
    discharge_instructions: z.string().describe("Discharge instructions copied in full from the document"),
  },
  lab_report: {
    lab_name: z.string().describe("Name of the laboratory that issued the report"),
    patient_name: z.string().describe("Name of the patient"),
    date: z.string().describe("Date of the report or specimen, as YYYY-MM-DD"),
    tests: z
      .array(
        z.object({
          test_name: z.string().nullable().describe("Name of the test as printed"),
          result: z.string().nullable().describe("Measured result as printed"),
          unit: z.string().nullable().describe("Unit of the result"),
          reference_range: z.string().nullable().describe("Reference range as printed"),
          flag: z
            .enum(["normal", "high", "low"])
            .nullable()
            .describe("Printed flag, or derived from result versus reference range"),
        }),
      )
      .describe("One entry per test row, in document order"),
  },
  prescription: {
    doctor_name: z.string().describe("Name of the prescribing doctor"),
    patient_name: z.string().describe("Name of the patient"),
    date: z.string().describe("Date of the prescription as YYYY-MM-DD"),
    medications: z
      .array(
        z.object({
          name: z.string().nullable().describe("Medication name and strength as printed"),
          dosage: z.string().nullable().describe("Dose per intake, e.g. 500 mg"),
          frequency: z.string().nullable().describe("How often to take it, e.g. Twice daily"),
          duration: z.string().nullable().describe("Length of treatment; null if not written"),
          quantity: z.string().nullable().describe("Amount dispensed as printed, e.g. 21 capsules"),
        }),
      )
      .describe("One entry per medication, in document order"),
  },
};

export const classifySchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  confidence: z.number().min(0).max(1),
});

export function extractionSchema(type: DocumentType) {
  const fields = Object.fromEntries(
    Object.entries(FIELD_SCHEMAS[type]).map(([name, value]) => [
      name,
      z.object({ value: value.nullable(), confidence: z.number().min(0).max(1) }),
    ]),
  );
  return z.object({ fields: z.object(fields) });
}
