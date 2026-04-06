# Society Sim

Một thế giới sống. Bạn nói chuyện với nó — và nó phản ứng theo logic của chính nó.

---

## Ý tưởng cốt lõi

Bạn không phải nhà vua. Không phải người quản lý.  
Bạn là **The Narrator** — người thiết lập luật chơi ban đầu, rồi thả những sự kiện vào và xem điều gì xảy ra.

Gõ *"tạo cơn bão to"* — một AI agent dịch intent của bạn thành event có cấu trúc, inject vào simulation, và một chuỗi phản ứng bắt đầu: thương nhân tích trữ, chính phủ họp khẩn, tin đồn lan, dân bắt đầu họp kín. Không ai hỏi bạn. Họ phản ứng theo con người của họ.

**Không có win. Không có lose.**  
Chỉ có câu hỏi: xã hội bạn thiết kế thích nghi hay sụp đổ?

---

## Con người là nền tảng

Mỗi NPC không phải dot trên map. Họ có:

- **Needs** — đói, mệt, cô đơn, sợ hãi
- **Worldview** — collectivist hay individualist, tin hay không tin chính phủ
- **Memory** — nhớ lần bị phản bội, nhớ lần được giúp
- **Network** — 5–15 người thân, 50–150 người quen

Họ không nhận lệnh. Họ phản ứng với áp lực tích lũy, lọc qua bộ lọc của chính mình, lan qua network của họ. Cùng một event — mỗi người nghe một phiên bản khác nhau.

---

## Kiến trúc

```
Player Chat ("tạo cơn bão to")
  → God Agent (LLM) — diễn giải → event có cấu trúc
  → Simulation Engine — cascade rule-based cho 10,000 NPC
  → Institution Agents (LLM) — 5 institutions phản ứng độc lập
  → Narrative Agent (LLM) — viết lại thành câu chuyện
  → Map + Feed cập nhật
```

### 3 tầng AI

| Tầng | Vai trò | Khi nào gọi |
|------|---------|-------------|
| God Agent | Dịch chat → event, trả lời câu hỏi về thế giới | Mỗi lần player gửi message |
| Institution Agents (×5) | Chính phủ, Thị trường, Phe đối lập, Cộng đồng, Lực lượng | Khi có event lớn / mỗi N ngày sim |
| Narrative Agent | Viết event log thành câu chuyện có chiều sâu | Khi có event đáng kể |

10,000 NPC chạy **rule-based** — nhanh, không tốn token. AI chỉ ở nơi cần judgment.

---

## Gameplay

Người chơi là **The Architect** — một role duy nhất xuyên suốt. Không có màn hình setup riêng, không có context switch.

### Bước 1 — Cuộc trò chuyện đầu tiên
Nhập API key → God Agent hỏi: *"Bạn muốn xây dựng xã hội nào?"*  
Mô tả bằng ngôn ngữ tự nhiên. Agent đề xuất params, bạn confirm.  
Đây là DNA của xã hội — quyết định worldview ban đầu của dân, quyền lực từng institution, safety net, gini.

### Bước 2 — Quan sát
Sim tự chạy. Institutions ra quyết định. Dân phản ứng. Narrative feed cập nhật.

### Bước 3 — Nói chuyện với thế giới
Gõ bất cứ thứ gì vào chat:
```
"tạo cơn bão to ở phía bắc"
"rò rỉ thông tin tham nhũng của hội đồng"
"tại sao dân đang bất ổn?"
"nếu tôi gây bão lúc này thì sao?"
```
God Agent diễn giải, cảnh báo hậu quả, hỏi xác nhận, rồi inject.

### Bước 4 — Khủng hoảng hiến pháp
Khi xã hội drift đủ xa so với thiết kế ban đầu — institutions đòi sửa đổi.  
Bạn quyết định: giữ nguyên hay cải cách. Cả hai đều có giá.

---

## Files

```
society_sim.html          — prototype gốc (30 NPC, canvas 2D, zero deps)
brainstorm_2026-04-06.md  — toàn bộ design decisions và cơ chế
ui_gameplay_design.md     — thiết kế UI và gameplay chi tiết
```

---

## Stack dự kiến

- **Render:** PixiJS (WebGL) — heatmap + 10k NPC
- **UI:** Vanilla HTML/CSS overlay
- **AI:** Gemini Flash 2.5 (mặc định, free tier) — open setting để switch provider
- **Simulation:** JavaScript thuần — không framework
- **Zero backend** — chạy trên browser, API key do người dùng tự cung cấp
