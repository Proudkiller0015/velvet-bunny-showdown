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

/**
 * Everything the checklist looks at, for up to six sets:
 * { species, ability, item, moves: [names] }.
 */
function analyze(dex, sets) {
	const types = dex.types.names ? dex.types.names() : KEY_TYPES;
	const weak = {}, resist = {};
	for (const type of types) {
		weak[type] = sets.filter(s => effectiveness(dex, type, s) >= 2).map(s => s.species);
		resist[type] = sets.filter(s => effectiveness(dex, type, s) <= 0.5).map(s => s.species);
	}
	const who = test => sets.filter(test).map(s => s.species);
	const ability = s => toID(s.ability);
	const item = s => toID(s.item);
	const speed = s => dex.species.get(s.species).baseStats.spe;
	const priority = s => (s.moves || []).some(m => { const mv = dex.moves.get(m); return mv.exists && mv.category !== 'Status' && mv.priority > 0; });
	const defensive = s => {
		const b = dex.species.get(s.species).baseStats;
		const attacks = (s.moves || []).filter(m => dex.moves.get(m).category !== 'Status').length;
		return (has(s, MOVES.recovery) || ABILITIES.recovery.includes(ability(s))) && attacks <= 2 ||
			(b.hp + b.def + b.spd >= 300 && attacks <= 2);
	};
	const sides = sets.map(s => attackSide(dex, s));
	const report = {
		size: sets.length,
		weak, resist,
		stealthRock: who(s => has(s, MOVES.stealthRock)),
		otherHazards: who(s => has(s, MOVES.spikes)),
		removal: who(s => has(s, MOVES.removal) || ABILITIES.removal.includes(ability(s))),
		boots: who(s => item(s) === 'heavydutyboots'),
		rockWeak: who(s => effectiveness(dex, 'Rock', s) >= 2 && item(s) !== 'heavydutyboots'),
		priority: who(priority),
		speedControl: who(s => priority(s) || item(s) === 'choicescarf' || has(s, ['thunderwave', 'tailwind', 'trickroom', 'icywind', 'electroweb', 'gleamstalk']) || speed(s) >= 100),
		pivots: who(s => has(s, MOVES.pivot)),
		recovery: who(s => has(s, MOVES.recovery) || ABILITIES.recovery.includes(ability(s))),
		statusAbsorb: who(s => ABILITIES.statusAbsorb.includes(ability(s)) || dex.species.get(s.species).types.some(t => STATUS_ABSORB_TYPES.includes(t)) || item(s) === 'lumberry'),
		setupAnswers: who(s => has(s, MOVES.phaze) || has(s, MOVES.haze) || has(s, ['willowisp', 'thunderwave', 'glare', 'nuzzle']) || ABILITIES.setupAnswer.includes(ability(s)) || priority(s)),
		stallbreak: who(s => has(s, MOVES.stallbreak) || ABILITIES.stallbreak.includes(ability(s)) || ['choiceband', 'choicespecs'].includes(item(s))),
		setup: who(s => has(s, MOVES.setup)),
		physical: sets.filter((s, i) => sides[i] === 'physical').map(s => s.species),
		special: sets.filter((s, i) => sides[i] === 'special').map(s => s.species),
		defensive: who(defensive),
	};
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
	if (!themed) {
		const noAnswer = KEY_TYPES.filter(t => !report.resist[t].length);
		if (noAnswer.length) add(noAnswer.length >= 3 ? 'hard' : 'soft', `nothing resists ${noAnswer.join(', ')}`);
	}
	if (report.size >= 4 && (report.physical.length < 1 || report.special.length < 1)) {
		add('hard', `every attacker is ${report.physical.length ? 'physical' : 'special'}: one wall for that side stops the whole team`);
	} else if (report.size >= 5 && report.style !== 'stall' && (report.physical.length < 2 || report.special.length < 2)) {
		add('soft', `only ${Math.min(report.physical.length, report.special.length)} ${report.physical.length < 2 ? 'physical' : 'special'} attacker`);
	}
	if (stage === 'basics') return out;

	if (!report.stealthRock.length) add('hard', 'no Stealth Rock');
	if (report.stealthRock.length > 1) add('soft', `${report.stealthRock.length} Stealth Rock setters (${report.stealthRock.join(', ')}); one is enough`);
	if (report.rockWeak.length >= 2 && !report.removal.length) add(report.style === 'hyper offense' ? 'soft' : 'hard', `no hazard removal, and ${report.rockWeak.join(', ')} take big Stealth Rock damage`);
	if (!report.speedControl.length) add('hard', 'nothing fast and no priority');
	else if (!report.priority.length && report.style !== 'stall') add('soft', 'no priority move');
	if (!report.pivots.length && ['balance', 'bulky offense'].includes(report.style)) add('soft', 'no pivot (U-turn, Volt Switch, Flip Turn, Teleport, Parting Shot)');
	if (report.setupAnswers.length < 2) add('hard', 'fewer than two ways to stop a setup sweeper (phazing, Haze, burn/paralysis, Unaware, priority)');
	if (!report.stallbreak.length && report.style !== 'stall') add('soft', 'no way to break a wall (Taunt, Knock Off, Trick, a Choice Band/Specs attacker)');
	if (!report.statusAbsorb.length) add('soft', 'nothing to absorb status (a Poison/Steel/Fire/Electric type, Natural Cure, Magic Guard...)');
	if (report.defensive.length && !report.recovery.length) add('soft', 'the defensive Pokémon have no recovery');
	return out;
}

/** A single number to compare teams by: higher is better. Hard issues cost far more than soft ones. */
function score(dex, sets, options = {}) {
	const report = analyze(dex, sets);
	const found = issues(report, options);
	return { report, issues: found, score: -found.reduce((n, i) => n + (i.severity === 'hard' ? 10 : 3), 0) };
}

module.exports = { analyze, issues, score, stageFor, effectiveness, attackSide, KEY_TYPES, MOVES, ABILITIES };
