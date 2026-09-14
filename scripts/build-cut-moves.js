'use strict';
/**
 * The TMs a Pokemon would have got if it had been in the game.
 *
 *   node scripts/build-cut-moves.js
 *
 * Four hundred and fifty-four Pokemon are marked `isNonstandard: 'Past'` in the
 * ninth generation - they exist in National Dex and were cut from Sword and
 * Shield or Scarlet and Violet. Being cut is not only about being absent. Every
 * TM those two generations introduced was handed out to the Pokemon that were
 * standing there, and a Pokemon that was not standing there got none of them,
 * for no reason that has anything to do with the Pokemon.
 *
 * Tera Blast is the case that makes it plain. Seven hundred and twenty-seven of
 * the seven hundred and thirty-three Pokemon in Scarlet and Violet learn it;
 * six do not, and they are Ditto, Smeargle, Magikarp, Cosmog, Cosmoem and
 * Terapagos. It is not a distribution, it is a default. RP hands
 * Terastallization back to every tier, so on this server a cut Pokemon can
 * Terastallize and then has nothing to do with it - which is the whole of the
 * complaint this file answers.
 *
 * Nothing here is invented. Each grant is measured off what the Pokemon that
 * were present actually got:
 *
 *   1. Only moves that arrived in generation 8 or 9 and are handed out by
 *      machine - TM or TR. A move that is learned by level-up or breeding was
 *      never a question of who was in the game, and an egg move is a different
 *      argument. Twenty species is the floor for calling something distributed.
 *
 *   2. A cut Pokemon gets the move if at least 45% of the Pokemon in Scarlet
 *      and Violet sharing a type with it get it by machine. That is the same
 *      threshold data/velvet/buffs.js uses to decide "everyone of this type got
 *      this but them", and for the same reason: it is a measurement of what the
 *      type received rather than a judgement about what this Pokemon deserves.
 *
 *   3. Nothing for a Pokemon with four or fewer damaging moves of its own. That
 *      line is where Scarlet and Violet drew it too: Magikarp has four and does
 *      not get Tera Blast, Scatterbug has five and does, and the Pokemon below
 *      the line are Ditto, the cocoons, Unown and Wobbuffet - Pokemon whose
 *      whole identity is not having an attack.
 *
 * The result is a table, not a patch to the dex. RP is the only place it is
 * read - see levelFreeMoves in config/custom-formats.js - because this is a
 * decision about this server's own tiers and not about National Dex.
 */

const fs = require('fs');
const path = require('path');

const PACKAGE = path.dirname(require.resolve('pokemon-showdown/package.json'));
const { Dex } = require(PACKAGE);
const OUT = path.join(__dirname, '..', 'data', 'velvet', 'cut-moves.json');

/** Machine-distributed in the generation that introduced it. */
const BY_MACHINE = /^[89]M$/;
/** What counts as distributed at all. */
const FLOOR = 20;
/** What counts as "this type got it". Shared with data/velvet/buffs.js. */
const SHARE = 0.45;
/** Below this many damaging moves, a Pokemon is a gimmick rather than an attacker. */
const ATTACKS = 5;

const Learnsets = Dex.data.Learnsets;
const learnsetOf = id => (Learnsets[id] && Learnsets[id].learnset) || {};
const isBaseForme = species => species.name === species.baseSpecies;

function byMachine(id, move) {
	const sources = learnsetOf(id)[move];
	return !!(sources && sources.some(source => BY_MACHINE.test(source.slice(0, 2))));
}

/**
 * Does it already have this, counting what it learned as a baby?
 *
 * A learnset lists only what that stage learns itself and the validator walks
 * the chain for the rest, so asking the species alone reports "no" for half the
 * moves it can actually use.
 */
function alreadyLearns(species, move) {
	let at = species;
	for (let i = 0; i < 5 && at && at.exists; i++) {
		if (learnsetOf(at.id)[move]) return true;
		if (!at.prevo) return false;
		at = Dex.species.get(at.prevo);
	}
	return false;
}

function damagingMoves(id) {
	return Object.keys(learnsetOf(id)).filter(move => {
		const data = Dex.moves.get(move);
		return data.category !== 'Status' && data.basePower > 0;
	}).length;
}

const present = [];
const cut = [];
for (const species of Dex.species.all()) {
	if (!species.exists || species.num <= 0 || !isBaseForme(species)) continue;
	// 'Past' is cut; CAP, 'Future' and this server's own additions are neither
	// cut nor a cohort to measure against.
	if (species.isNonstandard && species.isNonstandard !== 'Past') continue;
	(species.isNonstandard === 'Past' ? cut : present).push(species);
}

// What each type received, measured over the Pokemon that were there to receive it.
const cohort = {};
for (const species of present) {
	for (const type of species.types) (cohort[type] || (cohort[type] = [])).push(species);
}

const candidates = [];
for (const move of Dex.moves.all()) {
	if (move.gen < 8 || move.isNonstandard) continue;
	const got = present.filter(species => byMachine(species.id, move.id)).length;
	if (got >= FLOOR) candidates.push(move);
}
candidates.sort((a, b) => a.id.localeCompare(b.id));

/** The share of a type that got this move by machine. */
const share = {};
for (const move of candidates) {
	share[move.id] = {};
	for (const [type, members] of Object.entries(cohort)) {
		const got = members.filter(species => byMachine(species.id, move.id)).length;
		share[move.id][type] = got / members.length;
	}
}

const grants = {};
const skipped = [];
let total = 0;
for (const species of cut) {
	if (damagingMoves(species.id) < ATTACKS) { skipped.push(species.name); continue; }
	const gained = [];
	for (const move of candidates) {
		if (alreadyLearns(species, move.id)) continue;
		const best = Math.max(...species.types.map(type => share[move.id][type] || 0));
		if (best < SHARE) continue;
		gained.push(move.id);
	}
	if (gained.length) {
		grants[species.id] = gained;
		total += gained.length;
	}
}

fs.writeFileSync(OUT, JSON.stringify(grants, null, 0) + '\n');

const counts = {};
for (const gained of Object.values(grants)) {
	for (const move of gained) counts[move] = (counts[move] || 0) + 1;
}
console.log(`${candidates.length} machine moves from generations 8 and 9 considered`);
console.log(`${cut.length} cut Pokemon, ${Object.keys(grants).length} given something, ${total} grants in all`);
console.log(`${skipped.length} left alone for having fewer than ${ATTACKS} damaging moves: ${skipped.join(', ')}`);
console.log(`${Math.round(fs.statSync(OUT).size / 1024)}KB -> ${OUT}`);
for (const [move, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${Dex.moves.get(move).name.padEnd(20)} ${String(n).padStart(4)}`);
}
