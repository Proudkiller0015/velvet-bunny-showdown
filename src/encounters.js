'use strict';
/**
 * Roleplay encounters: wild Pokemon to catch, and trainers met on the road.
 *
 * The RP happens on Discord and the battles happen here. A player whose
 * character walks into tall grass says what they found, and a wild Pokemon of
 * that species and level challenges them; a player stopped by a hiker on a
 * mountain path says so, and a hiker with a hiker's team challenges them.
 *
 * Everything in this file is plain data and pure functions - no sockets, no
 * server - because three different processes need it: the chat commands check
 * a request before accepting it, the RP bot builds the teams, and the battle
 * itself rolls the catch. Keeping one copy is what keeps them agreeing.
 *
 * Two rules come from the RP and are not negotiable here:
 *
 *   - Legendary and Mythical Pokemon are never encountered or caught on
 *     Showdown. Those are story events and are handled in the RP.
 *   - Badges have no order. Kagura is open world, so a trainer's strength is
 *     a function of how many badges the player has, never which ones.
 */

// RP's dex: wild Pokemon and trainers are RP's, buffs and our own Pokemon included.
const Dex = require('./rp-dex')();
const Rarity = require('./rarity');
const RS = require('./role-sets');
const TL = require('./team-logic');
const TeamAssembler = require('./team-assembler');
const EV = require('./ev-spread');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ------------------------------------------------------------------ species

const LEGEND_TAGS = ['Mythical', 'Restricted Legendary', 'Sub-Legendary'];

/** Legendary or Mythical, including every forme of one. */
function isLegendary(species) {
	const s = typeof species === 'string' ? Dex.species.get(species) : species;
	if (!s || !s.exists) return false;
	const base = Dex.species.get(s.baseSpecies);
	return [s, base].some(x => (x.tags || []).some(t => LEGEND_TAGS.includes(t)));
}

/*
 * The regions whose tables may hold Touhou Pokemon (the Boneka): Gensokyo is where they
 * live, and nowhere else (owner, 21 Oct 2026). Everywhere else they are not in the grass.
 */
const TOUHOU_REGIONS = new Set(['gensokyo']);

/**
 * A real, battle-ready Pokemon somebody could meet in the wild.
 *
 * `region`: the region asking. Touhou Pokemon are only ever met in a TOUHOU_REGIONS
 * region, and only by name from its tables (`boneka`), never as "any Pokemon of the
 * right type" - so the line and type pools below, which ask without a region, never
 * see them.
 */
function encounterable(s, { region = null } = {}) {
	return !!s && s.exists && s.num > 0 &&
		s.isNonstandard !== 'Custom' && s.isNonstandard !== 'CAP' && s.isNonstandard !== 'LGPE' &&
		// Collab (crossover) Pokemon are not out in the grass anywhere (data/velvet/collab.js).
		s.tier !== 'Collab' &&
		// Touhou Pokemon only in Gensokyo (data/velvet/touhou.js, src/encounter-tables/gensokyo.js).
		(s.tier !== 'Touhou' || TOUHOU_REGIONS.has(toID(region))) &&
		!s.battleOnly && !s.isMega && !s.isPrimal && !/Gmax|Totem|Eternamax/.test(s.forme || '');
}

/** A Touhou Pokemon a player can meet and catch: a Touhou species that is not one of the legendary ones. */
function isBoneka(species) {
	const s = typeof species === 'string' ? Dex.species.get(species) : species;
	return !!s && s.exists && s.tier === 'Touhou' && !isLegendary(s);
}

/**
 * Look a species up the way a player types it: "pidgey", "Alolan Vulpix",
 * "vulpix alola", "Mr Mime". Returns { species } or { error }.
 */
function findSpecies(input) {
	const raw = String(input || '').trim();
	if (!raw) return { error: 'Which Pokémon?' };
	let s = Dex.species.get(raw);
	if (!s.exists) {
		// Regional forms written the way the games say them.
		const m = /^(alolan|galarian|hisuian|paldean)\s+(.+)$/i.exec(raw);
		if (m) s = Dex.species.get(`${m[2]}-${{ alolan: 'Alola', galarian: 'Galar', hisuian: 'Hisui', paldean: 'Paldea' }[m[1].toLowerCase()]}`);
	}
	if (!s.exists) return { error: `I don't know a Pokémon called "${raw}". Check the spelling.` };
	if (isLegendary(s)) {
		return { error: `${s.name} is Legendary or Mythical. Those aren't battled or caught on Showdown, they happen in the RP. Ask Sam or Saku.` };
	}
	if (!encounterable(s)) return { error: `${s.name} can't be met in the wild (it's a battle-only form).` };
	return { species: s };
}

// ------------------------------------------------------------------- moves

/**
 * The moves a Pokemon of this species knows at this level, the way the games
 * do it: its level-up moves, the four most recently learned.
 *
 * Learnsets are keyed by generation ("9L12" is level 12 in Gen 9). A Pokemon
 * that is not in the newest games only has older entries, so the newest
 * generation that has any level-up moves for it is the one used - mixing
 * generations would hand out moves at levels no game ever taught them.
 */
function learnsetOf(species) {
	let s = species;
	for (let i = 0; i < 4 && s; i++) {
		const data = Dex.species.getLearnsetData(s.id);
		if (data && data.learnset) return data.learnset;
		s = s.changesFrom ? Dex.species.get(s.changesFrom) : Dex.species.get(s.baseSpecies);
		if (s && s.id === species.id) break;
	}
	return {};
}

function levelUpMoves(species, level) {
	const learnset = learnsetOf(species);
	let best = 0;
	for (const sources of Object.values(learnset)) {
		for (const src of sources) {
			const m = /^(\d+)L/.exec(src);
			if (m) best = Math.max(best, Number(m[1]));
		}
	}
	const known = [];
	for (const [move, sources] of Object.entries(learnset)) {
		for (const src of sources) {
			const m = /^(\d+)L(\d+)$/.exec(src);
			if (!m || Number(m[1]) !== best) continue;
			const at = Number(m[2]);
			if (at <= level) known.push({ move, at });
			break;
		}
	}
	known.sort((a, b) => b.at - a.at);
	const moves = [];
	for (const { move } of known) {
		const found = Dex.moves.get(move);
		if (found.exists && !found.isNonstandard && !moves.includes(found.name)) moves.push(found.name);
		if (moves.length === 4) break;
	}
	return moves.length ? moves : ['Tackle'];
}

/** The strongest reliable attack of a type this Pokemon can learn at all - its "TM". */
function bestTaughtMove(species, type, maxPower) {
	let pick = null;
	for (const id of Object.keys(learnsetOf(species))) {
		const move = Dex.moves.get(id);
		if (!move.exists || move.category === 'Status' || move.type !== type) continue;
		if (move.basePower > maxPower || (move.accuracy !== true && move.accuracy < 85)) continue;
		if (move.flags && (move.flags.charge || move.flags.recharge)) continue;
		if (move.selfdestruct || move.isZ || move.isMax) continue;
		if (!pick || move.basePower > pick.basePower) pick = move;
	}
	return pick && pick.name;
}

// -------------------------------------------------------------------- sets

const NATURES = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish',
	'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
	'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const randInt = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

function abilityFor(species, rng, hiddenChance) {
	/*
	 * An ability this server made for it is the reason it was rebuilt (owner, 12 Oct 2026: a
	 * trainer's Pansage came out with Gluttony instead of Verdant Surge): always that one.
	 */
	const own = Object.values(species.abilities).find(name => Dex.abilities.get(name).num < 0);
	if (own) return own;
	const normal = ['0', '1'].map(k => species.abilities[k]).filter(Boolean);
	const hidden = species.abilities.H;
	if (hidden && rng() < hiddenChance) return hidden;
	return pick(normal.length ? normal : [hidden || 'No Ability'], rng);
}

const clampLevel = n => Math.max(1, Math.min(100, Math.round(Number(n) || 0)));

/*
 * What a legendary that brings its own weather or terrain holds in the wild (owner, 2 Oct
 * 2026: "make it so legendary that summon weather have a way to extend it by default in the
 * wild: terrain extender/smooth rock etc"). Eight turns of it instead of five. Legendaries
 * only - a wild Pelipper keeps nothing - and never over an item already chosen. Primal
 * weather does not run out, so there is nothing to extend.
 */
const ROCK = { sun: 'Heat Rock', rain: 'Damp Rock', sand: 'Smooth Rock', snow: 'Icy Rock' };
const TERRAIN_SETTERS = new Set(['electricsurge', 'grassysurge', 'mistysurge', 'psychicsurge', 'hadronengine', 'seedsower',
	'calloftheabyss', 'calloftheshrine', 'callofthesanctuary']);
function weatherItem(species, ability) {
	if (!isLegendary(species)) return '';
	const id = String(ability || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	if (TERRAIN_SETTERS.has(id)) return 'Terrain Extender';
	if (id === 'orichalcumpulse') return ROCK.sun;
	let weather = null;
	try { weather = require('./weather-plan').abilityMaps(Dex).setterOf[id]; } catch (e) { /* no plan: no item */ }
	return ROCK[weather] || '';
}

/** One wild Pokemon, as the games would roll it. */
function wildSet(species, level, rng = Math.random) {
	level = clampLevel(level);
	const iv = () => randInt(0, 31, rng);
	const ability = abilityFor(species, rng, 0.05);
	return {
		name: species.baseSpecies === species.name ? species.name : species.name,
		species: species.name,
		level,
		moves: levelUpMoves(species, level),
		ability,
		nature: pick(NATURES, rng),
		ivs: { hp: iv(), atk: iv(), def: iv(), spa: iv(), spd: iv(), spe: iv() },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		item: weatherItem(species, ability),
	};
}

/*
 * The Boneka: Touhou Pokemon met in the wild in Gensokyo (owner, 21 Oct 2026: "all
 * Boneka are 1% encounters"). Each one a place names is exactly BONEKA_SHARE of what
 * turns up there, whatever the badges, the hour or the season; the rest of the table
 * shares what is left in its usual proportions. The legendary ones (touhou.js
 * LEGENDS, tagged Sub-Legendary) are never met, like every other legendary.
 */
const BONEKA_SHARE = 0.01;
const BONEKA_CATCH_RATE = 3;

/*
 * A Boneka's moves. Their movepools (the Touhoumons mod's) are all "learned at level 1",
 * so the games' "last four learned" would hand a level 8 Cirno Blizzard, Ice Beam,
 * Freeze-Dry and Aurora Beam. Instead it knows what a wild one of that level plausibly
 * would: its own types' attacks up to a power that grows with level, one attack of
 * another type, and one move that is not an attack - four in all.
 */
const BONEKA_STATUS = new Set(['calmmind', 'nastyplot', 'swordsdance', 'bulkup', 'dragondance', 'quiverdance', 'agility',
	'thunderwave', 'willowisp', 'toxic', 'hypnosis', 'sleeppowder', 'stunspore', 'confuseray', 'taunt', 'encore',
	'recover', 'roost', 'softboiled', 'moonlight', 'synthesis', 'slackoff', 'substitute', 'protect', 'leechseed',
	'reflect', 'lightscreen', 'haze', 'charm', 'growl', 'leer', 'tailwhip', 'sandattack', 'smokescreen', 'yawn']);
function bonekaPower(level) {
	return level < 20 ? 60 : level < 35 ? 80 : level < 50 ? 95 : 150;
}
function bonekaMoves(species, level, rng) {
	const cap = bonekaPower(level);
	const learnable = Object.keys(learnsetOf(species)).map(id => Dex.moves.get(id))
		.filter(m => m.exists && !m.isZ && !m.isMax && !(m.isNonstandard && m.num > 0));
	const attacks = learnable.filter(m => m.category !== 'Status' && m.basePower > 0 && m.basePower <= cap &&
		(m.accuracy === true || m.accuracy >= 75) && !(m.flags && (m.flags.charge || m.flags.recharge)) && !m.selfdestruct &&
		!m.ohko && m.id !== 'struggle')
		// Shuffled, then strongest first: equal powers come out in a different order each time.
		.map(m => ({ m, r: rng() })).sort((a, b) => b.m.basePower - a.m.basePower || a.r - b.r).map(x => x.m);
	const moves = [];
	const add = m => { if (m && moves.length < 4 && !moves.includes(m.name)) moves.push(m.name); };
	for (const type of species.types) add(attacks.find(m => m.type === type));
	add(attacks.find(m => !species.types.includes(m.type)));
	const status = learnable.filter(m => m.category === 'Status' && BONEKA_STATUS.has(m.id));
	if (status.length) add(status[Math.floor(rng() * status.length)]);
	for (const m of attacks) {
		if (moves.length >= 4) break;
		if (!moves.some(n => Dex.moves.get(n).type === m.type)) add(m);
	}
	for (const m of attacks) add(m);
	return moves.length ? moves : levelUpMoves(species, level);
}

/** A wild Boneka: wildSet, with moves for its level (bonekaMoves) and its own ability. */
function bonekaSet(species, level, rng = Math.random) {
	const set = wildSet(species, level, rng);
	set.moves = bonekaMoves(species, set.level, rng);
	set.boneka = true;
	return set;
}

/**
 * The side name a wild Pokemon battles under. The battle checks for "Wild ". It no longer
 * names the species (owner, 16 Oct 2026): the challenge on Showdown came from "Wild Audino",
 * and what it is stays a surprise until the battle opens, as on Discord.
 */
function wildName() {
	return 'Wild Pokemon';
}

// ----------------------------------------------------------------- catching

/**
 * How catchable a species is, 3 (hardest) to 255 (easiest).
 *
 * Showdown's dex has no catch rates in it, so this is read off base stat total,
 * which is what the games' catch rates mostly track anyway: a Pidgey is 255, a
 * starter is 45, a pseudo-legendary is 45.
 */
function catchRate(species) {
	// A Boneka is caught like a Mythical: catch rate 3 (the owner, 21 Oct 2026).
	if (species && species.tier === 'Touhou') return BONEKA_CATCH_RATE;
	const bst = species.bst;
	if (bst <= 300) return 255;
	if (bst <= 350) return 190;
	if (bst <= 400) return 150;
	if (bst <= 450) return 120;
	if (bst <= 500) return 75;
	return 45;
}

/**
 * The balls. `mult` is the catch multiplier given what is in front of you.
 *
 * A few depend on things a battle cannot see - time of day, fishing, whether
 * you have caught one before. Those use a stand-in that a battle can check, and
 * the tutorial says which.
 */
const BALLS = [
	{ id: 'poke', name: 'Pokéball', mult: () => 1 },
	{ id: 'great', name: 'Great Ball', mult: () => 1.5 },
	{ id: 'ultra', name: 'Ultra Ball', mult: () => 2 },
	{ id: 'master', name: 'Master Ball', mult: () => Infinity },
	{ id: 'premier', name: 'Premier Ball', mult: () => 1 },
	{ id: 'luxury', name: 'Luxury Ball', mult: () => 1 },
	{ id: 'heal', name: 'Heal Ball', mult: () => 1 },
	{ id: 'friend', name: 'Friend Ball', mult: () => 1 },
	{ id: 'quick', name: 'Quick Ball', mult: c => (c.turn <= 1 ? 5 : 1), note: '5× on the first turn' },
	{ id: 'timer', name: 'Timer Ball', mult: c => Math.min(4, 1 + c.turn * 0.3), note: 'better every turn, up to 4×' },
	{ id: 'net', name: 'Net Ball', mult: c => (c.types.some(t => t === 'Water' || t === 'Bug') ? 3.5 : 1), note: '3.5× on Water and Bug' },
	{ id: 'dive', name: 'Dive Ball', mult: c => (c.types.includes('Water') ? 3.5 : 1), note: '3.5× on Water' },
	{ id: 'lure', name: 'Lure Ball', mult: c => (c.types.includes('Water') ? 4 : 1), note: '4× on Water' },
	{ id: 'dusk', name: 'Dusk Ball', mult: c => (c.types.some(t => t === 'Ghost' || t === 'Dark') ? 3 : 1), note: '3× on Ghost and Dark' },
	{ id: 'nest', name: 'Nest Ball', mult: c => Math.max(1, (41 - c.wildLevel) / 10), note: 'better the lower its level' },
	{ id: 'level', name: 'Level Ball', mult: c => (c.myLevel >= 4 * c.wildLevel ? 8 : c.myLevel >= 2 * c.wildLevel ? 4 : c.myLevel > c.wildLevel ? 2 : 1), note: 'better if yours is higher level' },
	{ id: 'fast', name: 'Fast Ball', mult: c => (c.baseSpeed >= 100 ? 4 : 1), note: '4× on fast Pokémon' },
	{ id: 'heavy', name: 'Heavy Ball', mult: c => (c.weightkg >= 300 ? 3 : c.weightkg >= 200 ? 2 : c.weightkg >= 100 ? 1.5 : 1), note: 'better on heavy Pokémon' },
	{ id: 'moon', name: 'Moon Ball', mult: c => (c.moonStone ? 4 : 1), note: '4× on Moon Stone families' },
	{ id: 'love', name: 'Love Ball', mult: c => (c.sameSpeciesOppositeGender ? 8 : 1), note: '8× on the same species, opposite gender' },
	{ id: 'dream', name: 'Dream Ball', mult: c => (c.status === 'slp' ? 4 : 1), note: '4× if it is asleep' },
	{ id: 'repeat', name: 'Repeat Ball', mult: () => 1, note: 'counts as a Pokéball here' },
	{ id: 'beast', name: 'Beast Ball', mult: c => (c.ultraBeast ? 5 : 0.1), note: 'only good on Ultra Beasts' },
];

function findBall(input) {
	const id = toID(input).replace(/ball$/, '') || 'poke';
	return BALLS.find(b => b.id === id || toID(b.name) === toID(input)) || null;
}

/**
 * Catch chances are deliberately generous.
 *
 * The games' formula at full strength makes a strong Pokemon a thirty-turn
 * slog of chip damage and status, and nobody wants that in an RP session. So
 * the formula is the real one - lower HP, a status and a better ball all help,
 * in the same proportions - and the result is multiplied by 1.5 (it was doubled
 * until 22 Sep 2026, which the owner found too easy), and every ball that
 * misses makes the next one 5% likelier.
 *
 *   Pidgey at full HP, Pokéball              ~42%
 *   Garchomp at full HP, Ultra Ball           ~15%
 *   Garchomp in the red, asleep, Ultra Ball   ~100%
 */
// 2 until 22 Sep 2026, then 1.5, then 1.25 the same evening: still too generous
// across the board, said the owner. Weakening and statusing matter more at 1.25.
const CATCH_BOOST = 1.25;
const PITY_PER_MISS = 0.05;

function catchChance(c) {
	const ball = typeof c.ball === 'string' ? findBall(c.ball) : c.ball;
	const mult = ball ? ball.mult(c) : 1;
	if (mult === Infinity) return 1;
	const hp = Math.max(0, Math.min(1, c.hpFraction));
	const statusBonus = c.status === 'slp' || c.status === 'frz' ? 2.5 : c.status ? 1.5 : 1;
	const a = ((3 - 2 * hp) / 3) * c.rate * mult * statusBonus;
	return Math.max(0, Math.min(1, (a / 255) * CATCH_BOOST + (c.misses || 0) * PITY_PER_MISS));
}

/** How many times the ball wobbles before it breaks, for the message. */
function shakesFor(chance, rng) {
	const perShake = Math.pow(chance, 1 / 4);
	let shakes = 0;
	while (shakes < 3 && rng() < perShake) shakes++;
	return shakes;
}

// ----------------------------------------------------------------- trainers

/**
 * Trainer classes: what they are called, what they look like, what they use.
 *
 * `avatar` is one of Showdown's own trainer sprites. `types` is the kind of
 * team the class brings - a Hiker brings rock and ground, a Swimmer brings
 * water - and an empty list means anything. `short` is used when the full
 * title and a name would not fit in Showdown's 18-character name limit.
 * `pair` classes are two people and always battle as a double.
 */
const TRAINER_CLASSES = [
	{ id: 'youngster', title: 'Youngster', avatar: 'youngster-gen4', types: ['Normal', 'Bug', 'Flying', 'Poison'], sex: 'm' },
	{ id: 'lass', title: 'Lass', avatar: 'lass-gen4', types: ['Normal', 'Fairy', 'Grass'], sex: 'f' },
	{ id: 'bugcatcher', title: 'Bug Catcher', avatar: 'bugcatcher-gen4dp', types: ['Bug'], sex: 'm' },
	{ id: 'hiker', title: 'Hiker', avatar: 'hiker-gen4', types: ['Rock', 'Ground'], sex: 'm', aliases: ['mountaineer', 'climber'] },
	{ id: 'camper', title: 'Camper', avatar: 'camper-gen6', types: ['Grass', 'Fire', 'Bug', 'Normal'], sex: 'm' },
	{ id: 'picnicker', title: 'Picnicker', avatar: 'picnicker-gen6', types: ['Grass', 'Fairy', 'Normal', 'Water'], sex: 'f' },
	{ id: 'fisherman', title: 'Fisherman', avatar: 'fisherman-gen4', types: ['Water'], sex: 'm', short: 'Fisher' },
	{ id: 'swimmer', title: 'Swimmer', avatar: 'swimmer-gen4', types: ['Water'], sex: 'm' },
	{ id: 'swimmerf', title: 'Swimmer', avatar: 'swimmerf-gen4', types: ['Water'], sex: 'f' },
	{ id: 'tuber', title: 'Tuber', avatar: 'tuber-gen6', types: ['Water'], sex: 'm' },
	{ id: 'sailor', title: 'Sailor', avatar: 'sailor-gen6', types: ['Water', 'Fighting'], sex: 'm' },
	{ id: 'birdkeeper', title: 'Bird Keeper', avatar: 'birdkeeper-gen4dp', types: ['Flying'], sex: 'm' },
	{ id: 'blackbelt', title: 'Black Belt', avatar: 'blackbelt-gen4', types: ['Fighting'], sex: 'm' },
	{ id: 'battlegirl', title: 'Battle Girl', avatar: 'battlegirl-gen4', types: ['Fighting'], sex: 'f' },
	{ id: 'psychic', title: 'Psychic', avatar: 'psychic-gen4', types: ['Psychic'], sex: 'm' },
	{ id: 'psychicf', title: 'Psychic', avatar: 'psychicf-gen4', types: ['Psychic'], sex: 'f' },
	{ id: 'hexmaniac', title: 'Hex Maniac', avatar: 'hexmaniac-gen6', types: ['Ghost', 'Dark', 'Psychic'], sex: 'f' },
	{ id: 'channeler', title: 'Channeler', avatar: 'channeler-gen3', types: ['Ghost'], sex: 'f' },
	{ id: 'sage', title: 'Sage', avatar: 'sage-gen2', types: ['Ghost', 'Psychic', 'Grass'], sex: 'm' },
	{ id: 'kimonogirl', title: 'Kimono Girl', avatar: 'kimonogirl-gen2', types: ['Normal', 'Fire', 'Water', 'Electric', 'Psychic', 'Fairy'], sex: 'f', short: 'Kimono' },
	{ id: 'firebreather', title: 'Fire Breather', avatar: 'firebreather-gen2', types: ['Fire'], sex: 'm', short: 'Firebreather' },
	{ id: 'kindler', title: 'Kindler', avatar: 'kindler-gen6', types: ['Fire'], sex: 'm' },
	{ id: 'skier', title: 'Skier', avatar: 'skierf-gen4dp', types: ['Ice'], sex: 'f' },
	{ id: 'ranger', title: 'Ranger', avatar: 'pokemonranger-gen4', types: ['Grass', 'Bug', 'Flying', 'Normal', 'Ground'], sex: 'm', aliases: ['pokemonranger'] },
	{ id: 'rangerf', title: 'Ranger', avatar: 'pokemonrangerf-gen4', types: ['Grass', 'Bug', 'Flying', 'Normal', 'Water'], sex: 'f' },
	{ id: 'breeder', title: 'Breeder', avatar: 'pokemonbreederf-gen4', types: [], sex: 'f', aliases: ['pokemonbreeder'] },
	{ id: 'backpacker', title: 'Backpacker', avatar: 'backpacker-gen6', types: [], sex: 'm' },
	{ id: 'acetrainer', title: 'Ace Trainer', avatar: 'acetrainer-gen4dp', types: [], sex: 'm', short: 'Ace' },
	{ id: 'acetrainerf', title: 'Ace Trainer', avatar: 'acetrainerf-gen4dp', types: [], sex: 'f', short: 'Ace' },
	/*
	 * The stall Ace Trainer, by name (see ACE_STALL_CHANCE for the random one):
	 * an Ace Trainer like the others, who always brings a stall team. Staff can
	 * summon it ("stallace"); routes never list it, so it turns up at random
	 * only as the ordinary Ace Trainers' stall roll.
	 */
	{ id: 'acetrainerstall', title: 'Ace Trainer', avatar: 'acetrainer-gen4dp', types: [], sex: 'm', short: 'Ace', stall: true, aliases: ['stallace', 'acestall', 'stalltrainer'] },
	{ id: 'veteran', title: 'Veteran', avatar: 'veteran-gen6', types: [], sex: 'm' },
	{ id: 'dragontamer', title: 'Dragon Tamer', avatar: 'dragontamer-gen6', types: ['Dragon'], sex: 'm', short: 'Tamer' },
	{ id: 'scientist', title: 'Scientist', avatar: 'scientist-gen4', types: ['Electric', 'Poison', 'Steel'], sex: 'm' },
	{ id: 'worker', title: 'Worker', avatar: 'worker-gen6', types: ['Steel', 'Rock', 'Fighting', 'Electric'], sex: 'm' },
	{ id: 'guitarist', title: 'Guitarist', avatar: 'guitarist-gen4', types: ['Electric', 'Poison', 'Normal'], sex: 'm' },
	{ id: 'beauty', title: 'Beauty', avatar: 'beauty-gen4dp', types: ['Fairy', 'Normal', 'Water', 'Grass'], sex: 'f' },
	{ id: 'gentleman', title: 'Gentleman', avatar: 'gentleman-gen4dp', types: ['Normal', 'Fire', 'Psychic'], sex: 'm' },
	{ id: 'lady', title: 'Lady', avatar: 'lady-gen4', types: ['Fairy', 'Normal', 'Grass'], sex: 'f' },
	{ id: 'richboy', title: 'Rich Boy', avatar: 'richboy-gen4', types: ['Normal', 'Fairy', 'Fire'], sex: 'm' },
	{ id: 'pokefan', title: 'Poke Fan', avatar: 'pokefan-gen4', types: ['Normal', 'Fairy', 'Electric'], sex: 'm' },
	{ id: 'artist', title: 'Artist', avatar: 'artist-gen4', types: ['Normal', 'Grass', 'Psychic'], sex: 'm' },
	{ id: 'cyclist', title: 'Cyclist', avatar: 'cyclist-gen4', types: ['Electric', 'Flying', 'Normal'], sex: 'm' },
	{ id: 'ruinmaniac', title: 'Ruin Maniac', avatar: 'ruinmaniac-gen6', types: ['Rock', 'Ground', 'Ghost'], sex: 'm', short: 'Ruin Fan' },
	{ id: 'ninjaboy', title: 'Ninja Boy', avatar: 'ninjaboy-gen6', types: ['Poison', 'Dark', 'Bug'], sex: 'm', short: 'Ninja' },
	{ id: 'punk', title: 'Punk', avatar: 'punkguy-gen7', types: ['Poison', 'Dark'], sex: 'm' },
	{ id: 'delinquent', title: 'Delinquent', avatar: 'delinquentf-gen9', types: ['Dark', 'Poison', 'Fighting'], sex: 'f' },
	{ id: 'schoolkid', title: 'School Kid', avatar: 'schoolkid-gen4', types: ['Normal', 'Grass', 'Electric'], sex: 'm', short: 'Student' },
	{ id: 'teacher', title: 'Teacher', avatar: 'teacher-gen7', types: [], sex: 'f' },
	{ id: 'nurse', title: 'Nurse', avatar: 'nurse', types: ['Normal', 'Fairy', 'Psychic'], sex: 'f' },
	{ id: 'policeman', title: 'Officer', avatar: 'policeman-gen4', types: ['Fire', 'Normal', 'Dark'], sex: 'm', aliases: ['police', 'officer'] },
	{ id: 'abyssalgrunt', title: 'Abyssal Grunt', avatar: 'aquagrunt', types: ['Water', 'Dark', 'Poison', 'Steel'], sex: 'm', short: 'Grunt', aliases: ['grunt', 'teamabyssal'] },
	{ id: 'galacticgrunt', title: 'Galactic Grunt', avatar: 'galacticgrunt', types: ['Poison', 'Dark', 'Steel', 'Psychic'], sex: 'm', short: 'Grunt', aliases: ['galactic', 'teamgalactic'] },
	/*
	 * The ones a story sends rather than a route: a Champion, the four under
	 * them, a gym leader, a rival. They are never rolled into an ordinary
	 * encounter (story: true) - the grass has no Champions in it - but staff can
	 * summon one by name, and an arranged scene usually wants exactly this.
	 */
	{ id: 'champion', title: 'Champion', avatar: 'cynthia', types: [], sex: 'f', story: true, aliases: ['champ'] },
	{ id: 'elitefour', title: 'Elite Four', avatar: 'lance-gen3', types: [], sex: 'm', story: true, short: 'E4', aliases: ['e4', 'elite'] },
	{ id: 'gymleader', title: 'Leader', avatar: 'brock-gen4', types: [], sex: 'm', story: true, aliases: ['gym', 'leader', 'gymleader'] },
	{ id: 'rival', title: 'Rival', avatar: 'blue-gen3', types: [], sex: 'm', story: true },
	/*
	 * The Larper (owner, 12 Oct 2026: "they bring troll teams like full explosion
	 * squads"). Always a troll team (trollTrainerTeam), met now and then on any
	 * route from one badge (LARPER_CHANCE) and summonable by name. Explosion went to
	 * the Terrorist alone (owner, 22 Oct 2026): half of all Larpers brought it too.
	 */
	{ id: 'larper', title: 'Larper', avatar: 'harlequin', types: [], sex: 'm', troll: true, aliases: ['larp', 'troll', 'trolltrainer'] },
	// The Larper's dark-humour cousin (owner, 12 Oct 2026): only ever the Explosion squad.
	{ id: 'terrorist', title: 'Terrorist', avatar: 'burglar', types: [], sex: 'm', troll: true, trollTheme: 'explosion', bombers: true, aliases: ['bomber', 'bombsquad'] },
	/*
	 * The Gap Wanderer (owner, 21 Oct 2026): somebody who slipped through one of Yukari's
	 * gaps and is still finding their way home, with six Boneka who came along. The one
	 * trainer who brings Touhou Pokemon to Kagura too; met very rarely on any route, in
	 * either region (GAP_WANDERER_CHANCE), and summonable by name.
	 */
	{ id: 'gapwanderer', title: 'Gap Wanderer', avatar: 'kimonogirl-gen2', types: [], sex: 'f', gap: true, short: 'Wanderer',
		aliases: ['gap', 'wanderer', 'gapyoukai', 'sukima'],
		intro: 'The air tears open like a ribbon pulled loose, and someone steps out of a gap full of eyes.' },
	{ id: 'twins', title: 'Twins', avatar: 'twins-gen4', types: ['Normal', 'Fairy', 'Electric', 'Bug'], sex: 'pair', pair: true },
	{ id: 'youngcouple', title: 'Young Couple', avatar: 'youngcouple-gen4dp', types: ['Normal', 'Fairy', 'Psychic', 'Water'], sex: 'pair', pair: true, short: 'Couple' },
];

/*
 * The stall Ace Trainer's odds (24 Sep 2026): one Ace Trainer in four, from six
 * badges, brings a dedicated stall team (see rollTrainer). Rarer than that and
 * a player could finish the badges without meeting one; much commoner and the
 * Ace Trainers stop being the all-rounders they are in the games.
 */
const ACE_CLASSES = ['acetrainer', 'acetrainerf'];
const ACE_STALL_CHANCE = 0.25;
/*
 * Outside gyms, one route trainer in ten is a Larper and one in ten a
 * Terrorist (owner, 12 Oct 2026). Where the place is Fire, the Terrorists are 45%; where
 * it is Psychic, the Larpers are.
 */
const LARPER_CHANCE = 0.1;
const TROLL_HOME_CHANCE = 0.45;
/*
 * The Gap Wanderer's odds (owner, 21 Oct 2026): very rare with no badges, a little
 * likelier with each one, and still rare at eight - 0.3% of route trainers plus 0.3%
 * a badge: 0.3% at 0, 1.5% at 4, 2.7% at 8. Any route in Kagura or Gensokyo, never a gym.
 * Taken off the top of the same roll as the trolls, so it costs no extra random number.
 */
const GAP_WANDERER_BASE = 0.003;
const GAP_WANDERER_PER_BADGE = 0.003;
const gapWandererChance = badges => GAP_WANDERER_BASE + GAP_WANDERER_PER_BADGE * clampBadges(badges);

/**
 * A class staff typed that the list doesn't have ("Team Rocket Grunt"): its own
 * title, a plain trainer sprite and an ordinary team, rather than no battle at all.
 */
function customClass(input) {
	const title = String(input || '').trim().replace(/\s+/g, ' ').slice(0, 18);
	const id = toID(title);
	if (!id) return null;
	return { id, title: title.replace(/^./, c => c.toUpperCase()), avatar: 'acetrainer-gen4dp', types: [], sex: 'm', custom: true };
}

const NAMES = {
	m: ['Bob', 'Ken', 'Ryo', 'Taro', 'Joey', 'Mike', 'Leo', 'Sam', 'Dan', 'Jin', 'Kai', 'Ben', 'Tom', 'Ray',
		'Hiro', 'Eli', 'Max', 'Yuto', 'Sora', 'Aki', 'Rex', 'Ned', 'Otto', 'Finn', 'Gus', 'Hugo', 'Ivan', 'Jay'],
	f: ['Amy', 'Mia', 'Yui', 'Emi', 'Rin', 'Ada', 'Ivy', 'Kim', 'Liz', 'Nia', 'Zoe', 'Mei', 'Aya', 'Hana',
		'Saki', 'Nora', 'Ruby', 'Tess', 'Lulu', 'Kate', 'Jess', 'Ema', 'Mai', 'Rika', 'Sue', 'Fay', 'Gwen', 'Iris'],
	pair: ['Amy & Liv', 'Kim & Ki', 'Ai & Mai', 'Jo & Zac', 'Tia & Tim', 'Lu & Lee', 'Bo & Flo', 'Ren & Rue'],
};

function findClass(input) {
	const id = toID(input);
	if (!id) return null;
	return TRAINER_CLASSES.find(c => c.id === id || toID(c.title) === id || (c.aliases || []).includes(id)) || null;
}

/** "Hiker Bob", always within Showdown's 18 characters. */
function trainerName(cls, rng = Math.random) {
	const name = pick(NAMES[cls.sex] || NAMES.m, rng);
	for (const title of [cls.title, cls.short].filter(Boolean)) {
		const full = `${title} ${name}`;
		if (full.length <= 18) return full;
	}
	return `${cls.short || cls.title} ${name}`.slice(0, 18);
}

// ----------------------------------------------------------- how strong is it

/**
 * The lowest level a species could plausibly be found at.
 *
 * Level evolutions are exact (a Garchomp needs 48). Stones, trades and
 * friendship have no level, so they get a sensible floor, and each stage has
 * to be later than the one before - a Gengar is never lower than its Haunter.
 * This is what stops a route trainer bringing a Garchomp at level 20.
 */
function minLevel(species, depth = 0) {
	if (!species.prevo || depth > 4) return 1;
	const prevo = Dex.species.get(species.prevo);
	const before = minLevel(prevo, depth + 1);
	if (species.evoLevel) return Math.max(species.evoLevel, before);
	const floor = { levelFriendship: 16, trade: 30, useItem: 25, levelMove: 25, levelExtra: 25, levelHold: 25, other: 25 }[species.evoType] || 25;
	return Math.max(floor, before + 6);
}

/** The first stage of a species' line: Golem -> Geodude. */
function rootOf(species) {
	let s = species;
	for (let i = 0; i < 4 && s.prevo; i++) {
		const prevo = Dex.species.get(s.prevo);
		if (!prevo.exists) break;
		s = prevo;
	}
	return s;
}

/** Every stage of a line, in order, forms that belong to it included. */
const lineCache = new Map();
function lineOf(root) {
	if (lineCache.has(root.id)) return lineCache.get(root.id);
	const out = [];
	const walk = (s, depth) => {
		if (!s.exists || depth > 4 || out.includes(s)) return;
		if (encounterable(s)) out.push(s);
		for (const e of s.evos || []) walk(Dex.species.get(e), depth + 1);
	};
	walk(root, 0);
	lineCache.set(root.id, out);
	return out;
}

/*
 * Who is rare is decided in one place, src/rarity.js: the ladder from box-art
 * legends down to common lines, with usage tier inside each class.
 */

/**
 * What badges unlock.
 *
 * `power` is the base stat total of the strongest thing a line becomes. A line
 * at or under the cap for a badge count turns up as often as anything else; a
 * line over it can still turn up, and gets rarer fast the further over it is -
 * so a level 100 trainer can meet a Garchomp in a cave, and a trainer with no
 * badges almost never will.
 *
 * `levels` is the level range of what you meet. Badges have no order, so this
 * depends on how many you have and nothing else.
 */
const BADGE_TIERS = [
	{ power: 400, levels: [3, 9], size: 2, ai: 'easy' },
	{ power: 440, levels: [8, 15], size: 2, ai: 'easy' },
	{ power: 470, levels: [14, 21], size: 3, ai: 'normal' },
	{ power: 490, levels: [20, 27], size: 3, ai: 'normal' },
	{ power: 510, levels: [26, 33], size: 4, ai: 'normal' },
	{ power: 530, levels: [32, 39], size: 4, ai: 'hard' },
	{ power: 545, levels: [38, 45], size: 5, ai: 'hard' },
	{ power: 570, levels: [44, 52], size: 6, ai: 'hard' },
	{ power: 600, levels: [50, 62], size: 6, ai: 'champion' },
];
const clampBadges = b => Math.max(0, Math.min(8, Math.round(Number(b) || 0)));

/**
 * How likely a line is to be the one you meet, given how many badges you have.
 * Weights are relative, not percentages; where the line belongs (common, rare,
 * or just the right type) is weighed separately, in rollWild.
 *
 * Power is judged on what the line would actually be at these levels: a
 * Geodude at level 8 is a Geodude, and a place full of them is not dangerous
 * just because Golem exists.
 */
const minLevelCache = new Map();
const minLevelOf = s => {
	if (!minLevelCache.has(s.id)) minLevelCache.set(s.id, minLevel(s));
	return minLevelCache.get(s.id);
};
function lineWeight(root, { badges, types = [], maxLevel = null }) {
	const tier = BADGE_TIERS[badges];
	const line = lineOf(root);
	if (!line.length) return 0;
	const reachable = line.filter(s => minLevelOf(s) <= (maxLevel || tier.levels[1]));
	const power = Math.max(...(reachable.length ? reachable : [root]).map(s => s.bst));

	let w = 1;
	if (types.length) {
		if (types.includes(root.types[0])) w *= 1.5;
		else if (!line.some(s => s.types.some(t => types.includes(t)))) return 0;
	}

	if (power > tier.power) w *= Math.pow(0.25, (power - tier.power) / 40);

	// Late bloomers. A Larvitar is a Larvitar until 50, which is a long time to
	// carry dead weight; those lines belong later in a journey than early ones.
	// Balance Patch 1 capped final stages at 50, so 45 is what "late" means now
	// - it is what keeps Gible (48), Beldum and Jangmo-o in with the other pseudos.
	const finalLevel = Math.max(...line.map(minLevelOf));
	if (finalLevel >= 45 && badges < 6) w *= 0.35;

	// The ladder: class, usage tier inside it, and badges short of where it is at home.
	w *= Rarity.wildWeight(root, badges);
	return w;
}

/**
 * Which stage of a line you meet at a level: mostly the one it would be,
 * sometimes one behind, and once in a while one ahead - like the games, where
 * a Pidgeotto on Route 1 is a story, not a bug.
 *
 * Levels are the Balance Patch 1 evolution levels (data/velvet/balance-patch-1.js
 * patches the Dex, and minLevel reads it), so "the stage it would be" moves
 * with that patch.
 *
 * `behind` defaults to shrinking with level: young lines hang back a lot at
 * level 10 and hardly at all at 60. `ahead` is the chance of the next stage up
 * before its level.
 */
function stageFor(root, level, rng, { behind = null, ahead = 0 } = {}) {
	const full = lineOf(root);
	const line = full.filter(s => minLevelOf(s) <= level);
	if (!line.length) return root;
	// Branches (Eevee, Tyrogue) all qualify at the same depth; pick among the deepest.
	const depth = s => { let d = 0; let x = s; while (x.prevo && d < 5) { x = Dex.species.get(x.prevo); d++; } return d; };
	const maxDepth = Math.max(...line.map(depth));
	if (behind === null) behind = Math.max(0.08, 0.45 - level / 150);
	const early = full.filter(s => depth(s) === maxDepth + 1);
	if (early.length && rng() < ahead) return pick(early, rng);
	let wanted = maxDepth;
	if (maxDepth > 0 && rng() < behind) wanted--;
	const options = line.filter(s => depth(s) === wanted);
	return pick(options.length ? options : line, rng);
}

/*
 * Baby Pokemon: common while levels are low, thinning out as they climb, and
 * never gone - a Pichu at level 40 is unusual, not impossible.
 */
const BABIES = new Set(['pichu', 'cleffa', 'igglybuff', 'togepi', 'tyrogue', 'smoochum', 'elekid', 'magby', 'azurill',
	'wynaut', 'budew', 'chingling', 'bonsly', 'mimejr', 'happiny', 'munchlax', 'riolu', 'mantyke', 'toxel']);
function babyWeight(root, level) {
	if (!BABIES.has(root.id)) return 1;
	if (level <= 15) return 2.5;
	if (level <= 25) return 1.6;
	if (level <= 40) return 1;
	return 0.5;
}

/*
 * The clock: what is out depends a little on the hour, the day and the season,
 * the way it does in the games - never so much that a Dark type is impossible
 * at noon or an Ice type in August.
 *
 * Kagura keeps the server's players' time, Europe/Paris, and its seasons (the
 * northern ones). Each type's weight is nudged by the time of day, the day of
 * the week and the season; a line takes the average nudge of its types,
 * clamped so nothing moves by more than about half.
 */
const CLOCK_ZONE = 'Europe/Paris';
const TIME_OF_DAY = {
	morning: { Bug: 1.2, Flying: 1.2, Grass: 1.15, Water: 1.1, Ghost: 0.75, Dark: 0.8 },
	day: { Grass: 1.2, Fire: 1.2, Bug: 1.15, Normal: 1.1, Ground: 1.1, Ghost: 0.65, Dark: 0.7 },
	evening: { Psychic: 1.2, Fairy: 1.2, Ghost: 1.1, Flying: 1.1, Bug: 0.9 },
	night: { Dark: 1.45, Ghost: 1.45, Poison: 1.2, Psychic: 1.1, Fairy: 1.1, Grass: 0.8, Bug: 0.85, Normal: 0.85, Fire: 0.9 },
};
/** One or two favoured types a day. Ghost and Dark already own the night. */
const DAY_OF_WEEK = [
	{ Grass: 1.2, Bug: 1.2 },          // Sunday
	{ Fairy: 1.2, Psychic: 1.2 },      // Monday
	{ Fire: 1.2, Fighting: 1.2 },      // Tuesday
	{ Electric: 1.2, Steel: 1.2 },     // Wednesday
	{ Flying: 1.2, Dragon: 1.2 },      // Thursday
	{ Water: 1.2, Ice: 1.2 },          // Friday
	{ Rock: 1.2, Ground: 1.2, Poison: 1.1 }, // Saturday
];
const SEASONS = {
	spring: { Grass: 1.2, Bug: 1.15, Fairy: 1.15, Flying: 1.1, Ice: 0.8 },
	summer: { Fire: 1.2, Water: 1.15, Bug: 1.15, Electric: 1.1, Ice: 0.6 },
	autumn: { Ghost: 1.2, Dark: 1.1, Poison: 1.1, Ground: 1.1, Grass: 0.9 },
	winter: { Ice: 1.45, Steel: 1.1, Normal: 1.05, Bug: 0.75, Grass: 0.8, Fire: 0.9 },
};
/*
 * Themed days. On these the nudges are bigger - an event should feel like one -
 * but still nudges: Halloween is thick with Ghosts, and a Pidgey can still turn
 * up. Dates are month-day in Kagura's time, inclusive; `species` boosts whole
 * lines by their first stage.
 */
const EVENTS = [
	{ id: 'newyear', name: '🎆 New Year', from: '12-31', to: '01-01', types: { Fire: 1.5, Electric: 1.3, Fairy: 1.2 } },
	{ id: 'valentine', name: '💝 Valentine’s Day', from: '02-13', to: '02-14', types: { Fairy: 1.7, Psychic: 1.2 }, species: { luvdisc: 4, alomomola: 3, woobat: 2, flabebe: 2 } },
	{ id: 'pokemonday', name: '🎂 Pokémon Day', from: '02-27', to: '02-27', types: {}, species: { pichu: 3, clefairy: 2, cleffa: 2, jigglypuff: 2, igglybuff: 2, meowth: 2, psyduck: 2 } },
	{ id: 'aprilfools', name: '🃏 April Fools', from: '04-01', to: '04-01', types: { Normal: 1.3, Dark: 1.2 }, species: { ditto: 4, zorua: 4, smeargle: 3, mimikyu: 3, spinda: 3, kecleon: 3, sudowoodo: 3 } },
	{ id: 'solstice', name: '☀️ Midsummer', from: '06-20', to: '06-22', types: { Fire: 1.6, Grass: 1.3, Bug: 1.2 }, species: { sunkern: 3, volbeat: 2, illumise: 2 } },
	{ id: 'halloween', name: '🎃 Halloween', from: '10-25', to: '11-01', types: { Ghost: 2.2, Dark: 1.6, Poison: 1.2 }, species: { pumpkaboo: 3, phantump: 2, sinistea: 2, greavard: 2, litwick: 2, yamask: 2 } },
	{ id: 'christmas', name: '🎄 Christmas', from: '12-20', to: '12-26', types: { Ice: 2, Grass: 1.2 }, species: { delibird: 4, stantler: 3, snover: 3, cetoddle: 2, cubchoo: 2, snom: 2 } },
];
const md = (m, d) => m * 100 + d;
function eventOn(month, day) {
	const today = md(month, day);
	return EVENTS.find((e) => {
		const [fm, fd] = e.from.split('-').map(Number);
		const [tm, td] = e.to.split('-').map(Number);
		const from = md(fm, fd); const to = md(tm, td);
		return from <= to ? today >= from && today <= to : today >= from || today <= to;
	}) || null;
}

let clockFormat = null;
function clock(now = Date.now()) {
	// Building a DateTimeFormat is slow; one is kept for the life of the process.
	clockFormat = clockFormat || new Intl.DateTimeFormat('en-GB', { timeZone: CLOCK_ZONE, hour: 'numeric', hourCycle: 'h23', weekday: 'short', month: 'numeric', day: 'numeric' });
	const parts = Object.fromEntries(clockFormat.formatToParts(new Date(now)).map(p => [p.type, p.value]));
	const hour = Number(parts.hour);
	const month = Number(parts.month);
	const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
	const period = hour >= 6 && hour < 11 ? 'morning' : hour >= 11 && hour < 18 ? 'day' : hour >= 18 && hour < 21 ? 'evening' : 'night';
	const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
	return { hour, weekday, month, period, season, event: eventOn(month, Number(parts.day)) };
}
/** `at` is a clock() result or a timestamp; pass the clock when weighing many lines at once. */
function clockWeight(root, at = Date.now()) {
	const { period, weekday, season, event } = typeof at === 'object' ? at : clock(at);
	const types = [...new Set(lineOf(root).flatMap(s => s.types))];
	if (!types.length) return 1;
	const nudge = t => (TIME_OF_DAY[period][t] || 1) * (DAY_OF_WEEK[weekday][t] || 1) * (SEASONS[season][t] || 1);
	if (event) {
		const eventNudge = t => nudge(t) * ((event.types || {})[t] || 1);
		const mean = types.reduce((n, t) => n + eventNudge(t), 0) / types.length;
		const species = (event.species || {})[root.id];
		return Math.max(0.5, Math.min(3, mean)) * (species ? Math.max(1, species) : 1);
	}
	const mean = types.reduce((n, t) => n + nudge(t), 0) / types.length;
	return Math.max(0.6, Math.min(1.6, mean));
}

function weightedPick(entries, rng) {
	const total = entries.reduce((n, e) => n + e.w, 0);
	if (total <= 0) return null;
	let roll = rng() * total;
	for (const e of entries) { roll -= e.w; if (roll < 0) return e.item; }
	return entries[entries.length - 1].item;
}

let rootCache = null;
/** Every line that could ever be met, by its first stage. */
function allRoots() {
	if (rootCache) return rootCache;
	const seen = new Map();
	for (const s of Dex.species.all()) {
		if (!encounterable(s) || isLegendary(s) || s.isCosmeticForme) continue;
		if (s.requiredItem || s.requiredItems) continue;
		const root = rootOf(s);
		if (!seen.has(root.id) && !isLegendary(root)) seen.set(root.id, root);
	}
	rootCache = [...seen.values()];
	return rootCache;
}

/**
 * The level range of what you meet.
 *
 * Badges and level cap are separate things in the RP, so they do separate
 * jobs: badges decide *what* turns up, and the level cap decides how high its
 * level goes - from about 70% of the cap up to the cap itself. Without a cap,
 * the range that usually goes with that many badges.
 */
function levelRange(badges, levelCap, ace = null) {
	let range;
	if (levelCap) {
		const cap = clampLevel(levelCap);
		range = [Math.max(2, Math.round(cap * 0.7)), cap];
	} else {
		range = BADGE_TIERS[badges].levels;
	}
	return ace ? aceAdjusted(range, ace) : range;
}

/**
 * Your ace pulls the wild toward itself. A trainer whose strongest Pokemon sits
 * well under their cap meets somewhat lower levels - and, because levels decide
 * stages, fewer evolved Pokemon and more babies - while one with an ace at the
 * cap meets exactly what the cap says. Never above the range, never below its
 * floor by more than the ace itself is.
 */
function aceAdjusted([lo, hi], ace) {
	ace = clampLevel(ace);
	if (ace >= hi) return [lo, hi];
	const top = Math.max(2, Math.round(hi * 0.6 + ace * 0.4));
	return [Math.max(2, Math.min(lo, Math.round(top * 0.7))), top];
}

/** The level of a trainer's strongest Pokemon that can battle, from the box they sent. */
function aceLevel(box) {
	const levels = (Array.isArray(box) ? box : []).filter(m => m && !m.daycare).map(m => Number(m.level) || 0);
	return levels.length ? Math.max(...levels) : null;
}

// --------------------------------------------------------------- encounters

/**
 * A wild encounter at a place.
 *
 * `place` is an entry from src/encounter-tables: its types, its signature
 * species and its rare surprises. Returns the Pokemon that appeared - one, or
 * two for a double - with sets ready for a team.
 */
/**
 * Shiny odds, for the RP's shop items. 1 in 1024 to begin with - rarer than
 * anything but a legendary, commoner than the games so it happens to somebody
 * in a server's lifetime - a Shiny Charm triples it and a Shiny Spray makes it
 * ten times likelier on top.
 */
function shinyChance({ charm = false, spray = false } = {}) {
	return (1 / 1024) * (charm ? 3 : 1) * (spray ? 10 : 1);
}

// Prized Pokemon (rarity.js PRIZED): a place that lists one as common gets it as a rare find.
const isPrized = root => Rarity.classOf(root) === 'prized';

/**
 * The Boneka a place's table names (`boneka`), as species, for a region that has them.
 * Unknown names, legendary ones and anything that is not a Touhou Pokemon are dropped,
 * and outside TOUHOU_REGIONS there are none at all, whatever a table says.
 */
function bonekaOf(place, region) {
	if (!TOUHOU_REGIONS.has(toID(region))) return [];
	const out = [];
	for (const name of (place && place.boneka) || []) {
		const s = Dex.species.get(name);
		if (!isBoneka(s) || !encounterable(s, { region }) || out.includes(s)) continue;
		out.push(s);
	}
	return out;
}

/**
 * What can turn up at a place, as weighted entries for the first (or only) wild Pokemon:
 * { entries: [{ item, w }], boneka: Set of ids, fromRare: Set of ids, lo, hi }. With
 * Boneka the weights add up to exactly 1 and each Boneka's is BONEKA_SHARE; without,
 * they are the plain pools' weights, untouched, as they have always been.
 */
function wildPool({ place, badges, levelCap = null, now = Date.now(), ace = null, region = null }) {
	badges = clampBadges(badges);
	const [lo, hi] = levelRange(badges, levelCap, ace);
	const rootsOf = list => (list || []).map(n => Dex.species.get(n)).filter(s => s.exists && !isLegendary(s)).map(rootOf);
	// A prized Pokemon a place lists as common is one of its rare finds instead (PRIZED).
	const listed = rootsOf(place.common);
	const common = listed.filter(r => !isPrized(r));
	const rare = [...rootsOf(place.rare), ...listed.filter(isPrized)].filter((r, i, all) => all.findIndex(x => x.id === r.id) === i);
	const special = new Set([...common, ...rare].map(r => r.id));

	/*
	 * Three pools, weighed as pools.
	 *
	 * The place's own Pokemon are over half of what you meet, its rare
	 * surprises a few percent, and everything else of the right type the rest.
	 * Weighing them as individuals instead let two hundred "right type"
	 * Pokemon drown out the five that make a cave feel like that cave.
	 * Inside each pool, badges decide as usual.
	 */
	const time = clock(now);
	const pool = (roots, types) => roots.map(item => ({
		item,
		w: lineWeight(item, { badges, types, maxLevel: hi }) * babyWeight(item, hi) * clockWeight(item, time),
	})).filter(e => e.w > 0);
	const scale = (entries, share) => {
		const total = entries.reduce((n, e) => n + e.w, 0);
		return total > 0 ? entries.map(e => ({ item: e.item, w: e.w / total * share })) : [];
	};
	// Starters, pseudos, Ultra Beasts and Paradox forms live where a place lists
	// them and nowhere else: "anything of the right type" never includes them.
	const typed = pool(allRoots().filter(r => !special.has(r.id) && !isPrized(r) && !Rarity.HEADLINERS.has(Rarity.classOf(r))), place.types || []);
	/*
	 * The surprises get up to 4%, shrunk by how rare they really are. Scaling
	 * them to a flat share let a route whose list is only Bagon and Frigibax
	 * hand out a pseudo one encounter in twenty-five at any badge count; now a
	 * list of ordinary Pokemon keeps the full 4%, a list of starters about half
	 * of it, and pseudos, Ultra Beasts and Paradox forms less again - and less
	 * still for a trainer short on badges.
	 */
	const rarePool = pool(rare, []);
	const rareMean = rarePool.length ? rarePool.reduce((n, e) => n + e.w, 0) / rarePool.length : 0;
	const fromRare = new Set(rarePool.map(e => e.item.id));
	let entries = [
		...scale(pool(common, []), common.length ? 0.55 : 0),
		...scale(rarePool, 0.04 * Math.min(1, rareMean * 25)),
		...scale(typed, 0.41),
	];
	const boneka = bonekaOf(place, region);
	if (boneka.length) {
		// Each Boneka exactly BONEKA_SHARE; everything else keeps its proportions in what is left.
		const left = Math.max(0, 1 - BONEKA_SHARE * boneka.length);
		const total = entries.reduce((n, e) => n + e.w, 0);
		entries = [
			...entries.map(e => ({ item: e.item, w: total > 0 ? e.w / total * left : 0 })),
			...boneka.map(s => ({ item: s, w: BONEKA_SHARE })),
		];
	}
	return { entries, boneka: new Set(boneka.map(s => s.id)), fromRare, lo, hi, badges };
}

function rollWild({ place, badges, levelCap = null, rng = Math.random, double = null, shiny = {}, now = Date.now(), ace = null, region = null }) {
	const pooled = wildPool({ place, badges, levelCap, now, ace, region });
	const { entries, fromRare, lo, hi } = pooled;
	badges = pooled.badges;
	const count = double === null ? (badges >= 1 && rng() < 0.12 ? 2 : 1) : (double ? 2 : 1);
	const team = [];
	const taken = new Set();
	for (let i = 0; i < count; i++) {
		// A Boneka is met alone: never as the second of a double (that would make it more than 1%).
		const root = weightedPick(entries.filter(e => !taken.has(e.item.id) && !(i > 0 && pooled.boneka.has(e.item.id))), rng);
		if (!root) break;
		taken.add(root.id);
		const level = randInt(lo, hi, rng);
		if (pooled.boneka.has(root.id)) {
			const set = bonekaSet(root, level, rng);
			if (rng() < shinyChance(shiny)) set.shiny = true;
			// The rare wild theme where the client has no theme for it (it plays the character's own).
			set.rare = true;
			team.push(set);
			break;
		}
		const species = stageFor(root, level, rng, { ahead: 0.04 });
		const set = wildSet(species, level, rng);
		if (rng() < shinyChance(shiny)) set.shiny = true;
		// Met from the place's rare list: the battle plays the rare wild theme (rp-server musicFor).
		if (fromRare.has(root.id)) set.rare = true;
		if (rng() < 0.05) set.item = pick(['Oran Berry', 'Sitrus Berry', 'Pecha Berry', 'Nugget', 'Big Mushroom', 'Pearl', 'Stardust'], rng);
		team.push(set);
	}
	return {
		kind: 'wild',
		double: team.length === 2,
		name: team.length === 2 ? 'Wild Pokemon' : wildName(Dex.species.get(team[0].species)),
		avatar: '',
		team,
		ai: badges >= 6 ? 'hard' : badges >= 3 ? 'normal' : 'easy',
		format: team.length === 2 ? WILD_DOUBLE_FORMAT : WILD_FORMAT,
		badges,
	};
}

const TYPE_ITEMS = {
	Normal: 'Silk Scarf', Fire: 'Charcoal', Water: 'Mystic Water', Grass: 'Miracle Seed', Electric: 'Magnet',
	Ice: 'Never-Melt Ice', Fighting: 'Black Belt', Poison: 'Poison Barb', Ground: 'Soft Sand', Flying: 'Sharp Beak',
	Psychic: 'Twisted Spoon', Bug: 'Silver Powder', Rock: 'Hard Stone', Ghost: 'Spell Tag', Dragon: 'Dragon Fang',
	Dark: 'Black Glasses', Steel: 'Metal Coat', Fairy: 'Fairy Feather',
};

/**
 * A trainer met at a place.
 *
 * The class comes from the place (Hikers on mountains, Swimmers at sea), the
 * team from the class's types and the badge count, weighted the same way wild
 * Pokemon are - so low badges mean mostly low-tier Pokemon, with the odd
 * surprise - and a trainer who could have evolved something has.
 */
/*
 * The type of every gym, by its channel. A trainer met inside a gym is one of the
 * gym's own: a class that fits its type (or an Ace Trainer), with a team of that
 * type. Before (1 Oct 2026) a gym channel rolled its town's route trainers, so the
 * Rock gym at Tidecall was full of Swimmers and Sailors with Water teams.
 */
const GYM_TYPES = {
	// Kagura
	'tide-gym': 'Water', 'harvest-gym': 'Grass', 'lantern-gym': 'Ghost', 'crown-gym': 'Psychic',
	'caldera-gym': 'Fire', 'storm-gym': 'Electric', 'stack-gym': 'Rock', 'moonless-gym': 'Dark',
	// Sinnoh
	'oreburgh-gym': 'Rock', 'eterna-gym': 'Grass', 'veilstone-gym': 'Fighting', 'pastoria-gym': 'Water',
	'hearthome-gym': 'Ghost', 'canalave-gym': 'Steel', 'snowpoint-gym': 'Ice', 'sunyshore-gym': 'Electric',
	// Gensokyo (the atlas's first draft, regions/gensokyo.js GYMS)
	'hakurei-gym': 'Fairy', 'scarlet-gym': 'Dark', 'moriya-gym': 'Flying', 'eientei-gym': 'Psychic',
	'hakugyokurou-gym': 'Ghost', 'chireiden-gym': 'Fire', 'myouren-gym': 'Fighting', 'sunflower-gym': 'Grass',
};
/** The place as a gym's trainers see it, or the place unchanged outside a gym. */
function gymPlace(place, channel) {
	const type = GYM_TYPES[String(channel || '').replace(/^#/, '').toLowerCase()];
	if (!type) return place;
	const fits = TRAINER_CLASSES.filter(c => !c.story && !c.pair && (c.types || [])[0] === type).map(c => c.id);
	return { ...place, gymType: type, types: [type], trainers: [...new Set([...fits, 'acetrainer', 'acetrainerf'])] };
}

/*
 * Trainers meet the player's team, not just their badges (owner, 1 Oct 2026: "trainers
 * arent nearly hard enough... for new trainer its cool but once u have more pokemons").
 * Out of 71 route trainer battles the trainers had won none: they brought 2-3 Pokemon
 * at or under the player's levels against a full six. Now a player bringing three or
 * more meets that many (a full six meets five or six), around their own levels, with
 * Pokemon and a brain as strong as the badge tier their levels belong to. Badges stay
 * the floor, so a new trainer's first battles are as gentle as before.
 *
 * party: { size, avg, max } of what the player brings (rp-server partyOf), or null.
 */
const AI_ORDER = ['easy', 'normal', 'hard', 'champion'];
function tierForLevel(level) {
	let t = 0;
	for (let i = 0; i < BADGE_TIERS.length; i++) if (BADGE_TIERS[i].levels[0] <= level) t = i;
	return t;
}
/*
 * Variety: what each place's trainers brought lately, so the next one there brings
 * something else (a sea town sent Wailmer five times in a row). Kept per place for
 * the last 30 Pokemon; a repeat is a quarter as likely.
 */
const recentAt = new Map();

/**
 * Which class a trainer met at a place is: the one asked for, or one of the place's,
 * then the troll and Gap Wanderer rolls off the same random number (route trainers only).
 * `badges` are the player's own.
 */
function trainerClassFor({ place, badges = 0, rng = Math.random, classId = null, cls: givenClass = null }) {
	const classes = (place && place.trainers && place.trainers.length ? place.trainers : ['youngster', 'lass', 'hiker', 'backpacker'])
		.map(findClass).filter(c => c && !c.story);   // a route never sends a Champion at random
	let cls = givenClass || (classId && findClass(classId)) || pick(classes, rng);
	// Nobody is safe at any badge count: badges only make the troll's Pokemon stronger.
	if (!givenClass && !classId && !(place && place.gymType)) {
		const types = (place && place.types) || [];
		const bombers = types.includes('Fire') ? TROLL_HOME_CHANCE : LARPER_CHANCE;
		const larpers = types.includes('Psychic') ? TROLL_HOME_CHANCE : LARPER_CHANCE;
		const roll = rng();
		if (roll < bombers) cls = findClass('terrorist');
		else if (roll < bombers + larpers) cls = findClass('larper');
		else if (roll >= 1 - gapWandererChance(badges)) cls = findClass('gapwanderer');
	}
	return cls;
}

/*
 * Gensokyo is the hard-mode region (owner, 21 Oct 2026): every trainer there brings a
 * full six, whatever the badges, and at least one of them is a Boneka (ensureBoneka).
 * Levels still follow the badges. Kagura is unchanged.
 */
function rollTrainer(opts) {
	const gensokyo = TOUHOU_REGIONS.has(toID(opts.region));
	const rolled = rollTrainerTeam({ ...opts, fullTeam: gensokyo });
	if (gensokyo && rolled && Array.isArray(rolled.team)) {
		ensureBoneka(rolled.team, { place: opts.place, cls: findClass(rolled.classId), badges: clampBadges(opts.badges), rng: opts.rng || Math.random });
	}
	// Gensokyo's trainers, and the Gap Wanderer who comes from there, show their whole team
	// with Moemon sprites where one exists (the owner, 28 Oct 2026; client/js/velvet-moemon.js).
	if ((gensokyo || rolled && rolled.classId === 'gapwanderer') && rolled && Array.isArray(rolled.team)) {
		for (const set of rolled.team) if (set && !set.pokeball) set.pokeball = 'Moemon';
	}
	return rolled;
}

let bonekaCache = null;
/** Every Boneka a trainer could carry: Touhou base species, not legendary, no item needed. */
function allBoneka() {
	if (!bonekaCache) bonekaCache = Dex.species.all().filter(s => isBoneka(s) && s.baseSpecies === s.name && !s.battleOnly && !s.requiredItem);
	return bonekaCache;
}

/** A trainer's Boneka: bonekaMoves for its level, IVs, EVs and items by badges as trainerSet deals them. */
function bonekaTrainerSet(species, level, badges, rng) {
	const iv = Math.min(31, 8 + badges * 3);
	let item = '';
	if (badges >= 6) item = pick(['Sitrus Berry', 'Leftovers', 'Lum Berry', TYPE_ITEMS[species.types[0]]], rng);
	else if (badges >= 3 && rng() < 0.5) item = 'Oran Berry';
	const set = {
		name: species.name, species: species.name, level: clampLevel(level),
		moves: bonekaMoves(species, clampLevel(level), rng),
		ability: abilityFor(species, rng, badges >= 6 ? 0.3 : 0.05),
		nature: pick(NATURES, rng), item,
		ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
	};
	set.evs = EV.spreadFor(Dex, set, EV.trainerBudget(badges));
	set.evs = EV.fitToLevel(Dex, set);
	return set;
}

/**
 * At least one Boneka on a Gensokyo trainer's team (owner, 21 Oct 2026). One that lives
 * at this place and fits the class (or gym) type first, then one that lives here, then
 * any that fits the type, then any. It takes a slot other than the ace's, at that
 * slot's level. Changes the team in place and returns it.
 */
function ensureBoneka(team, { place = null, cls = null, badges = 0, rng = Math.random } = {}) {
	if (!Array.isArray(team) || !team.length || team.some(m => isBoneka(m.species))) return team;
	const home = [...((place && place.boneka) || []), ...Object.values((place && place.spots) || {}).flatMap(sp => sp.boneka || [])]
		.map(n => Dex.species.get(n)).filter(s => isBoneka(s));
	const want = place && place.gymType ? [place.gymType] : ((cls && cls.types) || []);
	const fits = list => list.filter(s => s.types.some(t => want.includes(t)));
	const pool = [fits(home), home, fits(allBoneka()), allBoneka()].find(l => l.length);
	if (!pool) return team;
	const taken = new Set(team.map(m => toID(m.species)));
	const choices = pool.filter(s => !taken.has(s.id));
	const species = pick(choices.length ? choices : pool, rng);
	const slot = team.length > 1 ? randInt(0, team.length - 2, rng) : 0;
	team[slot] = bonekaTrainerSet(species, team[slot].level, badges, rng);
	return team;
}

function rollTrainerTeam({ place, badges, levelCap = null, rng = Math.random, classId = null, cls: givenClass = null, double = null, ace = null, party = null, fullTeam = false }) {
	badges = clampBadges(badges);
	const realBadges = badges;
	const grown = party && party.size >= 3 ? party : null;
	if (grown) badges = Math.max(badges, tierForLevel(grown.avg));
	const cls = trainerClassFor({ place, badges: realBadges, rng, classId, cls: givenClass });
	const tier = BADGE_TIERS[badges];
	// The stall Ace Trainer battles single unless a double is asked for: stall is a singles game.
	const isDouble = cls.pair || (double === null ? !cls.stall && !cls.troll && badges >= 1 && rng() < 0.15 : !!double);
	// A troll always brings six, whatever the badges (owner, 12 Oct 2026).
	const size = cls.troll || cls.gap || fullTeam ? 6 : Math.min(6, Math.max(isDouble ? 2 : 1, tier.size, grown ? (grown.size >= 6 ? (rng() < 0.5 ? 5 : 6) : grown.size) : 0));

	// The ace pulls a trainer down the same way it pulls the wild: somebody whose best
	// Pokemon is far under their cap is not handed a full-cap team to lose to.
	let [lo, hi] = levelRange(realBadges, levelCap, ace);
	// Around the player's own levels: the ace at their best, the rest near their average.
	// (These lines sat in rollWild by mistake for a day, 1 Oct 2026: every wild roll threw.)
	if (grown) {
		hi = Math.max(hi, Math.round(grown.max));
		lo = Math.min(hi, Math.max(lo, Math.round(grown.avg) - 2));
	}
	/*
	 * A trainer has a theme, not a class's whole list (24 Sep 2026). A Kimono
	 * Girl's six types or a Youngster's four made a team of six unrelated
	 * Pokemon; a real trainer of that class favours one or two of them. The
	 * first types listed are the class's own, so they are the likelier focus;
	 * the rest of the list still turns up, less often.
	 */
	const gymType = place && place.gymType;
	const focus = gymType ? [gymType] : themeOf(cls.types || [], rng);
	const ctx = { badges, types: gymType ? [gymType] : cls.types, maxLevel: hi };
	// The place still counts: a Backpacker on a volcano brings fire types more
	// often than one at the harbour.
	const placeTypes = (place && place.types) || [];
	const placeKey = (place && place.name) || '';
	const recentList = recentAt.get(placeKey) || [];
	const recent = new Set(recentList);
	const entries = allRoots().map(item => {
		let w = lineWeight(item, ctx);
		if (w > 0 && placeTypes.length && lineOf(item).some(s => s.types.some(t => placeTypes.includes(t)))) w *= 1.5;
		if (w > 0 && focus.length && lineOf(item).some(s => s.types.some(t => focus.includes(t)))) w *= 4;
		if (w > 0 && recent.has(item.id)) w *= 0.25;
		return { item, w };
	}).filter(e => e.w > 0)
		// In a gym, only the gym's type (while there are enough lines of it at these badges).
		.filter((e, i, all) => !gymType || all.filter(x => lineOf(x.item).some(s => s.types.includes(gymType))).length < 4 ||
			lineOf(e.item).some(s => s.types.includes(gymType)));

	/*
	 * Patch 1.5: a trainer brings a *team*. More Pokemon are rolled than fit,
	 * the same way as before, and the team assembler picks the ones and the
	 * roles that fit together, as strictly as the badges call for: sensible
	 * movesets from the start, the basics (no pile of shared weaknesses, both
	 * attacking sides) from three badges, the whole checklist from six. A type
	 * specialist keeps its types, so shared weaknesses are its theme, not a flaw.
	 */
	const levels = [];
	/*
	 * The stall Ace Trainer (owner, 24 Sep 2026: "also add a stall trainer for
	 * ace trainers in rp"). An Ace Trainer met from six badges on brings a
	 * dedicated stall team one time in four (ACE_STALL_CHANCE), and the one
	 * summoned by name always does, from four badges - where trainers start
	 * to know recovery, hazards and status moves (trainerMoves). Same badge
	 * rules as every trainer: its Pokemon come from the badge-weighted lines,
	 * its levels, moves, IVs and EVs are dealt as trainerTeam() deals them.
	 * Anything short of a real stall team (too few walls this early) and it
	 * brings an ordinary team instead.
	 */
	const stall = !isDouble && badges >= 4 && (cls.stall || (ACE_CLASSES.includes(cls.id) && badges >= 6 && rng() < ACE_STALL_CHANCE));
	let team = null;
	if (stall) {
		for (let i = 0; i < size; i++) levels.push(i === size - 1 ? hi : randInt(Math.max(lo, hi - 5), Math.max(lo, hi - 1), rng));
		levels.sort((a, b) => a - b);
		try { team = stallTrainerTeam(entries, levels, badges, rng); } catch (e) { team = null; }
		if (team) {
			return {
				kind: 'trainer', double: false, name: trainerName(cls, rng), avatar: cls.avatar, className: cls.title, classId: cls.id,
				team, ai: tier.ai, format: TRAINER_FORMAT, badges: realBadges, style: 'stall',
			};
		}
		levels.length = 0;
	}
	// The Gap Wanderer: six different Boneka, levelled like any trainer's team.
	if (cls.gap) {
		for (let i = 0; i < size; i++) levels.push(i === size - 1 ? hi : randInt(Math.max(lo, hi - 5), Math.max(lo, hi - 1), rng));
		levels.sort((a, b) => a - b);
		const left = allBoneka().slice();
		const gapTeam = levels.map(level => bonekaTrainerSet(left.splice(Math.floor(rng() * left.length), 1)[0], level, badges, rng));
		let ai = tier.ai;
		if (grown) ai = AI_ORDER[Math.min(AI_ORDER.length - 1, AI_ORDER.indexOf(ai) + (grown.size >= 6 ? 2 : grown.size >= 4 ? 1 : 0))] || ai;
		return {
			kind: 'trainer', double: isDouble, name: trainerName(cls, rng), avatar: cls.avatar, className: cls.title, classId: cls.id,
			team: gapTeam, ai, format: isDouble ? TRAINER_DOUBLE_FORMAT : TRAINER_FORMAT, badges: realBadges, intro: cls.intro,
		};
	}
	if (cls.troll) {
		for (let i = 0; i < size; i++) levels.push(i === size - 1 ? hi : randInt(Math.max(lo, hi - 5), Math.max(lo, hi - 1), rng));
		levels.sort((a, b) => a - b);
		const troll = trollTrainerTeam(entries, levels, badges, rng, cls.trollTheme, { bombers: !!cls.bombers });
		if (troll) {
			return {
				kind: 'trainer', double: isDouble, name: trainerName(cls, rng), avatar: cls.avatar, className: cls.title, classId: cls.id,
				// Played to annoy, whatever the badges (ai.js trollChoice).
				team: troll.team, ai: 'troll', format: isDouble ? TRAINER_DOUBLE_FORMAT : TRAINER_FORMAT, badges: realBadges,
				style: 'troll', theme: troll.theme,
			};
		}
		levels.length = 0;
	}
	const rolled = [];
	const taken = new Set();
	for (let i = 0; i < Math.min(12, size * 2); i++) {
		const root = weightedPick(entries.filter(e => !taken.has(e.item.id)), rng);
		if (!root) break;
		taken.add(root.id);
		rolled.push(root);
	}
	for (let i = 0; i < size; i++) levels.push(i === size - 1 ? hi : randInt(Math.max(lo, hi - 5), Math.max(lo, hi - 1), rng));
	levels.sort((a, b) => a - b);
	try {
		team = trainerTeam(rolled, levels, badges, rng, { themed: !!(cls.types && cls.types.length) });
	} catch (e) {
		team = null;
	}
	if (!team || team.length < Math.min(size, rolled.length)) {
		team = [];
		for (let i = 0; i < size && i < rolled.length; i++) {
			const level = levels[i];
			// Trainers evolve what they can: never one stage behind.
			team.push(trainerSet(stageFor(rolled[i], level, rng, { behind: 0.1 }), level, badges, rng));
		}
	}
	// Remember them, for the next trainer here.
	for (const set of team) {
		try { recentList.push(rootOf(Dex.species.get(set.species)).id); } catch (e) { /* unknown: skip */ }
	}
	recentAt.set(placeKey, recentList.slice(-30));
	// A bigger team plays smarter: one step up from four, two from a full six.
	let ai = tier.ai;
	if (grown) ai = AI_ORDER[Math.min(AI_ORDER.length - 1, AI_ORDER.indexOf(ai) + (grown.size >= 6 ? 2 : grown.size >= 4 ? 1 : 0))] || ai;
	return {
		kind: 'trainer',
		double: isDouble,
		name: trainerName(cls, rng),
		avatar: cls.avatar,
		className: cls.title,
		classId: cls.id,
		team,
		ai,
		format: isDouble ? TRAINER_DOUBLE_FORMAT : TRAINER_FORMAT,
		badges: realBadges,
	};
}

/** One or two of a class's types for this trainer to favour: the first listed most often. */
function themeOf(types, rng) {
	if (types.length <= 2) return types.slice();
	const weights = types.map((t, i) => ({ item: t, w: 1 / (i + 1) }));
	const first = weightedPick(weights, rng);
	if (rng() < 0.5) return [first];
	const second = weightedPick(weights.filter(e => e.item !== first), rng);
	return [first, second].filter(Boolean);
}

/**
 * The moves a trainer's Pokemon may know: everything it has learned by level
 * up to now, then with badges what a trainer would have taught it - attacks
 * up to a power cap and the support moves at four, anything it learns at six.
 */
function trainerMoves(species, level, badges) {
	// A forme's own list is often just its signature (Rotom-Fan: Air Slash): the base forme's counts too.
	const learnset = {};
	for (let s = species, i = 0; s && s.exists && i < 4; i++) {
		const data = Dex.species.getLearnsetData(s.id);
		for (const [id, sources] of Object.entries((data && data.learnset) || {})) learnset[id] = (learnset[id] || []).concat(sources);
		const next = s.changesFrom || (s.baseSpecies !== s.name ? s.baseSpecies : null);
		s = next ? Dex.species.get(next) : null;
	}
	let gen = 0;
	for (const sources of Object.values(learnset)) {
		for (const src of sources) { const m = /^(\d+)L/.exec(src); if (m) gen = Math.max(gen, Number(m[1])); }
	}
	const legal = new Set();
	for (const [id, sources] of Object.entries(learnset)) {
		const move = Dex.moves.get(id);
		if (!move.exists || move.isNonstandard || move.isZ || move.isMax) continue;
		const byLevel = sources.some(src => { const m = /^(\d+)L(\d+)$/.exec(src); return m && Number(m[1]) === gen && Number(m[2]) <= level; });
		if (byLevel || badges >= 6) { legal.add(id); continue; }
		if (badges >= 4) {
			const cap = badges >= 5 ? 90 : 75;
			if (move.category === 'Status' ? RS.UTILITY.concat(RS.RECOVERY, RS.HAZARDS, RS.STATUS, RS.PIVOTS, RS.SETUP).includes(id)
				: move.basePower <= cap && (move.accuracy === true || move.accuracy >= 85)) legal.add(id);
		}
	}
	return legal;
}

/** A trainer's team from its rolled lines, by the team assembler. Null when it cannot build one. */
function trainerTeam(roots, levels, badges, rng, { themed = false } = {}) {
	const stage = TL.stageFor(badges);
	const ace = levels[levels.length - 1];
	const candidates = roots.map((root, i) => {
		// Candidates are levelled as the ace would be at worst; the real levels are dealt below.
		const level = levels[Math.min(i, levels.length - 1)] || ace;
		const species = stageFor(root, level, rng, { behind: 0.1 });
		const legal = trainerMoves(species, level, badges);
		const bst = Object.values(species.baseStats).reduce((a, b) => a + b, 0);
		return { species: species.name, level, legal: legal.size ? legal : null, strength: bst, ref: species };
	});
	const built = TeamAssembler.assemble(Dex, candidates, {
		size: levels.length, stage, themed, rng,
		items: badges >= 6 ? true : false,
		// Low badges: raw strength matters less, so an early team is not just its biggest Pokemon.
		strengthWeight: badges >= 6 ? 25 : 15,
		roles: badges >= 3 ? 3 : 1,
		maxEvaluations: 1500,
	});
	if (!built.length) return null;
	return dealTrainerTeam(built, levels, badges, rng);
}

/*
 * The stall Ace Trainer's team (see rollTrainer): stall-worthy Pokemon from
 * the same badge-weighted lines every trainer draws from - many more of them
 * than fit, since only the bulky ones that heal can be used - evolved as far
 * as the ace's level allows, each knowing what trainerMoves() says a trainer
 * with these badges has taught it. Null when they do not make a real stall
 * team (src/stall-builder.js stallReport).
 */
function stallTrainerTeam(entries, levels, badges, rng) {
	const SB = require('./stall-builder');
	const top = levels[levels.length - 1];
	const pool = [];
	const legal = new Map();
	const taken = new Set();
	for (let i = 0; i < 160 && pool.length < 90; i++) {
		const root = weightedPick(entries.filter(e => !taken.has(e.item.id)), rng);
		if (!root) break;
		taken.add(root.id);
		const species = stageFor(root, top, rng, { behind: 0 });
		if (legal.has(species.id)) continue;
		legal.set(species.id, trainerMoves(species, top, badges));
		pool.push({ species, level: top });
	}
	const built = SB.build(Dex, pool, {
		size: levels.length, rng, level: top, tera: false,
		// Items from six badges, as for every trainer; none of them one-use (no Oran Berry) on stall.
		items: badges >= 6 ? null : false,
		learn: (species, id) => (legal.get(species.id) || new Set()).has(id),
	});
	if (!built || built.length < levels.length || !SB.stallReport(Dex, built).ok) return null;
	return dealTrainerTeam(built, levels, badges, rng, { stall: true });
}

/*
 * A Larper's troll team: one gimmick the whole team is built around. The
 * gimmick move comes from anywhere in the Pokemon's learnset (that is the joke,
 * and the point of the class); its other moves are what any trainer with these
 * badges would have taught it. A theme that can't field the whole team at these
 * badges is passed over for another. Null when none can.
 */
const PROTECT_SLOT = ['banefulbunker', 'spikyshield', 'kingsshield', 'protect', 'detect'];
const HEAL_SLOT = ['recover', 'roost', 'softboiled', 'slackoff', 'milkdrink', 'shoreup', 'synthesis', 'moonlight', 'morningsun', 'strengthsap', 'wish', 'rest'];
const TROLL_THEMES = [
	{ id: 'explosion', keys: ['explosion', 'selfdestruct', 'mistyexplosion'], extra: ['protect', 'substitute'] },
	/*
	 * Perish Song is only worth anything on something that can't leave (owner, 12 Oct 2026):
	 * a singer brings its own trap and a Protect to wait the count out behind.
	 */
	{ id: 'perish', keys: ['perishsong'], alt: ['meanlook', 'block', 'spiderweb', 'protect', 'destinybond'],
		slots: [['meanlook', 'block', 'spiderweb'], PROTECT_SLOT], needs: 1, fewest: 3, extra: [] },
	{ id: 'evasion', keys: ['doubleteam', 'minimize'], extra: ['swagger', 'attract', 'confuseray', 'batonpass'] },
	/*
	 * Trapped, then stalled to death: Block, Toxic, Protect and a heal, the Block-Toxapex way.
	 * A stall Pokemon that can't trap still fits beside the trappers (alt), on Toxic.
	 */
	{ id: 'trap', keys: ['meanlook', 'block', 'spiderweb'], alt: ['toxic', 'leechseed'],
		slots: [['toxic', 'leechseed', 'willowisp'], PROTECT_SLOT, HEAL_SLOT], extra: [] },
	{ id: 'memento', keys: ['memento', 'healingwish', 'finalgambit', 'destinybond'], extra: ['taunt', 'encore'] },
	{ id: 'ditto' },
	{ id: 'splash' },
];

const ATE = ['Galvanize', 'Aerilate', 'Refrigerate', 'Pixilate'];
const ateOf = species => Object.values(species.abilities || {}).find(a => ATE.includes(a)) || null;
const EXPLOSIONS = ['explosion', 'selfdestruct', 'mistyexplosion'];
/*
 * Self-Destruct only earns a bomber its place when it averages 80% or more on what this
 * trainer's route commonly fields at these levels (owner, 12 Oct 2026). Explosion always
 * does and is taken over it whenever both are learned; so does Misty Explosion, at 200
 * power with Special Defense halved.
 */
const WEAK_BOOM_FLOOR = 80;
let boomCalc = null;
const boomCache = new Map();
function boomAverage(species, moveId, level, ability, targets) {
	const key = `${species.id}|${moveId}|${level}|${ability}|${targets.map(t => t.id).join(',')}`;
	if (boomCache.has(key)) return boomCache.get(key);
	if (!boomCalc) {
		const calc = require('@smogon/calc');
		boomCalc = { calc, gen: calc.Generations.get(9) };
	}
	const { calc, gen } = boomCalc;
	let total = 0, counted = 0;
	for (const target of targets) {
		try {
			const result = calc.calculate(gen,
				new calc.Pokemon(gen, species.name, { level, ability, nature: 'Hardy' }),
				new calc.Pokemon(gen, target.name, { level, nature: 'Hardy' }),
				// Our booms halve the defending stat (classic-mechanics.js): the same as double power.
				new calc.Move(gen, Dex.moves.get(moveId).name, { overrides: { basePower: Dex.moves.get(moveId).basePower * 2 } }));
			const rolls = [].concat(result.damage).map(Number);
			const hp = result.defender.maxHP();
			total += Math.min(100, (rolls.reduce((a, b) => a + b, 0) / rolls.length) / hp * 100);
			counted++;
		} catch (e) { /* a Pokemon the calculator doesn't know: left out */ }
	}
	const avg = counted ? total / counted : 0;
	boomCache.set(key, avg);
	return avg;
}

const DARK_COVERAGE = ['knockoff', 'crunch', 'suckerpunch', 'darkpulse', 'foulplay', 'throatchop', 'payback', 'nightslash', 'bite', 'assurance', 'feintattack', 'thief', 'snarl'];

/*
 * The lines whose Explosion comes out another type (Galvanize: Alolan Geodude's; an -ate
 * only turns Normal moves, so not Misty Explosion).
 * Out of the battle only: a Mega's ability is not one a set can be given.
 */
let ateBomberCache = null;
function ateBombers() {
	if (!ateBomberCache) {
		ateBomberCache = Dex.species.all().filter(sp => sp.exists && !sp.prevo && !sp.battleOnly && !sp.isMega &&
			lineOf(sp).some(st => ateOf(st) && EXPLOSIONS.some(k => trainerMoves(st, 100, 6).has(k))));
	}
	return ateBomberCache;
}

/*
 * The Terrorist's kit (owner, 12 Oct 2026): a slow bomber that can't take a hit wears a
 * Choice Scarf at full Speed, so it goes off first; one with nothing to do but attack wears
 * a Choice Band (Specs for Misty Explosion) for the bigger boom; one with a job besides
 * wears Safety Goggles, so a Spore can't stop it, or Endure and a Custap Berry: it lives
 * through the hit and goes off first on what is left. An -ate ability whenever it has one.
 * Locked into a choice, Protect and Substitute are only dead moves.
 */
const BOMBER_FILLER = new Set(['protect', 'detect', 'substitute', 'endure']);
function armBombers(team, rng, badges = 0) {
	for (const set of team) {
		const species = Dex.species.get(set.species);
		const ate = ateOf(species);
		if (ate) set.ability = ate;
		const b = species.baseStats;
		const moves = set.moves.map(m => Dex.moves.get(m));
		const bomb = moves.find(m => EXPLOSIONS.includes(m.id));
		const job = moves.some(m => m.category === 'Status' && !BOMBER_FILLER.has(m.id));
		const choice = b.spe < 80 && b.hp + (b.def + b.spd) / 2 < 170 ? 'Choice Scarf' :
			!job ? (bomb && bomb.category === 'Special' ? 'Choice Specs' : 'Choice Band') : null;
		if (!choice) {
			const endure = !set.moves.some(m => toID(m) === 'endure') && trainerMoves(species, set.level, 6).has('endure');
			if ((endure || set.moves.some(m => toID(m) === 'endure')) && rng() < 0.5) {
				set.item = 'Custap Berry';
				if (endure) {
					const spare = moves.findIndex(m => BOMBER_FILLER.has(m.id)) >= 0 ? moves.findIndex(m => BOMBER_FILLER.has(m.id)) :
						moves.findIndex(m => m.category === 'Status');
					if (set.moves.length < 4) set.moves.push('Endure');
					else set.moves[spare >= 0 ? spare : 3] = 'Endure';
				}
			} else {
				set.item = 'Safety Goggles';
			}
			set.evs = EV.spreadFor(Dex, set, EV.bomberBudget(badges));
			continue;
		}
		set.item = choice;
		set.moves = moves.filter(m => m.category !== 'Status').map(m => m.name);
		// Bombers bring twice a trainer's EVs, the boom stat first (12 Oct 2026); a scarfer then Speed.
		set.evs = EV.spreadFor(Dex, set, EV.bomberBudget(badges));
		if (choice === 'Choice Scarf') {
			set.evs.spe = 252;
			set.ivs.spe = 31;
			set.nature = bomb && bomb.category === 'Special' ? 'Timid' : 'Jolly';
		}
	}
	return team;
}

/*
 * A frail Final Gambit or Destiny Bond user wears a Choice Scarf at full Speed: it goes
 * first and takes the foe with it (owner, 12 Oct 2026).
 */
function scarfGamblers(team, badges = 0) {
	for (const set of team) {
		const b = Dex.species.get(set.species).baseStats;
		const ids = set.moves.map(toID);
		if (!(ids.includes('finalgambit') || ids.includes('destinybond')) || b.hp + (b.def + b.spd) / 2 >= 170) continue;
		set.item = 'Choice Scarf';
		set.moves = set.moves.filter(m => toID(m) === 'finalgambit' || toID(m) === 'destinybond' || Dex.moves.get(m).category !== 'Status');
		// Speed to go first, then HP: Final Gambit hits for the HP it has.
		const budget = EV.bomberBudget(badges);
		set.evs = { hp: Math.min(252, Math.max(0, budget - 252)), atk: 0, def: 0, spa: 0, spd: 0, spe: Math.min(252, budget) };
		set.ivs.spe = 31;
		set.nature = 'Timid';
	}
}

/*
 * One troll trainer in twenty brings a box-art legendary as its ace (owner, 12 Oct 2026),
 * played as a joke: a real troll set when it has one (stall Lugia: Toxic, Protect, Roost),
 * otherwise (and half the time anyway) its weakest attacks - Water Gun Kyogre. It goes out
 * as "Wild Lugia": "Larper Ballsack sent out Wild Lugia!".
 */
const BOXART_TROLL_CHANCE = 0.05;
let boxartCache = null;
function trollLegend(team, rng, { bombs = false } = {}) {
	if (!boxartCache) {
		boxartCache = Dex.species.all().filter(sp => sp.exists && !sp.battleOnly && !sp.isMega && sp.baseSpecies === sp.name &&
			!sp.isNonstandard && Rarity.classOf(sp.name) === 'boxart');
	}
	if (!boxartCache.length) return;
	const ace = team[team.length - 1];
	const species = boxartCache[Math.floor(rng() * boxartCache.length)];
	const all = trainerMoves(species, ace.level, 6);
	const first = list => list.find(m => all.has(m));
	const status = first(['toxic', 'leechseed', 'willowisp']);
	const shield = first(PROTECT_SLOT);
	const heal = first(HEAL_SLOT);
	let moves = null;
	// Half the time the joke set, even when a troll set is there to be had.
	if (rng() < 0.5) {
		// left null: the feeble attacks below
	} else if (status && shield && heal) {
		moves = [status, shield, heal, first(['meanlook', 'block', 'spiderweb', 'whirlwind', 'roar', 'haze']) || first(['perishsong', 'substitute'])];
	} else if (first(['perishsong']) && first(['meanlook', 'block', 'spiderweb']) && shield) {
		moves = ['perishsong', first(['meanlook', 'block', 'spiderweb']), shield, heal];
	} else if (bombs && first(EXPLOSIONS)) {
		moves = [first(EXPLOSIONS), first(['doubleteam', 'minimize']), shield, first(DARK_COVERAGE)];
	}
	if (!moves) {
		// Its feeblest attacks, its own type first among equals: Water Gun, Tackle, Ember.
		const weak = [...all].map(id => Dex.moves.get(id))
			.filter(m => m.category !== 'Status' && m.basePower > 0 && !m.damageCallback && !m.basePowerCallback && !m.multihit)
			.sort((a, b) => a.basePower - b.basePower || species.types.includes(b.type) - species.types.includes(a.type));
		moves = weak.slice(0, 4).map(m => m.id);
	}
	moves = [...new Set(moves.filter(Boolean))];
	if (!moves.length) return;
	team[team.length - 1] = {
		...ace, name: `Wild ${species.name}`.slice(0, 18), species: species.name, item: '',
		moves: moves.map(m => Dex.moves.get(m).name), ability: abilityFor(species, rng, 0), nature: pick(NATURES, rng),
	};
}

function trollTrainerTeam(entries, levels, badges, rng, only = null, { bombers = false } = {}) {
	const top = levels[levels.length - 1];
	const size = levels.length;
	// Explosion is the Terrorist's (bombers): a Larper never builds around it.
	const themes = only ? TROLL_THEMES.filter(t => t.id === only) : TROLL_THEMES.filter(t => bombers || t.id !== 'explosion').sort(() => rng() - 0.5);
	for (const theme of themes) {
		let built = null;
		if (theme.id === 'ditto') {
			const ditto = Dex.species.get('Ditto');
			built = levels.map(() => ({ species: ditto.name, moves: ['transform'], ability: 'Imposter', nature: pick(NATURES, rng), item: '' }));
		} else if (theme.id === 'splash') {
			// Magikarp that only Splash, and the one at the back has already evolved.
			const karp = levels.map(() => ({ species: 'Magikarp', moves: ['splash', 'tackle', 'flail'], ability: 'Swift Swim', nature: pick(NATURES, rng), item: '' }));
			if (top >= minLevelOf(Dex.species.get('Gyarados'))) {
				const ace = trainerSet(Dex.species.get('Gyarados'), top, badges, rng);
				karp[karp.length - 1] = { species: 'Gyarados', moves: ace.moves, ability: ace.ability, nature: ace.nature, item: '' };
			}
			built = karp;
		} else {
			const picked = [];
			const taken = new Set();
			const passed = [];
			// What this route commonly fields at these levels: what a weaker boom has to hurt.
			const common = theme.id === 'explosion' ? entries.slice().sort((a, b) => b.w - a.w).slice(0, 10)
				.map(e => lineOf(e.item).filter(st => !st.isMega && !st.battleOnly && minLevelOf(st) <= top).pop() || e.item) : [];
			// One whose Explosion comes out another type, at the stage these levels allow.
			const first = bombers && theme.id === 'explosion' ? ateBombers()
				.map(root => lineOf(root).filter(st => !st.isMega && !st.battleOnly && minLevelOf(st) <= top && ateOf(st) &&
					['explosion', 'selfdestruct'].some(k => trainerMoves(st, top, 6).has(k))).pop())
				.filter(Boolean).sort(() => rng() - 0.5).slice(0, 1) : [];
			for (let i = 0; i < 200 && picked.length < size; i++) {
				const root = i < first.length ? first[i] : weightedPick(entries.filter(e => !taken.has(e.item.id)), rng);
				if (!root) break;
				taken.add(root.id);
				const species = i < first.length ? root : stageFor(root, top, rng, { behind: 0 });
				const all = trainerMoves(species, top, 6);
				if (i < first.length && !theme.keys.some(k => all.has(k))) continue;
				const ability = (bombers && ateOf(species)) || abilityFor(species, () => 0, 0);
				const key = theme.keys.find(k => all.has(k) &&
					(theme.id !== 'explosion' || k !== 'selfdestruct' || boomAverage(species, k, top, ability, common) >= WEAK_BOOM_FLOOR) &&
					(theme.slots || []).slice(0, theme.needs || 0).every(slot => slot.some(x => all.has(x))));
				if (!key) {
					if (theme.alt) passed.push(species);
					continue;
				}
				add(species, key, all);
			}
			// Too few singers on this route: the rest of the team keeps them in (alt moves), from three singers.
			if (theme.alt && picked.length >= (theme.fewest || 2)) {
				for (const species of passed) {
					if (picked.length >= size) break;
					const all = trainerMoves(species, top, 6);
					const key = theme.alt.find(k => all.has(k));
					if (key) add(species, key, all);
				}
			}
			if (picked.length >= size) built = picked;
			function add(species, key, all) {
				const taught = trainerMoves(species, top, badges);
				const base = trainerSet(species, top, badges, rng);
				const moves = [key];
				for (const slot of theme.slots || []) {
					const m = slot.find(x => all.has(x) && !moves.includes(x));
					if (m) moves.push(m);
				}
				for (const m of theme.extra.slice().sort(() => rng() - 0.5)) if (moves.length < 3 && !moves.includes(m) && all.has(m) && rng() < 0.6) moves.push(m);
				// At least one attack, so it isn't a wall of nothing.
				for (const m of base.moves) {
					if (moves.length >= 4) break;
					const move = Dex.moves.get(m);
					// Not a boom on a team that isn't about one: Explosion is the Terrorist's.
					if (theme.id !== 'explosion' && EXPLOSIONS.includes(move.id)) continue;
					if (!moves.includes(move.id) && !theme.keys.includes(move.id) && move.id !== 'sketch' && (move.category !== 'Status' || taught.has(move.id))) moves.push(move.id);
				}
				// A Ghost takes nothing from Explosion: the bomber carries a Dark move for it.
				if (theme.id === 'explosion' && !moves.some(m => Dex.moves.get(m).type === 'Dark')) {
					const dark = DARK_COVERAGE.find(m => all.has(m));
					if (dark) {
						const spare = moves.findIndex((m, j) => j > 0 && !theme.keys.includes(m) && Dex.moves.get(m).category !== 'Status');
						if (moves.length < 4) moves.push(dark);
						else moves[spare > 0 ? spare : 3] = dark;
					}
				}
				picked.push({ species: species.name, moves: moves.map(m => Dex.moves.get(m).name), ability: base.ability, nature: base.nature, item: '' });
			}
		}
		if (!built) continue;
		const team = dealTrainerTeam(built, levels, badges, rng);
		// An early trainer's ability is rolled; a Larper's Ditto is always an Imposter.
		for (const set of team) if (set.species === 'Ditto') set.ability = 'Imposter';
		if (bombers && theme.id === 'explosion') armBombers(team, rng, badges);
		if (theme.id === 'memento') scarfGamblers(team, badges);
		if (rng() < BOXART_TROLL_CHANCE) trollLegend(team, rng, { bombs: theme.id === 'explosion' });
		for (const set of team) set.evs = EV.fitToLevel(Dex, set);
		return { team, theme: theme.id };
	}
	return null;
}

/*
 * Levels, IVs and EVs by badges, for a built trainer team. A stall team spends
 * the same EV total (six stats at badges x 10) on HP and the side it walls,
 * which is what makes it a wall; everyone else spreads it evenly.
 */
function dealTrainerTeam(built, levels, badges, rng, { stall = false } = {}) {
	/*
	 * The strongest is the ace, on the cap - and no Pokemon below the level it
	 * evolves at (24 Sep 2026). A candidate was evolved for the level it was
	 * rolled at, then dealt a level by its stat total, so a final stage could
	 * land two levels under its own evolution. Levels go out in order of the
	 * level each one needs, then of strength, and none is dealt below its own.
	 */
	const bstOf = set => Object.values(Dex.species.get(set.species).baseStats).reduce((x, y) => x + y, 0);
	built.sort((a, b) => minLevelOf(Dex.species.get(a.species)) - minLevelOf(Dex.species.get(b.species)) || bstOf(a) - bstOf(b));
	const top = levels[levels.length - 1];
	const dealt = built.map((set, i) => Math.min(top, Math.max(levels[i], minLevelOf(Dex.species.get(set.species)))));
	for (let i = 1; i < dealt.length; i++) dealt[i] = Math.max(dealt[i], dealt[i - 1]);
	const iv = Math.min(31, 8 + badges * 3);
	const budget = EV.trainerBudget(badges);
	const fitted = set => ({ ...set, evs: EV.fitToLevel(Dex, set) });
	return built.map((set, i) => {
		const species = Dex.species.get(set.species);
		let item = set.item || '';
		if (!stall && badges >= 3 && badges < 6 && rng() < 0.5) item = 'Oran Berry';
		if (stall) {
			return fitted({
				name: species.name, species: species.name, level: dealt[i], moves: set.moves, ability: set.ability, nature: set.nature, item,
				ivs: { hp: iv, atk: set.ivs && set.ivs.atk === 0 ? 0 : iv, def: iv, spa: iv, spd: iv, spe: iv },
				evs: EV.spreadFor(Dex, set, budget, { stall: true }),
			});
		}
		return fitted({
			name: species.name,
			species: species.name,
			level: dealt[i],
			moves: set.moves,
			// Early trainers have not thought about abilities or natures yet.
			ability: badges >= 3 ? set.ability : abilityFor(species, rng, 0.05),
			nature: badges >= 3 ? set.nature : pick(NATURES, rng),
			item,
			ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
			// The stats the set uses, not the same few in all six (12 Oct 2026).
			evs: EV.spreadFor(Dex, { ...set, item }, budget),
		});
	});
}

function trainerSet(species, level, badges, rng) {
	const moves = levelUpMoves(species, level);

	// From four badges on, one move is "taught": the strongest reliable attack
	// of its own type it can learn. Level-up movesets alone leave a lot of
	// Pokemon with nothing but Tackle-grade attacks well into the game.
	if (badges >= 4) {
		const power = badges >= 7 ? 120 : badges >= 5 ? 90 : 75;
		for (const type of species.types) {
			const taught = bestTaughtMove(species, type, power);
			if (taught && !moves.includes(taught)) {
				if (moves.length >= 4) moves[moves.length - 1] = taught; else moves.push(taught);
				break;
			}
		}
	}

	let item = '';
	if (badges >= 6) item = pick(['Sitrus Berry', 'Leftovers', 'Lum Berry', TYPE_ITEMS[species.types[0]]], rng);
	else if (badges >= 3 && rng() < 0.5) item = 'Oran Berry';

	const iv = Math.min(31, 8 + badges * 3);
	const set = {
		name: species.name,
		species: species.name,
		level,
		moves,
		ability: abilityFor(species, rng, badges >= 6 ? 0.3 : 0.05),
		nature: pick(NATURES, rng),
		item,
		ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
	};
	set.evs = EV.spreadFor(Dex, set, EV.trainerBudget(badges));
	set.evs = EV.fitToLevel(Dex, set);
	return set;
}

// ------------------------------------------------------------------ formats

// -------------------------------------------------------------- battle items

/**
 * Medicine a character can use mid-battle. The ids are the Discord bot's shop
 * ids, so the bag it sends along can be checked against these directly.
 *
 * Values are the modern games': a Potion heals 20 HP, a Super Potion 60, a
 * Hyper Potion 120. A Revive brings a fainted Pokemon back at half HP, which
 * is the one place a revive happens outside a Pokemon Centre - during the
 * battle it fainted in.
 */
/*
 * Items a player can use mid-battle, as in the games (Patch 1.3 added the rest).
 *
 *   heal     HP restored ('full' for all of it); cure: true also heals status
 *   cure     a status-only item: 'all', or the statuses it heals
 *   revive   a fainted Pokémon comes back with this much HP; all: every fainted one
 *   pp       'all' = every move to full, { all: 10 } = +10 each, { one: n | 'full' } = the emptiest move
 *   boost    stat stages for the Pokémon out on the field (X items)
 *   crit     Dire Hit: a higher critical-hit ratio while it stays in
 *   mist     Guard Spec.: Mist on your side, no stat drops for 5 turns
 */
const BATTLE_ITEMS = [
	{ id: 'potion', name: 'Potion', heal: 20 },
	{ id: 'superpotion', name: 'Super Potion', heal: 60 },
	{ id: 'hyperpotion', name: 'Hyper Potion', heal: 120 },
	{ id: 'maxpotion', name: 'Max Potion', heal: 'full' },
	{ id: 'fullrestore', name: 'Full Restore', heal: 'full', cure: true },
	{ id: 'freshwater', name: 'Fresh Water', heal: 30 },
	{ id: 'sodapop', name: 'Soda Pop', heal: 50 },
	{ id: 'lemonade', name: 'Lemonade', heal: 70 },
	{ id: 'moomoomilk', name: 'Moomoo Milk', heal: 100 },
	{ id: 'berryjuice', name: 'Berry Juice', heal: 20 },
	{ id: 'energypowder', name: 'Energy Powder', heal: 60 },
	{ id: 'energyroot', name: 'Energy Root', heal: 120 },
	{ id: 'antidote', name: 'Antidote', cure: ['psn', 'tox'] },
	{ id: 'burnheal', name: 'Burn Heal', cure: ['brn'] },
	{ id: 'iceheal', name: 'Ice Heal', cure: ['frz'] },
	{ id: 'awakening', name: 'Awakening', cure: ['slp'] },
	{ id: 'paralyzeheal', name: 'Paralyze Heal', cure: ['par'] },
	{ id: 'fullheal', name: 'Full Heal', cure: 'all' },
	{ id: 'healpowder', name: 'Heal Powder', cure: 'all' },
	{ id: 'revive', name: 'Revive', revive: 0.5 },
	{ id: 'maxrevive', name: 'Max Revive', revive: 1 },
	{ id: 'revivalherb', name: 'Revival Herb', revive: 1 },
	{ id: 'sacredash', name: 'Sacred Ash', revive: 1, all: true },
	{ id: 'ether', name: 'Ether', pp: { one: 10 } },
	{ id: 'maxether', name: 'Max Ether', pp: { one: 'full' } },
	{ id: 'elixir', name: 'Elixir', pp: { all: 10 } },
	{ id: 'maxelixir', name: 'Max Elixir', pp: 'all' },
	{ id: 'xattack', name: 'X Attack', boost: { atk: 2 } },
	{ id: 'xdefense', name: 'X Defense', boost: { def: 2 } },
	{ id: 'xspatk', name: 'X Sp. Atk', boost: { spa: 2 } },
	{ id: 'xspdef', name: 'X Sp. Def', boost: { spd: 2 } },
	{ id: 'xspeed', name: 'X Speed', boost: { spe: 2 } },
	{ id: 'xaccuracy', name: 'X Accuracy', boost: { accuracy: 2 } },
	{ id: 'direhit', name: 'Dire Hit', crit: true },
	{ id: 'guardspec', name: 'Guard Spec.', mist: true },
	// Getting out (Patch 1.4). These do nothing to a Pokemon, so itemHelps never
	// offers them on the item panel; the Run button is where they are used.
	{ id: 'pokedoll', name: 'Poké Doll', escape: true },
	{ id: 'fluffytail', name: 'Fluffy Tail', escape: true },
	{ id: 'poketoy', name: 'Poké Toy', escape: true },
];

/**
 * Whether an item would do anything for a Pokémon, from what's known about it:
 * { fainted, hurt, status ('' or 'brn'...), ppUsed, active }. The battle and the
 * item panel both ask this, so a button never offers what the battle refuses.
 */
function itemHelps(item, mon) {
	if (!item || !mon) return false;
	// A fainted Pokémon still standing in a doubles slot can't be revived in place; one on the bench can.
	if (item.revive) return !!mon.fainted && !mon.active;
	if (mon.fainted) return false;
	if (item.heal) return !!mon.hurt || (!!item.cure && !!mon.status);
	if (item.cure) return !!mon.status && (item.cure === 'all' || item.cure.includes(mon.status === 'tox' ? 'tox' : mon.status));
	if (item.pp) return !!mon.ppUsed;
	if (item.boost || item.crit || item.mist) return !!mon.active;
	return false;
}

function findBattleItem(input) {
	const id = toID(input);
	const aliases = { fullrevive: 'maxrevive', maxelexir: 'maxelixir', paralyseheal: 'paralyzeheal', parlyzheal: 'paralyzeheal', energypowder: 'energypowder', guardspec: 'guardspec', xspecialattack: 'xspatk', xspecialdefense: 'xspdef', xspecial: 'xspatk', xdefend: 'xdefense' };
	return BATTLE_ITEMS.find(i => i.id === id || toID(i.name) === id) || (aliases[id] ? BATTLE_ITEMS.find(i => i.id === aliases[id]) : null);
}

const WILD_FORMAT = 'gen9rpbattlewildencounter';

/*
 * The tutorial: a practice wild battle anyone can start, from Discord or with
 * /tutorial on Showdown. The format hands out both teams, so nobody needs one:
 * a Lv. 5 Pikachu against a Lv. 5 Rattata, with 1 Potion and 1 Pokéball that
 * come from nowhere. Nothing is recorded anywhere.
 */
const TUTORIAL_FORMAT = 'gen9rptutorial';
const TUTORIAL_PIKACHU = {
	name: 'Pikachu', species: 'Pikachu', level: 5, ability: 'Static', item: '', nature: 'Hardy', gender: 'M',
	moves: ['thundershock', 'quickattack', 'growl', 'thunderwave'],
	evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
};
const TUTORIAL_RATTATA = {
	name: 'Rattata', species: 'Rattata', level: 5, ability: 'Run Away', item: '', nature: 'Hardy',
	moves: ['tackle', 'tailwhip', 'quickattack'],
	evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
};
/*
 * The Audino meme (owner, 16 Oct 2026): for 24 hours half of all encounters (rp-server
 * audinoMeme) and every tutorial are a wild Audino, with the rare wild theme (`rare`). The
 * Discord bot's `!audino <time>` turns it on again: every signed request carries its end
 * (payload.audinoUntil), and the last one heard is kept here.
 */
const AUDINO = { until: Date.parse('2026-10-17T11:00:00Z') };
const TUTORIAL_AUDINO = {
	name: 'Audino', species: 'Audino', level: 5, ability: 'Healer', item: '', nature: 'Hardy', rare: true,
	moves: ['pound', 'growl', 'helpinghand'],
	evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
};
/** The tutorial's wild Pokemon: Rattata, or Audino while the meme lasts. */
const audinoOn = (now = Date.now()) => now < AUDINO.until;
const tutorialWild = (now = Date.now()) => (audinoOn(now) ? TUTORIAL_AUDINO : TUTORIAL_RATTATA);
const TUTORIAL_BAG = { balls: { poke: 1 }, items: { potion: 1 } };
const WILD_DOUBLE_FORMAT = 'gen9rpbattlewilddoubles';
const TRAINER_FORMAT = 'gen9rpbattle';
const TRAINER_DOUBLE_FORMAT = 'gen9rpbattledoubles';

/** A short line describing an encounter, for Discord and the battle room. */
function describe(enc) {
	const mons = enc.team.map(s => `${s.species} (Lv. ${s.level})`);
	if (enc.kind === 'wild') {
		return enc.double ? `Two wild Pokémon: ${mons.join(' and ')}!` : `A wild ${mons[0]}!`;
	}
	return `${enc.name} wants to battle${enc.double ? ' (double battle)' : ''}! ${enc.team.length} Pokémon, up to Lv. ${Math.max(...enc.team.map(s => s.level))}.`;
}

module.exports = {
	weatherItem,
	BATTLE_ITEMS, findBattleItem, itemHelps,
	toID, LEGEND_TAGS, isLegendary, encounterable, findSpecies, TOUHOU_REGIONS, isBoneka, bonekaOf, bonekaSet, bonekaMoves, BONEKA_SHARE, BONEKA_CATCH_RATE, wildPool,
	allBoneka, bonekaTrainerSet, trainerClassFor, ensureBoneka, gapWandererChance, GAP_WANDERER_BASE, GAP_WANDERER_PER_BADGE,
	levelUpMoves, wildSet, wildName, clampLevel, clampBadges, levelRange, shinyChance,
	catchRate, BALLS, findBall, catchChance, shakesFor, CATCH_BOOST, PITY_PER_MISS,
	TRAINER_CLASSES, GYM_TYPES, gymPlace, findClass, trainerName, minLevel, rootOf, lineOf, lineWeight, BADGE_TIERS, Rarity,
	stageFor, BABIES, babyWeight, clock, clockWeight, TIME_OF_DAY, DAY_OF_WEEK, SEASONS, EVENTS, eventOn, aceAdjusted, aceLevel,
	rollWild, rollTrainer, trainerSet, describe, stallTrainerTeam, trollTrainerTeam, customClass, boomAverage, ACE_CLASSES, TROLL_HOME_CHANCE, ACE_STALL_CHANCE, LARPER_CHANCE,
	WILD_FORMAT, WILD_DOUBLE_FORMAT, TUTORIAL_FORMAT, TUTORIAL_PIKACHU, TUTORIAL_RATTATA, TUTORIAL_AUDINO, tutorialWild, AUDINO, audinoOn, TUTORIAL_BAG, TRAINER_FORMAT, TRAINER_DOUBLE_FORMAT,
};
