'use strict';
/**
 * What strong players do, in the situation the bot is in right now.
 *
 * data/playbook.json is 11,839 real games from the top of the replay site,
 * reduced to counts: of every turn where the player was at low HP and the
 * opponent had just switched something in, what fraction moved, switched or
 * pivoted. scripts/learn-playbook.js builds it; this reads it.
 *
 * ## What it is for, and what it is not
 *
 * The bot decides whether to switch by comparing two numbers - how good this
 * turn looks staying in, how good it looks leaving - and switching if the
 * difference beats a margin. That margin is the only thing standing between
 * "never switches" and "switches every turn", and it was a hand-set constant
 * per difficulty: 25 for Champion, 55 for Normal. Nobody measured those. They
 * are the shape of the bot's whole game and they were guesses.
 *
 * This replaces the guess with a measurement, and *only* that. It does not pick
 * moves, it does not pick targets, it does not know anything about the Pokemon
 * involved - it knows that in this kind of position, people who are good leave
 * about this often, and it moves the margin until the bot leaves about that
 * often too. Everything about *which* switch to make is still the bot's own
 * judgement, which is the part it is already decent at.
 *
 * ## Why a margin rather than a policy
 *
 * The honest alternative - "switch with probability p" - throws away the bot's
 * evaluation entirely and plays a slot machine. A margin keeps the reasoning
 * and changes only the threshold, so a switch still has to be *justified*; the
 * playbook decides how much justification is enough. A player who switches 35%
 * of the time is not switching at random 35% of the time.
 */

const fs = require('fs');
const path = require('path');

const FILE = process.env.PS_PLAYBOOK || path.join(__dirname, '..', 'data', 'playbook.json');

/**
 * Which mined pool speaks for which format.
 *
 * The RP tiers are National Dex with our changes on top, so National Dex play
 * is their play. Random Battle is deliberately its own pool and never falls
 * back to a team format: with no team preview it is a different game, and the
 * numbers say so - 0.77 double switches a game against National Dex's 6.03.
 */
const POOLS = [
	[/randombattle|randomdoubles|battlefactory|challengecup/, 'gen9randombattle'],
	[/^gen9(rp)?(nationaldex)?(ag|ubers)/, 'gen9nationaldexubers'],
	[/^gen9rpbattle|^gen9customgame/, 'gen9nationaldex'],
	[/^gen9rp/, 'gen9nationaldex'],
	[/nationaldex/, 'gen9nationaldex'],
	[/^gen9doubles|vgc/, 'gen9doublesou'],
	[/^gen8/, 'gen8ou'],
	[/^gen7/, 'gen7ou'],
	[/^gen6/, 'gen6ou'],
	[/^gen5/, 'gen5ou'],
	[/^gen4/, 'gen4ou'],
	[/^gen3/, 'gen3ou'],
];

let cached = null;

function load() {
	if (cached) return cached;
	try {
		cached = JSON.parse(fs.readFileSync(FILE, 'utf8'));
	} catch (e) {
		// No playbook is a perfectly good state: the bot plays as it always did.
		cached = { pools: {} };
	}
	return cached;
}

function poolFor(formatId) {
	const id = String(formatId || '').toLowerCase();
	const book = load();
	for (const [pattern, name] of POOLS) {
		if (pattern.test(id) && book.pools[name]) return book.pools[name];
	}
	return book.pools.gen9ou || null;
}

/**
 * How often a good player leaves, in this position.
 *
 * Starts from how often they leave at all, then adjusts for each thing we know
 * about the position, multiplicatively: if switching is 1.4x as common when the
 * opponent has just brought something in, that is a 1.4x on the base rate. It
 * is the naive-Bayes assumption - that the conditions are independent - which
 * is not true and is close enough for a threshold, given each condition is
 * measured over tens of thousands of turns.
 *
 * `pivot` counts as leaving. U-turn is a switch that happens to hit something
 * on the way out, and a bot that treats it as staying in will hold a pivot move
 * it never uses.
 */
function switchRate(formatId, situation) {
	const pool = poolFor(formatId);
	if (!pool || !pool.share) return null;

	const leaving = row => ((row && row.switch) || 0) + ((row && row.pivot) || 0);
	const base = leaving(pool.share);
	if (!base) return null;

	let rate = base;
	const adjust = (table, key) => {
		if (!table || !table[key] || !table[key].n || table[key].n < 200) return;
		const here = leaving(table[key]);
		if (!here) return;
		rate *= here / base;
	};

	if (situation.foeJustCameIn) adjust(pool.whenFoeJustCameIn, 'foe just came in');
	else adjust(pool.whenFoeJustCameIn, 'foe stayed in');
	if (situation.justCameIn) adjust(pool.whenJustCameIn, 'we just came in');
	if (situation.hp) adjust(pool.byOwnHp, situation.hp);
	if (situation.foeHp) adjust(pool.byFoeHp, situation.foeHp);
	if (situation.turn === 1) adjust(pool.firstTurn, 'turn 1');

	// Percentages, and never the extremes: a rate of 0 would mean "never leave,
	// whatever the position" and 100 would mean the opposite, and neither is
	// something the counts can support.
	return Math.max(5, Math.min(70, rate));
}

/**
 * The margin, adjusted by what people actually do here.
 *
 * The configured margin is the bot's own idea of how much better the bench has
 * to look. Where the playbook says this is a leaving position, the bar comes
 * down; where it says people stay in, it goes up. Bounded hard in both
 * directions: this is a nudge to a number that was already roughly right, not a
 * replacement for it, and a playbook that said something absurd should not be
 * able to turn the bot into something absurd.
 *
 * The reference rate is the same pool's overall rate, so this only ever reacts
 * to the *situation* being unusual - not to one format being switchier than
 * another, which the margin per difficulty already accounts for.
 */
function adjustSwitchMargin(formatId, situation, margin) {
	const pool = poolFor(formatId);
	const rate = switchRate(formatId, situation);
	if (!pool || !pool.share || rate === null) return margin;

	const base = (pool.share.switch || 0) + (pool.share.pivot || 0);
	if (!base) return margin;

	// More leaving than usual here -> a lower bar, and the other way round.
	const ratio = rate / base;
	const scaled = margin / Math.max(0.5, Math.min(2, ratio));
	return Math.max(margin * 0.45, Math.min(margin * 2.2, scaled));
}

/** What the playbook has to say, for the boot log and for tests. */
function describe(formatId) {
	const pool = poolFor(formatId);
	if (!pool) return 'no playbook';
	const leaving = Math.round(((pool.share.switch || 0) + (pool.share.pivot || 0)) * 10) / 10;
	return `${pool.replays} replays, ${pool.decisions} decisions, leaves ${leaving}% of turns`;
}

module.exports = { switchRate, adjustSwitchMargin, describe, poolFor };
