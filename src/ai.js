'use strict';
/**
 * Battle AI: aims for competent, not perfect.
 *
 * Every decision is grounded in a real damage calculation (@smogon/calc), so the
 * bot clicks the move that actually kills rather than the one with the biggest
 * base power. On top of that sit a handful of rules that separate "OK" play from
 * random play:
 *
 *   - take a guaranteed KO, and take it with priority when it is not faster
 *   - do not set up, heal, or click status in front of something that KOes it
 *   - switch out of a matchup where it is being 2HKOed and cannot 2HKO back
 *   - keep hazards, recovery and status as cheap value when nothing better exists
 *   - Terastallize only when it materially changes the turn
 *
 * Unknown opponent sets are assumed to be neutral-natured and uninvested, which
 * under-rates them slightly; the switch rule is deliberately trigger-happy to
 * compensate. Stockfish's foe model (foeModel, 24 Sep 2026) reads built-team
 * foes from this server's own role sets instead: full investment, likely
 * attacks and item, corrected by how hard they actually hit.
 */

// Our moves and abilities into the AI's data before anything caches it (src/velvet-pkmn.js).
require('./velvet-pkmn').patchPkmnData();
const { Generations } = require('@pkmn/data');
const { Dex: PkmnDex } = require('@pkmn/dex');
const playbook = require('./playbook');
const calc = require('@smogon/calc');
const { TurnSearch, DEFAULT_WEIGHTS } = require('./search');
const { loadBrain } = require('./brain');
const { presetsFor } = require('./presets');

const GENS = new Generations(PkmnDex);

/**
 * A copy of a calc Pokemon with different types. Setting `types` on a clone is
 * not enough: the calculator clones its inputs again, rebuilding them from
 * `species`, so the types have to be written there too - otherwise the change
 * silently vanishes (Oxidize kept reading Steel as immune).
 */
/*
 * A calc Pokemon whose real stats (from the request) survive clone(): the
 * calculator's clone rebuilds rawStats from base stats, EVs and nature, and
 * calculate() clones both sides before it reads anything (see myPokemon).
 */
function keepStats(mon) {
	const clone = mon.clone;
	mon.clone = function () {
		const copy = clone.call(this);
		copy.rawStats = { ...this.rawStats };
		copy.stats = { ...this.stats };
		copy.originalCurHP = this.originalCurHP;
		return keepStats(copy);
	};
	return mon;
}

function retype(mon, types) {
	const copy = mon.clone();
	copy.species = Object.assign({}, copy.species, { types: types.slice() });
	copy.types = types.slice();
	return copy;
}

/**
 * A defender the calculator will not let a move bounce off.
 *
 * `ignoreImmunity` is how the battle marks a move that lands on a type that
 * should be immune to it - `true` for all of them, or `{ Ghost: true }` for a
 * Ghost move that hits Normal types, which is Witch's Snatch (the Halloween
 * Mega Banette) and Scrappy's trick. @smogon/calc knows none of that and returns
 * zero damage, so the immune types are taken off a copy of the defender and the
 * estimate comes back as the neutral hit the battle will actually deal.
 *
 * Unchanged when nothing applies, so it is safe to call on every attack.
 */
function seeingPastImmunity(gen, move, defender) {
	const dex = PkmnDex.forGen(gen.num);
	const data = dex.moves.get(move.name);
	const flag = data && data.ignoreImmunity;
	const moveType = (data && data.type) || move.type;
	if (!flag || (flag !== true && !flag[moveType])) return defender;
	const blocks = type => {
		const td = dex.types.get(type);
		return !!(td && td.damageTaken && td.damageTaken[moveType] === 3);
	};
	const types = defender.types || [];
	const tera = defender.teraType && blocks(defender.teraType) ? defender.teraType : null;
	if (!tera && !types.some(blocks)) return defender;
	// Something neutral to stand in for the type that is being ignored, so only
	// the immunity goes and the rest of the chart still counts.
	const neutral = (dex.types.all().find(t => t.damageTaken && t.damageTaken[moveType] === 0) || { name: 'Dragon' }).name;
	const rest = types.filter(t => !blocks(t));
	const copy = retype(defender, rest.length ? rest : [neutral]);
	if (tera) copy.teraType = neutral;
	return copy;
}

const HAZARDS = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'];
const RECOVERY = ['Recover', 'Roost', 'Soft-Boiled', 'Slack Off', 'Synthesis', 'Moonlight',
	'Morning Sun', 'Rest', 'Shore Up', 'Milk Drink', 'Heal Order', 'Strength Sap'];
const PIVOT = ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport', 'Baton Pass'];
// How many times each hazard stacks.
const HAZARD_LAYERS = { 'Spikes': 3, 'Toxic Spikes': 2 };
// Abilities that stop one kind of status, once shown (the status each blocks).
const STATUS_BLOCKS = {
	limber: ['par'], waterveil: ['brn'], waterbubble: ['brn'], thermalexchange: ['brn'],
	immunity: ['psn', 'tox'], pastelveil: ['psn', 'tox'], insomnia: ['slp'], vitalspirit: ['slp'], sweetveil: ['slp'],
};

/**
 * One representative attack per type, for estimating what an opponent that has
 * revealed nothing might do. Kept in both flavours so the guess matches whether
 * the attacker is physically or specially inclined.
 */
const PHYSICAL_PROBES = {
	Normal: 'Body Slam', Fire: 'Flare Blitz', Water: 'Waterfall', Electric: 'Wild Charge',
	Grass: 'Power Whip', Ice: 'Icicle Crash', Fighting: 'Close Combat', Poison: 'Gunk Shot',
	Ground: 'Earthquake', Flying: 'Brave Bird', Psychic: 'Zen Headbutt', Bug: 'U-turn',
	Rock: 'Stone Edge', Ghost: 'Poltergeist', Dragon: 'Outrage', Dark: 'Knock Off',
	Steel: 'Iron Head', Fairy: 'Play Rough',
};
const SPECIAL_PROBES = {
	Normal: 'Hyper Voice', Fire: 'Flamethrower', Water: 'Surf', Electric: 'Thunderbolt',
	Grass: 'Energy Ball', Ice: 'Ice Beam', Fighting: 'Aura Sphere', Poison: 'Sludge Bomb',
	Ground: 'Earth Power', Flying: 'Air Slash', Psychic: 'Psychic', Bug: 'Bug Buzz',
	Rock: 'Power Gem', Ghost: 'Shadow Ball', Dragon: 'Draco Meteor', Dark: 'Dark Pulse',
	Steel: 'Flash Cannon', Fairy: 'Moonblast',
};

/**
 * Abilities that make a Pokemon outright immune to a type. Used both ways: a
 * move that lands rules these out, and a move that bounces off points at them.
 */
const ABILITY_IMMUNITY = {
	'Levitate': 'Ground', 'Earth Eater': 'Ground',
	'Water Absorb': 'Water', 'Storm Drain': 'Water', 'Dry Skin': 'Water',
	'Volt Absorb': 'Electric', 'Lightning Rod': 'Electric', 'Motor Drive': 'Electric',
	'Flash Fire': 'Fire', 'Well-Baked Body': 'Fire',
	'Sap Sipper': 'Grass',
	// This server's own absorbers (data/velvet/balance-patch-1.js): Vaporeon, Jolteon, Stunfisk.
	'Liquid Body': 'Water', 'Static Needles': 'Electric', 'Mudflat Ambush': 'Electric',
};

/** Move targets that must be given an explicit slot number in doubles. */
// Moves that deal a set amount: (attacker, defender, defender's current HP) -> HP taken.
const FIXED_DAMAGE = {
	'Seismic Toss': a => a.level,
	'Night Shade': a => a.level,
	'Super Fang': (a, d, hp) => Math.floor(hp / 2),
	'Ruination': (a, d, hp) => Math.floor(hp / 2),
	"Nature's Madness": (a, d, hp) => Math.floor(hp / 2),
	'Dragon Rage': () => 40,
	'Sonic Boom': () => 20,
	'Endeavor': (a, d, hp) => Math.max(0, hp - (a.originalCurHP || a.maxHP())),
};
// Stat drops the move data does not list, because the move does them in its own code.
const UNLISTED_DROPS = { partingshot: { atk: -1, spa: -1 }, strengthsap: { atk: -1 }, spicyextract: { def: -2 } };
const PHAZES = new Set(['roar', 'whirlwind', 'dragontail', 'circlethrow', 'royaldecree', 'yawn', 'encore']);
const PROTECTS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct', 'maxguard', 'endure']);
const SCREENS = { reflect: 'Reflect', lightscreen: 'Light Screen', auroraveil: 'Aurora Veil' };
const NEEDS_TARGET = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);

/**
 * Difficulty knobs. The bot is meant to be a fun opponent across a range of
 * players, so the lower rungs are not "the same AI with worse luck" - they have
 * genuinely less machinery switched on.
 *
 *   blunder    chance of simply picking a random legal move instead of thinking
 *   greedy     only counts damage - no setup, hazards, status or tempo judgement
 *   noise      random points added to every score, for small misjudgements
 *   switching  may voluntarily switch out of a bad matchup
 *   tempo      values Pokemon by what they can still win, and sacrifices cheaply
 *   predict    reads turn order, both for landing a kill and for surviving one
 *   knowsSets  in Random Battle, knows which ability the species is generated
 *              with - the difference between guessing and knowing
 *   readsSets  and which moves and Tera types come with it, before they are used
 *   switchMargin how much better the bench must look before spending a turn
 *   revenge    prefer a switch-in that can kill before it is killed (on unless
 *              switched off for a measurement)
 *
 * Every one of these was measured over hundreds of games rather than reasoned
 * about, and the measurements were unkind. Not calculating damage at all is worth
 * about 250 points of Elo and attacking without ever using a status or setup move
 * is worth about 60, but switching out of bad matchups measured at nothing
 * whatsoever, and neither reading turn order nor knowing the Random Battle sets
 * moved a single game. Both of those are still switched on at the top, because
 * being right about the position is worth having even when it does not win - a
 * bot that clicks Surf into a Storm Drain Gastrodon looks stupid, and now does
 * not - but the ladder is spaced by the things that measured.
 *
 * Both sides draw a random team every game, which decides a great deal on its
 * own, so anything short of a large difference is buried by it. Take nothing here
 * on fewer than a few hundred games; see test/elo.test.js.
 */
/*
 * The judgement from docs/research-pinkacross.md (24 Sep 2026), one knob per
 * rule so each can be switched off for a measurement (test/ablation.js takes the
 * same names as overrides):
 *
 *   accuracy     a 70% KO is worth 70% of a KO (A10). Hard and up: reading the
 *                accuracy is not judgement, it is reading the move.
 *   sacking      a Pokemon is worth what it can still do against what they have
 *                left, and never goes in as setup fodder (A14, The Art of Sacking)
 *   leads        leads scored by lead traits against their likely leads (A2-A4)
 *   setupWin     no setup when the unboosted Pokemon already wins (A11)
 *   middleGround the search weights their replies by how plausible they are and
 *                plays safer ahead, sharper behind (A6-A8) - search only
 *   endgame      a small exact tree at three-or-fewer a side (A16) - search only
 */
const PINKACROSS_CHAMPION = { accuracy: true, sacking: true, leads: true, setupWin: true };
const PINKACROSS_SEARCH = { middleGround: true, endgame: true };
/*
 * From the review of 93 tier-sim games, both sides Stockfish (24 Sep 2026),
 * one knob each so they can be measured apart - Stockfish only until they are:
 *
 *   foeModel   in a built-team format, a foe is what this server's own role sets
 *              (src/role-sets.js) build for it: its likely attacks, full
 *              investment in the stat it attacks with, and a damage item until
 *              the battle shows otherwise - then corrected by how hard it
 *              actually hits (learnFoeScale). The old 85-EV, no-item guess read
 *              a Choice Band Close Combat as half of what it did.
 *   recovery   heal when the heal outruns the hit, before the "this is the last
 *              turn" return, and Wish at 70% or lower (A20). 0 of 108 chances
 *              to recover at half health or less were taken.
 *   hazardPlan Stealth Rock and Spikes worth what they will hit - the foes left
 *              without Boots - and more early (A12); Spikes up to three layers.
 *   setupCap   no setting up in front of a KO on the hope they switch once we
 *              are at 30% or less (Mega Blaziken, Swords Dance at 14%).
 *   hpUnits    the hit coming at us counted as a share of our maximum HP, like
 *              the HP it is compared with (see chooseForSlot); and the search's
 *              KOs likewise.
 *   endgameGuard the Choice-locked and walled switches still apply when the
 *              endgame tree has a plan (Indeedee-F, Hyper Voice into a Ghost x16).
 */
const STOCKFISH_REVIEW = { foeModel: true, hpUnits: true, recovery: true, hazardPlan: true, setupCap: true, endgameGuard: true };
/*
 * Stall, played the way 63 human NatDex stall sides rated 1849-1934 played it
 * (docs/stall-replay-study.md, rules R1-R13; 24 Sep 2026). Each rule is on per
 * style of our own team (ourArchetype(), STYLE_RULES below): today only for
 * stall - four or more walls with recovery - so every other team plays exactly
 * as before:
 *
 *   stallPlay  pivot to the wall that takes the hit, even at full health (R1);
 *              never sack a wall, keep one at 35% or less (R2, R3); heal in the
 *              45-65% band unless the hit outruns the heal (R4, R5); aim status
 *              (R6); remove hazards once a layer costs the team (R8); answer a
 *              boosted foe with the answer or a heal (R11); Protect with a
 *              purpose, never twice (R9); Wish at about 80% and pass it (R10);
 *              keep making progress in long games (R12); save the last heals (R13).
 *
 * On every rung that thinks (Hard, Champion, Stockfish): the site's ladder bots,
 * gyms, trainers and summons all play through this class, and whichever of them
 * is handed a stall team should play it as stall (owner, 24 Sep 2026). Easy and
 * Normal stay greedy - they only ever attack, by design - so it is off there.
 */
const STALL_PLAY = { stallPlay: true };
/*
 * Which of those rules each style of our own team plays, keyed by ourArchetype()
 * (the teambuilding checklist's styles). Stall plays them all; the others are off
 * until each rule is measured on them (the owner's next step: the study's rules
 * where they fit balance and offense too). A cfg.styleRules of the same shape
 * overrides this for a measurement.
 *
 *   pivot        R1   switch to the wall that takes the hit, even at full health
 *   preserve     R2/3 never sack, keep a Pokemon at 35% or less
 *   boosted      R11  a boosted foe: the answer comes in, or we heal; Haze and
 *                     phaze at +1; Unaware and phazers favoured coming in
 *   heal         R4/5 heal in the 45-65% band, not into a hit that outruns it
 *   ppSave       R13  the last three heals kept for low HP
 *   wish         R10  Wish at about 80%, and passed to a teammate
 *   protect      R9   Protect to scout or for a residual tick, never twice
 *   status       R6   status aimed: burns at physical attackers, nothing into absorbers
 *   removal      R8   Defog and Spin worth what the hazards cost our team
 *   hazardTiming R7   hazards on a free turn, not under fire
 *   freeTurns         no Wish, Protect or passive turn gifted to a foe that sets up
 *   holdDynamax       Dynamax only to live through a hit or for a Max Move that kills
 */
const STYLE_RULES = {
	stall: { pivot: true, preserve: true, boosted: true, heal: true, ppSave: true, wish: true, protect: true, status: true, removal: true, hazardTiming: true, freeTurns: true, holdDynamax: true },
	balance: {},
	'bulky offense': {},
	'hyper offense': {},
};
const DIFFICULTIES = {
	// An in-game trainer. It reaches for whatever move has the biggest number on
	// it, without working out what that move would actually do, and it never
	// leaves a matchup however badly it is going. Losing to it should take
	// carelessness, and beating it should not feel like an achievement.
	easy:     { blunder: 0.15, greedy: true,  naive: true,  noise: 25, switching: false, tempo: false, predict: false, tera: true, switchMargin: 999 },
	// Reads the type chart properly - it will not throw Ground at something that
	// is Flying - and it leaves a matchup it cannot win. What it never does is
	// anything but attack: no hazards, no status, no setup, no thinking about a
	// turn it is not currently taking.
	normal:   { blunder: 0.10, greedy: true,  noise: 20, switching: true,  tempo: false, predict: false, tera: true, switchMargin: 55 },
	// The whole machinery, and the default opponent. It knows what its status and
	// setup moves are for, what each of its Pokemon is still worth, and which
	// ability the thing in front of it is generated with. It still misjudges a
	// position now and again, which is the difference between a strong opponent
	// and an unbeatable one.
	hard:     { blunder: 0.06, greedy: false, noise: 12, switching: true,  tempo: true,  predict: false, tera: true, switchMargin: 40, knowsSets: true, accuracy: true, ...STALL_PLAY },
	// Everything Hard does and no lapses at all: it counts the speed tiers before
	// committing, and in Random Battle it knows the whole set - moves and Tera
	// types included - before any of it is used.
	champion: { blunder: 0,    greedy: false, noise: 0,  switching: true,  tempo: true,  predict: true,  tera: true, switchMargin: 25, knowsSets: true, readsSets: true, playbook: true, ...PINKACROSS_CHAMPION, ...STALL_PLAY },
	// Experimental. Everything Champion does, plus a one-turn search over our
	// options against their likely replies, weighted by numbers the trainer tuned
	// from self-play rather than by hand.
	stockfish: { blunder: 0,   greedy: false, noise: 0,  switching: true,  tempo: true,  predict: true,  tera: true, switchMargin: 25, knowsSets: true, readsSets: true, search: true, playbook: true, ...PINKACROSS_CHAMPION, ...PINKACROSS_SEARCH, ...STOCKFISH_REVIEW, ...STALL_PLAY },
};
const DEFAULT_DIFFICULTY = 'hard';

/**
 * What tempo charges, in the same percent-of-health units as the rest of the
 * score - which is the point. Priced in the 0-100 "still worth this much"
 * units these came from, one of these terms could reach 80 and no matchup
 * calculation could ever outvote it, so the bot picked its cheapest Pokemon
 * and ignored what it was walking into.
 *
 *   death  losing it outright, on top of the damage already counted
 *   entry  the extra hit a voluntary switch eats on the way in
 *
 * Exported so the tuner can search them.
 */
const TEMPO = { death: 45, entry: 30 };

/** Species -> the sets the role-set builder makes for it (BattleAI.foeProfile), for the process. */
const FOE_PROFILES = new Map();

function toName(id, kind) {
	const entry = PkmnDex.forGen(9)[kind].get(id);
	return entry ? entry.name : id;
}

/** Abilities of ours that let Psychic moves hit Dark types (the lake trio, Balance Patch 1). */
const LAKE_ABILITIES = new Set(['Mind Keeper', 'Heartfelt Resolve', 'Unbending Will']);
// Balance Patch 1's eeveelution abilities, as the vanilla ability the calculator
// knows that does the same to damage.
/** Species sheets this server changed, from the simulator's own dex. */
let CHANGED_SPECIES = null;
function changedSpecies() {
	if (CHANGED_SPECIES) return CHANGED_SPECIES;
	CHANGED_SPECIES = {};
	try {
		const path = require('path');
		const Dex = require('./rp-dex')();
		const dir = path.join(path.dirname(require.resolve('pokemon-showdown')), '..', 'data', 'velvet', 'unnerfs.js');
		for (const id of require(dir).CHANGED.species || []) {
			const s = Dex.species.get(id);
			if (s.exists) CHANGED_SPECIES[id] = { types: s.types.slice(), baseStats: { ...s.baseStats }, abilities: { ...s.abilities } };
		}
	} catch (e) { /* no simulator data: Smogon's sheets are all there is */ }
	return CHANGED_SPECIES;
}
const CALC_ABILITY = {
	'Kindled Fury': 'Guts', 'Diamond Dust': 'Slush Rush', 'Solstice': 'Chlorophyll',
	'Prescience': 'Magic Guard', 'Liquid Body': 'Water Absorb', 'Static Needles': 'Volt Absorb', 'Ribbon Hymn': 'Pixilate',
	'Mudflat Ambush': 'Volt Absorb',
};
// Abilities that bounce status moves and hazards, and ones no status takes on.
const BOUNCES = new Set(['magicbounce', 'prescience']);
// Good as Gold blocks every status move aimed at it (Blissey clicked Thunder Wave into Gholdengo three times).
const STATUS_PROOF = new Set(['moonlitvenom', 'purifyingsalt', 'comatose', 'goodasgold']);
const CORRODES = new Set(['corrosion', 'moonlitvenom']);
// Weather Speed doublers, ours and the originals: [ability id, weathers].
const WEATHER_SPEED = {
	diamonddust: ['snowscape', 'hail'], slushrush: ['snowscape', 'hail'],
	solstice: ['sunnyday', 'desolateland'], chlorophyll: ['sunnyday', 'desolateland'],
	swiftswim: ['raindance', 'primordialsea'], sandrush: ['sandstorm'],
};

class BattleAI {
	constructor(options = {}) {
		this.log = options.log || (() => {});
		// Weights the trainer produced, if there are any; otherwise the defaults.
		this.brain = options.brain || loadBrain();
		this.search = new TurnSearch(this, this.brain.weights);
		this.setDifficulty(options.difficulty, options.cfg);
	}

	/** @param {object} [overrides] individual knobs, for tuning experiments. */
	setDifficulty(name, overrides) {
		const key = String(name || DEFAULT_DIFFICULTY).toLowerCase();
		this.difficultyName = DIFFICULTIES[key] ? key : DEFAULT_DIFFICULTY;
		const base = DIFFICULTIES[this.difficultyName];
		this.cfg = overrides ? { ...base, ...overrides } : base;
		return this.difficultyName;
	}

	static difficulties() { return Object.keys(DIFFICULTIES); }

	jitter() { return this.cfg.noise ? (Math.random() - 0.5) * 2 * this.cfg.noise : 0; }

	/**
	 * How fast something actually is right now.
	 *
	 * The damage calculator takes boosts into account when it calculates damage,
	 * but it does not write them back into `stats` - a Quaquaval six Aqua Steps
	 * into a sweep still reads at its base speed. Every speed comparison in here
	 * used `stats.spe` directly, so the bot kept sending Pokemon in against a
	 * sweeper it believed it outran, and they died in the order they were listed
	 * without ever getting a move off.
	 */
	speedOf(mon, boosts, status, weather) {
		let spe = (mon && mon.stats && mon.stats.spe) || 0;
		const doubler = WEATHER_SPEED[String((mon && mon.ability) || '').toLowerCase().replace(/\W/g, '')];
		if (doubler && weather && doubler.includes(String(weather).toLowerCase().replace(/\W/g, ''))) spe *= 2;
		const stage = Math.max(-6, Math.min(6, (boosts && boosts.spe) || 0));
		spe = stage >= 0 ? spe * (2 + stage) / 2 : spe * 2 / (2 - stage);
		if (status === 'par') spe *= 0.5;
		if (String((mon && mon.item) || '').toLowerCase().replace(/\W/g, '') === 'choicescarf') spe *= 1.5;
		return spe;
	}

	/** The speed of an opponent as the battle has actually left it. */
	foeSpeed(gen, foe, weather) {
		const mon = this.foePokemon(gen, foe);
		/*
		 * In a built format, assume the foe's Speed is fully invested (252 EVs and a
		 * Speed nature) unless the battle says otherwise: a revenge killer that only
		 * outruns a slow-built Roserade is sent in to die. Great Tusk was, in replay
		 * gen9rpou-1-tlirc4. Random Battles publish their spreads, so those stay as they are.
		 */
		if (!this.cfg.naive && this.cfg.maxSpeed !== false && !/random/.test(this.format || '') && mon && mon.species && mon.species.baseStats) {
			const level = mon.level || 100;
			const top = Math.floor(Math.floor((2 * mon.species.baseStats.spe + 31 + 63) * level / 100 + 5) * 1.1);
			/*
			 * And a Choice Scarf when nearly every set this server builds for it runs
			 * one (Rotom-Mow, Indeedee-F, Purugly) and nothing has ruled it out - an
			 * item seen or lost, or two different moves in one stay. (foeModel, 24 Sep 2026)
			 */
			const guess = this.cfg.foeModel && !mon.item ? this.foeGuess(foe) : null;
			if (guess && guess.scarf >= 0.75) {
				// At the Speed those Scarf sets are built with: a bulky Scarf Rotom-Mow puts nothing in Speed.
				const ev = guess.scarfSpe;
				const scarfed = Math.floor(Math.floor((2 * mon.species.baseStats.spe + 31 + Math.floor(ev / 4)) * level / 100 + 5) * (ev >= 252 ? 1.1 : 1)) * 1.5;
				return Math.max(this.speedOf({ stats: { spe: top }, ability: mon.ability }, foe.boosts, foe.status, weather),
					this.speedOf({ stats: { spe: scarfed }, ability: mon.ability }, foe.boosts, foe.status, weather));
			}
			if (mon.stats && top > mon.stats.spe) return this.speedOf({ stats: { spe: top }, ability: mon.ability, item: mon.item }, foe.boosts, foe.status, weather);
		}
		return this.speedOf(mon, foe.boosts, foe.status, weather);
	}

	gen(n) { return GENS.get(Math.max(1, Math.min(9, n || 9))); }

	/** Build a calc Pokemon for one of our own mon (we know everything). */
	myPokemon(gen, entry, state) {
		const ownSpecies = (entry.details || entry.ident || '').split(',')[0].replace(/^p[12][a-c]?: /, '').trim();
		const level = (/, L(\d+)/.exec(entry.details || '') || [])[1];
		const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
		const status = (/ (brn|psn|tox|par|slp|frz)/.exec(entry.condition || '') || [])[1];
		// Look the live state up by the Pokemon's own name - that is what the
		// protocol calls it even after it has transformed.
		const live = state && state.mine && Object.values(state.mine).find(m => m && m.species === ownSpecies);

		// A transformed Pokemon fights with the copied species' stats, types and
		// moves. Modelling it as its own species (Ditto: base 48 across the board)
		// makes it look useless, and the bot throws it away or refuses to send it
		// in. Its HP stays its own, which is why the condition is still applied.
		const transformed = live && live.transformed ? live.transformed : null;
		const species = transformed || ownSpecies;

		const opts = {
			level: level ? +level : 100,
			item: entry.item ? toName(entry.item, 'items') : undefined,
			ability: entry.ability || entry.baseAbility ? toName(entry.ability || entry.baseAbility, 'abilities') : undefined,
			status: status || undefined,
			boosts: live ? live.boosts : undefined,
			teraType: live && live.tera ? live.tera : undefined,
		};
		if (cond) { opts.curHP = +cond[1]; opts.originalCurHP = +cond[1]; }
		if (entry.stats && !transformed) {
			// Showdown hands us final stats; feed them back as the calc's own.
			// Skipped when transformed, because the reported stats are still the
			// original Pokemon's while the copied ones are what it actually uses.
			opts.overrides = { baseStats: undefined };
			opts.rawStats = entry.stats;
		}
		opts.overrides = this.speciesOverrides(gen, species, opts.overrides);
		try {
			const mon = new calc.Pokemon(gen, species, opts);
			if (live && live.charged) mon.velvetCharged = true;
			if (entry.stats && !transformed) {
				for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (entry.stats[k]) mon.stats[k] = entry.stats[k];
				/*
				 * And into rawStats, which is what the calculator actually reads Attack
				 * and Defence from - kept through every clone, since calculate() clones
				 * both sides and a clone rebuilds rawStats from base stats, 0 EVs and a
				 * neutral nature. Until now our own Pokemon were all calculated that
				 * way: a 252 Def Bold Clefable took a Kingambit's Iron Head as 116-136%
				 * when it is 66-78%, so in replay gen9rpou-10-tlvuiv the Unaware
				 * Clefable "could not come in" on a +2 Kingambit and Blissey stayed in
				 * front of it and died.
				 */
				if (!this.cfg.naive) {
					for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (entry.stats[k]) mon.rawStats[k] = entry.stats[k];
					keepStats(mon);
				}
			}
			if (cond) {
				// maxHP() reads rawStats.hp, and Showdown's request stats carry no
				// hp field at all - so without this the current and maximum HP were
				// in different units and every "what fraction of my HP is that"
				// judgement (setup, switching, Tera, Dynamax) was working off a
				// number that could be out by a factor of two or more.
				const maxhp = +cond[2];
				if (maxhp > 0) {
					if (mon.rawStats) mon.rawStats.hp = maxhp;
					if (mon.stats) mon.stats.hp = maxhp;
				}
				mon.originalCurHP = +cond[1];
			}
			return mon;
		} catch (e) {
			// The last resort, with whatever sheet could be found - repeating the
			// call unchanged is what used to make this catch useless.
			return new calc.Pokemon(gen, species, {
				level: opts.level,
				overrides: this.speciesOverrides(gen, species, undefined),
			});
		}
	}

	/**
	 * Species data for a Pokemon this generation has never heard of.
	 *
	 * The damage calculator's ninth generation is Scarlet and Violet, and half
	 * the Pokemon in National Dex are not in it - Ferrothorn is not, and neither
	 * is Lopunny. Asked for one, `gen.species.get` returns nothing and the
	 * calculator's constructor reads `baseStats.hp` off it, which throws. The
	 * fallback beside it repeated the same call and threw the same way, so the
	 * error left the AI entirely: in a National Dex battle - which is what the RP
	 * tiers are - the bot crashed on the turn a Ferrothorn appeared.
	 *
	 * The fix is to hand the constructor the sheet from the newest generation
	 * that does have it. The mechanics stay this generation's, which is correct;
	 * only the stats, types and weight come from where they exist.
	 */
	pastSpecies(name) {
		if (!this._pastSpecies) this._pastSpecies = new Map();
		const key = String(name);
		if (this._pastSpecies.has(key)) return this._pastSpecies.get(key);

		let found = null;
		for (const num of [8, 7, 6, 5, 4, 3, 2, 1]) {
			let older;
			try {
				older = GENS.get(num).species.get(key);
			} catch (e) {
				older = null;
			}
			if (older && older.baseStats) {
				found = {
					baseStats: older.baseStats,
					types: older.types,
					weightkg: older.weightkg,
					abilities: older.abilities,
				};
				break;
			}
		}

		/*
		 * And if no generation has it, ask the simulator.
		 *
		 * Everything this server invented is in that category and in no other:
		 * the Z-A Megas, Samantha, Nuzleaf-SOLD. The damage calculator has never
		 * heard of any of them in any generation, which is not a gap to route
		 * around - the simulator running the battle has their real sheets,
		 * because we wrote them.
		 *
		 * This is not hypothetical and it is not rare. The bot was taught to
		 * bring Mega Stones an hour ago, and eleven games in forty then died the
		 * turn the Mega happened. A Nuzleaf turning into Nuzleaf-SOLD mid-battle
		 * would have done the same to whoever was playing against it.
		 */
		if (!found) {
			try {
				const Dex = require('./rp-dex')();
				const real = Dex.species.get(key);
				if (real && real.exists && real.baseStats) {
					found = {
						baseStats: real.baseStats,
						types: real.types,
						weightkg: real.weightkg,
						abilities: real.abilities,
					};
				}
			} catch (e) { /* no simulator here: the guess below is all there is */ }
		}

		this._pastSpecies.set(key, found);
		return found;
	}

	/** Whatever this generation knows, or the last one that knew anything. */
	speciesOverrides(gen, name, overrides) {
		let known = null;
		try {
			known = gen.species.get(name);
		} catch (e) {
			known = null;
		}
		if (known) {
			const changed = changedSpecies()[String(name).toLowerCase().replace(/[^a-z0-9]/g, '')];
			return changed ? { ...changed, ...(overrides || {}) } : overrides;
		}
		const past = this.pastSpecies(name);
		// This server's changes win over the old sheet too: Roserade, Spiritomb and Togekiss are
		// all past-generation species, and without this the AI played against their old stats.
		const changedPast = changedSpecies()[String(name).toLowerCase().replace(/[^a-z0-9]/g, '')];
		if (!past) return changedPast ? { ...changedPast, ...(overrides || {}) } : overrides;
		return { ...(overrides || {}), ...past, ...(changedPast || {}) };
	}

	/**
	 * Build a calc Pokemon for an opponent we can only partially see.
	 *
	 * `bare`: without the damage-item guess or what its hits have shown, for
	 * measuring those hits against (learnFoeScale).
	 */
	foePokemon(gen, foe, { bare = false } = {}) {
		const species = foe.transformed || foe.species;
		const opts = {
			level: foe.level || 100,
			boosts: foe.boosts,
			status: foe.status || undefined,
			item: foe.item ? toName(foe.item, 'items') : undefined,
			ability: foe.ability ? toName(foe.ability, 'abilities') : undefined,
			teraType: foe.tera || undefined,
			// Unknown spread: assume a balanced, plausible investment rather than 0s.
			evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
		};
		/*
		 * In a built-team format, the spread this server's builder gives it (foeModel,
		 * 24 Sep 2026). The balanced 85s under-read every attacker: real sets put
		 * 252 and a boosting nature into the stat they hit with, so Tauros-Paldea-
		 * Combat's Close Combat on Rotom-Mow read 47-56% and did 81-96%. Bulk is the
		 * average of its built sets - a Blissey is 252 HP / 252 Sp. Def, a Tauros
		 * is neither - so our own damage reads true as well.
		 */
		const guess = this.cfg.foeModel && !/random/.test(this.format || '') ? this.foeGuess(foe) : null;
		if (guess && guess.sets.length) {
			const side = guess.side;
			opts.evs = { ...guess.bulk, [side === 'Special' ? 'spa' : 'atk']: 252 };
			if (side === 'Mixed') { opts.evs.atk = 252; opts.evs.spa = 252; }
			opts.nature = side === 'Physical' ? 'Adamant' : side === 'Special' ? 'Modest' : 'Hardy';
		}
		try {
			opts.overrides = this.speciesOverrides(gen, species, opts.overrides);
			const mon = new calc.Pokemon(gen, species, opts);
			if (foe.maxhp === 100 && foe.hp < 100) mon.originalCurHP = Math.max(1, Math.round(mon.maxHP() * foe.hp / 100));
			// No item shown and none knocked off: it probably holds one (Witch's Snatch in damagePct).
			if (!foe.item && !foe.itemGone) mon.velvetItemUnknown = true;
			if (guess && !bare) {
				const scale = this.foeScale(foe, guess);
				if (scale) mon.velvetScale = scale;
			}
			return mon;
		} catch (e) {
			// Something rather than nothing: a Pikachu-shaped guess is a bad
			// estimate and a crash is no estimate at all. Tried with the real
			// sheet first, in case the species is simply older than this
			// generation - Ferrothorn in National Dex is exactly that.
			try {
				return new calc.Pokemon(gen, species, {
					level: opts.level,
					overrides: this.speciesOverrides(gen, species, undefined),
				});
			} catch (e2) {
				return new calc.Pokemon(gen, 'Pikachu', { level: opts.level });
			}
		}
	}

	/** Is the foe model on for this format? Random Battles publish their sets, so not there. */
	modelsFoes() { return !!this.cfg.foeModel && !this.cfg.naive && !/random/.test(this.format || ''); }

	/**
	 * What this server's builder makes of a species: a few sets per role from
	 * src/role-sets.js - the same generator the tier sim, the ladder bots and the
	 * trainers draft from - each as its moves, attacks, item, spread and attacking
	 * side. Seeded, so the same species always reads the same, and kept for the
	 * life of the process (a tier-sim worker plays thousands of games).
	 */
	foeProfile(species) {
		const key = String(species || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		if (FOE_PROFILES.has(key)) return FOE_PROFILES.get(key);
		const sets = [];
		try {
			const RS = require('./role-sets');
			const dex = require('./rp-dex')();
			let seed = 1;
			for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
			const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
			const roles = RS.roleSets(dex, species);
			const each = Math.max(1, Math.min(3, Math.floor(9 / Math.max(1, roles.length))));
			for (const role of roles) {
				for (let k = 0; k < each; k++) {
					const built = RS.buildSet(dex, species, { role: role.role, rng });
					if (!built) continue;
					const moves = built.moves.map(n => dex.moves.get(n)).filter(m => m.exists);
					const attacks = moves.filter(m => m.category !== 'Status');
					const phys = attacks.filter(m => m.category === 'Physical').length, spec = attacks.length - phys;
					sets.push({
						ids: moves.map(m => m.id), attacks: attacks.map(m => m.name),
						item: String(built.item || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
						evs: built.evs || {}, side: phys === spec ? null : phys > spec ? 'Physical' : 'Special',
					});
				}
			}
		} catch (e) { /* no data: the old guess stands */ }
		FOE_PROFILES.set(key, sets);
		return sets;
	}

	/**
	 * The foe as its built sets say it probably is, narrowed by what it has shown:
	 * only the sets that carry every move it has used (all of them if none do),
	 * its attacking side, the bulk those sets average, its likely unseen attacks,
	 * the damage its item probably adds, and how likely a Choice Scarf is. What
	 * the battle has revealed always wins - a seen item, a lost one, or two
	 * different moves in one stay (no Choice item) switch the guess off.
	 */
	foeGuess(foe) {
		const species = String((foe && (foe.transformed || foe.species)) || '').split(',')[0];
		const seen = [...((foe && foe.moves) || [])].map(m => String(m).toLowerCase().replace(/[^a-z0-9]/g, ''));
		const itemKnown = !!(foe && (foe.item || foe.itemGone));
		const free = !!(foe && foe.movedFreely);
		const key = `${species}|${seen.slice().sort().join(',')}|${itemKnown}|${free}`;
		this._guess = this._guess || new Map();
		if (this._guess.has(key)) return this._guess.get(key);
		if (this._guess.size > 400) this._guess.clear();
		const all = this.foeProfile(species);
		let sets = all.filter(s => seen.every(m => s.ids.includes(m)));
		if (!sets.length) sets = all;
		const dex = PkmnDex.forGen(9);
		const seenAttacks = seen.map(m => dex.moves.get(m)).filter(m => m && m.exists && m.category !== 'Status');
		const phys = seenAttacks.filter(m => m.category === 'Physical').length, spec = seenAttacks.length - phys;
		let side;
		if (phys && spec) side = 'Mixed';
		else if (phys || spec) side = phys ? 'Physical' : 'Special';
		else {
			const p = sets.filter(s => s.side === 'Physical').length, q = sets.filter(s => s.side === 'Special').length;
			if (p !== q) side = p > q ? 'Physical' : 'Special';
			else {
				const sheet = dex.species.get(species);
				side = sheet && sheet.exists && sheet.baseStats.spa > sheet.baseStats.atk ? 'Special' : 'Physical';
			}
		}
		const avg = stat => sets.length ? Math.round(sets.reduce((n, s) => n + (s.evs[stat] || 0), 0) / sets.length / 4) * 4 : 85;
		const bulk = { hp: avg('hp'), atk: avg('atk'), def: avg('def'), spa: avg('spa'), spd: avg('spd'), spe: avg('spe') };
		// Its likely attacks not yet seen: carried by a quarter of the sets or more, as many as it has slots left.
		const count = new Map();
		for (const s of sets) for (const a of s.attacks) count.set(a, (count.get(a) || 0) + 1);
		const seenNames = new Set([...((foe && foe.moves) || [])]);
		const attacks = [...count.entries()].filter(([a, n]) => n >= sets.length / 4 && !seenNames.has(a))
			.sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, 4 - seen.length)).map(([a]) => a);
		// The item's damage, averaged over the sets: Band or Specs 1.5 on their side, Life Orb 1.3.
		const boost = (item, cat) => (item === 'lifeorb' ? 1.3 : !free && ((item === 'choiceband' && cat === 'Physical') || (item === 'choicespecs' && cat === 'Special')) ? 1.5 : 1);
		const factor = cat => (itemKnown || !sets.length ? 1 : sets.reduce((n, s) => n + boost(s.item, cat), 0) / sets.length);
		const out = {
			sets, side, bulk, attacks,
			factor: { Physical: factor('Physical'), Special: factor('Special') },
			scarf: itemKnown || free || !sets.length ? 0 : sets.filter(s => s.item === 'choicescarf').length / sets.length,
			scarfSpe: Math.max(0, ...sets.filter(s => s.item === 'choicescarf').map(s => s.evs.spe || 0)),
		};
		this._guess.set(key, out);
		return out;
	}

	/**
	 * How much harder than the bare model this foe hits, per side: the item
	 * guess, corrected by its hits so far (learnFoeScale). Null when it is 1 both ways.
	 */
	foeScale(foe, guess) {
		const out = {};
		let any = false;
		for (const cat of ['Physical', 'Special']) {
			const prior = guess.factor[cat];
			const seen = (foe.hits || []).filter(h => h.ratio && h.cat === cat && h.itemAt === String(foe.item || ''));
			let v = seen.length ? (prior * 0.5 + seen.reduce((n, h) => n + h.ratio, 0)) / (0.5 + seen.length) : prior;
			v = Math.max(0.7, Math.min(2, v));
			out[cat] = v;
			if (Math.abs(v - 1) > 0.01) any = true;
		}
		return any ? out : null;
	}

	/**
	 * Read their item off how hard they hit (foeModel, 24 Sep 2026).
	 *
	 * Each plain hit battle.js recorded is measured against the bare model - the
	 * same foe with full investment and no item guess, at the boosts both sides
	 * had then - and the ratio is kept. About 1.5 is a Choice Band or Specs, 1.3 a
	 * Life Orb (whose recoil usually names it first), about 1 no damage item, and
	 * less than that a set not built to hit. foeScale() then uses the ratio in
	 * place of the guess. Nothing here names the item: a Huge Power or an
	 * Adaptability reads the same way, and should.
	 */
	learnFoeScale(gen, state, request) {
		if (!this.modelsFoes() || !request || !request.side) return;
		const dex = PkmnDex.forGen(gen.num);
		const foes = [...Object.values(state.opponent || {}), ...Object.values(state.theirBench || {})];
		for (const foe of foes) {
			if (!foe || !foe.hits) continue;
			for (const h of foe.hits) {
				if (h.ratio !== undefined) continue;
				h.ratio = null;
				const d = dex.moves.get(h.move);
				if (!d || !d.exists || d.category === 'Status' || d.multihit || d.basePowerCallback || FIXED_DAMAGE[d.name] || h.screens ||
					/^(foulplay|bodypress|knockoff|terablast|photongeyser)$/.test(d.id) || foe.dynamaxed) continue;
				const entry = request.side.pokemon.find(p => String(p.details || '').split(',')[0] === h.target && !/fnt/.test(p.condition || ''));
				if (!entry) continue;
				try {
					const me = this.myPokemon(gen, entry, state);
					me.boosts = { ...(me.boosts || {}), ...h.myBoosts };
					me.originalCurHP = me.maxHP();
					const them = this.foePokemon(gen, { ...foe, boosts: h.foeBoosts || {}, tera: h.foeTera, hp: 100, maxhp: 100 }, { bare: true });
					const field = new calc.Field({ weather: h.weather || undefined, terrain: h.terrain || undefined });
					const expect = this.damagePct(gen, them, me, d.name, field);
					if (expect < 4) continue;
					h.ratio = (h.dealt / h.maxhp * 100) / expect;
					h.cat = d.category;
					h.itemAt = String(foe.item || '');
				} catch (e) { h.ratio = null; }
			}
		}
	}

	/**
	 * The attacks to judge a foe by: what it has shown, this server's own attacks
	 * its species carries, and - with the foe model - its likely unseen ones.
	 * Null means nothing to go on (roughIncoming's probes). Without the foe model
	 * a foe with one move shown was judged by that one move alone, and one that
	 * had shown only Swords Dance by nothing at all.
	 */
	foeAttacks(gen, foe, hidden = true) {
		const seen = foe && foe.moves ? [...foe.moves] : [];
		const custom = hidden ? this.hiddenAttacks(gen, foe) : [];
		if (this.modelsFoes() && seen.length < 4) {
			const all = [...new Set([...seen, ...custom, ...this.foeGuess(foe).attacks])];
			return all.length ? all : null;
		}
		return seen.length ? [...seen, ...custom] : null;
	}

	/**
	 * Every ability the opponent might actually have, as calc Pokemon.
	 *
	 * The calculator assumes the species' first ability slot when none is known,
	 * and that is frequently the wrong one: a Gastrodon is taken to have Sticky
	 * Hold rather than Storm Drain, so Surf reads as 33% when the real answer is
	 * often zero. Anything that has not been revealed has to be treated as any of
	 * its possibilities, not as slot zero.
	 */
	foeVariants(gen, foe) {
		if (foe.ability) return [{ mon: this.foePokemon(gen, foe), weight: 1 }];
		const name = foe.transformed || foe.species;
		const species = PkmnDex.forGen(gen.num).species.get(name);
		let abilities = species ? [...new Set(Object.values(species.abilities || {}).filter(a => a))] : [];
		/*
		 * The abilities this server gave it as well: @pkmn/dex lists Vaporeon as
		 * Water Absorb / Hydration, and the battle's own dex adds Liquid Body (Water
		 * Absorb and Regenerator) - an unrevealed Vaporeon is an absorber either way.
		 */
		try {
			const rp = require('./rp-dex')().species.get(name);
			if (rp && rp.exists) abilities = [...new Set([...abilities, ...Object.values(rp.abilities || {}).filter(a => a)])];
		} catch (e) { /* no simulator data: the calculator's list is all there is */ }

		// In Random Battle the species is generated with a known ability - usually
		// exactly one - so there is nothing to guess. This is what turns a Gastrodon
		// from "a third of a Surf, probably" into the Storm Drain wall it always was.
		const generated = this.knownAbilities(name) || this.knownAbilities(species && species.baseSpecies);
		if (generated) {
			const narrowed = abilities.filter(a => generated.includes(a));
			if (narrowed.length) abilities = narrowed;
		}
		if (abilities.length < 2) {
			return [{ mon: this.foePokemon(gen, abilities.length ? { ...foe, ability: abilities[0] } : foe), weight: 1 }];
		}

		// Weight by what people in this format actually run, when we know. A
		// Gastrodon is overwhelmingly Storm Drain rather than Sticky Hold, and
		// treating those as equally likely under-rates the immunity badly.
		const stats = this.usage && (this.usage[name] || this.usage[species.baseSpecies]);
		const table = stats && stats.abilities;

		// Narrow by what the battle has shown. A Surf that did nothing says Storm
		// Drain; a Surf that landed says it is not Storm Drain, and never will be.
		const dex = PkmnDex.forGen(gen.num);
		const typeOf = moveName => { const m = dex.moves.get(moveName); return m && m.exists ? m.type : null; };
		const immuneTypes = new Set([...(foe.immuneTo || [])].map(typeOf).filter(t => t));
		const landedTypes = new Set([...(foe.notImmuneTo || [])].map(typeOf).filter(t => t));

		let plausible = abilities.filter(a => {
			const blocks = ABILITY_IMMUNITY[a];
			if (blocks && landedTypes.has(blocks)) return false;          // it would have absorbed that
			if (immuneTypes.size) {
				// Something bounced off: prefer abilities that explain it.
				if (blocks && immuneTypes.has(blocks)) return true;
				return ![...immuneTypes].some(t => Object.values(ABILITY_IMMUNITY).includes(t) &&
					abilities.some(x => ABILITY_IMMUNITY[x] === t));
			}
			return true;
		});
		if (foe.keptItem) {
			const sticky = plausible.filter(a => a === 'Sticky Hold');
			if (sticky.length) plausible = sticky;   // Knock Off failed: that is Sticky Hold
		}
		if (!plausible.length) plausible = abilities;
		if (plausible.length === 1) return [{ mon: this.foePokemon(gen, { ...foe, ability: plausible[0] }), weight: 1 }];

		return plausible.map(ability => ({
			mon: this.foePokemon(gen, { ...foe, ability }),
			weight: table ? (table[ability] || 0.02) : 1,
		}));
	}

	/**
	 * Damage one of our moves does to a foe, averaged over the abilities it could
	 * have. An ability that grants immunity drags the average down hard, which is
	 * exactly the caution wanted: clicking a move that might do nothing at all is
	 * a far worse mistake than clicking a slightly weaker one that always lands.
	 */
	/**
	 * How much harder a move hits as a Max Move, for a Dynamaxed side.
	 *
	 * The calculator has no Dynamax, so both sides were judged on the base move:
	 * the bot under-rated its own Max Moves (Kingambit's Max Steelspike ran into
	 * Keystone Legion because the kill did not look like one) and under-rated a
	 * Dynamaxed opponent's, which is how Glaceon's Max Hailstorm kept coming as a
	 * surprise. Max Guard and status moves are not attacks, so they stay at 1.
	 */
	maxRatio(gen, moveName, dynamaxed) {
		if (!dynamaxed || this.cfg.naive) return 1;
		try {
			const move = PkmnDex.forGen(Math.max(8, gen.num)).moves.get(moveName);
			const max = move && move.maxMove && move.maxMove.basePower;
			if (!move || !max || move.category === 'Status' || !move.basePower) return 1;
			return max / move.basePower;
		} catch (e) { return 1; }
	}

	damageToFoe(gen, attacker, foe, moveName, field) {
		/*
		 * A type that has already bounced off this foe (an -immune line, or an
		 * absorbing ability's heal) stays bounced until one of that type lands: the
		 * battle said so, whatever the ability tables know. The Max Move that bounced
		 * counts for the plain move of its type. Not after it Terastallizes, which can
		 * take a type immunity away.
		 */
		if (!this.cfg.naive && foe && !foe.tera && foe.immuneTo && foe.immuneTo.size) {
			const dex = PkmnDex.forGen(gen.num);
			const typeOf = n => { const m = dex.moves.get(n); return m && m.exists && m.category !== 'Status' ? m.type : null; };
			const type = typeOf(moveName);
			const landed = [...(foe.notImmuneTo || [])].some(n => typeOf(n) === type);
			if (type && !landed && [...foe.immuneTo].some(n => typeOf(n) === type)) return 0;
		}
		const variants = this.foeVariants(gen, foe);
		if (variants.length === 1) return this.damagePct(gen, attacker, variants[0].mon, moveName, field);
		let total = 0, weight = 0;
		for (const v of variants) {
			total += this.damagePct(gen, attacker, v.mon, moveName, field) * v.weight;
			weight += v.weight;
		}
		return weight > 0 ? total / weight : 0;
	}

	/** Usage statistics for the format being played, if the bot handed them over. */
	setUsage(usage) { this.usage = usage || null; }

	/**
	 * Tell the bot which format it is in, so it can look up the standard sets.
	 *
	 * Only Random Battle has any: a built team can carry anything, and pretending
	 * to know it would be worse than admitting we do not.
	 */
	setFormat(format) {
		this.format = format || '';
		this.presets = format ? presetsFor(format) : null;
		this.presetDamaging = new Map();
		this._guess = null;
		return this.presets;
	}

	/** The abilities this species is actually generated with, if we may look. */
	knownAbilities(species) {
		if (!this.cfg.knowsSets || !this.presets) return null;
		return this.presets.abilities(species);
	}

	/**
	 * The damaging moves the species can turn up with.
	 *
	 * Cached per species: the movepool is fixed for the battle, and working out
	 * which entries are attacks costs a dex lookup each time it is asked.
	 */
	knownAttacks(gen, species) {
		// A built-team format has no presets; the foe model reads this server's own sets instead.
		if (!this.presets && this.modelsFoes()) {
			const likely = this.foeGuess({ species, moves: new Set() }).attacks;
			return likely.length ? likely : null;
		}
		if (!this.cfg.readsSets || !this.presets) return null;
		const key = String(species || '').toLowerCase();
		if (this.presetDamaging.has(key)) return this.presetDamaging.get(key);
		const ids = this.presets.moves(species);
		let attacks = null;
		if (ids) {
			const dex = PkmnDex.forGen(gen.num);
			attacks = ids
				.map(id => dex.moves.get(id))
				.filter(m => m && m.exists && m.category !== 'Status')
				.map(m => m.name);
			if (!attacks.length) attacks = null;
		}
		this.presetDamaging.set(key, attacks);
		return attacks;
	}

	/** Percent of the target's remaining HP a move is expected to remove. */
	damagePct(gen, attacker, defender, moveName, field) {
		try {
			const move = new calc.Move(gen, moveName);
			/*
			 * Fixed damage: Seismic Toss, Night Shade, Super Fang, Ruination... have no
			 * base power, and returning 0 for them made a Blissey or a Ting-Lu think it
			 * had nothing to click - so it clicked whatever tied at zero, immune target
			 * or not. Their damage is known exactly; only the type immunity applies.
			 */
			const fixed = FIXED_DAMAGE[move.name];
			if (fixed) {
				const dex = PkmnDex.forGen(gen.num);
				const moveType = dex.moves.get(move.name).type;
				const types = (defender.teraType ? [defender.teraType] : defender.types) || [];
				if (types.some(t => { const td = dex.types.get(t); return td && td.damageTaken && td.damageTaken[moveType] === 3; })) return 0;
				const hp = defender.originalCurHP || defender.maxHP();
				const dealt = fixed(attacker, defender, hp);
				return Math.max(0, Math.min(100, (dealt / hp) * 100));
			}
			if (!move.bp) return 0;
			// A Charge doubles the next Electric move; the calculator has no idea.
			const charged = attacker.velvetCharged && move.type === 'Electric' ? 2 : 1;
			// A foe's likely damage item, or what its hits have shown (foeModel: foeScale()).
			let scale = attacker.velvetScale ? (attacker.velvetScale[move.category] || 1) : 1;
			/*
			 * The Witching Hour Mega Banette (data/velvet/halloween.js), which the
			 * calculator knows only the type and 110 power of. Witching Hour makes its
			 * Ghost moves 1.5x, and Witch's Snatch is 150 power into a held item, as
			 * Knock Off checks it (not a Mega Stone on its owner). Replay
			 * gen9rpou-10-tlvuiv: it read 89% into the Boots Clodsire the bot led with,
			 * and knocked it out from full. A foe whose item is not yet known is taken
			 * to hold one: nearly everything does.
			 */
			if (!this.cfg.naive) {
				if (String(attacker.ability || '') === 'Witching Hour' && move.type === 'Ghost') scale *= 1.5;
				if (move.name === "Witch's Snatch") {
					const item = String(defender.item || '');
					const data = item ? PkmnDex.forGen(9).items.get(item) : null;
					const base = s => String(s || '').split('-')[0];
					// A Mega Stone on the Pokemon it belongs to, or a Z-Crystal, cannot be taken.
					const stuck = !!(data && data.exists && ((data.megaStone && base(data.megaEvolves) === base(defender.name)) || data.zMove));
					if ((item && !stuck) || (!item && defender.velvetItemUnknown)) scale *= 150 / 110;
				}
			}
			if (CALC_ABILITY[String(attacker.ability || '')]) {
				attacker = attacker.clone();
				attacker.ability = CALC_ABILITY[String(attacker.ability)];
			}
			if (CALC_ABILITY[String(defender.ability || '')]) {
				defender = defender.clone();
				defender.ability = CALC_ABILITY[String(defender.ability)];
			}
			// The lake trio's signature abilities (Balance Patch 1) let Psychic moves hit Dark types;
			// the calculator only knows the chart, so Dark comes off a copy of the defender for them.
			if (LAKE_ABILITIES.has(String(attacker.ability || '')) && move.type === 'Psychic' &&
				defender.types && defender.types.includes('Dark')) {
				const rest = defender.types.filter(t => t !== 'Dark');
				defender = retype(defender, rest.length ? rest : ['Normal']);
			}
			// Oxidize (Balance Patch 1) is super effective on Steel: read Steel as Grass for it.
			if (moveName === 'Oxidize' && defender.types && defender.types.includes('Steel')) {
				defender = retype(defender, defender.types.map(t => (t === 'Steel' ? 'Grass' : t)));
			}
			/*
			 * A move that refuses to be shrugged off - Witch's Snatch landing on
			 * Normal types the way Scrappy does. The battle reads that off the
			 * move's own `ignoreImmunity`; the calculator has never looked at it
			 * and answers 0, so the bot would leave a Snorlax alone forever while
			 * holding the move written to kill it. The immune type comes off a
			 * copy of the defender, which is exactly what the battle will do.
			 */
			defender = seeingPastImmunity(gen, move, defender);
			const result = calc.calculate(gen, attacker, defender, move, field);
			const dmg = result.damage;
			const rolls = Array.isArray(dmg) ? dmg.flat().filter(n => typeof n === 'number') : [dmg];
			if (!rolls.length) return 0;
			const avg = charged * scale * rolls.reduce((a, b) => a + b, 0) / rolls.length;
			const hp = defender.originalCurHP || defender.maxHP();
			return Math.max(0, (avg / hp) * 100);
		} catch (e) {
			return 0;
		}
	}

	// --------------------------------------------------------------------- tempo
	/**
	 * Is speed worth anything right now? Under Trick Room the whole axis flips,
	 * and a slow Pokemon on a team that still has Trick Room available is a win
	 * condition rather than dead weight.
	 */
	speedPolarity(request, state) {
		if (state.trickRoom) return -1;
		const hasTrickRoom = (request.side.pokemon || []).some(p =>
			!/fnt/.test(p.condition) && (p.moves || []).some(m => String(m).replace(/\W/g, '').toLowerCase() === 'trickroom'));
		return hasTrickRoom ? -0.35 : 1;   // available but not up: slow is a liability, not a write-off
	}

	/**
	 * What a Pokemon is still worth for the rest of the game, 0-100.
	 *
	 * This is what stops the bot trading its last fast attacker to save a wall it
	 * will never need again. A healthy, fast, hard-hitting mon that outspeeds what
	 * the opponent has left is a win condition and is protected accordingly; a
	 * slow one with nothing left to do is cheap, and spending it to keep the win
	 * condition alive is the correct play.
	 */
	/**
	 * Cache for one decision. The sacking and lead rules ask the same damage
	 * questions of the same pairs many times over (valueRank calls monValue for
	 * every teammate, per bench option); decide() opens this and closes it, so
	 * nothing survives into the next turn's position. (24 Sep 2026)
	 */
	memo(key, fn) {
		if (!this._memo) return fn();
		if (this._memo.has(key)) return this._memo.get(key);
		const value = fn();
		this._memo.set(key, value);
		return value;
	}

	/**
	 * What a species usually brings, as shares of its sets (0..1 each): setup,
	 * hazards, pivot, Knock Off, status, and whether every set is a setup
	 * sweeper. From the Random Battle sets when we may read them, otherwise from
	 * this server's role sets (src/role-sets.js, read only). Used to guess their
	 * leads (Pinkacross, How to Choose Your Lead) and to see setup fodder coming
	 * (The Art of Sacking). (24 Sep 2026)
	 */
	speciesKit(species) {
		this.kitCache = this.kitCache || new Map();
		const key = String(species || '');
		if (this.kitCache.has(key)) return this.kitCache.get(key);
		const RS = require('./role-sets');
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const traits = ids => ({
			setup: ids.some(m => RS.SETUP.includes(m)),
			hazards: ids.some(m => RS.HAZARDS.includes(m)),
			pivot: ids.some(m => RS.PIVOTS.includes(m)),
			knock: ids.includes('knockoff'),
			status: ids.some(m => RS.STATUS.includes(m)),
		});
		let kit = { setup: 0, hazards: 0, pivot: 0, knock: 0, status: 0, sweeperOnly: false };
		try {
			const preset = this.cfg.readsSets && this.presets ? this.presets.moves(key) : null;
			if (preset) {
				const t = traits(preset.map(idOf));
				kit = { setup: +t.setup, hazards: +t.hazards, pivot: +t.pivot, knock: +t.knock, status: +t.status, sweeperOnly: false };
			} else {
				const sets = RS.roleSets(require('./rp-dex')(), key);
				if (sets.length) {
					const each = sets.map(s => traits((s.movepool || []).map(idOf)));
					const share = k => each.filter(t => t[k]).length / each.length;
					kit = { setup: share('setup'), hazards: share('hazards'), pivot: share('pivot'), knock: share('knock'), status: share('status'),
						sweeperOnly: sets.every(s => RS.SETUP_ROLES.includes(s.role)) };
				}
			}
		} catch (e) { /* no data: a blank kit */ }
		this.kitCache.set(key, kit);
		return kit;
	}

	/** Has this foe shown, or does it usually carry, a way to set up? */
	foeCanSetUp(gen, foe) {
		if (!foe) return false;
		if (Object.values(foe.boosts || {}).some(v => v > 0)) return true;
		const dex = PkmnDex.forGen(gen.num);
		for (const m of foe.moves || []) {
			const d = dex.moves.get(m);
			const up = d && (d.target === 'self' || !d.target) && d.category === 'Status' && (d.boosts || (d.self && d.self.boosts));
			if (up && Object.values(up).some(v => v > 0)) return true;
		}
		if (foe.moves && foe.moves.size >= 4) return false;
		return this.speciesKit(foe.transformed || foe.species).setup >= 0.5;
	}

	/** A stable name for one of our Pokemon within a decision. */
	entryKey(entry) { return `${entry.ident || ''}|${entry.details || ''}`; }

	/**
	 * The team-wide picture the sacking rules need, once per decision: for each
	 * of our living Pokemon, what it does to each foe that is left, which of them
	 * it is the only answer to, and whether a foe hard-walls it with nothing else
	 * of ours able to wear that foe down.
	 *
	 * The Art of Sacking (Pinkacross; 24 Sep 2026): a Pokemon is worth its health
	 * AND what it can still do against what they have left - "good into five but
	 * hard-walled by the sixth" is not valuable - AND whether it is the only
	 * thing standing between a live threat and the rest of the team. HP alone
	 * is the classic mistake: he sacked a full-health Gholdengo that had become
	 * setup fodder and kept a 15% Moltres that was the only check to a sweeper.
	 *
	 * An answer: outspeeds and KOs it, or takes under 45% from it while taking
	 * 30% or more back. A live threat: it hits half our living team for 50% or
	 * more, or it sets up and hits any of them that hard. A hard wall: our best
	 * hit does under 12% to it.
	 */
	teamPlan(gen, state, request) {
		return this.memo('teamPlan', () => {
			const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
			const ours = (request.side.pokemon || []).filter(p => !/fnt/.test(p.condition || ''));
			const { list: theirs } = this.foeRemaining(state);
			const rows = new Map();
			for (const p of ours) rows.set(this.entryKey(p), { out: [], sole: 0, walled: false, avgOut: 0 });
			const answers = theirs.map(() => []);
			const threatens = theirs.map(() => 0);
			ours.forEach(p => {
				const me = this.myPokemon(gen, p, state);
				const mySpe = this.speedOf(me, me.boosts, me.status, state.weather);
				const moves = (p.moves || []).map(m => toName(m, 'moves'));
				const row = rows.get(this.entryKey(p));
				theirs.forEach((foe, j) => {
					const them = this.foePokemon(gen, foe);
					const out = Math.max(0, ...moves.map(m => this.damageToFoe(gen, me, foe, m, field)));
					const list = this.foeAttacks(gen, foe);
					const back = list
						? Math.max(0, ...list.map(m => this.damagePct(gen, them, me, m, field)))
						: this.roughIncoming(gen, them, me, field);
					const theirSpe = this.foeSpeed(gen, foe, state.weather);
					const faster = state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe;
					row.out.push(out);
					if ((faster && out >= 100) || (back < 45 && out >= 30)) answers[j].push(row);
					if (back >= 50) threatens[j]++;
				});
				row.avgOut = row.out.length ? row.out.reduce((a, b) => a + Math.min(100, b), 0) / row.out.length : 0;
			});
			theirs.forEach((foe, j) => {
				// A setup sweeper is a live threat as soon as it hurts anything: the
				// boosts are what make it hit the rest.
				const live = threatens[j] >= Math.max(1, ours.length / 2) || (threatens[j] >= 1 && this.foeCanSetUp(gen, foe));
				if (answers[j].length === 1 && live) answers[j][0].sole++;
				const wornDown = [...rows.values()].some(r => r.out[j] >= 35);
				for (const r of rows.values()) if (r.out[j] < 12 && !wornDown) r.walled = true;
			});
			return { rows, foes: theirs.length };
		});
	}

	monValue(gen, entry, state, request) {
		if (/fnt/.test(entry.condition || '')) return 0;   // dead is worth nothing
		if (this.cfg.sacking && request && request.side) {
			return this.memo(`value|${this.entryKey(entry)}|${entry.condition}`, () => this.monValueOf(gen, entry, state, request));
		}
		return this.monValueOf(gen, entry, state, request);
	}

	monValueOf(gen, entry, state, request) {

		const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
		const hpPct = cond ? (+cond[1] / +cond[2]) * 100 : 100;
		const me = this.myPokemon(gen, entry, state);
		const polarity = this.speedPolarity(request, state);

		// Speed measured against what the opponent actually has left on the field.
		const foes = state.foes();
		let speedEdge = 0;
		if (foes.length) {
			const mySpe = this.speedOf(me, me.boosts, me.status, state.weather);
			const theirSpe = foes.map(f => this.foeSpeed(gen, f, state.weather));
			const faster = theirSpe.filter(sp => mySpe > sp).length / theirSpe.length;
			speedEdge = (faster - 0.5) * 2;              // -1 (outsped by all) .. +1 (outspeeds all)
		}
		// Choice Scarf is the classic late-game cleaner item.
		const item = String(entry.item || '');
		if (item === 'choicescarf') speedEdge = Math.min(1, speedEdge + 0.6);

		let value = 30;
		value += speedEdge * polarity * 22;

		// Offensive presence: can it still threaten what is in front of it?
		if (foes.length) {
			const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
			let best = 0;
			for (const foe of foes) {
				for (const m of entry.moves || []) best = Math.max(best, this.damageToFoe(gen, me, foe, toName(m, 'moves'), field));
			}
			let offense = Math.min(45, best * 0.45);
			/*
			 * Offensive utility now, against everything they have left rather than
			 * only the one in front, and next to nothing when a living foe hard-walls
			 * it and none of our team can wear that foe down (The Art of Sacking,
			 * 24 Sep 2026).
			 */
			const row = this.cfg.sacking && request && request.side ? this.teamPlan(gen, state, request).rows.get(this.entryKey(entry)) : null;
			if (row && row.out.length) {
				offense = 0.5 * offense + 0.5 * Math.min(45, row.avgOut * 0.45);
				if (row.walled) offense *= 0.3;
			}
			value += offense;
			// The only answer to a live threat is worth keeping for it, whatever it
			// does to the rest (his Moltres at 15%).
			if (row && row.sole) value += 14 + 6 * Math.min(2, row.sole);
		}

		// Status eats most of what makes a sweeper a sweeper.
		const status = (/ (brn|psn|tox|par|slp|frz)/.exec(entry.condition || '') || [])[1];
		if (status === 'par') value *= 0.55;             // a paralysed cleaner cannot clean
		else if (status === 'slp' || status === 'frz') value *= 0.45;
		else if (status === 'tox') value *= 0.7;
		else if (status === 'brn') value *= 0.75;

		// HP matters, but a Focus Sash / 1 HP cleaner still cleans - so this is a
		// gentle curve rather than a straight multiplier.
		value *= 0.55 + 0.45 * (hpPct / 100);
		/*
		 * Dead on entry: a benched Pokemon our own side's hazards would finish is
		 * no longer a fighter, but it is not worthless either. It is a free switch
		 * that can never become setup fodder, so it is worth keeping at a small,
		 * fixed price rather than ranked as the cheapest thing to throw in (The Art
		 * of Sacking, 24 Sep 2026).
		 */
		if (this.cfg.sacking && !entry.active && this.entryHazards(gen, me, entry, state) >= hpPct) value = 15;
		return Math.max(0, Math.min(100, value));
	}

	/** Rank of this mon's value within the surviving team, 0 (worst) .. 1 (best). */
	valueRank(gen, entry, state, request) {
		const alive = (request.side.pokemon || []).filter(p => !/fnt/.test(p.condition));
		if (alive.length < 2) return 1;
		const mine = this.monValue(gen, entry, state, request);
		const below = alive.filter(p => this.monValue(gen, p, state, request) < mine).length;
		return below / (alive.length - 1);
	}

	// ------------------------------------------------------------------ scoring
	/**
	 * How likely is the opponent to leave this turn?
	 *
	 * The classic case: our Water-type is in front of their Fire-type. They are
	 * not going to stay and be washed away, so the free turn is real and setting
	 * up is correct even though a resisted hit looks scary on paper. Returns
	 * roughly 0 (they are thrilled to be here) .. 1 (they must leave or lose it).
	 */
	switchPressure(gen, me, foes, field) {
		if (!foes.length) return 0;
		let pressure = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			let ourBest = 0;
			for (const m of this.myMoveNames) ourBest = Math.max(ourBest, this.damageToFoe(gen, me, foe, m, field));
			const seen = this.foeAttacks(gen, foe, false);
			const theirBest = seen
				? Math.max(0, ...seen.map(m => this.damagePct(gen, them, me, m, field)))
				: this.roughIncoming(gen, them, me, field);

			let p = 0;
			if (ourBest >= 100) p = 0.95;                       // stay and die
			else if (ourBest >= 55) p = 0.6;                    // 2HKO, uncomfortable
			else if (ourBest >= 35) p = 0.3;
			// If they cannot meaningfully hurt us back, staying is pointless for them.
			if (theirBest < 20) p = Math.max(p, 0.55);
			else if (theirBest > 70) p *= 0.45;                 // they are happy to trade
			if (foe.hp / (foe.maxhp || 100) < 0.35) p = Math.max(p, 0.5);
			pressure = Math.max(pressure, p);
		}
		return Math.min(1, pressure);
	}

	/** After this boost, does the board actually fall over? */
	sweepPotential(gen, entry, state, foes, field, boosts) {
		if (!foes.length) return 0;
		const boosted = this.myPokemon(gen, entry, state);
		const current = boosted.boosts || {};
		boosted.boosts = { ...current };
		for (const [stat, delta] of Object.entries(boosts || {})) {
			if (delta > 0) boosted.boosts[stat] = Math.max(-6, Math.min(6, (current[stat] || 0) + delta));
		}
		let best = 0, fasterThanAll = true;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			for (const m of this.myMoveNames) best = Math.max(best, this.damageToFoe(gen, boosted, foe, m, field));
			// With the foe model, speed as foeSpeed() and speedOf() read it (boosts and all), like everywhere else.
			const theirSpe = this.cfg.foeModel ? this.foeSpeed(gen, foe, state.weather) : ((them.stats && them.stats.spe) || 0);
			const mySpe = this.cfg.foeModel ? this.speedOf(boosted, boosted.boosts, boosted.status, state.weather) : ((boosted.stats && boosted.stats.spe) || 0);
			if (state.trickRoom ? mySpe > theirSpe : mySpe < theirSpe) fasterThanAll = false;
		}
		const immediate = best >= 100 ? (fasterThanAll ? 1 : 0.6) : best >= 70 ? (fasterThanAll ? 0.55 : 0.3) : best / 200;
		if (!this.cfg.predict || typeof state.foeTeam !== 'function') return immediate;

		/*
		 * Looking past the one in front of us, the way a good player does (owner,
		 * 23 Sep 2026). A boost is worth what it does to the whole team that is left:
		 *
		 *   - Beat means KO it and get there first. Our own priority counts as getting
		 *     there first: a +1 Dragonite's Extreme Speed does not care who is faster.
		 *   - Not sweeping all the way still counts. A boosted hit that 2HKOs makes a
		 *     hole, and a hole is most of what a setup sweeper is for.
		 *   - Their priority ends it. A shown priority attack that KOs the boosted
		 *     Pokemon halves the plan: it gets revenge-killed after one KO.
		 */
		const dex = PkmnDex.forGen(gen.num);
		const attackOf = m => { const d = dex.moves.get(m); return d && d.exists && d.category !== 'Status' ? d : null; };
		const myPriority = this.myMoveNames.filter(m => { const d = attackOf(m); return d && d.priority > 0; });
		const mySpe = this.cfg.foeModel ? this.speedOf(boosted, boosted.boosts, boosted.status, state.weather) : ((boosted.stats && boosted.stats.spe) || 0);
		const team = state.foeTeam();
		let worth = 0, revenge = false;
		for (const foe of team) {
			const them = this.foePokemon(gen, foe);
			let hit = 0;
			for (const m of this.myMoveNames) hit = Math.max(hit, this.damageToFoe(gen, boosted, foe, m, field));
			const prio = Math.max(0, ...myPriority.map(m => this.damageToFoe(gen, boosted, foe, m, field)));
			const theirSpe = this.cfg.foeModel ? this.foeSpeed(gen, foe, state.weather) : ((them.stats && them.stats.spe) || 0);
			const first = (state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe) || prio >= 100;
			worth += hit >= 100 ? (first ? 1 : 0.55) : hit >= 50 ? (first ? 0.4 : 0.25) : hit / 250;
			const theirs = this.foeAttacks(gen, foe) || this.hiddenAttacks(gen, foe);
			if (theirs.some(m => { const d = attackOf(m); return d && d.priority > 0 && this.damagePct(gen, them, boosted, m, field) >= 100; })) revenge = true;
		}
		const share = team.length ? worth / team.length : 0;
		const plan = Math.max(immediate * 0.6, (immediate + share) / 2);
		return revenge ? plan * 0.5 : plan;
	}

	/**
	 * Everything the opponent still has, as far as the battle has shown it, and
	 * how many they have that we have never seen.
	 *
	 * foeTeam() knows the field and the team preview; it forgets a foe that
	 * switched out in a format without a preview, and gives a previewed one full
	 * health even after we chipped it. The battle state now keeps what it knew
	 * about each foe that left (theirBench), so this merges the two. `unknown` is
	 * 0 whenever a preview showed the whole team; otherwise it is their team size
	 * minus what has been seen, and any rule that claims to know the whole board
	 * (winning unboosted, the exact endgame) must stand down while it is above 0.
	 * (24 Sep 2026)
	 */
	foeRemaining(state) {
		const base = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const same = (a, b) => { const x = base(a), y = base(b); return x.startsWith(y) || y.startsWith(x); };
		const team = typeof state.foeTeam === 'function' ? state.foeTeam() : state.foes();
		const bench = Object.values(state.theirBench || {}).filter(m => m && !m.fainted);
		const list = team.map(f => {
			if (!f.bench) return f;
			const snap = bench.find(b => same(b.species, f.species));
			return snap ? { ...f, ...snap, bench: true } : f;
		});
		for (const b of bench) if (!list.some(f => same(f.species, b.species))) list.push(b);
		const previewed = !!(state.preview && state.preview[state.theirPlayer] && state.preview[state.theirPlayer].length);
		const size = (state.teamSize && state.teamSize[state.theirPlayer]) || 6;
		const seen = state.theirSeen ? state.theirSeen.size : list.length + (state.theirDown || []).length;
		return { list, unknown: previewed ? 0 : Math.max(0, size - seen) };
	}

	/**
	 * Who is ahead, -1 (lost) .. +1 (won), counted honestly: the health each
	 * side has left, a fainted Pokemon as nothing and an unseen one of theirs as
	 * full. Judge the game state honestly, not emotionally (Pinkacross, How to
	 * Make Comebacks) - this is the number the search plays safe or sharp by.
	 * (24 Sep 2026)
	 */
	advantage(state, request) {
		const ours = (request && request.side && request.side.pokemon || []).reduce((sum, p) => {
			if (/fnt/.test(p.condition || '')) return sum;
			const cond = /^(\d+)\/(\d+)/.exec(p.condition || '');
			return sum + (cond && +cond[2] ? +cond[1] / +cond[2] : 1);
		}, 0);
		const { list, unknown } = this.foeRemaining(state);
		const theirs = unknown + list.reduce((sum, f) => sum + (f.fainted ? 0 : Math.max(0, (f.hp || 0) / (f.maxhp || 100))), 0);
		return ours + theirs > 0 ? (ours - theirs) / (ours + theirs) : 0;
	}

	/**
	 * Does this Pokemon already win from here without another boost?
	 *
	 * Setup is not automatic (Pinkacross, 10 Noob Traps and the Rank 1 tips):
	 * when the sweeper already KOs everything that is left and gets there first,
	 * every extra boosting turn is only a turn for a crit, a secondary effect or
	 * a status to land. So: each remaining foe is KOed before it moves (by speed
	 * or by our priority), except the one in front, which may instead be a 2HKO
	 * it cannot survive in time. Any unseen foe, or a shown priority attack that
	 * KOs us, and the answer is no. (A11, 24 Sep 2026)
	 */
	winsUnboosted(gen, entry, state, field, incoming) {
		const { list, unknown } = this.foeRemaining(state);
		if (unknown > 0 || !list.length || !this.myMoveNames || !this.myMoveNames.length) return false;
		const me = this.myPokemon(gen, entry, state);
		const myHp = (me.originalCurHP / me.maxHP()) * 100;
		const mySpe = this.speedOf(me, me.boosts, me.status, state.weather);
		const dex = PkmnDex.forGen(gen.num);
		const attack = m => { const d = dex.moves.get(m); return d && d.exists && d.category !== 'Status' ? d : null; };
		for (const foe of list) {
			let hit = 0, prio = 0;
			for (const m of this.myMoveNames) {
				const d = attack(m);
				if (!d) continue;
				const dealt = this.damageToFoe(gen, me, foe, m, field) * (this.cfg.accuracy ? this.hitChance(gen, d, me, foe, state) : 1);
				hit = Math.max(hit, dealt);
				if (d.priority > 0) prio = Math.max(prio, dealt);
			}
			const theirSpe = this.foeSpeed(gen, foe, state.weather);
			const first = (state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe) || prio >= 100;
			const them = this.foePokemon(gen, foe);
			const theirs = this.foeAttacks(gen, foe) || this.hiddenAttacks(gen, foe);
			if (theirs.some(m => { const d = attack(m); return d && d.priority > 0 && this.damagePct(gen, them, me, m, field) >= (this.cfg.hpUnits ? 100 : myHp); })) return false;
			if (hit >= 100 && first) continue;
			if (!foe.bench && hit >= 50 && (first ? incoming < myHp : incoming * 2 < myHp)) continue;
			return false;
		}
		return true;
	}

	/**
	 * Is setting up against this opponent simply a wasted turn?
	 *
	 * Answered from what the battle has shown rather than from what the Pokemon
	 * could have: an ability we have seen, or a move they have used. Guessing
	 * that a Clefable is Unaware before it proves it would be right most of the
	 * time and wrong in the way that loses games.
	 */
	setupIsWasted(gen, foe, boostsUp, ctx) {
		const foes = (ctx && ctx.foes) || [];
		const offensive = ['atk', 'spa', 'spe'].some(stat => (boostsUp[stat] || 0) > 0);
		const defensive = ['def', 'spd'].some(stat => (boostsUp[stat] || 0) > 0);

		for (const other of foes) {
			const ability = String(other.ability || '').toLowerCase().replace(/[^a-z]/g, '');
			// Unaware kills the offensive half and leaves the defensive half alone -
			// but only against an Unaware Pokemon that can stay in. A Clodsire that
			// cannot 1v1 Garchomp at all is leaving or losing either way, and the
			// Swords Dance is for whatever comes in after (owner, 23 Sep 2026).
			if (ability === 'unaware' && offensive && !defensive && !this.forcesOut(gen, ctx && ctx.me, other, ctx && ctx.field)) return true;

			const seen = other.moves ? [...other.moves] : [];
			for (const move of seen) {
				const id = String(move).toLowerCase().replace(/[^a-z0-9]/g, '');
				if (id === 'haze' || id === 'clearsmog') return true;
				if (this.cfg.setupRisk === false) continue;
				// Shown a way to throw us out (the Stockfish reviews: Swords Dance into Roar).
				if (PHAZES.has(id)) return true;
				// Strength Sap takes the Attack we bought and heals them with it.
				if (id === 'strengthsap' && (boostsUp.atk || 0) > 0 && !defensive) return true;
				/*
				 * A move of theirs that lowers the very stat we are raising undoes the turn:
				 * Blissey spent forty turns using Calm Mind into a Spiritomb's Parting Shot,
				 * which took the Special Attack back every time.
				 */
				const data = PkmnDex.forGen(gen.num).moves.get(id);
				// A few write their drops in their own code rather than in the data, so they are named here.
				const drops = (data && data.boosts && data.target !== 'self' ? data.boosts : null) || UNLISTED_DROPS[id] || null;
				if (drops && Object.entries(drops).some(([stat, v]) => v < 0 && (boostsUp[stat] || 0) > 0)) return true;
			}
		}
		/*
		 * Raising the defence the attack is not coming at. Clodsire used Amnesia twice
		 * while a Landorus took it apart with Earthquake (replay gen9rpou-5-tliyi7).
		 */
		if (this.cfg.setupRisk !== false && ctx && ctx.foes && ctx.foes.length) {
			const raisesDef = (boostsUp.def || 0) > 0, raisesSpd = (boostsUp.spd || 0) > 0;
			const offensive = ['atk', 'spa', 'spe'].some(stat => (boostsUp[stat] || 0) > 0);
			if (!offensive && raisesDef !== raisesSpd) {
				const dex = PkmnDex.forGen(gen.num);
				const their = ctx.foes[0];
				const attacks = [...(their.moves || [])].map(m => dex.moves.get(m)).filter(m => m && m.exists && m.category !== 'Status');
				const sheet = dex.species.get(their.transformed || their.species);
				const physical = attacks.length
					? attacks.filter(m => m.category === 'Physical').length >= attacks.filter(m => m.category === 'Special').length
					: !!(sheet && sheet.baseStats && sheet.baseStats.atk >= sheet.baseStats.spa);
				if ((physical && raisesSpd) || (!physical && raisesDef)) return true;
			}
		}
		if (this.cfg.setupRisk !== false && ctx && ctx.me) {
			// Burned, Attack boosts are half of nothing (Kingambit: Swords Dance three times while burned).
			const burned = ctx.me.status === 'brn' && !/^(guts|flareboost)$/.test(String(ctx.me.ability || '').toLowerCase().replace(/[^a-z]/g, ''));
			if (burned && (boostsUp.atk || 0) > 0 && !['spa', 'spe', 'def', 'spd'].some(stat => (boostsUp[stat] || 0) > 0)) return true;
			// Already at the ceiling in everything this move raises.
			const boosts = ctx.me.boosts || {};
			if (Object.entries(boostsUp).every(([stat, v]) => v <= 0 || (boosts[stat] || 0) >= 6)) return true;
		}
		void foe;
		return false;
	}

	// ------------------------------------------------------------------ stall
	/**
	 * The style of our own team: 'stall', 'balance', 'bulky offense' or 'hyper
	 * offense', by the teambuilding checklist's rule (team-logic analyze(): four
	 * walls or more is stall, two or three balance, one wall or fewer than two
	 * setup users bulky offense, the rest hyper offense).
	 *
	 * A wall here is stricter than the checklist's: team-logic isDefensive (recovery
	 * or big bulk, two attacks at most) and recovery of its own as well - a move,
	 * Wish, or Regenerator or Poison Heal - and no Choice item. The replay study
	 * called a side stall at 4+ walls of 6 (26 of its 63 sides were exactly 4); the
	 * recovery test keeps a fat balance team out (balance-2's Scarf Gholdengo and
	 * Leech Seed Ferrothorn are bulky, not walls that heal). Read from the request,
	 * so it is our real team, whoever is playing it: a ladder bot, a gym, a summon.
	 */
	ourArchetype(request) {
		if (!request || !request.side) return null;
		const mons = request.side.pokemon || [];
		const key = mons.map(p => `${p.details}|${p.item}`).join(';');
		if (this._styleKey === key) return this._style;
		const TL = require('./team-logic');
		const Dex = require('./rp-dex')();
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		let walls = 0, setup = 0;
		for (const p of mons) {
			const set = { species: String(p.details || '').split(',')[0], moves: (p.moves || []).map(idOf), ability: idOf(p.baseAbility || p.ability), item: idOf(p.item) };
			if (set.moves.some(m => TL.MOVES.setup.includes(m))) setup++;
			try {
				if (!Dex.species.get(set.species).exists || /^choice/.test(set.item)) continue;
				const heals = set.moves.some(m => TL.MOVES.recovery.includes(m)) || TL.ABILITIES.recovery.includes(set.ability);
				if (heals && TL.isDefensive(Dex, set)) walls++;
			} catch (e) { /* an unknown species is not a wall we can count on */ }
		}
		this._styleKey = key;
		this._style = mons.length >= 4 && walls >= 4 ? 'stall' : walls >= 2 ? 'balance' : walls === 1 || setup < 2 ? 'bulky offense' : 'hyper offense';
		return this._style;
	}

	/** The STYLE_RULES our team's style plays, or null when none is on (or on a rung without them). */
	styleRules(request) {
		if (!this.cfg.stallPlay || this.cfg.naive || this.cfg.greedy) return null;
		const style = this.ourArchetype(request);
		const table = this.cfg.styleRules || STYLE_RULES;
		const rules = style && table[style];
		return rules && Object.values(rules).some(Boolean) ? rules : null;
	}

	/** Is our own team stall, with the stall rules on? */
	stallTeam(request) {
		return !!this.cfg.stallPlay && !this.cfg.naive && this.ourArchetype(request) === 'stall';
	}

	/**
	 * Healing, for stall (R4, R5, R10, R13 in docs/stall-replay-study.md).
	 * Humans heal 3.9 times a game at a median 57% (p25 44, p75 65), the same
	 * against threats and not; at 50% or less with recovery they heal half the
	 * time, switch a third, and almost never attack. The bot healed 0.25 times a
	 * game. A heal the hit outruns is a losing loop - stallSwitch() finds the wall
	 * that takes it instead. Returns undefined to leave the move to the old rule.
	 */
	stallRecovery(move, me, state, myHpPct, incoming, dying, ctx) {
		const live = ctx.live;
		if (move.id === 'wish') {
			if (live && live.lastMove === 'Wish' && live.lastMoveTurn >= state.turn - 1) return -20;
			if (dying) return null;
			// Humans Wish at a median 82% and pass it 40% of the time (the bot: 100%, 14%).
			const own = myHpPct <= 85 ? 30 + (85 - myHpPct) * 0.7 : 0;
			// For a teammate only when the turn is free: not in front of a foe that sets up (round 2:
			// Wish at a median 100% HP, 547 of them, passed 27% of the time).
			return Math.max(own, ctx.wishMate && !ctx.foeSetup ? 24 : 0, 2);
		}
		if (move.id === 'rest' && me.status === 'slp') return -30;
		if (myHpPct >= 99.5) return -30;
		// Never at 90% or more: 1% of human heals were at 95%+, 12% of the bot's.
		if (myHpPct >= 90) return -20;
		const full = this.healShare(move, state);
		const heal = Math.min(full, 100 - myHpPct);
		// Rest is two turns asleep: low, or to shed a status, or with Sleep Talk to fill them (A4).
		const rest = move.id === 'rest';
		if (rest && myHpPct > 50 && !(me.status && myHpPct <= 70)) return -10;
		const sleeps = rest ? (ctx.sleepTalk ? 0.85 : 0.65) : 1;
		/*
		 * R13, the one PP rule the replays support: a wall used its heal a median 2
		 * times a game (p75 4) and nobody Struggled, so PP is kept only at the very
		 * end - the last three are for when HP is really short.
		 */
		const pp = ctx.pp ? ctx.pp[move.name] : undefined;
		const save = pp !== undefined && pp <= 3 && myHpPct > 45 && (!ctx.rules || ctx.rules.ppSave) ? 0.5 : 1;
		if (dying) {
			if (ctx.movesFirst && heal > incoming && myHpPct + heal > incoming) return (60 + (heal - incoming)) * sleeps;
			return null;
		}
		if (incoming >= full * 0.9) return 12 * sleeps * save;
		if (myHpPct <= 65) return (48 + (65 - myHpPct) * 1.2) * sleeps * save;
		// 65-90%: only when nothing else is worth the turn (round 2's heals: median 68%, p75 82%; humans' p75 65%).
		return (4 + (90 - myHpPct) * 0.3) * sleeps * save;
	}

	/**
	 * Protect, for stall (R9). 42% of human Protects scout a foe that has just
	 * come in, 42% take a residual tick (their poison or burn, our Leftovers or
	 * Poison Heal), 11% receive a Wish; 3% are a second Protect in a row (the
	 * bot's: 13%, then 39% in round 1 - Blissey Protected six turns running into
	 * a Ceruledge it could not touch). Without a purpose it is a lost turn.
	 */
	stallProtect(gen, move, me, state, myHpPct, ctx) {
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const live = ctx.live;
		// Twice in a row, read off last turn's moves as well as the live entry.
		const lastTurn = (state.lastTurnMoves || []).some(m => m.side === state.myPlayer && PROTECTS.has(idOf(m.name)));
		if (lastTurn || (live && live.lastMoveTurn === state.turn - 1 && PROTECTS.has(idOf(live.lastMove)))) return -30;
		if (move.id === 'endure') return -10;
		const them = (ctx.foes || [])[0];
		if (!them) return -4;
		let score = -4;
		// Scouting: the first turn against a foe we know little about.
		const fresh = state.foeCameIn && state.foeCameIn >= state.turn - 1;
		if (fresh && (!them.moves || them.moves.size < 2)) score = 22;
		// Residual: their status ticks while we lose nothing.
		const ability = idOf(them.ability);
		if (/^(psn|tox|brn)$/.test(them.status || '') && !/^(magicguard|poisonheal|guts)$/.test(ability)) score = Math.max(score, them.status === 'tox' ? 30 : 24);
		// And ours: Leftovers, Black Sludge or Poison Heal while we are short of full.
		const myItem = idOf(me.item), myAbility = idOf(me.ability);
		if (myHpPct < 94) {
			if (myAbility === 'poisonheal' && /^(psn|tox)$/.test(me.status || '')) score = Math.max(score, 24);
			else if (myItem === 'leftovers' || myItem === 'blacksludge') score = Math.max(score, 14);
		}
		// A free turn for a foe that sets up is the wrong free turn.
		if (!them.status && this.foeCanSetUp(gen, them)) score -= 12;
		return score;
	}

	/**
	 * Status, aimed (R6 and research B1/B2). Humans burned physical attackers 82%
	 * of the time and statused an immune foe 1% of the time (the bot: 12%).
	 * Poison is worth nothing into Poison Heal, Guts, Magic Guard and the like,
	 * less into Regenerator and Natural Cure (they shed or outheal it), and a
	 * burn is for the physical attacker.
	 */
	stallStatus(gen, move, foe, ctx) {
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const them = (ctx.foes || [])[0];
		if ((foe && foe.status) || (them && them.status)) return -25;
		const dex = PkmnDex.forGen(gen.num);
		const sheet = them ? dex.species.get(them.transformed || them.species) : null;
		// Only what the battle revealed: the calc's Pokemon carries a default ability (Gliscor: Hyper Cutter).
		const known = idOf(them ? them.ability : foe && foe.ability);
		// Unrevealed, a Gliscor is Poison Heal all the same: weigh the abilities it can have.
		const could = known ? [known] : Object.values((sheet && sheet.abilities) || {}).map(idOf);
		// Unrevealed, the ability that absorbs it is the one a real set picks (Poison Heal Gliscor, Guts Conkeldurr).
		const share = list => known ? (list.includes(known) ? 1 : 0) : could.some(a => list.includes(a)) ? 0.85 : 0;
		let value = move.status === 'slp' ? 45 : 32;
		if (move.status === 'tox' || move.status === 'psn') {
			const absorbs = share(['poisonheal', 'guts', 'magicguard', 'toxicboost', 'quickfeet', 'marvelscale', 'immunity', 'pastelveil']);
			if (absorbs >= 1) return -20;
			value *= 1 - 0.7 * absorbs;
		}
		if (move.status === 'brn') {
			const absorbs = share(['guts', 'flareboost', 'magicguard', 'quickfeet', 'marvelscale', 'waterbubble', 'waterveil', 'thermalexchange']);
			if (absorbs >= 1) return -20;
			value *= 1 - 0.7 * absorbs;
			const attacks = [...((them && them.moves) || [])].map(m => dex.moves.get(m)).filter(m => m && m.exists && m.category !== 'Status');
			const physical = attacks.length
				? attacks.filter(m => m.category === 'Physical').length >= attacks.filter(m => m.category === 'Special').length
				: !!(sheet && sheet.baseStats && sheet.baseStats.atk >= sheet.baseStats.spa);
			value = physical ? value + 20 : value * 0.6;
		}
		// Status the wincon: poison and burn are what a setup sweeper cannot boost past (B1).
		if (ctx.foeSetup) value += 12;
		if (known === 'regenerator') value *= 0.6;
		else if (known === 'naturalcure') value *= 0.5;
		return value;
	}

	/**
	 * Hazard removal, for stall (R8). Humans remove 1.2 times a game, at the
	 * first calm turn after about one layer is up (the bot: 0.1). What it is
	 * worth is what the hazards take from our own team on every entry - nothing
	 * from a Heavy-Duty Boots wall, so a team in Boots can live with them (they
	 * were up for 38% of human turns).
	 */
	stallRemoval(gen, move, state, request, myHpPct, incoming) {
		const count = side => HAZARDS.reduce((n, h) => n + (Number((state.hazards[side] || {})[h]) || 0), 0);
		if (!count(state.myPlayer)) return -15;
		let cost = 0;
		for (const p of (request && request.side && request.side.pokemon) || []) {
			if (/fnt/.test(p.condition || '')) continue;
			cost += this.entryHazards(gen, this.myPokemon(gen, p, state), p, state);
			// Toxic Spikes poison a grounded, non-Poison, non-Steel wall without Boots.
		}
		const tspikes = Number((state.hazards[state.myPlayer] || {})['Toxic Spikes']) || 0;
		if (tspikes) cost += 8 * tspikes;
		if (cost < 5) return 2;
		let score = 20 + cost * 1.2;
		if (move.id === 'defog') {
			score -= count(state.theirPlayer) * 8;
			const theirs = state.hazards[state.theirPlayer] || {};
			if (theirs['Reflect'] || theirs['Light Screen'] || theirs['Aurora Veil']) score += 10;
		}
		// A calm turn, not one where the hit coming at us is half of what we have.
		if (incoming >= myHpPct * 0.5) score *= 0.5;
		return Math.min(70, score);
	}

	/**
	 * Stall's switching (R1, R2, R3, R10, R11, R12), before the general rule
	 * gets a say. Returns { switch: i }, { move: n } to insist on a move, or null.
	 *
	 *   - Wish passed: our Wish lands this turn and a teammate needs it more.
	 *   - A boosted foe: bring the answer (Unaware, Haze, a phazer), or heal when
	 *     the heal outruns the hit; don't trade blows with a non-answer (humans
	 *     attacked 34% of such turns, the bot 57-61%).
	 *   - Preserve: at 35% or less, or about to be knocked out, heal if it lands
	 *     in time and outruns the hit, otherwise switch to one that survives
	 *     coming in (humans 87%, the bot 50-58%). The two measured exceptions to
	 *     "never sack": a spent wall (25% or less, no job, no safe switch-in), and
	 *     a boosted foe whose answer could not come in safely - the faint buys it
	 *     a free switch.
	 *   - Pivot: the hit is more than we heal, or we are walled - switch, even
	 *     at full health, to the wall that takes it (humans switch out at a median
	 *     94% HP, the bot at 49-63%), at most three times in six turns so two
	 *     pairs of Pokemon do not swap forever.
	 */
	stallSwitch(gen, active, entry, me, request, state, field, foes, incoming, movesFirst, ranked, index, planned, rules = STYLE_RULES.stall) {
		const foe = foes[0];
		if (!foe) return null;
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const hp = (me.originalCurHP / me.maxHP()) * 100;
		const dying = incoming >= hp;
		const live = state.mine && state.mine['abc'[index]];
		const bench = request.side.pokemon.map((p, i) => ({ p, i: i + 1 })).filter(({ p }) => !p.active && !/fnt/.test(p.condition || ''));
		if (!bench.length) return null;
		// Our KO first settles it: stall takes KOs too.
		if (ranked.some(r => r.damage >= 100 && r.score > 0 && (r.accuracy === undefined || r.accuracy >= 0.85) && (movesFirst || r.priority > 0 || !dying))) return null;
		const heal = ranked.filter(r => r.heal > 0 && r.score > -20).sort((a, b) => b.heal - a.heal)[0];
		const H = heal ? Math.min(heal.heal, 100 - hp) : 0;
		const boosts = foe.boosts || {};
		const boosted = ['atk', 'spa', 'spe'].reduce((n, s) => n + Math.max(0, boosts[s] || 0), 0);
		const noPhaze = /^(suctioncups|guarddog)$/.test(idOf(foe.ability));
		const answers = (ability, moves) => ability === 'unaware' ||
			moves.some(m => /^(haze|clearsmog)$/.test(m) || (!noPhaze && /^(roar|whirlwind|dragontail|circlethrow)$/.test(m)));
		/*
		 * What the foe will most likely click: its best shown attack on the Pokemon in
		 * front of it. The worst of everything its sets might carry made every switch-in
		 * look unsafe - Blissey at 13%, paralysed, stayed in front of a Specs Raging
		 * Bolt's Thunderbolt with Clodsire on the bench, because Clodsire "took" Draco
		 * Meteor (round 2). The worst case still counts, at 60%.
		 */
		const dex = PkmnDex.forGen(gen.num);
		const them = this.foePokemon(gen, foe);
		let likely = null, likelyHit = -1;
		for (const m of foe.moves || []) {
			const d = dex.moves.get(m);
			if (!d || !d.exists || d.category === 'Status') continue;
			const dmg = this.damagePct(gen, them, me, m, field);
			if (dmg > likelyHit) { likelyHit = dmg; likely = m; }
		}
		// Choice-locked, the move is not a guess: it is the one it used last.
		const locked = /^choice/.test(idOf(foe.item)) && foe.lastMove && !foe.movedFreely ? foe.lastMove : null;
		if (locked) likely = locked;
		const cands = bench.map(({ p, i }) => {
			const cond = /^(\d+)\/(\d+)/.exec(p.condition || '');
			const bhp = cond ? +cond[1] / +cond[2] * 100 : 100;
			const mon = this.switchInAs(gen, p, state, foes);
			// damagePct is a share of the HP it has now; everything here is a share of its maximum.
			const worst = this.worstIncoming(gen, p, state, field);
			const onLikely = likely ? this.damagePct(gen, them, mon, likely, field) : worst;
			const hit = (locked ? onLikely : Math.max(onLikely, 0.6 * worst)) * bhp / 100;
			const takes = hit + this.entryHazards(gen, mon, p, state);
			return { p, i, bhp, takes, after: bhp - takes, answer: answers(idOf(p.ability || p.baseAbility), (p.moves || []).map(idOf)) };
		});
		const safe = c => c.after >= 25 && c.takes <= Math.max(30, c.bhp * 0.45);
		const byBench = list => {
			let top = null;
			for (const c of list) {
				const s = this.benchScore(gen, c.p, state, field, request, true);
				if (!top || s > top.s) top = { c, s };
			}
			return top && top.c;
		};

		// Wish passed (R10): ours lands at the end of this turn.
		if (rules.wish && live && live.lastMove === 'Wish' && live.lastMoveTurn === state.turn - 1 && !dying && hp >= 70) {
			const needy = cands.filter(c => c.bhp <= 65 && c.after >= 15 && c.takes < c.bhp * 0.6).sort((a, b) => a.bhp - b.bhp)[0];
			if (needy) return { switch: needy.i, why: 'wish pass' };
		}

		// A boosted foe (R11).
		let sackOk = false;
		if (rules.boosted && boosted >= 1) {
			const mine = (active.moves || []).filter(m => !m.disabled && (m.pp === undefined || m.pp > 0)).map(m => idOf(m.move || m.id));
			if (!answers(idOf(entry.ability || entry.baseAbility), mine)) {
				const ans = cands.filter(c => c.answer && c.after > 0).sort((a, b) => b.after - a.after)[0];
				if (ans && ans.takes < ans.bhp * 0.6) return { switch: ans.i, why: 'answer to a boosted foe' };
				if (heal && H > incoming && !dying) return { move: heal.n, why: 'heal vs boosted' };
				// The answer is there but cannot come in on this: the faint brings it in free.
				// Humans' sacks into a boosted foe were of worn Pokemon (sacks at a median 28%), not healthy ones.
				if (ans && hp <= 50) sackOk = true;
			} else if (heal && hp <= 65 && H > incoming && (!dying || movesFirst)) return { move: heal.n, why: 'answer heals' };
		}

		// Preserve (R2, R3).
		const low = hp <= 35 && (incoming >= 10 || boosted >= 1);
		const threatened = dying || (hp <= 69 && incoming >= hp * 0.75);
		if (rules.preserve && (low || threatened)) {
			if (heal && H > incoming && (movesFirst || !dying)) return { move: heal.n, why: 'preserve by healing' };
			const row = this.cfg.sacking ? this.teamPlan(gen, state, request).rows.get(this.entryKey(entry)) : null;
			const spent = hp <= 25 && !(row && row.sole) && !cands.some(safe);
			if (spent || sackOk) return null;
			const survive = cands.filter(c => c.after > 0);
			const safes = survive.filter(safe);
			/*
			 * With no safe switch-in, a switch only spreads the damage: round 2 had five
			 * walls in six turns each come in on a Hatterene's Psychic Noise and leave at
			 * 30-50%. Take the unsafe one only when it clearly ends better than staying,
			 * and not straight after coming in.
			 */
			const inNow = state.turn - (state.mineCameIn || 0) <= 1;
			const fallback = survive.sort((a, b) => b.after - a.after)[0];
			const pick = safes.length ? byBench(safes)
				: fallback && !inNow && fallback.after >= 15 && fallback.after > hp - incoming + 10 ? fallback : null;
			return pick ? { switch: pick.i, why: 'preserve' } : null;
		}
		if (planned || dying || !rules.pivot) return null;

		// Pivot (R1, R12).
		const inFor = state.turn - (state.mineCameIn || 0);
		const top = ranked.filter(r => r.damage > 0).sort((a, b) => b.damage - a.damage)[0];
		const bestScore = Math.max(...ranked.map(r => r.score));
		// Judged on what the heal restores at all: Roost at full health scores -30 but heals 50 later.
		const capacity = Math.max(0, ...ranked.map(r => r.heal || 0));
		const loses = incoming >= 45 || (incoming >= 25 && incoming >= capacity * 0.9);
		const walled = inFor >= 2 && (!top || top.damage < 12) && bestScore < 20 && incoming < hp * 0.5;
		this._stallPivots = (this._stallPivots || []).filter(t => t >= state.turn - 6 && t <= state.turn);
		if (!(loses || walled) || this._stallPivots.length >= 3) return null;
		if (loses && bestScore >= 55 && incoming < hp * 0.5) return null;
		let good = loses ? cands.filter(c => c.takes <= Math.min(incoming * 0.6, 30) && c.after >= 40) : [];
		if (!good.length && walled) {
			/*
			 * Walled: the one that makes progress on this foe - real damage, or a status
			 * it can take. Corviknight Roosted at full health six turns running into a
			 * Gholdengo it could not touch while Blissey, taking a third, sat on the bench.
			 */
			const them = foe;
			good = cands.filter(c => {
				if (c.after < 40 || c.takes >= 40) return false;
				const mon = this.switchInAs(gen, c.p, state, foes);
				const moves = (c.p.moves || []).map(m => toName(m, 'moves'));
				if (Math.max(0, ...moves.map(m => this.damageToFoe(gen, mon, them, m, field))) >= 25) return true;
				return !them.status && moves.some(m => /^(Toxic|Will-O-Wisp|Thunder Wave)$/.test(m));
			});
		}
		const pick = byBench(good);
		if (!pick) return null;
		this._stallPivots.push(state.turn);
		return { switch: pick.i, why: loses && !walled ? 'pivot' : 'walled' };
	}

	/** Per cent of maximum HP a healing move restores now (Wish: next turn). */
	healShare(move, state) {
		const weather = String((state && state.weather) || '').toLowerCase().replace(/[^a-z]/g, '');
		if (move.id === 'rest') return 100;
		if (/^(synthesis|moonlight|morningsun)$/.test(move.id)) return /sunnyday|desolateland/.test(weather) ? 66.7 : weather ? 25 : 50;
		if (move.id === 'shoreup') return /sandstorm/.test(weather) ? 66.7 : 50;
		if (move.id === 'strengthsap') return 40;
		return 50;
	}

	/**
	 * What healing is worth this turn, or null to leave it to the "last turn" rule.
	 *
	 * The review found 0 of 108 chances to heal at half health or less taken:
	 * the last-turn return came first and scored every heal -20, and the heal
	 * itself was capped at 60 minus our HP (recovery, 24 Sep 2026). So:
	 *   - in front of a KO, healing first is worth it when we move first and the
	 *     heal outruns their hit - otherwise it only delays, and the old rule stands;
	 *   - otherwise a heal is worth what it restores, more below half health, and
	 *     half that when their hit outruns it;
	 *   - Wish from 70% down, never while one is on its way (Pinkacross A20: use it
	 *     before the critical-HP turn).
	 */
	recoveryScore(move, me, state, myHpPct, incoming, dying, ctx) {
		if (ctx.rules && (move.id === 'wish' ? ctx.rules.wish : ctx.rules.heal)) return this.stallRecovery(move, me, state, myHpPct, incoming, dying, ctx);
		const live = ctx.live;
		if (move.id === 'wish') {
			if (live && live.lastMove === 'Wish' && live.lastMoveTurn >= state.turn - 1) return -20;
			if (dying) return null;
			return myHpPct <= 70 ? 20 + (75 - myHpPct) * 0.8 : 4;
		}
		if (move.id === 'rest' && me.status === 'slp') return -30;
		const heal = Math.min(this.healShare(move, state), 100 - myHpPct);
		// At full health it fails outright (Quagsire, Recover six turns running at 100%).
		if (myHpPct >= 99.5) return -30;
		if (heal <= 6) return -15;
		const sleeps = move.id === 'rest' ? 0.7 : 1;
		if (dying) {
			if (ctx.movesFirst && heal > incoming && myHpPct + heal > incoming) return (30 + (heal - incoming)) * sleeps;
			return null;
		}
		if (myHpPct > 75) return -10;
		let score = heal * (myHpPct <= 50 ? 1 : 0.6) * sleeps;
		if (incoming >= heal) score *= 0.5;
		return score;
	}

	/**
	 * Stealth Rock and Spikes are worth what they will hit (hazardPlan, 24 Sep 2026).
	 *
	 * A flat 38 had them set in 30 of 176 side-games whose teams carried them,
	 * and Spikes never went past one layer. Pinkacross (A12): set hazards early -
	 * they pay on every switch that follows. So the score counts what this layer
	 * takes from each foe still standing that will come in again - the one in
	 * front at a discount, Heavy-Duty Boots and Magic Guard not at all, Flying
	 * types and Levitate not for Spikes - and fades after the opening turns.
	 */
	hazardScore(gen, move, state) {
		const theirSide = state.hazards[state.theirPlayer] || {};
		const layers = Number(theirSide[move.name]) || 0;
		if (layers >= (HAZARD_LAYERS[move.name] || 1)) return -30;
		const dex = PkmnDex.forGen(gen.num);
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const { list, unknown } = this.foeRemaining(state);
		const each = (types, ability, item) => {
			if (item === 'heavydutyboots' || ability === 'magicguard') return 0;
			const grounded = !types.includes('Flying') && ability !== 'levitate' && item !== 'airballoon';
			if (move.name === 'Stealth Rock') {
				let mult = 1;
				for (const t of types) {
					const taken = ((dex.types.get(t) || {}).damageTaken || {}).Rock;
					mult *= taken === 1 ? 2 : taken === 2 ? 0.5 : taken === 3 ? 0 : 1;
				}
				return 12.5 * mult;
			}
			if (!grounded) return 0;
			if (move.name === 'Spikes') return [12.5, 4.17, 8.33][layers] || 0;
			if (move.name === 'Toxic Spikes') return types.includes('Poison') || types.includes('Steel') ? 0 : layers ? 5 : 10;
			return 8;   // Sticky Web
		};
		let value = 0;
		for (const foe of list) {
			if (foe.fainted || foe.hp <= 0) continue;
			const sheet = dex.species.get(foe.transformed || foe.species);
			const v = each((sheet && sheet.exists && sheet.types) || [], idOf(foe.ability), idOf(foe.item));
			value += foe.bench ? v : v * 0.7;
		}
		value += unknown * each([], '', '');
		const early = Math.max(0.5, 1 - Math.max(0, (state.turn || 1) - 8) / 30);
		// A remover they have shown takes it off again.
		const removal = list.some(f => [...(f.moves || [])].some(m => /^(defog|rapidspin|mortalspin|tidyup|courtchange)$/.test(idOf(m))));
		// Capped: five Rock-weak foes make it very good, not better than a KO.
		return Math.round(Math.min(65, 8 + value * 0.65 * early) * (removal ? 0.7 : 1));
	}

	/** Score a status move by what it is actually worth this turn. */
	statusScore(gen, moveName, me, foe, state, incoming, ctx = {}) {
		const move = PkmnDex.forGen(gen.num).moves.get(moveName);
		if (!move) return 0;
		const myHpPct = (me.originalCurHP / me.maxHP()) * 100;
		const dying = incoming >= myHpPct;
		const boostsUp = move.boosts || (move.self && move.self.boosts);
		const isSetup = boostsUp && Object.values(boostsUp).some(v => v > 0);
		const pressure = ctx.foes ? this.switchPressure(gen, me, ctx.foes, ctx.field) : 0;
		/*
		 * Sleep Talk works only asleep, and then it is the move: Dondozo clicked it
		 * awake thirteen turns running in the sampled games, where the endgame tree
		 * read it as a harmless pass. (24 Sep 2026)
		 */
		if (move.id === 'sleeptalk' && !this.cfg.naive && this.cfg.sanity !== false) return me.status === 'slp' ? 35 : -30;

		/*
		 * "They will switch" is no reason to set up at 30% or less in front of a KO:
		 * Mega Blaziken used Swords Dance at 14% and died to the hit it ignored, and
		 * 37% of setup users in the review fainted that turn or the next (setupCap).
		 */
		const hopeful = isSetup && pressure >= 0.7 && !(this.cfg.setupCap && myHpPct <= 30);
		const live = ctx.live;
		// Wish on its way: Protect is how it lands (recovery, A20).
		// Not for a healthy stall wall in front of a setup foe: Alomomola at 100% Wished and Protected while Ogerpon
		// used Swords Dance twice, then swept five (stall study round 2).
		if ((this.cfg.recovery || (ctx.rules && ctx.rules.wish)) && PROTECTS.has(move.id) && move.id !== 'endure' && live && live.lastMove === 'Wish' && live.lastMoveTurn === state.turn - 1 &&
			!(ctx.rules && ctx.rules.freeTurns && ctx.foeSetup && myHpPct >= 70)) return 45;
		// Healing is judged before "this is the last turn": healing first can make it not the last.
		if ((this.cfg.recovery || (ctx.rules && (ctx.rules.heal || ctx.rules.wish))) && (RECOVERY.includes(move.name) || move.id === 'wish')) {
			const heal = this.recoveryScore(move, me, state, myHpPct, incoming, dying, ctx);
			if (heal !== null) return heal;
		}
		// Stall's Protect has a purpose or is a lost turn (R9); judged before "the last turn" - it can buy one.
		if (ctx.rules && ctx.rules.protect && PROTECTS.has(move.id)) return this.stallProtect(gen, move, me, state, myHpPct, ctx);

		// Nothing that takes a turn is worth it when the turn is the last one -
		// unless the opponent is not going to be there to take it.
		if (dying && !hopeful) {
			if (move.priority > 0) return 5;
			/*
			 * On the last turn, what matters is what outlives us. A boost or a heal is
			 * thrown away, but poison, a layer of hazards or a Parting Shot is still
			 * working after we are gone - Clodsire spent its last turn on Amnesia
			 * because every status move scored the same (replay gen9rpou-5-tliyi7).
			 */
			const theirSide = state.hazards[state.theirPlayer] || {};
			if (HAZARDS.includes(move.name) && (!theirSide[move.name] || (this.cfg.hazardPlan && (Number(theirSide[move.name]) || 0) < (HAZARD_LAYERS[move.name] || 1)))) return 8;
			if (/^(partingshot|healingwish|lunardance|memento|uturn|voltswitch|flipturn|teleport)$/.test(move.id)) return 7;
			if (move.status && move.target !== 'self' && foe && !foe.status) return 6;
			return -20;
		}

		// Tectonic Shell (Torterra): a heal and Stealth Rock in one. Worth it when
		// hurt, or while their side has no rocks yet.
		if (move.id === 'tectonicshell') {
			const rocksUp = !!(state.hazards[state.theirPlayer] || {})['Stealth Rock'];
			const heal = myHpPct < 55 ? 60 - myHpPct : -10;
			return Math.max(heal, rocksUp ? -10 : 38) + (!rocksUp && myHpPct < 55 ? 10 : 0);
		}
		// Royal Decree (Empoleon): Roar and a layer of Spikes. Best into a boosted
		// foe; otherwise it is Spikes, while there is room for another layer.
		if (move.id === 'royaldecree') {
			const layers = Number((state.hazards[state.theirPlayer] || {}).Spikes) || 0;
			const boosts = (foe && foe.boosts) ? Object.values(foe.boosts).reduce((n, v) => n + Math.max(0, v), 0) : 0;
			if (boosts >= 2) return 55 + boosts * 8;
			return layers < 3 ? 34 - layers * 6 : 4;
		}
		if (RECOVERY.includes(move.name)) return myHpPct < 55 ? 60 - myHpPct : -10;

		// Into a Magic Bounce (or Espeon's Prescience) a status move or hazard comes
		// straight back. Espeon counts even unrevealed: two of its abilities bounce.
		const foeAbility = String((foe && foe.ability) || '').toLowerCase().replace(/[^a-z]/g, '');
		const foeSpecies = String((foe && foe.name) || '').toLowerCase().replace(/[^a-z]/g, '');
		if (move.flags && move.flags.reflectable && (BOUNCES.has(foeAbility) || foeSpecies === 'espeon')) return -30;
		// Gleamstalk (Luxray): paralysis, +2 Speed and a Charge. Best early; spent
		// once Luxray is already fast and charged.
		if (move.id === 'gleamstalk') {
			const fast = ((me && me.boosts && me.boosts.spe) || 0) >= 2;
			if (fast && me.velvetCharged) return -10;
			const foeTypes = (foe && foe.types) || [];
			const canPar = !foe.status && !foeTypes.includes('Electric') && !STATUS_PROOF.has(foeAbility);
			if (foeTypes.includes('Dark') && String((me && me.ability) || '') === 'Prankster') return -20;
			if (['voltabsorb', 'lightningrod', 'motordrive', 'mudflatambush', 'staticneedles'].includes(foeAbility)) return -20;
			return (canPar ? 40 : 26) - (fast ? 14 : 0);
		}
		/*
		 * Moves that fail, which the Stockfish reviews caught the bot clicking again
		 * and again: a screen that is already up, a second Protect in a row (Max
		 * Guard twice while Dynamaxed), Thunder Wave into a Ground type, a powder
		 * into a Grass type, any status into a Pokemon that already has one.
		 */
		if (this.cfg.sanity !== false && !this.cfg.naive) {
			const ours = state.hazards[state.myPlayer] || {};
			if (SCREENS[move.id]) {
				if (ours[SCREENS[move.id]]) return -30;
				if (move.id === 'auroraveil' && !/snow|hail/i.test(String(state.weather || ''))) return -30;
			}
			const live = ctx.live;
			if (PROTECTS.has(move.id) && live && live.lastMoveTurn === state.turn - 1 &&
				PROTECTS.has(String(live.lastMove || '').toLowerCase().replace(/[^a-z0-9]/g, ''))) return -30;
			if (move.status && move.target !== 'self' && foe) {
				const types = foe.types || [];
				if (foe.status) return -25;
				if (move.type === 'Electric' && move.id === 'thunderwave' && types.includes('Ground')) return -25;
				if (move.flags && move.flags.powder && (types.includes('Grass') || foeAbility === 'overcoat')) return -25;
			}
			if (move.id === 'yawn' && foe && foe.status) return -25;
			/*
			 * From the review of 93 Stockfish games (24 Sep 2026): Good as Gold turns
			 * away every status move aimed at it, not only the ones that inflict a
			 * status - Blissey used Thunder Wave into Gholdengo three times. Anything
			 * the battle has already bounced off this foe (an -immune line, which names
			 * the ability when there is one) stays bounced, and a known ability that
			 * blocks this one status (Limber, Water Veil, Insomnia...) does too.
			 */
			const aimed = move.category === 'Status' && !['self', 'allySide', 'foeSide', 'all', 'allies', 'adjacentAllyOrSelf', 'ally'].includes(move.target);
			if (aimed && foeAbility === 'goodasgold') return -30;
			const theirState = (ctx.foes || [])[0];
			if (aimed && theirState && theirState.immuneTo && theirState.immuneTo.has(move.name)) return -30;
			if (move.status && (STATUS_BLOCKS[foeAbility] || []).includes(move.status)) return -25;
			// No Retreat works once a stay (it came back three times in a row).
			if (move.id === 'noretreat' && live && live.noRetreat) return -30;
			/*
			 * Encore and Disable act on the last move the foe used, so into one that has
			 * not moved since it came in they fail. Into a status or setup move they are
			 * the best thing on the board: it is stuck clicking it.
			 */
			if (/^(encore|disable)$/.test(move.id) && theirState) {
				if (!theirState.lastMove) return -20;
				// Already encored, or its last move is one Encore cannot hold it to: it fails (the sampled games).
				if (move.id === 'encore' && (theirState.encored || theirState.dynamaxed ||
					/^(encore|transform|mimic|struggle|sketch|sleeptalk|assist|copycat|mirrormove|mefirst|metronome|dynamaxcannon|behemothblade|behemothbash)$/.test(String(theirState.lastMove).toLowerCase().replace(/[^a-z0-9]/g, '')))) return -30;
				const last = PkmnDex.forGen(gen.num).moves.get(theirState.lastMove);
				if (move.id === 'encore' && last && last.category === 'Status') return 40;
			}
		}
		if (move.status && move.target !== 'self') {
			if (STATUS_PROOF.has(foeAbility)) return -25;
			const types = (foe && foe.types) || [];
			const myAbility = String((me && me.ability) || '').toLowerCase().replace(/[^a-z]/g, '');
			const poison = move.status === 'psn' || move.status === 'tox';
			if (poison && !CORRODES.has(myAbility) && (types.includes('Steel') || types.includes('Poison'))) return -25;
			if (move.status === 'brn' && types.includes('Fire')) return -25;
			if (move.status === 'par' && types.includes('Electric')) return -25;
		}
		if (HAZARDS.includes(move.name)) {
			// Stall sets them on a free turn (humans' first Stealth Rock: turn 8, the bot's: turn 2-3; R7).
			if (this.cfg.hazardPlan && ctx.rules && ctx.rules.hazardTiming && incoming >= myHpPct * 0.4) return Math.round(this.hazardScore(gen, move, state) * 0.6);
			if (this.cfg.hazardPlan) return this.hazardScore(gen, move, state);
			const theirSide = state.hazards[state.theirPlayer] || {};
			return theirSide[move.name] ? -30 : 38;
		}
		if (PIVOT.includes(move.name)) return 20;

		if (isSetup) {
			/*
			 * Two Pokemon make setting up pointless, and the bot used to do it
			 * anyway - happily clicking Swords Dance at a Clefable, six times.
			 *
			 * **Unaware** does not see the boosts. Every point of Attack bought
			 * with a turn is a point it calculates as though it were never there,
			 * so against one of these a setup move is strictly worse than any
			 * attack: same damage, one fewer turn. Only the offensive half is
			 * dead - Bulk Up against an Unaware *attacker* still makes us tougher
			 * - so the boosts are checked rather than the move.
			 *
			 * **Haze**, and Clear Smog, delete the boosts outright. The turn spent
			 * setting up and the turn spent hazing cancel, and we are down a turn
			 * and they are not. This one is only counted when they have actually
			 * shown the move: assuming every Pokemon might have Haze would stop
			 * the bot setting up at all.
			 */
			const deadSetup = this.setupIsWasted(gen, foe, boostsUp, { ...ctx, me });
			if (deadSetup) return -35;

			const sweep = ctx.foes ? this.sweepPotential(gen, ctx.entry, state, ctx.foes, ctx.field, boostsUp) : 0;
			const danger = incoming / Math.max(1, myHpPct);      // 1 = exactly lethal
			// A free turn bought by threatening them is the whole point.
			// At 30% or less, their pressure to leave no longer buys safety (setupCap).
			const safety = this.cfg.setupCap && myHpPct <= 30 ? 1 - danger : Math.max(1 - danger, pressure);
			if (safety < 0.25) return -40;
			let score = 18 + safety * 34 + sweep * 45;
			if (myHpPct < 45 && pressure < 0.6) score -= 25;
			if (this.cfg.setupRisk !== false) {
				// Good players set up from high HP (below 70% it happened a third as often in
				// the replays), and stop once the boost already wins: a third Swords Dance is a
				// free turn for them.
				if (myHpPct >= 45 && myHpPct < 70 && pressure < 0.6) score -= 10;
				const raised = Object.entries(boostsUp).filter(([, v]) => v > 0).map(([stat]) => (me.boosts && me.boosts[stat]) || 0);
				const stacked = raised.length ? Math.min(...raised) : 0;
				if (stacked >= 4) score -= 30;
				else if (stacked >= 2) score -= 10;
				/*
				 * From -2 or worse, a boost only climbs back towards zero, and switching
				 * out gets all of it back for free. Swords Dance at -4 Attack beat an
				 * 85% Fire Blast once accuracy started counting (24 Sep 2026); it
				 * should not have been close before either.
				 */
				else if (stacked <= -2) score -= 20;
				// A foe that has shown Will-O-Wisp answers an Attack boost with a burn.
				const wisp = (ctx.foes || []).some(o => o.moves && [...o.moves].some(m => /will-o-wisp/i.test(m)));
				if (wisp && (boostsUp.atk || 0) > 0 && !me.status && !(me.types || []).includes('Fire')) score -= 15;
			}
			/*
			 * Don't set up when already winning (Pinkacross, A11; 24 Sep 2026). Two
			 * checks against the same Pokemon unboosted: does it already beat all
			 * that is left - then attack, the boost only buys them a turn - and does
			 * the boost change the sweep at all? A purely offensive boost that moves
			 * sweepPotential by less than a tenth is a turn thrown away.
			 */
			if (this.cfg.setupWin && ctx.entry && ctx.foes) {
				if (this.winsUnboosted(gen, ctx.entry, state, ctx.field, incoming)) return Math.min(score, 8);
				const defensive = (boostsUp.def || 0) > 0 || (boostsUp.spd || 0) > 0;
				if (!defensive) {
					const now = this.sweepPotential(gen, ctx.entry, state, ctx.foes, ctx.field, {});
					if (sweep - now < 0.1) score -= 20;
				}
			}
			return score;
		}
		if (move.status) {
			if (foe.status) return -25;
			if (ctx.rules && ctx.rules.status && move.target !== 'self') return this.stallStatus(gen, move, foe, ctx);
			if (move.status === 'slp') return 45;
			if (move.status === 'par' || move.status === 'brn' || move.status === 'tox') return 32;
		}
		/*
		 * Haze against a Pokemon that has spent turns setting up is one of the
		 * best moves in the game, and against one that has not it is a wasted
		 * turn. The bot scored it the same either way - a flat 22 with Taunt and
		 * Defog - so it hazed at full-health attackers and declined to haze the
		 * Dragon Dance sweeper that was about to end the game.
		 */
		if (/^(haze|clearsmog)$/.test(move.id)) {
			let theirBoosts = 0;
			for (const other of (ctx.foes || [])) {
				const boosts = other.boosts || {};
				theirBoosts = Math.max(theirBoosts, Object.values(boosts).reduce((n, v) => n + Math.max(0, v), 0));
			}
			// Stall hazes at +1 too: the boost is the threat, and stall has the turns (R11, D1).
			if (ctx.rules && ctx.rules.boosted && theirBoosts === 1) return 45;
			return theirBoosts >= 2 ? 55 + theirBoosts * 8 : theirBoosts ? 24 : -8;
		}
		/*
		 * Hazard removal is worth what is on our side of the field, and nothing when
		 * nothing is. It scored a flat 22 like Taunt, so the bot cleared hazards that
		 * were not there. Defog also clears theirs (a loss when we set them) and their
		 * screens (a gain). The tracked side conditions include screens and Tailwind,
		 * so only real hazards are counted.
		 */
		if (/^(defog|rapidspin|mortalspin|tidyup)$/.test(move.id)) {
			if (ctx.rules && ctx.rules.removal && ctx.request) return this.stallRemoval(gen, move, state, ctx.request, myHpPct, incoming);
			const count = side => HAZARDS.reduce((n, h) => n + (Number((state.hazards[side] || {})[h]) || 0), 0);
			const ours = count(state.myPlayer);
			if (!ours) return -15;
			let score = 20 + ours * 10;
			if (move.id === 'defog') {
				score -= count(state.theirPlayer) * 8;
				const theirs = state.hazards[state.theirPlayer] || {};
				if (theirs['Reflect'] || theirs['Light Screen'] || theirs['Aurora Veil']) score += 10;
			}
			return score;
		}
		/*
		 * Phazing is Haze plus the hazards, and it was scoring 6 - one point above
		 * a filler move - because it fell through every branch to the bottom.
		 *
		 * A Magearna at +2 Speed, +3 Special Attack and a Weakness Policy already
		 * spent swept four Pokemon one at a time while the bot held a Whirlwind
		 * (replay gen9rpou-3-tlj07m, turns 10 to 14). Blowing it out costs it every
		 * boost and every turn it spent getting them, and drags something else
		 * through our Spikes on the way in.
		 */
		if (/^(roar|whirlwind)$/.test(move.id)) {
			const blocked = (ctx.foes || []).some(f =>
				/^(suctioncups|guarddog)$/.test(String(f.ability || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
			if (blocked) return -12;
			// With nothing of theirs left to drag in it fails (Gogoat, Roar at 1% nine turns running).
			if (this.cfg.sanity !== false) {
				const { list, unknown } = this.foeRemaining(state);
				if (!unknown && !list.some(f => f.bench && !f.fainted)) return -30;
			}
			let theirBoosts = 0;
			for (const other of (ctx.foes || [])) {
				const boosts = other.boosts || {};
				theirBoosts = Math.max(theirBoosts, Object.values(boosts).reduce((n, v) => n + Math.max(0, v), 0));
			}
			const theirHazards = HAZARDS.reduce((n, h) => n + (Number((state.hazards[state.theirPlayer] || {})[h]) || 0), 0);
			if (theirBoosts >= 2) return 52 + theirBoosts * 8 + theirHazards * 6;
			if (ctx.rules && ctx.rules.boosted && theirBoosts === 1) return 42 + theirHazards * 4;
			return theirBoosts ? 22 + theirHazards * 4 : theirHazards ? 12 : -6;
		}
		if (/taunt|encore|disable|trick|knockoff/i.test(move.id)) return 22;
		if (move.id === 'protect' || move.id === 'detect') return 8;
		return 6;
	}

	/**
	 * @param {object} request the parsed |request| payload
	 * @param {BattleState} state
	 * @returns {string} the choice string, e.g. "move 1" or "switch 3"
	 */
	decide(request, state) {
		if (request.wait) return null;
		// One decision's cache (see memo()); closed again whatever happens.
		this._memo = new Map();
		try {
			if (request.teamPreview) return this.teamOrder(request, state);
			if (request.forceSwitch) return this.forceSwitch(request, state);
			if (request.active) return this.turnChoice(request, state);
			return 'default';
		} finally {
			this._memo = null;
		}
	}

	teamOrder(request, state) {
		const gen = this.gen(state.gen);
		const mons = request.side.pokemon.map((p, i) => {
			const mon = this.myPokemon(gen, p, state);
			return { i: i + 1, p, mon, spe: mon.stats ? mon.stats.spe : 0, lead: 0 };
		});
		/*
		 * With their six on show, lead with what does best into them on average:
		 * what it deals minus what it takes, plus a hazard setter's worth - the lead
		 * is where Stealth Rock goes up. Without a preview, the fastest leads.
		 */
		const theirs = state.preview && state.preview[state.theirPlayer];
		if (!this.cfg.naive && this.cfg.preview !== false && theirs && theirs.length && request.side.pokemon.length > 1) {
			const field = new calc.Field({});
			const dex = PkmnDex.forGen(gen.num);
			if (this.cfg.leads) return this.pinkacrossLead(gen, mons, theirs, field);
			for (const m of mons) {
				let total = 0;
				for (const t of theirs) {
					const foe = { species: t.species, level: t.level, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(), immuneTo: new Set(), notImmuneTo: new Set() };
					const them = this.foePokemon(gen, foe);
					const out = Math.max(0, ...(m.p.moves || []).map(id => this.damageToFoe(gen, m.mon, foe, toName(id, 'moves'), field)));
					const back = this.roughIncoming(gen, them, m.mon, field);
					total += Math.min(100, out) - Math.min(100, back);
				}
				m.lead = total / theirs.length;
				const moves = (m.p.moves || []).map(id => dex.moves.get(toName(id, 'moves'))).filter(Boolean);
				if (moves.some(mv => /^(stealthrock|spikes|stickyweb|tectonicshell)$/.test(mv.id))) m.lead += 20;
			}
			const lead = mons.slice().sort((a, b) => b.lead - a.lead || b.spe - a.spe)[0];
			const rest = mons.filter(m => m !== lead).sort((a, b) => b.spe - a.spe);
			return `team ${[lead, ...rest].map(m => m.i).join('')}`;
		}
		mons.sort((a, b) => b.spe - a.spe);
		return `team ${mons.map(m => m.i).join('')}`;
	}

	/**
	 * Choosing a lead the way Pinkacross teaches it (How to Choose Your Lead;
	 * research A2-A4, 24 Sep 2026).
	 *
	 *  - A good lead has a lead trait: a move with lasting value (hazards, Knock
	 *    Off, status), a pivot, or immediate breaking power. A setup sweeper is a
	 *    bad lead - it wants a free turn later, not a guess on turn one.
	 *  - Their lead is a guess: drop their sweepers, favour their own lead traits
	 *    and whatever is good into our six. Most games leave two to four likely
	 *    leads, so our lead is scored against those, not a flat average of six.
	 *  - Weigh the wrong guess: a lead that loses to a likely lead of theirs,
	 *    with nothing behind it that comes in comfortably, is worse than one that
	 *    covers fewer leads but never leaves us stuck.
	 *  - Don't lead with the only answer to one of their threats; it has to be
	 *    healthy when that threat comes.
	 *
	 * Order after the lead is unchanged (fastest first) - it is only the order
	 * the forced switches consider, and they re-score by the position anyway.
	 */
	pinkacrossLead(gen, mons, theirs, field) {
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const RS = require('./role-sets');
		const foes = theirs.map(t => ({ species: t.species, level: t.level, hp: 100, maxhp: 100, status: '', boosts: {},
			moves: new Set(), immuneTo: new Set(), notImmuneTo: new Set() }));
		// Both directions, once: what each of ours deals to each of theirs, what it takes back.
		const out = [], back = [], faster = [];
		mons.forEach((m, i) => {
			out[i] = []; back[i] = []; faster[i] = [];
			const mySpe = this.speedOf(m.mon, {}, undefined, null);
			foes.forEach((foe, j) => {
				const them = this.foePokemon(gen, foe);
				out[i][j] = Math.min(100, Math.max(0, ...(m.p.moves || []).map(id => this.damageToFoe(gen, m.mon, foe, toName(id, 'moves'), field))));
				back[i][j] = Math.min(100, this.roughIncoming(gen, them, m.mon, field));
				faster[i][j] = mySpe > this.foeSpeed(gen, foe, null);
			});
		});
		// How likely each of theirs is to lead: its lead traits, not a sweeper, and good into us.
		const weight = foes.map((foe, j) => {
			const kit = this.speciesKit(foe.species);
			let w = 1 + 0.8 * kit.hazards + 0.4 * kit.pivot + 0.3 * kit.knock + 0.2 * kit.status;
			if (kit.sweeperOnly) w *= 0.3;
			const intoUs = mons.reduce((sum, m, i) => sum + back[i][j] - out[i][j], 0) / mons.length;
			return w * (1 + Math.max(-0.5, Math.min(0.5, intoUs / 100)));
		});
		const total = weight.reduce((a, b) => a + b, 0) || 1;
		const share = weight.map(w => w / total);

		// Who answers what: outspeeds and KOs, or takes under 45% and deals 30% back.
		const answers = foes.map((_, j) => mons.map((_, i) => i).filter(i => (faster[i][j] && out[i][j] >= 100) || (back[i][j] < 45 && out[i][j] >= 30)));
		const threat = foes.map((_, j) => mons.filter((_, i) => back[i][j] >= 50).length >= mons.length / 2);

		mons.forEach((m, i) => {
			let score = 0;
			foes.forEach((_, j) => { score += share[j] * (out[i][j] - back[i][j]); });
			const moves = (m.p.moves || []).map(idOf);
			const hazards = moves.some(x => RS.HAZARDS.includes(x));
			const pivot = moves.some(x => RS.PIVOTS.includes(x));
			const lasting = moves.includes('knockoff') || moves.some(x => RS.STATUS.includes(x));
			const item = idOf(m.p.item);
			const breaker = /^(choiceband|choicespecs|lifeorb)$/.test(item) || out[i].reduce((a, b) => a + b, 0) / Math.max(1, foes.length) >= 70;
			const setup = moves.some(x => RS.SETUP.includes(x));
			if (hazards) score += 20;
			if (pivot) score += 12;
			if (lasting) score += 10;
			// Immediate power means power without a boost first: a setup sweeper is
			// not a breaker, it is a bad lead (his words), and a large penalty is
			// what it takes to outvote a good average matchup.
			if (breaker && !setup) score += 8;
			if (setup && !hazards && !pivot) score -= 40;
			// The wrong guess: a likely lead of theirs we lose to, with no comfortable switch-in behind.
			foes.forEach((_, j) => {
				if (share[j] < 0.1 || out[i][j] - back[i][j] > -30) return;
				const cover = mons.some((_, k) => k !== i && back[k][j] < 35);
				if (!cover) score -= 60 * share[j];
			});
			// The only answer to one of their threats stays in the back.
			if (foes.some((_, j) => threat[j] && answers[j].length === 1 && answers[j][0] === i)) score -= 15;
			m.lead = score;
		});
		// Kept for the logs and the tests: who we think leads, and what each lead scored.
		this.leadPlan = { theirs: foes.map((f, j) => ({ species: f.species, share: share[j] })), ours: mons.map(m => ({ details: m.p.details, score: m.lead })) };
		const lead = mons.slice().sort((a, b) => b.lead - a.lead || b.spe - a.spe)[0];
		const rest = mons.filter(m => m !== lead).sort((a, b) => b.spe - a.spe);
		return `team ${[lead, ...rest].map(m => m.i).join('')}`;
	}

	/**
	 * Rate how well a benched mon would do against what is out right now.
	 *
	 * Switching is not free: the incoming mon eats a hit on the way in. With tempo
	 * enabled that cost is charged against how much the mon is still worth, so the
	 * bot will happily walk a spent wall into a hit but will not throw its last
	 * fast cleaner in front of one.
	 */
	benchScore(gen, entry, state, field, request, costEntry) {
		const foes = state.foes();
		if (!foes.length) return 0;
		const me = this.switchInAs(gen, entry, state, foes);
		// Imposter copies the moves too: a Ditto's own moveset is just Transform, and
		// judging it by that scored it as doing nothing, so it never came in to copy
		// a boosted sweeper - which is the one thing it is for.
		const imposter = String(entry.ability || entry.baseAbility || '').toLowerCase() === 'imposter';
		let best = 0, worst = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			const copied = imposter && foes[0] ? [...new Set([...foes[0].moves, ...(this.knownAttacks(gen, (this.foePokemon(gen, foes[0]).species || {}).name) || [])])] : null;
			const mine = (copied || (entry.moves || []).map(m => toName(m, 'moves'))).map(m => this.damageToFoe(gen, me, foe, m, field));
			best = Math.max(best, ...(mine.length ? mine : [0]));
			const list = this.foeAttacks(gen, foe);
			const back = list
				? list.map(m => this.damagePct(gen, them, me, m, field) * this.maxRatio(gen, m, foe.dynamaxed))
				: [this.roughIncoming(gen, them, me, field) * (foe.dynamaxed ? 1.3 : 1)];
			worst = Math.max(worst, ...back);
		}

		// What the hazards on our side take on the way in (Raging Bolt came in on Stealth Rock and poison).
		const hit = worst;   // a share of the HP it has now, as damagePct counts
		const hazards = this.entryHazards(gen, me, entry, state);   // a share of its maximum
		worst += hazards;
		let score = best - worst;

		/*
		 * Setup fodder. A Pokemon that cannot hurt the thing in front of it, sent
		 * in against something that sets up, hands it the free turn that ends the
		 * game - "never sack onto a setup turn" (Pinkacross, The Art of Sacking:
		 * he stays in with the more valuable Pokemon rather than switch to the
		 * cheap sack a sweeper would boost on). A phazer, Haze, Encore or Taunt
		 * user is the answer to the setup, not fodder for it. (24 Sep 2026)
		 */
		if (this.cfg.sacking && !imposter && foes[0] && best < 30 && this.foeCanSetUp(gen, foes[0])) {
			const answersSetup = (entry.moves || []).some(m => /^(roar|whirlwind|dragontail|circlethrow|haze|clearsmog|encore|taunt|yawn|royaldecree)$/.test(String(m).toLowerCase().replace(/[^a-z0-9]/g, '')));
			if (!answersSetup) score -= 25;
		}

		/*
		 * Stall answers a boosted foe with the Pokemon built for it (R11): Unaware
		 * ignores the boosts, Haze and a phazer take them away. Humans sent in
		 * Unaware 6% and switched 23% of such turns; the bot attacked 57-61%.
		 */
		const style = request && foes[0] && foes[0].boosts ? this.styleRules(request) : null;
		if (style && style.boosted) {
			const up = ['atk', 'spa', 'spe'].reduce((n, s) => n + Math.max(0, foes[0].boosts[s] || 0), 0);
			if (up >= 1) {
				const moves = (entry.moves || []).map(m => String(m).toLowerCase().replace(/[^a-z0-9]/g, ''));
				if (String(entry.ability || entry.baseAbility || '').toLowerCase().replace(/[^a-z]/g, '') === 'unaware') score += 25;
				else if (moves.some(m => /^(haze|clearsmog|roar|whirlwind|dragontail|circlethrow)$/.test(m))) score += 15;
			}
		}

		// A boosted foe is exactly what Ditto answers: it arrives with the same
		// boosts, and a revenge kill on a setup sweeper swings the whole game.
		if (imposter && !this.cfg.naive && foes[0] && foes[0].boosts) {
			const up = Object.values(foes[0].boosts).reduce((sum, v) => sum + Math.max(0, v || 0), 0);
			if (up >= 2) score += 20 + 10 * Math.min(up, 6);
		}

		// Whether it can win the exchange, which matters far more than how hard it
		// hits. Against a sweeper that outruns the whole team, every Pokemon looks
		// equally doomed on damage alone, so the bot sent them in listing order and
		// they died one a turn without attacking. The one that kills first - by
		// outrunning it, or with a priority move - ends the sweep instead.
		if (best >= 100 && this.cfg.revenge !== false) {
			const mySpe = this.speedOf(me, me.boosts, me.status, state.weather);
			const outruns = foes.every(foe => {
				const theirSpe = this.foeSpeed(gen, foe, state.weather);
				return state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe;
			});
			let priorityKill = false;
			if (!outruns) {
				const dex = PkmnDex.forGen(gen.num);
				for (const m of entry.moves || []) {
					const name = toName(m, 'moves');
					const data = dex.moves.get(name);
					if (!data || !(data.priority > 0)) continue;
					for (const foe of foes) {
						if (this.damageToFoe(gen, me, foe, name, field) >= 100) { priorityKill = true; break; }
					}
					if (priorityKill) break;
				}
			}
			if (outruns || priorityKill) score += 70;
			else score += 15;             // it still trades, which beats dying for nothing
		}

		if (this.cfg.tempo && request) {
			const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
			const hpPct = cond ? (+cond[1] / +cond[2]) * 100 : 100;
			// Relative to the rest of the team, not absolute: what matters is which
			// of these six is the expensive one, and a team of six walls should still
			// be willing to spend one.
			const rank = this.valueRank(gen, entry, state, request);
			/*
			 * Dies coming in. The hit is a share of the HP it has now and hpPct a share
			 * of its maximum, so comparing them straight counted a 70% Lopunny taking
			 * 64% as dead; with the foe model's harder hits that stopped it being sent
			 * in at all. Counted in the same units there (24 Sep 2026).
			 */
			const dies = this.cfg.foeModel ? hit * hpPct / 100 + hazards >= hpPct : worst >= hpPct;
			if (dies) score -= TEMPO.death * (0.4 + 0.6 * rank);
			// Only a voluntary switch pays for the hit on the way in. Replacing a
			// fainted Pokemon is free, and charging it there is what made the bot
			// send in whatever it cared least about after every knockout.
			if (costEntry) score -= (worst / 100) * TEMPO.entry * (0.4 + 0.6 * rank);
		}
		return score;
	}

	/**
	 * What this Pokemon would actually be once it is on the field.
	 *
	 * Imposter copies the Pokemon it comes in on, so a benched Ditto is not the
	 * 48-base-stat blob the dex says it is - it is a mirror of whatever is out
	 * there. Judging it on its own stats is why it loses switch-ins it should win.
	 */
	switchInAs(gen, entry, state, foes) {
		const ability = String(entry.ability || entry.baseAbility || '').toLowerCase();
		if (ability === 'imposter' && foes.length) {
			const copy = this.foePokemon(gen, foes[0], { bare: true });
			// It arrives with its own HP, and Imposter does not copy HP.
			const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
			if (cond) {
				const pct = +cond[1] / +cond[2];
				copy.originalCurHP = Math.max(1, Math.round(copy.maxHP() * pct));
			}
			return copy;
		}
		return this.myPokemon(gen, entry, state);
	}

	/** Per cent of its HP a Pokemon loses to our side's Stealth Rock and Spikes coming in. */
	entryHazards(gen, mon, entry, state) {
		if (this.cfg.naive || this.cfg.hazards === false || !state || !state.hazards) return 0;
		const side = state.hazards[state.myPlayer] || {};
		const item = String((entry && entry.item) || '').toLowerCase().replace(/[^a-z]/g, '');
		const ability = String((entry && (entry.ability || entry.baseAbility)) || '').toLowerCase().replace(/[^a-z]/g, '');
		if (item === 'heavydutyboots' || ability === 'magicguard') return 0;
		const types = (mon && mon.types) || [];
		const dex = PkmnDex.forGen(gen.num);
		let pct = 0;
		if (side['Stealth Rock']) {
			let mult = 1;
			for (const t of types) {
				const taken = ((dex.types.get(t) || {}).damageTaken || {}).Rock;
				mult *= taken === 1 ? 2 : taken === 2 ? 0.5 : taken === 3 ? 0 : 1;
			}
			pct += 12.5 * mult;
		}
		const layers = Math.min(3, Number(side.Spikes) || 0);
		const grounded = !types.includes('Flying') && ability !== 'levitate' && item !== 'airballoon';
		if (layers && grounded) pct += [0, 12.5, 16.67, 25][layers];
		return pct;
	}

	/**
	 * This server's own attacks a foe's species carries that it has not shown yet.
	 *
	 * The probes below assume a typical move of each of its types, which a custom
	 * kit breaks: Roserade's Oxidize is super effective on Steel, and a Kingambit
	 * set up in front of it as if it were safe (replay gen9rpou-1-tlirc4). The
	 * species' role sets (src/role-sets.js) list the customs it really runs.
	 */
	hiddenAttacks(gen, foe) {
		if (this.cfg.naive || this.cfg.hidden === false || !foe) return [];
		const species = String(foe.transformed || foe.species || '').split(',')[0];
		this.hiddenCache = this.hiddenCache || new Map();
		if (!this.hiddenCache.has(species)) {
			let found = [];
			try {
				const Dex = require('./rp-dex')();
				const RS = require('./role-sets');
				const names = new Set();
				for (const set of RS.roleSets(Dex, species)) for (const n of set.movepool) names.add(n);
				found = [...names].filter(n => { const m = Dex.moves.get(n); return m.exists && m.num < 0 && m.category !== 'Status'; });
			} catch (e) { found = []; }
			this.hiddenCache.set(species, found);
		}
		const seen = foe.moves ? [...foe.moves] : [];
		if (seen.length >= 4) return [];
		return this.hiddenCache.get(species).filter(n => !seen.includes(n));
	}

	/**
	 * Named stand-in attacks for a foe that has shown none: one per type it
	 * has, on the side it hits harder with - the same probes roughIncoming
	 * uses, as moves the endgame tree can play (24 Sep 2026).
	 */
	probeAttacks(gen, them) {
		const species = PkmnDex.forGen(gen.num).species.get(them.name || (them.species && them.species.name));
		if (!species) return [];
		const physical = ((them.stats && them.stats.atk) || 0) >= ((them.stats && them.stats.spa) || 0);
		const PROBES = physical ? PHYSICAL_PROBES : SPECIAL_PROBES;
		return species.types.map(t => PROBES[t]).filter(Boolean);
	}

	/** Worst-case estimate when the opponent has revealed nothing. */
	roughIncoming(gen, them, me, field) {
		// If the format generated this Pokemon from a known list, guessing is
		// unnecessary: work out what its actual attacks would do. A probe has to
		// assume a typical move of each type, which over-rates a wall with nothing
		// to hit back with and under-rates anything carrying coverage.
		const attacks = this.knownAttacks(gen, them.species && them.species.name);
		if (attacks) {
			let hardest = 0;
			for (const move of attacks) hardest = Math.max(hardest, this.damagePct(gen, them, me, move, field));
			return hardest;
		}
		const species = PkmnDex.forGen(gen.num).species.get(them.name);
		if (!species) return 35;
		// Probe with the side of the attacker that actually hits hard. Guessing a
		// special move against a physical attacker badly under-rates the threat -
		// it is what let a Gallade stand in front of an unrevealed Dachsbun.
		const physical = ((them.stats && them.stats.atk) || 0) >= ((them.stats && them.stats.spa) || 0);
		const PROBES = physical ? PHYSICAL_PROBES : SPECIAL_PROBES;
		let worst = 0;
		for (const type of species.types) {
			const probe = PROBES[type];
			if (probe) worst = Math.max(worst, this.damagePct(gen, them, me, probe, field));
		}
		// And the custom attacks its species carries (Oxidize on Roserade).
		for (const name of this.hiddenAttacks(gen, { species: species.name, moves: new Set() })) {
			worst = Math.max(worst, this.damagePct(gen, them, me, name, field));
		}
		return worst;
	}

	/**
	 * Does this move's drop to our own Defence or Sp. Def turn their best hit into
	 * a KO it was not before? False when nothing is dropped, when they have shown
	 * priority, or when we were dead to them anyway.
	 */
	dropOpensKo(gen, me, foe, data, field) {
		const drops = (data && data.self && data.self.boosts) || null;
		if (!drops || !((drops.def || 0) < 0 || (drops.spd || 0) < 0)) return false;
		const dex = PkmnDex.forGen(gen.num);
		const seen = [...(foe.moves || [])];
		if (seen.some(m => { const d = dex.moves.get(m); return d && d.exists && d.priority > 0 && d.category !== 'Status'; })) return false;
		const them = this.foePokemon(gen, foe);
		const list = this.foeAttacks(gen, foe);
		const worst = target => (list
			? Math.max(0, ...list.map(m => this.damagePct(gen, them, target, m, field)))
			: this.roughIncoming(gen, them, target, field));
		// damagePct is a share of the HP we have left: 100 is a KO.
		if (worst(me) >= 100) return false;
		const lowered = me.clone();
		lowered.boosts = { ...me.boosts };
		for (const stat of ['def', 'spd']) {
			if ((drops[stat] || 0) < 0) lowered.boosts[stat] = Math.max(-6, (me.boosts[stat] || 0) + drops[stat]);
		}
		return worst(lowered) >= 100;
	}

	/**
	 * Does our unboosted best hit take half of what this foe has left? Then it
	 * cannot sit in front of us: it switches, or it loses the 1v1.
	 */
	forcesOut(gen, me, foe, field) {
		if (!me || !foe || !this.myMoveNames || !this.myMoveNames.length) return false;
		let hit = 0;
		for (const m of this.myMoveNames) hit = Math.max(hit, this.damageToFoe(gen, me, foe, m, field || new calc.Field()));
		return hit >= 50;
	}

	/** The stage of the stat a self-dropping move lowers (0 for any other move). */
	droppedFor(data, me) {
		const drops = (data && ((data.self && data.self.boosts) || (data.selfBoost && data.selfBoost.boosts))) || null;
		if (!drops || !me || !me.boosts) return 0;
		const stat = data.category === 'Special' ? 'spa' : 'atk';
		return (drops[stat] || 0) < 0 ? (me.boosts[stat] || 0) : 0;
	}

	/**
	 * The chance this move of ours lands, 0..1.
	 *
	 * Accuracy is part of a move's value (Pinkacross, How to Play Like a Pro and
	 * the Rank 1 tips, 24 Sep 2026): the expected damage of Focus Blast is 70% of
	 * its number, and clicking the 70% move when a 100% one already does the job
	 * is how a won game is handed back on a miss. ai.js never read `accuracy`
	 * before today, so Focus Blast and Aura Sphere scored the same.
	 *
	 * The accuracy role-sets.js weighs is a different decision - which moves go
	 * on the set at build time - so counting it here again is not a double
	 * penalty: that one picks the moveset, this one picks the click.
	 *
	 * The modifiers that commonly matter: No Guard (either side), Compound Eyes,
	 * Hustle, Wide Lens, rain for Thunder and Hurricane (and sun against them),
	 * snow for Blizzard, and accuracy/evasion stages. Anything rarer is left at
	 * the listed number, which errs towards the move landing.
	 */
	hitChance(gen, data, me, foe, state, live) {
		if (!data || data.accuracy === true || !data.accuracy) return 1;
		const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const myAbility = id(me && me.ability), theirAbility = id(foe && foe.ability);
		if (myAbility === 'noguard' || theirAbility === 'noguard') return 1;
		const weather = id(state && state.weather);
		const rain = /raindance|primordialsea/.test(weather), sun = /sunnyday|desolateland/.test(weather);
		if ((data.id === 'thunder' || data.id === 'hurricane' || data.id === 'bleakwindstorm' || data.id === 'wildboltstorm' || data.id === 'sandsearstorm') && rain) return 1;
		if (data.id === 'blizzard' && /snow|hail/.test(weather)) return 1;
		let acc = data.accuracy;
		if ((data.id === 'thunder' || data.id === 'hurricane') && sun) acc = 50;
		const stage = Math.max(-6, Math.min(6, ((live && live.boosts && live.boosts.accuracy) || 0) - ((foe && foe.boosts && foe.boosts.evasion) || 0)));
		acc *= stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
		if (myAbility === 'compoundeyes') acc *= 1.3;
		if (myAbility === 'hustle' && data.category === 'Physical') acc *= 0.8;
		if (myAbility === 'victorystar') acc *= 1.1;
		if (id(me && me.item) === 'widelens') acc *= 1.1;
		if (/brightpowder|laxincense/.test(id(foe && foe.item))) acc *= 0.9;
		return Math.max(0, Math.min(1, acc / 100));
	}

	forceSwitch(request, state) {
		const gen = this.gen(state.gen);
		const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
		const options = request.side.pokemon
			.map((p, i) => ({ p, i: i + 1 }))
			.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
		if (!options.length) return 'default';
		this.learnFoeScale(gen, state, request);
		/*
		 * In the endgame, who comes in is decided by playing the rest out (A16):
		 * "if they bring X, I send Y" is exactly this choice. (24 Sep 2026)
		 */
		if (this.cfg.endgame && this.cfg.search && options.length > 1) {
			const planned = this.search.endgameReplacement(gen, request, state, field);
			if (planned && options.some(o => o.i === planned.i)) return `switch ${planned.i}`;
		}
		let best = options[0], bestScore = -Infinity;
		for (const opt of options) {
			const score = this.benchScore(gen, opt.p, state, field, request) + this.jitter();
			if (score > bestScore) { bestScore = score; best = opt; }
		}
		return `switch ${best.i}`;
	}

	turnChoice(request, state) {
		const gen = this.gen(state.gen);
		const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
		const choices = [];

		request.active.forEach((active, index) => {
			const entry = request.side.pokemon[index];
			if (!entry || /fnt/.test(entry.condition)) { choices.push('pass'); return; }
			choices.push(this.chooseForSlot(gen, active, entry, index, request, state, field));
		});
		return choices.join(', ');
	}

	/**
	 * The worst this bench Pokemon would take, coming in right now.
	 *
	 * Per cent of its own maximum, against whatever the opponent has shown - and
	 * against a rough guess at their best when they have shown nothing, which is
	 * the same estimate the switching code already trusts elsewhere.
	 */
	worstIncoming(gen, entry, state, field) {
		const foes = state.foes();
		if (!foes.length) return 100;
		const me = this.switchInAs(gen, entry, state, foes);
		let worst = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			const list = this.foeAttacks(gen, foe);
			const back = list ?
				list.map(m => this.damagePct(gen, them, me, m, field) * this.maxRatio(gen, m, foe.dynamaxed)) :
				[this.roughIncoming(gen, them, me, field) * (foe.dynamaxed ? 1.3 : 1)];
			worst = Math.max(worst, ...back);
		}
		return worst;
	}

	/**
	 * The position, in the terms the playbook counts in.
	 *
	 * Deliberately coarse, and deliberately the same buckets
	 * scripts/learn-playbook.js used when it read the replays - "low" has to mean
	 * the same thing on both sides of the comparison or the numbers are about
	 * nothing.
	 */
	situation(state, entry, foes) {
		const bucket = fraction =>
			fraction === null || fraction === undefined ? 'unknown' :
			fraction <= 0.25 ? 'low' :
			fraction <= 0.6 ? 'half' :
			fraction < 1 ? 'high' : 'full';

		const mine = entry && entry.condition ? entry.condition : '';
		const hp = (() => {
			const match = /^(\d+)\/(\d+)/.exec(String(mine));
			if (!match) return null;
			return Number(match[2]) ? Number(match[1]) / Number(match[2]) : null;
		})();
		const foe = foes && foes[0];
		const foeHp = foe && typeof foe.hp === 'number' ?
			(foe.maxhp ? foe.hp / foe.maxhp : foe.hp / 100) : null;

		const turn = state && state.turn ? state.turn : 0;
		return {
			turn,
			hp: bucket(hp),
			foeHp: bucket(foeHp),
			// "Just came in" means the turn before this one, which is what the
			// replays counted: a chooser knows who arrived last turn, not who is
			// arriving this one.
			justCameIn: !!(state && state.mineCameIn && state.mineCameIn === turn - 1),
			foeJustCameIn: !!(state && state.foeCameIn && state.foeCameIn === turn - 1),
		};
	}

	/**
	 * Would Terastallizing right now actually change anything?
	 *
	 * Tera cuts both ways and the defensive half is the half people win with:
	 * changing type to resist the hit coming at you can turn a knockout into a
	 * free turn. Both directions are measured against the same Tera type, because
	 * the type is fixed by the set (Random Battle sets pick it in advance), so
	 * the only real question is whether *this* is the turn to spend it.
	 */
	teraWorthIt(gen, active, entry, state, foes, field, best, incoming) {
		const teraType = typeof active.canTerastallize === 'string' ? active.canTerastallize : null;
		if (!teraType || !foes.length) return false;

		/*
		 * Do not spend the Tera on the Pokemon that is here to Mega Evolve.
		 *
		 * On this server a side gets one Mega, one Dynamax and one Tera per
		 * battle, and a Pokemon that uses one cannot use another - so
		 * Terastallizing the Mega Stone holder does not use two of the three, it
		 * *throws one away*. The stone becomes an item that does nothing and the
		 * Tera is spent on a Pokemon that had a better transformation waiting.
		 *
		 * The exception is the whole point of the rule: if the Tera is what stops
		 * this Pokemon dying on this turn, take it. A Mega that never happens
		 * because its holder fainted first is worth nothing either. So this only
		 * blocks the ordinary "this looks like a good turn for it" cases below -
		 * the two survival tests are checked first and answer for themselves.
		 */
		const carryingAGimmick = this.hasUnusedGimmick(entry);

		const me = this.myPokemon(gen, entry, state);
		const teraMe = this.myPokemon(gen, entry, state);
		teraMe.teraType = teraType;
		const hpPct = (me.originalCurHP / me.maxHP()) * 100;

		let plainOut = 0, teraOut = 0;     // what we deal
		let plainIn = 0, teraIn = 0;       // what we take
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			if (best && best.name) {
				plainOut = Math.max(plainOut, this.damageToFoe(gen, me, foe, best.name, field));
				teraOut = Math.max(teraOut, this.damageToFoe(gen, teraMe, foe, best.name, field));
			}
			const seen = this.foeAttacks(gen, foe, false);
			if (seen) {
				for (const m of seen) {
					plainIn = Math.max(plainIn, this.damagePct(gen, them, me, m, field));
					teraIn = Math.max(teraIn, this.damagePct(gen, them, teraMe, m, field));
				}
			} else {
				plainIn = Math.max(plainIn, this.roughIncoming(gen, them, me, field));
				teraIn = Math.max(teraIn, this.roughIncoming(gen, them, teraMe, field));
			}
		}

		// In shares of our maximum, like hpPct (hpUnits; see chooseForSlot).
		if (this.cfg.hpUnits) { plainIn *= hpPct / 100; teraIn *= hpPct / 100; }
		// Defensive: it turns a hit we do not survive into one we do. This is the
		// case that saves a Pokemon outright, so it beats hoarding the Tera - and
		// it is the "unless it is the only way out" the rule above allows for.
		if (plainIn >= hpPct && teraIn < hpPct) return true;
		// Offensive: it turns something that was not a kill into one. Worth the
		// Tera on its own, but not worth throwing a Mega away for.
		// (Unless the Tera leaves us dying before it lands.)
		if (teraOut >= 100 && plainOut < 100 && teraIn < hpPct) return !carryingAGimmick;
		// Beyond that, do not spend it on a turn we are knocked out anyway.
		if (plainIn >= hpPct) return false;
		// A worthwhile margin in either direction - and never on the Mega. More damage
		// is not worth a typing that takes much more back (the review's Tera Normal).
		if (carryingAGimmick) return false;
		/*
		 * A better typing is not a reason on its own. Landorus Terastallized into Water on
		 * turn one of replay gen9rpou-4-tliyi7, at full health, against a hit worth a third
		 * of it - and had nothing left for the sweep that finished the game. The defensive
		 * half only pays when the hit coming is actually worth blunting.
		 */
		const pressured = plainIn >= hpPct * 0.7 || (hpPct < 70 && plainIn >= hpPct * 0.5);
		return (teraOut > plainOut * 1.25 && teraIn <= Math.max(plainIn * 1.15, plainIn + 8)) ||
			(pressured && teraIn < plainIn * 0.6);
	}

	/**
	 * Is this Pokemon holding a transformation it has not used yet?
	 *
	 * A Mega Stone or a Z-crystal in the item slot, on a Pokemon that has not
	 * Mega Evolved. Read off the item rather than from anything the battle tells
	 * us, because the battle has no line for "this one is your Mega" - the item
	 * is the whole declaration.
	 */
	hasUnusedGimmick(entry) {
		if (!entry || !entry.item) return false;
		let item;
		try {
			// The same dex every other lookup in this file uses. `this.dex` is not
			// one of them and does not exist, which is why this answered "no" for a
			// Charizard holding a Charizardite.
			item = PkmnDex.forGen(9).items.get(entry.item);
		} catch (e) {
			return false;
		}
		if (!item || !item.exists) return false;
		// Already Mega Evolved: the stone has done its job and the Tera is free.
		const species = String(entry.details || entry.speciesForme || '');
		if (/-Mega|-Primal/.test(species)) return false;
		return !!(item.megaStone || item.zMove || item.isPrimalOrb);
	}

	/**
	 * Dynamax (gen 8) doubles HP as well as boosting moves, so like Tera it has a
	 * defensive use: a hit that would knock us out may not once the HP bar is
	 * twice the size.
	 */
	dynamaxWorthIt(hpPct, incoming, best, { attacks = 4, damage = 100, turn = 99, hold = false, maxDamage = damage } = {}) {
		if (incoming >= hpPct && incoming < hpPct * 2) return true;   // survives it
		if (incoming >= hpPct) return false;                          // dies regardless
		// Stall's Dynamax is held for a kill (see chooseForSlot, holdDynamax).
		if (hold && maxDamage < 100) return false;
		if (this.cfg.sanity !== false) {
			// Three turns is the whole value: not on a Pokemon half gone, and not on a
			// status move or a priority attack, which a Max Move turns into Max Guard
			// or strips of its priority.
			if (hpPct < 60 || !best) return false;
			const data = best.name ? PkmnDex.forGen(8).moves.get(best.name) : null;
			if (data && (data.category === 'Status' || data.priority > 0)) return false;
			// Its three turns are three Max Moves: a Pokemon with one or two attacks spends the
			// rest on Max Guard, and one whose best hit is resisted gains nothing from the boost.
			if (attacks < 2 || damage < 35) return false;
			/*
			 * Not on the opening turns for the sake of it. Samurott Dynamaxed into a Landorus
			 * that simply U-turned away, and two of its three turns were gone before the
			 * Pokemon it was meant to break had been seen. Early on, it has to kill now.
			 */
			if (turn <= 2 && damage < 100) return false;
		}
		return best ? best.score >= 40 : false;
	}

	/**
	 * Which Z-Move to use this turn, or null to hold it.
	 *
	 * The bot never used one: chooseForSlot added Mega, Ultra Burst, Dynamax and
	 * Tera to its choice and never 'zmove', while Z-Moves are live here (National
	 * Dex, and gym leaders from the fifth badge). A Z-Move is once a battle, so it
	 * is spent only when it is the difference (24 Sep 2026):
	 *   - it turns a hit that does not KO into one that does, when nothing else
	 *     KOs already (and it lands - we move first, or we are not dying anyway);
	 *   - or this Pokemon is going down this turn after moving, and the Z-Move
	 *     does clearly more than the move it would have used - the crystal is
	 *     worth nothing once it has fainted.
	 * Z power over the move's own power scales the damage already worked out; a
	 * status Z-Move is left alone.
	 */
	zChoice(gen, active, ranked, best, me, incoming, movesFirst) {
		const dex = PkmnDex.forGen(gen.num);
		const myHp = (me.originalCurHP / me.maxHP()) * 100;
		const dying = incoming >= myHp;
		if (dying && !movesFirst) return null;
		const bestRow = ranked.find(r => r.n === best.n);
		const bestDmg = bestRow && bestRow.damage > 0 ? bestRow.damage * (bestRow.accuracy === undefined ? 1 : bestRow.accuracy) : 0;
		if (bestDmg >= 100) return null;
		let pick = null;
		active.canZMove.forEach((z, i) => {
			if (!z) return;
			const move = (active.moves || [])[i];
			const d = move && dex.moves.get(move.move || move.id);
			const row = ranked.find(r => r.n === i + 1);
			if (!d || !d.exists || d.category === 'Status' || !d.basePower || !d.zMove || !d.zMove.basePower || !row || !(row.damage > 0)) return;
			const zdmg = row.damage * d.zMove.basePower / d.basePower;
			if (!pick || zdmg > pick.zdmg) pick = { n: i + 1, name: d.name, target: row.target, zdmg };
		});
		if (!pick) return null;
		if (pick.zdmg >= 105) return pick;
		if (dying && pick.zdmg >= bestDmg + 25) return pick;
		return null;
	}

	/**
	 * A Choice Scarf gives itself away by moving first when it should not.
	 *
	 * Last turn's order, against the fastest the foe could be without one: 252
	 * Speed EVs and a boosting nature, at the Speed stage and status it began the
	 * turn with. Moving first through that, with neither move having priority
	 * (nor any ability that grants it), and by less than the Scarf's 1.5x, is a
	 * Scarf - the replay study's strict rule was right 11 times in 11. Recorded as
	 * its item, so every later calculation uses it.
	 */
	inferScarf(gen, state, request) {
		if (this.cfg.naive || this.cfg.scarf === false || !state.lastTurnMoves || !state.lastTurnStart) return;
		if (state.pseudo && state.pseudo['Trick Room']) return;
		const moves = state.lastTurnMoves;
		const mineAt = moves.findIndex(m => m.side === state.myPlayer);
		const foeAt = moves.findIndex(m => m.side !== state.myPlayer);
		if (mineAt < 0 || foeAt < 0 || foeAt > mineAt) return;
		const dex = PkmnDex.forGen(gen.num);
		const theirs = dex.moves.get(moves[foeAt].name);
		const ours = dex.moves.get(moves[mineAt].name);
		if (!theirs || !ours || theirs.priority || ours.priority) return;
		// Prankster, Gale Wings, Triage and our own priority-changing moves move first without a Scarf.
		if (theirs.category === 'Status' || theirs.type === 'Flying' || (theirs.flags && theirs.flags.heal)) return;
		if (/^(soultoll|grassyglide|royaldecree)$/.test(ours.id) || /^(soultoll|grassyglide)$/.test(theirs.id)) return;
		const foe = state.opponent[moves[foeAt].slot];
		const startFoe = state.lastTurnStart[`${moves[foeAt].side}${moves[foeAt].slot}`];
		const startMine = state.lastTurnStart[`${moves[mineAt].side}${moves[mineAt].slot}`];
		if (!foe || foe.fainted || foe.item || foe.species !== moves[foeAt].species || !startFoe || !startMine) return;
		if (/quickdraw|stall/.test(String(foe.ability || '').toLowerCase().replace(/[^a-z]/g, ''))) return;
		const entry = request.side.pokemon.find(p => String(p.details || '').split(',')[0] === moves[mineAt].species);
		if (!entry || entry.item && /laggingtail|fullincense/.test(String(entry.item))) return;
		const stage = (n, v) => (v >= 0 ? n * (2 + v) / 2 : n * 2 / (2 - v));
		const me = this.myPokemon(gen, entry, null);
		let mySpe = stage(this.speedOf(me, {}, undefined, state.weather), startMine.spe);
		if (startMine.status === 'par') mySpe *= 0.5;
		const species = dex.species.get(foe.transformed || foe.species);
		if (!species || !species.baseStats) return;
		const level = foe.level || 100;
		let theirMax = Math.floor(Math.floor((2 * species.baseStats.spe + 31 + 63) * level / 100 + 5) * 1.1);
		theirMax = stage(theirMax, startFoe.spe);
		if (startFoe.status === 'par') theirMax *= 0.5;
		// Speed-doubling weather abilities, Unburden and Booster Energy would also explain it.
		if (state.weather || /unburden|protosynthesis|quarkdrive|speedboost/.test(String(foe.ability || '').toLowerCase().replace(/[^a-z]/g, ''))) return;
		if (mySpe > theirMax && mySpe <= theirMax * 1.5) {
			foe.item = 'Choice Scarf';
			foe.itemInferred = true;
		}
	}

	chooseForSlot(gen, active, entry, index, request, state, field) {
		if (index === 0) {
			this.inferScarf(gen, state, request);
			this.learnFoeScale(gen, state, request);
		}
		const me = this.myPokemon(gen, entry, state);
		const foes = state.foes();
		// switchPressure/sweepPotential need to know what we can actually click.
		this.myMoveNames = (active.moves || []).map(m => m.move || toName(m.id, 'moves'));
		const legal = (active.moves || []).map((m, i) => ({ ...m, n: i + 1 }))
			.filter(m => !m.disabled && (m.pp === undefined || m.pp > 0));
		if (!legal.length) return 'move 1';

		// A weaker opponent should feel like a weaker player, not an unlucky one:
		// it simply does not work the position out some of the time.
		if (this.cfg.blunder && Math.random() < this.cfg.blunder) {
			const roll = legal[Math.floor(Math.random() * legal.length)];
			const needs = request.active.length > 1 && NEEDS_TARGET.has(roll.target);
			return needs ? `move ${roll.n} 1` : `move ${roll.n}`;
		}

		// How hard we are about to be hit, used by every other judgement below.
		let incoming = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			const list = this.foeAttacks(gen, foe);
			const back = list ? list.map(m => this.damagePct(gen, them, me, m, field) * this.maxRatio(gen, m, foe.dynamaxed))
				: [this.roughIncoming(gen, them, me, field) * (foe.dynamaxed ? 1.3 : 1)];
			incoming = Math.max(incoming, ...back);
		}
		/*
		 * damagePct counts in shares of the HP we have NOW (100 is a KO), and every
		 * test below compares it with our share of MAXIMUM HP. At full health the two
		 * agree; at 40% a hit worth 25% of our maximum read as 62 >= 40, "dying", so
		 * the bot never healed - 0 of 108 chances to recover at half health or less
		 * in the review - and pulled Pokemon that were not in danger. In one unit
		 * from here on (hpUnits, 24 Sep 2026).
		 */
		if (this.cfg.hpUnits) incoming = incoming * (me.originalCurHP / me.maxHP());

		// Turn order is information, and acting on it is the difference between
		// "that move kills" and "that move kills in time". If we move first and
		// the KO is there, whatever they were going to do never happens.
		let movesFirst = false;
		// The other half of turn order, and the half that was missing: when we are
		// slower and the hit coming at us is lethal, this turn is the last one this
		// Pokemon gets. Setting up, chipping, healing into a KO - all of it happens
		// in a turn that never arrives. Only a kill of our own or a priority move
		// is worth anything, and otherwise the right answer is to leave.
		let outsped = false;
		if (this.cfg.predict && foes.length) {
			const mySpe = this.speedOf(me, me.boosts, me.status, state.weather);
			const order = foes.map(foe => {
				const theirSpe = this.foeSpeed(gen, foe, state.weather);
				return state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe;
			});
			movesFirst = order.every(Boolean);
			const myHp = (me.originalCurHP / me.maxHP()) * 100;
			outsped = !order.some(Boolean) && incoming >= myHp;
		}

		// The rules our team's style plays (STYLE_RULES; all of them for stall), with what they need to see.
		const rules = this.styleRules(request);
		const stall = !!rules;
		const stallCtx = {};
		if (stall) {
			// The rules' thresholds are shares of maximum HP, on every rung (hpUnits is Stockfish's knob).
			if (!this.cfg.hpUnits) incoming *= me.originalCurHP / me.maxHP();
			stallCtx.rules = rules;
			stallCtx.request = request;
			stallCtx.pp = {};
			for (const m of legal) stallCtx.pp[m.move || toName(m.id, 'moves')] = m.pp;
			stallCtx.sleepTalk = legal.some(m => /^sleeptalk$/.test(String(m.id || '').toLowerCase()));
			// A teammate that a Wish passed to would bring back from half health (R10).
			// A foe that is boosted or can boost: a passive turn in front of it is its free setup.
			stallCtx.foeSetup = !!rules.freeTurns && !!foes[0] && (Object.values(foes[0].boosts || {}).some(v => v > 0) || this.foeCanSetUp(gen, foes[0]));
			stallCtx.wishMate = request.side.pokemon.some(p => {
				if (p.active || /fnt/.test(p.condition || '')) return false;
				const c = /^(\d+)\/(\d+)/.exec(p.condition || '');
				return c && +c[1] / +c[2] <= 0.6;
			});
		}

		let best = null;
		const ranked = [];
		for (const move of legal) {
			const name = move.move || toName(move.id, 'moves');
			const data = PkmnDex.forGen(gen.num).moves.get(name);
			let score, target = null;

			if (data && data.category === 'Status') {
				const foe = foes[0];
				// A greedy player sees status moves as "the ones that do no damage".
				if (this.cfg.greedy) score = 2;
				else score = foe
					? this.statusScore(gen, name, me, this.foePokemon(gen, foe), state, incoming, { foes, field, entry, live: state.mine && state.mine['abc'[index]], movesFirst, ...stallCtx })
					: 5;
				// Nothing set up on the turn we are knocked out ever gets used.
				// (Except Protect with a Wish landing this turn: that is the whole point of it.)
				const wishing = this.cfg.recovery && PROTECTS.has(data.id) && state.mine && state.mine['abc'[index]] && state.mine['abc'[index]].lastMove === 'Wish' &&
					state.mine['abc'[index]].lastMoveTurn === state.turn - 1;
				if (outsped && score > 0 && !wishing) score *= 0.2;
				// A Will-O-Wisp that misses is a free turn for them: a status move aimed at
				// the foe is worth its hit chance (A10, 24 Sep 2026). Self-targeting moves
				// and hazards cannot miss and come back as 1.
				if (this.cfg.accuracy && !this.cfg.naive && score > 0 && foe && data.target !== 'self' && data.target !== 'foeSide') {
					score *= this.hitChance(gen, data, me, foe, state, state.mine && state.mine['abc'[index]]);
				}
				/*
				 * Dynamaxed, every status move is Max Guard. The bot clicked Roost and
				 * Will-O-Wisp as Moltres and got two Max Guards (the second failed) while
				 * Garchomp laid Stealth Rock and Spikes for free.
				 */
				const liveMon = state.mine && state.mine['abc'[index]];
				if (!this.cfg.naive && this.cfg.sanity !== false && liveMon && liveMon.dynamaxed) {
					const guardedLast = liveMon.lastMoveTurn === state.turn - 1 && /^(max guard|protect|detect)$/i.test(String(liveMon.lastMove || ''));
					score = guardedLast ? -30 : Math.min(score, 6);
				}
				if (foes.length > 1 && foe) target = foe.slot === 'b' ? 2 : 1;
			} else {
				score = -Infinity;
				for (const foe of foes) {
					const them = this.foePokemon(gen, foe);
					// A naive trainer reaches for the move with the biggest number on
					// it. No calculation, no notion that Ground does nothing to a
					// Flying type - which is exactly how it loses.
					const pct = this.cfg.naive
						? (data.basePower || 0) * (me.types && me.types.includes(data.type) ? 1.5 : 1) * 0.6
						: this.damageToFoe(gen, me, foe, name, field) * this.maxRatio(gen, name, state.mine && state.mine['abc'[index]] && state.mine['abc'[index]].dynamaxed);
					/*
					 * Past about one and a half KOs the extra number buys nothing, and left
					 * uncapped a 250% Focus Blast outscored a 110% Close Combat by more
					 * than the miss chance could take back (24 Sep 2026, A10).
					 */
					let s = this.cfg.accuracy && !this.cfg.naive ? Math.min(pct, 150) : pct;
					// An attack that does nothing (an immunity, an absorbing ability, an Air
					// Balloon) is worse than any status move, not level with them: at 0 it won
					// ties, and Dragonite clicked Extreme Speed into Spiritomb.
					if (!this.cfg.naive && this.cfg.sanity !== false && pct <= 0) s = -35;
					if (pct >= 100) s += 60;                                  // a kill is worth more than damage
					if (pct >= 100 && data && data.priority > 0) s += 25;      // and a priority kill even more
					// A KO we land first costs us nothing, so it beats retreating.
					if (pct >= 100 && (movesFirst || (data && data.priority > 0))) s += 40;
					if (data && data.recoil && pct < 100) s -= 6;
					/*
					 * Keystone Legion (Spiritomb, Balance Patch 1): a hit that would knock it out
					 * leaves it at 1 HP and curses the attacker, once until any Pokemon faints.
					 * Replay gen9rpou-7: Gholdengo and then Iron Valiant each went for the kill on
					 * a Spiritomb at a few per cent, and both were cursed for it. A multi-hit move
					 * gets through (the next hit finds the keystone spent), and Mold Breaker ignores it.
					 */
					if (!this.cfg.naive && this.cfg.legion !== false && pct >= 100 && data && !data.multihit) {
						const foeAbility = String(foe.ability || '').toLowerCase().replace(/[^a-z]/g, '');
						const holder = foeAbility === 'keystonelegion' || (!foe.ability && /^spiritomb$/i.test(String(foe.species || '')));
						const spent = state.legionCracked && state.legionCracked[`${state.theirPlayer}|${String(foe.species || '').split(',')[0]}`];
						const breaker = /^(moldbreaker|teravolt|turboblaze)$/.test(String(me.ability || '').toLowerCase().replace(/[^a-z]/g, ''));
						if (holder && !spent && !breaker) {
							const myHp = (me.originalCurHP / me.maxHP()) * 100;
							// It lives at 1 HP; the curse costs a quarter of our HP a turn until we leave.
							s = 60 - (incoming >= myHp ? 0 : 30);
						}
					}
					/*
					 * Sucker Punch (and Thunderclap) fail unless the target attacks. Kingambit
					 * clicked it into Roserade's Nasty Plot. The more a foe has shown status
					 * and setup moves - or it has just come in - the less it is worth.
					 */
					if (!this.cfg.naive && this.cfg.sanity !== false && data && /^(suckerpunch|thunderclap)$/.test(data.id)) {
						const shown = [...(foe.moves || [])].map(m => PkmnDex.forGen(gen.num).moves.get(m)).filter(Boolean);
						const statusShown = shown.some(m => m.category === 'Status');
						const attackShown = shown.some(m => m.category !== 'Status');
						let works = attackShown && !statusShown ? 0.85 : statusShown && !attackShown ? 0.3 : 0.65;
						if (state.foeCameIn && state.foeCameIn >= state.turn - 1) works = Math.min(works, 0.65);
						const liveMe = state.mine && state.mine['abc'[index]];
						if (liveMe && liveMe.lastMoveTurn === state.turn - 1 && liveMe.lastFailed === liveMe.lastMove && /sucker punch|thunderclap/i.test(String(liveMe.lastMove))) works = Math.min(works, 0.3);
						if (works < 0.8) s = pct * works + (pct >= 100 ? 40 * works : 0);
					}
					// Draco Meteor, Overheat, Leaf Storm...: fired again from -2 or lower
					// they hit like wet paper. Anyone past Easy notices and looks elsewhere.
					if (!this.cfg.naive && pct < 100 && this.droppedFor(data, me) <= -2) s -= 12 + 4 * Math.abs(this.droppedFor(data, me));
					/*
					 * Close Combat, Superpower, Headlong Rush: the Defence drop only costs
					 * something when we were going to stay in (owner, 23 Sep 2026). It is free
					 * when the hit kills, when they outrun us or have priority (we switch or
					 * sack after anyway), or when it tore a big hole. What is left: we move
					 * first, it does not kill, and their best hit only kills us through the drop.
					 */
					if (movesFirst && pct < 60 && this.dropOpensKo(gen, me, foe, data, field)) s -= 25;
					// We are dead before this lands unless it kills or it has priority.
					/*
					 * Expected value, KO bonus included: a 70% KO is worth 70% of a KO
					 * (Pinkacross, How to Play Like a Pro: he fired six Pyro Balls where two
					 * were needed; 24 Sep 2026). So the accurate KO wins whenever there is
					 * one, and the inaccurate move is still clicked when it alone KOs.
					 */
					if (this.cfg.accuracy && !this.cfg.naive && s > 0) s *= this.hitChance(gen, data, me, foe, state, state.mine && state.mine['abc'[index]]);
					if (outsped && pct < 100 && !(data && data.priority > 0) && s > 0) s *= 0.35;
					if (s > score) { score = s; target = foe.slot === 'b' ? 2 : 1; }
				}
				// A second Future Sight before the first lands fails (the Stockfish reviews).
				if (this.cfg.sanity !== false && data && /^(futuresight|doomdesire)$/.test(data.id) && state.futureSight &&
					state.turn <= (state.futureSight[state.myPlayer] || -9) + 2) score = -30;
				/*
				 * Fake Out, First Impression and Mat Block work on the turn the
				 * Pokemon comes in and never again until it leaves and returns.
				 *
				 * A Lokix clicked First Impression on seven turns in a row, failing
				 * every one of them, while the Kingambit across from it used the free
				 * turns to set up two Swords Dances (replay gen9rpou-5-tlj24k). The
				 * move's damage still looked like the best number on the board,
				 * because nothing in the scoring knew it would not happen at all.
				 */
				// It came in on turn N (the switch line follows |turn|N), so turn N+1 is its first move -
				// the test used to be "after turn N", which made Fake Out fail on its one good turn too.
				if (this.cfg.sanity !== false && data && /^(fakeout|firstimpression|matblock)$/.test(data.id) &&
					state.turn > (state.mineCameIn || 0) + 1) score = -30;
			}
			score += this.jitter();
			if (!best || score > best.score) best = { score, n: move.n, target, name };
			// Keep every option around; the search re-ranks them by what the
			// opponent can do about it, which the heuristic score cannot see.
			ranked.push({
				kind: 'move', n: move.n, target, name, score,
				damage: data && data.category !== 'Status'
					? Math.max(0, ...foes.map(f => this.damagePct(gen, me, this.foePokemon(gen, f), name, field)))
					: 0,
				priority: data ? (data.priority || 0) : 0,
				heuristic: data && data.category === 'Status' ? score : 0,
				// What a heal restores, for the search to play out (recovery).
				heal: (this.cfg.recovery || (stall && rules.heal)) && data && RECOVERY.includes(data.name) && !(data.id === 'rest' && me.status === 'slp')
					? this.healShare(data, state) : 0,
				// The search plays the miss out as its own branch rather than shrinking the hit.
				accuracy: this.cfg.accuracy && data && data.category !== 'Status' && foes[0]
					? this.hitChance(gen, data, me, foes[0], state, state.mine && state.mine['abc'[index]]) : 1,
				// Stall's Protect is played out as the hit it blocks (R9); elsewhere as before.
				// Not a second one in a row: that fails, and the playout must not read it as a block
				// (Alomomola Protected three turns running into Ogerpon because it did).
				protect: stall && !!rules.protect && data && PROTECTS.has(data.id) && data.id !== 'endure' && score > -25,
			});
		}

		// Search: play each of our options out against each of their likely
		// replies and score where the turn ends, rather than scoring the move
		// against a position the opponent is assumed not to touch.
		let planned = null;
		if (this.cfg.search && ranked.length) {
			/*
			 * Three or fewer a side, all of theirs seen: plan it exactly instead
			 * (A16, Pinkacross; 24 Sep 2026). The tree already weighed every switch
			 * of ours, so the bench logic below stands down when it has spoken.
			 */
			if (this.cfg.endgame) planned = this.search.endgame(gen, entry, request, state, field, ranked);
			if (planned && planned.kind === 'switch' && !active.trapped && !active.maybeTrapped) return `switch ${planned.i}`;
			if (planned && planned.kind === 'move') {
				best = { score: planned.score, n: planned.n, target: planned.target, name: planned.name };
			} else {
				planned = null;
				const shortlist = ranked.slice().sort((a, b) => b.score - a.score).slice(0, 5);
				const searched = this.search.choose(gen, active, entry, request, state, field, shortlist, incoming);
				if (searched) best = { score: searched.score, n: searched.n, target: searched.target, name: searched.name };
			}
		}

		// Stall's own switching and healing first (stallSwitch); a move it insists on skips the general rule.
		let stallKeeps = false;
		if (stall && (rules.pivot || rules.preserve || rules.boosted || rules.wish) && this.cfg.switching && request.side.pokemon.length > 1 && !active.trapped && !active.maybeTrapped) {
			const verdict = this.stallSwitch(gen, active, entry, me, request, state, field, foes, incoming, movesFirst, ranked, index, !!planned, rules);
			if (verdict && verdict.switch) {
				this.log(`stall: ${verdict.why} -> switch ${verdict.switch}`);
				return `switch ${verdict.switch}`;
			}
			if (verdict && verdict.move) {
				const row = ranked.find(r => r.n === verdict.move);
				if (row) { best = { score: row.score, n: row.n, target: row.target, name: row.name }; stallKeeps = true; }
				this.log(`stall: ${verdict.why} -> move ${verdict.move}`);
			}
		}

		// Would anything on the bench do better than what we are about to do here?
		/*
		 * The endgame tree's plan does not excuse a Choice lock into a move that does
		 * little, or a Pokemon walled for turns: an Indeedee-F locked into Hyper Voice
		 * clicked it into a Ghost sixteen times because a plan skipped this whole
		 * block. With a plan, those two still send it to the bench, judged on the
		 * heuristic score rather than the tree's value (endgameGuard, 24 Sep 2026).
		 */
		const guarded = planned && planned.kind === 'move' && this.cfg.endgameGuard;
		const own = guarded ? (ranked.find(r => r.n === best.n) || {}).score || 0 : best.score;
		if (!stallKeeps && (!planned || guarded) && this.cfg.switching && request.side.pokemon.length > 1 && !active.trapped && !active.maybeTrapped) {
			const myHpPct = (me.originalCurHP / me.maxHP()) * 100;
			const doomed = incoming >= myHpPct;
			// Stuck with a self-dropped attacking stat and nothing that kills: switching resets it.
			const bestData = PkmnDex.forGen(gen.num).moves.get(best.name);
			const drained = bestData && bestData.category !== 'Status' && this.droppedFor(bestData, me) <= -2 && own < 70;
			/*
			 * Crippled from outside: -2 or worse in the stat its best attack uses,
			 * whoever did it - Intimidate, Charm, Parting Shot, a Sticky Web'd Speed
			 * does not count. It went on clicking Earthquake at -4 Attack because only
			 * its own Draco Meteor-style drops were counted. Switching resets it.
			 */
			// Judged on its best attack, not on the chosen move: at -4 Attack a Swords
			// Dance only climbs back to -2, and leaving gets all four back at once.
			const topHit = ranked.filter(r => r.kind === 'move' && r.damage > 0).sort((a, b) => b.score - a.score)[0];
			const topData = topHit ? PkmnDex.forGen(gen.num).moves.get(topHit.name) : null;
			const usedStat = topData && topData.category === 'Special' ? 'spa' : 'atk';
			const crippled = !this.cfg.naive && this.cfg.cripple !== false && !!topData && ((me.boosts && me.boosts[usedStat]) || 0) <= -2 && own < 70;
			/*
			 * Walled: nothing we click does real damage and nothing we do is worth a
			 * turn, while we are not under pressure either - the Stockfish reviews'
			 * "no progress" games, where a Pokemon traded nothing with a Spiritomb for
			 * turns while the Clefable that beats it sat on the bench. Only once it has
			 * been in for a turn, so two walls do not swap back and forth.
			 */
			const inFor = state.turn - (state.mineCameIn || 0);
			const walled = !this.cfg.naive && this.cfg.stall !== false && inFor >= 2 && own < 25 &&
				(!topHit || topHit.damage < 15) && incoming < myHpPct * 0.5;
			// Choice-locked into a move that does little (Enamorus kept firing a resisted Mystical Fire into Garchomp).
			const choiceLocked = !this.cfg.naive && this.cfg.sanity !== false && legal.length === 1 && (active.moves || []).length > 1 &&
				/choice/i.test(String(entry.item || '')) && (!topHit || topHit.damage < 30) && own < 60;
			const losing = guarded ? (walled || choiceLocked) : drained || crippled || walled || choiceLocked || (incoming >= myHpPct * 0.5 && own < 55) ||
				// Outsped and dying, with nothing lethal of our own to fire back:
				// staying is a free knockout for them.
				(outsped && own < 100);
			if (losing) {
				const bench = request.side.pokemon
					.map((p, i) => ({ p, i: i + 1 }))
					.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
				let alt = null;
				let safest = null;
				for (const opt of bench) {
					const score = this.benchScore(gen, opt.p, state, field, request, true) + this.jitter();
					if (!alt || score > alt.score) alt = { score, i: opt.i };
					// And separately: what would this one actually take coming in?
					const takes = this.worstIncoming(gen, opt.p, state, field);
					if (safest === null || takes < safest.takes) safest = { takes, i: opt.i, score };
				}
				// Tempo: when this one is dying anyway, letting it fall is often
				// better than spending a switch-in to save it - but only if it is
				// the cheap end of the team. The mon that still wins the game is
				// worth a turn.
				/*
				 * Never sacrifice something when a switch-in walls the hit.
				 *
				 * This is the single most irritating thing a bot does, and it was
				 * a rule rather than an oversight: when the active was dying and
				 * happened to be the cheap end of the team, the margin was set to
				 * 70 - "let the spare one go" - and a Pokemon that resists the
				 * incoming attack sat on the bench watching.
				 *
				 * Sacrificing is a real play and the reasoning was not silly: a
				 * switch costs a turn, and spending one to save a Pokemon you were
				 * going to lose anyway is often worse than taking the free switch
				 * afterwards. But it is only right when coming in *costs*
				 * something. When the bench has something that takes a quarter of
				 * its health from the thing that is about to kill you, the switch
				 * is free, and there is no argument for the sacrifice at all.
				 *
				 * So it is checked before the value ranking gets a say: if the
				 * best available switch-in takes little enough to come in
				 * comfortably, and the active really is dying, go.
				 */
				const WALLS_IT = 35;      // per cent of its own health, coming in
				if (!guarded && doomed && safest && safest.takes <= WALLS_IT && own < 100) {
					return `switch ${safest.i}`;
				}

				let margin = this.cfg.switchMargin !== undefined ? this.cfg.switchMargin : 25;
				if (this.cfg.tempo) {
					const rank = this.valueRank(gen, entry, state, request);
					if (doomed && rank < 0.5) margin = 70;   // let the spare one go
					else if (doomed && rank >= 0.75) margin = 8;  // save the win condition
				}
				/*
				 * And what people actually do in a position like this one.
				 *
				 * The margin above is the bot's own idea of how much better the
				 * bench has to look; the playbook says how often good players
				 * leave in this *kind* of position, measured over eleven thousand
				 * real games, and moves the bar towards that. It changes the
				 * threshold and nothing else - which switch to make is still
				 * decided by the evaluation.
				 *
				 * Only for the rungs that are meant to be good. Easy does not
				 * switch at all and Normal is deliberately clumsy; teaching them
				 * to leave like a 2000-rated player would flatten the ladder,
				 * which is the opposite of the point.
				 */
				if (this.cfg.playbook) {
					margin = playbook.adjustSwitchMargin(this.formatId, this.situation(state, entry, foes), margin);
				}
				// Regenerator (and the signatures that include it) makes leaving a heal:
				// a worn-down one pivots out more readily.
				if (/^(regenerator|prescience|liquidbody)$/.test(String(entry.ability || entry.baseAbility || '').toLowerCase().replace(/[^a-z]/g, ''))) {
					const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
					const hp = cond ? +cond[1] / +cond[2] : 1;
					if (hp < 0.75) margin = Math.max(0, margin - 20);
				}
				// A crippled attacker gets its stat back by leaving, so the bench needs to
				// look only a little better than a hit it cannot land.
				if (crippled || drained) margin = Math.min(margin, 8);
				if (walled) margin = Math.min(margin, 15);
				if (choiceLocked) margin = Math.min(margin, 10);
				// A spent Dynamax is thrown away by switching (the replay's Heatran left on
				// its second turn of three): stay unless this turn kills it.
				const liveMe = state.mine && state.mine['abc'[index]];
				if (this.cfg.sanity !== false && liveMe && liveMe.dynamaxed && !doomed) margin += 45;
				if (alt && alt.score > own + margin) return `switch ${alt.i}`;
			}
		}

		// A Z-Move, when it is the difference (zChoice). Not with an Ultra Burst waiting: that goes first.
		const zed = !this.cfg.naive && this.cfg.zmove !== false && Array.isArray(active.canZMove) && !active.canUltraBurst
			? this.zChoice(gen, active, ranked, best, me, incoming, movesFirst) : null;
		if (zed) best = { ...best, n: zed.n, name: zed.name, target: zed.target };
		let choice = `move ${best.n}`;
		// In doubles a single-target move is rejected outright without a target
		// number, so take the requirement from the request rather than guessing
		// from how many foes happen to be standing.
		const chosen = legal.find(m => m.n === best.n);
		if (request.active.length > 1 && chosen && NEEDS_TARGET.has(chosen.target)) {
			const slot = best.target || (foes[0] && foes[0].slot === 'b' ? 2 : 1) || 1;
			choice += ` ${slot}`;
		}

		// Terastallizing is once per battle, so spend it only when this turn is
		// measurably better for it. Committing it on a turn we are knocked out
		// anyway - which is how a Gallade burned its Tera and fainted without
		// moving - is the single worst way to use it.
		if (zed) choice += ' zmove';
		else if (this.cfg.tera && active.canTerastallize && this.teraWorthIt(gen, active, entry, state, foes, field, best, incoming)) {
			choice += ' terastallize';
		}
		else if (active.canMegaEvo) choice += ' mega';
		else if (active.canUltraBurst) choice += ' ultra';
		else if (active.canDynamax && this.dynamaxWorthIt((me.originalCurHP / me.maxHP()) * 100, incoming, best, {
			attacks: ranked.filter(r => r.kind === 'move' && r.damage > 0).length,
			damage: (ranked.find(r => r.name === best.name) || {}).damage || 0,
			turn: state.turn || 99,
			/*
			 * Stall holds it (holdDynamax). Dynamax turns every status move into Max
			 * Guard, so a wall that Dynamaxes gives up its recovery, its status and its
			 * hazards for three turns: replay gen9rpou-10-tlvuiv's Dondozo (Rest, Sleep
			 * Talk) Dynamaxed at 86% into a Magearna that had just switched in, traded
			 * three Max Moves for 66% of its HP, left at 20% and never recovered. On
			 * stall it is for the moment it wins: living through a hit that would
			 * knock us out, or a Max Move that knocks them out.
			 */
			hold: !!(rules && rules.holdDynamax),
			maxDamage: ((ranked.find(r => r.name === best.name) || {}).damage || 0) * this.maxRatio(gen, best.name, true),
		})) {
			choice += ' dynamax';
		}
		return choice;
	}
}

module.exports = { BattleAI, TEMPO, STYLE_RULES };
