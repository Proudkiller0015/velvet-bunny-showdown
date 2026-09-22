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

/** A real, battle-ready Pokemon somebody could meet in the wild. */
function encounterable(s) {
	return s && s.exists && s.num > 0 &&
		s.isNonstandard !== 'Custom' && s.isNonstandard !== 'CAP' && s.isNonstandard !== 'LGPE' &&
		!s.battleOnly && !s.isMega && !s.isPrimal && !/Gmax|Totem|Eternamax/.test(s.forme || '');
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
	const normal = ['0', '1'].map(k => species.abilities[k]).filter(Boolean);
	const hidden = species.abilities.H;
	if (hidden && rng() < hiddenChance) return hidden;
	return pick(normal.length ? normal : [hidden || 'No Ability'], rng);
}

const clampLevel = n => Math.max(1, Math.min(100, Math.round(Number(n) || 0)));

/** One wild Pokemon, as the games would roll it. */
function wildSet(species, level, rng = Math.random) {
	level = clampLevel(level);
	const iv = () => randInt(0, 31, rng);
	return {
		name: species.baseSpecies === species.name ? species.name : species.name,
		species: species.name,
		level,
		moves: levelUpMoves(species, level),
		ability: abilityFor(species, rng, 0.05),
		nature: pick(NATURES, rng),
		ivs: { hp: iv(), atk: iv(), def: iv(), spa: iv(), spd: iv(), spe: iv() },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		item: '',
	};
}

/** The side name a wild Pokemon battles under. The battle checks for "Wild ". */
function wildName(species) {
	const full = `Wild ${species.name}`;
	return full.length <= 18 ? full : `Wild ${species.baseSpecies}`.slice(0, 18);
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
	{ id: 'twins', title: 'Twins', avatar: 'twins-gen4', types: ['Normal', 'Fairy', 'Electric', 'Bug'], sex: 'pair', pair: true },
	{ id: 'youngcouple', title: 'Young Couple', avatar: 'youngcouple-gen4dp', types: ['Normal', 'Fairy', 'Psychic', 'Water'], sex: 'pair', pair: true, short: 'Couple' },
];

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

function rollWild({ place, badges, levelCap = null, rng = Math.random, double = null, shiny = {}, now = Date.now(), ace = null }) {
	badges = clampBadges(badges);
	const [lo, hi] = levelRange(badges, levelCap, ace);
	const rootsOf = list => (list || []).map(n => Dex.species.get(n)).filter(s => s.exists && !isLegendary(s)).map(rootOf);
	const common = rootsOf(place.common);
	const rare = rootsOf(place.rare);
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
	const typed = pool(allRoots().filter(r => !special.has(r.id) && !Rarity.HEADLINERS.has(Rarity.classOf(r))), place.types || []);
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
	const entries = [
		...scale(pool(common, []), common.length ? 0.55 : 0),
		...scale(rarePool, 0.04 * Math.min(1, rareMean * 25)),
		...scale(typed, 0.41),
	];

	const count = double === null ? (badges >= 1 && rng() < 0.12 ? 2 : 1) : (double ? 2 : 1);
	const team = [];
	const taken = new Set();
	for (let i = 0; i < count; i++) {
		const root = weightedPick(entries.filter(e => !taken.has(e.item.id)), rng);
		if (!root) break;
		taken.add(root.id);
		const level = randInt(lo, hi, rng);
		const species = stageFor(root, level, rng, { ahead: 0.04 });
		const set = wildSet(species, level, rng);
		if (rng() < shinyChance(shiny)) set.shiny = true;
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
function rollTrainer({ place, badges, levelCap = null, rng = Math.random, classId = null, double = null, ace = null }) {
	badges = clampBadges(badges);
	const classes = (place && place.trainers && place.trainers.length ? place.trainers : ['youngster', 'lass', 'hiker', 'backpacker'])
		.map(findClass).filter(Boolean);
	const cls = (classId && findClass(classId)) || pick(classes, rng);
	const tier = BADGE_TIERS[badges];
	const isDouble = cls.pair || (double === null ? badges >= 1 && rng() < 0.15 : !!double);
	const size = Math.max(isDouble ? 2 : 1, tier.size);

	// The ace pulls a trainer down the same way it pulls the wild: somebody whose best
	// Pokemon is far under their cap is not handed a full-cap team to lose to.
	const [lo, hi] = levelRange(badges, levelCap, ace);
	const ctx = { badges, types: cls.types, maxLevel: hi };
	// The place still counts: a Backpacker on a volcano brings fire types more
	// often than one at the harbour.
	const placeTypes = (place && place.types) || [];
	const entries = allRoots().map(item => {
		let w = lineWeight(item, ctx);
		if (w > 0 && placeTypes.length && lineOf(item).some(s => s.types.some(t => placeTypes.includes(t)))) w *= 1.5;
		return { item, w };
	}).filter(e => e.w > 0);

	/*
	 * Patch 1.5: a trainer brings a *team*. More Pokemon are rolled than fit,
	 * the same way as before, and the team assembler picks the ones and the
	 * roles that fit together, as strictly as the badges call for: sensible
	 * movesets from the start, the basics (no pile of shared weaknesses, both
	 * attacking sides) from three badges, the whole checklist from six. A type
	 * specialist keeps its types, so shared weaknesses are its theme, not a flaw.
	 */
	const rolled = [];
	const taken = new Set();
	for (let i = 0; i < Math.min(12, size * 2); i++) {
		const root = weightedPick(entries.filter(e => !taken.has(e.item.id)), rng);
		if (!root) break;
		taken.add(root.id);
		rolled.push(root);
	}
	const levels = [];
	for (let i = 0; i < size; i++) levels.push(i === size - 1 ? hi : randInt(Math.max(lo, hi - 5), Math.max(lo, hi - 1), rng));
	levels.sort((a, b) => a - b);
	let team = null;
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
	return {
		kind: 'trainer',
		double: isDouble,
		name: trainerName(cls, rng),
		avatar: cls.avatar,
		className: cls.title,
		classId: cls.id,
		team,
		ai: tier.ai,
		format: isDouble ? TRAINER_DOUBLE_FORMAT : TRAINER_FORMAT,
		badges,
	};
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
	// The strongest is the ace, on the cap.
	built.sort((a, b) => Object.values(Dex.species.get(a.species).baseStats).reduce((x, y) => x + y, 0) -
		Object.values(Dex.species.get(b.species).baseStats).reduce((x, y) => x + y, 0));
	const iv = Math.min(31, 8 + badges * 3);
	const ev = badges * 10;
	return built.map((set, i) => {
		const species = Dex.species.get(set.species);
		let item = set.item || '';
		if (badges >= 3 && badges < 6 && rng() < 0.5) item = 'Oran Berry';
		return {
			name: species.name,
			species: species.name,
			level: levels[i],
			moves: set.moves,
			// Early trainers have not thought about abilities or natures yet.
			ability: badges >= 3 ? set.ability : abilityFor(species, rng, 0.05),
			nature: badges >= 3 ? set.nature : pick(NATURES, rng),
			item,
			ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
			evs: { hp: ev, atk: ev, def: ev, spa: ev, spd: ev, spe: ev },
		};
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
	const ev = badges * 10;
	return {
		name: species.name,
		species: species.name,
		level,
		moves,
		ability: abilityFor(species, rng, badges >= 6 ? 0.3 : 0.05),
		nature: pick(NATURES, rng),
		item,
		ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
		evs: { hp: ev, atk: ev, def: ev, spa: ev, spd: ev, spe: ev },
	};
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
	BATTLE_ITEMS, findBattleItem, itemHelps,
	toID, LEGEND_TAGS, isLegendary, encounterable, findSpecies,
	levelUpMoves, wildSet, wildName, clampLevel, clampBadges, levelRange, shinyChance,
	catchRate, BALLS, findBall, catchChance, shakesFor, CATCH_BOOST, PITY_PER_MISS,
	TRAINER_CLASSES, findClass, trainerName, minLevel, rootOf, lineOf, lineWeight, BADGE_TIERS, Rarity,
	stageFor, BABIES, babyWeight, clock, clockWeight, TIME_OF_DAY, DAY_OF_WEEK, SEASONS, EVENTS, eventOn, aceAdjusted, aceLevel,
	rollWild, rollTrainer, describe,
	WILD_FORMAT, WILD_DOUBLE_FORMAT, TUTORIAL_FORMAT, TUTORIAL_PIKACHU, TUTORIAL_RATTATA, TUTORIAL_BAG, TRAINER_FORMAT, TRAINER_DOUBLE_FORMAT,
};
