'use strict';
/**
 * Everything this server adds to the game, and how it gets in.
 *
 * Showdown loads its dex from compiled files inside its own package, and offers
 * no hook for adding a species to them. A mod would be the tidy answer, except
 * that a Pokemon inside a mod does not exist anywhere else *at all* - she would
 * not be searchable, would not appear in the builder, and could not be looked
 * up. What was wanted is the opposite: findable everywhere, legal almost
 * nowhere, which is how Showdown already treats MissingNo.
 *
 * So the data goes into the base dex and is marked `isNonstandard: 'Custom'`
 * with `tier: 'Illegal'`. Every format that enforces legality refuses her on
 * those grounds; Custom Game enforces none and lets her in.
 *
 * Each function here is handed the live data object from the corresponding file
 * in the package and adds to it. scripts/setup-config.js appends a single line
 * to each of those files calling the matching one, so the package's own contents
 * are never rewritten - only extended, on every boot, and harmlessly again if
 * the package is reinstalled.
 */

const { Pokedex } = require('./pokedex.js');
const { Abilities, patchAbilities } = require('./abilities.js');
const { Moves, patchMoves } = require('./moves.js');
const { FormatsData } = require('./formats-data.js');
const { Learnsets } = require('./learnsets.js');
const { patchItems } = require('./items.js');
const { applyBuffs } = require('./buffs.js');
const { applyZaMegas, applyZaStones } = require('./za-megas.js');
const { applyTiers } = require('./tiering.js');
const { unnerfMoves, unnerfAbilities, unnerfSpecies } = require('./unnerfs.js');
const { applyPartners } = require('./partners.js');

// The buffed Pokemon are Showdown's own, so they are changed in place rather
// than added - and the learnsets they need are added when that file is loaded,
// which is a separate hook. Both sides pass the same table, so whichever loads
// second finds the other's work already done.
let buffedPokedex = null;
let buffedLearnsets = null;
let tierTable = null;
function buffWhatWeHave() {
	if (buffedPokedex && buffedLearnsets) applyBuffs(buffedPokedex, buffedLearnsets);
	// The Z-A Megas need the stats from one file and the tiers from another, so
	// like the buffs they wait until both have been through here.
	if (buffedPokedex && tierTable) {
		applyZaMegas(buffedPokedex, tierTable);
		// Last, so a deliberate decision beats a derived one.
		applyTiers(tierTable, buffedPokedex, msg => console.log('[velvet] ' + msg));
	}
	// Partner Pikachu and Eevee copy the base line's movepool, buffs included, so
	// they wait for all three tables.
	if (buffedPokedex && buffedLearnsets && tierTable) applyPartners(buffedPokedex, buffedLearnsets, tierTable);
}

exports.pokedex = data => {
	Object.assign(data, Pokedex);
	unnerfSpecies(data);
	buffedPokedex = data;
	buffWhatWeHave();
};
exports.abilities = data => require('./balance-patch-1.js').patchAbsorbers(patchAbilities(unnerfAbilities(Object.assign(data, Abilities))));
let moveTable = null;
exports.moves = data => {
	moveTable = patchMoves(unnerfMoves(Object.assign(data, Moves)));
	teachHerEverything();
	return moveTable;
};
exports.formatsData = data => {
	Object.assign(data, FormatsData);
	tierTable = data;
	buffWhatWeHave();
};
exports.learnsets = data => {
	Object.assign(data, Learnsets);
	buffedLearnsets = data;
	teachHerEverything();
	buffWhatWeHave();
};

/**
 * Samantha learns everything - worked out here rather than written down.
 *
 * Her learnset used to be a generated list of 843 moves, and the trouble with a
 * generated list is that it is only true on the day it is generated. Five moves
 * added to this server since - Wave Charge, the three Rush moves and Queen's
 * Blitz - were all missing from it, so "she learns everything" had quietly
 * stopped being true and nobody would have noticed until somebody tried to put
 * one on her.
 *
 * Built from the move table the server is actually running instead, with the
 * same filter the generator used: no Z-moves, no Max moves, nothing
 * nonstandard except the past-generation moves National Dex brings back.
 *
 * Runs whenever either table lands, since the two data files load in whichever
 * order the package feels like.
 */
function teachHerEverything() {
	if (!moveTable || !buffedLearnsets) return;
	const entry = buffedLearnsets.samantha || (buffedLearnsets.samantha = { learnset: {} });
	entry.learnset = entry.learnset || {};
	for (const [id, move] of Object.entries(moveTable)) {
		if (move.isZ || move.isMax) continue;
		if (move.isNonstandard && move.isNonstandard !== 'Past') continue;
		if (!entry.learnset[id]) entry.learnset[id] = ['9M'];
	}
}

// Items is the odd one out: Light Ball already exists and only two of its
// handlers change, so replacing the whole entry would mean copying its number,
// its Fling and its sprite across and keeping them in step forever.
exports.items = data => {
	patchItems(data);
	// The Z-A Mega stones, which are their own data file and their own refusal:
	// National Dex reads an item's nonstandard flag directly, so a stone left
	// marked 'Future' is refused however legal the Mega holding it is.
	applyZaStones(data, msg => console.log('[velvet] ' + msg));
	return data;
};
