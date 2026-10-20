import type { Sample } from './types'

export const SAMPLES: Sample[] = [
  { name: 'receipt_01_sunrise_bill.pdf', label: 'Sunrise bill', type: 'receipt' },
  { name: 'receipt_02_stmary_statement.pdf', label: 'St. Mary statement', type: 'receipt' },
  { name: 'receipt_03_riverside_invoice.pdf', label: 'Riverside invoice', type: 'receipt' },
  { name: 'discharge_01_sunrise_summary.pdf', label: 'Sunrise summary', type: 'discharge_summary' },
  { name: 'discharge_02_saigon_form.pdf', label: 'Saigon form', type: 'discharge_summary' },
  { name: 'discharge_03_mekong_letter.pdf', label: 'Mekong letter', type: 'discharge_summary' },
  { name: 'lab_01_central_report.pdf', label: 'Central lab report', type: 'lab_report' },
  { name: 'lab_02_lotus_pathology.pdf', label: 'Lotus pathology', type: 'lab_report' },
  { name: 'prescription_01_family_clinic.pdf', label: 'Family clinic Rx', type: 'prescription' },
  { name: 'prescription_02_riverside_rx.pdf', label: 'Riverside Rx', type: 'prescription' },
]

export async function loadSample(sample: Sample): Promise<File> {
  const res = await fetch(`/samples/${sample.name}`)
  if (!res.ok) throw new Error(`Could not load sample ${sample.name}`)
  return new File([await res.blob()], sample.name, { type: 'application/pdf' })
}
