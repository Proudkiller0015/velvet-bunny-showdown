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

/**
 * Everything we invented, as opposed to everything we changed.
 *
 * The abilities are worked out rather than listed: anything a buff hands out
 * with a negative number is ours, because that is how this project numbers what
 * Showdown has no row for. Listing them by hand is how Solar Surge and Tidal
 * Surge shipped to the server and not to the client, leaving two of the three
 * monkeys with an ability the builder could not draw.
 */
const OUR_ITEMS = ['elementalbanana'];
const OUR_MOVES = [];
const OUR_ABILITIES = [];
for (const buff of Object.values(Buffs)) {
	for (const name of buff.moves || []) {
		const move = Dex.moves.get(name);
		if (move.exists && move.num < 0 && !OUR_MOVES.includes(move.id)) OUR_MOVES.push(move.id);
	}
	for (const name of buff.abilities || []) {
		const ability = Dex.abilities.get(name);
		if (ability.exists && ability.num < 0 && !OUR_ABILITIES.includes(ability.id)) OUR_ABILITIES.push(ability.id);
	}
}

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

/*
 * Everything this server changed about a move or ability that already existed.
 *
 * Not the same as the tables above, which are things no client has ever heard
 * of. These are rows the client already has, and has wrong: Dark Void at 50%
 * accuracy, Recover at 5 PP, Protean described as once per switch-in. A number
 * a player reads and a number the game uses have to be the same number.
 *
 * The values come straight off the patched dex, so this cannot drift from what
 * the server actually does.
 */
const { CHANGED } = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'unnerfs.js'));
const overrides = { moves: {}, abilities: {} };
for (const id of CHANGED.moves) overrides.moves[id] = moveRow(Dex.moves.get(id));
for (const id of CHANGED.abilities) overrides.abilities[id] = abilityRow(Dex.abilities.get(id));
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
	const entry = { moves: record.moves.slice(), abilities: record.abilities.slice() };
	/*
	 * The slot table only ships when a buff actually changed the abilities.
	 *
	 * It is what the client's own dex entry has to be replaced with before the
	 * builder will offer a new ability - including any slot past 0/1/H/S, which
	 * is how a Pokemon ends up with more than three. But most buffed Pokemon
	 * now are Water-types that were handed one move and had their abilities left
	 * alone, and emitting an unchanged copy of Squirtle's abilities for each of
	 * them took this file from 7KB to 34KB - on a page that loads it every time.
	 */
	if (record.abilities.length) entry.slots = Object.assign({}, species.abilities);
	bySpecies[id] = entry;
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
\toverrides: ${JSON.stringify(overrides)},

\t/** What this Pokemon gained, or an empty record. */
\tget: function (speciesid) {
\t\treturn this.bySpecies[speciesid] || null;
\t},
};
`;

fs.writeFileSync(OUT, file);

console.log(`${Object.keys(bySpecies).length} buffed Pokemon, ${Object.keys(moves).length} moves, ` +
	`${Object.keys(abilities).length} abilities, ${Object.keys(items).length} items, ` +
	`${Object.keys(overrides.moves).length + Object.keys(overrides.abilities).length} corrected rows`);
console.log(`${Math.round(file.length / 1024)}KB -> ${OUT}`);
for (const [id, record] of Object.entries(bySpecies)) {
	console.log(`  ${Dex.species.get(id).name}: +${record.moves.length} move(s)` +
		(record.slots ? `, abilities now ${Object.entries(record.slots).map(([slot, name]) => `${slot}:${name}`).join(' / ')}` : ''));
}
for (const [id, type, offsets] of search) {
	console.log(`  searchable: ${id} (${type}) ${offsets}`);
}
if (Object.keys(Buffs).length !== Object.keys(bySpecies).length) {
	throw new Error('a buffed Pokemon did not make it into the table');
}
