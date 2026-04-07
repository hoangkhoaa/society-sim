// ── Language types ─────────────────────────────────────────────────────────

export type Lang = 'en' | 'vi'

// ── Translation registry ───────────────────────────────────────────────────

const translations = {
  en: {
    // Onboarding
    'onboarding.sub':           'A living world. You talk to it.',
    'onboarding.provider':      'Provider',
    'onboarding.base_url':      'Base URL',
    'onboarding.base_url_ph':   'http://your-server:11434',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Enter your API key...',
    'onboarding.btn_list_models': 'List available models',
    'onboarding.btn_list_models_loading': 'Loading models…',
    'onboarding.model':         'Model',
    'onboarding.model_placeholder': '— Load models after entering your key —',
    'onboarding.token_mode':    'Token mode',
    'onboarding.btn_start':     'Begin →',
    'onboarding.connecting':    'Connecting...',
    'onboarding.err_no_key':    'Please enter an API key.',
    'onboarding.err_base_url':  'Please enter the server Base URL.',
    'onboarding.err_models_first': 'List models first, then pick one.',
    'onboarding.err_list_models': 'Could not list models.',
    'onboarding.fallback_models_hint': 'Using built-in model list — pick carefully; invalid ids will fail at runtime.',
    'onboarding.err_conn':      'Connection error:',
    'onboarding.btn_no_api_key': 'Play without API Key',

    // Setup
    'setup.title':        'Society Setup',
    'setup.hint':         'Describe the society you want, or pick a starting point',
    'setup.hint_no_api':  'Pick a preset to start — AI events are disabled in this mode',
    'setup.preset_nordic': '🏔 Nordic',
    'setup.preset_cap':    '💹 Free Market',
    'setup.preset_soc':    '🏭 Planned Economy',
    'setup.preset_feudal':      '⚔️ Feudalism',
    'setup.preset_theocracy':   '⛪ Theocracy',
    'setup.preset_technocracy': '🧠 Technocracy',
    'setup.preset_warlord':     '🗡 Warlord State',
    'setup.preset_commune':     '🌿 Commune',
    'setup.preset_marxist':     '🟥 Marxist',
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
    'topbar.stat_stability': 'Stability',
    'topbar.stat_food':      'Food',
    'topbar.stat_resources': 'Resources',
    'topbar.stat_energy':    'Energy',
    'topbar.stat_trust':     'Trust',
    'topbar.stat_gini':      'Gini',
    'topbar.ai_thinking':    '⏸ AI…',

    // Feed
    'feed.header':      'Event Log',
    'chronicle.header': 'Chronicle',
    'filter.all':       'All',
    'filter.important': 'Important',
    'filter.critical':  'Critical',

    // Demographics
    'demo.title':   'Population',
    'demo.pop':     'Total',
    'demo.male':    '♂ Male',
    'demo.female':  '♀ Female',
    'demo.deaths':  'Deaths',
    'demo.age_0':   '0–17',
    'demo.age_1':   '18–34',
    'demo.age_2':   '35–49',
    'demo.age_3':   '50–69',
    'demo.age_4':   '70+',

    // Chat
    'chat.ph': 'Talk to the world... ("create a storm", "why is the population unstable?")',
    'chat.disabled': 'AI chat disabled — running without API key',

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
    'sp.strong_ties':     'Close ties',
    'sp.info_ties':       'Info network',
    'sp.weak_ties':       'Acquaintances',
    'sp.influence':       'Influence',
    'sp.daily_income':    'Daily income',
    'sp.community_group': 'Community group',
    'sp.group':           'Group',
    'sp.flags':           'Status flags',
    'sp.sick':            'Sick',
    'sp.days_remaining':  'days remaining',
    'sp.criminal_record': 'Criminal record',

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
    'engine.crisis':            'A constitutional crisis is approaching — society has drifted too far from its founding compact.',
    'engine.married':           '{a} and {b} have gotten married.',
    'engine.divorced':          '{a} and {b} have divorced.',
    'engine.birth':             '{parent} has had a child.',
    'engine.accident':          '{name} was injured in an accident.',
    'engine.fell_ill':          '{name} has fallen ill.',
    'engine.recovered':         '{name} has recovered from illness.',
    'engine.crime':             '{name} committed a crime.',
    'engine.community_formed':  'A new community group has formed.',
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

    // Role occupations (expanded for social model variety)
    'occ.farmer':    ['Rice Farmer', 'Vegetable Grower', 'Livestock Keeper', 'Gardener', 'Fisherman', 'Orchard Keeper'],
    'occ.craftsman': ['Blacksmith', 'Carpenter', 'Weaver', 'Potter', 'Mason', 'Tailor', 'Tanner', 'Jeweler', 'Engineer', 'Mechanic'],
    'occ.merchant':  ['Trader', 'Innkeeper', 'Money Changer', 'Peddler', 'Banker', 'Broker', 'Shopkeeper'],
    'occ.scholar':   ['Teacher', 'Physician', 'Scholar', 'Philosopher', 'Scribe', 'Scientist', 'Lawyer', 'Archivist', 'Theologian', 'Programmer'],
    'occ.guard':     ['Sentry', 'Militia', 'Patrol Officer', 'Squad Leader', 'Sheriff', 'Soldier', 'Prison Warden'],
    'occ.leader':    ['Council Member', 'District Chief', 'Elder', 'Official', 'Mayor', 'Commissioner', 'Party Secretary'],
    'occ.child':     ['Child'],

    // Preset descriptions
    'preset.nordic_desc': 'Nordic social democracy — high equality, strong state, high social trust.',
    'preset.cap_desc':    'Free-market capitalism — self-regulating markets, high inequality, minimal state.',
    'preset.soc_desc':    'Centralized planned economy — state controls everything, high equality but low freedom.',
    'preset.feudal_desc':      'Feudal kingdom — extreme wealth gap, noble ruling class, serfs tied to the land, scarce rights.',
    'preset.theocracy_desc':   'Theocratic state — religious dogma governs all, high cohesion, scholars dominate, dissent suppressed.',
    'preset.technocracy_desc': 'Technocracy — ruled by experts and data, abundant resources, scholars lead, innovation-first.',
    'preset.warlord_desc':     'Warlord state — fractured authority, militarized, scarce resources, low trust, survival of the strong.',
    'preset.commune_desc':     'Utopian commune — near-total equality, no markets, radical self-governance, strong community bonds.',
    'preset.marxist_desc':     'Marxist state — centrally planned economy, near-zero inequality, high state control, suppressed markets, collective ownership.',
    'const.label_gini':     'Gini Coefficient',
    'const.label_market':   'Market Freedom',
    'const.label_state':    'State Power',
    'const.label_safety':   'Safety Net',
    'const.label_rights':   'Individual Rights',
    'const.label_trust':    'Base Trust',
    'const.label_cohesion': 'Social Cohesion',
    'const.label_scarcity': 'Resource Scarcity',
    'const.label_values':   'Value Priorities',
    'const.hint_gini':      'Wealth inequality at founding (0 = equal, 1 = extreme gap)',
    'const.hint_market':    'Market self-regulation vs. state planning',
    'const.hint_state':     'Political and military reach of the government',
    'const.hint_safety':    'Level of welfare programs and public safety nets',
    'const.hint_rights':    'Floor of individual rights protected by law',
    'const.hint_trust':     'Initial social trust toward institutions',
    'const.hint_cohesion':  'How tightly-knit community networks are',
    'const.hint_scarcity':  'Natural resource pressure (high = harder survival)',
    'const.hint_values':    'The founding moral priorities of the society',
  },

  vi: {
    // Onboarding
    'onboarding.sub':           'Một thế giới sống. Bạn nói chuyện với nó.',
    'onboarding.provider':      'Nhà cung cấp',
    'onboarding.base_url':      'URL máy chủ',
    'onboarding.base_url_ph':   'http://may-chu:11434',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Nhập API key...',
    'onboarding.btn_list_models': 'Tải danh sách model',
    'onboarding.btn_list_models_loading': 'Đang tải model…',
    'onboarding.model':         'Model',
    'onboarding.model_placeholder': '— Nhập key rồi bấm tải danh sách model —',
    'onboarding.token_mode':    'Chế độ token',
    'onboarding.btn_start':     'Bắt đầu →',
    'onboarding.connecting':    'Đang kết nối...',
    'onboarding.err_no_key':    'Vui lòng nhập API key.',
    'onboarding.err_base_url':  'Vui lòng nhập Base URL máy chủ.',
    'onboarding.err_models_first': 'Hãy tải danh sách model và chọn một model trước.',
    'onboarding.err_list_models': 'Không lấy được danh sách model.',
    'onboarding.fallback_models_hint': 'Đang dùng danh sách model mặc định — chọn cẩn thận; model sai sẽ lỗi khi gọi API.',
    'onboarding.err_conn':      'Lỗi kết nối:',
    'onboarding.btn_no_api_key': 'Chơi không cần API Key',

    // Setup
    'setup.title':        'Thiết lập xã hội',
    'setup.hint':         'Mô tả xã hội bạn muốn, hoặc chọn điểm xuất phát',
    'setup.hint_no_api':  'Chọn một preset để bắt đầu — sự kiện AI bị tắt trong chế độ này',
    'setup.preset_nordic': '🏔 Bắc Âu',
    'setup.preset_cap':    '💹 Tư bản tự do',
    'setup.preset_soc':    '🏭 XHCN tập trung',
    'setup.preset_feudal':      '⚔️ Phong kiến',
    'setup.preset_theocracy':   '⛪ Thần quyền',
    'setup.preset_technocracy': '🧠 Chuyên gia trị',
    'setup.preset_warlord':     '🗡 Quân phiệt',
    'setup.preset_commune':     '🌿 Công xã',
    'setup.preset_marxist':     '🟥 Chủ nghĩa Xã hội',
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
    'topbar.stat_stability': 'Ổn định',
    'topbar.stat_food':      'Lương thực',
    'topbar.stat_resources': 'Tài nguyên',
    'topbar.stat_energy':    'Năng lượng',
    'topbar.stat_trust':     'Tin tưởng',
    'topbar.stat_gini':      'Gini',
    'topbar.ai_thinking':    '⏸ AI…',

    // Feed
    'feed.header':      'Nhật ký sự kiện',
    'chronicle.header': 'Biên niên',
    'filter.all':       'Tất cả',
    'filter.important': 'Quan trọng',
    'filter.critical':  'Khẩn cấp',

    // Demographics
    'demo.title':   'Dân số',
    'demo.pop':     'Tổng',
    'demo.male':    '♂ Nam',
    'demo.female':  '♀ Nữ',
    'demo.deaths':  'Đã mất',
    'demo.age_0':   '0–17',
    'demo.age_1':   '18–34',
    'demo.age_2':   '35–49',
    'demo.age_3':   '50–69',
    'demo.age_4':   '70+',

    // Chat
    'chat.ph': 'Nói chuyện với thế giới... ("tạo cơn bão to", "tại sao dân bất ổn?")',
    'chat.disabled': 'Chat AI bị tắt — đang chạy không có API key',

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
    'sp.strong_ties':     'Thân thiết',
    'sp.info_ties':       'Mạng thông tin',
    'sp.weak_ties':       'Quen biết',
    'sp.influence':       'Ảnh hưởng',
    'sp.daily_income':    'Thu nhập/ngày',
    'sp.community_group': 'Nhóm cộng đồng',
    'sp.group':           'Nhóm',
    'sp.flags':           'Trạng thái',
    'sp.sick':            'Bệnh',
    'sp.days_remaining':  'ngày còn lại',
    'sp.criminal_record': 'Tiền án',

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
    'engine.crisis':            'Cuộc khủng hoảng hiến pháp đang đến gần — xã hội đã lệch quá xa khỏi khế ước ban đầu.',
    'engine.married':           '{a} và {b} đã kết hôn.',
    'engine.divorced':          '{a} và {b} đã ly hôn.',
    'engine.birth':             '{parent} vừa có thêm một đứa con.',
    'engine.accident':          '{name} đã bị thương trong một vụ tai nạn.',
    'engine.fell_ill':          '{name} đã bị bệnh.',
    'engine.recovered':         '{name} đã hồi phục sau bệnh tật.',
    'engine.crime':             '{name} đã phạm tội.',
    'engine.community_formed':  'Một nhóm cộng đồng mới đã được thành lập.',
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

    // Role occupations (expanded for social model variety)
    'occ.farmer':    ['Nông dân trồng lúa', 'Người trồng rau', 'Người nuôi gia súc', 'Người làm vườn', 'Ngư dân', 'Người trồng cây ăn quả'],
    'occ.craftsman': ['Thợ rèn', 'Thợ mộc', 'Thợ dệt', 'Thợ gốm', 'Thợ xây', 'Thợ may', 'Thợ thuộc da', 'Thợ kim hoàn', 'Kỹ sư', 'Thợ cơ khí'],
    'occ.merchant':  ['Thương nhân', 'Chủ quán trọ', 'Người đổi tiền', 'Lái buôn', 'Chủ ngân hàng', 'Môi giới', 'Chủ tiệm'],
    'occ.scholar':   ['Giáo viên', 'Thầy thuốc', 'Học giả', 'Triết gia', 'Thư ký', 'Nhà khoa học', 'Luật sư', 'Lưu trữ viên', 'Thần học gia', 'Lập trình viên'],
    'occ.guard':     ['Lính canh', 'Dân quân', 'Tuần tra', 'Chỉ huy đội', 'Cảnh sát trưởng', 'Binh sĩ', 'Quản ngục'],
    'occ.leader':    ['Thành viên hội đồng', 'Trưởng khu', 'Trưởng lão', 'Quan chức', 'Thị trưởng', 'Ủy viên', 'Bí thư đảng'],
    'occ.child':     ['Trẻ em'],

    // Preset descriptions
    'preset.nordic_desc': 'Dân chủ xã hội Bắc Âu — bình đẳng cao, nhà nước mạnh, tin tưởng cao.',
    'preset.cap_desc':    'Tư bản tự do — thị trường tự quyết, bất bình đẳng cao, nhà nước tối thiểu.',
    'preset.soc_desc':    'XHCN tập trung — nhà nước kiểm soát toàn bộ, bình đẳng cao nhưng tự do thấp.',
    'preset.feudal_desc':      'Vương quốc phong kiến — bất bình đẳng cực đoan, tầng lớp quý tộc cầm quyền, nông dân không có quyền.',
    'preset.theocracy_desc':   'Nhà nước thần quyền — giáo lý chiếm lĩnh tất cả, gắn kết cao, học giả dẫn đầu, phản đối bị đàn áp.',
    'preset.technocracy_desc': 'Pương thức chuyên gia trị — chuyên gia và dữ liệu lãnh đạo, tài nguyên dồi dào, ưu tiên đổi mới.',
    'preset.warlord_desc':     'Nhà nước quân phiệt — quyền lực phân mảnh, quân sự hóa, tài nguyên khan hiếm, niềm tin rất thấp.',
    'preset.commune_desc':     'Công xã ư việt — bình đẳng toàn diện, không thị trường, tự quản triệt để, gắn kết cộng đồng rất mạnh.',
    'preset.marxist_desc':     'Nhà nước XHCN — kinh tế kế hoạch tập trung, bất bình đẳng gần như không, nhà nước kiểm soát cao, thị trường bị kiểm soát, sở hữu tập thể.',
    'const.label_gini':     'Hệ số Gini',
    'const.label_market':   'Tự do thị trường',
    'const.label_state':    'Quyền lực nhà nước',
    'const.label_safety':   'Mạng lưới an sinh',
    'const.label_rights':   'Quyền cá nhân',
    'const.label_trust':    'Niềm tin cơ bản',
    'const.label_cohesion': 'Gắn kết xã hội',
    'const.label_scarcity': 'Khan hiếm tài nguyên',
    'const.label_values':   'Ưu tiên giá trị',
    'const.hint_gini':      'Bất bình đẳng tài sản lúc lập quốc (0 = bình đẳng, 1 = crực đoan)',
    'const.hint_market':    'Tự điều tiết của thị trường so với kế hoạch hóa nhà nước',
    'const.hint_state':     'Tầm ảnh hưởng chính trị và quân sự của chính phủ',
    'const.hint_safety':    'Mức độ phuc lợi xã hội và trợ cấp công cộng',
    'const.hint_rights':    'Sàn quyền cá nhân được nhà nước bảo vệ',
    'const.hint_trust':     'Niềm tin xã hội ban đầu vào các thể chế',
    'const.hint_cohesion':  'Mức độ gắn kết trong mạng lưới cộng đồng',
    'const.hint_scarcity':  'Áp lực tài nguyên thiên nhiên (cao = sống còn khó hơn)',
    'const.hint_values':    'Ưu tiên đạo đức khi lập quốc',
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
