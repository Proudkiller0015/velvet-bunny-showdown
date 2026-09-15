'use strict';
/**
 * Balance Patch 1.
 *
 * The first big pass over the Pokemon nobody picks. Four parts, each read by the
 * file that already owns that kind of change, so nothing here needs a hook of
 * its own:
 *
 *   EVOLUTIONS  evolution levels that made no sense for what the Pokemon
 *               becomes (applied by buffs.js, read by the Discord bot too)
 *   MOVES       ten new moves for the underdogs, plus Regigigas's signature
 *               (merged into moves.js)
 *   ABILITIES   Regigigas's signature ability (merged into abilities.js)
 *   BUFFS       who gets what: moves, abilities, and the handful of existing
 *               moves each group should always have had (merged into buffs.js)
 *
 * The rule for the underdogs was PU, not OU: a Pokemon that had no reason to
 * be picked gets one reason, not three. The deliberately silly ones - Unown,
 * Luvdisc, Delibird, Spinda and friends - get a touch of flavour and stay silly.
 */

/*
 * Evolution levels.
 *
 * Game Freak put some Pokemon behind levels that belong to pseudo-legendaries:
 * a 510 base stat Braviary at 54, a 430 Magcargo at 38, a 410 Medicham at 37.
 * In a roleplay where a trainer's level is capped by badges, that is a Pokemon
 * nobody ever sees evolved. Pseudo-legendaries, Volcarona and the genuinely
 * strong (Amoonguss, Ferrothorn, Haxorus) keep their levels: waiting is the
 * price of what they become.
 *
 * Keyed by the Pokemon it evolves INTO, which is where Showdown keeps evoLevel.
 */
exports.EVOLUTIONS = {
	braviary: { from: 54, to: 40, why: '510 BST: a mid-game bird, not a pseudo-legendary' },
	braviaryhisui: { from: 54, to: 40, why: 'Same line as Braviary' },
	mandibuzz: { from: 54, to: 40, why: "Braviary's counterpart, same wait for no reason" },
	bisharp: { from: 52, to: 42, why: '490 BST middle stage; Kingambit still needs the Crest' },
	mienshao: { from: 50, to: 40, why: '510 BST fighter stuck behind a pseudo level' },
	klang: { from: 38, to: 32, why: 'A 440 BST middle stage at 38' },
	klinklang: { from: 49, to: 40, why: '520 BST, and no stronger for the wait' },
	dragalge: { from: 48, to: 38, why: '494 BST: a pseudo level for a RU Pokemon' },
	noivern: { from: 48, to: 38, why: '535 BST speedster, evolving late made it unusable in-story' },
	vanillish: { from: 35, to: 30, why: 'Brings the line forward' },
	vanilluxe: { from: 47, to: 40, why: 'An ice cream cone should not take longer than Garchomp' },
	vibrava: { from: 35, to: 30, why: 'Brings the line forward' },
	flygon: { from: 45, to: 38, why: '520 BST, not a pseudo-legendary despite the wait' },
	sealeo: { from: 32, to: 30, why: 'Brings the line forward' },
	walrein: { from: 44, to: 38, why: '530 BST with a slow, bulky role that needs levels early' },
	golurk: { from: 43, to: 35, why: '483 BST' },
	glalie: { from: 42, to: 35, why: '480 BST, weaker than Froslass, which evolves by stone' },
	beheeyem: { from: 42, to: 36, why: '485 BST' },
	palossand: { from: 42, to: 34, why: '480 BST' },
	exploud: { from: 40, to: 35, why: '490 BST' },
	wailord: { from: 40, to: 35, why: '500 BST, and most of it is HP' },
	drapion: { from: 40, to: 34, why: '500 BST' },
	jellicent: { from: 40, to: 34, why: '480 BST' },
	revavroom: { from: 40, to: 34, why: '500 BST' },
	scrafty: { from: 39, to: 32, why: '488 BST' },
	eelektrik: { from: 39, to: 30, why: 'A 405 BST middle stage, and Eelektross is only a stone away' },
	barbaracle: { from: 39, to: 34, why: '500 BST' },
	magcargo: { from: 38, to: 30, why: '430 BST at 38 was the worst ratio in the game' },
	purugly: { from: 38, to: 30, why: '452 BST' },
	medicham: { from: 37, to: 30, why: '410 BST' },
	banette: { from: 37, to: 30, why: '455 BST' },
	garbodor: { from: 36, to: 32, why: '474 BST' },
	pidgeot: { from: 36, to: 32, why: '479 BST' },
	swanna: { from: 35, to: 30, why: '473 BST' },
	dewgong: { from: 34, to: 30, why: '475 BST' },
	sawsbuck: { from: 34, to: 30, why: '475 BST' },
	seaking: { from: 33, to: 28, why: '450 BST' },
	cacturne: { from: 32, to: 28, why: '475 BST' },
	lumineon: { from: 31, to: 26, why: '460 BST' },
};

/*
 * The new moves.
 *
 * Numbers from -10 down; -1 to -9 are taken. `gen: 9` on every one, because a
 * negative number leaves the generation at 0 and the validator reads gen 0 as
 * "does not exist yet". `velvetShared` tells the signature-move table these
 * are handed out, not anybody's signature. `flavor` is the line the patch notes
 * and the builder lead with; `desc` is what it does.
 */
function drainIn(sunDrain, normalDrain) {
	return function (move, pokemon) {
		const sun = ['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather());
		move.drain = sun ? sunDrain : normalDrain;
	};
}

exports.MOVES = {
	hivefrenzy: {
		num: -10, gen: 9, name: "Hive Frenzy", type: "Bug", category: "Physical",
		basePower: 75, accuracy: 100, pp: 15, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 20, self: { boosts: { atk: 1 } } },
		target: "normal", contestType: "Tough", velvetShared: true,
		flavor: "The user whips itself into the fury of a whole hive and stings without mercy.",
		shortDesc: "20% chance to raise the user's Attack by 1.",
		desc: "The user whips itself into the fury of a whole hive. Has a 20% chance to raise the user's Attack by 1 stage.",
	},
	chrysalisveil: {
		num: -11, gen: 9, name: "Chrysalis Veil", type: "Bug", category: "Status",
		basePower: 0, accuracy: true, pp: 10, priority: 0,
		onHit(target, source, move) {
			const healed = this.heal(Math.ceil(target.baseMaxhp / 3), target, target);
			const boosted = this.boost({ spd: 1 }, target, target, move);
			if (!healed && !boosted) return this.NOT_FAIL;
		},
		flags: { snatch: 1, heal: 1, metronome: 1 },
		secondary: null, target: "self", contestType: "Beautiful", velvetShared: true,
		flavor: "The user wraps itself in shimmering silk, mending inside a cocoon that shrugs off attacks.",
		shortDesc: "Heals 1/3 of max HP and raises Sp. Def by 1.",
		desc: "The user wraps itself in shimmering silk. Restores 1/3 of its maximum HP, rounded up, and raises its Special Defense by 1 stage.",
	},
	hustleup: {
		num: -12, gen: 9, name: "Hustle Up", type: "Normal", category: "Status",
		basePower: 0, accuracy: true, pp: 20, priority: 0,
		boosts: { atk: 1, spe: 1 },
		flags: { snatch: 1, metronome: 1 },
		secondary: null, target: "self", contestType: "Cool", velvetShared: true,
		flavor: "Scrappy, stubborn and underestimated, the user rolls its shoulders and gets serious.",
		shortDesc: "Raises the user's Attack and Speed by 1.",
		desc: "Scrappy, stubborn and underestimated, the user gets serious. Raises its Attack and Speed by 1 stage each.",
	},
	carrionfeast: {
		num: -13, gen: 9, name: "Carrion Feast", type: "Dark", category: "Physical",
		basePower: 70, accuracy: 100, pp: 15, priority: 0,
		drain: [1, 2],
		flags: { contact: 1, protect: 1, mirror: 1, bite: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Tough", velvetShared: true,
		flavor: "The user tears into its prey like a scavenger that has not eaten in days.",
		shortDesc: "User recovers 50% of the damage dealt.",
		desc: "The user tears into the target like a starving scavenger. It recovers 1/2 of the HP lost by the target, rounded half up.",
	},
	sparkscamper: {
		num: -14, gen: 9, name: "Spark Scamper", type: "Electric", category: "Physical",
		basePower: 40, accuracy: 100, pp: 30, priority: 1,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Cute", velvetShared: true,
		flavor: "Faster than the eye can follow, the user darts in trailing sparks and is gone again.",
		shortDesc: "Usually goes first.",
		desc: "The user darts in trailing sparks before the target can react. Priority +1.",
	},
	undertow: {
		num: -15, gen: 9, name: "Undertow", type: "Water", category: "Special",
		basePower: 65, accuracy: 100, pp: 20, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 30, boosts: { spe: -1 } },
		target: "normal", contestType: "Beautiful", velvetShared: true,
		flavor: "A current that looks calm from the surface drags the target down and holds it there.",
		shortDesc: "30% chance to lower the target's Speed by 1.",
		desc: "A deceptively calm current drags at the target. Has a 30% chance to lower the target's Speed by 1 stage.",
	},
	solarnectar: {
		num: -16, gen: 9, name: "Solar Nectar", type: "Grass", category: "Special",
		basePower: 80, accuracy: 100, pp: 10, priority: 0,
		drain: [1, 4],
		onModifyMove: drainIn([1, 2], [1, 4]),
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Beautiful", velvetShared: true,
		flavor: "The user drinks in the sun's warmth and returns it as a burst of sweet, scalding nectar.",
		shortDesc: "Heals 25% of damage dealt, 50% in harsh sunlight.",
		desc: "The user bursts with sun-warmed nectar. It recovers 1/4 of the HP lost by the target, or 1/2 in harsh sunlight.",
	},
	craghammer: {
		num: -17, gen: 9, name: "Crag Hammer", type: "Rock", category: "Physical",
		basePower: 90, accuracy: 90, pp: 10, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 20, boosts: { def: -1 } },
		target: "normal", contestType: "Tough", velvetShared: true,
		flavor: "The user brings its whole stony weight down like a mountain falling on a single spot.",
		shortDesc: "20% chance to lower the target's Defense by 1.",
		desc: "The user brings its full stony weight down on the target. Has a 20% chance to lower the target's Defense by 1 stage.",
	},
	hypnowhirl: {
		num: -18, gen: 9, name: "Hypno Whirl", type: "Psychic", category: "Special",
		basePower: 75, accuracy: 100, pp: 15, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 20, volatileStatus: 'confusion' },
		target: "normal", contestType: "Clever", velvetShared: true,
		flavor: "Rings of psychic light spin until the target no longer knows which way is up.",
		shortDesc: "20% chance to confuse the target.",
		desc: "Spinning rings of psychic light disorient the target. Has a 20% chance to confuse it.",
	},
	shufflejab: {
		num: -19, gen: 9, name: "Shuffle Jab", type: "Fighting", category: "Physical",
		basePower: 60, accuracy: 100, pp: 15, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, punch: 1, metronome: 1 },
		secondary: { chance: 100, self: { boosts: { spe: 1 } } },
		target: "normal", contestType: "Cool", velvetShared: true,
		flavor: "Light on its feet, the user slips a jab in and is already dancing into the next one.",
		shortDesc: "100% chance to raise the user's Speed by 1.",
		desc: "The user slips in a quick jab and keeps moving. Has a 100% chance to raise the user's Speed by 1 stage.",
	},

	/*
	 * Regigigas's signature.
	 *
	 * The Pokemon that towed the continents into place, finally allowed to act
	 * like it. Not an OHKO and not unconditional: 110 power, 95% accurate, five
	 * PP. What makes it frightening is what it refuses to respect - Protect and
	 * Detect do nothing, and Reflect, Light Screen and Aurora Veil shatter before
	 * the hit lands. Colossus Unbound already stops abilities softening it, so
	 * there is no wall that stands up to it on principle; only one that survives
	 * it on numbers.
	 *
	 * `nosketch`, and Mew does not get it: this one is Regigigas's.
	 */
	continentalheave: {
		num: -20, gen: 9, name: "Continental Heave", type: "Normal", category: "Physical",
		basePower: 110, accuracy: 95, pp: 5, priority: 0,
		breaksProtect: true,
		onTryHit(target) {
			if (!target.runImmunity('Normal')) return;
			let shattered = false;
			for (const screen of ['reflect', 'lightscreen', 'auroraveil']) {
				if (target.side.removeSideCondition(screen)) shattered = true;
			}
			if (shattered) this.add('-message', `The ground itself heaves, and ${target.side.name}'s screens shatter!`);
		},
		flags: { contact: 1, mirror: 1, metronome: 1, nosketch: 1 },
		secondary: null, target: "normal", contestType: "Tough",
		flavor: "The strength that once dragged continents across the sea, brought down on a single foe.",
		shortDesc: "Ignores Protect. Breaks screens. Regigigas's signature move.",
		desc: "The strength that dragged continents across the sea. Hits through Protect, Detect and similar moves, and destroys Reflect, Light Screen and Aurora Veil on the target's side before dealing damage.",
	},
};

/*
 * Colossus Unbound.
 *
 * Slow Start was a joke told at a legend's expense for eighteen years: 670 base
 * stats that spend their first five turns at half strength. This is the ability
 * the Pokemon deserved. Mold Breaker, so nothing's ability softens its blows;
 * Clear Body, so nothing talks it down; and 1.2x Attack while above half HP -
 * enormous, but finite, and gone the moment it is worn down.
 *
 * Ubers, and moved there in tiering.js.
 */
exports.ABILITIES = {
	colossusunbound: {
		name: "Colossus Unbound",
		onStart(pokemon) {
			this.add('-ability', pokemon, 'Colossus Unbound');
			this.add('-message', `${pokemon.name} has awoken, and it is unbound!`);
		},
		onModifyMove(move) {
			move.ignoreAbility = true;
		},
		onTryBoost(boost, target, source, effect) {
			if (source && target === source) return;
			let refused = false;
			for (const stat in boost) {
				if (boost[stat] < 0) {
					delete boost[stat];
					refused = true;
				}
			}
			if (refused && !effect.secondaries && effect.id !== 'octolock') {
				this.add('-fail', target, 'unboost', '[from] ability: Colossus Unbound', `[of] ${target}`);
			}
		},
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (pokemon.hp > pokemon.maxhp / 2) {
				this.debug('Colossus Unbound boost');
				return this.chainModify([4915, 4096]);
			}
		},
		flags: { breakable: 1 },
		rating: 4.5,
		num: -7,
		gen: 9,
		flavor: "The titan that moved the continents, no longer waking slowly.",
		shortDesc: "Mold Breaker + Clear Body. 1.2x Attack while above 50% HP.",
		desc: "This Pokemon's moves and their effects ignore the Abilities of other Pokemon, other Pokemon cannot lower its stat stages, and its Attack is multiplied by 1.2 while its HP is above half.",
	},
};

/*
 * Who gets what.
 *
 * Each group gets its new move and a short list of standard moves its kind
 * received everywhere else. Moves a Pokemon (or its baby) already learns are
 * skipped by buffs.js, so these lists only say what should be true, not what
 * was missing. `small` marks the joke Pokemon: the new move, nothing more.
 */
const GROUPS = {
	bugPhysical: {
		moves: ['hivefrenzy', 'leechlife', 'uturn', 'knockoff', 'swordsdance'],
		species: ['ariados', 'beedrill', 'ledian', 'mothim', 'volbeat', 'spidops', 'vespiquen', 'parasect'],
	},
	bugSpecial: {
		moves: ['chrysalisveil', 'bugbuzz', 'uturn', 'energyball'],
		species: ['butterfree', 'beautifly', 'dustox', 'masquerain', 'vivillon', 'wormadam', 'wormadamsandy', 'wormadamtrash', 'illumise', 'rabsca'],
	},
	normal: {
		moves: ['hustleup', 'uturn', 'knockoff', 'suckerpunch', 'bodyslam', 'facade'],
		species: ['furret', 'raticate', 'raticatealola', 'linoone', 'watchog', 'fearow', 'dodrio', 'swellow', 'persian', 'purugly', 'zangoose', 'delcatty', 'bibarel', 'gumshoos', 'squawkabilly', 'granbull'],
	},
	dark: {
		moves: ['carrionfeast', 'knockoff', 'suckerpunch', 'crunch'],
		species: ['mightyena', 'liepard', 'thievul', 'persianalola', 'raticatealola', 'cacturne', 'sharpedo', 'mawile', 'banette', 'seviper', 'arbok', 'sableye', 'absol'],
	},
	electric: {
		moves: ['sparkscamper', 'voltswitch', 'nuzzle'],
		species: ['pachirisu', 'plusle', 'minun', 'emolga', 'dedenne', 'togedemaru', 'manectric', 'stunfisk', 'pincurchin'],
	},
	water: {
		moves: ['undertow', 'scald', 'flipturn'],
		species: ['lumineon', 'seaking', 'whiscash', 'corsola', 'lanturn', 'dewgong', 'swanna', 'wugtrio', 'basculin'],
	},
	grass: {
		moves: ['solarnectar', 'gigadrain', 'synthesis', 'leechseed'],
		species: ['cherrim', 'maractus', 'jumpluff', 'tropius', 'carnivine', 'shiinotic', 'eldegoss', 'sawsbuck', 'parasect', 'wormadam', 'cacturne'],
	},
	rock: {
		moves: ['craghammer', 'stealthrock', 'stoneedge', 'rockslide'],
		species: ['sudowoodo', 'magcargo', 'solrock', 'klawf', 'stonjourner', 'sandslash', 'marowak', 'dugtrio'],
	},
	psychic: {
		moves: ['hypnowhirl', 'psyshock', 'calmmind', 'futuresight'],
		species: ['chimecho', 'grumpig', 'meowstic', 'meowsticf', 'swoobat', 'lunatone', 'mrmime', 'jynx', 'indeedee', 'indeedeef', 'rabsca'],
	},
	fighting: {
		moves: ['shufflejab', 'drainpunch', 'machpunch', 'bulkup', 'knockoff'],
		species: ['hitmonlee', 'hitmonchan', 'hitmontop', 'throh', 'sawk', 'hariyama', 'falinks', 'granbull'],
	},
};

/*
 * The ones that are meant to be bad, and should stay a bit bad.
 *
 * Unown, Luvdisc, Delibird and the rest are jokes Game Freak told on purpose,
 * and a joke explained to PU is not funny any more. Each gets one new move that
 * suits it - a touch of flavour, not a promotion.
 */
const SMALL = {
	unown: ['hypnowhirl'],
	luvdisc: ['undertow'],
	wishiwashi: ['undertow'],
	pyukumuku: ['undertow'],
	delibird: ['hustleup'],
	farfetchd: ['hustleup'],
	spinda: ['shufflejab'],
	kricketune: ['hivefrenzy'],
	sunflora: ['solarnectar'],
};

/*
 * Abilities, only where the ability was the problem.
 *
 * Existing abilities of the kind a PU Pokemon can build around, never the
 * game-defining ones. Each sits beside what the Pokemon already had.
 */
const ABILITY_GRANTS = {
	plusle: 'Motor Drive',
	minun: 'Motor Drive',
	cherrim: 'Chlorophyll',
	wormadam: 'Filter',
	wormadamsandy: 'Filter',
	wormadamtrash: 'Filter',
	beautifly: 'Tinted Lens',
	furret: 'Scrappy',
	dodrio: 'Reckless',
	swanna: 'Swift Swim',
	whiscash: 'Water Absorb',
	stunfisk: 'Volt Absorb',
	magcargo: 'Solid Rock',
	banette: 'Prankster',
	seviper: 'Intimidate',
	stonjourner: 'Sturdy',
};

/**
 * Build the buff table: finals first (so each records its own additions before
 * a pre-evolution claims them), then their pre-evolutions with the same new
 * move and ability so a line is one idea, then Mew, then Regigigas.
 */
exports.buildBuffs = (Pokedex) => {
	const out = {};
	const add = (id, moves, abilities) => {
		const entry = out[id] || (out[id] = { moves: [], abilities: [] });
		for (const m of moves) if (!entry.moves.includes(m)) entry.moves.push(m);
		for (const a of abilities) if (!entry.abilities.includes(a)) entry.abilities.push(a);
	};
	for (const group of Object.values(GROUPS)) {
		for (const id of group.species) add(id, group.moves, ABILITY_GRANTS[id] ? [ABILITY_GRANTS[id]] : []);
	}
	for (const [id, moves] of Object.entries(SMALL)) add(id, moves, []);
	for (const [id, ability] of Object.entries(ABILITY_GRANTS)) add(id, [], [ability]);

	// Pre-evolutions: the new move (not the coverage) and the ability.
	const newMove = m => exports.MOVES[m] && m !== 'continentalheave';
	for (const id of Object.keys(out)) {
		let species = Pokedex[id];
		const seen = new Set([id]);
		while (species && species.prevo) {
			const pre = String(species.prevo).toLowerCase().replace(/[^a-z0-9]+/g, '');
			if (seen.has(pre) || !Pokedex[pre]) break;
			seen.add(pre);
			add(pre, out[id].moves.filter(newMove), out[id].abilities.slice());
			species = Pokedex[pre];
		}
	}

	// Mew learns every machine move there is, and these are handed out like machines.
	add('mew', Object.keys(exports.MOVES).filter(newMove), []);

	out.regigigas = { moves: ['continentalheave'], abilities: ['Colossus Unbound'], sole: true };
	return out;
};

exports.GROUPS = GROUPS;
exports.SMALL = SMALL;
exports.ABILITY_GRANTS = ABILITY_GRANTS;
