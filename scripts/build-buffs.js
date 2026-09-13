'use strict';
/**
 * Ship the buffs to the client.
 *
 *   node scripts/build-buffs.js
 *
 * The client gets its dex from Showdown's CDN, which naturally knows nothing
 * about anything this server adds. That is fine for the battle itself - the
 * server is the authority - but the teambuilder is drawn entirely from the
 * client's copy, so a buffed Pokemon shows its old movepool, its old three
 * ability slots, and no sign that an Elemental Banana exists.
 *
 * So the same trick as the signature moves: work it out here, once, against the
 * dex the server actually runs, and write it out as a file the page loads. That
 * keeps one source of truth - data/velvet - and means a description written on
 * the server is the description shown in the builder, without anyone copying it
 * across by hand.
 *
 * What goes in:
 *   - what each buff really added, move by move and ability by ability (the
 *     server records this as it applies them, so moves the Pokemon already had
 *     are not announced as new)
 *   - client-shaped entries for the moves, abilities and items we invented,
 *     since the CDN has no row for any of them
 *   - the search-index rows that make all of it findable by typing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGE = path.join(ROOT, 'node_modules', 'pokemon-showdown');
const OUT = path.join(ROOT, 'client', 'js', 'velvet-buffs.js');

// Loading the dex is what runs our hooks, which is what fills in `applied`.
const { Dex } = require(path.join(PACKAGE, 'dist', 'sim', 'dex.js'));
Dex.species.get('simisage');
const { applied, Buffs } = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'buffs.js'));

/**
 * The name these sections go under, in the builder.
 *
 * One word, used for both lists - "Awakened moves" and "Awakened abilities" -
 * so they read as two halves of the same idea rather than two features. Change
 * it here and both move together.
 */
const LABEL = 'Awakened';

/** Everything we invented, as opposed to everything we changed. */
const OUR_MOVES = ['simianrush', 'wavecharge'];
const OUR_ABILITIES = ['verdantsurge'];
const OUR_ITEMS = ['elementalbanana'];

/**
 * Where each character of an id sits in the display name.
 *
 * The search index keeps one of these strings per row so a match can be
 * highlighted in the name the player sees: '0' means the character is where it
 * is in the id, and each step up counts one more skipped character before it -
 * the space in "Simian Rush", the apostrophe and space in "Queen's Dance".
 */
function offsetsFor(name) {
	let offset = 0;
	let out = '';
	for (const char of name) {
		if (/[a-z0-9]/i.test(char)) out += String(Math.min(offset, 9));
		else offset++;
	}
	return out;
}

/** Only the fields the client reads, so the file stays small and honest. */
function moveRow(move) {
	return {
		num: move.num, name: move.name, type: move.type, category: move.category,
		basePower: move.basePower, accuracy: move.accuracy, pp: move.pp,
		priority: move.priority, target: move.target, flags: move.flags,
		secondary: move.secondary || null,
		shortDesc: move.shortDesc, desc: move.desc,
	};
}

function abilityRow(ability) {
	return { num: ability.num, name: ability.name, rating: ability.rating, shortDesc: ability.shortDesc, desc: ability.desc };
}

function itemRow(item) {
	return {
		num: item.num, name: item.name, spritenum: item.spritenum,
		itemUser: item.itemUser, fling: item.fling || undefined,
		gen: item.gen, shortDesc: item.shortDesc, desc: item.desc,
	};
}

const moves = {};
for (const id of OUR_MOVES) moves[id] = moveRow(Dex.moves.get(id));
const abilities = {};
for (const id of OUR_ABILITIES) abilities[id] = abilityRow(Dex.abilities.get(id));
const items = {};
for (const id of OUR_ITEMS) items[id] = itemRow(Dex.items.get(id));

// One row per thing that has to be findable by typing.
const search = [];
for (const [id, row] of Object.entries(moves)) search.push([id, 'move', offsetsFor(row.name)]);
for (const [id, row] of Object.entries(abilities)) search.push([id, 'ability', offsetsFor(row.name)]);
for (const [id, row] of Object.entries(items)) search.push([id, 'item', offsetsFor(row.name)]);

// The abilities a buff added, by name, plus every slot the species already had:
// the client reads abilities off its own dex entry, which still has three.
const bySpecies = {};
for (const [id, record] of Object.entries(applied)) {
	const species = Dex.species.get(id);
	bySpecies[id] = {
		moves: record.moves.slice(),
		// The names a buff added, and the whole slot table it produced. Both are
		// needed: the names say what to label as ours, and the table is what the
		// client's own dex entry has to be replaced with before the builder will
		// offer any of them. Slots past 0/1/H/S are ours - a species is only
		// built for four - and the client lists those itself.
		abilities: record.abilities.slice(),
		slots: Object.assign({}, species.abilities),
	};
}

const file = `/**
 * The buffs, for the client.
 *
 * Generated by scripts/build-buffs.js from data/velvet - do not edit by hand.
 * Regenerate it whenever a buff changes, or the builder will quietly go on
 * showing the old movepool.
 *
 * \`bySpecies\` is what each Pokemon gained and the full ability list it should
 * now have; the three tables after it are the moves, abilities and items this
 * server invented, which no CDN file has a row for.
 */
window.VelvetBuffs = {
\tlabel: ${JSON.stringify(LABEL)},
\tbySpecies: ${JSON.stringify(bySpecies, null, '\t').replace(/\n/g, '\n\t')},
\tmoves: ${JSON.stringify(moves)},
\tabilities: ${JSON.stringify(abilities)},
\titems: ${JSON.stringify(items)},
\tsearch: ${JSON.stringify(search)},

\t/** What this Pokemon gained, or an empty record. */
\tget: function (speciesid) {
\t\treturn this.bySpecies[speciesid] || null;
\t},
};
`;

fs.writeFileSync(OUT, file);

console.log(`${Object.keys(bySpecies).length} buffed Pokemon, ${Object.keys(moves).length} moves, ` +
	`${Object.keys(abilities).length} abilities, ${Object.keys(items).length} items`);
console.log(`${Math.round(file.length / 1024)}KB -> ${OUT}`);
for (const [id, record] of Object.entries(bySpecies)) {
	console.log(`  ${Dex.species.get(id).name}: +${record.moves.length} moves, abilities now ${Object.entries(record.slots).map(([slot, name]) => `${slot}:${name}`).join(' / ')}`);
}
for (const [id, type, offsets] of search) {
	console.log(`  searchable: ${id} (${type}) ${offsets}`);
}
if (Object.keys(Buffs).length !== Object.keys(bySpecies).length) {
	throw new Error('a buffed Pokemon did not make it into the table');
}
