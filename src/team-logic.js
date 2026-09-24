'use strict';
/**
 * What a team has and what it is missing, the way experienced players judge one.
 *
 * The rules come from Smogon's teambuilding guides (docs/teambuilding-checklist.md)
 * and are tier-agnostic: shared weaknesses, resistances to the common attacking
 * types, one Stealth Rock, hazard control, priority and speed, pivots, recovery,
 * a status absorber, answers to setup, a stallbreaker, and a physical/special mix.
 *
 * Every function takes the dex to read from, so it counts whatever that dex
 * holds - on this server that includes our own moves and abilities: Tectonic
 * Shell sets Stealth Rock and heals, Royal Decree phazes and lays Spikes,
 * Masquerade taunts on switch-in, Keystone Legion is a wall's ability.
 *
 * Used by the RP bot's `!preset` (a team from a character's box) and by the RP
 * trainer encounters (src/encounters.js), each at its own strictness.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The attacking types a team should have an answer to (Smogon's list). */
const KEY_TYPES = ['Ground', 'Fighting', 'Dragon', 'Fairy', 'Water', 'Fire', 'Ice', 'Electric', 'Dark', 'Ghost', 'Steel'];

const ABILITY_IMMUNE = {
	levitate: 'Ground', eartheater: 'Ground', flashfire: 'Fire', wellbakedbody: 'Fire',
	waterabsorb: 'Water', stormdrain: 'Water', dryskin: 'Water', voltabsorb: 'Electric',
	lightningrod: 'Electric', motordrive: 'Electric', sapsipper: 'Grass', purifyingsalt: 'Ghost',
	liquidbody: 'Water', staticneedles: 'Electric',
};
const ABILITY_RESIST = { thickfat: ['Fire', 'Ice'], heatproof: ['Fire'], waterbubble: ['Fire'] };

const MOVES = {
	stealthRock: ['stealthrock', 'tectonicshell'],
	spikes: ['spikes', 'toxicspikes', 'stickyweb', 'royaldecree', 'ceaselessedge', 'stoneaxe'],
	removal: ['rapidspin', 'defog', 'mortalspin', 'tidyup', 'courtchange'],
	pivot: ['uturn', 'voltswitch', 'flipturn', 'teleport', 'partingshot', 'chillyreception', 'shedtail'],
	recovery: ['recover', 'roost', 'softboiled', 'slackoff', 'synthesis', 'moonlight', 'morningsun', 'strengthsap',
		'shoreup', 'milkdrink', 'rest', 'wish', 'healorder', 'junglehealing', 'lunarblessing', 'tectonicshell', 'chrysalisveil'],
	phaze: ['roar', 'whirlwind', 'dragontail', 'circlethrow', 'royaldecree'],
	haze: ['haze', 'clearsmog', 'encore', 'destinybond', 'perishsong'],
	status: ['willowisp', 'thunderwave', 'toxic', 'spore', 'sleeppowder', 'glare', 'nuzzle', 'yawn', 'gleamstalk'],
	stallbreak: ['taunt', 'knockoff', 'trick', 'switcheroo', 'encore'],
	setup: ['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'shellsmash', 'bulkup', 'coil',
		'irondefense', 'curse', 'agility', 'tailglow', 'victorydance', 'filletaway', 'hustleup', 'tidyup', 'geomancy'],
};
const ABILITIES = {
	removal: ['magicbounce', 'prescience'],
	recovery: ['regenerator', 'poisonheal', 'prescience'],
	setupAnswer: ['unaware', 'masquerade', 'keystonelegion'],
	stallbreak: ['masquerade', 'moldbreaker', 'colossusunbound'],
	statusAbsorb: ['guts', 'poisonheal', 'magicguard', 'naturalcure', 'purifyingsalt', 'goodasgold', 'comatose',
		'kindledfury', 'moonlitvenom', 'prescience', 'toxicboost', 'flareboost'],
};
const STATUS_ABSORB_TYPES = ['Poison', 'Steel', 'Fire', 'Electric'];

/*
 * Weather cores. An abuser without its setter is a Pokemon playing at half
 * strength - a Swift Swim Barraskewda on a team with no rain, next to a snow
 * setter, is what a usage-based draft produced - and two setters of different
 * weathers undo each other.
 */
const WEATHER = {
	rain: { setters: ['drizzle', 'primordialsea'], setMoves: ['raindance'], abusers: ['swiftswim', 'raindish', 'hydration'] },
	sun: { setters: ['drought', 'desolateland', 'orichalcumpulse'], setMoves: ['sunnyday'], abusers: ['chlorophyll', 'solarpower', 'flowergift', 'harvest'] },
	sand: { setters: ['sandstream'], setMoves: ['sandstorm'], abusers: ['sandrush', 'sandforce'] },
	snow: { setters: ['snowwarning'], setMoves: ['snowscape', 'chillyreception'], abusers: ['slushrush', 'icebody'] },
};
/** Moves that only work in a weather (Aurora Veil in snow, Solar Beam in sun without the charge). */
const WEATHER_MOVES = { snow: ['auroraveil'], sun: ['solarbeam', 'solarblade'] };

/** How hard a type hits a set: 0 immune, 0.25, 0.5, 1, 2, 4. */
function effectiveness(dex, attackType, set) {
	const species = dex.species.get(set.species);
	const types = species.types;
	const ability = toID(set.ability);
	if (ABILITY_IMMUNE[ability] === attackType) return 0;
	if (toID(set.item) === 'airballoon' && attackType === 'Ground') return 0;
	if (!dex.getImmunity(attackType, types)) return 0;
	let mult = Math.pow(2, dex.getEffectiveness(attackType, types));
	if ((ABILITY_RESIST[ability] || []).includes(attackType)) mult *= 0.5;
	return mult;
}

/** Which side a set attacks from: the category most of its attacks use, or its higher stat. */
function attackSide(dex, set) {
	const species = dex.species.get(set.species);
	let physical = 0, special = 0;
	for (const name of set.moves || []) {
		const move = dex.moves.get(name);
		if (!move.exists || move.category === 'Status') continue;
		if (move.id === 'bodypress' || move.category === 'Physical') physical++;
		else special++;
	}
	if (!physical && !special) return null;
	if (physical === special) return species.baseStats.atk >= species.baseStats.spa ? 'physical' : 'special';
	return physical > special ? 'physical' : 'special';
}

const has = (set, list) => (set.moves || []).some(m => list.includes(toID(m)));

/*
 * A set's Speed as the game computes it (31 IVs), from its EVs, nature and
 * level. A set that does not say (a bare { species, moves } handed in by a
 * test or the RP bot's !preset before items) is taken at its best - 252 EVs and
 * a boosting nature - since that is what a fast Pokemon's set would run.
 */
const SPEED_UP = ['Timid', 'Jolly', 'Hasty', 'Naive'];
const SPEED_DOWN = ['Brave', 'Quiet', 'Relaxed', 'Sassy'];
function speedStat(dex, set) {
	const base = dex.species.get(set.species).baseStats.spe;
	const level = set.level || 100;
	const ev = set.evs ? (set.evs.spe || 0) : 252;
	const nature = !set.evs && !set.nature ? 1.1 : SPEED_UP.includes(set.nature) ? 1.1 : SPEED_DOWN.includes(set.nature) ? 0.9 : 1;
	return Math.floor((Math.floor((2 * base + 31 + Math.floor(ev / 4)) * level / 100) + 5) * nature);
}
/** Final Speed that counts as fast on its own (checklist rule 7): 336 at level 100, in proportion below. */
const FAST = 336;

/*
 * The distinct ways a team stops a setup sweeper (rule 11), and which of them
 * still work against a special one: a burn halves Attack and does nothing to a
 * Calm Mind or Nasty Plot user, so two burners are one mechanism, and not one
 * that answers Iron Valiant.
 */
const SETUP_ANSWERS = {
	unaware: s => ABILITIES.setupAnswer.includes(toID(s.ability)),
	phazing: s => has(s, MOVES.phaze) || toID(s.item) === 'redcard',
	haze: s => has(s, ['haze', 'clearsmog', 'perishsong']),
	encore: s => has(s, ['encore']),
	destinybond: s => has(s, ['destinybond']),
	burn: s => has(s, ['willowisp']),
	paralysis: s => has(s, ['thunderwave', 'glare', 'nuzzle', 'stunspore']),
	priority: null, // filled in analyze: a strong enough priority attack
	scarf: null,    // and a faster Choice Scarf user
};
const PHYSICAL_ONLY_ANSWERS = ['burn'];

/** How hard an attack hits a threat: a type pair and, if known, its ability. Freeze-Dry hits Water. */
function hitThreat(dex, move, threat) {
	if (ABILITY_IMMUNE[toID(threat.ability)] === move.type) return 0;
	if (!dex.getImmunity(move.type, threat.types)) return 0;
	let mult = Math.pow(2, dex.getEffectiveness(move.type, threat.types));
	if (move.id === 'freezedry' && threat.types.includes('Water')) mult *= 4;
	return mult;
}

/** The types a team should hit super effectively (rule 5's soft part): the ones that wall the most. */
const SE_WANTED = ['Steel', 'Fairy', 'Water', 'Dragon', 'Ground'];

/**
 * Everything the checklist looks at, for up to six sets:
 * { species, ability, item, moves: [names], evs?, nature?, level? }.
 * `options.threats`: the format's top threats ([{ name or types, ability? }]),
 * for rule 5 (every one hit at least neutrally by two members).
 */
function analyze(dex, sets, options = {}) {
	const types = dex.types.names ? dex.types.names() : KEY_TYPES;
	const weak = {}, resist = {};
	for (const type of types) {
		weak[type] = sets.filter(s => effectiveness(dex, type, s) >= 2).map(s => s.species);
		resist[type] = sets.filter(s => effectiveness(dex, type, s) <= 0.5).map(s => s.species);
	}
	const who = test => sets.filter(test).map(s => s.species);
	const ability = s => toID(s.ability);
	const item = s => toID(s.item);
	const priority = s => (s.moves || []).some(m => { const mv = dex.moves.get(m); return mv.exists && mv.category !== 'Status' && mv.priority > 0; });
	const defensive = s => {
		const b = dex.species.get(s.species).baseStats;
		const attacks = (s.moves || []).filter(m => dex.moves.get(m).category !== 'Status').length;
		return (has(s, MOVES.recovery) || ABILITIES.recovery.includes(ability(s))) && attacks <= 2 ||
			(b.hp + b.def + b.spd >= 300 && attacks <= 2);
	};
	const sides = sets.map(s => attackSide(dex, s));
	// Fast enough on its own (rule 7), at the set's level.
	const fast = s => speedStat(dex, s) >= Math.floor(FAST * (s.level || 100) / 100);
	// A priority attack that stops a boosted sweeper: STAB 40 (Bullet Punch, Aqua Jet on a Water type) and up.
	const strongPriority = s => (s.moves || []).some(m => {
		const mv = dex.moves.get(m);
		if (!mv.exists || mv.category === 'Status' || !(mv.priority > 0) || ['fakeout', 'firstimpression', 'upperhand', 'feint'].includes(mv.id)) return false;
		return (mv.basePower || 0) * (dex.species.get(s.species).types.includes(mv.type) ? 1.5 : 1) >= 60;
	});
	const answers = { ...SETUP_ANSWERS, priority: strongPriority, scarf: s => item(s) === 'choicescarf' };
	const mechanisms = Object.keys(answers).filter(k => sets.some(answers[k]));
	/*
	 * Rule 5: which of the format's threats fewer than two members can hit at
	 * least neutrally, with the attacks they actually carry. A team whose
	 * every attack Corviknight resists has no answer to Corviknight however
	 * well it takes Corviknight's hits.
	 */
	const hitters = threat => sets.filter(s => (s.moves || []).some(m => {
		const mv = dex.moves.get(m);
		return mv.exists && mv.category !== 'Status' && (mv.basePower > 0 || ['seismictoss', 'nightshade'].includes(mv.id)) &&
			hitThreat(dex, mv, threat) >= 1;
	})).length;
	const threats = (options.threats || []).map(t => {
		const sp = dex.species.get(t.name || t.species || '');
		return { name: t.name || sp.name || (t.types || []).join('/'), types: t.types || (sp.exists ? sp.types : []), ability: t.ability || '' };
	}).filter(t => t.types.length);
	const hitsSE = type => sets.some(s => (s.moves || []).some(m => {
		const mv = dex.moves.get(m);
		return mv.exists && mv.category !== 'Status' && mv.basePower > 0 && hitThreat(dex, mv, { types: [type] }) >= 2;
	}));
	const report = {
		size: sets.length,
		weak, resist,
		stealthRock: who(s => has(s, MOVES.stealthRock)),
		otherHazards: who(s => has(s, MOVES.spikes)),
		removal: who(s => has(s, MOVES.removal) || ABILITIES.removal.includes(ability(s))),
		boots: who(s => item(s) === 'heavydutyboots'),
		rockWeak: who(s => effectiveness(dex, 'Rock', s) >= 2 && item(s) !== 'heavydutyboots'),
		priority: who(priority),
		// Rule 7's points: priority, a Scarf, Thunder Wave and the like, or 336 Speed of its own.
		speedControl: who(s => priority(s) || item(s) === 'choicescarf' || has(s, ['thunderwave', 'tailwind', 'trickroom', 'icywind', 'electroweb', 'gleamstalk']) || fast(s)),
		pivots: who(s => has(s, MOVES.pivot)),
		recovery: who(s => has(s, MOVES.recovery) || ABILITIES.recovery.includes(ability(s))),
		statusAbsorb: who(s => ABILITIES.statusAbsorb.includes(ability(s)) || dex.species.get(s.species).types.some(t => STATUS_ABSORB_TYPES.includes(t)) || item(s) === 'lumberry'),
		setupAnswers: who(s => has(s, MOVES.phaze) || has(s, MOVES.haze) || has(s, ['willowisp', 'thunderwave', 'glare', 'nuzzle']) || ABILITIES.setupAnswer.includes(ability(s)) || priority(s)),
		// Rule 11 by mechanism, not by member: see SETUP_ANSWERS.
		setupMechanisms: mechanisms,
		specialSetupAnswer: mechanisms.some(k => !PHYSICAL_ONLY_ANSWERS.includes(k)),
		// Rule 5: threats fewer than two members hit neutrally, and the walling types nothing hits super effectively.
		threatsUnhit: threats.filter(t => hitters(t) < 2).map(t => t.name),
		threatsChecked: threats.length,
		superEffectiveMissing: SE_WANTED.filter(t => !hitsSE(t)),
		stallbreak: who(s => has(s, MOVES.stallbreak) || ABILITIES.stallbreak.includes(ability(s)) || ['choiceband', 'choicespecs'].includes(item(s))),
		setup: who(s => has(s, MOVES.setup)),
		// Something that actually wins a game: a sweeper that boosts, or a breaker holding
		// a Choice item or a Life Orb with real attacks. A team of six walls has none.
		winCondition: who(s => {
			const attacks = (s.moves || []).filter(m => dex.moves.get(m).category !== 'Status').length;
			return (has(s, MOVES.setup) && attacks >= 2) || (['choiceband', 'choicespecs', 'choicescarf', 'lifeorb'].includes(item(s)) && attacks >= 2);
		}),
		physical: sets.filter((s, i) => sides[i] === 'physical').map(s => s.species),
		special: sets.filter((s, i) => sides[i] === 'special').map(s => s.species),
		defensive: who(defensive),
	};
	report.weather = {};
	for (const [name, w] of Object.entries(WEATHER)) {
		const setters = who(s => w.setters.includes(ability(s)) || has(s, w.setMoves));
		const abusers = who(s => w.abusers.includes(ability(s)) || has(s, WEATHER_MOVES[name] || []));
		if (setters.length || abusers.length) report.weather[name] = { setters, abusers };
	}
	const walls = report.defensive.length;
	report.style = walls >= 4 ? 'stall' : walls >= 2 ? 'balance' : walls === 1 || report.setup.length < 2 ? 'bulky offense' : 'hyper offense';
	return report;
}

/**
 * Strictness by RP badges (the owner's choice): 0-2 sensible movesets only,
 * 3-5 the team basics, 6+ the full checklist. `themed` relaxes shared
 * weaknesses for a type-specialist trainer.
 */
function stageFor(badges) {
	return badges >= 6 ? 'full' : badges >= 3 ? 'basics' : 'movesets';
}

/** What is wrong with a team, most important first: [{ severity: 'hard'|'soft', text }]. */
function issues(report, { stage = 'full', themed = false } = {}) {
	const out = [];
	const add = (severity, text) => out.push({ severity, text });
	if (stage === 'movesets' || report.size < 3) return out;

	const worst = Object.entries(report.weak).sort((a, b) => b[1].length - a[1].length)[0];
	if (!themed && worst && worst[1].length >= 4) add('hard', `${worst[1].length} of the team are weak to ${worst[0]} (${worst[1].join(', ')})`);
	else if (!themed && worst && worst[1].length === 3) add('soft', `3 are weak to ${worst[0]} (${worst[1].join(', ')})`);
	/*
	 * Rule 4: something that takes each of the common attacking types. A hard rule
	 * for every team but hyper offense, which trades defensive synergy for speed
	 * (the guides disagree here; see the checklist) and only fails with three
	 * missing. The four types that hit hardest across tiers want two answers.
	 */
	if (!themed) {
		const offense = report.style === 'hyper offense';
		const noAnswer = KEY_TYPES.filter(t => !report.resist[t].length);
		if (noAnswer.length) add(noAnswer.length >= 3 || !offense ? 'hard' : 'soft', `nothing resists ${noAnswer.join(', ')}`);
		const thin = ['Water', 'Ground', 'Fighting', 'Dragon'].filter(t => report.resist[t] && report.resist[t].length === 1);
		if (thin.length && !offense && stage === 'full') add('soft', `only one answer to ${thin.join(', ')}`);
	}
	// Rule 6: two attackers on each side, and not five of one (a stall team attacks little and is exempt).
	if (report.size >= 4 && (report.physical.length < 1 || report.special.length < 1)) {
		add('hard', `every attacker is ${report.physical.length ? 'physical' : 'special'}: one wall for that side stops the whole team`);
	} else if (report.size >= 5 && report.style !== 'stall' && (report.physical.length < 2 || report.special.length < 2)) {
		add('hard', `only ${Math.min(report.physical.length, report.special.length)} ${report.physical.length < 2 ? 'physical' : 'special'} attacker`);
	} else if (Math.max(report.physical.length, report.special.length) > 4) {
		add('soft', `${Math.max(report.physical.length, report.special.length)} ${report.physical.length > 4 ? 'physical' : 'special'} attackers`);
	}
	const weathers = Object.entries(report.weather || {});
	for (const [name, w] of weathers) {
		if (!w.setters.length && w.abusers.length) add(stage === 'full' ? 'hard' : 'soft', `${w.abusers.join(', ')} ${w.abusers.length === 1 ? 'needs' : 'need'} ${name} and nothing sets it`);
	}
	for (const [name, w] of weathers) {
		if (w.setters.length && !w.abusers.length && stage === 'full') add('soft', `${w.setters.join(', ')} sets ${name} and nothing on the team uses it`);
	}
	const setterWeathers = weathers.filter(([, w]) => w.setters.length).map(([name]) => name);
	if (setterWeathers.length > 1) add('soft', `the team sets ${setterWeathers.join(' and ')}, which undo each other`);
	if (stage === 'basics') return out;

	if (!report.winCondition.length) add(report.style === 'stall' ? 'soft' : 'hard', 'nothing that wins a game on its own (a setup sweeper, or a breaker with a Choice item or Life Orb)');
	if (!report.stealthRock.length) add('hard', 'no Stealth Rock');
	if (report.stealthRock.length > 1) add('soft', `${report.stealthRock.length} Stealth Rock setters (${report.stealthRock.join(', ')}); one is enough`);
	// Rule 2: hazard control. Heavy rock damage needs a remover; a balance or stall team wants one anyway,
	// and a second is a wasted slot everywhere but stall (rule 13).
	if (report.rockWeak.length >= 2 && !report.removal.length) add(report.style === 'hyper offense' ? 'soft' : 'hard', `no hazard removal, and ${report.rockWeak.join(', ')} take big Stealth Rock damage`);
	else if (!report.removal.length && ['balance', 'stall'].includes(report.style)) add('soft', `a ${report.style} team with no hazard removal`);
	if (report.removal.length > 1 && report.style !== 'stall') add('soft', `${report.removal.length} hazard removers (${report.removal.join(', ')}); one is enough`);
	/*
	 * Rule 7: speed control, counted. Each member with priority, a Scarf, Thunder
	 * Wave (or Icy Wind, Tailwind...) or 336 Speed of its own is a point; hyper
	 * offense needs three, bulky offense two, balance one. Stall plays slowly on
	 * purpose and only needs not to have nothing at all.
	 */
	const needSpeed = { 'hyper offense': 3, 'bulky offense': 2, balance: 1 }[report.style] || 0;
	if (!report.speedControl.length) add('hard', 'nothing fast and no priority');
	else if (report.speedControl.length < needSpeed) add('hard', `only ${report.speedControl.length} of the ${needSpeed} speed control a ${report.style} team needs (${report.speedControl.join(', ')})`);
	else if (!report.priority.length && report.style !== 'stall') add('soft', 'no priority move');
	if (!report.pivots.length && ['balance', 'bulky offense'].includes(report.style)) add('soft', 'no pivot (U-turn, Volt Switch, Flip Turn, Teleport, Parting Shot)');
	else if (report.pivots.length === 1 && report.style === 'balance') add('soft', 'a balance team with one pivot');
	/*
	 * Rule 11, by mechanism: two Will-O-Wisp users are one answer, and not one to
	 * Calm Mind. Two distinct ones, at least one that works on a special sweeper.
	 */
	const mechanisms = report.setupMechanisms || [];
	if (mechanisms.length < 2) add('hard', `fewer than two ways to stop a setup sweeper (${mechanisms.join(', ') || 'none'}; phazing, Haze, Encore, paralysis, burn, Unaware, priority, a Scarf)`);
	else if (report.specialSetupAnswer === false) add('hard', 'nothing that stops a special setup sweeper (burn only halves Attack)');
	/*
	 * Rule 5: the format's threats, when the caller knows them (src/teambuilder.js
	 * does). Each should be hit at least neutrally by two members; and something
	 * should hit each of the walling types super effectively.
	 */
	if (report.threatsUnhit && report.threatsUnhit.length) add('hard', `fewer than two members hit ${report.threatsUnhit.join(', ')} for neutral damage`);
	if (report.superEffectiveMissing && report.superEffectiveMissing.length >= 2) add('soft', `nothing hits ${report.superEffectiveMissing.join(', ')} super effectively`);
	// Rule 12: offense has to get past walls; stall is the wall.
	if (!report.stallbreak.length && report.style !== 'stall') add(['hyper offense', 'bulky offense'].includes(report.style) ? 'hard' : 'soft', 'no way to break a wall (Taunt, Knock Off, Trick, a Choice Band/Specs attacker)');
	if (!report.statusAbsorb.length) add('soft', 'nothing to absorb status (a Poison/Steel/Fire/Electric type, Natural Cure, Magic Guard...)');
	// Rule 9: a wall without recovery is worn down; on stall, every one of them needs it.
	const unhealed = report.defensive.filter(n => !report.recovery.includes(n));
	if (report.style === 'stall' && unhealed.length) add('hard', `a stall team's ${unhealed.join(', ')} ${unhealed.length === 1 ? 'has' : 'have'} no recovery`);
	else if (report.defensive.length && !report.recovery.length) add('soft', 'the defensive Pokémon have no recovery');
	return out;
}

/** A single number to compare teams by: higher is better. Hard issues cost far more than soft ones. */
function score(dex, sets, options = {}) {
	const report = analyze(dex, sets, options);
	const found = issues(report, options);
	return { report, issues: found, score: -found.reduce((n, i) => n + (i.severity === 'hard' ? 10 : 3), 0) };
}

module.exports = { analyze, issues, score, stageFor, effectiveness, attackSide, speedStat, KEY_TYPES, MOVES, ABILITIES };
