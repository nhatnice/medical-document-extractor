// Draws the two external test documents (mock/external/*.txt) as PNG pages.
// Text is laid out line by line; "|" separates columns on a line.
import { createCanvas } from "@napi-rs/canvas";
import { join, resolve } from "node:path";

const dir = resolve("../mock/external");
const W = 1240;
const H = 1754;

const docs: Record<string, string[]> = {
  lab_03_northgate_panel: [
    "H|NORTHGATE PATHOLOGY SERVICES",
    "Report issued: 07 May 2026   |   Specimen collected: 05 May 2026",
    "Patient: Le Minh Quan   |   Age 41   |   Sex M",
    "",
    "Analyte|Result|Unit|Ref. range|Flag",
    "Sodium|138|mmol/L|135 - 145|",
    "Potassium|5.8|mmol/L|3.5 - 5.0|H",
    "ALT|22|U/L|7 - 56|",
    "Platelets|96|x10^9/L|150 - 400|L",
    "",
    "Comments: Please repeat potassium on a non-haemolysed sample.",
  ],
  receipt_04_greenleaf_pharmacy: [
    "H|GREENLEAF PHARMACY",
    "Receipt no. GL-20417      Date: 2026-05-12",
    "Customer: Hoang Thi Mai",
    "",
    "Paracetamol 500mg x2 packs|2|25000|50000",
    "Vitamin C 1000mg|1|120000|120000",
    "Cough syrup 100ml|1|65000|65000",
    "",
    "Subtotal|235000",
    "VAT 8%|18800",
    "B|TOTAL|253800",
    "",
    "Paid by: Visa ending 4421",
  ],
};

for (const [name, lines] of Object.entries(docs)) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#111111";
  let y = 120;
  for (const line of lines) {
    const bold = line.startsWith("H|") || line.startsWith("B|");
    const cells = line.replace(/^[HB]\|/, "").split("|");
    ctx.font = `${bold ? "bold " : ""}${line.startsWith("H|") ? 44 : 32}px sans-serif`;
    if (cells.length === 1) {
      ctx.fillText(cells[0]!, 100, y);
    } else {
      // Numbers are right-aligned in the last columns; text stays left-aligned.
      cells.forEach((cell, index) => {
        const x = 100 + index * (W - 200) / cells.length;
        ctx.fillText(cell, index === 0 ? x : x + 40, y);
      });
    }
    y += line === "" ? 30 : 60;
  }
  await Bun.write(join(dir, `${name}.png`), canvas.toBuffer("image/png"));
}
console.log("wrote", Object.keys(docs).length, "pages");
