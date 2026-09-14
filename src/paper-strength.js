'use strict';
/**
 * How strong a Pokemon looks on paper, for the ones nobody has statistics on.
 *
 * Every other part of this project prefers measured reality to opinion: the
 * team builder draws from usage statistics, the tiers come from Smogon, the
 * difficulty rungs were measured rather than asserted. None of that exists for
 * a Pokemon that has never been played. The Z-A Megas are fifty of those - real
 * Pokemon with real stats that no ladder has ever run, so there is no usage to
 * weight them by and no tier to place them in, and the honest answer to "how
 * good is Chandelure-Mega" is that nobody knows yet.
 *
 * So this is the fallback, and it is explicitly a guess: read the sheet, score
 * what the sheet says, and be clear that it is paper. It is used in three
 * places, all of which previously had nothing at all:
 *
 *   - placing the Z-A Megas in a tier, instead of a base-stat-total cutoff
 *   - weighting the draw, so an unknown Pokemon is not drawn like a random one
 *   - ranking Pokemon within a team, for the bot's own decisions
 *
 * What it reads, and why each one:
 *
 * **Stats, but not the total.** A base stat total counts Slaking's Attack and
 * Shuckle's Defence the same way, and counts a stat the Pokemon cannot use at
 * all. So the offensive stats count only the better one (nothing runs mixed
 * well enough to want both), speed is scored against the tiers people actually
 * sit at rather than linearly, and bulk is the *product* of HP and defences,
 * which is what bulk actually is - 100/100 is far tougher than 150/50.
 *
 * **Typing, both ways.** How many types it resists and how many hit it hard,
 * counted off the real chart; and how much of the chart its own STAB hits for
 * super effective damage.
 *
 * **The ability.** Not judged in general - that is a research project - but a
 * short list of the ones that are worth a tier by themselves, which is a thing
 * the community agrees about far more than it agrees about anything else.
 *
 * **The movepool.** Only breadth: how many distinct types it can attack with,
 * whether it has priority, recovery, setup, hazards. A Pokemon with one move is
 * not a Pokemon.
 */

/**
 * Abilities that decide games, and roughly what each is worth.
 *
 * Deliberately short. Every ability is worth *something*, and a list that tries
 * to price all three hundred is a list that is wrong in three hundred places;
 * these are the ones whose presence changes what tier something belongs in.
 */
const ABILITIES = {
	// Doubles a stat, or the equivalent.
	hugepower: 22, purepower: 22, gorillatactics: 12, protean: 14, libero: 14,
	adaptability: 8, sheerforce: 8, technician: 8, transistor: 8, dragonsmaw: 8,
	// Weather and terrain, which change every calculation on the field.
	drought: 12, drizzle: 12, sandstream: 8, snowwarning: 8, orichalcumpulse: 14,
	hadronengine: 14, grassysurge: 10, psychicsurge: 10, electricsurge: 8, mistysurge: 6,
	verdantsurge: 10, solarsurge: 12, tidalsurge: 12,
	// Immunities and near-immunities.
	levitate: 8, waterabsorb: 6, voltabsorb: 6, flashfire: 6, magicguard: 12,
	wonderguard: 30, unaware: 10, prankster: 10, magicbounce: 10, regenerator: 12,
	// Trapping and disruption, which is why these are banned so often.
	shadowtag: 20, arenatrap: 14, moldbreaker: 4, neutralizinggas: 8, intimidate: 6,
	// Surviving what should have killed you.
	multiscale: 12, sturdy: 4, disguise: 10, iceface: 8, shadowshield: 12,
	// The ones that are simply enormous.
	speedboost: 16, moody: 20, imposter: 10, beastboost: 8, quarkdrive: 8, protosynthesis: 8,
	queenwrath: 40, queensmorph: 40,
};

/** Moves whose presence says something about what a Pokemon can do. */
const RECOVERY = /^(recover|roost|softboiled|slackoff|moonlight|morningsun|synthesis|shoreup|milkdrink|rest|strengthsap|junglehealing|lunarblessing|queensheal)$/;
const SETUP = /^(swordsdance|nastyplot|dragondance|calmmind|quiverdance|shellsmash|bulkup|curse|irondefense|agility|rockpolish|autotomize|growth|workup|victorydance|tidyup|queensdance|clangoroussoul|noretreat|bellydrum)$/;
const HAZARDS = /^(stealthrock|spikes|toxicspikes|stickyweb|ceaselessedge|stoneaxe)$/;
const PIVOT = /^(uturn|voltswitch|flipturn|partingshot|batonpass|teleport|shedtail|chillyreception)$/;

/**
 * A speed number, scored the way the game is actually laid out.
 *
 * Speed is not linear and never has been: the difference between 95 and 105 is
 * most of a metagame, and the difference between 40 and 50 is nothing. The
 * numbers below are the tiers people build around.
 */
function speedScore(speed) {
	if (speed >= 130) return 20;
	if (speed >= 110) return 17;
	if (speed >= 100) return 14;
	if (speed >= 95) return 12;
	if (speed >= 85) return 9;
	if (speed >= 70) return 6;
	if (speed >= 55) return 3;
	return 1;
}

/** Bulk is a product, not a sum: 100/100 is far tougher than 150/50. */
function bulkScore(hp, def, spd) {
	const physical = hp * def, special = hp * spd;
	// Normalised so that a 100/100/100 Pokemon scores about 14.
	const scale = value => Math.min(22, Math.round(Math.sqrt(value) / 7.1));
	return Math.round((scale(physical) + scale(special)) / 2 * 10) / 10;
}

/** What the type chart does to this Pokemon, and what it does back. */
function typingScore(dex, types) {
	const chart = dex.types.all().map(type => type.name);
	let resists = 0, weaknesses = 0, immunities = 0;
	for (const attacking of chart) {
		let multiplier = 1;
		for (const defending of types) {
			const effect = dex.types.get(attacking).damageTaken[defending];
			// 0 none, 1 weak (2x), 2 resist (0.5x), 3 immune
			const taken = dex.types.get(defending).damageTaken[attacking];
			void effect;
			if (taken === 1) multiplier *= 2;
			else if (taken === 2) multiplier *= 0.5;
			else if (taken === 3) multiplier = 0;
		}
		if (multiplier === 0) immunities++;
		else if (multiplier < 1) resists++;
		else if (multiplier > 1) weaknesses++;
	}

	// What its own STAB is worth: how much of the chart it hits hard.
	let coverage = 0;
	for (const defending of chart) {
		let best = 1;
		for (const attacking of types) {
			const taken = dex.types.get(defending).damageTaken[attacking];
			const multiplier = taken === 1 ? 2 : taken === 2 ? 0.5 : taken === 3 ? 0 : 1;
			best = Math.max(best, multiplier);
		}
		if (best > 1) coverage++;
	}

	return Math.round((resists * 1.2 + immunities * 2.5 - weaknesses * 1.6 + coverage * 0.5) * 10) / 10;
}

/** Breadth, not quality: what kinds of thing can this Pokemon do at all? */
function movepoolScore(dex, species) {
	let pool;
	try {
		pool = dex.species.getMovePool(species.id);
	} catch (e) {
		return 0;
	}
	const attackingTypes = new Set();
	let recovery = false, setup = false, hazards = false, pivot = false, priority = false;
	for (const id of pool) {
		const move = dex.moves.get(id);
		if (!move.exists) continue;
		if (move.category !== 'Status' && move.basePower >= 60) attackingTypes.add(move.type);
		if (RECOVERY.test(id)) recovery = true;
		if (SETUP.test(id)) setup = true;
		if (HAZARDS.test(id)) hazards = true;
		if (PIVOT.test(id)) pivot = true;
		if (move.priority > 0 && move.category !== 'Status') priority = true;
	}
	return Math.min(12, attackingTypes.size) * 0.7 +
		(recovery ? 6 : 0) + (setup ? 4 : 0) + (hazards ? 2 : 0) + (pivot ? 2 : 0) + (priority ? 3 : 0);
}

/**
 * The whole score, on a scale where an ordinary fully-evolved Pokemon is about
 * 50, a tier staple is about 65, and a box legendary is 80 and up.
 */
function paperStrength(dex, speciesOrName) {
	const species = typeof speciesOrName === 'string' ? dex.species.get(speciesOrName) : speciesOrName;
	if (!species || !species.exists || !species.baseStats) return 0;

	const stats = species.baseStats;
	const offence = Math.max(stats.atk, stats.spa);
	// A second attacking stat is worth a little: it is coverage, not power.
	const second = Math.min(stats.atk, stats.spa);

	const abilities = Object.values(species.abilities || {})
		.map(name => ABILITIES[dex.abilities.get(name).id] || 0);
	const ability = abilities.length ? Math.max(...abilities) : 0;

	const score =
		offence * 0.16 +
		second * 0.04 +
		speedScore(stats.spe) +
		bulkScore(stats.hp, stats.def, stats.spd) +
		typingScore(dex, species.types) +
		movepoolScore(dex, species) +
		ability;

	return Math.round(score * 10) / 10;
}

/**
 * The same, as a tier name.
 *
 * The boundaries are fitted to what the scorer says about Pokemon whose tier is
 * already known - see scripts/check-strength.js, which prints them side by side
 * so the cutoffs can be argued with rather than trusted.
 */
function paperTier(score) {
	/*
	 * Fitted, not chosen. The first set of numbers here was picked by eye and
	 * put the median Uber in OU, which is the kind of wrong that looks careful.
	 * These are set against what the scorer says about Pokemon whose tier is
	 * already known - run scripts/check-strength.js and every real tier's median
	 * should land in its own band, or near it.
	 *
	 * Near it is the honest goal. Below OU the bands genuinely overlap: NU's
	 * median scores higher than RU's, because tiering below the top is about
	 * what a Pokemon does to a specific metagame and not about how good it looks
	 * on paper. The scorer cannot see that and is not pretending to.
	 */
	if (score >= 78) return 'Uber';
	if (score >= 73) return 'OU';
	if (score >= 69) return 'UU';
	if (score >= 65) return 'RU';
	if (score >= 58) return 'NU';
	return 'PU';
}

module.exports = { paperStrength, paperTier, ABILITIES };
