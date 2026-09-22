'use strict';
/**
 * The rarity ladder: one ranking of every Pokemon, used by wild encounters,
 * the encounter tables and the RP bot's gacha.
 *
 * Two keys, in this order:
 *
 *   1. CLASS - what kind of Pokemon it is.
 *        boxart > mythical > legendary > paradox > ub > pseudo > starter > rare > medium > common
 *      "boxart" is a restricted legendary (the ones on a game's box). Rare,
 *      medium and common are ordinary lines sorted by what they grow into.
 *   2. USAGE - the Smogon tier of the strongest thing the line becomes, so a
 *      Garchomp line outranks a Goodra line inside the pseudo class.
 *
 * Not all of a class is equal, which is what the second key is for.
 *
 * Kagura is open world, so a PLACE never decides how rare something is - it
 * only decides which Pokemon live there. Odds come from the ladder and from how
 * many badges the trainer has: each headliner class has a badge count it is
 * "at home" at, and below that it thins out rather than vanishing.
 *
 * rp-bot/src/pokemon/rarity.js is a copy of this file; its test checks the two
 * agree.
 */

const Dex = require('./rp-dex')();

const STARTERS = new Set(['bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile', 'treecko',
	'torchic', 'mudkip', 'turtwig', 'chimchar', 'piplup', 'snivy', 'tepig', 'oshawott', 'chespin', 'fennekin',
	'froakie', 'rowlet', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble', 'sprigatito', 'fuecoco', 'quaxly',
	'pikachu', 'pichu', 'eevee']);
/** The real pseudo-legendaries. Anything that calls itself one in words uses this. */
const PSEUDO_LINES = new Set(['dratini', 'larvitar', 'bagon', 'beldum', 'gible', 'deino', 'goomy', 'jangmoo', 'dreepy', 'frigibax']);
/*
 * Who is PRICED like one, which is a different question.
 *
 * Spiritomb is not a pseudo-legendary and is never called one - it is a
 * 108-spirit oddity with a 485 stat total. It is here because of how hard it is
 * to get: in its own games it appears at all only after thirty-two people trade
 * through the same Odd Keystone. So it is rated, priced, weighted in the grass
 * and sorted on the boards at that rung, while the Pseudo Vault and every line
 * of text that says "pseudo-legendary" goes on reading PSEUDO_LINES.
 */
const PSEUDOS = new Set([...PSEUDO_LINES, 'spiritomb']);
/*
 * Every Paradox form by name, because the Dex's tags miss the later DLC ones -
 * Raging Bolt, Gouging Fire, Iron Crown and Iron Boulder carry no tag at all
 * and would otherwise pass for ordinary lines.
 */
const PARADOXES = new Set(['greattusk', 'screamtail', 'brutebonnet', 'fluttermane', 'slitherwing', 'sandyshocks',
	'roaringmoon', 'walkingwake', 'gougingfire', 'ragingbolt', 'irontreads', 'ironbundle', 'ironhands', 'ironjugulis',
	'ironmoth', 'ironthorns', 'ironvaliant', 'ironleaves', 'ironboulder', 'ironcrown']);

/** Lowest first. The index is the class's rank. */
const CLASSES = ['common', 'medium', 'rare', 'starter', 'pseudo', 'ub', 'paradox', 'legendary', 'mythical', 'boxart'];
const RANK = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
/** Classes that are never met in the wild: story events and the Legendary Signal only. */
const NEVER_WILD = new Set(['legendary', 'mythical', 'boxart']);
/** Classes that only appear at a place that lists them. */
const HEADLINERS = new Set(['starter', 'pseudo', 'ub', 'paradox', 'legendary', 'mythical', 'boxart']);

/** Ordinary lines, by the base stat total of what they become. */
const RARE_FROM = 540;
const MEDIUM_FROM = 430;

/** Smogon tiers as numbers. */
const TIER_VALUE = {
	LC: 0, NFE: 0, ZU: 0, ZUBL: 0.5, PU: 1, PUBL: 1.5, NU: 2, NUBL: 2.5, RU: 3, RUBL: 3.5,
	UU: 4, UUBL: 4.5, OU: 5, UBER: 6, AG: 6,
};
function tierValue(tier) {
	const t = String(tier || '').toUpperCase().replace(/[()]/g, '').trim();
	return t in TIER_VALUE ? TIER_VALUE[t] : null;
}

/**
 * The badge count each class is at home at. Below it, every missing badge
 * quarters the odds - still possible on day one, as it should be in an open
 * world, just not likely.
 */
const BADGE_HOME = { common: 0, medium: 0, rare: 0, starter: 0, pseudo: 2, ub: 4, paradox: 5 };

const species = s => (typeof s === 'string' ? Dex.species.get(s) : s);
const bst = s => Object.values(s.baseStats).reduce((a, b) => a + b, 0);
function rootOf(s) {
	let x = species(s);
	for (let i = 0; i < 4 && x.prevo; i++) x = Dex.species.get(x.prevo);
	return x;
}
/** The line from the root down, every branch. */
function lineOf(s) {
	const out = [];
	const walk = (x, depth) => {
		if (!x.exists || depth > 4 || out.includes(x)) return;
		out.push(x);
		for (const e of x.evos || []) walk(Dex.species.get(e), depth + 1);
	};
	walk(rootOf(s), 0);
	return out;
}

const classCache = new Map();
/** A Pokemon's class. Forms take their base species' class. */
function classOf(name) {
	let s = species(name);
	if (!s || !s.exists) return 'common';
	if (classCache.has(s.id)) return classCache.get(s.id);
	const base = Dex.species.get(s.baseSpecies);
	const tags = new Set([...(s.tags || []), ...(base.tags || [])]);
	const root = rootOf(base);
	let c;
	if (tags.has('Restricted Legendary')) c = 'boxart';
	else if (tags.has('Mythical')) c = 'mythical';
	else if (tags.has('Sub-Legendary')) c = 'legendary';
	else if (tags.has('Paradox') || PARADOXES.has(base.id)) c = 'paradox';
	else if (tags.has('Ultra Beast')) c = 'ub';
	else if (PSEUDOS.has(root.id)) c = 'pseudo';
	else if (STARTERS.has(root.id)) c = 'starter';
	else {
		const power = Math.max(...lineOf(s).map(bst));
		c = power >= RARE_FROM ? 'rare' : power >= MEDIUM_FROM ? 'medium' : 'common';
	}
	classCache.set(s.id, c);
	return c;
}

/** Whether this Pokemon really is a pseudo-legendary, rather than merely priced as one. */
function isPseudoLine(name) {
	const s = Dex.species.get(String(name || ''));
	if (!s || !s.exists) return false;
	return PSEUDO_LINES.has(rootOf(Dex.species.get(s.baseSpecies)).id);
}

const usageCache = new Map();
/**
 * How good the line is in battle, 0 (ZU and below) to 6 (Uber), judged on its
 * best final stage. A line with no tier anywhere falls back to its stats.
 */
function usageOf(name) {
	const s = species(name);
	if (!s || !s.exists) return 0;
	if (usageCache.has(s.id)) return usageCache.get(s.id);
	let best = null;
	for (const x of lineOf(s)) {
		// The ninth-generation tier first, natDexTier for lines Scarlet and Violet
		// left out. The tier review (data/velvet/tiering.js) stamps "RU" into
		// natDexTier for anything below RU, so on an Illegal line that value is
		// the stamp, not a verdict - Butterfree is not an RU Pokemon.
		const dex = x.natDexTier === 'RU' && x.tier === 'Illegal' ? null : tierValue(x.natDexTier);
		const v = tierValue(x.tier) ?? dex;
		// LC and NFE say nothing about the line; only a final stage's tier counts.
		if (v !== null && !['LC', 'NFE'].includes(x.tier) && (best === null || v > best)) best = v;
	}
	if (best === null) {
		const power = Math.max(...lineOf(s).map(bst));
		best = power >= 600 ? 5 : power >= 580 ? 4 : power >= 535 ? 3 : power >= 500 ? 2 : power >= 450 ? 1 : 0;
	}
	usageCache.set(s.id, best);
	return best;
}

/** Sort key: higher is rarer. Class first, usage inside it. */
const score = name => RANK[classOf(name)] * 10 + usageOf(name);
/** Rarest first. */
const compare = (a, b) => score(b) - score(a);

/*
 * How often a class turns up in the wild, relative to an ordinary line. Within
 * a class, every usage step above ZU takes a little more off, so a Garchomp line
 * is rarer than a Goodra line and a Flutter Mane rarer than a Sandy Shocks.
 */
const WILD_WEIGHT = { common: 1, medium: 1, rare: 1, starter: 0.03, pseudo: 0.02, ub: 0.012, paradox: 0.01 };
function wildWeight(name, badges = 8) {
	const c = classOf(name);
	if (NEVER_WILD.has(c)) return 0;
	// Ordinary lines are already weighed by power against badges; the usage
	// step is for the classes the RP made rare on purpose.
	const usage = HEADLINERS.has(c) ? usageOf(name) : 0;
	const short = Math.max(0, BADGE_HOME[c] - (Number(badges) || 0));
	return WILD_WEIGHT[c] * Math.pow(0.85, usage) * Math.pow(0.25, short);
}

module.exports = {
	STARTERS, PSEUDOS, PSEUDO_LINES, isPseudoLine, PARADOXES, CLASSES, RANK, NEVER_WILD, HEADLINERS, BADGE_HOME, WILD_WEIGHT, RARE_FROM, MEDIUM_FROM,
	tierValue, classOf, usageOf, score, compare, wildWeight,
};
