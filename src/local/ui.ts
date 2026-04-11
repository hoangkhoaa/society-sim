import type { Lang } from '../i18n'
import { pick } from './common'

// ── Settings Panel — Regime tab ───────────────────────────────────────────────

export function settingsTabRegime(lang: Lang): string {
  return pick(lang, { en: '🏛 Regime', vi: '🏛 Chế độ' })
}

export function settingsRegimeNoWorld(lang: Lang): string {
  return pick(lang, {
    en: 'Start a world to see regime restrictions.',
    vi: 'Chưa khởi tạo thế giới.',
  })
}

export function settingsRegimeNote(lang: Lang): string {
  return pick(lang, {
    en: 'Structural restrictions of this regime — cannot be changed.',
    vi: 'Hạn chế cơ cấu của chế độ — không thể thay đổi.',
  })
}

export function settingsRegimeSectionInfo(lang: Lang): string {
  return pick(lang, { en: '📡 Information', vi: '📡 Thông tin' })
}

export function settingsRegimeSectionConnections(lang: Lang): string {
  return pick(lang, { en: '🔗 Connections', vi: '🔗 Kết nối' })
}

export function settingsRegimeSectionEconomy(lang: Lang): string {
  return pick(lang, { en: '💰 Economy', vi: '💰 Kinh tế' })
}

type RegimeLabels = { info: string; ties: string; cens: string; travel: string; trade: string; rent: string; lend: string }

export function settingsRegimeLabels(lang: Lang): RegimeLabels {
  return pick<RegimeLabels>(lang, {
    en: {
      info:   'Info spread speed',
      ties:   'Info network size',
      cens:   'Censorship chance',
      travel: 'Cross-zone movement',
      trade:  'Trade volume',
      rent:   'Capital rental',
      lend:   'Private lending',
    },
    vi: {
      info:   'Tốc độ lan tin',
      ties:   'Mạng thông tin',
      cens:   'Kiểm duyệt',
      travel: 'Di chuyển liên khu',
      trade:  'Khối lượng giao dịch',
      rent:   'Thuê tư liệu',
      lend:   'Cho vay tư nhân',
    },
  })
}

/** cross_zone_ties = true → "Cho phép" / "Allowed" */
export function settingsRegimeCrossZoneAllowed(lang: Lang): string {
  return pick(lang, { en: 'Allowed', vi: 'Cho phép' })
}

/** cross_zone_ties = false → "Bị hạn chế" / "Zone-locked" */
export function settingsRegimeCrossZoneLocked(lang: Lang): string {
  return pick(lang, { en: 'Zone-locked', vi: 'Bị hạn chế' })
}

/** rent_market / private_lending = true → "Được phép" / "Allowed" */
export function settingsRegimeMarketAllowed(lang: Lang): string {
  return pick(lang, { en: 'Allowed', vi: 'Được phép' })
}

/** rent_market / private_lending = false → "Cấm" / "Banned" */
export function settingsRegimeMarketBanned(lang: Lang): string {
  return pick(lang, { en: 'Banned', vi: 'Cấm' })
}

// ── Settings Panel — Toggle labels & descriptions ─────────────────────────────

export function settingsToggleCopy(lang: Lang): {
  electionsLabel:     string
  electionsDesc:      string
  electionCycleLabel: string
  govAILabel:         string
  govAIDesc:          string
  npcThoughtsLabel:   string
  npcThoughtsDesc:    string
  pressAILabel:       string
  pressAIDesc:        string
  scienceAILabel:     string
  scienceAIDesc:      string
  consequencesLabel:  string
  consequencesDesc:   string
} {
  return {
    electionsLabel:     pick(lang, { en: '🗳 Human-Driven Elections', vi: '🗳 Bầu cử dân chủ' }),
    electionsDesc:      pick(lang, {
      en: 'NPCs elect a real leader NPC. Their worldview biases all policy decisions.',
      vi: 'NPCs bầu lãnh đạo thực sự. Worldview của người thắng ảnh hưởng chính sách.',
    }),
    electionCycleLabel: pick(lang, { en: 'Election cycle (sim-days)', vi: 'Chu kỳ bầu cử (ngày)' }),
    govAILabel:         pick(lang, { en: '🏛 Government AI Policy',   vi: '🏛 Chính sách AI' }),
    govAIDesc:          pick(lang, {
      en: 'LLM generates policy options every 15 days. Off → deterministic fallbacks.',
      vi: 'LLM tạo 2 lựa chọn chính sách mỗi 15 ngày. Tắt → dùng template cố định.',
    }),
    npcThoughtsLabel:   pick(lang, { en: '💭 NPC Thought Generation', vi: '💭 Suy nghĩ NPC' }),
    npcThoughtsDesc:    pick(lang, {
      en: 'LLM generates daily thoughts in spotlight. Off → template fallback.',
      vi: 'LLM tạo suy nghĩ hàng ngày khi click NPC. Tắt → dùng template.',
    }),
    pressAILabel:       pick(lang, { en: '📰 Press Headlines',        vi: '📰 Báo chí AI' }),
    pressAIDesc:        pick(lang, {
      en: 'AI generates newspaper headlines every 5 days. Off → no AI headlines.',
      vi: 'AI tạo tiêu đề báo mỗi 5 ngày. Tắt → không có tin tức AI.',
    }),
    scienceAILabel:     pick(lang, { en: '🔬 Science Discoveries',    vi: '🔬 Phát minh khoa học' }),
    scienceAIDesc:      pick(lang, {
      en: 'AI generates rare society-inspired breakthroughs (every ~45–90 days). Off → template fallback.',
      vi: 'AI tạo phát minh khoa học hiếm lấy cảm hứng từ xã hội (mỗi ~45–90 ngày). Tắt → dùng template.',
    }),
    consequencesLabel:  pick(lang, { en: '🔮 Consequence Prediction', vi: '🔮 Dự đoán hậu quả' }),
    consequencesDesc:   pick(lang, {
      en: 'AI predicts ripple effects after events. Off → no predictions shown.',
      vi: 'AI dự đoán tác động lan truyền sau sự kiện. Tắt → không có dự đoán.',
    }),
  }
}

// ── Spotlight — Life Story ────────────────────────────────────────────────────

export function spLifeStoryTitle(lang: Lang): string {
  return pick(lang, { en: 'Life Story', vi: 'Tiểu sử' })
}

export function spLegendary(lang: Lang, name: string): string {
  return pick(lang, {
    en: `⭐ <em>${name} is remembered as a legendary figure of this society.</em>`,
    vi: `⭐ <em>${name} được ghi nhớ như một nhân vật huyền thoại của xã hội này.</em>`,
  })
}

export function spFaction(lang: Lang, factionName: string, value: string): string {
  return pick(lang, {
    en: `Aligned with the <strong>${factionName}</strong> faction (${value}).`,
    vi: `Thuộc phe <strong>${factionName}</strong> (${value}).`,
  })
}

export function spMarried(lang: Lang, spouseName: string, occupation: string): string {
  return pick(lang, {
    en: `Married to ${spouseName}, a ${occupation}.`,
    vi: `Đã kết hôn với ${spouseName}, làm nghề ${occupation}.`,
  })
}

export function spCompatibility(lang: Lang, compat: number): string {
  return pick(lang, {
    en: `Compatibility with spouse: <strong>${compat}%</strong>${compat < 40 ? ' — the relationship is under strain.' : ''}`,
    vi: `Độ tương hợp với vợ/chồng: <strong>${compat}%</strong>${compat < 40 ? ' — mối quan hệ có nguy cơ rạn nứt.' : ''}`,
  })
}

export function spInLove(lang: Lang, name: string, attraction: number): string {
  return pick(lang, {
    en: `❤ Has feelings for ${name} (attraction: ${attraction}%).`,
    vi: `❤ Đang có tình cảm với ${name} (độ hấp dẫn: ${attraction}%).`,
  })
}

export function spHeartbroken(lang: Lang, days: number): string {
  return pick(lang, {
    en: `💔 Heartbroken — needs ${days} more days to heal.`,
    vi: `💔 Đang đau khổ sau chia tay — cần thêm ${days} ngày để hồi phục.`,
  })
}

export function spChildren(lang: Lang, n: number): string {
  return pick(lang, {
    en: `Parent of ${n} child${n > 1 ? 'ren' : ''}.`,
    vi: `Có ${n} người con.`,
  })
}

export function spCriminalRecord(lang: Lang): string {
  return pick(lang, {
    en: 'Has a criminal record — trust runs thin in some circles.',
    vi: 'Có tiền án — không được tin tưởng ở một số giới.',
  })
}

export function spDebt(lang: Lang, amount: string, creditorName: string | null): string {
  return pick(lang, {
    en: `Carries a debt of ${amount} coins${creditorName ? ` owed to ${creditorName}` : ''}.`,
    vi: `Đang mang khoản nợ ${amount} đồng${creditorName ? ` với ${creditorName}` : ''}.`,
  })
}

export function spMemLoss(lang: Lang): string {
  return pick(lang, {
    en: 'Suffered a significant loss that still weighs on them.',
    vi: 'Từng chịu mất mát lớn, vết thương vẫn chưa lành.',
  })
}

export function spMemWindfall(lang: Lang): string {
  return pick(lang, {
    en: 'Once experienced an unexpected windfall that changed their fortunes.',
    vi: 'Từng gặp may mắn bất ngờ đổi thay vận số.',
  })
}

export function spMemHelped(lang: Lang): string {
  return pick(lang, {
    en: 'Was helped by someone in a moment of great need — they remember it well.',
    vi: 'Từng được giúp đỡ trong lúc khốn khó — điều đó vẫn còn in đậm trong tâm trí.',
  })
}

export function spMemTrustBroken(lang: Lang): string {
  return pick(lang, {
    en: 'Their trust was betrayed in the past, leaving a lasting mark.',
    vi: 'Từng bị phản bội, để lại vết thương lòng khó xóa.',
  })
}

export function spMemCrisis(lang: Lang): string {
  return pick(lang, {
    en: 'Survived a crisis that left them changed.',
    vi: 'Đã sống sót qua một cuộc khủng hoảng và không còn như xưa nữa.',
  })
}

export function spWealthy(lang: Lang, amount: string): string {
  return pick(lang, {
    en: `Has accumulated considerable wealth (${amount} coins).`,
    vi: `Đã tích lũy khối tài sản đáng kể (${amount} đồng).`,
  })
}

export function spPoor(lang: Lang): string {
  return pick(lang, {
    en: 'Lives in poverty, struggling to get by.',
    vi: 'Sống trong nghèo khó, vật lộn từng ngày.',
  })
}

// ── Spotlight — Capital section ───────────────────────────────────────────────

export function spCapitalLabel(lang: Lang): string {
  return pick(lang, { en: 'Capital', vi: 'Tư liệu lao động' })
}

export function spRentsFromLabel(lang: Lang): string {
  return pick(lang, { en: 'Rents capital from', vi: 'Thuê tư liệu từ' })
}

export function spNoneLabel(lang: Lang): string {
  return pick(lang, { en: 'None', vi: 'Không có' })
}
