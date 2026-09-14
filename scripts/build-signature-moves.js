'use strict';
/**
 * Work out every Pokemon's signature moves, once, so the client can show them.
 *
 *   node scripts/build-signature-moves.js
 *
 * A signature move is one that exactly one evolution family can learn: Ivy
 * Cudgel is Ogerpon's, Kowtow Cleave is Bisharp's line, Blast Burn is nobody's
 * because every Fire starter gets it.
 *
 * "Family" is the point of care here. Charizard and Charmander are the same
 * family, so a move the whole line learns is still signature; Ogerpon's four
 * masks are the same Pokemon wearing different hats; and a move two unrelated
 * Pokemon share is not a signature move at all, however thematic.
 *
 * Doing this in the browser would mean walking every learnset in the dex on
 * every page load, so it is done here and shipped as a table - which also
 * means it can be checked, and regenerated when the dex changes.
 */

const fs = require('fs');
const path = require('path');

const { Dex } = require(require.resolve('pokemon-showdown/dist/sim/dex.js'));
const OUT = path.join(__dirname, '..', 'client', 'js', 'velvet-signatures.js');

/** The root of an evolution family, which is what "belongs to" means here. */
function familyOf(species) {
	let current = species;
	// Cosmetic and battle formes first: Ogerpon-Wellspring is Ogerpon.
	if (current.baseSpecies && current.baseSpecies !== current.name) {
		current = Dex.species.get(current.baseSpecies);
	}
	const seen = new Set();
	while (current.prevo && !seen.has(current.id)) {
		seen.add(current.id);
		const prevo = Dex.species.get(current.prevo);
		if (!prevo.exists) break;
		current = prevo.baseSpecies && prevo.baseSpecies !== prevo.name ?
			Dex.species.get(prevo.baseSpecies) : prevo;
	}
	return current.id;
}

/**
 * Every move a species can learn, and which generations it learns each one in.
 *
 * `all` is everything. `gens` skips the moves it can only get from a one-off
 * event distribution - those sources are written `<gen>S<n>` - while still
 * leaving them in `all`.
 *
 * That distinction is the whole difference between this table and a wrong one.
 * Roar of Time is Dialga's move, but the Gen 4 event Darkrai and the event
 * Arceus were each handed it once, so counting raw learnsets gives it three
 * owners and drops it off the list - and with it Spacial Rend, Shadow Force and
 * a long tail of legendary signatures. Bulbapedia does not count those
 * distributions either, and neither does anybody describing the move.
 */
function movesOf(species) {
	const data = Dex.species.getLearnsetData(species.id);
	if (!data || !data.learnset) return { all: [], gens: new Map() };
	const all = Object.keys(data.learnset);
	const gens = new Map();
	for (const moveid of all) {
		const learned = data.learnset[moveid]
			.filter(source => source.charAt(1) !== 'S')
			.map(source => parseInt(source.charAt(0), 10))
			.filter(gen => gen >= 1);
		if (learned.length) gens.set(moveid, learned);
	}
	return { all, gens };
}

function build() {
	const familyMoves = new Map();     // family id -> Set of move ids it can get at all
	const everyOwner = new Map();      // move id -> Set of families, events included
	const genOwners = new Map();       // move id -> gen -> Set of families

	for (const species of Dex.species.all()) {
		// CAP Pokemon are not real, and our own are worse than that: Samantha
		// learns every move in the game, so counting her as an owner made every
		// move in the dex shared and left the whole table with three entries.
		if (species.isNonstandard === 'CAP' || species.isNonstandard === 'Custom') continue;
		const family = familyOf(species);
		const { all, gens } = movesOf(species);
		for (const moveid of all) {
			if (!familyMoves.has(family)) familyMoves.set(family, new Set());
			familyMoves.get(family).add(moveid);
			if (!everyOwner.has(moveid)) everyOwner.set(moveid, new Set());
			everyOwner.get(moveid).add(family);
		}
		for (const [moveid, learned] of gens) {
			if (!genOwners.has(moveid)) genOwners.set(moveid, new Map());
			const byGen = genOwners.get(moveid);
			for (const gen of learned) {
				if (!byGen.has(gen)) byGen.set(gen, new Set());
				byGen.get(gen).add(family);
			}
		}
	}

	/**
	 * Who owns a move, judged in the most recent generation that still has it.
	 *
	 * This is the line between a useful table and a wrong one, and counting
	 * every generation at once gets it wrong in both directions.
	 *
	 * Pay Day was a Generation 1 TM that twenty-one families learned, and is now
	 * a move only Meowth's line gets. Everybody calls it Meowth's move; a table
	 * that is still counting 1996 says it belongs to nobody. Water Shuriken is
	 * the same story with Accelgor, who did not make it into Scarlet and Violet.
	 *
	 * Judging by the current generation alone breaks the opposite case:
	 * Bonemerang has had exactly one owner since Generation 1, but Cubone is not
	 * in Scarlet and Violet either, so "who learns it in Generation 9" is nobody
	 * and Marowak loses a move that has never belonged to anyone else.
	 *
	 * So: find the newest generation in which anybody properly learns the move,
	 * and ask who learns it there. Pay Day resolves in Generation 9 to Meowth
	 * and Bonemerang in Generation 8 to Cubone.
	 *
	 * And when that is still more than one family, whoever had it first keeps
	 * it - as long as it did not spread far. Sacred Fire is Ho-Oh's move: it was
	 * his alone from Generation 3, and Entei being handed it in Generation 6
	 * makes it neither Entei's nor nobody's.
	 *
	 * The limit is what stops that swallowing the whole dex. Without it the same
	 * argument hands Charmander Blast Burn - true, it was his in Generation 3 -
	 * along with Super Fang, Weather Ball and every other move introduced for one
	 * Pokemon and later given to forty. A move one other family was let in on is
	 * still that Pokemon's; a move nine families know is a move, and the line
	 * between those two is the only judgement call in this file.
	 */
	const SHARED_LIMIT = 2;

	function ownersOf(moveid) {
		const byGen = genOwners.get(moveid);
		// Only ever handed out at an event: still that Pokemon's move.
		if (!byGen || !byGen.size) return everyOwner.get(moveid) || new Set();

		const newest = byGen.get(Math.max(...byGen.keys()));
		if (newest.size === 1) return newest;
		if (newest.size > SHARED_LIMIT) return newest;

		// Shared with one other. The family it started with keeps it.
		const first = byGen.get(Math.min(...byGen.keys()));
		return first.size === 1 ? first : newest;
	}

	const signatures = {};
	for (const [family, moves] of familyMoves) {
		const own = [...moves]
			.filter(moveid => {
				const owners = ownersOf(moveid);
				return owners.size === 1 && owners.has(family);
			})
			// Z-moves and Max moves are not moves anyone chooses in the builder,
			// and a move marked `velvetShared` is one of ours meant to be handed
			// out later - being new is not the same as being somebody's.
			.filter(moveid => {
				const move = Dex.moves.get(moveid);
				return move.exists && !move.isZ && !move.isMax && !move.velvetShared;
			})
			.sort((a, b) => Dex.moves.get(a).name.localeCompare(Dex.moves.get(b).name));
		if (own.length) signatures[family] = own;
	}

	// Every member of a family answers for the family: the builder asks about
	// the Pokemon in front of it, which is usually not the first stage.
	const bySpecies = {};
	for (const species of Dex.species.all()) {
		if (species.isNonstandard === 'CAP' || species.isNonstandard === 'Custom') continue;
		const own = signatures[familyOf(species)];
		if (own) bySpecies[species.id] = own;
	}

	return { signatures, bySpecies };
}

const { signatures, bySpecies } = build();

// Families share their lists, so the file stores each list once and points at
// it - the difference between 40KB and 200KB, for something every page loads.
const lists = [];
const index = new Map();
const pointers = {};
for (const [id, moves] of Object.entries(bySpecies)) {
	const key = moves.join(',');
	if (!index.has(key)) {
		index.set(key, lists.length);
		lists.push(moves);
	}
	pointers[id] = index.get(key);
}

const file = `/**
 * Signature moves, by Pokemon: the moves only that family can learn.
 *
 * Generated by scripts/build-signature-moves.js from the dex the server runs -
 * do not edit by hand. The client shows them in their own section at the top of
 * the move list, the way Samantha's three are shown.
 *
 * Stored as a list of move lists plus a pointer per Pokemon, because a family
 * shares one list and there are a lot of families.
 */
window.VelvetSignatureMoves = {
\tlists: ${JSON.stringify(lists)},
\tbySpecies: ${JSON.stringify(pointers)},

\t/** The signature moves of one Pokemon, or an empty list. */
\tget: function (speciesid) {
\t\tvar at = this.bySpecies[speciesid];
\t\treturn at === undefined ? [] : this.lists[at];
\t},
};
`;

fs.writeFileSync(OUT, file);

const families = Object.keys(signatures).length;
const species = Object.keys(bySpecies).length;
console.log(`${families} families with signature moves, covering ${species} Pokemon`);
console.log(`${lists.length} distinct lists, ${Math.round(file.length / 1024)}KB -> ${OUT}`);
for (const sample of ['persian', 'meowth', 'greninja', 'marowak', 'ogerpon', 'dialga', 'hooh', 'metagross', 'kingambit']) {
	const own = bySpecies[sample];
	console.log(`  ${sample}: ${own ? own.map(m => Dex.moves.get(m).name).join(', ') : '(none)'}`);
}
