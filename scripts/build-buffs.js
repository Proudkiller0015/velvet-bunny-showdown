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
// Halloween 2026 (data/velvet/halloween.js) adds a stone, a move and an ability of its own.
const OUR_ITEMS = ['elementalbanana', 'brokenpact', 'banettitehalloween'];
const OUR_MOVES = ['witchssnatch'];
const OUR_ABILITIES = ['witchinghour'];
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
const { TIERS } = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'tiering.js'));
const za = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'za-megas.js'));

/*
 * Tiers the client has wrong, and things it still thinks do not exist.
 *
 * The Z-A Megas are the case that made this necessary: the server gave all 49
 * of them real tiers and cleared the 'Future' flag off them and their stones,
 * and the client - which builds its dex from Showdown's CDN - went on marking
 * Mega Chandelure illegal and refusing the Chandelurite. The team validated and
 * the builder said no, which is the worst way round.
 *
 * A deliberate decision in tiering.js wins over a derived one, so it goes last.
 */
/*
 * Tiers, minus the Mega formes.
 *
 * A Mega is never picked directly in the builder - you pick the base form and
 * give it the stone - and Showdown labels every Mega forme 'Illegal' in the
 * client so that it stays out of the pickable list. Shipping a real tier for
 * ours put them in it, which is exactly the "these behave differently from
 * other Megas" complaint: Chandelure-Mega read Uber where Charizard-Mega-X
 * read Illegal.
 *
 * The real tier still matters, and still applies - on the server, where the
 * team is validated. The client only needs to know the base form's.
 */
/*
 * Two tier tables, because a Mega's tier means different things in the two
 * places the builder might read it.
 *
 * In a plain ninth-generation format there is no Mega Evolution at all, and
 * Showdown marks every Mega forme Illegal there - correctly. Shipping our tiers
 * into that table made ours the only Megas in the game that read as legal,
 * which is the "Megas behave differently from other Megas" complaint.
 *
 * Under National Dex they are legal and tiered, and that is the table the RP
 * tiers search against. There, a Mega with no tier reads Illegal for the
 * opposite and equally wrong reason: it is perfectly legal and nobody has said
 * what it is. That is where the Z-A Megas were - a stone the builder offered,
 * attached to a Pokemon the builder called illegal.
 */
/*
 * And a third table, for the same reason one step further out.
 *
 * Shedinja is not in Scarlet and Violet. Its ninth-generation tier is Illegal
 * and that is the true answer there, so this server moving it to Ubers is a
 * decision about National Dex and nothing else - tiering.js leaves the SV tier
 * alone for exactly that reason. Shipping the Uber into the plain SV table
 * would label it Uber in a format it cannot be picked in, which is the same
 * mislabelling the two tables above exist to avoid.
 */
/*
 * And the TMs the cut Pokemon never got offered.
 *
 * Measured by scripts/build-cut-moves.js against what the Pokemon that were in
 * Sword and Shield and Scarlet and Violet actually received, and read on the
 * server by the RP learn check. The builder needs its own copy for the same
 * reason it needs all of this: it builds its dex from Showdown's CDN, where
 * Pidgeot does not learn Tera Blast, so without this the move is legal in RP
 * and cannot be picked - the offer-and-refuse bug with the halves swapped.
 */
let cutMoves = {};
try {
	cutMoves = require(path.join(__dirname, '..', 'data', 'velvet', 'cut-moves.json'));
} catch (e) {
	console.log('no cut-moves.json - run scripts/build-cut-moves.js first');
}

/*
 * And what each of them should say in a learnset, worked out here.
 *
 * The client cannot be asked. Its own move data puts Tera Blast in generation
 * 8 - it derives the generation from the move number and its table stops before
 * the ninth - so a learnset entry built from `Dex.moves.get(id).gen` in the
 * browser comes out '8M', which hides the move in every ninth-generation format
 * and offers it in the eighth, where the validator refuses it. Exactly
 * backwards, and silently.
 *
 * The server's dex is right about this, and this script runs on the server.
 */
const cutMoveSources = {};
for (const list of Object.values(cutMoves)) {
	for (const id of list) {
		/*
		 * Every generation the move has existed for, not just the one it arrived
		 * in. The builder lists a move when the entry mentions the generation
		 * being built for, so a lone '8M' on Dual Wingbeat hides it in the ninth
		 * - where it is a TM, and where the server accepts it. A real entry
		 * carries every source it has, and so does this one.
		 */
		const from = Dex.moves.get(id).gen;
		cutMoveSources[id] = [9, 8].filter(gen => gen >= from).map(gen => `${gen}M`).join('');
	}
}

const isMegaForme = id => Dex.species.get(id).name.includes('-Mega');
const inThisGen = id => Dex.species.get(id).tier !== 'Illegal';
const tiers = {};
const megaTiers = {};
const natdexTiers = {};
// Halloween 2026: the witch Mega Banette is ours, not a Z-A Mega, so it is added by hand.
const halloween = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'halloween.js'));
const OUR_MEGAS = { [require(path.join(PACKAGE, 'dist', 'sim', 'dex.js')).Dex.species.get(halloween.FORME).id]: Dex.species.get(halloween.FORME).tier };
for (const [id, tier] of Object.entries(Object.assign({}, za.assigned, OUR_MEGAS, TIERS))) {
	if (isMegaForme(id)) megaTiers[id] = tier;
	else if (!inThisGen(id)) natdexTiers[id] = tier;
	else tiers[id] = tier;
}
/*
 * The battle-only formes of anything re-tiered, in the National Dex tables too.
 *
 * The CDN tiers a forme on its own, so Terapagos-Terastal read OU in the National
 * Dex builder while this server bans every Terapagos - the label a player sees
 * has to be the server's, forme by forme. The values are the patched dex's own.
 */
for (const id of Object.keys(TIERS)) {
	const species = Dex.species.get(id);
	if (!species.exists || isMegaForme(id)) continue;
	const formes = [species.id, ...(species.otherFormes || []).map(f => Dex.species.get(f)).filter(f => f.exists && f.battleOnly).map(f => f.id)];
	for (const forme of formes) {
		const nd = Dex.species.get(forme).natDexTier;
		if (nd) natdexTiers[forme] = nd;
		if (forme !== species.id && inThisGen(forme)) tiers[forme] = Dex.species.get(forme).tier;
	}
}
const unlocked = {
	species: Object.keys(za.assigned),
	items: za.ZA_STONES.slice(),
};
/*
 * Balance Patch 1's evolution levels, for the builder and the dex lookups: the
 * client's own Pokedex rows still carry Game Freak's numbers.
 */
const { EVOLUTIONS } = require(path.join(PACKAGE, 'dist', 'data', 'velvet', 'balance-patch-1.js'));
const evoLevels = {};
const evoAlso = {};
for (const [id, change] of Object.entries(EVOLUTIONS)) {
	evoLevels[id] = Dex.species.get(id).evoLevel || change.to;
	if (typeof change.from === 'string') evoAlso[id] = change.to;   // a stone evolution that can also happen by level
}

const overrides = { moves: {}, abilities: {}, species: {} };
for (const id of CHANGED.species || []) {
	overrides.species[id] = { baseStats: Object.assign({}, Dex.species.get(id).baseStats), types: Dex.species.get(id).types.slice(), abilities: Object.assign({}, Dex.species.get(id).abilities) };
}
for (const id of CHANGED.moves) overrides.moves[id] = moveRow(Dex.moves.get(id));
for (const id of CHANGED.abilities) overrides.abilities[id] = abilityRow(Dex.abilities.get(id));
const items = {};
for (const id of OUR_ITEMS) items[id] = itemRow(Dex.items.get(id));

/*
 * The "awakened" search term: every Pokemon with one of our signature
 * abilities or that learns one of our signature moves (a negative number
 * without `velvetShared`). "signature" also uses the move half, beside the
 * official signature moves in velvet-signatures.js. Worked out from the dex so a new
 * signature shows up by itself. Samantha and Nuzleaf-SOLD are left out.
 */
const ours = x => x.exists && x.num < 0 && x.isNonstandard !== 'CAP';
const signatureMoves = Dex.moves.all().filter(m => ours(m) && !m.velvetShared).map(m => m.id);
const awakened = { ability: [], move: [] };
for (const s of Dex.species.all()) {
	if (!s.exists || s.isNonstandard === 'Custom' || s.num <= 0) continue;
	if (Object.values(s.abilities || {}).some(a => ours(Dex.abilities.get(a)))) awakened.ability.push(s.id);
	const learnset = Dex.species.getLearnsetData(s.id).learnset || {};
	if (signatureMoves.some(m => learnset[m])) awakened.move.push(s.id);
}

// One row per thing that has to be findable by typing.
const search = [];
// Filed as egg groups: the only filter kind the builder offers that names a set
// of Pokemon rather than a property of one. velvet-data.js answers them.
for (const name of ['Awakened', 'Signature', 'Event']) search.push([name.toLowerCase(), 'egggroup', offsetsFor(name)]);
// Our own Megas as search rows, so typing their name finds them (Samantha's old bug).
for (const id of Object.keys(OUR_MEGAS)) search.push([id, 'pokemon', offsetsFor(Dex.species.get(id).name)]);

// Event Pokemon, for "event" in the search: every event file lists its own.
const EVENT_FILES = ['halloween.js'];
const events = [];
for (const file of EVENT_FILES) {
	const mod = require(path.join(PACKAGE, 'dist', 'data', 'velvet', file));
	for (const id of mod.EVENT_SPECIES || []) if (!events.includes(id)) events.push(id);
}
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
// Halloween 2026: Witch's Snatch is not learned (Poltergeist becomes it on the Mega),
// so nothing is added to the Banette line here; the move still ships for tooltips.

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
\ttiers: ${JSON.stringify(tiers)},
\tmegaTiers: ${JSON.stringify(megaTiers)},
\tnatdexTiers: ${JSON.stringify(natdexTiers)},
\tcutMoves: ${JSON.stringify(cutMoves)},
\tcutMoveSources: ${JSON.stringify(cutMoveSources)},
\tunlocked: ${JSON.stringify(unlocked)},
\tevoLevels: ${JSON.stringify(evoLevels)},
\tevoAlso: ${JSON.stringify(evoAlso)},
\tawakened: ${JSON.stringify(awakened)},
\tevents: ${JSON.stringify(events)},

\t/** What this Pokemon gained, or an empty record. */
\tget: function (speciesid) {
\t\treturn this.bySpecies[speciesid] || null;
\t},
};
`;

fs.writeFileSync(OUT, file);

console.log(`${Object.keys(bySpecies).length} buffed Pokemon, ${Object.keys(moves).length} moves, ` +
	`${Object.keys(abilities).length} abilities, ${Object.keys(items).length} items, ` +
	`${Object.keys(overrides.moves).length + Object.keys(overrides.abilities).length} corrected rows, ` +
	`${Object.keys(tiers).length} re-tiered, ${Object.keys(megaTiers).length} Mega tiers, ` +
	`${Object.keys(natdexTiers).length} National Dex only, ` +
	`${Object.values(cutMoves).reduce((n, list) => n + list.length, 0)} cut-Pokemon TMs, ` +
	`${unlocked.species.length + unlocked.items.length} unlocked`);
console.log(`${Math.round(file.length / 1024)}KB -> ${OUT}`);
for (const [id, record] of Object.entries(bySpecies)) {
	console.log(`  ${Dex.species.get(id).name}: +${record.moves.length} move(s)` +
		(record.slots ? `, abilities now ${Object.entries(record.slots).map(([slot, name]) => `${slot}:${name}`).join(' / ')}` : ''));
}
for (const [id, type, offsets] of search) {
	console.log(`  searchable: ${id} (${type}) ${offsets}`);
}
/*
 * Every Pokemon with a buff of its own has to be in the table.
 *
 * This used to compare counts, which was right when a per-Pokemon buff was the
 * only kind there was. Type-wide distribution broke it - 192 in the table
 * against 7 in `Buffs` - and because the file is written before the check runs,
 * it failed silently for days: the build worked, the output was correct, and
 * the script exited 1 where nobody was looking.
 */
const missing = Object.keys(Buffs).filter(id => !bySpecies[id]);
if (missing.length) {
	throw new Error(`buffed Pokemon missing from the client table: ${missing.join(', ')}`);
}
