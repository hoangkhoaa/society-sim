// ── Language types ─────────────────────────────────────────────────────────

export type Lang = 'en' | 'vi'

// ── Translation registry ───────────────────────────────────────────────────

const translations = {
  en: {
    // Onboarding
    'onboarding.sub':           'A living world. You talk to it.',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Enter your API key...',
    'onboarding.btn_start':     'Begin →',
    'onboarding.connecting':    'Connecting...',
    'onboarding.err_no_key':    'Please enter an API key.',
    'onboarding.err_conn':      'Connection error:',

    // Setup
    'setup.title':        'Society Setup',
    'setup.hint':         'Describe the society you want, or pick a starting point',
    'setup.preset_nordic': '🏔 Nordic',
    'setup.preset_cap':    '💹 Free Market',
    'setup.preset_soc':    '⚙ Planned Economy',
    'setup.input_ph':      'e.g. "Nordic but with scarcer resources"',
    'setup.preset_msg':    'Preset selected:',
    'setup.preset_init':   'Initializing society with preset',

    // Topbar
    'topbar.clock':        'Year {y} · M{m} · D{d}',
    'topbar.constitution': '📜 Constitution',
    'topbar.init':         'Initializing society...',
    'topbar.initialized':  'Society initialized:',
    'topbar.constitution_set':
      'Constitution established. {n} citizens. Initial Gini: {g}. State power: {p}%.',

    // Feed
    'feed.header': 'Event Log',

    // Chat
    'chat.ph': 'Talk to the world... ("create a storm", "why is the population unstable?")',

    // Modal
    'modal.confirm_btn': 'Confirm',
    'modal.cancel_btn':  'Cancel',
    'modal.event_title': 'Confirm Event',
    'modal.event_cancelled': 'Event cancelled.',

    // Game errors
    'err.generic':       'Error:',
    'err.thinking':      'Interpreting...',

    // Spotlight — sections
    'sp.info':           'Info',
    'sp.status':         'Status',
    'sp.worldview':      'Worldview',
    'sp.trust':          'Trust in Government',
    'sp.network':        'Network',
    'sp.thought':        'Daily Thought',
    'sp.thought_loading':'Thinking...',
    'sp.thought_fail':   '(could not load thought)',
    'sp.deceased':       'Deceased',
    'sp.unknown_cause':  'unknown cause',

    // Spotlight — fields
    'sp.age':         'Age',
    'sp.gender':      'Gender',
    'sp.marital':     'Marital Status',
    'sp.children':    'Children',
    'sp.people':      'people',
    'sp.male':        'Male',
    'sp.female':      'Female',
    'sp.married':     'Married',
    'sp.single':      'Single',

    // Spotlight — status bars
    'sp.stress':      'Stress',
    'sp.happiness':   'Happiness',
    'sp.grievance':   'Dissatisfaction',
    'sp.hunger':      'Hunger',
    'sp.exhaustion':  'Fatigue',
    'sp.isolation':   'Loneliness',

    // Spotlight — worldview bars
    'sp.collectivism':    'Collectivism',
    'sp.auth_trust':      'Authority Trust',
    'sp.risk_tolerance':  'Risk Tolerance',

    // Spotlight — trust
    'sp.competence':  'Competence',
    'sp.intention':   'Integrity',
    'sp.composite':   'Composite',

    // Spotlight — network
    'sp.strong_ties': 'Close ties',
    'sp.weak_ties':   'Acquaintances',
    'sp.influence':   'Influence',

    // Appearance labels
    'app.short': 'Short', 'app.average': 'Average', 'app.tall': 'Tall',
    'app.slim':  'Slim',  'app.sturdy':  'Sturdy',
    'app.hair':  'Hair',
    'hair.black': 'black', 'hair.brown': 'brown', 'hair.gray': 'grey', 'hair.white': 'white',
    'skin.light': 'light', 'skin.medium': 'medium', 'skin.dark': 'dark',

    // NPC description parts
    'npc.mr':       'Mr',
    'npc.ms':       'Ms',
    'npc.age_young':  'young',
    'npc.age_mid':    'middle-aged',
    'npc.age_old':    'elderly',
    'npc.mood_bad':   'dissatisfied',
    'npc.mood_good':  'optimistic',
    'npc.mood_ok':    'calm',
    'npc.social_col': 'community-oriented',
    'npc.social_ind': 'independent',
    // Template: "{prefix} {name}, age {age}, works as {occ}. {ageStage}, {mood} and {social}."
    'npc.desc': '{prefix} {name}, age {age}, works as {occ}. {ageStage}, {mood} and {social}.',

    // Death causes
    'death.natural':  'natural causes',
    'death.accident': 'an accident',
    'death.disease':  'disease',
    'death.violence': 'violence',

    // Engine narrative
    'engine.crisis':   'A constitutional crisis is approaching — society has drifted too far from its founding compact.',
    'engine.married':  '{a} and {b} have gotten married.',
    'engine.birth':    '{parent} has had a child.',
    'engine.intervention': '⚡ Intervention affected {n} NPC{s}.',
    'engine.extinction': '💀 The last NPC has died. The society is extinct.',

    // Game over screen
    'gameover.title':       'Extinction',
    'gameover.summary':     'Every soul in this world is gone. The society you built has perished after {d} days and {y} year{ys}.',
    'gameover.stats_pop':   'Peak population: {n}',
    'gameover.stats_day':   'Survived: {d} day{ds}, Year {y}',
    'gameover.btn_restart': 'Start New Society',

    // Zone labels
    'zone.north_farm':        'North Farmlands',
    'zone.south_farm':        'South Farmlands',
    'zone.workshop_district': 'Workshop District',
    'zone.market_square':     'Market Square',
    'zone.scholar_quarter':   'Scholar Quarter',
    'zone.residential_east':  'East Residential',
    'zone.residential_west':  'West Residential',
    'zone.guard_post':        'Guard Post',
    'zone.plaza':             'Plaza',

    // Institution names
    'inst.government': 'Governing Council',
    'inst.market':     'Merchants Guild',
    'inst.opposition': 'Opposition',
    'inst.community':  'Community Assembly',
    'inst.guard':      'Guard Corps',

    // Role occupations
    'occ.farmer':    ['Rice Farmer', 'Vegetable Grower', 'Livestock Keeper', 'Gardener'],
    'occ.craftsman': ['Blacksmith', 'Carpenter', 'Weaver', 'Potter', 'Mason'],
    'occ.merchant':  ['Trader', 'Innkeeper', 'Money Changer', 'Peddler'],
    'occ.scholar':   ['Teacher', 'Physician', 'Scholar', 'Philosopher', 'Scribe'],
    'occ.guard':     ['Sentry', 'Militia', 'Patrol Officer', 'Squad Leader'],
    'occ.leader':    ['Council Member', 'District Chief', 'Elder', 'Official'],

    // Preset descriptions
    'preset.nordic_desc': 'Nordic social democracy — high equality, strong state, high social trust.',
    'preset.cap_desc':    'Free-market capitalism — self-regulating markets, high inequality, minimal state.',
    'preset.soc_desc':    'Centralized planned economy — state controls everything, high equality but low freedom.',
  },

  vi: {
    // Onboarding
    'onboarding.sub':           'Một thế giới sống. Bạn nói chuyện với nó.',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Nhập API key...',
    'onboarding.btn_start':     'Bắt đầu →',
    'onboarding.connecting':    'Đang kết nối...',
    'onboarding.err_no_key':    'Vui lòng nhập API key.',
    'onboarding.err_conn':      'Lỗi kết nối:',

    // Setup
    'setup.title':        'Thiết lập xã hội',
    'setup.hint':         'Mô tả xã hội bạn muốn, hoặc chọn điểm xuất phát',
    'setup.preset_nordic': '🏔 Bắc Âu',
    'setup.preset_cap':    '💹 Tư bản tự do',
    'setup.preset_soc':    '⚙ XHCN tập trung',
    'setup.input_ph':      'Ví dụ: "Kiểu Bắc Âu nhưng tài nguyên khan hiếm hơn"',
    'setup.preset_msg':    'Chọn preset:',
    'setup.preset_init':   'Đang khởi tạo xã hội theo preset',

    // Topbar
    'topbar.clock':        'Năm {y} · T{m} · N{d}',
    'topbar.constitution': '📜 Hiến pháp',
    'topbar.init':         'Đang khởi tạo xã hội...',
    'topbar.initialized':  'Xã hội khởi tạo:',
    'topbar.constitution_set':
      'Hiến pháp đã được thiết lập. {n} người dân. Gini ban đầu: {g}. Quyền lực nhà nước: {p}%.',

    // Feed
    'feed.header': 'Nhật ký sự kiện',

    // Chat
    'chat.ph': 'Nói chuyện với thế giới... ("tạo cơn bão to", "tại sao dân bất ổn?")',

    // Modal
    'modal.confirm_btn': 'Xác nhận',
    'modal.cancel_btn':  'Hủy',
    'modal.event_title': 'Xác nhận sự kiện',
    'modal.event_cancelled': 'Sự kiện bị hủy.',

    // Game errors
    'err.generic':       'Lỗi:',
    'err.thinking':      'Đang diễn giải...',

    // Spotlight — sections
    'sp.info':           'Thông tin',
    'sp.status':         'Trạng thái',
    'sp.worldview':      'Thế giới quan',
    'sp.trust':          'Niềm tin vào chính phủ',
    'sp.network':        'Mạng lưới',
    'sp.thought':        'Suy nghĩ hôm nay',
    'sp.thought_loading':'Đang suy nghĩ...',
    'sp.thought_fail':   '(không thể tải suy nghĩ)',
    'sp.deceased':       'Đã mất',
    'sp.unknown_cause':  'nguyên nhân không rõ',

    // Spotlight — fields
    'sp.age':         'Tuổi',
    'sp.gender':      'Giới tính',
    'sp.marital':     'Hôn nhân',
    'sp.children':    'Con cái',
    'sp.people':      'người',
    'sp.male':        'Nam',
    'sp.female':      'Nữ',
    'sp.married':     'Đã kết hôn',
    'sp.single':      'Độc thân',

    // Spotlight — status bars
    'sp.stress':      'Stress',
    'sp.happiness':   'Hạnh phúc',
    'sp.grievance':   'Bất mãn',
    'sp.hunger':      'Đói',
    'sp.exhaustion':  'Mệt',
    'sp.isolation':   'Cô đơn',

    // Spotlight — worldview bars
    'sp.collectivism':    'Tập thể',
    'sp.auth_trust':      'Tin chính quyền',
    'sp.risk_tolerance':  'Chấp nhận rủi ro',

    // Spotlight — trust
    'sp.competence':  'Năng lực',
    'sp.intention':   'Lương tâm',
    'sp.composite':   'Tổng hợp',

    // Spotlight — network
    'sp.strong_ties': 'Thân thiết',
    'sp.weak_ties':   'Quen biết',
    'sp.influence':   'Ảnh hưởng',

    // Appearance labels
    'app.short': 'Thấp', 'app.average': 'Trung bình', 'app.tall': 'Cao',
    'app.slim':  'Gầy',  'app.sturdy':  'Vạm vỡ',
    'app.hair':  'Tóc',
    'hair.black': 'đen', 'hair.brown': 'nâu', 'hair.gray': 'bạc', 'hair.white': 'trắng',
    'skin.light': 'sáng', 'skin.medium': 'trung bình', 'skin.dark': 'tối',

    // NPC description parts
    'npc.mr':       'Anh',
    'npc.ms':       'Chị',
    'npc.age_young':  'trẻ tuổi',
    'npc.age_mid':    'trung niên',
    'npc.age_old':    'lớn tuổi',
    'npc.mood_bad':   'bất mãn',
    'npc.mood_good':  'lạc quan',
    'npc.mood_ok':    'bình thản',
    'npc.social_col': 'gắn bó cộng đồng',
    'npc.social_ind': 'độc lập',
    'npc.desc': '{prefix} {name}, {age} tuổi, làm {occ}. Người {ageStage}, {mood} và {social}.',

    // Death causes
    'death.natural':  'tuổi già',
    'death.accident': 'tai nạn',
    'death.disease':  'bệnh tật',
    'death.violence': 'bạo lực',

    // Engine narrative
    'engine.crisis':   'Cuộc khủng hoảng hiến pháp đang đến gần — xã hội đã lệch quá xa khỏi khế ước ban đầu.',
    'engine.married':  '{a} và {b} đã kết hôn.',
    'engine.birth':    '{parent} vừa có thêm một đứa con.',
    'engine.intervention': '⚡ Can thiệp ảnh hưởng đến {n} NPC.',
    'engine.extinction': '💀 NPC cuối cùng đã chết. Xã hội đã diệt vong.',

    // Game over screen
    'gameover.title':       'Diệt vong',
    'gameover.summary':     'Mọi linh hồn trong thế giới này đã ra đi. Xã hội bạn xây dựng đã sụp đổ sau {d} ngày và {y} năm.',
    'gameover.stats_pop':   'Dân số đỉnh cao: {n}',
    'gameover.stats_day':   'Tồn tại: {d} ngày, Năm {y}',
    'gameover.btn_restart': 'Bắt đầu xã hội mới',

    // Zone labels
    'zone.north_farm':        'Cánh đồng bắc',
    'zone.south_farm':        'Cánh đồng nam',
    'zone.workshop_district': 'Khu xưởng',
    'zone.market_square':     'Chợ trung tâm',
    'zone.scholar_quarter':   'Khu học giả',
    'zone.residential_east':  'Khu dân cư đông',
    'zone.residential_west':  'Khu dân cư tây',
    'zone.guard_post':        'Đồn canh',
    'zone.plaza':             'Quảng trường',

    // Institution names
    'inst.government': 'Hội đồng lãnh đạo',
    'inst.market':     'Hội Thương Nhân',
    'inst.opposition': 'Phe đối lập',
    'inst.community':  'Cộng đồng',
    'inst.guard':      'Lực lượng bảo vệ',

    // Role occupations
    'occ.farmer':    ['Nông dân trồng lúa', 'Người trồng rau', 'Người nuôi gia súc', 'Người làm vườn'],
    'occ.craftsman': ['Thợ rèn', 'Thợ mộc', 'Thợ dệt', 'Thợ gốm', 'Thợ xây'],
    'occ.merchant':  ['Thương nhân', 'Chủ quán trọ', 'Người đổi tiền', 'Lái buôn'],
    'occ.scholar':   ['Giáo viên', 'Thầy thuốc', 'Học giả', 'Triết gia', 'Thư ký'],
    'occ.guard':     ['Lính canh', 'Dân quân', 'Tuần tra', 'Chỉ huy đội'],
    'occ.leader':    ['Thành viên hội đồng', 'Trưởng khu', 'Trưởng lão', 'Quan chức'],

    // Preset descriptions
    'preset.nordic_desc': 'Dân chủ xã hội Bắc Âu — bình đẳng cao, nhà nước mạnh, tin tưởng cao.',
    'preset.cap_desc':    'Tư bản tự do — thị trường tự quyết, bất bình đẳng cao, nhà nước tối thiểu.',
    'preset.soc_desc':    'XHCN tập trung — nhà nước kiểm soát toàn bộ, bình đẳng cao nhưng tự do thấp.',
  },
} as const

// ── State ──────────────────────────────────────────────────────────────────

let currentLang: Lang = 'en'

export function setLang(lang: Lang): void {
  currentLang = lang
  document.documentElement.lang = lang
  // Re-render all elements carrying a data-i18n attribute
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n!
    const val = t(key)
    if (typeof val === 'string') el.textContent = val
  })
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-ph]').forEach(el => {
    const key = (el as HTMLElement).dataset.i18nPh!
    const val = t(key)
    if (typeof val === 'string') el.placeholder = val
  })
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle!
    const val = t(key)
    if (typeof val === 'string') el.title = val
  })
}

export function getLang(): Lang {
  return currentLang
}

// ── Translate ──────────────────────────────────────────────────────────────

type TranslationValue = string | readonly string[]

export function t(key: string): TranslationValue {
  const map = translations[currentLang] as Record<string, TranslationValue>
  return map[key] ?? (translations['en'] as Record<string, TranslationValue>)[key] ?? key
}

/**
 * Translate and interpolate template variables.
 * Example: tf('topbar.clock', { y: 1, m: 2, d: 3 }) => "Year 1 · M2 · D3"
 */
export function tf(key: string, vars: Record<string, string | number>): string {
  let s = t(key) as string
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(`{${k}}`, String(v))
  }
  return s
}

/**
 * Get a random occupation string for a given role key.
 * key: 'occ.farmer' | 'occ.craftsman' | etc.
 */
export function tOcc(roleKey: string): string {
  const list = t(roleKey)
  if (Array.isArray(list)) return list[Math.floor(Math.random() * list.length)]
  return String(list)
}
