const translations = {
  en: {
    // Onboarding
    'onboarding.sub':           'A living world. You talk to it.',
    'onboarding.language':      'Language',
    'onboarding.provider':      'Provider',
    'onboarding.base_url':      'Base URL',
    'onboarding.base_url_ph':   'http://your-server:11434',
    'onboarding.base_url_cloud': 'API host (optional)',
    'onboarding.base_url_cloud_ph': 'https://ollama.com — leave empty for default',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Enter your API key...',
    'onboarding.api_key_cloud_ph': 'Ollama API key (ollama.com/settings/keys)',
    'onboarding.btn_list_models': 'List available models',
    'onboarding.btn_list_models_loading': 'Loading models…',
    'onboarding.model':         'Model',
    'onboarding.model_placeholder': '— Load models after entering your key —',
    'onboarding.token_mode':    'Token mode',
    'onboarding.npc_count':     'Starting population (NPCs)',
    'onboarding.npc_count_hint': 'Minimum 500. More NPCs = richer simulation but slower performance.',
    'onboarding.rpm_limit':     'Rate limit (RPM)',
    'onboarding.rpm_limit_ph':  'Requests per minute (0 = unlimited)',
    'onboarding.rpm_hint':
      'Gemini free: 15 RPM · Paid: 60+ RPM · 0 = no limit',
    'onboarding.btn_start':     'Begin →',
    'onboarding.connecting':    'Connecting...',
    'onboarding.err_no_key':    'Please enter an API key.',
    'onboarding.err_base_url':  'Please enter the server Base URL.',
    'onboarding.err_models_first': 'List models first, then pick one.',
    'onboarding.err_list_models': 'Could not list models.',
    'onboarding.fallback_models_hint': 'Using built-in model list — pick carefully; invalid ids will fail at runtime.',
    'onboarding.err_conn':      'Connection error:',
    'onboarding.btn_no_api_key': 'Play without API Key',
    'onboarding.api_key_security_hint':
      'Tip: create your own API key with your provider, set spending or rate limits there, then paste it here. For extra safety, use a dedicated key and revoke or delete it as soon as you finish playing.',

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
    'topbar.tip_stability':
      'Overall social order and resilience. Low values mean unrest, fragmentation, and crisis risk.',
    'topbar.tip_food':
      'Food security and stock coverage. Low values lead to hunger, stress, and instability.',
    'topbar.tip_resources':
      'Remaining natural resource capacity for production and growth.',
    'topbar.tip_energy':
      'Effective productive capacity of the society (workforce output adjusted by literacy and food constraints).',
    'topbar.tip_trust':
      'Average public trust in government intention and institutions.',
    'topbar.tip_gini':
      'Wealth inequality index (0 = equal, 1 = extreme inequality). Higher values increase social tension.',
    'topbar.tip_level_healthy': 'Status: healthy',
    'topbar.tip_level_warning': 'Status: warning',
    'topbar.tip_level_danger':  'Status: danger',
    'topbar.tip_level_critical':'Status: critical',

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
    'demo.leaving': 'Leaving',
    'demo.born':    'Born',
    'demo.immigrants': 'Immigrants',
    'demo.age_0':   '0–17',
    'demo.age_1':   '18–34',
    'demo.age_2':   '35–49',
    'demo.age_3':   '50–69',
    'demo.age_4':   '70+',

    // Labor tension panel
    'labor.title':  '⚒ Labor Tension',
    'labor.legend': 'solidarity / grievance',

    // Rumors panel
    'rumors.title': '💬 Rumors ({count})',
    'rumors.empty': 'No active rumors right now.',

    // Economics panel
    'econ.title':       '💰 Economics',
    'econ.gdp':         'GDP',
    'econ.extraction':  'Extraction',
    'econ.efficiency':  'Efficiency',
    'econ.tax_pool':    'Tax Pool',
    'econ.tax_rate':    'Tax Rate',
    'econ.tip_gdp':     'Total daily income of all living citizens (coins/day). Reflects overall economic output.',
    'econ.tip_extraction': 'Resource extraction efficiency — how much producers extract relative to their maximum capacity.',
    'econ.tip_efficiency': 'Economic output as percentage of theoretical maximum (all workers at full capacity).',
    'econ.tip_tax_pool':   'Government treasury: taxes collected from income and used for regime-specific spending.',
    'econ.tip_tax_rate':   'Income tax rate applied to market workers (farmers, craftsmen, merchants, scholars).',

    // Crisis banner + strike readiness feed
    'crisis.banner':           '⚠ CIVILIZATION IN CRISIS',
    'feed.strike_readiness':   '⚠ {role}s showing strike readiness — solidarity {sol}%, grievance {griev}%',

    // Story card labels
    'story.critical':          '⚡ Critical Event',
    'story.chronicle':         '📜 Chronicle',

    // Policy choice modal
    'modal.policy_title':      '🏛 Government — Choose a Policy',
    'modal.policy_btn_a':      'Choose A',
    'modal.policy_btn_b':      'Choose B',
    'modal.policy_countdown':  'Auto-selecting in {s}s',

    // Policy effect labels
    'policy.food_up':          '🍞 Food ↑',
    'policy.food_down':        '🍞 Food ↓',
    'policy.resources_up':     '⛏ Resources ↑',
    'policy.grievance_down':   'Grievance ↓',
    'policy.grievance_up':     'Grievance ↑',
    'policy.happiness_up':     '😊 Happiness ↑',
    'policy.fear_up':          '😨 Fear ↑',
    'policy.fear_down':        'Fear ↓',
    'policy.solidarity_down':  'Solidarity ↓',
    'policy.solidarity_up':    'Solidarity ↑',

    // NPC Memory section
    'sp.memory':               'Memory',
    'sp.mem.betrayal':         'Betrayal',
    'sp.mem.helped':           'Helped',
    'sp.mem.harmed':           'Harmed',
    'sp.mem.crisis':           'Crisis',
    'sp.mem.windfall':         'Windfall',
    'sp.mem.loss':             'Loss',
    'sp.mem.illness':          'Illness',
    'sp.mem.crime':            'Crime',
    'sp.mem.accident':         'Accident',
    'sp.mem.today':            'today',
    'sp.mem.1day_ago':         '1 day ago',
    'sp.mem.ndays_ago':        '{n}d ago',

    // Chat
    'chat.ph': 'Talk to the world... ("create a storm", "government corruption to the extreme,...")',
    'chat.disabled': 'AI chat disabled — running without API key',

    // Map legend — social network visuals
    'map.legend.heading':     'Social network',
    'map.legend.info':        'Blue dashed — news & rumors while socializing or organizing',
    'map.legend.strong':      'Solid lines — close ties nearby; color shifts with activity',
    'map.legend.family':      'Warm gold — spouses when close in the same area',
    'map.legend.spotlight':   'Click a citizen — highlight their ties (incl. weak-tie rings)',
    'map.legend.roles_title': 'Dot colors — roles',
    'map.note_btn_title':     'Map notes',
    'map.note_title':         '🗺 Map Notes',
    'map.note_body':
      '<b>This map is conceptual, not real geographic population density.</b><br><br>' +
      'It is a systems map that helps you read social dynamics quickly, not a literal city GIS layout.<br><br>' +
      '<b>How to read it:</b><br>' +
      '• Zones represent functional domains (food, market, governance, learning, housing).<br>' +
      '• NPC positions are visual cues for activity/state, not surveyed addresses.<br>' +
      '• Lines emphasize relationship dynamics (strong ties, info ties, family links), not roads.<br>' +
      '• Distances are stylized for readability and simulation clarity.<br><br>' +
      'Treat each zone as a narrative/functional layer of society.',

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
    'sp.in_love':     '❤ In love with',
    'sp.heartbroken': '💔 Heartbroken',
    'sp.attraction':  'Attraction',
    'sp.compat':      'Compatibility',
    'sp.heartbreak_recovery': 'days until healed',
    'sp.romance':     'Romance',
    'sp.healing':     'Healing',
    'sp.mutual_feelings': '💑 Mutual feelings',

    // Spotlight — status bars
    'sp.stress':      'Stress',
    'sp.happiness':   'Happiness',
    'sp.grievance':   'Dissatisfaction',
    'sp.hunger':      'Hunger',
    'sp.exhaustion':  'Fatigue',
    'sp.isolation':   'Loneliness',
    'sp.burnout':     '🔥 Burned out',
    'sp.work_motivation': 'Work motivation',

    // Work motivation labels
    'motiv.survival':    '🍞 Survival',
    'motiv.coerced':     '⛓ Coerced',
    'motiv.mandatory':   '📋 Mandatory',
    'motiv.happiness':   '✨ Fulfillment',
    'motiv.achievement': '🏆 Achievement',
    'motiv.duty':        '🛡 Duty',

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
    'sp.burnout_risk':    'Burnout risk',
    'sp.burnout_days':    'days of strain',
    'sp.ideological_stab':'Ideological stability',
    'sp.susceptible':     '⚠ Susceptible to radicalization',
    'sp.class_solidarity':'Class solidarity',
    'sp.on_strike':       '⚒ On strike',

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
    'death.unknown':  'unknown causes',

    // Engine narrative
    'engine.crisis':            'A constitutional crisis is approaching — society has drifted too far from its founding compact.',
    'engine.married':           '{a} and {b} have gotten married.',
    'engine.divorced':          '{a} and {b} have divorced.',
    'engine.heartbroken':       '💔 {name} is heartbroken after their relationship ended.',
    'engine.birth':             '{parent} has had a child.',
    'engine.accident':          '{name} was injured in an accident.',
    'engine.fell_ill':          '{name} has fallen ill.',
    'engine.recovered':         '{name} has recovered from illness.',
    'engine.crime':             '{name} committed a crime.',
    'engine.overwork':          '{name} collapsed from overwork.',
    'engine.burnout':           '{name} is suffering from burnout — chronic exhaustion and stress have taken their toll.',
    'engine.community_formed':  'A new community group has formed.',
    'engine.intervention': '⚡ Intervention affected {n} NPC{s}.',
    'engine.instant_deaths': '💀 {n} people were killed instantly.',
    'engine.event_deaths': '💀 {n} people died from natural disasters.',
    'engine.strike_start': '⚒ {role}s have gone on strike! Demand: {demand}. Productivity in this sector collapses.',
    'engine.strike_end': '⚒ The {role} strike has ended. Workers return — but tensions remain.',
    'strike.demand.wages': 'higher wages',
    'strike.demand.conditions': 'better working conditions',
    'strike.demand.rights': 'basic rights',
    'role.farmer': 'Farmer',
    'role.craftsman': 'Craftsman',
    'role.merchant': 'Merchant',
    'role.scholar': 'Scholar',
    'role.guard': 'Guard',
    'role.leader': 'Leader',
    'role.child': 'Child',
    // Event type display labels
    'event.storm': 'Storm',
    'event.drought': 'Drought',
    'event.flood': 'Flood',
    'event.tsunami': 'Tsunami',
    'event.epidemic': 'Epidemic',
    'event.resource_boom': 'Resource Boom',
    'event.harsh_winter': 'Harsh Winter',
    'event.trade_offer': 'Trade Offer',
    'event.refugee_wave': 'Refugee Wave',
    'event.ideology_import': 'Ideology Shift',
    'event.external_threat': 'External Threat',
    'event.blockade': 'Blockade',
    'event.scandal_leak': 'Scandal',
    'event.charismatic_npc': 'Charismatic Leader',
    'event.martyr': 'Martyr',
    'event.tech_shift': 'Tech Breakthrough',
    'event.wildfire': 'Wildfire',
    'event.earthquake': 'Earthquake',
    'event.nuclear_explosion': 'Nuclear Explosion',
    'event.bombing': 'Bombing',
    'event.meteor_strike': 'Meteor Strike',
    'event.volcanic_eruption': 'Volcanic Eruption',
    'engine.extinction': '💀 The last NPC has died. The society is extinct.',
    'engine.legendary_death': '⭐ {name} ({occupation}, age {age}) — a legendary figure — has died of {cause}. Their legacy endures.',
    'engine.legendary_recognized': '⭐ {name} ({occupation}) is now recognized as a legendary figure — {reason}.',
    'engine.legendary_reason.influential': 'a figure of great social influence',
    'engine.legendary_reason.wealthy': 'one of the wealthiest citizens',
    'engine.legendary_reason.reformed': 'a reformed criminal turned pillar of the community',
    'engine.legendary_reason.faction_elder': 'a veteran faction leader',
    'engine.legendary_reason.elder': 'a venerable elder',
    'engine.immigration_wave': '🚶‍♂️ {n} immigrants arrived and settled in the city.',
    'gov.feed_title': '🏛 [Government Policy] {policy}',
    'gov.feed_public_statement': '📢 "{statement}"',
    'gov.feed_alerts': '📊 Alerts: {alerts}',
    'gov.chronicle_enacted': '🏛 Government enacted: {policy}',
    'gov.policy_delayed': '🏛 Government policy delayed — RPM budget exhausted. Resuming in ~{seconds}s.',

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
    'occ.farmer':    ['Rice Farmer', 'Vegetable Grower', 'Livestock Keeper', 'Gardener', 'Fisherman', 'Orchard Keeper',
                      'Shepherd', 'Miller', 'Beekeeper', 'Herbalist', 'Vineyard Keeper', 'Drover'],
    'occ.craftsman': ['Blacksmith', 'Carpenter', 'Weaver', 'Potter', 'Mason', 'Tailor', 'Tanner', 'Jeweler', 'Engineer', 'Mechanic',
                      'Glassblower', 'Cooper', 'Wheelwright', 'Dyer', 'Bookbinder', 'Stonemason', 'Tilemaker'],
    'occ.merchant':  ['Trader', 'Innkeeper', 'Money Changer', 'Peddler', 'Banker', 'Broker', 'Shopkeeper',
                      'Auctioneer', 'Wholesaler', 'Caravan Master', 'Apothecary', 'Moneylender'],
    'occ.scholar':   ['Teacher', 'Physician', 'Scholar', 'Philosopher', 'Scribe', 'Scientist', 'Lawyer', 'Archivist', 'Theologian', 'Programmer',
                      'Cartographer', 'Astronomer', 'Historian', 'Judge', 'Curator', 'Surveyor'],
    'occ.guard':     ['Sentry', 'Militia', 'Patrol Officer', 'Squad Leader', 'Sheriff', 'Soldier', 'Prison Warden',
                      'Bailiff', 'Night Watch', 'Harbor Guard', 'Gate Keeper', 'Constable'],
    'occ.leader':    ['Council Member', 'District Chief', 'Elder', 'Official', 'Mayor', 'Commissioner', 'Party Secretary',
                      'Magistrate', 'Alderman', 'Tribune', 'Steward', 'Prefect'],
    'occ.child':     ['Child'],

    // ── Regime-specific occupation variants ───────────────────────────────────
    // Feudal
    'occ.farmer.feudal':    ['Serf', 'Peasant', 'Bonded Farmer', 'Villein', 'Crofter', 'Bondman', 'Cottar'],
    'occ.craftsman.feudal': ['Guild Artisan', 'Journeyman', 'Tradesman', 'Farrier', 'Cooper', 'Wheelwright', 'Tilemaker'],
    'occ.merchant.feudal':  ['Peddler', 'Market Stallholder', 'Cloth Merchant', 'Spice Trader', 'Chandler', 'Draper'],
    'occ.scholar.feudal':   ['Cleric', 'Friar', 'Scribe', 'Monk', 'Almoner', 'Parish Priest', 'Canon'],
    'occ.guard.feudal':     ['Knight', 'Man-at-Arms', 'Archer', 'Crossbowman', 'Pikeman', 'Sentry', 'Squire'],
    'occ.leader.feudal':    ['Lord', 'Baron', 'Vassal', 'Castellan', 'Seneschal', 'Margrave', 'Liege'],
    // Theocracy
    'occ.farmer.theocracy':    ['Temple Farmer', 'Parish Laborer', 'Tithe Payer', 'Lay Worker', 'Sacred Gardener'],
    'occ.craftsman.theocracy': ['Temple Artisan', 'Sacred Mason', 'Icon Maker', 'Bell Founder', 'Candlemaker', 'Relic Carver'],
    'occ.merchant.theocracy':  ['Offering Collector', 'Temple Merchant', 'Market Keeper', 'Trade Deacon', 'Tithe Agent'],
    'occ.scholar.theocracy':   ['Priest', 'Deacon', 'Monk', 'Theologian', 'Inquisitor', 'Acolyte', 'Cleric', 'Bishop', 'Exorcist'],
    'occ.guard.theocracy':     ['Temple Guard', 'Holy Warrior', 'Inquisitor Guard', 'Sacred Sentinel', 'Order Knight', 'Crusader'],
    'occ.leader.theocracy':    ['High Priest', 'Archdeacon', 'Bishop', 'Canon', 'Grand Inquisitor', 'Elder Prophet'],
    // Technocracy
    'occ.farmer.technocracy':    ['Agri-Tech Operator', 'Hydroponic Farmer', 'Precision Farmer', 'Bio-Engineer', 'Lab Grower'],
    'occ.craftsman.technocracy': ['Engineer', 'Technician', 'Programmer', 'Robotics Tech', 'Systems Engineer', 'DevOps Specialist'],
    'occ.merchant.technocracy':  ['Entrepreneur', 'Venture Capitalist', 'Tech Broker', 'Platform Manager', 'IP Trader', 'Startup Founder'],
    'occ.scholar.technocracy':   ['Data Scientist', 'AI Researcher', 'Systems Analyst', 'Policy Scientist', 'Research Engineer', 'Biotech Scientist'],
    'occ.guard.technocracy':     ['Security Analyst', 'Drone Operator', 'Cyber Guard', 'Systems Monitor', 'Patrol Technician'],
    'occ.leader.technocracy':    ['Director', 'Chief Analyst', 'Committee Chair', 'Policy Architect', 'Algorithm Lead', 'Science Council Head'],
    // Warlord
    'occ.farmer.warlord':    ['Conscript Farmer', 'Tribute Payer', 'Forager', 'Camp Laborer', 'Field Serf'],
    'occ.craftsman.warlord': ['Armorer', 'Weapon Smith', 'Siege Engineer', 'Fortification Builder', 'Munitions Maker'],
    'occ.merchant.warlord':  ['War Profiteer', 'Black Market Dealer', 'Loot Trader', 'Quartermaster', 'Supply Agent'],
    'occ.scholar.warlord':   ['Strategist', 'Intelligence Officer', 'Propagandist', 'Field Medic', 'War Correspondent'],
    'occ.guard.warlord':     ['Soldier', 'Fighter', 'Warrior', 'Militiaman', 'Conscript', 'Raider', 'Enforcer', 'Sniper'],
    'occ.leader.warlord':    ['Warlord', 'General', 'Commander', 'War Chief', 'Colonel', 'Field Marshal', 'Chieftain'],
    // Collective (commune / socialist / marxist)
    'occ.farmer.collective':    ['Collective Worker', 'Brigade Member', 'State Farmer', 'Commune Farmer', 'Field Comrade'],
    'occ.craftsman.collective': ['Factory Worker', 'State Artisan', 'Brigade Craftsman', 'Union Worker', 'Production Comrade'],
    'occ.merchant.collective':  ['Distribution Officer', 'Supply Coordinator', 'Exchange Agent', 'Ration Manager', 'Procurement Worker'],
    'occ.scholar.collective':   ["People's Teacher", 'State Scientist', 'Cultural Worker', 'Party Educator', 'Agitprop Officer'],
    'occ.guard.collective':     ["People's Militia", 'State Guard', 'Party Security', 'Revolutionary Guard', 'Order Keeper'],
    'occ.leader.collective':    ['Commissar', 'Party Secretary', 'Committee Chair', 'Collective Director', 'Cadre', 'Politburo Member'],
    // Capitalist
    'occ.farmer.capitalist':    ['Contract Farmer', 'Agribusiness Worker', 'Crop Specialist', 'Ranch Hand', 'Farm Operator'],
    'occ.craftsman.capitalist': ['Factory Technician', 'Industrial Worker', 'Manufacturing Specialist', 'Production Worker', 'Contractor'],
    'occ.merchant.capitalist':  ['Entrepreneur', 'Investor', 'Executive', 'Business Owner', 'Developer', 'Venture Capitalist', 'Broker'],
    'occ.scholar.capitalist':   ['Consultant', 'Analyst', 'Legal Counsel', 'Financial Advisor', 'Market Researcher', 'Economist'],
    'occ.guard.capitalist':     ['Private Security', 'Corporate Guard', 'Patrol Officer', 'Security Contractor', 'Bouncer'],
    'occ.leader.capitalist':    ['CEO', 'Board Director', 'Corporate Chair', 'City Manager', 'Executive Director', 'Commissioner'],

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

    // Settings panel
    'settings.title':                    '⚙ Settings',
    'settings.tab_ai':                   '🤖 AI-Driven',
    'settings.elections.label':          '🗳 Human-Driven Elections',
    'settings.elections.desc':           'NPCs elect a real leader NPC. Their worldview biases all policy decisions.',
    'settings.election_cycle.label':     'Election cycle (sim-days)',
    'settings.gov_ai.label':             '🏛 Government AI Policy',
    'settings.gov_ai.desc':              'LLM generates policy options every 15 days. Off → deterministic fallbacks.',
    'settings.npc_thoughts.label':       '💭 NPC Thought Generation',
    'settings.npc_thoughts.desc':        'LLM generates daily thoughts in spotlight. Off → template fallback.',
    'settings.press_ai.label':           '📰 Press Headlines',
    'settings.press_ai.desc':            'AI generates newspaper headlines every 5 days. Off → no AI headlines.',
    'settings.consequence.label':        '🔮 Consequence Prediction',
    'settings.consequence.desc':         'AI predicts ripple effects after events. Off → no predictions shown.',
    'settings.regime_locked':            'Regime-locked',
    'settings.enabled':                  'Enabled',
    'settings.disabled':                 'Disabled',

    // Election feed messages
    'election.new_leader':   '🗳 Election: {name} ({occ}) wins with {pct}% of votes, replacing {prev}.',
    'election.first_leader': '🗳 Election: {name} ({occ}) elected with {pct}% of votes.',
  },

  vi: {
    // Onboarding
    'onboarding.sub':           'Một thế giới sống. Bạn nói chuyện với nó.',
    'onboarding.language':      'Ngôn ngữ',
    'onboarding.provider':      'Nhà cung cấp',
    'onboarding.base_url':      'URL máy chủ',
    'onboarding.base_url_ph':   'http://may-chu:11434',
    'onboarding.base_url_cloud': 'Máy chủ API (tùy chọn)',
    'onboarding.base_url_cloud_ph': 'https://ollama.com — để trống dùng mặc định',
    'onboarding.api_key':       'API Key',
    'onboarding.api_key_ph':    'Nhập API key...',
    'onboarding.api_key_cloud_ph': 'API key Ollama (ollama.com/settings/keys)',
    'onboarding.btn_list_models': 'Tải danh sách model',
    'onboarding.btn_list_models_loading': 'Đang tải model…',
    'onboarding.model':         'Model',
    'onboarding.model_placeholder': '— Nhập key rồi bấm tải danh sách model —',
    'onboarding.token_mode':    'Chế độ token',
    'onboarding.npc_count':     'Dân số ban đầu (NPC)',
    'onboarding.npc_count_hint': 'Tối thiểu 500. Nhiều NPC hơn = mô phỏng phong phú hơn nhưng chậm hơn.',
    'onboarding.rpm_limit':     'Giới hạn tốc độ (RPM)',
    'onboarding.rpm_limit_ph':  'Số request mỗi phút (0 = không giới hạn)',
    'onboarding.rpm_hint':
      'Gemini miễn phí: 15 RPM · Trả phí: 60+ RPM · 0 = không giới hạn',
    'onboarding.btn_start':     'Bắt đầu →',
    'onboarding.connecting':    'Đang kết nối...',
    'onboarding.err_no_key':    'Vui lòng nhập API key.',
    'onboarding.err_base_url':  'Vui lòng nhập Base URL máy chủ.',
    'onboarding.err_models_first': 'Hãy tải danh sách model và chọn một model trước.',
    'onboarding.err_list_models': 'Không lấy được danh sách model.',
    'onboarding.fallback_models_hint': 'Đang dùng danh sách model mặc định — chọn cẩn thận; model sai sẽ lỗi khi gọi API.',
    'onboarding.err_conn':      'Lỗi kết nối:',
    'onboarding.btn_no_api_key': 'Chơi không cần API Key',
    'onboarding.api_key_security_hint':
      'Gợi ý: hãy tự tạo API key ở nhà cung cấp, đặt giới hạn chi tiêu hoặc tốc độ gọi API ngay tại đó, rồi dán key vào đây để chơi. Nếu muốn an toàn hơn, bạn có thể tạo một key riêng cho lần chơi và xóa hoặc thu hồi key ngay sau khi chơi xong.',

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
    'setup.preset_marxist':     '🟥 Mác-xít',
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
    'topbar.tip_stability':
      'Mức trật tự và khả năng chống chịu của xã hội. Thấp sẽ dễ bất ổn, phân rã và khủng hoảng.',
    'topbar.tip_food':
      'An ninh lương thực và mức dự trữ. Thấp sẽ dẫn đến đói, căng thẳng và bất ổn.',
    'topbar.tip_resources':
      'Dung lượng tài nguyên tự nhiên còn lại cho sản xuất và tăng trưởng.',
    'topbar.tip_energy':
      'Năng lực sản xuất hiệu dụng của xã hội (đầu ra lao động sau khi tính học vấn và ràng buộc lương thực).',
    'topbar.tip_trust':
      'Mức tin tưởng trung bình của dân vào ý định chính phủ và thể chế.',
    'topbar.tip_gini':
      'Chỉ số bất bình đẳng tài sản (0 = bình đẳng, 1 = cực đoan). Càng cao càng dễ căng thẳng xã hội.',
    'topbar.tip_level_healthy': 'Trạng thái: ổn',
    'topbar.tip_level_warning': 'Trạng thái: cảnh báo',
    'topbar.tip_level_danger':  'Trạng thái: nguy hiểm',
    'topbar.tip_level_critical':'Trạng thái: nghiêm trọng',

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
    'demo.leaving': 'Rời đi',
    'demo.born':    'Sinh ra',
    'demo.immigrants': 'Nhập cư',
    'demo.age_0':   '0–17',
    'demo.age_1':   '18–34',
    'demo.age_2':   '35–49',
    'demo.age_3':   '50–69',
    'demo.age_4':   '70+',

    // Labor tension panel
    'labor.title':  '⚒ Căng thẳng lao động',
    'labor.legend': 'đoàn kết / bức xúc',

    // Rumors panel
    'rumors.title': '💬 Tin đồn ({count})',
    'rumors.empty': 'Hiện chưa có tin đồn nào đang hoạt động.',

    // Economics panel
    'econ.title':       '💰 Kinh tế',
    'econ.gdp':         'GDP',
    'econ.extraction':  'Khai thác',
    'econ.efficiency':  'Hiệu quả',
    'econ.tax_pool':    'Ngân sách',
    'econ.tax_rate':    'Thuế suất',
    'econ.tip_gdp':     'Tổng thu nhập hàng ngày của tất cả người dân (đồng/ngày). Phản ánh sản lượng kinh tế tổng thể.',
    'econ.tip_extraction': 'Hiệu quả khai thác tài nguyên — mức khai thác thực tế so với năng lực tối đa của người sản xuất.',
    'econ.tip_efficiency': 'Sản lượng kinh tế thực tế so với lý thuyết tối đa (tất cả lao động làm việc hết công suất).',
    'econ.tip_tax_pool':   'Ngân sách chính phủ: thuế thu từ thu nhập và được chi theo thể chế.',
    'econ.tip_tax_rate':   'Thuế suất thu nhập áp dụng cho lao động thị trường (nông dân, thợ thủ công, thương nhân, học giả).',

    // Crisis banner + strike readiness feed
    'crisis.banner':           '⚠ VĂN MINH ĐANG KHỦNG HOẢNG',
    'feed.strike_readiness':   '⚠ {role} đang có dấu hiệu đình công — đoàn kết {sol}%, bức xúc {griev}%',

    // Story card labels
    'story.critical':          '⚡ Sự kiện nghiêm trọng',
    'story.chronicle':         '📜 Biên niên',

    // Policy choice modal
    'modal.policy_title':      '🏛 Chính phủ — Chọn chính sách',
    'modal.policy_btn_a':      'Chọn A',
    'modal.policy_btn_b':      'Chọn B',
    'modal.policy_countdown':  'Tự chọn sau {s}s',

    // Policy effect labels
    'policy.food_up':          '🍞 Lương thực ↑',
    'policy.food_down':        '🍞 Lương thực ↓',
    'policy.resources_up':     '⛏ Tài nguyên ↑',
    'policy.grievance_down':   'Bức xúc ↓',
    'policy.grievance_up':     'Bức xúc ↑',
    'policy.happiness_up':     '😊 Hạnh phúc ↑',
    'policy.fear_up':          '😨 Nỗi sợ ↑',
    'policy.fear_down':        'Nỗi sợ ↓',
    'policy.solidarity_down':  'Đoàn kết ↓',
    'policy.solidarity_up':    'Đoàn kết ↑',

    // NPC Memory section
    'sp.memory':               'Ký ức',
    'sp.mem.betrayal':         'Phản bội',
    'sp.mem.helped':           'Được giúp đỡ',
    'sp.mem.harmed':           'Bị tổn hại',
    'sp.mem.crisis':           'Khủng hoảng',
    'sp.mem.windfall':         'May mắn',
    'sp.mem.loss':             'Mất mát',
    'sp.mem.illness':          'Bệnh tật',
    'sp.mem.crime':            'Tội ác',
    'sp.mem.accident':         'Tai nạn',
    'sp.mem.today':            'hôm nay',
    'sp.mem.1day_ago':         '1 ngày trước',
    'sp.mem.ndays_ago':        '{n} ngày trước',

    // Chat
    'chat.ph': 'Nói chuyện với thế giới... ("tạo cơn bão to, chính phủ tham nhũng cực độ,...")',
    'chat.disabled': 'Chat AI bị tắt — đang chạy không có API key',

    // Map legend — social network visuals
    'map.legend.heading':     'Mạng xã hội',
    'map.legend.info':        'Xanh nét đứt — tin đồn/tin tức khi giao lưu hoặc tổ chức',
    'map.legend.strong':      'Nét liền — quan hệ thân gần; màu đổi theo hoạt động',
    'map.legend.family':      'Vàng ấm — vợ/chồng khi ở gần trong cùng khu',
    'map.legend.spotlight':   'Bấm vào công dân — xem nổi bật các mối quan hệ (kể cả vòng quen biết)',
    'map.legend.roles_title': 'Màu chấm — nghề & vai trò',
    'map.note_btn_title':     'Ghi chú bản đồ',
    'map.note_title':         '🗺 Ghi chú bản đồ',
    'map.note_body':
      '<b>Bản đồ này mang tính mô phỏng khái niệm, không phải phân bố dân cư địa lý thực.</b><br><br>' +
      'Đây là bản đồ hệ thống để bạn đọc động lực xã hội nhanh hơn, không phải bản đồ GIS đô thị theo nghĩa đen.<br><br>' +
      '<b>Cách đọc bản đồ:</b><br>' +
      '• Mỗi zone đại diện cho một miền chức năng xã hội (lương thực, thị trường, quản trị, tri thức, khu ở).<br>' +
      '• Vị trí NPC là tín hiệu trực quan về hoạt động/trạng thái, không phải địa chỉ khảo sát thực.<br>' +
      '• Các đường nối nhấn mạnh quan hệ xã hội (liên kết mạnh, mạng thông tin, liên kết gia đình), không phải đường xá.<br>' +
      '• Khoảng cách được cách điệu để dễ đọc và rõ logic mô phỏng.<br><br>' +
      'Hãy hiểu zone như một lớp diễn giải/chức năng của xã hội.',

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
    'sp.in_love':     '❤ Đang yêu',
    'sp.heartbroken': '💔 Đang đau khổ',
    'sp.attraction':  'Độ hấp dẫn',
    'sp.compat':      'Độ tương hợp',
    'sp.heartbreak_recovery': 'ngày để hồi phục',
    'sp.romance':     'Tình cảm',
    'sp.healing':     'Hồi phục',
    'sp.mutual_feelings': '💑 Tình cảm đôi chiều',

    // Spotlight — status bars
    'sp.stress':      'Căng thẳng',
    'sp.happiness':   'Hạnh phúc',
    'sp.grievance':   'Bất mãn',
    'sp.hunger':      'Đói',
    'sp.exhaustion':  'Kiệt sức',
    'sp.isolation':   'Cô đơn',
    'sp.burnout':     '🔥 Kiệt sức mãn tính',
    'sp.work_motivation': 'Động lực làm việc',

    // Work motivation labels (Vietnamese)
    'motiv.survival':    '🍞 Sinh tồn',
    'motiv.coerced':     '⛓ Cưỡng bức',
    'motiv.mandatory':   '📋 Bắt buộc',
    'motiv.happiness':   '✨ Mưu cầu hạnh phúc',
    'motiv.achievement': '🏆 Chứng tỏ bản thân',
    'motiv.duty':        '🛡 Nghĩa vụ',

    // Spotlight — worldview bars
    'sp.collectivism':    'Tập thể',
    'sp.auth_trust':      'Tin tưởng chính quyền',
    'sp.risk_tolerance':  'Chấp nhận rủi ro',

    // Spotlight — trust
    'sp.competence':  'Năng lực',
    'sp.intention':   'Liêm chính',
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
    'sp.burnout_risk':    'Nguy cơ kiệt sức',
    'sp.burnout_days':    'ngày căng thẳng',
    'sp.ideological_stab':'Ổn định tư tưởng',
    'sp.susceptible':     '⚠ Dễ bị cực đoan hóa',
    'sp.class_solidarity':'Đoàn kết giai cấp',
    'sp.on_strike':       '⚒ Đang đình công',

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
    'death.unknown':  'không rõ nguyên nhân',

    // Engine narrative
    'engine.crisis':            'Cuộc khủng hoảng hiến pháp đang đến gần — xã hội đã lệch quá xa khỏi khế ước ban đầu.',
    'engine.married':           '{a} và {b} đã kết hôn.',
    'engine.divorced':          '{a} và {b} đã ly hôn.',
    'engine.heartbroken':       '💔 {name} đang đau khổ sau khi mối quan hệ tan vỡ.',
    'engine.birth':             '{parent} vừa có thêm một đứa con.',
    'engine.accident':          '{name} đã bị thương trong một vụ tai nạn.',
    'engine.fell_ill':          '{name} đã bị bệnh.',
    'engine.recovered':         '{name} đã hồi phục sau bệnh tật.',
    'engine.crime':             '{name} đã phạm tội.',
    'engine.overwork':          '{name} đã ngã quỵ vì làm việc quá sức.',
    'engine.burnout':           '{name} đang kiệt sức — stress và mệt mỏi kéo dài đã ảnh hưởng nghiêm trọng.',
    'engine.community_formed':  'Một nhóm cộng đồng mới đã được thành lập.',
    'engine.intervention': '⚡ Can thiệp ảnh hưởng đến {n} NPC.',
    'engine.instant_deaths': '💀 {n} người đã chết ngay lập tức.',
    'engine.event_deaths': '💀 {n} người tử vong do thiên tai.',
    'engine.strike_start': '⚒ Những người {role} đã đình công! Yêu cầu: {demand}. Năng suất ngành này sụp đổ.',
    'engine.strike_end': '⚒ Cuộc đình công của {role} đã kết thúc. Công nhân trở lại làm việc — nhưng căng thẳng vẫn còn.',
    'strike.demand.wages': 'tăng lương',
    'strike.demand.conditions': 'cải thiện điều kiện lao động',
    'strike.demand.rights': 'quyền cơ bản',
    'role.farmer': 'Nông dân',
    'role.craftsman': 'Thợ thủ công',
    'role.merchant': 'Thương nhân',
    'role.scholar': 'Học giả',
    'role.guard': 'Lính canh',
    'role.leader': 'Lãnh đạo',
    'role.child': 'Trẻ em',
    // Event type display labels
    'event.storm': 'Bão',
    'event.drought': 'Hạn hán',
    'event.flood': 'Lũ lụt',
    'event.tsunami': 'Sóng thần',
    'event.epidemic': 'Dịch bệnh',
    'event.resource_boom': 'Bùng nổ tài nguyên',
    'event.harsh_winter': 'Mùa đông khắc nghiệt',
    'event.trade_offer': 'Đề nghị thương mại',
    'event.refugee_wave': 'Làn sóng tị nạn',
    'event.ideology_import': 'Làn sóng tư tưởng',
    'event.external_threat': 'Mối đe dọa bên ngoài',
    'event.blockade': 'Phong tỏa',
    'event.scandal_leak': 'Bê bối',
    'event.charismatic_npc': 'Nhân vật lôi cuốn',
    'event.martyr': 'Người tử vì đạo',
    'event.tech_shift': 'Đột phá công nghệ',
    'event.wildfire': 'Cháy rừng',
    'event.earthquake': 'Động đất',
    'event.nuclear_explosion': 'Vụ nổ hạt nhân',
    'event.bombing': 'Đánh bom',
    'event.meteor_strike': 'Thiên thạch',
    'event.volcanic_eruption': 'Núi lửa phun trào',
    'engine.extinction': '💀 NPC cuối cùng đã chết. Xã hội đã diệt vong.',
    'engine.legendary_death': '⭐ {name} ({occupation}, {age} tuổi) — một nhân vật huyền thoại — đã qua đời vì {cause}. Di sản của họ vẫn còn mãi.',
    'engine.legendary_recognized': '⭐ {name} ({occupation}) giờ được công nhận là một nhân vật huyền thoại — {reason}.',
    'engine.legendary_reason.influential': 'một nhân vật có ảnh hưởng xã hội rất lớn',
    'engine.legendary_reason.wealthy': 'một trong những công dân giàu có nhất',
    'engine.legendary_reason.reformed': 'một người từng phạm tội nhưng cải tà quy chính và trở thành trụ cột cộng đồng',
    'engine.legendary_reason.faction_elder': 'một lãnh đạo kỳ cựu của phe phái',
    'engine.legendary_reason.elder': 'một bậc trưởng lão đáng kính',
    'engine.immigration_wave': '🚶‍♂️ Có {n} người nhập cư đến và định cư trong thành phố.',
    'gov.feed_title': '🏛 [Chính sách Chính phủ] {policy}',
    'gov.feed_public_statement': '📢 "{statement}"',
    'gov.feed_alerts': '📊 Cảnh báo: {alerts}',
    'gov.chronicle_enacted': '🏛 Chính phủ ban hành: {policy}',
    'gov.policy_delayed': '🏛 Chính sách chính phủ bị hoãn — đã dùng hết ngân sách RPM. Tiếp tục sau khoảng ~{seconds}s.',

    // Game over screen
    'gameover.title':       'Diệt vong',
    'gameover.summary':     'Mọi linh hồn trong thế giới này đã ra đi. Xã hội bạn xây dựng đã sụp đổ sau {d} ngày và {y} năm.',
    'gameover.stats_pop':   'Dân số đỉnh điểm: {n}',
    'gameover.stats_day':   'Tồn tại: {d} ngày, Năm {y}',
    'gameover.btn_restart': 'Bắt đầu xã hội mới',

    // Zone labels
    'zone.north_farm':        'Cánh đồng phía Bắc',
    'zone.south_farm':        'Cánh đồng phía Nam',
    'zone.workshop_district': 'Khu xưởng',
    'zone.market_square':     'Chợ trung tâm',
    'zone.scholar_quarter':   'Khu học giả',
    'zone.residential_east':  'Khu dân cư phía Đông',
    'zone.residential_west':  'Khu dân cư phía Tây',
    'zone.guard_post':        'Đồn canh',
    'zone.plaza':             'Quảng trường',

    // Institution names
    'inst.government': 'Hội đồng lãnh đạo',
    'inst.market':     'Hội Thương Nhân',
    'inst.opposition': 'Phe đối lập',
    'inst.community':  'Cộng đồng',
    'inst.guard':      'Lực lượng bảo vệ',

    // Role occupations (expanded for social model variety)
    'occ.farmer':    ['Nông dân trồng lúa', 'Người trồng rau', 'Người nuôi gia súc', 'Người làm vườn', 'Ngư dân', 'Người trồng cây ăn quả',
                      'Người chăn cừu', 'Thợ xay lúa', 'Người nuôi ong', 'Thầy thuốc thảo mộc', 'Người trồng nho', 'Người chăn trâu'],
    'occ.craftsman': ['Thợ rèn', 'Thợ mộc', 'Thợ dệt', 'Thợ gốm', 'Thợ xây', 'Thợ may', 'Thợ thuộc da', 'Thợ kim hoàn', 'Kỹ sư', 'Thợ cơ khí',
                      'Thợ thổi thủy tinh', 'Thợ đóng thùng', 'Thợ làm bánh xe', 'Thợ nhuộm', 'Thợ đóng sách', 'Thợ đá', 'Thợ làm ngói'],
    'occ.merchant':  ['Thương nhân', 'Chủ quán trọ', 'Người đổi tiền', 'Lái buôn', 'Chủ ngân hàng', 'Môi giới', 'Chủ tiệm',
                      'Người bán đấu giá', 'Người bán sỉ', 'Trưởng đoàn thương', 'Dược sĩ', 'Người cho vay'],
    'occ.scholar':   ['Giáo viên', 'Thầy thuốc', 'Học giả', 'Triết gia', 'Thư ký', 'Nhà khoa học', 'Luật sư', 'Lưu trữ viên', 'Thần học gia', 'Lập trình viên',
                      'Người vẽ bản đồ', 'Nhà thiên văn học', 'Nhà sử học', 'Thẩm phán', 'Thủ thư', 'Trắc đạc viên'],
    'occ.guard':     ['Lính canh', 'Dân quân', 'Tuần tra', 'Chỉ huy đội', 'Cảnh sát trưởng', 'Binh sĩ', 'Quản ngục',
                      'Lính tuần đinh', 'Lính canh đêm', 'Lính canh bến cảng', 'Lính giữ cổng', 'Cảnh sát'],
    'occ.leader':    ['Thành viên hội đồng', 'Trưởng khu', 'Trưởng lão', 'Quan chức', 'Thị trưởng', 'Ủy viên', 'Bí thư đảng',
                      'Quan tòa địa phương', 'Thị nghị viên', 'Đại biểu dân', 'Quản lý', 'Tri huyện'],
    'occ.child':     ['Trẻ em'],

    // ── Biến thể nghề nghiệp theo chế độ ─────────────────────────────────────
    // Phong kiến
    'occ.farmer.feudal':    ['Nông nô', 'Tá điền', 'Dân cày thuê', 'Địa dịch nông', 'Người khai khẩn', 'Nông phu buộc'],
    'occ.craftsman.feudal': ['Thợ phường hội', 'Thợ học nghề', 'Thợ thủ công phường', 'Thợ rèn làng', 'Thợ đóng xe', 'Thợ làm ngói'],
    'occ.merchant.feudal':  ['Lái buôn rong', 'Người bán chợ phiên', 'Thương nhân vải', 'Con buôn gia vị', 'Thợ nến'],
    'occ.scholar.feudal':   ['Tu sĩ', 'Thầy tu', 'Thư lại', 'Nhà sư', 'Cố đạo', 'Cha xứ', 'Giáo sĩ'],
    'occ.guard.feudal':     ['Kỵ sĩ', 'Lính thương', 'Xạ thủ nỏ', 'Lính kích', 'Thị vệ', 'Giám thị', 'Cận vệ'],
    'occ.leader.feudal':    ['Lãnh chúa', 'Nam tước', 'Chư hầu', 'Tổng quản lâu đài', 'Thái ấp chủ', 'Tầng lớp quý tộc'],
    // Thần quyền
    'occ.farmer.theocracy':    ['Nông dân đền thờ', 'Lao công giáo xứ', 'Người nộp thuế thập phân', 'Tu công', 'Người làm vườn thánh'],
    'occ.craftsman.theocracy': ['Thợ thủ công đền thờ', 'Thợ xây thánh đường', 'Thợ làm biểu tượng', 'Thợ đúc chuông', 'Thợ làm nến'],
    'occ.merchant.theocracy':  ['Người thu dâng lễ', 'Thương nhân đền', 'Người quản lý chợ', 'Phó tế thương mại', 'Đại lý thuế thập phân'],
    'occ.scholar.theocracy':   ['Tăng lữ', 'Phó tế', 'Nhà sư', 'Thần học gia', 'Người thẩm tra dị giáo', 'Học viên', 'Giám mục', 'Giáo sĩ'],
    'occ.guard.theocracy':     ['Lính canh đền', 'Chiến binh thánh', 'Cận vệ tòa án', 'Kỵ sĩ dòng tu', 'Chiến binh thập tự'],
    'occ.leader.theocracy':    ['Thượng tế', 'Tổng giám mục', 'Giám mục trưởng', 'Giáo trưởng', 'Đại thẩm tra viên', 'Tiên tri'],
    // Chuyên gia trị
    'occ.farmer.technocracy':    ['Kỹ thuật viên nông nghiệp', 'Người trồng thủy canh', 'Nông dân chính xác', 'Kỹ sư sinh học'],
    'occ.craftsman.technocracy': ['Kỹ sư', 'Kỹ thuật viên', 'Lập trình viên', 'Kỹ sư robot', 'Kỹ sư hệ thống', 'Chuyên gia DevOps'],
    'occ.merchant.technocracy':  ['Doanh nhân', 'Nhà đầu tư mạo hiểm', 'Môi giới công nghệ', 'Quản lý nền tảng', 'Nhà sáng lập startup'],
    'occ.scholar.technocracy':   ['Nhà khoa học dữ liệu', 'Nhà nghiên cứu AI', 'Chuyên viên phân tích', 'Nhà khoa học chính sách', 'Kỹ sư nghiên cứu'],
    'occ.guard.technocracy':     ['Chuyên viên an ninh', 'Người điều khiển drone', 'Lính gác mạng', 'Giám sát hệ thống', 'Kỹ thuật viên tuần tra'],
    'occ.leader.technocracy':    ['Giám đốc', 'Trưởng ban phân tích', 'Chủ tịch ủy ban', 'Kiến trúc sư chính sách', 'Trưởng thuật toán'],
    // Quân phiệt
    'occ.farmer.warlord':    ['Nông dân bị bắt lính', 'Người nộp cống', 'Người tìm lương thực', 'Lao công trại lính', 'Nông nô dã chiến'],
    'occ.craftsman.warlord': ['Thợ rèn vũ khí', 'Thợ giáp sắt', 'Kỹ sư công thành', 'Thợ xây công sự', 'Thợ đạn dược'],
    'occ.merchant.warlord':  ['Lái chiến lợi phẩm', 'Kẻ trục lợi chiến tranh', 'Đại lý tiếp tế', 'Quản lý kho hậu cần', 'Buôn chợ đen'],
    'occ.scholar.warlord':   ['Chiến lược gia', 'Sĩ quan tình báo', 'Tuyên truyền viên', 'Y tá dã chiến', 'Phóng viên chiến tranh'],
    'occ.guard.warlord':     ['Lính chiến', 'Chiến binh', 'Dân quân', 'Tân binh', 'Lính cưỡng chế', 'Lính đột kích', 'Người thi hành lệnh'],
    'occ.leader.warlord':    ['Quân phiệt', 'Tướng lĩnh', 'Chỉ huy', 'Thủ lĩnh chiến', 'Đại tá', 'Nguyên soái', 'Thủ lĩnh bộ lạc'],
    // Tập thể (công xã / xã hội chủ nghĩa / marxist)
    'occ.farmer.collective':    ['Công nhân tập thể', 'Thành viên lữ đoàn', 'Nông dân nhà nước', 'Nông dân công xã', 'Đồng chí đồng ruộng'],
    'occ.craftsman.collective': ['Công nhân nhà máy', 'Thợ thủ công nhà nước', 'Thợ lữ đoàn', 'Thợ công đoàn', 'Đồng chí sản xuất'],
    'occ.merchant.collective':  ['Cán bộ phân phối', 'Điều phối viên cung ứng', 'Đại lý trao đổi', 'Quản lý phân khẩu', 'Công nhân thu mua'],
    'occ.scholar.collective':   ['Giáo viên nhân dân', 'Nhà khoa học nhà nước', 'Công tác viên văn hóa', 'Giáo dục viên đảng', 'Cán bộ tuyên giáo'],
    'occ.guard.collective':     ['Dân quân nhân dân', 'Lính bảo vệ nhà nước', 'An ninh đảng', 'Vệ binh cách mạng', 'Trật tự viên'],
    'occ.leader.collective':    ['Chính ủy', 'Bí thư đảng', 'Chủ tịch ủy ban', 'Giám đốc tập thể', 'Cán bộ', 'Ủy viên bộ chính trị'],
    // Tư bản
    'occ.farmer.capitalist':    ['Nông dân hợp đồng', 'Công nhân nông nghiệp', 'Chuyên gia cây trồng', 'Người vận hành trang trại'],
    'occ.craftsman.capitalist': ['Kỹ thuật viên nhà máy', 'Công nhân công nghiệp', 'Chuyên gia sản xuất', 'Nhà thầu', 'Công nhân dây chuyền'],
    'occ.merchant.capitalist':  ['Doanh nhân', 'Nhà đầu tư', 'Giám đốc điều hành', 'Chủ doanh nghiệp', 'Nhà phát triển', 'Nhà tư bản mạo hiểm'],
    'occ.scholar.capitalist':   ['Tư vấn viên', 'Chuyên viên phân tích', 'Luật sư tư vấn', 'Cố vấn tài chính', 'Nhà nghiên cứu thị trường'],
    'occ.guard.capitalist':     ['Bảo vệ tư nhân', 'Lính gác công ty', 'Nhà thầu bảo mật', 'Tuần tra viên', 'Bảo vệ sự kiện'],
    'occ.leader.capitalist':    ['Giám đốc', 'Thành viên hội đồng quản trị', 'Chủ tịch công ty', 'Quản lý thành phố', 'Giám đốc điều hành'],

    // Preset descriptions
    'preset.nordic_desc': 'Dân chủ xã hội Bắc Âu — bình đẳng cao, nhà nước mạnh, tin tưởng cao.',
    'preset.cap_desc':    'Tư bản tự do — thị trường tự quyết, bất bình đẳng cao, nhà nước tối thiểu.',
    'preset.soc_desc':    'XHCN tập trung — nhà nước kiểm soát toàn bộ, bình đẳng cao nhưng tự do thấp.',
    'preset.feudal_desc':      'Vương quốc phong kiến — bất bình đẳng cực đoan, tầng lớp quý tộc cầm quyền, nông dân gần như không có quyền lợi gì.',
    'preset.theocracy_desc':   'Nhà nước thần quyền — giáo lý chiếm lĩnh tất cả, gắn kết cao, học giả dẫn đầu, phản đối bị đàn áp.',
    'preset.technocracy_desc': 'Chuyên gia trị — được dẫn dắt bởi chuyên gia và dữ liệu, tài nguyên dồi dào, ưu tiên đổi mới.',
    'preset.warlord_desc':     'Nhà nước quân phiệt — quyền lực phân mảnh, quân sự hóa, tài nguyên khan hiếm, niềm tin rất thấp.',
    'preset.commune_desc':     'Công xã không tưởng — bình đẳng toàn diện, không thị trường, tự quản triệt để, gắn kết cộng đồng rất mạnh.',
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
    'const.hint_gini':      'Bất bình đẳng tài sản lúc lập quốc (0 = bình đẳng, 1 = cực đoan)',
    'const.hint_market':    'Tự điều tiết của thị trường so với kế hoạch hóa nhà nước',
    'const.hint_state':     'Tầm ảnh hưởng chính trị và quân sự của chính phủ',
    'const.hint_safety':    'Mức độ phúc lợi xã hội và trợ cấp công cộng',
    'const.hint_rights':    'Sàn quyền cá nhân được nhà nước bảo vệ',
    'const.hint_trust':     'Niềm tin xã hội ban đầu vào các thể chế',
    'const.hint_cohesion':  'Mức độ gắn kết trong mạng lưới cộng đồng',
    'const.hint_scarcity':  'Áp lực tài nguyên thiên nhiên (cao = sống còn khó hơn)',
    'const.hint_values':    'Ưu tiên đạo đức khi lập quốc',

    // Settings panel
    'settings.title':                    '⚙ Cài đặt',
    'settings.tab_ai':                   '🤖 AI-Driven',  // English term used as-is in Vietnamese tech context
    'settings.elections.label':          '🗳 Bầu cử nhân vật',
    'settings.elections.desc':           'NPCs bầu lãnh đạo thực sự. Worldview của người thắng ảnh hưởng chính sách.',
    'settings.election_cycle.label':     'Chu kỳ bầu cử (ngày)',
    'settings.gov_ai.label':             '🏛 AI Chính sách',
    'settings.gov_ai.desc':              'LLM tạo 2 lựa chọn chính sách mỗi 15 ngày. Tắt → dùng template cố định.',
    'settings.npc_thoughts.label':       '💭 Suy nghĩ NPC',
    'settings.npc_thoughts.desc':        'LLM tạo suy nghĩ hàng ngày khi click NPC. Tắt → dùng template.',
    'settings.press_ai.label':           '📰 Báo chí AI',
    'settings.press_ai.desc':            'AI tạo tiêu đề báo mỗi 5 ngày. Tắt → không có tin tức AI.',
    'settings.consequence.label':        '🔮 Dự đoán hậu quả',
    'settings.consequence.desc':         'AI dự đoán tác động lan truyền sau sự kiện. Tắt → không có dự đoán.',
    'settings.regime_locked':            'Khóa bởi chế độ',
    'settings.enabled':                  'Bật',
    'settings.disabled':                 'Tắt',

    // Election feed messages
    'election.new_leader':   '🗳 Bầu cử: {name} ({occ}) thắng với {pct}% phiếu, thay thế {prev}.',
    'election.first_leader': '🗳 Bầu cử: {name} ({occ}) được bầu với {pct}% phiếu.',
  },
} as const

export type Lang = keyof typeof translations

/**
 * Locales exposed in the UI. To add a language:
 * 1. Add `code: { ...keys }` to `translations` above (copy `en` as template).
 * 2. Append `{ code, nativeName }` here (`nativeName` = endonym, e.g. Deutsch, 日本語).
 */
export const LANGUAGE_CATALOG: ReadonlyArray<{ code: Lang; nativeName: string }> = [
  { code: 'en', nativeName: 'English' },
  { code: 'vi', nativeName: 'Tiếng Việt' },
]

const LANG_STORAGE_KEY = 'society_sim_lang'

const _validLangs = new Set<string>(LANGUAGE_CATALOG.map(e => e.code))

export function isSupportedLang(code: string): code is Lang {
  return _validLangs.has(code)
}

export function getStoredLangPreference(): Lang {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY)
    if (raw && isSupportedLang(raw)) return raw
  } catch {
    /* private mode etc. */
  }
  return 'en'
}

/** Fill `<select id="lang-select">` options from the catalog (native names). */
export function populateLanguageSelect(select: HTMLSelectElement): void {
  select.innerHTML = ''
  for (const { code, nativeName } of LANGUAGE_CATALOG) {
    const opt = document.createElement('option')
    opt.value = code
    opt.textContent = nativeName
    select.appendChild(opt)
  }
}

// ── State ──────────────────────────────────────────────────────────────────

let currentLang: Lang = 'en'

export function setLang(lang: Lang): void {
  currentLang = lang
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
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

/**
 * Get a regime-flavoured occupation string.
 * Tries 'occ.{role}.{variant}' first; falls back to 'occ.{role}'.
 */
export function tOccVariant(role: string, variant: string): string {
  if (variant && variant !== 'default') {
    const variantList = t(`occ.${role}.${variant}`)
    if (Array.isArray(variantList))
      return variantList[Math.floor(Math.random() * variantList.length)]
  }
  return tOcc(`occ.${role}`)
}
