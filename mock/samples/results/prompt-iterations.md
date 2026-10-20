# Nhật ký vòng lặp sửa prompt

Chạy: `cd server && bun run scripts/eval.ts` (10 mẫu). Chấm lại không gọi LLM: `EVAL_SCORE_ONLY=1 bun run scripts/eval.ts ../mock/samples ../mock/samples/results/iterations/<vN>`.
Kết quả từng vòng nằm trong `iterations/v1`, `v2`, `v3` (JSON đầu ra + `report.json`).

## Thay đổi chấm điểm (áp dụng từ v1 trở đi)

- Bỏ tiền tố danh xưng (`Dr.`, `BS.`, `TS.`) khi so khớp tên. Tên bác sĩ in nguyên văn trên tài liệu, đáp án cũ ghi thiếu tiền tố nên chấm sai.
- Đáp án là `expected.json` của đề, không sửa để khớp model.

## Bảng kết quả

| Vòng | Thay đổi prompt | Phân loại | Field đúng / sai / bịa / thiếu | Tỷ lệ confidence > 0.9 | Trung bình band high / medium / low |
|---|---|---|---|---|---|
| v1 (baseline) | prompt gốc | 10/10 | 151 / 5 / 0 / 0 | **84.5%** | 0.949 / 0.767 / 0.033 |
| v2 | Hạ thang confidence, đổi ví dụ 0.97 → 0.9; thêm quy tắc không lấy ngày/chú thích vào tên thủ thuật; quy tắc dosage; quy tắc đọc lại chữ số | 10/10 | 151 / 5 / 0 / 0 | 29.3% | 0.902 / 0.767 / 0.033 |
| v3 | Quy tắc dosage cụ thể hơn, có ví dụ tổng quát (không lấy từ mẫu) | 10/10 | **154 / 2** / 0 / 0 | 36.2% | 0.906 / 0.783 / 0.033 |

## Chi tiết lỗi theo vòng

**v1 (5 sai)**
- `prescription_01`: `medications[0].dosage` = "1 capsule", đáp án "500 mg". Model lấy số viên mỗi lần uống, không lấy hàm lượng.
- `prescription_01`: `medications[1].dosage` = "1 tablet", cùng lỗi.
- `discharge_02`: `procedures_performed[0]` = "Laparoscopic appendectomy (03.02.2026)". Model thêm ngày vào tên thủ thuật.
- `receipt_02`: `items[1].unit_price` và `total` = 439, đáp án 430. Model đọc sai chữ số. Phép cộng vẫn trong ngưỡng 5% nên validation không bắt được.

**v2 (5 sai)**
- Dosage vẫn sai ở `prescription_01` (quy tắc còn mơ hồ).
- `medications[1].frequency` thêm "for fever or pain" (nguyên văn trên tài liệu, đáp án cắt bớt).
- Lỗi 439 vẫn còn.
- Calibration cải thiện mạnh: tỷ lệ > 0.9 từ 84.5% xuống 29.3%, các field rõ ràng vẫn được điểm cao.

**v3 (2 sai)**
- Dosage đúng cả hai thuốc.
- `items[1].total` = 439 (lỗi đọc số). `unit_price` lần này đúng → lỗi không ổn định giữa các lần chạy, chủ yếu ở chữ số nhỏ trên PDF.
- `medications[1].frequency`: thêm "for fever or pain" — nguyên văn trên tài liệu; đáp án cắt bớt. Coi là lỗi của đáp án.

## Nhận xét về confidence

- Tiêu chí của đề: nếu phần lớn field > 0.9 thì chỉnh prompt. v1 vượt ngưỡng (84.5%), nên đã chỉnh. Sau v2–v3 còn 36%, dưới ngưỡng.
- Field null luôn có confidence 0.0–0.03 (đúng yêu cầu không bịa).
- Field band "medium" trong đáp án có trung bình ~0.78, tức là có phân tách nhưng chưa mạnh.

## Tài liệu ngoài bộ mẫu (kiểm tra tái sử dụng)

Nằm trong `mock/external/`, đáp án trong `mock/external/expected.json`. Hai tài liệu được vẽ thành PNG (không có Chrome/wkhtmltopdf trên máy để chuyển HTML → PDF).

- `lab_03_northgate_panel.png`: lab_report, ngày DD Month YYYY, cờ H/L in sẵn. **Phân loại đúng, 23/23 field đúng.**
- `receipt_04_greenleaf_pharmacy.png`: receipt có VAT giữa các dòng và tổng. **Phân loại đúng, 15/17 đúng.** Validation bắt đúng `amount_mismatch` (235000 vs 253800, 7.41%).
  - "Paracetamol 500mg x2 packs" bị rút gọn thành "Paracetamol 500mg" (mất "x2 packs").
  - `payment_method` = "Visa ending 4421", đáp án "Visa". Cả hai đều là lựa chọn hợp lý; đáp án cần xem lại.
- Hạn chế: prompt đã được chỉnh trên 10 mẫu, nên đây là kiểm tra khái quát hóa yếu, không phải tập kiểm tra mù.

## Hạn chế còn lại

- Lỗi đọc chữ số (430 → 439) không được validation bắt khi tổng vẫn trong 5%. Có thể cần render ảnh độ phân giải cao hơn (`RENDER_SCALE`) hoặc kiểm tra chéo unit_price × quantity = total (đã có, nhưng 1 × 439 = 439 nên vẫn khớp).
- Chưa đo độ ổn định: lỗi 439 xuất hiện ở v2 nhưng không còn ở v3 trong khi prompt đã thay đổi, nên chưa rõ là do prompt hay do nhiễu của model. Cần chạy lặp lại nhiều lần với cùng prompt để có số trung bình.
- Chênh 149 → 151 ở v1 là do sửa cách chấm (danh xưng), không phải do model.
