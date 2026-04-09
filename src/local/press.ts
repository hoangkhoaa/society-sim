import type { Lang } from '../i18n'
import type { AIConfig, WorldState } from '../types'
import { pick, type Localized } from './common'

export interface PressScan {
  population: number
  food: number
  stability: number
  trust: number
  gini: number
  energy: number
  pressure: number
  resources: number
  literacy: number

  avgStress: number
  avgHappiness: number
  avgGrievance: number
  avgHunger: number

  fleeingPct: number
  organizingPct: number
  confrontPct: number
  sickPct: number
  restingPct: number

  epidemicActive: boolean
  threatActive: boolean
  blockadeActive: boolean
  droughtActive: boolean
  isWinter: boolean

  merchantAvgWealth: number
  farmerAvgWealth: number
}

export type TextOrFn = string | ((s: PressScan) => string)

export interface PressTemplate {
  cond: (s: PressScan) => boolean
  text: Localized<TextOrFn>
  severity: 'info' | 'warning' | 'critical'
}

function h(cond: (s: PressScan) => boolean, en: TextOrFn, vi: TextOrFn, severity: 'info' | 'warning' | 'critical'): PressTemplate {
  return { cond, text: { en, vi }, severity }
}

export function resolvePressText(lang: Lang, t: PressTemplate, scan: PressScan): string {
  const raw = pick(lang, t.text)
  return typeof raw === 'function' ? raw(scan) : raw
}

export const PRESS_TEMPLATES: PressTemplate[] = [
  // ── Food / Hunger ──
  h(s => s.food < 10,               '🍞 Famine grips the land — citizens report days without a meal.',             '🍞 Nạn đói hoành hành — dân chúng nhiều ngày không có bữa ăn.', 'critical'),
  h(s => s.food < 20,               '🍞 Food shortages worsen. Families skip meals to feed children first.',       '🍞 Thiếu lương thực trầm trọng. Gia đình nhịn ăn nhường phần cho trẻ em.', 'critical'),
  h(s => s.food < 30,               '🍞 Bread lines grow longer. Residents worry about next week\'s supply.',      '🍞 Hàng xếp mua bánh mì ngày càng dài. Người dân lo lắng cho tuần tới.', 'warning'),
  h(s => s.food < 40 && s.isWinter, '🍞 Winter rations dwindling — farmers warn harvest stores are nearly empty.', '🍞 Khẩu phần mùa đông cạn kiệt — nông dân cảnh báo kho lúa gần hết.', 'warning'),
  h(s => s.avgHunger > 60,          '🍞 Hunger spreads across neighborhoods; theft of food stocks reported.',       '🍞 Nạn đói lan rộng khắp nơi; xuất hiện tình trạng trộm cắp lương thực.', 'warning'),
  h(s => s.food > 85,               '🌾 Abundant harvests this season — granaries overflowing, prices drop.',       '🌾 Mùa bội thu — kho thóc tràn đầy, giá lương thực giảm.', 'info'),
  h(s => s.food > 70 && s.isWinter, '🌾 Despite the cold, food reserves remain strong. Citizens are well-fed.',    '🌾 Dù trời lạnh, dự trữ lương thực vẫn dồi dào. Người dân no đủ.', 'info'),

  // ── Stability / Order ──
  h(s => s.stability < 15,                 '⚠️ Society on the brink of collapse — order has effectively broken down.',   '⚠️ Xã hội bên bờ sụp đổ — trật tự đã tan rã hoàn toàn.', 'critical'),
  h(s => s.stability < 25,                 '⚠️ Civil unrest intensifies; institutions struggle to maintain control.',     '⚠️ Bạo loạn dân sự gia tăng; các thể chế chật vật duy trì trật tự.', 'critical'),
  h(s => s.stability < 40,                 '⚠️ Growing disorder in several districts. Leaders urge calm.',               '⚠️ Mất trật tự lan rộng ở nhiều khu vực. Lãnh đạo kêu gọi bình tĩnh.', 'warning'),
  h(s => s.stability > 80,                 '✅ Streets are calm. Citizens report feeling safe and optimistic.',           '✅ Đường phố yên bình. Người dân cảm thấy an toàn và lạc quan.', 'info'),
  h(s => s.stability > 70 && s.trust > 60, '✅ Trust in institutions holds steady — a period of relative tranquility.',  '✅ Niềm tin vào thể chế ổn định — một giai đoạn tương đối yên bình.', 'info'),

  // ── Trust / Government ──
  h(s => s.trust < 15, '🏛 Government legitimacy in freefall — citizens openly defy authority.',       '🏛 Uy tín chính quyền sụp đổ — người dân công khai chống đối.', 'critical'),
  h(s => s.trust < 25, '🏛 "They don\'t represent us" — trust in government at historic lows.',         '🏛 "Họ không đại diện cho chúng tôi" — niềm tin vào chính quyền thấp kỷ lục.', 'critical'),
  h(s => s.trust < 40, '🏛 Skepticism grows: citizens question official statements.',                  '🏛 Hoài nghi gia tăng: dân chúng đặt câu hỏi về tuyên bố chính thức.', 'warning'),
  h(s => s.trust > 75, '🏛 Public approval of the council remains high. Policies seen as fair.',       '🏛 Tỉ lệ ủng hộ hội đồng vẫn cao. Chính sách được xem là công bằng.', 'info'),

  // ── Inequality / Economy ──
  h(s => s.gini > 0.65,                        '💰 Extreme wealth gap: the rich feast while the poor starve.',                  '💰 Chênh lệch giàu nghèo cực đoan: người giàu yến tiệc, người nghèo đói khổ.', 'critical'),
  h(s => s.gini > 0.55,                        '💰 Growing inequality strains social fabric. Envy and resentment brew.',         '💰 Bất bình đẳng leo thang làm rạn nứt kết cấu xã hội. Đố kỵ và oán hận nhen nhóm.', 'warning'),
  h(s => s.gini > 0.45 && s.avgGrievance > 40, '💰 Citizens demand fairer distribution — "enough is enough."',                  '💰 Dân chúng đòi phân phối công bằng hơn — "đã quá đủ rồi."', 'warning'),
  h(s => s.gini < 0.25,                        '⚖️ Remarkable equality: wealth distribution is among the most even ever.',      '⚖️ Bình đẳng đáng kinh ngạc: phân phối tài sản đồng đều nhất từ trước đến nay.', 'info'),
  h(s => s.energy < 20,                        '📉 Economy in deep recession — workshops idle, trade stagnant.',                '📉 Kinh tế suy thoái nặng — xưởng đóng cửa, thương mại trì trệ.', 'critical'),
  h(s => s.energy < 35,                        '📉 Economic slowdown: productivity falling, merchants report poor sales.',       '📉 Kinh tế chững lại: năng suất giảm, thương nhân báo cáo doanh thu kém.', 'warning'),
  h(s => s.energy > 80,                        '📈 Economic boom! Markets bustling, artisans can\'t keep up with demand.',       '📈 Kinh tế bùng nổ! Chợ nhộn nhịp, thợ thủ công không kịp đáp ứng nhu cầu.', 'info'),
  h(s => s.energy > 65 && s.gini < 0.40,       '📈 Broad-based prosperity: growth is lifting all boats.',                       '📈 Thịnh vượng toàn diện: tăng trưởng kéo theo sự đi lên của mọi tầng lớp.', 'info'),

  // ── Political Pressure / Protest ──
  h(s => s.pressure > 80,      s => `✊ Mass uprising — ${Math.round(s.organizingPct + s.confrontPct)}% of citizens in open revolt.`,  s => `✊ Nổi dậy hàng loạt — ${Math.round(s.organizingPct + s.confrontPct)}% dân chúng công khai nổi loạn.`, 'critical'),
  h(s => s.pressure > 60,      '✊ Thousands march in the streets. Organizers call for systemic change.',                                 '✊ Hàng nghìn người xuống đường biểu tình. Lãnh đạo phong trào kêu gọi thay đổi hệ thống.', 'critical'),
  h(s => s.pressure > 40,      '✊ Growing protests. Community leaders demand government action.',                                        '✊ Biểu tình lan rộng. Lãnh đạo cộng đồng yêu cầu chính quyền hành động.', 'warning'),
  h(s => s.organizingPct > 15, s => `✊ Organized resistance spreads: ${Math.round(s.organizingPct)}% of the population mobilizing.`,   s => `✊ Phản kháng có tổ chức lan rộng: ${Math.round(s.organizingPct)}% dân số đang tập hợp.`, 'warning'),
  h(s => s.confrontPct > 10,   s => `⚔️ Violent clashes reported — ${Math.round(s.confrontPct)}% of citizens in direct confrontation.`, s => `⚔️ Xung đột bạo lực — ${Math.round(s.confrontPct)}% dân chúng đối đầu trực tiếp.`, 'critical'),
  h(s => s.confrontPct > 5,    '⚔️ Sporadic violence in public squares. Guards deployed.',                                               '⚔️ Bạo lực lẻ tẻ tại quảng trường. Lính canh được triển khai.', 'warning'),
  h(s => s.pressure < 10 && s.stability > 60, '🕊️ Political calm: no significant protests reported this period.',                         '🕊️ Chính trị yên ổn: không có biểu tình đáng kể trong kỳ này.', 'info'),

  // ── Epidemic / Health ──
  h(s => s.epidemicActive && s.sickPct > 20, s => `🏥 Epidemic crisis — ${Math.round(s.sickPct)}% of the population is ill.`,  s => `🏥 Khủng hoảng dịch bệnh — ${Math.round(s.sickPct)}% dân số đang bị bệnh.`, 'critical'),
  h(s => s.epidemicActive && s.sickPct > 10, '🏥 Disease continues to spread. Citizens avoid public gatherings.',                       '🏥 Dịch bệnh tiếp tục lây lan. Dân chúng tránh tụ tập nơi đông người.', 'warning'),
  h(s => s.epidemicActive,                   '🏥 Health authorities report a new outbreak. Citizens urged to take precautions.',       '🏥 Cơ quan y tế báo cáo ổ dịch mới. Dân chúng được khuyến cáo phòng ngừa.', 'warning'),
  h(s => s.sickPct > 15 && !s.epidemicActive,'🏥 Seasonal illness wave: many workers absent. Productivity suffers.',                  '🏥 Làn sóng bệnh theo mùa: nhiều công nhân nghỉ ốm. Năng suất sụt giảm.', 'warning'),
  h(s => s.sickPct < 2,                      '💚 Public health is strong — illness rates at all-time lows.',                          '💚 Sức khỏe cộng đồng tốt — tỉ lệ bệnh tật thấp kỷ lục.', 'info'),

  // ── Fleeing / Migration ──
  h(s => s.fleeingPct > 15, s => `🏃 Exodus — ${Math.round(s.fleeingPct)}% of citizens are fleeing their homes.`,              s => `🏃 Làn sóng di cư — ${Math.round(s.fleeingPct)}% dân chúng đang bỏ nhà ra đi.`, 'critical'),
  h(s => s.fleeingPct > 5,  '🏃 Families pack up and leave. Fear drives a growing wave of internal refugees.',                  '🏃 Gia đình gói ghém ra đi. Nỗi sợ thúc đẩy làn sóng tị nạn nội địa.', 'warning'),
  h(s => s.fleeingPct > 2,  '🏃 Scattered reports of residents relocating to safer districts.',                                 '🏃 Rải rác tin người dân chuyển đến các khu vực an toàn hơn.', 'info'),

  // ── Stress / Mental Health ──
  h(s => s.avgStress > 70,                         '😰 Citizens report severe anxiety. Mental health crisis grips the population.',      '😰 Dân chúng báo cáo lo âu nghiêm trọng. Khủng hoảng sức khỏe tâm thần bao trùm.', 'critical'),
  h(s => s.avgStress > 50,                         '😰 Stress levels rising — sleeplessness, irritability, and conflict on the rise.',   '😰 Mức stress tăng — mất ngủ, cáu gắt và xung đột gia tăng.', 'warning'),
  h(s => s.avgStress < 20 && s.avgHappiness > 65,  '😊 Citizens are content. Stress is low and spirits are high.',                       '😊 Dân chúng hài lòng. Stress thấp, tinh thần cao.', 'info'),
  h(s => s.avgHappiness < 25,                      '😔 Morale at rock bottom. Citizens describe feeling hopeless.',                        '😔 Tinh thần chạm đáy. Người dân mô tả cảm giác tuyệt vọng.', 'critical'),
  h(s => s.avgHappiness < 40,                      '😔 General dissatisfaction: most citizens report unhappiness with their lives.',      '😔 Bất mãn lan tràn: đa số dân chúng không hài lòng với cuộc sống.', 'warning'),
  h(s => s.avgHappiness > 70,                      '😊 Survey: majority of citizens say they are happy with current conditions.',         '😊 Khảo sát: đa số dân chúng nói họ hạnh phúc với điều kiện hiện tại.', 'info'),

  // ── Resources ──
  h(s => s.resources < 10, '🪨 Natural resources nearly exhausted. Craftsmen unable to source materials.',  '🪨 Tài nguyên thiên nhiên gần cạn kiệt. Thợ thủ công không tìm được nguyên liệu.', 'critical'),
  h(s => s.resources < 25, '🪨 Resource depletion accelerates. Industry warns of supply chain collapse.',   '🪨 Tài nguyên cạn kiệt nhanh chóng. Ngành công nghiệp cảnh báo chuỗi cung ứng sắp sụp đổ.', 'warning'),
  h(s => s.resources > 80, '🌳 Resource abundance: forests thick, mines productive, land fertile.',         '🌳 Tài nguyên dồi dào: rừng rậm, mỏ hiệu quả, đất phì nhiêu.', 'info'),

  // ── Literacy / Education ──
  h(s => s.literacy > 80, '📚 Academic renaissance — literacy rates soar, knowledge economy thriving.',    '📚 Phục hưng học thuật — tỉ lệ biết chữ tăng vọt, kinh tế tri thức phát triển.', 'info'),
  h(s => s.literacy < 20, '📚 Education crisis: illiteracy rising, scholars marginalized.',                '📚 Khủng hoảng giáo dục: mù chữ gia tăng, học giả bị gạt ra bên lề.', 'warning'),

  // ── External Events ──
  h(s => s.threatActive,   '🗡 External threat looms — citizens rally behind the government... for now.',  '🗡 Mối đe dọa bên ngoài — dân chúng tạm đoàn kết sau lưng chính quyền.', 'warning'),
  h(s => s.blockadeActive, '🚫 Blockade strangles trade routes. Merchants report catastrophic losses.',    '🚫 Phong tỏa bóp nghẹt thương mại. Thương nhân báo cáo tổn thất thảm khốc.', 'critical'),
  h(s => s.droughtActive,  '☀️ Drought parches the fields. Farmers pray for rain.',                        '☀️ Hạn hán thiêu đốt cánh đồng. Nông dân cầu mưa.', 'warning'),
]

export function pressSystemPrompt(lang: Lang): string {
  const langDirective = lang === 'vi'
    ? 'IMPORTANT: All headline and body text MUST be written in Vietnamese.'
    : 'All headline and body text must be in English.'
  return `You are a free press journalist inside a society simulation.
You observe societal statistics and NPC behavioral data, then write 2–4 newspaper headlines + one-sentence descriptions.
Your tone is factual but vivid — like a real newspaper. Report what citizens are DOING, not just what stats say.
Focus on human behavior: protests, market changes, migration, community responses, resistance, adaptation.

${langDirective}

Return JSON array:
[
  { "headline": "Short punchy title", "body": "One-sentence description.", "severity": "info"|"warning"|"critical" },
  ...
]
Only return JSON. No commentary.`
}

export function pressShouldUseAI(config: AIConfig | null): boolean {
  return !!config && config.token_mode === 'unlimited'
}

export function pressSnapshotPrompt(state: WorldState, scan: PressScan): string {
  return [
    'SOCIETY SNAPSHOT:',
    `  Population: ${scan.population} | Food: ${Math.round(scan.food)}% | Stability: ${Math.round(scan.stability)}%`,
    `  Trust: ${Math.round(scan.trust)}% | Gini: ${scan.gini.toFixed(2)} | Energy: ${Math.round(scan.energy)}%`,
    `  Political pressure: ${Math.round(scan.pressure)}% | Resources: ${Math.round(scan.resources)}%`,
    `  Literacy: ${Math.round(scan.literacy)}% | Avg stress: ${Math.round(scan.avgStress)} | Avg happiness: ${Math.round(scan.avgHappiness)}`,
    `  Avg grievance: ${Math.round(scan.avgGrievance)} | Avg hunger: ${Math.round(scan.avgHunger)}`,
    '',
    'NPC BEHAVIOR:',
    `  Fleeing: ${scan.fleeingPct.toFixed(1)}% | Organizing: ${scan.organizingPct.toFixed(1)}% | Confronting: ${scan.confrontPct.toFixed(1)}%`,
    `  Sick: ${scan.sickPct.toFixed(1)}% | Resting (excessive): ${scan.restingPct.toFixed(1)}%`,
    '',
    'ACTIVE EVENTS:',
    `  Epidemic: ${scan.epidemicActive} | External threat: ${scan.threatActive} | Blockade: ${scan.blockadeActive} | Drought: ${scan.droughtActive}`,
    `  Season: ${scan.isWinter ? 'Winter' : 'Non-winter'} | Day ${state.day}, Year ${state.year}`,
    '',
    'ECONOMY:',
    `  Merchant avg wealth: ${Math.round(scan.merchantAvgWealth)} | Farmer avg wealth: ${Math.round(scan.farmerAvgWealth)}`,
    '',
    'Write 2–4 headlines that capture what the PEOPLE are doing in response to these conditions.',
  ].join('\n')
}

// ── Press rumor content ───────────────────────────────────────────────────────

export type RumorEffect = 'trust_down' | 'fear_up' | 'grievance_up'
type PressRumorSubject = 'government' | 'market'

export interface PressRumorSpec {
  content: string
  subject: PressRumorSubject
  effect: RumorEffect
}

export function pressRumorTrustDown(lang: Lang): PressRumorSpec {
  return {
    content: pick(lang, {
      en: 'Officials are embezzling public funds under cover of the ongoing crisis.',
      vi: 'Quan chức đang biển thủ công quỹ dưới danh nghĩa xử lý khủng hoảng.',
    }),
    subject: 'government',
    effect: 'trust_down',
  }
}

export function pressRumorFoodFear(lang: Lang): PressRumorSpec {
  return {
    content: pick(lang, {
      en: 'The true food shortage is far worse than official reports dare to admit.',
      vi: 'Tình trạng thiếu lương thực thực sự tệ hơn nhiều so với báo cáo chính thức.',
    }),
    subject: 'government',
    effect: 'fear_up',
  }
}

export function pressRumorHoardingGrievance(lang: Lang): PressRumorSpec {
  return {
    content: pick(lang, {
      en: 'Wealthy merchants are secretly hoarding food and supplies while the poor starve.',
      vi: 'Thương nhân giàu có đang bí mật tích trữ lương thực trong khi người nghèo đói khát.',
    }),
    subject: 'market',
    effect: 'grievance_up',
  }
}

export function pressRumorEpidemicFear(lang: Lang): PressRumorSpec {
  return {
    content: pick(lang, {
      en: 'The epidemic spreads faster than health authorities dare report.',
      vi: 'Dịch bệnh lây lan nhanh hơn những gì cơ quan y tế dám báo cáo.',
    }),
    subject: 'government',
    effect: 'fear_up',
  }
}

// ── Investigative scandal content ─────────────────────────────────────────────

export function scandalRumorContent(lang: Lang): string {
  return pick(lang, {
    en: 'Investigative report exposes systemic corruption at the highest levels of government.',
    vi: 'Báo cáo điều tra phơi bày tham nhũng hệ thống ở cấp cao nhất chính quyền.',
  })
}

export function scandalHeadline(lang: Lang): string {
  return pick(lang, {
    en: '🗞️ BREAKING: Investigative report exposes systemic corruption at the highest levels of government.',
    vi: '🗞️ NÓNG: Báo cáo điều tra phơi bày tham nhũng hệ thống ở cấp cao nhất chính quyền.',
  })
}

// ── Redaction note ────────────────────────────────────────────────────────────

export function redactionNoteText(lang: Lang, censorshipProb: number): string {
  if (censorshipProb >= 0.70) {
    return pick(lang, {
      en: '🔇 [REMOVED — THIS ARTICLE CONTAINS MISINFORMATION. NO SUCH EVENTS OCCURRED. SOCIETY IS STABLE AND PROGRESSING.]',
      vi: '🔇 [ĐÃ XÓA — BÀI VIẾT NÀY CHỨA THÔNG TIN SAI LỆCH. KHÔNG CÓ SỰ KIỆN NÀO NHƯ VẬY. XÃ HỘI ỔN ĐỊNH VÀ PHÁT TRIỂN.]',
    })
  }
  if (censorshipProb >= 0.40) {
    return pick(lang, {
      en: '🔇 [This article has been removed by order of the authorities on grounds of public security.]',
      vi: '🔇 [Bài viết này đã bị gỡ xuống theo lệnh của nhà chức trách vì lý do an ninh công cộng.]',
    })
  }
  return pick(lang, {
    en: '🔇 [Article removed.]',
    vi: '🔇 [Bài viết đã bị gỡ xuống.]',
  })
}

// ── Censorship leak rumor content ─────────────────────────────────────────────

export function censorshipLeakContent(lang: Lang): string {
  return pick(lang, {
    en: 'A news article exposing the crisis was abruptly taken down by government order.',
    vi: 'Một bài báo vạch trần khủng hoảng đã bị chính quyền ra lệnh gỡ xuống đột ngột.',
  })
}

// ── Chronicle suppressed label ────────────────────────────────────────────────

export function suppressedLabel(lang: Lang): string {
  return pick(lang, { en: ' *(Suppressed)*', vi: ' *(Bị kiểm duyệt)*' })
}
