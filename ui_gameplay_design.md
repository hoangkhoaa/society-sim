# UI & Gameplay Design

## Triết lý thiết kế

> Ít UI nhất có thể. Mọi thứ người chơi cần biết nên **emerge từ narrative**, không phải từ dashboard số liệu.

Người chơi là **The Narrator** — viết hiến pháp ban đầu, rồi nói chuyện với thế giới bằng ngôn ngữ tự nhiên. Không có menu event. Không có nút bấm phức tạp. Chỉ có chat — và hậu quả.

---

## Cấu trúc màn hình

```
┌─────────────────────────────────────────────────────────────┐
│  TOPBAR — clock + 3-4 chỉ số macro nguy hiểm nhất          │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│      MAP VIEW                │     NARRATIVE FEED           │
│      (canvas)                │     (event log sống)         │
│                              │                              │
│   zoom/pan tự do             │   scroll lên xem lịch sử     │
│   click NPC → spotlight      │   click event → highlight    │
│   click building → info      │   trên map                   │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│  BOTTOM BAR — event inject panel + time controls            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Topbar — Chỉ số macro

Không hiện tất cả. Chỉ 4 chỉ số quan trọng nhất, màu thay đổi theo ngưỡng:

```
[Năm 3 · Tháng 2 · Ngày 14]   Stability 61% ⚠   Food 43% ✕   Trust 34%   Gini 0.52
```

- Xanh: ổn
- Vàng ⚠: cần chú ý
- Đỏ ✕: nguy hiểm, có thể trigger cascade

Không có bar chart, không có số liệu phụ — chỉ số thôi. Chi tiết hơn thì click vào.

---

## 2. Map View

### Không phải map tile truyền thống

Map thể hiện **mật độ cảm xúc** của dân, không phải địa hình:

```
Zones sáng lên theo trạng thái:
  Xanh lá  — khu vực productive, happy
  Vàng     — stress đang tăng
  Đỏ       — bất ổn, có thể là ổ tập hợp
  Tím      — radicalization đang lan
  Xám      — abandoned, người đã rời đi
```

### NPC rendering ở 10,000 người

Không render từng dot — render **flow và cluster**:

```
Zoom out: thấy density heatmap + flow arrows (người đang di chuyển về đâu)
Zoom mid: thấy cluster groups (nhóm họp, nhóm làm việc, nhóm trốn)
Zoom in:  thấy từng NPC dot, click để spotlight
```

### Click NPC — Spotlight Panel

Không phải popup nhỏ. Một panel bên cạnh mở ra:

```
┌─────────────────────────┐
│ Nguyễn Văn An · Nông dân│
│ ─────────────────────── │
│ Cảm xúc: Tức giận       │
│ Stress:  ████████░░ 78% │
│ Trust:   ███░░░░░░░ 28% │
│ ─────────────────────── │
│ WORLDVIEW               │
│ Collectivist    ██████░ │
│ Authority trust █░░░░░░ │
│ Risk tolerance  ████░░░ │
│ ─────────────────────── │
│ ĐANG NGHĨ               │
│ "Chính phủ hứa 3 lần    │
│  rồi không làm. Lần này │
│  tôi không tin nữa."    │
│ ─────────────────────── │
│ GẦN ĐÂY                 │
│ · Tham gia họp kín ngày 26│
│ · Nghe tin đồn từ Bình  │
│ · Từ chối đi làm ngày 28│
└─────────────────────────┘
```

"Đang nghĩ" — LLM generate 1-2 câu internal monologue, gọi khi click.  
Không phải real-time, chỉ khi interact.

---

## 3. Narrative Feed

Cột bên phải — **trái tim của UI**.

```
── Năm 3, Tháng 2 ────────────────────

  [Ngày 14] 🌿 Hạn hán bắt đầu ở vùng nam
  
  [Ngày 18] 📈 Hội Thương Nhân tăng giá
             lương thực 20%
             → Chính phủ không phản hồi
  
  [Ngày 21] 💬 Tin đồn lan nhanh:
             "Thương nhân bảo kê bởi hội đồng"
             (nguồn: chưa xác minh)
  
  [Ngày 26] 👥 Nhóm 12 nông dân họp kín
             tại khu nam — lần đầu tiên
  
  [Ngày 31] 🏘 Cộng đồng tự tổ chức
             phân phối thức ăn — không qua
             chính phủ
  
  [Ngày 35] ⚡ Phe đối lập tuyên bố:
             "Hiến pháp này bảo vệ ai?"
             → +8% support trong 3 ngày
  
  [Ngày 40] ⚠ Lực lượng bảo vệ nhận lệnh
  ┌─────────────────────────────────┐
  │  giải tán chợ tự phát          │  ← event đang diễn ra
  │  → 30% lính từ chối thi hành   │
  └─────────────────────────────────┘
```

### Tính năng của feed:
- Click event → highlight người liên quan trên map
- Icon phân loại: 🌿 nature · 📈 economic · 💬 rumor · 👥 social · ⚡ political · ⚠ critical
- Event do LLM viết — không phải template cứng
- Màu sắc theo severity
- Scroll lên xem toàn bộ lịch sử

---

## 4. Bottom Bar — Chat Input + Time Controls

Không có dropdown menu. Người chơi nói chuyện với thế giới.

```
┌────────────────────────────────────────────────────────────┐
│  [⏸] [1x · 3x · 10x]    Năm 3 · Tháng 2   [📜 Hiến pháp]│
│  ────────────────────────────────────────────────────────  │
│  🌐  "ê tạo cơn bão to đi"                      [Gửi →]  │
└────────────────────────────────────────────────────────────┘
```

### Ví dụ player có thể gõ:
```
"tạo cơn bão to ở phía bắc"
"rò rỉ thông tin tham nhũng của hội đồng"
"có một nhà lãnh đạo mới nổi lên trong dân"
"tại sao dân đang bất ổn?"
"nếu tôi gây bão lúc này thì sao?"
"nhóm nào đang gần nổi loạn nhất?"
```

### Flow khi player gửi message:
```
1. Feed hiện: "[ Đang diễn giải... ]"

2. God Agent respond — cảnh báo trước khi inject:
   "Cơn bão cấp nặng sẽ đổ bộ vào vùng nông nghiệp phía bắc.
    Food giảm ~45% trong 8 ngày. Food hiện đang ở 43% —
    đây có thể trigger collective action."
    [Xác nhận]  [Điều chỉnh]  [Hủy]

3. Player xác nhận → event inject

4. Map: vùng bắc chuyển màu tối, ripple từ epicenter
   Feed: narrative agent viết hậu quả theo thời gian thực

5. Institution agents phản ứng dần qua feed:
   "[Ngày 15] Hội Thương Nhân im lặng — đang tích trữ"
   "[Ngày 16] Chính phủ họp khẩn, chưa tuyên bố"
   "[Ngày 18] Tin đồn lan: bão do trời phạt vì..."
```

### Nút Hiến pháp:
Mở màn hình riêng — xem và (nếu có đủ đồng thuận) đề xuất sửa đổi.

---

## 5. Onboarding — Cuộc trò chuyện đầu tiên

Không có màn hình setup với slider và radio button.  
Thiết lập hiến pháp **là cuộc trò chuyện đầu tiên với God Agent**.

Player là **The Architect** — một role duy nhất xuyên suốt game, từ lúc thiết kế đến lúc inject event.

```
┌──────────────────────────────────────────────────────────┐
│  SOCIETY SIM                                             │
│                                                          │
│  Provider: [Gemini Flash 2.5 ▾]  Key: [____________]    │
│                                            [ Bắt đầu → ]│
└──────────────────────────────────────────────────────────┘
```

Sau khi nhập key → chat mở ra, God Agent lên tiếng trước:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  God Agent:                                              │
│  "Bạn muốn xây dựng xã hội nào?                        │
│   Hãy mô tả — hoặc chọn điểm xuất phát:                │
│   [Bắc Âu]  [Tư bản tự do]  [XHCN]  [Tự mô tả]"       │
│                                                          │
│  Player:                                                 │
│  "Kiểu Bắc Âu nhưng tài nguyên khan hiếm hơn,          │
│   và nhà nước yếu hơn bình thường"                      │
│                                                          │
│  God Agent:                                              │
│  "Tôi hiểu. Đây là thiết lập tôi đề xuất:              │
│   · Gini: 0.31 (bình đẳng vừa)                         │
│   · State power: 0.4 (yếu hơn Bắc Âu chuẩn)           │
│   · Safety net: medium                                  │
│   · Resource scarcity: high                             │
│   · Base trust: 0.58                                    │
│                                                          │
│   Bạn muốn điều chỉnh gì không?"                        │
│                                                          │
│  Player: "Được rồi, bắt đầu đi"                         │
│                                                          │
│  → Sim khởi tạo. Map và feed xuất hiện.                 │
└──────────────────────────────────────────────────────────┘
```

### Tại sao không dùng slider/form:

- Player học cách thế giới hoạt động ngay từ câu đầu tiên
- God Agent có context về *tại sao* player chọn thiết lập đó — dùng được về sau khi giải thích hậu quả
- Player có thể hỏi "nếu chọn XHCN thay vì Bắc Âu thì khác gì?" trước khi quyết định
- Một role duy nhất — không có màn hình riêng biệt, không có context switch

---

## 6. Constitutional Crisis Screen

Xuất hiện khi sim detect xã hội đã drift quá xa hiến pháp ban đầu.

```
┌──────────────────────────────────────────────────────────┐
│  ⚖ KHỦNG HOẢNG HIẾN PHÁP                               │
│                                                          │
│  "Sau 5 năm, xã hội đã thay đổi. Hiến pháp hiện tại     │
│   không còn phản ánh thực tế."                           │
│                                                          │
│  Các institution đang đòi:                               │
│  · Hội Thương Nhân: Mở rộng quyền tư hữu               │
│  · Phe đối lập: Giới hạn quyền lực nhà nước             │
│  · Cộng đồng: Tăng safety net                           │
│                                                          │
│  Đồng thuận hiện tại: 47% (cần 60% để sửa đổi)         │
│  ████████████████████░░░░░░░░  47%                      │
│                                                          │
│  [Giữ hiến pháp hiện tại]  [Triệu tập hội nghị sửa đổi]│
│                                                          │
│  ⚠ Nếu giữ nguyên: political pressure tiếp tục tăng    │
│  ⚠ Nếu sửa đổi: cần thương lượng với các institution   │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Institution Panel (click vào institution trên map)

```
┌──────────────────────────────┐
│ HOI ĐỒNG LÃNH ĐẠO           │
│ ──────────────────────────── │
│ Quyền lực:   ████████░░ 78% │
│ Legitimacy:  █████░░░░░ 48% │
│ Ngân sách:   180 / 500       │
│ ──────────────────────────── │
│ QUYẾT ĐỊNH GẦN ĐÂY          │
│ · [Ngày 45] Tuyên bố điều tra│
│ · [Ngày 40] Lệnh giải tán    │
│ ──────────────────────────── │
│ ĐANG THƯƠNG LƯỢNG VỚI       │
│ · Thị trường (private)       │
│ ──────────────────────────── │
│ ĐÁNH GIÁ CỦA DÂN            │
│ Tin tưởng:  ███░░░░░░░ 34%  │
│ Competence: ████░░░░░░ 41%  │
└──────────────────────────────┘
```

---

## 8. Tech Stack cho UI

```
Render:     PixiJS (WebGL) — heatmap + 10k NPC flow
UI panels:  Vanilla HTML/CSS overlay trên canvas
Narrative:  Gemini Flash 2.5 — viết event text
NPC thought: Gemini Flash 2.5 — gọi khi click spotlight
State:      JS object thuần — không cần framework
```

Không dùng React/Vue — overhead không cần thiết cho sim này.  
Canvas xử lý map. HTML overlay xử lý panels.

---

## Gameplay Loop tóm tắt

```
1. SETUP (5 phút)
   Chọn model xã hội → configure hiến pháp → nhập API key → bắt đầu

2. OBSERVE (ongoing)
   Sim chạy tự động — institutions ra quyết định qua LLM
   Narrative feed cập nhật liên tục
   Macro indicators theo dõi ngưỡng nguy hiểm

3. INJECT (tùy thời điểm)
   Thả event vào → quan sát cascade
   Timing quan trọng hơn loại event

4. CRISIS (khi threshold bị vượt)
   Constitutional crisis xuất hiện
   Quyết định: cải cách hay giữ nguyên
   Hậu quả kéo dài nhiều năm sim

5. REFLECT
   Không có win/lose
   Câu hỏi: xã hội bạn thiết kế thích nghi hay sụp đổ?
   Và tại sao?
```
