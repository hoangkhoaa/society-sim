// ── Free Press — Headline Generation System ─────────────────────────────────
//
// Periodically (every 5 sim-days) generates "newspaper" headlines that describe
// aggregate NPC behavior and societal trends.  Two modes:
//   1. Template mode (default): picks from ~100 pre-written templates keyed
//      to macro conditions + NPC behavioral signals.
//   2. AI mode (token_mode === 'unlimited'): calls the LLM for richer text.
//
// Headlines feed into the main feed & chronicle and are also passed as context
// to the Government cycle so it can "read the press" before deciding policy.

import type { WorldState, AIConfig, Rumor } from '../types'
import { addFeedRaw, addChronicle } from '../ui/feed'
import { callAI } from '../ai/provider'
import { getLang } from '../i18n'
import {
  pressSystemPrompt,
  pressSnapshotPrompt,
  pressShouldUseAI,
  type PressScan,
} from '../local/press'

// ── Snapshot of societal signals for condition matching ─────────────────────

function scanSociety(state: WorldState): PressScan {
  const living = state.npcs.filter(n => n.lifecycle.is_alive)
  const n = living.length || 1
  const m = state.macro
  const sick       = living.filter(n => n.sick).length
  const fleeing    = living.filter(n => n.action_state === 'fleeing').length
  const organizing = living.filter(n => n.action_state === 'organizing').length
  const confront   = living.filter(n => n.action_state === 'confront').length
  const resting    = living.filter(n => n.action_state === 'resting').length

  const merchants = living.filter(n => n.role === 'merchant')
  const farmers   = living.filter(n => n.role === 'farmer')

  return {
    food: m.food,
    stability: m.stability,
    trust: m.trust,
    gini: m.gini,
    pressure: m.political_pressure,
    resources: m.natural_resources,
    energy: m.energy,
    literacy: m.literacy,
    population: living.length,
    sickPct:       sick / n * 100,
    fleeingPct:    fleeing / n * 100,
    organizingPct: organizing / n * 100,
    confrontPct:   confront / n * 100,
    restingPct:    resting / n * 100,
    avgGrievance:  living.reduce((s, x) => s + x.grievance, 0) / n,
    avgStress:     living.reduce((s, x) => s + x.stress, 0) / n,
    avgHappiness:  living.reduce((s, x) => s + x.happiness, 0) / n,
    avgHunger:     living.reduce((s, x) => s + x.hunger, 0) / n,
    epidemicActive: state.active_events.some(e => e.type === 'epidemic'),
    threatActive:   state.active_events.some(e => e.type === 'external_threat'),
    blockadeActive: state.active_events.some(e => e.type === 'blockade'),
    droughtActive:  state.active_events.some(e => e.type === 'drought'),
    isWinter:       state.day > 270 || state.day <= 90,
    merchantAvgWealth: merchants.length ? merchants.reduce((s, x) => s + x.wealth, 0) / merchants.length : 0,
    farmerAvgWealth:   farmers.length   ? farmers.reduce((s, x) => s + x.wealth, 0) / farmers.length     : 0,
  }
}

// ── Template Headline Pool ──────────────────────────────────────────────────
// Each template has a condition function and a headline (with optional %vars%).

type TextOrFn = string | ((s: PressScan) => string)

interface HeadlineTemplate {
  cond: (s: PressScan) => boolean
  en: TextOrFn
  vi: TextOrFn
  severity: 'info' | 'warning' | 'critical'
}

function h(cond: (s: PressScan) => boolean, en: TextOrFn, vi: TextOrFn, severity: 'info' | 'warning' | 'critical'): HeadlineTemplate {
  return { cond, en, vi, severity }
}

const TEMPLATES: HeadlineTemplate[] = [
  // ── Food / Hunger ──
  h(s => s.food < 10,               '🍞 Famine grips the land — citizens report days without a meal.',             '🍞 Nạn đói hoành hành — dân chúng nhiều ngày không có bữa ăn.', 'critical'),
  h(s => s.food < 20,               '🍞 Food shortages worsen. Families skip meals to feed children first.',       '🍞 Thiếu lương thực trầm trọng. Gia đình nhịn ăn nhường phần cho trẻ em.', 'critical'),
  h(s => s.food < 30,               '🍞 Bread lines grow longer. Residents worry about next week\'s supply.',      '🍞 Hàng xếp mua bánh mì ngày càng dài. Người dân lo lắng cho tuần tới.', 'warning'),
  h(s => s.food < 40 && s.isWinter, '🍞 Winter rations dwindling — farmers warn harvest stores are nearly empty.', '🍞 Khẩu phần mùa đông cạn kiệt — nông dân cảnh báo kho lúa gần hết.', 'warning'),
  h(s => s.avgHunger > 60,          '🍞 Hunger spreads across neighborhoods; theft of food stocks reported.',       '🍞 Cái đói lan rộng; xuất hiện tình trạng trộm cắp lương thực.', 'warning'),
  h(s => s.food > 85,               '🌾 Abundant harvests this season — granaries overflowing, prices drop.',       '🌾 Mùa bội thu — kho thóc tràn đầy, giá lương thực giảm.', 'info'),
  h(s => s.food > 70 && s.isWinter, '🌾 Despite the cold, food reserves remain strong. Citizens are well-fed.',    '🌾 Dù trời lạnh, dự trữ lương thực vẫn dồi dào. Người dân no đủ.', 'info'),

  // ── Stability / Order ──
  h(s => s.stability < 15,                '⚠️ Society on the brink of collapse — order has effectively broken down.',   '⚠️ Xã hội bên bờ sụp đổ — trật tự đã tan rã hoàn toàn.', 'critical'),
  h(s => s.stability < 25,                '⚠️ Civil unrest intensifies; institutions struggle to maintain control.',     '⚠️ Bạo loạn dân sự gia tăng; các thể chế chật vật duy trì trật tự.', 'critical'),
  h(s => s.stability < 40,                '⚠️ Growing disorder in several districts. Leaders urge calm.',               '⚠️ Mất trật tự lan rộng ở nhiều khu vực. Lãnh đạo kêu gọi bình tĩnh.', 'warning'),
  h(s => s.stability > 80,                '✅ Streets are calm. Citizens report feeling safe and optimistic.',            '✅ Đường phố yên bình. Người dân cảm thấy an toàn và lạc quan.', 'info'),
  h(s => s.stability > 70 && s.trust > 60, '✅ Trust in institutions holds steady — a period of relative tranquility.',  '✅ Niềm tin vào thể chế ổn định — một giai đoạn tương đối yên bình.', 'info'),

  // ── Trust / Government ──
  h(s => s.trust < 15, '🏛 Government legitimacy in freefall — citizens openly defy authority.',       '🏛 Uy tín chính quyền rơi tự do — dân công khai chống đối.', 'critical'),
  h(s => s.trust < 25, '🏛 "They don\'t represent us" — trust in government at historic lows.',        '🏛 "Họ không đại diện cho chúng tôi" — niềm tin vào chính quyền thấp kỷ lục.', 'critical'),
  h(s => s.trust < 40, '🏛 Skepticism grows: citizens question official statements.',                  '🏛 Hoài nghi gia tăng: dân chúng đặt câu hỏi về tuyên bố chính thức.', 'warning'),
  h(s => s.trust > 75, '🏛 Public approval of the council remains high. Policies seen as fair.',       '🏛 Tỉ lệ ủng hộ hội đồng vẫn cao. Chính sách được xem là công bằng.', 'info'),

  // ── Inequality / Economy ──
  h(s => s.gini > 0.65,                          '💰 Extreme wealth gap: the rich feast while the poor starve.',                  '💰 Chênh lệch giàu nghèo cực đoan: người giàu yến tiệc, người nghèo đói khổ.', 'critical'),
  h(s => s.gini > 0.55,                          '💰 Growing inequality strains social fabric. Envy and resentment brew.',         '💰 Bất bình đẳng gia tăng xé rách kết cấu xã hội. Đố kỵ và oán hận nhen nhóm.', 'warning'),
  h(s => s.gini > 0.45 && s.avgGrievance > 40,   '💰 Citizens demand fairer distribution — "enough is enough."',                  '💰 Dân chúng đòi phân phối công bằng hơn — "đã quá đủ rồi."', 'warning'),
  h(s => s.gini < 0.25,                          '⚖️ Remarkable equality: wealth distribution is among the most even ever.',      '⚖️ Bình đẳng đáng kinh ngạc: phân phối tài sản đồng đều nhất từ trước đến nay.', 'info'),
  h(s => s.energy < 20,                          '📉 Economy in deep recession — workshops idle, trade stagnant.',                '📉 Kinh tế suy thoái nặng — xưởng đóng cửa, thương mại trì trệ.', 'critical'),
  h(s => s.energy < 35,                          '📉 Economic slowdown: productivity falling, merchants report poor sales.',       '📉 Kinh tế chững lại: năng suất giảm, thương nhân báo cáo doanh thu kém.', 'warning'),
  h(s => s.energy > 80,                          '📈 Economic boom! Markets bustling, artisans can\'t keep up with demand.',       '📈 Kinh tế bùng nổ! Chợ nhộn nhịp, thợ thủ công không kịp đáp ứng nhu cầu.', 'info'),
  h(s => s.energy > 65 && s.gini < 0.40,         '📈 Broad-based prosperity: growth is lifting all boats.',                       '📈 Thịnh vượng toàn diện: tăng trưởng nâng đỡ mọi tầng lớp.', 'info'),

  // ── Political Pressure / Protest ──
  h(s => s.pressure > 80,       s => `✊ Mass uprising — ${Math.round(s.organizingPct + s.confrontPct)}% of citizens in open revolt.`,                        s => `✊ Nổi dậy hàng loạt — ${Math.round(s.organizingPct + s.confrontPct)}% dân chúng công khai nổi loạn.`, 'critical'),
  h(s => s.pressure > 60,       '✊ Thousands march in the streets. Organizers call for systemic change.',           '✊ Hàng nghìn người xuống đường biểu tình. Lãnh đạo phong trào kêu gọi thay đổi hệ thống.', 'critical'),
  h(s => s.pressure > 40,       '✊ Growing protests. Community leaders demand government action.',                  '✊ Biểu tình lan rộng. Lãnh đạo cộng đồng yêu cầu chính quyền hành động.', 'warning'),
  h(s => s.organizingPct > 15,  s => `✊ Organized resistance spreads: ${Math.round(s.organizingPct)}% of the population mobilizing.`, s => `✊ Phản kháng có tổ chức lan rộng: ${Math.round(s.organizingPct)}% dân số đang tập hợp.`, 'warning'),
  h(s => s.confrontPct > 10,    s => `⚔️ Violent clashes reported — ${Math.round(s.confrontPct)}% of citizens in direct confrontation.`, s => `⚔️ Xung đột bạo lực — ${Math.round(s.confrontPct)}% dân chúng đối đầu trực tiếp.`, 'critical'),
  h(s => s.confrontPct > 5,     '⚔️ Sporadic violence in public squares. Guards deployed.',                         '⚔️ Bạo lực lẻ tẻ tại quảng trường. Lính canh được triển khai.', 'warning'),
  h(s => s.pressure < 10 && s.stability > 60, '🕊 Political calm: no significant protests reported this period.',   '🕊 Chính trị yên ổn: không có biểu tình đáng kể trong kỳ này.', 'info'),

  // ── Epidemic / Health ──
  h(s => s.epidemicActive && s.sickPct > 20, s => `🏥 Epidemic crisis — ${Math.round(s.sickPct)}% of the population is ill.`,  s => `🏥 Khủng hoảng dịch bệnh — ${Math.round(s.sickPct)}% dân số đang bị bệnh.`, 'critical'),
  h(s => s.epidemicActive && s.sickPct > 10, '🏥 Disease continues to spread. Citizens avoid public gatherings.',               '🏥 Dịch bệnh tiếp tục lây lan. Dân chúng tránh tụ tập nơi đông người.', 'warning'),
  h(s => s.epidemicActive,                   '🏥 Health authorities report a new outbreak. Citizens urged to take precautions.', '🏥 Cơ quan y tế báo cáo ổ dịch mới. Dân chúng được khuyến cáo phòng ngừa.', 'warning'),
  h(s => s.sickPct > 15 && !s.epidemicActive, '🏥 Seasonal illness wave: many workers absent. Productivity suffers.',           '🏥 Làn sóng bệnh theo mùa: nhiều công nhân nghỉ ốm. Năng suất sụt giảm.', 'warning'),
  h(s => s.sickPct < 2,                      '💚 Public health is strong — illness rates at all-time lows.',                    '💚 Sức khỏe cộng đồng tốt — tỉ lệ bệnh tật thấp kỷ lục.', 'info'),

  // ── Fleeing / Migration ──
  h(s => s.fleeingPct > 15, s => `🏃 Exodus — ${Math.round(s.fleeingPct)}% of citizens are fleeing their homes.`,              s => `🏃 Làn sóng di cư — ${Math.round(s.fleeingPct)}% dân chúng đang bỏ nhà ra đi.`, 'critical'),
  h(s => s.fleeingPct > 5,  '🏃 Families pack up and leave. Fear drives a growing wave of internal refugees.',                  '🏃 Gia đình gói ghém ra đi. Nỗi sợ thúc đẩy làn sóng tị nạn nội địa.', 'warning'),
  h(s => s.fleeingPct > 2,  '🏃 Scattered reports of residents relocating to safer districts.',                                 '🏃 Rải rác tin người dân chuyển đến các khu vực an toàn hơn.', 'info'),

  // ── Stress / Mental Health ──
  h(s => s.avgStress > 70,                       '😰 Citizens report severe anxiety. Mental health crisis grips the population.',      '😰 Dân chúng báo cáo lo âu nghiêm trọng. Khủng hoảng sức khỏe tâm thần bao trùm.', 'critical'),
  h(s => s.avgStress > 50,                       '😰 Stress levels rising — sleeplessness, irritability, and conflict on the rise.',   '😰 Mức stress tăng — mất ngủ, cáu gắt và xung đột gia tăng.', 'warning'),
  h(s => s.avgStress < 20 && s.avgHappiness > 65, '😊 Citizens are content. Stress is low and spirits are high.',                     '😊 Dân chúng hài lòng. Stress thấp, tinh thần cao.', 'info'),
  h(s => s.avgHappiness < 25,                    '😔 Morale at rock bottom. Citizens describe feeling hopeless.',                      '😔 Tinh thần chạm đáy. Người dân mô tả cảm giác tuyệt vọng.', 'critical'),
  h(s => s.avgHappiness < 40,                    '😔 General dissatisfaction: most citizens report unhappiness with their lives.',      '😔 Bất mãn lan tràn: đa số dân chúng không hài lòng với cuộc sống.', 'warning'),
  h(s => s.avgHappiness > 70,                    '😊 Survey: majority of citizens say they are happy with current conditions.',         '😊 Khảo sát: đa số dân chúng nói họ hạnh phúc với điều kiện hiện tại.', 'info'),

  // ── Resources ──
  h(s => s.resources < 10, '⛏ Natural resources nearly exhausted. Craftsmen unable to source materials.',  '⛏ Tài nguyên thiên nhiên gần cạn kiệt. Thợ thủ công không tìm được nguyên liệu.', 'critical'),
  h(s => s.resources < 25, '⛏ Resource depletion accelerates. Industry warns of supply chain collapse.',   '⛏ Khai thác tài nguyên tăng tốc. Ngành công nghiệp cảnh báo chuỗi cung ứng sắp đổ.', 'warning'),
  h(s => s.resources > 80, '⛏ Resource abundance: forests thick, mines productive, land fertile.',         '⛏ Tài nguyên dồi dào: rừng rậm, mỏ hiệu quả, đất phì nhiêu.', 'info'),

  // ── Literacy / Education ──
  h(s => s.literacy > 80, '📚 Academic renaissance — literacy rates soar, knowledge economy thriving.',    '📚 Phục hưng học thuật — tỉ lệ biết chữ tăng vọt, kinh tế tri thức phát triển.', 'info'),
  h(s => s.literacy < 20, '📚 Education crisis: illiteracy rising, scholars marginalized.',                '📚 Khủng hoảng giáo dục: mù chữ gia tăng, học giả bị gạt ra bên lề.', 'warning'),

  // ── External Events ──
  h(s => s.threatActive,   '🗡 External threat looms — citizens rally behind the government... for now.',  '🗡 Mối đe dọa bên ngoài — dân chúng tạm đoàn kết sau lưng chính quyền.', 'warning'),
  h(s => s.blockadeActive, '🚫 Blockade strangles trade routes. Merchants report catastrophic losses.',    '🚫 Phong tỏa bóp nghẹt thương mại. Thương nhân báo cáo tổn thất thảm khốc.', 'critical'),
  h(s => s.droughtActive,  '☀️ Drought parches the fields. Farmers pray for rain.',                        '☀️ Hạn hán thiêu đốt cánh đồng. Nông dân cầu mưa.', 'warning'),

  // ── Behavioral / Resistance ──
  h(s => s.epidemicActive && s.restingPct > 40,       '🏠 Citizens self-isolate en masse — streets eerily quiet during epidemic.',         '🏠 Dân chúng tự cách ly hàng loạt — đường phố vắng lặng đáng sợ giữa dịch.', 'warning'),
  h(s => s.avgGrievance > 60 && s.gini > 0.45,        '💢 "We can\'t take it anymore" — grievance at dangerous levels.',                  '💢 "Chúng tôi không chịu nổi nữa" — oán hận đạt mức nguy hiểm.', 'critical'),
  h(s => s.avgGrievance > 45,                         '💢 Discontent simmers beneath the surface. Whispered complaints grow louder.',      '💢 Bất mãn âm ỉ dưới bề mặt. Lời phàn nàn thì thầm ngày càng lớn.', 'warning'),
  h(s => s.avgGrievance < 15,                         '🤝 Citizens express general satisfaction. Grievances are at historic lows.',        '🤝 Dân chúng bày tỏ sự hài lòng. Oán hận ở mức thấp kỷ lục.', 'info'),

  // ── Trade / Market ──
  h(s => s.merchantAvgWealth > 2000 && s.gini > 0.50, '💎 Merchants amass fortunes while common folk struggle. Resentment builds.',      '💎 Thương nhân tích góp của cải trong khi dân thường chật vật. Oán hận gia tăng.', 'warning'),
  h(s => s.merchantAvgWealth < 300,                   '📦 Merchant class in crisis — trade collapses, shops close.',                      '📦 Tầng lớp thương nhân khủng hoảng — thương mại sụp đổ, cửa hàng đóng cửa.', 'warning'),
  h(s => s.farmerAvgWealth < 200 && s.food < 40,      '🌾 Farmers impoverished despite food crisis. System failing producers.',           '🌾 Nông dân nghèo đói giữa khủng hoảng lương thực. Hệ thống bỏ rơi người sản xuất.', 'critical'),

  // ── Compound / Situational ──
  h(s => s.food < 30 && s.pressure > 50,             '🔥 Hunger + unrest = powder keg. One spark could ignite revolution.',               '🔥 Đói + bất ổn = thùng thuốc súng. Một tia lửa có thể châm ngòi cách mạng.', 'critical'),
  h(s => s.stability < 30 && s.trust < 30,           '🔥 Neither law nor trust remain. Society teeters on the edge of anarchy.',          '🔥 Không còn luật pháp lẫn niềm tin. Xã hội chênh vênh bên bờ vô chính phủ.', 'critical'),
  h(s => s.energy > 60 && s.food > 60 && s.stability > 60, '🌟 A golden era: economy, food, and stability all strong.',                  '🌟 Kỷ nguyên vàng: kinh tế, lương thực và ổn định đều mạnh.', 'info'),
  h(s => s.gini > 0.50 && s.pressure > 30 && s.trust < 40, '⚡ Class tension escalates: the wealthy barricade, the poor organize.',       '⚡ Căng thẳng giai cấp leo thang: người giàu cố thủ, người nghèo tổ chức.', 'warning'),
  h(s => s.epidemicActive && s.food < 35,            '💀 Double blow: epidemic rages as food runs out. Deaths accelerate.',                '💀 Cú đấm kép: dịch bệnh hoành hành khi lương thực cạn. Số người chết tăng nhanh.', 'critical'),
  h(s => s.fleeingPct > 5 && s.confrontPct > 3,     '🌪 Society fractures — some flee, others fight. No consensus in sight.',             '🌪 Xã hội nứt vỡ — người bỏ chạy, kẻ chiến đấu. Không có đồng thuận.', 'critical'),
  h(s => s.isWinter && s.food < 35 && s.resources < 30, '❄️ Harsh winter: fuel and food both scarce. The weakest suffer most.',           '❄️ Mùa đông khắc nghiệt: nhiên liệu và lương thực đều khan hiếm. Người yếu khổ nhất.', 'critical'),
  h(s => s.trust > 50 && s.pressure > 30,           '🗳 Citizens still trust government — but patience is wearing thin.',                 '🗳 Dân vẫn tin chính quyền — nhưng sự kiên nhẫn đang cạn dần.', 'warning'),
  h(s => s.trust < 30 && s.pressure < 15,           '😶 Quiet discontent: citizens don\'t trust the government but are too afraid to act.', '😶 Bất mãn thầm lặng: dân không tin chính quyền nhưng sợ không dám hành động.', 'warning'),
  h(s => s.avgStress > 40 && s.organizingPct < 3,   '😶 Stress is high but resistance is low — a population enduring in silence.',         '😶 Stress cao nhưng phản kháng thấp — dân chúng cam chịu trong im lặng.', 'info'),
  h(s => s.literacy > 60 && s.pressure > 30,        '📝 Educated populace fuels articulate dissent. Pamphlets circulate.',                 '📝 Dân trí cao thúc đẩy phản đối có lý lẽ. Truyền đơn được phát tán.', 'warning'),
  h(s => s.organizingPct > 8 && s.confrontPct < 2,  '✊ Peaceful mass mobilization: organizers maintain discipline.',                      '✊ Biểu tình hòa bình quy mô lớn: người tổ chức duy trì kỷ luật.', 'warning'),
  h(s => s.sickPct > 8 && s.energy < 40,            '🏭 Absenteeism cripples industry — sick workers can\'t keep the economy running.',    '🏭 Vắng mặt làm tê liệt công nghiệp — công nhân ốm không thể vận hành kinh tế.', 'warning'),
  h(s => s.food > 60 && s.avgHunger > 40,           '📊 Paradox: food exists, but distribution fails. The hungry can\'t access supplies.', '📊 Nghịch lý: lương thực có nhưng phân phối thất bại. Người đói không tiếp cận được.', 'warning'),
  h(s => s.gini < 0.30 && s.energy > 50,            '🏘 Egalitarian prosperity: communities thrive through shared resources.',             '🏘 Thịnh vượng bình đẳng: cộng đồng phát triển nhờ chia sẻ tài nguyên.', 'info'),
  h(s => s.blockadeActive && s.merchantAvgWealth < 500, '🚢 Blockade devastates merchant class. Black markets emerge.',                   '🚢 Phong tỏa tàn phá tầng lớp thương nhân. Chợ đen xuất hiện.', 'warning'),
  h(s => s.threatActive && s.stability > 50,         '🛡 External threat unites the people. Internal differences temporarily shelved.',     '🛡 Mối đe dọa bên ngoài đoàn kết dân chúng. Bất đồng nội bộ tạm gác.', 'info'),
  h(s => s.population < 300,  s => `📉 Population decline: only ${s.population} citizens remain.`,                                        s => `📉 Dân số suy giảm: chỉ còn ${s.population} cư dân.`, 'warning'),
  h(s => s.population < 150,  s => `☠️ Demographic collapse: ${s.population} souls cling to survival.`,                                   s => `☠️ Sụp đổ nhân khẩu: ${s.population} linh hồn bám víu sự sống.`, 'critical'),
  h(s => s.avgStress > 55 && s.avgHappiness < 35,   '💔 Despair pervades — high stress and low morale create a broken society.',            '💔 Tuyệt vọng bao trùm — stress cao, tinh thần thấp tạo nên xã hội đổ vỡ.', 'critical'),
  h(s => s.energy > 50 && s.trust > 50 && s.food > 50 && s.stability > 50, '📰 All indicators stable. A quiet news day — which is itself news.', '📰 Mọi chỉ số ổn định. Một ngày tin tức yên ả — bản thân điều đó cũng là tin.', 'info'),

  // ── Resistance-specific ──
  h(s => s.epidemicActive && s.organizingPct < 3 && s.restingPct > 35, '🏠 Self-preservation overrides solidarity — people stay home to survive.', '🏠 Bản năng tự bảo vệ vượt qua đoàn kết — người dân ở nhà để sống sót.', 'info'),
  h(s => s.avgGrievance > 50 && s.energy < 40,     '🛑 Citizens tighten their belts — reduced spending as a form of quiet protest.',       '🛑 Dân chúng thắt lưng buộc bụng — giảm chi tiêu như một hình thức phản đối thầm lặng.', 'warning'),
  h(s => s.trust < 25 && s.gini > 0.45,            '🏴 Underground economy grows: citizens bypass state channels entirely.',               '🏴 Kinh tế ngầm phát triển: dân chúng bỏ qua hoàn toàn các kênh nhà nước.', 'warning'),
  h(s => s.pressure > 50 && s.confrontPct > 5,     '⚔️ From words to weapons — peaceful protest turns violent in some districts.',         '⚔️ Từ lời nói đến vũ khí — biểu tình hòa bình chuyển bạo lực ở một số khu.', 'critical'),
  h(s => s.avgGrievance > 40 && s.stability > 60,  '🎭 Surface calm hides deep discontent — grievance rises behind closed doors.',         '🎭 Yên ả bề ngoài che giấu bất mãn sâu xa — oán hận tăng sau cánh cửa đóng.', 'warning'),
  h(s => s.confrontPct > 2 && s.fleeingPct > 3,    '🌊 Society splits: confrontation in the plazas, flight at the gates.',                '🌊 Xã hội chia rẽ: đối đầu ở quảng trường, bỏ chạy ở cổng thành.', 'warning'),
  h(s => s.food < 20 && s.farmerAvgWealth < 300,   '🌾 Farmers refuse to sell at state prices — hidden granaries suspected.',              '🌾 Nông dân từ chối bán giá nhà nước — nghi ngờ có kho lương thực giấu.', 'warning'),
  h(s => s.stability > 70 && s.avgHappiness > 60,  '🏡 Life is good: families gather, children play, the future feels bright.',            '🏡 Cuộc sống tốt đẹp: gia đình sum họp, trẻ em vui chơi, tương lai tươi sáng.', 'info'),
  h(s => s.resources < 20 && s.energy < 30,        '⛏ Resource crisis fuels economic decline. A vicious cycle with no easy exit.',          '⛏ Khủng hoảng tài nguyên đẩy kinh tế suy thoái. Vòng xoáy không lối thoát.', 'critical'),
  h(s => s.literacy > 70 && s.trust > 60,          '🎓 Educated and trusting: the ideal foundation for long-term growth.',                 '🎓 Dân trí cao và tin tưởng: nền tảng lý tưởng cho tăng trưởng dài hạn.', 'info'),
  h(s => s.gini > 0.55 && s.merchantAvgWealth > 1500, '🏦 Merchant oligarchy consolidates. Wealth concentrates at the top.',              '🏦 Tài phiệt thương nhân củng cố quyền lực. Của cải tập trung ở đỉnh.', 'warning'),
  h(s => s.avgStress < 25 && s.avgGrievance < 20 && s.avgHappiness > 55, '☮️ Peace index high: citizens lead calm, stable lives.',        '☮️ Chỉ số hòa bình cao: dân chúng sống cuộc đời bình yên, ổn định.', 'info'),
]

// ── Template selection ──────────────────────────────────────────────────────

function resolveText(t: HeadlineTemplate, scan: PressScan): string {
  const lang = getLang()
  const raw = lang === 'vi' ? t.vi : t.en
  return typeof raw === 'function' ? raw(scan) : raw
}

function selectHeadlines(scan: PressScan, maxCount: number): { text: string; severity: 'info' | 'warning' | 'critical' }[] {
  const matching = TEMPLATES.filter(t => t.cond(scan))
  const critical = matching.filter(t => t.severity === 'critical').sort(() => Math.random() - 0.5)
  const warning  = matching.filter(t => t.severity === 'warning').sort(() => Math.random() - 0.5)
  const info     = matching.filter(t => t.severity === 'info').sort(() => Math.random() - 0.5)
  const picked: { text: string; severity: 'info' | 'warning' | 'critical' }[] = []
  for (const pool of [critical, warning, info]) {
    for (const t of pool) {
      if (picked.length >= maxCount) break
      picked.push({ text: resolveText(t, scan), severity: t.severity })
    }
  }
  return picked
}

// ── AI headline generation ──────────────────────────────────────────────────

async function generateAIHeadlines(state: WorldState, scan: PressScan, config: AIConfig): Promise<Array<{ headline: string; body: string; severity: string }>> {
  const lang = getLang()
  const raw = await callAI(config, pressSystemPrompt(lang), pressSnapshotPrompt(state, scan))
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  return JSON.parse(jsonMatch[0])
}

// ── Press-triggered rumor cascade ──────────────────────────────────────────
// Critical headlines automatically seed a matching rumor into the world.
// Max one new rumor per press cycle; skipped if same effect already active.

function spawnPressRumor(state: WorldState, scan: PressScan, criticalCount: number): void {
  if (criticalCount === 0) return
  const isVi = getLang() === 'vi'

  type Spec = Pick<Rumor, 'effect' | 'subject'> & { en: string; vi: string }
  let spec: Spec | null = null

  if (scan.trust < 30) {
    spec = {
      effect: 'trust_down', subject: 'government',
      en: 'Officials are embezzling public funds under cover of the ongoing crisis.',
      vi: 'Quan chức đang biển thủ công quỹ dưới danh nghĩa xử lý khủng hoảng.',
    }
  } else if (scan.food < 20) {
    spec = {
      effect: 'fear_up', subject: 'government',
      en: 'The true food shortage is far worse than official reports dare to admit.',
      vi: 'Tình trạng thiếu lương thực thực sự tệ hơn nhiều so với báo cáo chính thức.',
    }
  } else if (scan.gini > 0.55) {
    spec = {
      effect: 'grievance_up', subject: 'market',
      en: 'Wealthy merchants are secretly hoarding food and supplies while the poor starve.',
      vi: 'Thương nhân giàu có đang bí mật tích trữ lương thực trong khi người nghèo đói khát.',
    }
  } else if (scan.epidemicActive) {
    spec = {
      effect: 'fear_up', subject: 'government',
      en: 'The epidemic spreads faster than health authorities dare report.',
      vi: 'Dịch bệnh lây lan nhanh hơn những gì cơ quan y tế dám báo cáo.',
    }
  }

  if (!spec) return
  if (state.rumors.some(r => r.effect === spec!.effect && r.expires_tick > state.tick)) return

  state.rumors.push({
    id: `press_${state.tick}_${spec.effect}`,
    content: isVi ? spec.vi : spec.en,
    subject: spec.subject,
    effect: spec.effect,
    reach: 15,
    born_tick: state.tick,
    expires_tick: state.tick + 15 * 24,
  })
}

// ── Investigative scandal ───────────────────────────────────────────────────
// Special breaking headline with direct mechanical effect. Fires at most once
// every 20 sim-days when trust, gini, AND political pressure are all dire.

let _lastScandalDay = -999

function checkInvestigativeScandal(
  state: WorldState,
  scan: PressScan,
): { text: string; severity: 'critical' } | null {
  if (scan.trust >= 28 || scan.gini <= 0.52 || scan.pressure <= 60) return null
  if (state.day - _lastScandalDay < 20) return null
  _lastScandalDay = state.day

  const isVi = getLang() === 'vi'

  // Spawn a high-reach corruption rumor (if not already active at this scale)
  const alreadyHigh = state.rumors.some(r => r.effect === 'trust_down' && r.reach >= 25 && r.expires_tick > state.tick)
  if (!alreadyHigh) {
    state.rumors.push({
      id: `scandal_${state.tick}`,
      content: isVi
        ? 'Báo cáo điều tra phơi bày tham nhũng hệ thống ở cấp cao nhất chính quyền.'
        : 'Investigative report exposes systemic corruption at the highest levels of government.',
      subject: 'government',
      effect: 'trust_down',
      reach: 30,
      born_tick: state.tick,
      expires_tick: state.tick + 20 * 24,
    })
  }

  return {
    text: isVi
      ? '🗞 NÓNG: Báo cáo điều tra phơi bày tham nhũng hệ thống ở cấp cao nhất chính quyền.'
      : '🗞 BREAKING: Investigative report exposes systemic corruption at the highest levels of government.',
    severity: 'critical',
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

let _lastPressDay = -1
let _pressBusy = false

/** Most recent press headlines — available for government to read. */
let _latestHeadlines: string[] = []
export function getLatestHeadlines(): string[] { return _latestHeadlines }

export async function runPressCycle(
  state: WorldState,
  config: AIConfig | null,
): Promise<void> {
  if (_pressBusy) return
  _pressBusy = true

  try {
    const scan = scanSociety(state)
    const headlines: Array<{ text: string; severity: 'info' | 'warning' | 'critical' }> = []

    const useAI = pressShouldUseAI(config)

    if (useAI) {
      try {
        const aiResults = await generateAIHeadlines(state, scan, config!)
        for (const r of aiResults.slice(0, 4)) {
          const sev = (r.severity === 'critical' || r.severity === 'warning' || r.severity === 'info') ? r.severity : 'info'
          headlines.push({ text: `📰 ${r.headline} — ${r.body}`, severity: sev as 'info' | 'warning' | 'critical' })
        }
      } catch {
        // AI failed — fall through to template mode
      }
    }

    // Template fallback (or primary if not unlimited mode)
    if (headlines.length === 0) {
      const picked = selectHeadlines(scan, 3)
      for (const p of picked) {
        headlines.push({ text: `📰 ${p.text}`, severity: p.severity })
      }
    }

    // Investigative scandal: inserts a special breaking headline if conditions met
    const scandal = checkInvestigativeScandal(state, scan)
    if (scandal) headlines.unshift({ text: scandal.text, severity: scandal.severity })

    // Emit to feed + chronicle
    _latestHeadlines = []
    for (const h of headlines) {
      addFeedRaw(h.text, h.severity === 'critical' ? 'critical' : h.severity === 'warning' ? 'warning' : 'info', state.year, state.day)
      addChronicle(h.text, state.year, state.day, h.severity === 'critical' ? 'critical' : 'major')
      _latestHeadlines.push(h.text)
    }

    // Spawn a rumor from critical headlines
    const criticalCount = headlines.filter(h => h.severity === 'critical').length
    spawnPressRumor(state, scan, criticalCount)
  } finally {
    _pressBusy = false
  }
}

/** Should be called from the sim loop. Returns true if a press cycle ran this tick. */
export function checkPressTrigger(state: WorldState, config: AIConfig | null): boolean {
  const pressPeriod = Math.floor(state.day / 5)
  if (pressPeriod === _lastPressDay) return false
  if (state.day < 5) return false
  _lastPressDay = pressPeriod
  void runPressCycle(state, config)
  return true
}
