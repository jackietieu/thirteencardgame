# Tiến Lên (Thirteen) — Luật chơi (v1, khóa)

Tiến Lên miền Nam, thứ tự chất do người chơi cố định. Tài liệu này là bản đặc tả
tham khảo của trò chơi; mọi thay đổi luật phải được cập nhật đồng bộ ở đây và
trong mã nguồn.

## 1. Quân bài và thứ tự

- **1.1 Bộ bài** — 52 lá, không có phé.
- **1.2 Thứ tự số** (thấp → cao): 3 4 5 6 7 8 9 10 J Q K A **2**. Quân 2 là quân lớn nhất.
- **1.3 Thứ tự chất** (thấp → cao): ♠ bích < ♣ chuồn < ♦ rô < ♥ cơ.
- **1.4 So chất** — chất chỉ được so giữa các lá cùng số: 5♥ thắng 5♦, nhưng bất kỳ lá 5 nào cũng thắng bất kỳ lá 4 nào bất kể chất.
- **1.5 Lá mạnh nhất** — 2♥ là lá mạnh nhất trong trò chơi.

## 2. Chia bài và khai cuộc

- **2.1 Chia bài** — mỗi ván chia 13 lá cho mỗi người trong 4 người chơi.
- **2.2 Đánh đầu** — trong ván đầu của một game, ai giữ lá 3♠ phải đánh lượt đầu tiên.
- **2.3 Bắt buộc gồm 3♠** — lượt đánh đầu tiên đó phải chứa chính lá 3♠: một lá 3♠ đơn, một cặp/bộ ba/tứ quý chứa nó, hoặc một sảnh / sảnh đôi có gồm nó. Sảnh 3♣-4-5 không được tính.
- **2.4 Các ván sau** — từ ván thứ hai trở đi, người thắng ván trước được đánh trước với bất kỳ tổ hợp nào (không cần 3♠).

## 3. Tổ hợp

- **3.1 lá đơn** — một lá.
- **3.2 đôi** — hai lá cùng số.
- **3.3 bộ ba** — ba lá cùng số.
- **3.4 tứ quý** — bốn lá cùng số.
- **3.5 sảnh** — 3+ số liên tiếp, chất tùy ý, chỉ số 3–A (**không có 2**). Q-K-A hợp lệ; K-A-2 không hợp lệ.
- **3.6 sảnh đôi** — 3+ cặp liên tiếp, chỉ số 3–A (không có 2); hai lá của mỗi số có thể chất bất kỳ.

## 4. Ăn bài

- **4.1** Một lượt đánh chỉ thắng lượt đang đứng trên bài nếu đó là cùng loại tổ hợp, cùng số lượng, với lá bài đầu cao hơn (so số trước, rồi đến chất).
- **4.2** Không gì khác ăn được gì: bộ ba không bao giờ ăn được đôi, sảnh 5 lá không bao giờ ăn được sảnh 4 lá, và các tổ hợp không phải "chặt" không ăn được chéo loại.
- **4.3** Bất kỳ tổ hợp hợp lệ nào cũng có thể đánh trước, kể cả tứ quý và sảnh đôi (chặt).

## 5. Chặt (bom)

- **5.1** Một tứ quý hoặc một sảnh đôi 3+ cặp ăn được lá 2 đơn.
- **5.2** Một sảnh đôi 4+ cặp ăn được một đôi 2.
- **5.3** Một sảnh đôi 5+ cặp ăn được một bộ ba 2.
- **5.4** Bom chỉ ăn được 2 — không bao giờ ăn lá đơn/cặp/bộ ba khác (luật 4.2 vẫn áp dụng cho các mục tiêu không phải 2).
- **5.5** Khi đã có bom trên bàn, chỉ một bom cao hơn cùng loại mới trả lời được: tứ quý ăn bằng số cao hơn; sảnh đôi ăn bằng dài hơn, rồi so lá đầu.
- **5.6** Tứ quý 2 là một tứ quý bình thường (không thắng trắng trong v1).

## 6. Bỏ lượt

- **6.1** Người đánh trước trong một vòng không được bỏ lượt.
- **6.2** Người chơi khác có thể bỏ lượt trong lượt của mình thay vì đánh.
- **6.3** Bỏ lượt khóa người chơi đó đến khi vòng kết thúc: họ không thể quay lại vòng đó, kể cả bằng bom.

## 7. Kết thúc vòng

- **7.1** Một vòng kết thúc ngay khi tất cả người chơi còn hoạt động khác đã bỏ lượt; lượt đánh cuối cùng thắng.
- **7.2** Người thắng vòng đánh trước vòng tiếp theo.
- **7.3** Nếu người thắng vòng đã hết bài, quyền đánh trước chuyển cho người kế tiếp theo chiều kim đồng hồ còn bài.

## 8. Kết thúc ván và tính điểm

- **8.1** Ván kết thúc ngay khi người chơi thứ ba đánh hết bài; người còn lại về đích thứ 4.
- **8.2** Điểm về thứ hạng: về nhất = 3, về nhì = 2, về ba = 1, về bét = 0 điểm, cộng dồn qua các ván.
- **8.3** Không có điểm phạt hay thăng hạng trong v1.

## 9. Kết thúc game

- **9.1** Sau mỗi ván, nếu đúng một người chơi có số điểm cao nhất tuyệt đối và đạt từ 10 trở lên, người đó thắng game.
- **9.2** Nếu không, chơi tiếp ván khác (người thắng đánh trước, luật 2.4).

## 10. Ngoài phạm vi của v1

Thắng trắng (rồng, sáu đôi, tứ quý 2), luật sảnh đồng chất miền Bắc, đếm điểm phạt, phé.
Các mục này sẽ thành cờ cấu hình của engine sau — engine không được cài cắm chống lại chúng.
