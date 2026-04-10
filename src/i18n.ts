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

    // Panels dropdown
    'panels.toggle':       'Panels ▾',
    'panels.population':   '👥 Population',
    'panels.rumors':       '🗣 Rumors',
    'panels.economics':    '💰 Economics',
    'panels.network':      '🕸 Network',
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
      'Social order and the regime\'s ability to hold together. When this drops, crises cascade: NPCs flee, guards defect, institutions collapse.',
    'topbar.tip_stability_factors':
      'Raised by: high government trust, low stress, adequate food|Lowered by: political unrest, fleeing citizens, food scarcity',
    'topbar.tip_food':
      'How many days of food the population has in reserve (relative to total needs). When food runs out, NPCs starve, stress spikes, and uprisings become likely.',
    'topbar.tip_food_factors':
      'Raised by: more farmers, high productivity, favorable season|Lowered by: population growth, drought, war, poor harvest',
    'topbar.tip_resources':
      'Remaining stock of natural resources that fuel crafting and construction. Once depleted, productivity collapses and recovery is slow.',
    'topbar.tip_resources_factors':
      'Raised by: natural regeneration (slow)|Lowered by: craftsmen and farmers extracting resources each tick',
    'topbar.tip_energy':
      'The society\'s effective productive output — how much real work is getting done. Boosted by literacy and hurt by hunger or mass unrest.',
    'topbar.tip_energy_factors':
      'Raised by: active workforce, high literacy, good food supply|Lowered by: unrest (organizing/fleeing NPCs), hunger, exhaustion',
    'topbar.tip_trust':
      'Average NPC trust in government intentions and competence. Low trust fuels protests, defection, and regime instability.',
    'topbar.tip_trust_factors':
      'Raised by: fulfilled policies, stable governance, justice|Lowered by: broken promises, repression, inequality, crises',
    'topbar.tip_gini':
      'Wealth inequality (0 = perfectly equal, 1 = one person owns everything). High inequality breeds resentment, class conflict, and revolution.',
    'topbar.tip_gini_factors':
      'Lowered by: welfare policies, safety net, equal wages|Raised by: free market accumulation, tax evasion, feudal tribute',
    'topbar.tip_level_healthy': '✓ Healthy',
    'topbar.tip_level_warning': '⚠ Warning',
    'topbar.tip_level_danger':  '▲ Danger',
    'topbar.tip_level_critical': '✕ Critical',

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
    'sp.current_activity': 'Current activity',
    'sp.actions':          'Actions',
    'sp.action_start_chat':'💬 Start Chat',
    'sp.action_edit_stats':'✏️ Edit Stats',
    'sp.edit.title':       'Edit Stats · {name}',
    'sp.chat.panel_title': 'Chat · {name}',
    'sp.chat.title':       '💬 Talk to {name}',
    'sp.chat.empty':       'No conversation yet.',
    'sp.chat.ai_toggle':   'Toggle AI responses',
    'sp.chat.input_ph':    'Say something...',
    'sp.chat.ai_on_title': 'AI responses ON — click to use scripted replies',
    'sp.chat.ai_off_title':'AI responses OFF — click to use AI',
    'sp.chat.sleeping_1':  '*mumbles sleepily* ...{name} is fast asleep.',
    'sp.chat.sleeping_2':  '*no response* — {name} is sleeping.',
    'sp.chat.sleeping_3':  '*groans* ...let me sleep...',
    'sp.chat.sleeping_4':  '*turns over* Zzz...',
    'sp.chat.fallback.fear':      "I... I don't want any trouble. Please leave me alone.",
    'sp.chat.fallback.grievance': "What do you want? We're barely surviving as it is.",
    'sp.chat.fallback.stress':    "I'm too exhausted to talk right now.",
    'sp.chat.fallback.happy':     "Good day! Things are going well enough, can't complain.",
    'sp.chat.fallback.neutral':   "Hmm. I'm not sure what to say to you.",

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
    'app.short': 'Short', 'app.average': 'Medium height', 'app.tall': 'Tall',
    'app.slim':  'Slim build', 'app.sturdy': 'Sturdy build', 'app.average_build': 'Medium build',
    'app.hair':  'Hair',
    'hair.black': 'Black hair', 'hair.brown': 'Brown hair', 'hair.gray': 'Grey hair', 'hair.white': 'White hair',
    'skin.light': 'Fair skin', 'skin.medium': 'Olive skin', 'skin.dark': 'Dark skin',

    // Personality trait tags (derived from worldview)
    'trait.collectivist':   'Collectivist',
    'trait.individualist':  'Individualist',
    'trait.authoritarian':  'Rule-follower',
    'trait.rebel':          'Rebellious',
    'trait.risk_taker':     'Risk-taker',
    'trait.cautious':       'Cautious',
    'trait.hardworking':    'Hardworking',
    'trait.lethargic':      'Low motivation',
    'trait.wealthy':        'Wealthy',
    'trait.struggling':     'Struggling',
    'trait.middle_class':   'Middle class',
    'trait.well_connected': 'Well connected',
    'trait.isolated_npc':   'Socially isolated',
    'trait.senior':         'Senior',
    'trait.elder':          'Elder',

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
    'engine.opinion_anti_feed': 'Influential voices are turning against the regime and amplifying dissent across districts.',
    'engine.opinion_anti_chronicle': 'Opinion leaders coordinated anti-government narratives through information networks.',
    'engine.opinion_pro_feed': 'High-profile voices are defending the regime and calming public anger.',
    'engine.opinion_pro_chronicle': 'Opinion leaders rallied support for institutional stability.',
    'engine.schism_chronicle': 'Ideological schism: information bridges collapsed as society split into rival camps.',
    'engine.schism_feed': 'Society fractures into opposing camps as polarization crosses a critical threshold.',
    'engine.season.spring': '{season} — farmers return to the fields. Food stores running low.',
    'engine.season.summer': '{season} — crops are growing. The society settles into its rhythm.',
    'engine.season.autumn': '{season} — harvest season. Food production at its peak.',
    'engine.season.winter': '{season} — cold sets in. Food production drops sharply; hunger rises.',
    'engine.community_mobilized': 'A community group in {zone} has mobilized — {n} members marching together.',
    'engine.unrest.suppression_blocked': 'Suppression attempted but legal protections hold — government forced to negotiate (rights floor: {rights}%).',
    'engine.unrest.suppressed': 'Authorities suppress unrest — {pct}% mobilizing. Rights floor: {rights}%.',
    'engine.unrest.dialogue': 'Government opens dialogue — {pct}% of population organizing.',
    'engine.unrest.standoff': 'Standoff: {pct}% of citizens in open dissent — government cannot suppress or negotiate.',
    'engine.tax_spend.infrastructure': 'Government invests {amount} coins in infrastructure — worker productivity rises.',
    'engine.tax_spend.research': 'Research investment of {amount} coins: scholars receive funding, literacy improves.',
    'engine.tax_spend.military': '{amount} coins allocated to military and enforcement — security forces are bolstered.',
    'engine.tax_spend.welfare': '{amount} coins distributed as welfare — the poorest 50% receive direct aid.',
    'engine.tax_spend.temples': '{amount} coins invested in civic and religious projects — community cohesion strengthens.',
    'engine.tax_spend.balanced': '{amount} coins in balanced public spending — modest gains for all citizens.',
    'engine.market_crash': 'Market crash — the speculative bubble has burst. Merchants and investors lose fortunes overnight.',
    'engine.peasant_revolt': 'Peasant levy revolt — {pct}% of farmers refuse tribute and take to the streets.',
    'engine.heresy_outbreak': 'Heresy purge — {n} dissenters exposed and hunted by the religious authorities. Fear grips the faithful; doubters go silent or flee.',
    'engine.rationing_emergency': 'Emergency rationing declared — the state draws on strategic reserves to feed {n} hungry citizens.',
    'engine.rationing_crisis': 'Rationing crisis — state reserves exhausted. Citizens receive nothing; government legitimacy collapses.',
    'engine.shadow_raid': 'Guard raids the underground market — {n} shadow traders apprehended, assets seized.',
    'engine.shadow_thrives': 'Shadow market thrives in the dark — {pct}% of citizens trade outside state oversight.',
    'engine.referendum.proposal.food_relief': 'Emergency food relief act — raise safety net from {from}% to {to}%',
    'engine.referendum.proposal.redistribution': 'Wealth redistribution reform — safety net from {from}% → {to}%',
    'engine.referendum.proposal.rights': 'Democratic rights reform — raise individual rights floor from {from}% to {to}%',
    'engine.referendum.proposal.market': 'Economic liberalization — market freedom from {from}% → {to}%',
    'engine.referendum.proposed': '🗳️ Referendum proposed: "{proposal}". Citizens will vote over the next 7 days.',
    'engine.referendum.passed': '✅ Referendum passed ({pct}% support): "{proposal}" — constitution amended.',
    'engine.referendum.rejected': '❌ Referendum rejected ({pct}% support): "{proposal}" — no change.',
    'referendum.support': 'Support',
    'referendum.expires_in': 'Expires in',
    'referendum.days': '{n}d',
    'referendum.details_btn': 'View Details',
    'referendum.modal_title': '🗳️ Active Referendum',
    'referendum.modal_proposal': 'Proposal',
    'referendum.modal_field': 'Constitutional field',
    'referendum.modal_current': 'Current value',
    'referendum.modal_proposed': 'Proposed value',
    'referendum.modal_support': 'Live support',
    'referendum.modal_expires': 'Voting closes in',
    'referendum.modal_days_remaining': '{n} day(s)',
    'referendum.modal_field_safety_net': 'Safety Net',
    'referendum.modal_field_individual_rights_floor': 'Individual Rights Floor',
    'referendum.modal_field_market_freedom': 'Market Freedom',
    'referendum.modal_field_state_power': 'State Power',
    'referendum.modal_status_passing': '✅ passing',
    'referendum.modal_status_failing': '❌ failing',
    'referendum.triggered': '🗳️ Referendum triggered by the Architect: "{proposal}".',
    'engine.epidemic_quarantine': '🔒 Guard quarantines {zones} — movement restricted to contain the epidemic.',
    'engine.scholars_collective': 'the scholars',
    'engine.cure_breakthrough': '💊 Cure breakthrough! {name} has developed a treatment — epidemic intensity halved.',
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
    'engine.societal_collapse':  '💀 The population has fallen below the minimum viable threshold. Society cannot sustain itself.',
    'engine.collapse_warning':   '⚠ Population has dropped to a dangerous level — society can no longer sustain itself without intervention.',
    'engine.collapse_roleshift': '🌾 {count} people abandoned their former roles to focus on basic survival.',
    'engine.collapse_govfail':   '🏛 The government has dissolved — too few people remain to maintain any form of organized rule.',
    'engine.emergency_farming':        '🌾 Food crisis — {n} {mode, select, mandatory {workers ordered} other {workers volunteer}} to farm. Fields expand; markets and schools fall quiet.',
    'engine.emergency_conscription':   '⚔ Security crisis — {n} {mode, select, mandatory {civilians conscripted} other {civilians volunteer}} as emergency guards. Streets are tense.',
    'engine.emergency_role_revert':    '🔄 Crisis over — {n} citizens return to their former occupations as conditions stabilise.',
    'engine.emergency_role_permanent': '📌 {n} citizens who switched roles during the crisis have settled into their new lives and will not return to their old work.',
    'engine.legendary_death': '⭐ {name} ({occupation}, age {age}) — a legendary figure — has died of {cause}. Their legacy endures.',
    'engine.legendary_recognized': '⭐ {name} ({occupation}) is now recognized as a legendary figure — {reason}.',
    'engine.legendary_reason.influential': 'a figure of great social influence',
    'engine.legendary_reason.wealthy': 'one of the wealthiest citizens',
    'engine.legendary_reason.reformed': 'a reformed criminal turned pillar of the community',
    'engine.legendary_reason.faction_elder': 'a veteran faction leader',
    'engine.legendary_reason.elder': 'a venerable elder',
    'engine.immigration_wave': '🚶‍♂️ {n} immigrants arrived and settled in the city.',
    'engine.emigration_wave': '🏃 {n} residents fled the city permanently due to the crisis.',
    'gov.feed_title': '🏛 [Government Policy] {policy}',
    'gov.feed_public_statement': '📢 "{statement}"',
    'gov.feed_alerts': '📊 Alerts: {alerts}',
    'gov.chronicle_enacted': '🏛 Government enacted: {policy}',
    'gov.policy_delayed': '🏛 Government policy delayed — RPM budget exhausted. Resuming in ~{seconds}s.',

    // Game over screen
    'gameover.title':          'Extinction',
    'gameover.title_collapse': 'Societal Collapse',
    'gameover.summary':        'Every soul in this world is gone. The society you built has perished on Year {y}, Day {wd} — {d} days in total.',
    'gameover.summary_collapse': 'The population fell below the minimum threshold for a viable society. Too few survived to sustain the community — Year {y}, Day {wd} ({d} total days).',
    'gameover.stats_pop':      'Peak population: {n}',
    'gameover.stats_day':      'Survived: {d} day{ds}, Year {y}',
    'gameover.btn_restart':    'Start New Society',
    'gameover.btn_download':   '⬇️ Download Badge',
    'gameover.medals_title':   'Achievements',
    'gameover.report_title':   'World Report',

    // End game (voluntary apocalypse)
    'endgame.btn':             '☄️ End Game',
    'endgame.confirm_title':   '☄️ Summon the Apocalypse',
    'endgame.confirm_body':    'A meteor the size of a small moon is hurtling toward your civilization. <b>Every soul will perish.</b> Are you sure you want to end this world?',
    'endgame.feed':            '☄️ A massive meteor tears through the atmosphere — civilization ends in fire and silence.',
    'gameover.report_regime':         'Society model',
    'gameover.report_pop_growth':     'Population growth',
    'gameover.report_min_pop':        'Lowest population',
    'gameover.report_god_calls':      'God Agent consulted',
    'gameover.report_policies':       'Policies enacted',
    'gameover.report_interventions':  'Interventions',
    'gameover.report_deaths_natural': 'Natural / disease deaths',
    'gameover.report_deaths_violent': 'Violent deaths',
    'gameover.report_emigrations':    'Emigrations',
    'gameover.report_elections':      'Elections held',
    'gameover.report_npc_chats':      'Conversations with NPCs',
    'gameover.report_npc_edits':      'Manual NPC edits',

    // Achievement medals
    'achievement.day100.title':   '🏅 First Century',
    'achievement.day100.desc':    'Society survived 100 days.',
    'achievement.year1.title':    '🥈 One Year Strong',
    'achievement.year1.desc':     'The community endured a full year.',
    'achievement.year3.title':    '🥇 Three Years of Civilization',
    'achievement.year3.desc':     'Three years — a true civilization takes root.',
    'achievement.year5.title':    '🏆 Five-Year Legacy',
    'achievement.year5.desc':     'Five years: your society has left a mark on history.',
    'achievement.year10.title':   '👑 Decade of Dominion',
    'achievement.year10.desc':    'Ten years of unbroken society. A legendary achievement.',
    'achievement.toast_new':      'Achievement Unlocked',

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
    'preset.nordic_desc':      'Nordic Democracy',
    'preset.cap_desc':         'Free-Market Capitalism',
    'preset.soc_desc':         'Planned Economy',
    'preset.feudal_desc':      'Feudal Kingdom',
    'preset.theocracy_desc':   'Theocratic State',
    'preset.technocracy_desc': 'Technocracy',
    'preset.warlord_desc':     'Warlord State',
    'preset.commune_desc':     'Utopian Commune',
    'preset.marxist_desc':     'Marxist State',
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
    'settings.title':                    '🛠 Settings',
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

    // Panels dropdown
    'panels.toggle':       'Bảng điều khiển ▾',
    'panels.population':   '👥 Dân số',
    'panels.rumors':       '🗣 Tin đồn',
    'panels.economics':    '💰 Kinh tế',
    'panels.network':      '🕸 Mạng lưới',
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
      'Trật tự xã hội và khả năng chống chịu của chính quyền. Khi xuống thấp, khủng hoảng dây chuyền: dân chúng bỏ trốn, lính canh phản bội, thể chế sụp đổ.',
    'topbar.tip_stability_factors':
      'Tăng khi: dân tin chính phủ, ít căng thẳng, đủ lương thực|Giảm khi: bất ổn chính trị, dân bỏ trốn, thiếu đói',
    'topbar.tip_food':
      'Số ngày lương thực dự trữ so với nhu cầu toàn dân. Khi cạn kiệt, dân đói, căng thẳng bùng phát và nổi loạn rất dễ xảy ra.',
    'topbar.tip_food_factors':
      'Tăng khi: nhiều nông dân, năng suất cao, mùa thuận lợi|Giảm khi: dân số tăng, hạn hán, chiến tranh, mất mùa',
    'topbar.tip_resources':
      'Lượng tài nguyên thiên nhiên còn lại để dùng cho sản xuất và xây dựng. Khi cạn, năng suất sụp đổ và phục hồi rất chậm.',
    'topbar.tip_resources_factors':
      'Tăng khi: tái sinh tự nhiên (chậm)|Giảm khi: thợ thủ công và nông dân khai thác mỗi chu kỳ',
    'topbar.tip_energy':
      'Sản lượng lao động thực tế của toàn xã hội — bao nhiêu công việc đang được thực sự thực hiện. Tăng nhờ học vấn, giảm khi đói hoặc bạo loạn.',
    'topbar.tip_energy_factors':
      'Tăng khi: lực lượng lao động đông, học vấn cao, đủ ăn|Giảm khi: bất ổn (biểu tình/bỏ trốn), đói kém, kiệt sức',
    'topbar.tip_trust':
      'Mức độ tin tưởng trung bình của dân vào ý định và năng lực của chính phủ. Tin tưởng thấp dẫn đến biểu tình, ly khai và bất ổn chính quyền.',
    'topbar.tip_trust_factors':
      'Tăng khi: chính sách hiệu quả, quản trị ổn định, công bằng|Giảm khi: hứa hẹn thất bại, đàn áp, bất bình đẳng, khủng hoảng',
    'topbar.tip_gini':
      'Chỉ số bất bình đẳng tài sản (0 = hoàn toàn bình đẳng, 1 = một người nắm hết). Cao → hận thù giai cấp, xung đột và nguy cơ cách mạng.',
    'topbar.tip_gini_factors':
      'Giảm khi: phúc lợi xã hội, lưới an toàn, lương đồng đều|Tăng khi: tích lũy thị trường tự do, trốn thuế, địa tô phong kiến',
    'topbar.tip_level_healthy': '✓ Ổn định',
    'topbar.tip_level_warning': '⚠ Cảnh báo',
    'topbar.tip_level_danger':  '▲ Nguy hiểm',
    'topbar.tip_level_critical': '✕ Nghiêm trọng',

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
    'sp.current_activity': 'Hoạt động hiện tại',
    'sp.actions':          'Hành động',
    'sp.action_start_chat':'💬 Trò chuyện',
    'sp.action_edit_stats':'✏️ Chỉnh chỉ số',
    'sp.edit.title':       'Chỉnh chỉ số · {name}',
    'sp.chat.panel_title': 'Trò chuyện · {name}',
    'sp.chat.title':       '💬 Nói chuyện với {name}',
    'sp.chat.empty':       'Chưa có cuộc trò chuyện nào.',
    'sp.chat.ai_toggle':   'Bật/tắt phản hồi AI',
    'sp.chat.input_ph':    'Nhập điều bạn muốn nói...',
    'sp.chat.ai_on_title': 'Đang dùng phản hồi AI — bấm để dùng phản hồi mẫu',
    'sp.chat.ai_off_title':'Đang dùng phản hồi mẫu — bấm để dùng AI',
    'sp.chat.sleeping_1':  '*lẩm bẩm khi ngủ* ...{name} đang ngủ rất say.',
    'sp.chat.sleeping_2':  '*không phản hồi* — {name} đang ngủ.',
    'sp.chat.sleeping_3':  '*rên nhẹ* ...để tôi ngủ...',
    'sp.chat.sleeping_4':  '*trở mình* Zzz...',
    'sp.chat.fallback.fear':      'Tôi... tôi không muốn rắc rối. Xin hãy để tôi yên.',
    'sp.chat.fallback.grievance': 'Anh muốn gì nữa? Bọn tôi đang sống lay lắt rồi.',
    'sp.chat.fallback.stress':    'Tôi quá kiệt sức để nói chuyện lúc này.',
    'sp.chat.fallback.happy':     'Chào anh! Mọi thứ cũng tạm ổn, không thể than phiền.',
    'sp.chat.fallback.neutral':   'Ừm... tôi không biết nên nói gì.',

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
    'app.short': 'Thấp', 'app.average': 'Chiều cao trung bình', 'app.tall': 'Cao',
    'app.slim':  'Vóc gầy', 'app.sturdy': 'Vạm vỡ', 'app.average_build': 'Dáng cân đối',
    'app.hair':  'Tóc',
    'hair.black': 'Tóc đen', 'hair.brown': 'Tóc nâu', 'hair.gray': 'Tóc bạc', 'hair.white': 'Tóc trắng',
    'skin.light': 'Da sáng', 'skin.medium': 'Da ngăm', 'skin.dark': 'Da tối',

    // Personality trait tags (derived from worldview)
    'trait.collectivist':   'Tập thể',
    'trait.individualist':  'Cá nhân',
    'trait.authoritarian':  'Tuân thủ luật',
    'trait.rebel':          'Nổi loạn',
    'trait.risk_taker':     'Thích phiêu lưu',
    'trait.cautious':       'Thận trọng',
    'trait.hardworking':    'Chăm chỉ',
    'trait.lethargic':      'Thiếu động lực',
    'trait.wealthy':        'Giàu có',
    'trait.struggling':     'Khó khăn',
    'trait.middle_class':   'Trung lưu',
    'trait.well_connected': 'Quan hệ rộng',
    'trait.isolated_npc':   'Cô lập xã hội',
    'trait.senior':         'Cao tuổi',
    'trait.elder':          'Lão thành',

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
    'engine.opinion_anti_feed': 'Những tiếng nói có ảnh hưởng đang quay lưng với chính quyền và khuếch đại bất mãn khắp các khu.',
    'engine.opinion_anti_chronicle': 'Các thủ lĩnh dư luận đã phối hợp lan truyền thông điệp chống chính phủ qua mạng thông tin.',
    'engine.opinion_pro_feed': 'Những tiếng nói nổi bật đang bảo vệ chính quyền và xoa dịu cơn giận của công chúng.',
    'engine.opinion_pro_chronicle': 'Các thủ lĩnh dư luận đã tập hợp sự ủng hộ cho ổn định thể chế.',
    'engine.schism_chronicle': 'Rạn nứt tư tưởng: các cầu nối thông tin sụp đổ khi xã hội tách thành những phe đối nghịch.',
    'engine.schism_feed': 'Xã hội rạn nứt thành các phe đối lập khi phân cực vượt ngưỡng nguy hiểm.',
    'engine.season.spring': '{season} — nông dân trở lại đồng ruộng. Kho lương bắt đầu xuống thấp.',
    'engine.season.summer': '{season} — mùa màng đang phát triển. Xã hội ổn định vào nhịp vận hành.',
    'engine.season.autumn': '{season} — mùa thu hoạch. Sản lượng lương thực đạt đỉnh.',
    'engine.season.winter': '{season} — giá lạnh kéo đến. Sản xuất lương thực giảm mạnh, nạn đói gia tăng.',
    'engine.community_mobilized': 'Một nhóm cộng đồng ở {zone} đã huy động — {n} thành viên cùng xuống đường.',
    'engine.unrest.suppression_blocked': 'Nỗ lực đàn áp bị chặn bởi bảo vệ pháp lý — chính quyền buộc phải đàm phán (ngưỡng quyền: {rights}%).',
    'engine.unrest.suppressed': 'Chính quyền đàn áp bất ổn — {pct}% dân số đang huy động. Ngưỡng quyền: {rights}%.',
    'engine.unrest.dialogue': 'Chính quyền mở đối thoại — {pct}% dân số đang tổ chức.',
    'engine.unrest.standoff': 'Bế tắc: {pct}% công dân đang công khai phản đối — chính quyền không thể đàn áp cũng không thể đàm phán.',
    'engine.tax_spend.infrastructure': 'Chính phủ đầu tư {amount} đồng vào hạ tầng — năng suất lao động tăng.',
    'engine.tax_spend.research': 'Đầu tư nghiên cứu {amount} đồng: học giả được cấp ngân sách, trình độ dân trí cải thiện.',
    'engine.tax_spend.military': '{amount} đồng được phân bổ cho quân sự và cưỡng chế — lực lượng an ninh được tăng cường.',
    'engine.tax_spend.welfare': '{amount} đồng được chi cho an sinh — 50% người nghèo nhất nhận hỗ trợ trực tiếp.',
    'engine.tax_spend.temples': '{amount} đồng được đầu tư cho các dự án dân sự và tôn giáo — gắn kết cộng đồng được củng cố.',
    'engine.tax_spend.balanced': '{amount} đồng được chi tiêu công cân bằng — mọi tầng lớp đều có cải thiện nhẹ.',
    'engine.market_crash': 'Khủng hoảng thị trường — bong bóng đầu cơ đã vỡ. Thương nhân và nhà đầu tư mất tài sản chỉ sau một đêm.',
    'engine.peasant_revolt': 'Nổi dậy chống sưu thuế — {pct}% nông dân từ chối cống nạp và xuống đường.',
    'engine.heresy_outbreak': 'Thanh trừng dị giáo — {n} kẻ bất đồng bị giáo quyền phát giác và săn đuổi. Nỗi sợ lan tràn trong giới tín đồ; kẻ hoài nghi im lặng hoặc bỏ trốn.',
    'engine.rationing_emergency': 'Ban bố phân phối khẩn cấp — nhà nước rút dự trữ chiến lược để cứu đói cho {n} công dân.',
    'engine.rationing_crisis': 'Khủng hoảng phân phối — dự trữ nhà nước cạn kiệt. Người dân không nhận được gì; tính chính danh của chính quyền sụp đổ.',
    'engine.shadow_raid': 'Lực lượng gác trật tự đột kích chợ ngầm — {n} đầu mối giao dịch bị bắt, tài sản bị tịch thu.',
    'engine.shadow_thrives': 'Chợ ngầm nở rộ trong bóng tối — {pct}% công dân giao dịch ngoài tầm giám sát nhà nước.',
    'engine.referendum.proposal.food_relief': 'Dự luật cứu trợ lương thực khẩn cấp — tăng an sinh từ {from}% lên {to}%',
    'engine.referendum.proposal.redistribution': 'Cải cách phân phối lại tài sản — an sinh từ {from}% → {to}%',
    'engine.referendum.proposal.rights': 'Cải cách quyền dân chủ — nâng ngưỡng quyền cá nhân từ {from}% lên {to}%',
    'engine.referendum.proposal.market': 'Tự do hóa kinh tế — tự do thị trường từ {from}% → {to}%',
    'engine.referendum.proposed': '🗳️ Trưng cầu dân ý được đề xuất: "{proposal}". Người dân sẽ bỏ phiếu trong 7 ngày tới.',
    'engine.referendum.passed': '✅ Trưng cầu được thông qua ({pct}% ủng hộ): "{proposal}" — hiến pháp đã được sửa đổi.',
    'engine.referendum.rejected': '❌ Trưng cầu bị bác bỏ ({pct}% ủng hộ): "{proposal}" — không có thay đổi.',
    'referendum.support': 'Ủng hộ',
    'referendum.expires_in': 'Hết hạn sau',
    'referendum.days': '{n} ngày',
    'referendum.details_btn': 'Xem Chi Tiết',
    'referendum.modal_title': '🗳️ Trưng Cầu Dân Ý',
    'referendum.modal_proposal': 'Đề xuất',
    'referendum.modal_field': 'Điều khoản hiến pháp',
    'referendum.modal_current': 'Giá trị hiện tại',
    'referendum.modal_proposed': 'Giá trị đề xuất',
    'referendum.modal_support': 'Tỷ lệ ủng hộ',
    'referendum.modal_expires': 'Bỏ phiếu kết thúc sau',
    'referendum.modal_days_remaining': '{n} ngày',
    'referendum.modal_field_safety_net': 'An Sinh Xã Hội',
    'referendum.modal_field_individual_rights_floor': 'Quyền Cá Nhân',
    'referendum.modal_field_market_freedom': 'Tự Do Thị Trường',
    'referendum.modal_field_state_power': 'Quyền Lực Nhà Nước',
    'referendum.modal_status_passing': '✅ đang thắng',
    'referendum.modal_status_failing': '❌ đang thua',
    'referendum.triggered': '🗳️ Trưng cầu dân ý được kích hoạt bởi Kiến Trúc Sư: "{proposal}".',
    'engine.epidemic_quarantine': '🔒 Lực lượng gác trật tự phong tỏa {zones} — di chuyển bị hạn chế để kiểm soát dịch bệnh.',
    'engine.scholars_collective': 'các học giả',
    'engine.cure_breakthrough': '💊 Đột phá chữa trị! {name} đã phát triển phương pháp điều trị — mức độ dịch bệnh giảm một nửa.',
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
    'engine.societal_collapse':  '💀 Dân số đã xuống dưới ngưỡng tối thiểu. Xã hội không thể tự duy trì.',
    'engine.collapse_warning':   '⚠ Dân số đã xuống mức nguy hiểm — xã hội không thể tự tồn tại nếu không có sự can thiệp.',
    'engine.collapse_roleshift': '🌾 {count} người đã bỏ nghề cũ để tập trung sinh tồn.',
    'engine.collapse_govfail':   '🏛 Chính phủ đã tan rã — quá ít người để duy trì bất kỳ hình thức tổ chức nào.',
    'engine.emergency_farming':        '🌾 Khủng hoảng lương thực — {n} người {mode, select, mandatory {được lệnh} other {tình nguyện}} chuyển sang làm nông. Ruộng đồng mở rộng; chợ và trường học vắng dần.',
    'engine.emergency_conscription':   '⚔ Khủng hoảng an ninh — {n} dân thường {mode, select, mandatory {bị trưng tập} other {tình nguyện}} làm lính. Đường phố căng thẳng.',
    'engine.emergency_role_revert':    '🔄 Khủng hoảng qua — {n} người trở lại nghề cũ khi tình hình ổn định.',
    'engine.emergency_role_permanent': '📌 {n} người đã quen với nghề mới trong thời khủng hoảng và không muốn quay lại nghề cũ.',
    'engine.legendary_death': '⭐ {name} ({occupation}, {age} tuổi) — một nhân vật huyền thoại — đã qua đời vì {cause}. Di sản của họ vẫn còn mãi.',
    'engine.legendary_recognized': '⭐ {name} ({occupation}) giờ được công nhận là một nhân vật huyền thoại — {reason}.',
    'engine.legendary_reason.influential': 'một nhân vật có ảnh hưởng xã hội rất lớn',
    'engine.legendary_reason.wealthy': 'một trong những công dân giàu có nhất',
    'engine.legendary_reason.reformed': 'một người từng phạm tội nhưng cải tà quy chính và trở thành trụ cột cộng đồng',
    'engine.legendary_reason.faction_elder': 'một lãnh đạo kỳ cựu của phe phái',
    'engine.legendary_reason.elder': 'một bậc trưởng lão đáng kính',
    'engine.immigration_wave': '🚶‍♂️ Có {n} người nhập cư đến và định cư trong thành phố.',
    'engine.emigration_wave': '🏃 {n} cư dân bỏ trốn khỏi thành phố vĩnh viễn do khủng hoảng.',
    'gov.feed_title': '🏛 [Chính sách Chính phủ] {policy}',
    'gov.feed_public_statement': '📢 "{statement}"',
    'gov.feed_alerts': '📊 Cảnh báo: {alerts}',
    'gov.chronicle_enacted': '🏛 Chính phủ ban hành: {policy}',
    'gov.policy_delayed': '🏛 Chính sách chính phủ bị hoãn — đã dùng hết ngân sách RPM. Tiếp tục sau khoảng ~{seconds}s.',

    // Game over screen
    'gameover.title':          'Diệt vong',
    'gameover.title_collapse': 'Sụp đổ Xã hội',
    'gameover.summary':        'Mọi linh hồn trong thế giới này đã ra đi. Xã hội bạn xây dựng đã sụp đổ vào Năm {y}, Ngày {wd} — tổng {d} ngày tồn tại.',
    'gameover.summary_collapse': 'Dân số đã xuống dưới ngưỡng tối thiểu để duy trì xã hội. Quá ít người sống sót — Năm {y}, Ngày {wd} (tổng {d} ngày).',
    'gameover.stats_pop':      'Dân số đỉnh điểm: {n}',
    'gameover.stats_day':      'Tồn tại: {d} ngày, Năm {y}',
    'gameover.btn_restart':    'Bắt đầu xã hội mới',
    'gameover.btn_download':   '⬇️ Tải badge thành tích',
    'gameover.medals_title':   'Thành tựu',
    'gameover.report_title':   'Báo cáo Thế giới',

    // End game (voluntary apocalypse)
    'endgame.btn':             '☄️ Kết thúc Game',
    'endgame.confirm_title':   '☄️ Gọi ngày tận thế',
    'endgame.confirm_body':    'Một thiên thạch khổng lồ đang lao thẳng vào nền văn minh của bạn. <b>Mọi linh hồn sẽ bị xóa sổ.</b> Bạn có chắc muốn kết thúc thế giới này không?',
    'endgame.feed':            '☄️ Một thiên thạch khổng lồ xé toạc bầu khí quyển — nền văn minh tàn lụi trong lửa và im lặng.',
    'gameover.report_regime':         'Mô hình xã hội',
    'gameover.report_pop_growth':     'Tăng trưởng dân số',
    'gameover.report_min_pop':        'Dân số thấp nhất',
    'gameover.report_god_calls':      'Hỏi God Agent',
    'gameover.report_policies':       'Chính sách thi hành',
    'gameover.report_interventions':  'Can thiệp trực tiếp',
    'gameover.report_deaths_natural': 'Chết tự nhiên / bệnh tật',
    'gameover.report_deaths_violent': 'Chết bạo lực',
    'gameover.report_emigrations':    'Di cư rời đi',
    'gameover.report_elections':      'Bầu cử',
    'gameover.report_npc_chats':      'Trò chuyện với NPC',
    'gameover.report_npc_edits':      'Chỉnh sửa NPC thủ công',

    // Achievement medals
    'achievement.day100.title':   '🏅 Thế kỷ đầu tiên',
    'achievement.day100.desc':    'Xã hội sống sót qua 100 ngày.',
    'achievement.year1.title':    '🥈 Một năm kiên cường',
    'achievement.year1.desc':     'Cộng đồng đã trụ vững qua một năm đầy sóng gió.',
    'achievement.year3.title':    '🥇 Ba năm văn minh',
    'achievement.year3.desc':     'Ba năm — một nền văn minh thực sự đang đâm rễ.',
    'achievement.year5.title':    '🏆 Di sản năm năm',
    'achievement.year5.desc':     'Năm năm: xã hội của bạn đã để lại dấu ấn trong lịch sử.',
    'achievement.year10.title':   '👑 Thập kỷ thống trị',
    'achievement.year10.desc':    'Mười năm xã hội không gián đoạn. Một kỳ tích huyền thoại.',
    'achievement.toast_new':      'Thành tựu mới',

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
    'preset.nordic_desc':      'Dân chủ Bắc Âu',
    'preset.cap_desc':         'Tư bản tự do',
    'preset.soc_desc':         'Kinh tế kế hoạch',
    'preset.feudal_desc':      'Vương quốc phong kiến',
    'preset.theocracy_desc':   'Nhà nước thần quyền',
    'preset.technocracy_desc': 'Chuyên gia trị',
    'preset.warlord_desc':     'Nhà nước quân phiệt',
    'preset.commune_desc':     'Công xã không tưởng',
    'preset.marxist_desc':     'Nhà nước Marxist',
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
    'settings.tab_ai':                   '🤖 Điều khiển bởi AI',
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
    // Handle ICU select syntax: {k, select, case1 {text1} ... other {defaultText}}
    s = s.replace(
      new RegExp(`\\{${k},\\s*select,\\s*((?:\\w+\\s*\\{[^{}]*\\}\\s*)*)\\}`, 'g'),
      (_match, cases: string) => {
        const caseMap: Record<string, string> = {}
        const caseRe = /(\w+)\s*\{([^{}]*)\}/g
        let m: RegExpExecArray | null
        while ((m = caseRe.exec(cases)) !== null) {
          caseMap[m[1]] = m[2]
        }
        return caseMap[String(v)] ?? caseMap['other'] ?? _match
      },
    )
    // Simple {k} replacement
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
