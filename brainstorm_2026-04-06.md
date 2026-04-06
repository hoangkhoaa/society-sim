# Brainstorm Session — 2026-04-06

## Mục tiêu

Society simulation mà **con người là nền tảng**, không phải map hay UI.  
Dùng để hoạch định chính sách — thấy được hậu quả khi chọn policy X.  
Scale đến 10,000 người. Event-driven. Không heavy UI.

---

## Core Philosophy

> Người ta không phản ứng với sự thật — họ phản ứng với *phiên bản sự thật* được lọc qua worldview và mạng xã hội của họ.

Simulation không dùng if-then cứng. Mọi hành động là kết quả của:

```
action = f(stress, worldview, social_pressure, perceived_reality)
```

---

## 1. Con người được định nghĩa bởi gì?

### Needs (áp lực tức thời)
```
needs_stress    = hunger + exhaustion + isolation
threat_stress   = unsafe + economic_fear
identity_stress = bị đối xử không xứng với status
```

Stress tích lũy dần. Khi vượt threshold cá nhân → trigger action.  
Không phải ngay lập tức — đây là lý do xã hội ổn định lâu rồi sụp nhanh.

### Worldview (bộ lọc hành động)
Quyết định NPC chọn *loại* phản ứng nào khi stress vượt ngưỡng:

| Trục | Thấp | Cao |
|------|------|-----|
| Collectivist vs Individualist | Tự lo, tích trữ | Chờ cộng đồng giải quyết |
| Authority orientation | Tổ chức phản đối | Tuân theo dù bất mãn |
| Risk tolerance | Thụ động | Hành động sớm |
| Time preference | Tiêu ngay | Dành dụm, tính xa |

### Memory (lịch sử cá nhân)
- 5–10 event gần nhất, weighted by emotional intensity
- Bị phản bội → threshold trust giảm vĩnh viễn một chút
- Được giúp khi khó → loyalty tăng với người đó

### Traits (cố định từ khi sinh)
- adaptability — thay đổi worldview nhanh hay chậm
- social_reach — network rộng hay hẹp
- threshold — cần bao nhiêu stress mới hành động

---

## 2. Cơ chế thích nghi

Người ta **không thay đổi identity trước** — họ thay đổi hành động trước, identity sau (chậm hơn nhiều):

```
Stress tăng
  → đổi hành động nhỏ (làm thêm giờ, tiết kiệm)
  → nếu không đủ → đổi hành động lớn (đình công, di cư)
  → nếu vẫn không đủ → đổi worldview (radicalize hoặc surrender)
```

**Tipping point cá nhân:**
```
NPC A nổi loạn khi > 20% hàng xóm nổi loạn
NPC B nổi loạn khi > 35%
NPC C nổi loạn khi > 10%
```
→ C đủ stress → C hành động → A vượt threshold → cascade.

---

## 3. Network — Thông tin lan thế nào

Mỗi NPC không kết nối với 10,000 người:
```
strong ties:  5–15 người  — gia đình, bạn thân (ảnh hưởng sâu, chậm)
weak ties:   50–150 người — hàng xóm, đồng nghiệp (lan nhanh, ảnh hưởng nông)
```

Thông tin đi theo edge của network, bị méo mỗi bước:
- Người trust thấp → khuếch đại tiêu cực khi truyền
- Người trust cao → giảm nhẹ khi truyền
- **Tin xấu lan nhanh hơn tin tốt** — người bất mãn share nhiều hơn
- **Echo chamber tự hình thành** — cluster worldview giống nhau → narrative ngày càng extreme

Hệ quả: cùng một event, hai nhóm nghe hai phiên bản khác nhau — cả hai đều "đúng" theo góc nhìn của mình.

---

## 4. Trust — Hai chiều, Asymmetric

```
trust_competence  — tôi có tin họ đủ năng lực không?
trust_intention   — tôi có tin họ vì dân không?
```

Mất theo cách khác nhau:
- Crisis không xử lý kịp → mất `competence` (có thể lấy lại)
- Phát hiện tham nhũng → mất `intention` → **gần như không lấy lại được**

Trust quyết định NPC *diễn giải* event thế nào:

| Trust | Mất mùa | Tăng thuế |
|-------|---------|-----------|
| Cao | "Chính phủ sẽ lo" → chờ | "Cần thiết" → chấp nhận |
| Thấp | "Chính phủ bất tài" → tích trữ | "Bóc lột" → phản đối |
| = 0 | "Tự lo" → rời nhóm | "Tôi không thuộc về đây nữa" → radicalize |

---

## 5. Policy System

Policy không tác động trực tiếp lên NPC.  
Nó thay đổi **điều kiện môi trường** → NPC phản ứng theo model của họ.

### 4 loại tác động của mỗi policy:
```
1. Resource effect    — thay đổi food/wealth/safety thực sự
2. Signal effect      — "policy này nói ai được coi trọng"
3. Trust effect       — giữ lời hay không → cộng/trừ trust
4. Distribution effect — ai được lợi, ai mất
```

### Output người dùng thấy:
Không phải số liệu khô (`happiness = 67%`).  
Mà là **narrative emerge từ NPC**:

```
[Ngày 12] Nhóm thợ khu đông bắt đầu họp kín
[Ngày 18] 3 học giả rời trường, chuyển sang buôn bán chợ đen
[Ngày 24] Lãnh đạo phe thợ yêu cầu gặp mặt hội đồng
[Ngày 31] Tin đồn lan: chính phủ sắp thu hồi chính sách
```

---

## 6. Vòng lặp hoàn chỉnh

```
Policy thay đổi điều kiện
  → Resource/signal effect tác động lên từng NPC
  → NPC filter qua worldview + trust → cập nhật stress, belief
  → Hành động thay đổi (work more/less, organize, flee, radicalize)
  → Hành động lan qua network → người khác observe → cập nhật perceived_reality
  → Aggregate thành macro stats + emergent events
  → Emergent events trigger vòng mới
```

---

## Output macro (emerge từ cá nhân, không tính top-down)

```
food_total       = Σ(farmer.base_skill × motivation × weather)
stability        = (avg_trust × network_cohesion) - political_pressure
political_pressure = Σ(npc.grievance × npc.likelihood_to_act_collectively)
inequality       = gini(resource_distribution)
```

`likelihood_to_act_collectively` tăng khi:
- Nhiều người xung quanh cũng bất mãn (social pressure)
- Có organizer xuất hiện
- Rủi ro hành động thấp

---

## 7. Worldview thay đổi theo thời gian

### Cơ chế: Pressure vs Anchor
```
pressure = dissonance tích lũy (thực tế mâu thuẫn với worldview)
anchor   = identity investment + social reinforcement từ cluster
```
Khi `pressure > anchor threshold` → worldview bắt đầu dịch chuyển.  
Hướng dịch chuyển phụ thuộc vào **ai tiếp cận được họ lúc đó**.

### 3 pattern thay đổi
- **Drift chậm** — nhiều trải nghiệm nhỏ cùng chiều tích lũy
- **Conversion** — một trauma lớn mở cửa sổ susceptible, ai fill narrative trước thắng
- **Social contagion** — cluster kéo worldview dần theo mà không nhận ra

### Stress làm worldview extreme hơn, không open hơn
```
stress thấp   → open to new info
stress trung  → cần certainty
stress cao    → double down vào worldview hiện tại
stress cực cao → radicalize về cực đoan nhất trong cluster
```
Hệ quả: policy gây khổ mà không giải thích rõ → dân không mở lòng, họ tìm scapegoat.

### Radicalization funnel
```
Normal → Disgruntled → Seeking → Converted → Activist → Extremist
```
Mỗi bước cần: dissonance đủ lớn + narrative giải thích nỗi đau + community mới + kẻ thù rõ ràng.  
De-radicalization khó hơn nhiều — cần tháo gỡ tất cả đồng thời.

### Model trong simulation
```
mỗi NPC có:
  dissonance_acc  — tích lũy khi thực tế mâu thuẫn worldview
  susceptible     — bool, bật khi acc vượt threshold
  influence_score — ai trong network có ảnh hưởng nhất

khi susceptible = true:
  worldview += weighted_average(neighbors.worldview) × influence_score
  nếu không ai tiếp cận → drift về extreme của cluster (mặc định)
```

---

## 8. Institution Agents

### 5 Institutions — đều là LLM agent độc lập
| Institution | Lợi ích cốt lõi | Công cụ quyền lực |
|-------------|----------------|-------------------|
| Hội đồng lãnh đạo | Duy trì quyền lực, stability | Luật, ngân sách, lực lượng |
| Hội Thương Nhân | Profit, property rights | Giá cả, phân phối hàng hóa |
| Phe đối lập | Lên nắm quyền, xây support base | Narrative, tổ chức quần chúng |
| Cộng đồng/Tôn giáo | Cohesion, trust của dân | Soft power, legitimacy |
| Lực lượng bảo vệ | Sống sót tổ chức, morale đội | Bạo lực hợp pháp (có giới hạn) |

### Prompt Architecture — 3 tầng
```
Tầng 1: System prompt (cố định) — identity, interests, worldview, constraints
Tầng 2: Context prompt (dynamic) — state xã hội + inbox + resources + lịch sử quyết định
Tầng 3: Output format (structured JSON):
  {
    decision: { action, target, resources_spent, timeline },
    public_statement,   ← cái họ nói với dân
    private_intent,     ← cái họ thực sự muốn
    signal_to,          ← nhắm vào institution nào
    risk_assessment,
    reasoning
  }
```

---

## 9. Inter-Institution Communication

### 4 kênh giao tiếp
```
PUBLIC   — tất cả nghe, kể cả dân
PRIVATE  — chỉ người nhận biết
SIGNAL   — hành động thay lời nói
RUMOR    — thông tin rò rỉ, bị méo khi lan
```
Cùng một ý, qua kênh khác nhau → nghĩa khác nhau.  
**Silence cũng là signal** — mỗi bên diễn giải theo trust của họ.

### Các loại giao dịch
```
NON-AGGRESSION | RESOURCE DEAL | INFO EXCHANGE
COALITION      | ENDORSEMENT   | ULTIMATUM
```

### Betrayal & Leak — con dao hai lưỡi
- Deal bị phá → trust penalty lớn + có thể leo thang công khai
- Private message bị leak → sender mất trust với tất cả, nhưng receiver cũng mất trust vì "không giữ bí mật"

---

## 10. Dân quan sát và phản ứng với Institution

### Core insight
> Dân không nghe sự thật — họ nghe mảnh vỡ của sự thật, lọc qua network, rồi giải thích qua worldview.

### Perception Filter
```
perceived_message = actual_message
  × trust_in_sender
  × emotional_state_amplifier    ← stress cao → diễn giải cực đoan hơn
  × worldview_alignment          ← phù hợp worldview → tin hơn
  × network_echo                 ← hàng xóm đang nói gì
```

### Thông tin bị méo khi lan
```
Lần 1: "Chính phủ sẽ phân phối 200 tấn lương thực"
Lần 2: "Chính phủ sắp phát lương thực cho dân"
Lần 3: "Nghe nói chỉ phát cho người thân quen thôi"
Lần 4: "Lương thực bị chia chác hết rồi, dân không được gì"
```
Rule: nội dung thực tế giảm dần, nội dung cảm xúc tăng dần.  
Tin tiêu cực lan nhanh gấp đôi tin tích cực.

### Narrative Competition
Ai đặt tên cho event trước sẽ thắng.  
Cùng một sự kiện, 3 institution phát 3 narrative → mỗi cluster dân adopt narrative khác nhau → "sự thật" phân mảnh.

### 4 tầng phản ứng của dân
```
Tầng 1 — Cảm xúc tức thì (vài giờ): anger | relief | fear | hope | cynicism
Tầng 2 — Hành vi cá nhân (1-3 ngày): tích trữ, làm ít hơn, tìm thông tin
Tầng 3 — Hành vi xã hội (3-10 ngày): nhóm bàn tán, organizer xuất hiện, tẩy chay
Tầng 4 — Hành động tập thể (10+ ngày): biểu tình, đình công, bạo loạn, di cư
```

### 5 điều kiện để Collective Action xảy ra
```
1. SHARED GRIEVANCE    — đủ người cảm thấy bị thiệt hại giống nhau
2. SHARED NARRATIVE    — cùng giải thích "tại sao" và "ai gây ra"
3. SOCIAL PROOF        — thấy người khác đã hành động trước
4. LOW PERCEIVED RISK  — chính phủ không đủ mạnh để đàn áp
5. COORDINATION POINT  — có ai/nơi để tập hợp
```

Institution tác động vào từng điều kiện theo chiều ngược nhau:
| Điều kiện | Phe đối lập | Chính phủ |
|-----------|------------|-----------|
| Shared grievance | Khuếch đại | Phủ nhận, phân tán |
| Shared narrative | Cung cấp narrative mới | Cạnh tranh narrative |
| Social proof | "Hàng trăm người đã xuống đường" | "Chỉ vài kẻ kích động" |
| Perceived risk | "Chính phủ không dám làm gì" | Phô diễn sức mạnh |
| Coordination | Đặt điểm hẹn | Bắt organizer, chặn thông tin |

### Điều institution sợ nhất
```
1000 người bất mãn với 1000 lý do khác nhau = dễ kiểm soát
1000 người bất mãn với CÙNG một narrative = cách mạng
```

---

## 11. Tech Stack

- **10,000 NPC**: Rule-based (nhanh, free)
- **Institution agents**: LLM — Gemini Flash 2.5 (free tier), gọi khi có event lớn hoặc mỗi N ngày sim
- **Narrative generator**: LLM — dịch số liệu thành event log có nghĩa
- **Behavior policy updater**: LLM — cập nhật params cho rule-based layer theo tình trạng xã hội
- **Provider system**: open setting để switch giữa Gemini / Anthropic / OpenAI

```
LLM định nghĩa BEHAVIOR của nhóm người
Rule-based execute hành vi đó cho từng cá nhân
```

---

## 12. Người chơi — Founding Father

Người chơi không phải vua, không phải observer.  
Họ **thiết lập hệ thống ban đầu** rồi để nó chạy — giống viết hiến pháp thật.

### Role duy nhất: The Architect

Không phải Founding Father (setup rồi thôi). Không phải Observer.  
**The Architect** — thiết kế hệ thống từ đầu, rồi tiếp tục can thiệp qua ngôn ngữ tự nhiên xuyên suốt game.

### Lớp 1: Constitutional Setup — cuộc trò chuyện đầu tiên

Không có màn hình slider/form. Thiết lập hiến pháp **là cuộc trò chuyện đầu tiên với God Agent**.

```
God Agent hỏi: "Bạn muốn xây dựng xã hội nào?"
Player mô tả: "Kiểu Bắc Âu nhưng nhà nước yếu hơn, tài nguyên khan hiếm"
God Agent đề xuất params → player confirm hoặc điều chỉnh → sim bắt đầu
```

God Agent giữ context *tại sao* player chọn thiết lập đó — dùng khi giải thích hậu quả về sau.

DNA của xã hội. Muốn sửa giữa chừng cần đủ đồng thuận — constitutional crisis.

```
wealth_distribution_start     — gini ban đầu
power_structure               — institution nào có quyền gì
individual_rights_floor       — NPC không thể bị đối xử tệ hơn mức này
value_priority                — [freedom, equality, security, growth] xếp hạng
safety_net_strength
market_freedom_level
```

Seed toàn bộ sim: worldview NPC ban đầu, trust, gini, resource allocation.

**3 preset ví dụ:**
| | Bắc Âu | Tư bản tự do | XHCN tập trung |
|--|--------|-------------|----------------|
| gini_start | 0.28 | 0.48 | 0.18 |
| state_power | high | low | very high |
| base_trust | 0.72 | 0.45 | 0.65 (decay nhanh) |
| safety_net | strong | weak | strong nhưng fragile |
| npc_bias | collectivist | individualist | collectivist + obedient |

### Lớp 2: Event Injection (trong khi chạy)

Người chơi không ra lệnh — họ **thả event vào** và quan sát phản ứng.

**Nature Events:**
```
drought | flood | epidemic | resource_boom | harsh_winter
```

**World Events:**
```
trade_offer | refugee_wave | ideology_import | external_threat | blockade
```

**Catalyst Events:**
```
scandal_leak | charismatic_npc | martyr_event | technology_shift
```

Cùng event, cùng hiến pháp — **timing thay đổi tất cả.**

### Constitutional Crisis

Khi xã hội drift đủ xa so với hiến pháp ban đầu:
- Institution đòi sửa đổi
- Người chơi quyết định: giữ nguyên hay cải cách?
- Cải cách cần đủ đồng thuận — nếu không đủ → fracture

### Gameplay Loop thật sự

```
Viết hiến pháp
  → Sim chạy, institutions hành động trong giới hạn hiến pháp
  → Spawn events để test hệ thống
  → Quan sát narrative emerge
  → Xã hội drift → constitutional crisis xuất hiện
  → Quyết định: cải cách hay giữ nguyên
  → Vòng mới với DNA đã thay đổi
```

Không có win/lose — chỉ có **thích nghi hay sụp đổ**.

---

## 13. God Agent — Người chơi nói chuyện với thế giới

Người chơi không dùng menu. Họ **chat bằng ngôn ngữ tự nhiên** — God Agent dịch sang event có cấu trúc rồi inject vào simulation.

### Pipeline

```
Player chat ("tạo cơn bão to")
  → God Agent (LLM) — diễn giải intent → event object
  → Simulation Engine — inject, chạy cascade rule-based
  → Institution Agents (LLM) — phản ứng
  → Narrative Agent (LLM) — viết thành câu chuyện
  → Map + Feed cập nhật
```

### God Agent làm 3 việc khi nhận input

```
1. Diễn giải intent → event object có cấu trúc
2. Kiểm tra tính hợp lý với world state → cảnh báo nếu catastrophic
3. Generate narrative_open — câu mở đầu của câu chuyện
```

### Player có thể nói

```
Tạo event:    "tạo cơn bão to", "rò rỉ tham nhũng hội đồng"
Hỏi thế giới: "tại sao dân bất ổn?", "nếu gây bão lúc này thì sao?"
Tác động tinh tế: "làm một nông dân trở nên nổi tiếng"
               "lan một tư tưởng mới về quyền tư hữu"
```

### Confirm trước khi inject

Agent cảnh báo hậu quả nghiêm trọng, cho player xác nhận / điều chỉnh / hủy.  
Không chặn — nhưng không inject ngầm.

### God Agent System Prompt core

```
Bạn là The Narrator — kiểm soát lực lượng tự nhiên và xã hội.
Không phải nhân vật trong sim. Là người kể chuyện.
Output: JSON event object + một câu narrative ngắn gọn có chiều sâu.
```

---

## Câu hỏi còn mở

- [ ] Granularity: full simulate 10k hay cluster + representative agent?
- [ ] Worldview của institution có drift theo thời gian không?
- [ ] Constitutional crisis trigger ở threshold nào?
- [ ] God Agent có nhớ lịch sử các event đã inject không (memory)?
