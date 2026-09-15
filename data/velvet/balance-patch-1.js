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
 * nobody ever sees evolved. The strong keep a late level, but never past the
 * caps at the bottom of this table: 50 for a final stage, 40 for a middle one.
 *
 * Keyed by the Pokemon it evolves INTO, which is where Showdown keeps evoLevel.
 */
exports.EVOLUTIONS = {
	braviary: { from: 54, to: 40, why: '510 BST: a mid-game bird, not a pseudo-legendary' },
	braviaryhisui: { from: 54, to: 40, why: 'Same line as Braviary' },
	mandibuzz: { from: 54, to: 40, why: "Braviary's counterpart, same wait for no reason" },
	bisharp: { from: 52, to: 40, why: '490 BST middle stage (cap 40); Kingambit still needs the Crest' },
	mienshao: { from: 50, to: 40, why: '510 BST fighter stuck behind a pseudo level' },
	klang: { from: 38, to: 30, why: 'A 440 BST middle stage at 38; ten levels as Klang before Klinklang at 40' },
	klinklang: { from: 49, to: 40, why: '520 BST, and no stronger for the wait' },
	dragalge: { from: 48, to: 38, why: '494 BST: a pseudo level for a RU Pokemon' },
	noivern: { from: 48, to: 38, why: '535 BST speedster, evolving late made it unusable in-story' },
	vanillish: { from: 35, to: 30, why: 'Brings the line forward' },
	vanilluxe: { from: 47, to: 40, why: 'An ice cream cone should not take longer than Garchomp' },
	vibrava: { from: 35, to: 28, why: 'Brings the line forward: ten levels as Vibrava before Flygon at 38' },
	flygon: { from: 45, to: 38, why: '520 BST, not a pseudo-legendary despite the wait' },
	sealeo: { from: 32, to: 28, why: 'Brings the line forward: ten levels as Sealeo before Walrein at 38' },
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

	/*
	 * Two-stage lines that evolved late. One evolution, so the whole wait was
	 * spent as the unevolved form: brought to 32-36 by how strong the final is.
	 * Palafin (Zero to Hero) keeps its 38. Regional forms move with their line.
	 */
	rapidash: { from: 40, to: 34, why: '500 BST two-stage line' },
	rapidashgalar: { from: 40, to: 34, why: 'Same line as Rapidash' },
	muk: { from: 38, to: 34, why: '500 BST two-stage line' },
	mukalola: { from: 38, to: 34, why: 'Same line as Muk' },
	omastar: { from: 40, to: 34, why: '495 BST fossil' },
	kabutops: { from: 40, to: 34, why: '495 BST fossil' },
	cradily: { from: 40, to: 34, why: '495 BST fossil' },
	armaldo: { from: 40, to: 34, why: '495 BST fossil' },
	carracosta: { from: 37, to: 33, why: '495 BST fossil' },
	archeops: { from: 37, to: 36, why: '567 BST: the strongest here keeps a late level' },
	tyrantrum: { from: 39, to: 36, why: '521 BST fossil' },
	aurorus: { from: 39, to: 36, why: '521 BST fossil' },
	cursola: { from: 38, to: 34, why: '510 BST, but frail' },
	claydol: { from: 36, to: 32, why: '500 BST two-stage line' },
	toxicroak: { from: 37, to: 32, why: '490 BST two-stage line' },
	abomasnow: { from: 40, to: 34, why: '494 BST two-stage line' },
	amoonguss: { from: 39, to: 34, why: 'Strong in battle through its utility, not its 464 BST' },
	galvantula: { from: 36, to: 32, why: '472 BST two-stage line' },
	ferrothorn: { from: 40, to: 36, why: 'A defensive staple: the later end of the range' },
	beartic: { from: 37, to: 32, why: '505 BST two-stage line' },
	clawitzer: { from: 37, to: 32, why: '500 BST two-stage line' },
	toxapex: { from: 38, to: 36, why: 'A defensive staple: the later end of the range' },
	sandaconda: { from: 36, to: 32, why: '510 BST two-stage line' },

	/*
	 * The caps. No evolution into a final stage after level 50 - pseudo-
	 * legendaries included - and no middle stage after 40, so nobody spends the
	 * back half of the game waiting on a Pokemon that has not become itself.
	 */
	dragonite: { from: 55, to: 50, why: 'Cap: no final evolution after 50' },
	tyranitar: { from: 55, to: 50, why: 'Cap: no final evolution after 50' },
	zweilous: { from: 50, to: 40, why: 'Cap: no middle stage after 40' },
	hydreigon: { from: 64, to: 50, why: 'Cap: the latest evolution in the game, now 50' },
	volcarona: { from: 59, to: 50, why: 'Cap: no final evolution after 50' },
	drakloak: { from: 50, to: 40, why: 'Cap: no middle stage after 40' },
	dragapult: { from: 60, to: 50, why: 'Cap: no final evolution after 50' },
	baxcalibur: { from: 54, to: 50, why: 'Cap: no final evolution after 50' },
	solgaleo: { from: 53, to: 50, why: 'Cap: no final evolution after 50' },
	lunala: { from: 53, to: 50, why: 'Cap: no final evolution after 50' },
	cosmoem: { from: 43, to: 40, why: 'Cap: no middle stage after 40' },
	rhydon: { from: 42, to: 40, why: 'Cap: no middle stage after 40' },
	lampent: { from: 41, to: 24, why: 'Early-game friendly: Litwick is met early' },

	// Stone or level: the Dusk Stone still works any time, and Lampent now also evolves by itself at 36.
	chandelure: { from: 'Dusk Stone', to: 36, why: 'Now also evolves at level 36; the Dusk Stone still works' },

	/*
	 * The same case as Chandelure: a Pokemon met early whose only way forward
	 * was a stone nobody has mid-RP. Not Aegislash (strong enough that the Dusk
	 * Stone is a fair gate), not Eevee (the stones are the point) and no trade
	 * evolutions (the bot already handles trades and the Link Cable).
	 */
	mismagius: { from: 'Dusk Stone', to: 33, why: 'Now also evolves at level 33; the Dusk Stone still works' },
	honchkrow: { from: 'Dusk Stone', to: 33, why: 'Now also evolves at level 33; the Dusk Stone still works' },
	cinccino: { from: 'Shiny Stone', to: 32, why: 'Now also evolves at level 32; the Shiny Stone still works' },
	ludicolo: { from: 'Water Stone', to: 36, why: 'Now also evolves at level 36; the Water Stone still works' },
	heliolisk: { from: 'Sun Stone', to: 32, why: 'Now also evolves at level 32; the Sun Stone still works' },
	scovillain: { from: 'Fire Stone', to: 30, why: 'Now also evolves at level 30; the Fire Stone still works' },
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
		secondary: { chance: 50, self: { boosts: { atk: 1 } } },
		target: "normal", contestType: "Tough", velvetShared: true,
		flavor: "The user whips itself into the fury of a whole hive and stings without mercy.",
		shortDesc: "50% chance to raise the user's Attack by 1.",
		desc: "The user whips itself into the fury of a whole hive. Has a 50% chance to raise the user's Attack by 1 stage.",
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
		basePower: 85, accuracy: 100, pp: 20, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 50, boosts: { spe: -1 } },
		target: "normal", contestType: "Beautiful", velvetShared: true,
		flavor: "A current that looks calm from the surface drags the target down and holds it there.",
		shortDesc: "50% chance to lower the target's Speed by 1.",
		desc: "A deceptively calm current drags at the target. Has a 50% chance to lower the target's Speed by 1 stage.",
	},
	solarnectar: {
		num: -16, gen: 9, name: "Solar Nectar", type: "Grass", category: "Special",
		basePower: 80, accuracy: 100, pp: 10, priority: 0,
		drain: [1, 4],
		onModifyMove: drainIn([1, 2], [1, 4]),
		// 135 in harsh sunlight. The user's effective weather, so Air Lock and Utility Umbrella turn it off.
		basePowerCallback(pokemon, target, move) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) return 135;
			return move.basePower;
		},
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Beautiful", velvetShared: true,
		flavor: "The user drinks in the sun's warmth and returns it as a burst of sweet, scalding nectar.",
		shortDesc: "135 power and heals 50% of damage in sun; else 80 power, heals 25%.",
		desc: "The user bursts with sun-warmed nectar. It recovers 1/4 of the HP lost by the target. In harsh sunlight its power rises to 135 and it recovers 1/2 of the HP lost instead.",
	},
	craghammer: {
		num: -17, gen: 9, name: "Crag Hammer", type: "Rock", category: "Physical",
		// The first strong Rock attack that never misses: Liquidation's shape, for Rock.
		basePower: 90, accuracy: 100, pp: 10, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 20, boosts: { def: -1 } },
		target: "normal", contestType: "Tough", velvetShared: true,
		flavor: "The user brings its whole stony weight down like a mountain falling on a single spot.",
		shortDesc: "100% accurate. 20% chance to lower the target's Defense by 1.",
		desc: "Never misses unless evasion or accuracy drops say otherwise. The user brings its full stony weight down on the target. Has a 20% chance to lower the target's Defense by 1 stage.",
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
	/*
	 * Articuno's signature: the storm it has always been said to bring.
	 *
	 * A spread Ice move that slows everything it touches, and never misses in snow
	 * (like Blizzard). 85 power is Ice Beam's neighbourhood, not Blizzard's.
	 */
	aurorasquall: {
		num: -21, gen: 9, name: "Aurora Squall", type: "Ice", category: "Special",
		basePower: 85, accuracy: 95, pp: 10, priority: 0,
		onModifyMove(move, pokemon) {
			if (['snowscape', 'hail'].includes(pokemon.effectiveWeather())) move.accuracy = true;
		},
		flags: { protect: 1, mirror: 1, wind: 1, metronome: 1, nosketch: 1 },
		secondary: { chance: 30, boosts: { spe: -1 } },
		target: "allAdjacentFoes", contestType: "Beautiful",
		flavor: "Curtains of polar light come down as a gale that freezes the air in its path.",
		shortDesc: "Hits all foes. 30% chance to lower Speed. Can't miss in snow. Articuno's signature.",
		desc: "Curtains of polar light come down as a freezing gale. Hits all adjacent foes, with a 30% chance to lower each target's Speed by 1 stage. This move does not check accuracy in snow.",
	},
	/*
	 * The lake trio: knowledge, emotion and willpower. Each signature is a
	 * 110 power Psychic attack with an effect that always happens, paid for with
	 * 90-95% accuracy and 5-8 PP.
	 */
	// Uxie's: knowledge taken back. Always resets the target's stat changes, and
	// clears the user's own drops too.
	memorywipe: {
		num: -22, gen: 9, name: "Memory Wipe", type: "Psychic", category: "Special",
		basePower: 110, accuracy: 95, pp: 8, priority: 0,
		onHit(target, source) {
			target.clearBoosts();
			this.add('-clearboost', target);
			let dropped = false;
			for (const stat in source.boosts) {
				if (source.boosts[stat] < 0) { source.boosts[stat] = 0; dropped = true; }
			}
			if (dropped) this.add('-clearnegativeboost', source, '[silent]');
		},
		flags: { protect: 1, mirror: 1, metronome: 1, nosketch: 1 },
		secondary: null, target: "normal", contestType: "Clever",
		flavor: "Uxie opens its eyes, and whatever the target had learned this battle is gone.",
		shortDesc: "Always resets the target's stat changes and the user's stat drops. Uxie's signature.",
		desc: "Uxie opens its eyes and the target forgets. After dealing damage, all of the target's stat stages are reset to 0, and any of the user's lowered stat stages are reset to 0.",
	},
	// Mesprit's: shared feeling. Heals the user for all of the damage it deals.
	soulresonance: {
		num: -23, gen: 9, name: "Soul Resonance", type: "Psychic", category: "Special",
		basePower: 110, accuracy: 90, pp: 5, priority: 0,
		drain: [1, 1],
		flags: { protect: 1, mirror: 1, heal: 1, metronome: 1, nosketch: 1 },
		secondary: null, target: "normal", contestType: "Beautiful",
		flavor: "Mesprit feels the target's pain as its own, and takes the target's strength to bear it.",
		shortDesc: "User recovers 100% of the damage dealt. Mesprit's signature.",
		desc: "Mesprit feels the target's pain as its own. The user recovers HP equal to all of the HP lost by the target.",
	},
	// Azelf's: willpower made into a blow. Physical or special, whichever is
	// stronger, and it always ignores the target's defensive boosts and evasion.
	resolutestrike: {
		num: -24, gen: 9, name: "Resolute Strike", type: "Psychic", category: "Special",
		basePower: 110, accuracy: 95, pp: 8, priority: 0,
		ignoreDefensive: true,
		ignoreEvasion: true,
		onModifyMove(move, pokemon) {
			if (pokemon.getStat('atk', false, true) > pokemon.getStat('spa', false, true)) move.category = 'Physical';
		},
		flags: { protect: 1, mirror: 1, metronome: 1, nosketch: 1 },
		secondary: null,
		target: "normal", contestType: "Cool",
		flavor: "Azelf's will alone is enough to hit, and no wall it can see will stop it.",
		shortDesc: "Uses the higher attacking stat. Always ignores the target's stat boosts. Azelf's signature.",
		desc: "Azelf's willpower becomes a blow. Uses whichever of the user's Attack or Special Attack is higher, before boosts, and always ignores the target's Defense, Special Defense and evasion boosts.",
	},
	/*
	 * Voltaic Lance: the reliable physical Electric attack the type never had.
	 * Wild Charge hurts its user and Thunder Punch is 75; this is 100 power, never
	 * misses, and doesn't touch the target, so Rough Skin and Static can't punish it.
	 */
	voltaiclance: {
		num: -25, gen: 9, name: "Voltaic Lance", type: "Electric", category: "Physical",
		basePower: 100, accuracy: 100, pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Cool", velvetShared: true,
		flavor: "The user gathers every spark it has into a spear of lightning and hurls it.",
		shortDesc: "100% accurate, no contact. No drawback.",
		desc: "The user hurls a spear of lightning. Does not make contact.",
	},
	/*
	 * Rime Cleaver: Ice's third strong physical attack, and the reliable one.
	 * Icicle Crash is 85 at 90% and Triple Axel rolls its accuracy three times;
	 * this is 100 power that never misses, with no drawback.
	 */
	rimecleaver: {
		num: -26, gen: 9, name: "Rime Cleaver", type: "Ice", category: "Physical",
		basePower: 100, accuracy: 100, pp: 10, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, slicing: 1, metronome: 1 },
		secondary: null, target: "normal", contestType: "Cool", velvetShared: true,
		flavor: "A blade of frost as old as the glacier it was broken from comes down in one clean stroke.",
		shortDesc: "100% accurate. No drawback.",
		desc: "The user brings down a blade of ancient frost in one clean, slicing stroke.",
	},
	/*
	 * Oxidize: Poison's Freeze-Dry. Steel is normally immune to Poison; this
	 * rusts it instead, for super-effective damage. 70 power, 100%, and a 10%
	 * chance to confuse. It never poisons.
	 */
	oxidize: {
		num: -27, gen: 9, name: "Oxidize", type: "Poison", category: "Special",
		basePower: 70, accuracy: 100, pp: 20, priority: 0,
		ignoreImmunity: { Poison: true },
		onEffectiveness(typeMod, target, type) {
			if (type === 'Steel') return 1;
		},
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 10, volatileStatus: 'confusion' },
		target: "normal", contestType: "Clever", velvetShared: true,
		flavor: "A bitter, eating mist that turns even steel to flaking rust.",
		shortDesc: "Super effective on Steel. 10% chance to confuse. Never poisons.",
		desc: "A corrosive mist. This move's type effectiveness against Steel is changed to be super effective no matter what this move's type is, and Steel-types are not immune to it. Has a 10% chance to confuse the target. It cannot poison.",
	},
	/*
	 * Gleamstalk - Luxray's. It locks eyes with its prey through any wall, and
	 * the prey freezes: the target is paralyzed (through a Substitute), Luxray's
	 * Speed rises by 2 whether or not the paralysis takes, and its next Electric
	 * move is charged to double power, as Charge does. It never misses. Dark-type,
	 * so it paralyzes Ground types and, with Prankster, fails on Dark ones - but it
	 * is still lightning: Volt Absorb, Lightning Rod, Motor Drive and the like take
	 * it as they would an Electric move, and then Luxray gets nothing.
	 */
	gleamstalk: {
		num: -28, gen: 9, name: "Gleamstalk", type: "Dark", category: "Status",
		basePower: 0, accuracy: true, pp: 10, priority: 0,
		flags: { protect: 1, reflectable: 1, mirror: 1, bypasssub: 1, metronome: 1, nosketch: 1 },
		onHit(target, source, move) {
			target.trySetStatus('par', source, move);
			this.boost({ spe: 2 }, source, source, move);
			source.addVolatile('charge');
		},
		secondary: null,
		target: "normal", contestType: "Cool",
		flavor: "Luxray's eyes find its prey through the wall, and the prey forgets how to run.",
		shortDesc: "Paralyzes the target. User: +2 Speed, next Electric move 2x power.",
		desc: "Never misses and hits through Substitute. Paralyzes the target, Ground types included; abilities that absorb Electric moves (Volt Absorb, Lightning Rod, Motor Drive and the like) absorb it instead, and then the user gains nothing. Whether or not the paralysis takes, the user's Speed rises by 2 stages and its next Electric-type attack has doubled power, as with Charge.",
	},
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
/** The lake trio's shared gift: their Psychic moves hit Dark types. */
function psychicHitsDark(move) {
	if (move.type !== 'Psychic' || move.ignoreImmunity === true) return;
	if (!move.ignoreImmunity) move.ignoreImmunity = {};
	move.ignoreImmunity['Psychic'] = true;
}

exports.ABILITIES = {
	/*
	 * Mudflat Ambush - Stunfisk's, both formes.
	 *
	 * A flat fish buried in the mud, waiting to be stepped on. Three abilities'
	 * worth of trap: anything that touches it takes 1/8 of its HP (Rough Skin)
	 * and may be paralysed (Static, 30%), and Electric moves are soaked up to heal
	 * a quarter (Volt Absorb). Strong for a slow, bulky PU Pokemon; none of it
	 * helps it hit harder.
	 */
	mudflatambush: {
		name: "Mudflat Ambush",
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Electric') {
				if (!this.heal(target.baseMaxhp / 4)) this.add('-immune', target, '[from] ability: Mudflat Ambush');
				return null;
			}
		},
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (!this.checkMoveMakesContact(move, source, target, true)) return;
			this.damage(source.baseMaxhp / 8, source, target);
			if (this.randomChance(3, 10)) source.trySetStatus('par', target);
		},
		flags: { breakable: 1 },
		rating: 3.5,
		num: -8,
		gen: 9,
		flavor: "Step on a Stunfisk and you'll find out why it's smiling.",
		shortDesc: "Contact attackers lose 1/8 HP, 30% paralysis. Electric moves heal it 1/4.",
		desc: "Pokemon making contact with this Pokemon lose 1/8 of their maximum HP, rounded down, and have a 30% chance to be paralyzed. This Pokemon is immune to Electric-type moves and restores 1/4 of its maximum HP, rounded down, when hit by one.",
	},
	/*
	 * Polar Mantle - Articuno's.
	 *
	 * Ice/Flying's whole problem is Rock: a quarter of its HP to Stealth Rock on
	 * every entry, and double damage from every Rock move. The mantle halves both,
	 * and it brings the snow with it (Snow Warning), which raises an Ice-type's
	 * Defense and makes Blizzard and Aurora Squall sure hits.
	 */
	polarmantle: {
		name: "Polar Mantle",
		onStart(source) {
			this.field.setWeather('snowscape');
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.type === 'Rock') {
				this.debug('Polar Mantle halves Rock');
				return this.chainModify(0.5);
			}
		},
		onDamage(damage, target, source, effect) {
			if (effect && effect.id === 'stealthrock') return Math.max(1, Math.floor(damage / 2));
		},
		flags: { breakable: 1 },
		rating: 4,
		num: -9,
		gen: 9,
		flavor: "The legendary bird of ice arrives wrapped in the blizzard it was named for.",
		shortDesc: "Sets snow on entry. Takes half damage from Rock moves and Stealth Rock.",
		desc: "On switch-in, this Pokemon summons snow. It takes half damage from Rock-type moves and from Stealth Rock.",
	},
	/*
	 * Permafrost Core - Regice's.
	 *
	 * Regice's 200 Special Defense was always undone by being weak to Fire,
	 * Fighting, Rock and Steel. The core is cold enough that Fire and Fighting
	 * do half, and nothing can burn or freeze it. Two of four weaknesses,
	 * softened, on a special wall: bulk, not power.
	 */
	permafrostcore: {
		name: "Permafrost Core",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.type === 'Fire' || move.type === 'Fighting') {
				this.debug('Permafrost Core halves');
				return this.chainModify(0.5);
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== 'brn' && status.id !== 'frz') return;
			if (effect && effect.status) this.add('-immune', target, '[from] ability: Permafrost Core');
			return false;
		},
		flags: { breakable: 1 },
		rating: 3.5,
		num: -10,
		gen: 9,
		flavor: "Ice that has not melted in ten thousand years does not start now.",
		shortDesc: "Takes half damage from Fire and Fighting moves. Can't be burned or frozen.",
		desc: "This Pokemon takes half damage from Fire-type and Fighting-type moves, and cannot be burned or frozen.",
	},
	/*
	 * Mind Keeper - Uxie's. Knowledge as armour: it ignores every foe's stat
	 * changes (Unaware) and takes 3/4 damage from super-effective hits (Filter).
	 */
	mindkeeper: {
		name: "Mind Keeper",
		onModifyMovePriority: -5,
		onModifyMove: psychicHitsDark,
		onAnyModifyBoost(boosts, pokemon) {
			const user = this.effectState.target;
			if (user === pokemon) return;
			if (user === this.activePokemon && pokemon === this.activeTarget) {
				boosts['def'] = 0; boosts['spd'] = 0; boosts['evasion'] = 0;
			}
			if (pokemon === this.activePokemon && user === this.activeTarget) {
				boosts['atk'] = 0; boosts['def'] = 0; boosts['spa'] = 0; boosts['accuracy'] = 0;
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) return this.chainModify(0.75);
		},
		flags: { breakable: 1 },
		rating: 4,
		num: -11,
		gen: 9,
		flavor: "It already knows every trick you were about to try.",
		shortDesc: "Ignores foes' stat changes. 0.75x super-effective damage. Psychic moves hit Dark types.",
		desc: "This Pokemon ignores other Pokemon's stat stages when taking or doing damage, receives 3/4 damage from supereffective attacks, and its Psychic-type moves can hit Dark-type Pokemon.",
	},
	/*
	 * Heartfelt Resolve - Mesprit's. Every time a super-effective hit lands on
	 * it, the hurt becomes power: +1 Special Attack. Repeatable, but only on the
	 * hits that were meant to finish it.
	 */
	heartfeltresolve: {
		name: "Heartfelt Resolve",
		onModifyMovePriority: -5,
		onModifyMove: psychicHitsDark,
		onDamagingHit(damage, target, source, move) {
			if (target.hp && target.getMoveHitData(move).typeMod > 0) this.boost({ spa: 1 }, target, target);
		},
		flags: {},
		rating: 3.5,
		num: -12,
		gen: 9,
		flavor: "Hurt it where it's weakest and it only feels more.",
		shortDesc: "Super-effective hit taken: +1 Sp. Atk. Psychic moves hit Dark types.",
		desc: "When this Pokemon is damaged by a super-effective attack and is not knocked out, its Special Attack is raised by 1 stage. Its Psychic-type moves can hit Dark-type Pokemon.",
	},
	/*
	 * Unbending Will - Azelf's. Willpower that does not accept "not very
	 * effective": resisted hits deal double (Tinted Lens), and its Psychic
	 * moves hit Dark types.
	 */
	unbendingwill: {
		name: "Unbending Will",
		onModifyMovePriority: -5,
		onModifyMove: psychicHitsDark,
		onModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod < 0) return this.chainModify(2);
		},
		flags: {},
		rating: 4,
		num: -13,
		gen: 9,
		flavor: "Azelf does not accept that anything is out of reach.",
		shortDesc: "Not-very-effective hits deal double. Psychic moves hit Dark types.",
		desc: "This Pokemon's attacks that are not very effective on a target deal double damage, and its Psychic-type moves can hit Dark-type Pokemon.",
	},
	/*
	 * The eeveelutions' signatures. Glaceon and Leafeon bring their own weather
	 * and double their Speed in it, a five-turn sweep that needs no teammate;
	 * Flareon sets itself alight and runs on the burn.
	 */
	diamonddust: {
		name: "Diamond Dust",
		onStart(source) {
			this.field.setWeather('snowscape');
		},
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather(['hail', 'snowscape'])) return this.chainModify(2);
		},
		flags: {},
		rating: 4,
		num: -14,
		gen: 9,
		flavor: "The air around Glaceon freezes into glittering motes, and it moves through them like light.",
		shortDesc: "Sets snow on entry. Doubles Speed in snow.",
		desc: "On switch-in, this Pokemon summons snow. Its Speed is doubled while it is snowing.",
	},
	solstice: {
		name: "Solstice",
		onStart(source) {
			this.field.setWeather('sunnyday');
		},
		onModifySpe(spe, pokemon) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) return this.chainModify(2);
		},
		flags: {},
		rating: 4,
		num: -15,
		gen: 9,
		flavor: "Leafeon unfurls, and it is midsummer wherever it stands.",
		shortDesc: "Sets harsh sunlight on entry. Doubles Speed in sun.",
		desc: "On switch-in, this Pokemon summons harsh sunlight. Its Speed is doubled while the sunlight is harsh, unless it holds a Utility Umbrella.",
	},
	kindledfury: {
		name: "Kindled Fury",
		onStart(pokemon) {
			// Fire types cannot be burned; this one does it to itself anyway.
			if (!pokemon.status) pokemon.setStatus('brn', pokemon, this.effect, true);
		},
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (pokemon.activeTurns) this.boost({ spe: 1 });
		},
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (pokemon.status) return this.chainModify(1.5);
		},
		// Guts: the burn does not halve its physical damage. The engine only skips
		// the halving for Guts by name, so it is undone here (Facade is never halved).
		onModifyDamage(damage, source, target, move) {
			if (source.status === 'brn' && move.category === 'Physical' && move.id !== 'facade') return this.chainModify(2);
		},
		flags: {},
		rating: 4.5,
		num: -16,
		gen: 9,
		flavor: "Flareon sets its own mane alight, and the longer it burns the faster it runs.",
		shortDesc: "Burns itself on entry. Speed Boost + Guts; its burn does not halve its Attack.",
		desc: "On switch-in, this Pokemon burns itself if it has no status, even though it is a Fire type. Its Speed rises by 1 stage at the end of each full turn on the field, its Attack is multiplied by 1.5 while it has a status condition, and a burn does not halve its physical damage.",
	},
	/*
	 * Moonlit Venom - Umbreon's. Its sweat turns poisonous under the moon: no
	 * status condition takes hold (Purifying Salt's immunity, so Rest fails too),
	 * and its poison reaches Steel and Poison types (Corrosion).
	 */
	moonlitvenom: {
		name: "Moonlit Venom",
		onSetStatus(status, target, source, effect) {
			if (effect && effect.status) this.add('-immune', target, '[from] ability: Moonlit Venom');
			return false;
		},
		onTryAddVolatile(status, target) {
			if (status.id === 'yawn') {
				this.add('-immune', target, '[from] ability: Moonlit Venom');
				return null;
			}
		},
		// Corrosion is checked by name inside the engine, so the poison is applied
		// here instead, past the type immunity and through every other check.
		onModifyMove(move) {
			const corrode = effect => {
				if (!effect || (effect.status !== 'psn' && effect.status !== 'tox')) return;
				const status = effect.status;
				delete effect.status;
				effect.onHit = function (target, source, active) {
					return target.setStatus(target.status || status, source, active, true);
				};
			};
			corrode(move);
			for (const secondary of move.secondaries || []) corrode(secondary);
		},
		flags: { breakable: 1 },
		rating: 4,
		num: -17,
		gen: 9,
		flavor: "Under the moon, Umbreon's sweat turns to venom that nothing can wash away, and nothing can touch.",
		shortDesc: "Immune to status conditions. Can poison Steel and Poison types.",
		desc: "This Pokemon cannot be poisoned, burned, paralyzed, put to sleep or frozen, and cannot become drowsy; Rest fails. Its moves can poison Steel-type and Poison-type Pokemon.",
	},
	/*
	 * Prescience - Espeon's. It sees the harm coming: only attacks damage it
	 * (Magic Guard), and status moves and hazards aimed at it bounce back
	 * (Magic Bounce).
	 */
	prescience: {
		name: "Prescience",
		onSwitchOut(pokemon) {
			pokemon.heal(pokemon.baseMaxhp / 3);
		},
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== 'Move') {
				if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
				return false;
			}
		},
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (target === source || move.hasBounced || !move.flags['reflectable'] || target.isSemiInvulnerable()) return;
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.actions.useMove(newMove, target, { target: source });
			return null;
		},
		onAllyTryHitSide(target, source, move) {
			if (target.isAlly(source) || move.hasBounced || !move.flags['reflectable'] || target.isSemiInvulnerable()) return;
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.actions.useMove(newMove, this.effectState.target, { target: source });
			move.hasBounced = true;
			return null;
		},
		flags: { breakable: 1 },
		rating: 5,
		num: -18,
		gen: 9,
		flavor: "The jewel on Espeon's brow glows before any harm arrives, and the harm turns around.",
		shortDesc: "Magic Guard + Magic Bounce + Regenerator.",
		desc: "This Pokemon can only be damaged by direct attacks, and it reflects back status moves and hazards aimed at it or its side, as Magic Bounce does. It restores 1/3 of its maximum HP when it switches out.",
	},
	/*
	 * Liquid Body - Vaporeon's. It melts into water: Water moves heal it instead
	 * (Water Absorb), and it recovers a third of its HP on switching out
	 * (Regenerator).
	 */
	liquidbody: {
		name: "Liquid Body",
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Water') {
				if (!this.heal(target.baseMaxhp / 4)) this.add('-immune', target, '[from] ability: Liquid Body');
				return null;
			}
		},
		onSwitchOut(pokemon) {
			pokemon.heal(pokemon.baseMaxhp / 3);
		},
		flags: { breakable: 1 },
		rating: 4.5,
		num: -19,
		gen: 9,
		flavor: "Vaporeon dissolves into the water around it and comes back whole.",
		shortDesc: "Water Absorb + Regenerator.",
		desc: "This Pokemon is immune to Water-type moves and heals 1/4 of its maximum HP when hit by one. It restores 1/3 of its maximum HP when it switches out.",
	},
	/*
	 * Static Needles - Jolteon's. Its fur bristles into charged needles:
	 * Electric moves heal it and raise its Speed (Volt Absorb and Motor Drive),
	 * and touching it can paralyze (Static).
	 */
	staticneedles: {
		name: "Static Needles",
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Electric') {
				const healed = this.heal(target.baseMaxhp / 4);
				const boosted = this.boost({ spe: 1 });
				if (!healed && !boosted) this.add('-immune', target, '[from] ability: Static Needles');
				return null;
			}
		},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target) && this.randomChance(3, 10)) {
				source.trySetStatus('par', target);
			}
		},
		flags: { breakable: 1 },
		rating: 3.5,
		num: -20,
		gen: 9,
		flavor: "Every hair on Jolteon stands up as a needle full of lightning.",
		shortDesc: "Electric immunity: heals 1/4 and +1 Speed. 30% to paralyze on contact.",
		desc: "This Pokemon is immune to Electric-type moves; when hit by one it heals 1/4 of its maximum HP and its Speed rises by 1 stage. Pokemon making contact with it have a 30% chance to be paralyzed.",
	},
	/*
	 * Ribbon Hymn - Sylveon's. Its Normal moves become Fairy with a 1.2x boost
	 * (Pixilate), and its ribbons hush sound moves aimed at it (Soundproof).
	 */
	ribbonhymn: {
		name: "Ribbon Hymn",
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = ['judgment', 'multiattack', 'naturalgift', 'revelationdance', 'technoblast', 'terrainpulse', 'weatherball'];
			if (move.type === 'Normal' && (!noModifyType.includes(move.id) || (this.activeMove && this.activeMove.isMax)) &&
				!(move.isZ && move.category !== 'Status') && !(move.name === 'Tera Blast' && pokemon.terastallized)) {
				move.type = 'Fairy';
				move.typeChangerBoosted = this.effect;
			}
		},
		onBasePowerPriority: 23,
		onBasePower(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) return this.chainModify([4915, 4096]);
		},
		onTryHit(target, source, move) {
			if (target !== source && move.flags['sound']) {
				this.add('-immune', target, '[from] ability: Ribbon Hymn');
				return null;
			}
		},
		onAllyTryHitSide(target, source, move) {
			if (move.flags['sound']) this.add('-immune', this.effectState.target, '[from] ability: Ribbon Hymn');
		},
		flags: { breakable: 1 },
		rating: 4,
		num: -21,
		gen: 9,
		flavor: "Sylveon's ribbons sing a quiet hymn that turns every sound it makes to a Fairy's, and hushes any aimed at it.",
		shortDesc: "Pixilate + Soundproof.",
		desc: "This Pokemon's Normal-type moves become Fairy type and have 1.2x power. It is immune to sound-based moves.",
	},
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
	stunfisk: 'Mudflat Ambush',
	stunfiskgalar: 'Mudflat Ambush',
	magcargo: 'Solid Rock',
	banette: 'Prankster',
	seviper: 'Intimidate',
	stonjourner: 'Sturdy',
};

/*
 * Three eeveelutions with a stat worth building around and no way to use it:
 * each gets a signature ability and a little coverage. Eevee is left alone -
 * it is every eeveelution's pre-evolution, so whatever it gets, all eight get.
 */
/*
 * Luxray: Knock Off and Sucker Punch for the Dark STAB it now has (Crunch and
 * Throat Chop it already knew), and for Prankster the moves of a hunter that
 * pins its prey - Taunt, Parting Shot, Encore, Yawn, Swagger, Swords Dance. Volt Switch,
 * Thunder Wave, Snarl, Fake Tears, Protect and Substitute it already had.
 */
const LUXRAY = { ability: 'Prankster', moves: ['gleamstalk', 'knockoff', 'suckerpunch', 'taunt', 'partingshot', 'encore', 'yawn', 'swagger', 'swordsdance'] };

const EEVEELUTIONS = {
	// Solar Blade (native) fires in one turn in its own sun. Rock for the Fire,
	// Flying and Bug types that wall Grass; Ground for Steel and Poison.
	leafeon: { ability: 'Solstice', moves: ['stoneedge', 'earthquake'] },
	// Facade (native) is the burn's other half. Ground for the Fire and Rock
	// types, Fighting and Dark for the rest.
	flareon: { ability: 'Kindled Fury', moves: ['highhorsepower', 'closecombat', 'knockoff'] },
	// Ground for the Steel and Fire types that wall Ice; Psyshock for Fighting.
	glaceon: { ability: 'Diamond Dust', moves: ['earthpower', 'psyshock'] },
	// The other five: a signature each, two existing abilities fused on theme.
	umbreon: { ability: 'Moonlit Venom', moves: [] },
	espeon: { ability: 'Prescience', moves: [] },
	vaporeon: { ability: 'Liquid Body', moves: [] },
	jolteon: { ability: 'Static Needles', moves: [] },
	sylveon: { ability: 'Ribbon Hymn', moves: [] },
};

/*
 * The ten shared moves, like TMs: every Pokemon across the dex that each one
 * suits, not only the underdogs. Final stages are listed; pre-evolutions follow.
 * Mew gets all ten; Smeargle can Sketch them.
 */
const TM_DISTRIBUTION = {
	// Stinging, swarming and pincered bugs. Not Scolipede: Speed Boost plus a 50% Attack raise is a sweeper it doesn't need to be.
	hivefrenzy: ['beedrill', 'ariados', 'ledian', 'volbeat', 'vespiquen', 'parasect', 'scyther', 'scizor', 'kleavor', 'pinsir', 'heracross', 'drapion', 'gligar', 'gliscor', 'escavalier', 'durant', 'leavanny', 'lokix', 'spidops', 'kricketune', 'mothim', 'ribombee', 'golisopod', 'yanmega', 'ninjask', 'crustle'],
	// Cocoons, moths and silk-spinners. Not Volcarona: reliable recovery beside Quiver Dance pushes an OU sweeper too far.
	chrysalisveil: ['butterfree', 'beautifly', 'dustox', 'venomoth', 'masquerain', 'mothim', 'vivillon', 'frosmoth', 'ribombee', 'leavanny', 'illumise', 'volbeat', 'wormadam', 'wormadamsandy', 'wormadamtrash', 'shuckle', 'rabsca', 'forretress'],
	// Scrappy, stubborn Normal-types. Not Diggersby (Huge Power), Maushold (Technician multi-hits), Ursaluna or Kangaskhan.
	hustleup: ['furret', 'raticate', 'raticatealola', 'linoone', 'linoonegalar', 'watchog', 'fearow', 'dodrio', 'swellow', 'persian', 'purugly', 'zangoose', 'delcatty', 'bibarel', 'gumshoos', 'squawkabilly', 'granbull', 'delibird', 'farfetchd', 'sirfetchd', 'stoutland', 'lopunny', 'cinccino', 'tauros', 'miltank', 'obstagoon', 'greedent', 'oinkologne', 'bouffalant', 'unfezant', 'ambipom', 'ursaring', 'smeargle', 'spinda'],
	// Scavengers and predators. Not Kingambit, Weavile or Crawdaunt: a draining Dark move is too much of a gift to all three.
	carrionfeast: ['mightyena', 'liepard', 'thievul', 'persianalola', 'raticatealola', 'cacturne', 'sharpedo', 'mawile', 'banette', 'seviper', 'arbok', 'sableye', 'absol', 'mandibuzz', 'honchkrow', 'krookodile', 'houndoom', 'bisharp', 'zoroark', 'skuntank', 'drapion', 'scrafty', 'grimmsnarl', 'mabosstiff', 'shiftry', 'spiritomb', 'malamar', 'houndstone'],
	// Small, quick electric critters.
	sparkscamper: ['pikachu', 'raichu', 'raichualola', 'pachirisu', 'plusle', 'minun', 'emolga', 'dedenne', 'togedemaru', 'manectric', 'stunfisk', 'pincurchin', 'jolteon', 'morpeko', 'pawmot', 'luxray', 'zebstrika', 'electrode', 'electrodehisui'],
	// Currents, reefs and the deep. Not Starmie or Palafin: strong special Water with a 50% Speed drop is too much on either.
	undertow: ['lumineon', 'seaking', 'whiscash', 'corsola', 'lanturn', 'dewgong', 'swanna', 'wugtrio', 'basculin', 'luvdisc', 'wishiwashi', 'pyukumuku', 'tentacruel', 'octillery', 'mantine', 'huntail', 'gorebyss', 'relicanth', 'wailord', 'milotic', 'kingdra', 'dhelmise', 'dragalge', 'clawitzer', 'jellicent', 'alomomola', 'lapras', 'cursola', 'barraskewda', 'golduck', 'politoed', 'quagsire', 'qwilfish', 'overqwil', 'toxapex', 'dondozo'],
	// Sun, flowers, nectar and pollen. Venusaur is the borderline one (135 in sun on Chlorophyll), kept because the move is its theme and the sun must be set first.
	solarnectar: ['sunflora', 'cherrim', 'maractus', 'jumpluff', 'tropius', 'carnivine', 'shiinotic', 'eldegoss', 'sawsbuck', 'parasect', 'wormadam', 'cacturne', 'venusaur', 'bellossom', 'vileplume', 'roserade', 'florges', 'comfey', 'lilligant', 'whimsicott', 'meganium', 'ribombee', 'victreebel', 'exeggutor', 'exeggutoralola', 'lurantis', 'arboliva', 'scovillain', 'ludicolo', 'breloom', 'appletun', 'sceptile'],
	// Heavy stone bodies, boulders and hammers. Not Tyranitar, Garganacl or Landorus: reliable Rock STAB or coverage on those tips OU; they keep Stone Edge.
	craghammer: ['sudowoodo', 'magcargo', 'solrock', 'klawf', 'stonjourner', 'sandslash', 'marowak', 'dugtrio', 'golem', 'golemalola', 'rhyperior', 'aggron', 'rampardos', 'bastiodon', 'probopass', 'gigalith', 'coalossal', 'lycanroc', 'lycanrocmidnight', 'lycanrocdusk', 'tyrantrum', 'barbaracle', 'crustle', 'archeops', 'aerodactyl', 'kabutops', 'armaldo', 'cradily', 'avalugg', 'avalugghisui', 'relicanth', 'steelix', 'tinkaton', 'conkeldurr', 'carbink'],
	// Hypnotists and spinning psychic lights. Not Espathra, Hatterene or Starmie.
	hypnowhirl: ['chimecho', 'grumpig', 'meowstic', 'meowsticf', 'swoobat', 'lunatone', 'mrmime', 'mrrime', 'jynx', 'indeedee', 'indeedeef', 'rabsca', 'unown', 'hypno', 'xatu', 'girafarig', 'farigiraf', 'bronzong', 'claydol', 'gothitelle', 'reuniclus', 'beheeyem', 'malamar', 'musharna', 'gardevoir', 'sigilyph', 'delphox', 'orbeetle', 'oranguru', 'bruxish', 'alakazam'],
	// Boxers and fighters light on their feet. Not Annihilape (Uber) or Quaquaval, which already has a Speed-raising signature.
	// Electric physical attackers. Not Iron Hands (OU, and it would replace a
	// drawback move with none), Regieleki (Uber) or the special legendaries.
	voltaiclance: ['electivire', 'luxray', 'zeraora', 'eelektross', 'pawmot', 'morpeko', 'dracozolt', 'arctozolt',
		'ironthorns', 'zebstrika', 'manectric', 'raichu', 'raichualola', 'pikachu', 'emolga', 'pachirisu', 'dedenne',
		'togedemaru', 'stunfisk', 'boltund', 'pincurchin', 'minun', 'plusle'],
	// Ice physical attackers. Not Weavile or Sneasel (it would outclass Icicle
	// Crash on a UU sweeper), Baxcalibur (Uber), Galarian Darmanitan (Gorilla
	// Tactics) or the Ice legends; Mamoswine is the borderline one kept.
	rimecleaver: ['mamoswine', 'cetitan', 'beartic', 'avalugg', 'avalugghisui', 'glalie', 'abomasnow', 'walrein',
		'crabominable', 'eiscue', 'arctozolt', 'arctovish', 'lapras'],
	// Poison special and mixed attackers. Not Gengar or Glimmora (a Steel answer
	// on top of what they already threaten), Amoonguss, Venusaur, or the Poison
	// legends and Ultra Beasts.
	oxidize: ['nidoking', 'nidoqueen', 'muk', 'mukalola', 'weezing', 'weezinggalar', 'tentacruel', 'dragalge', 'salazzle', 'toxapex',
		'vileplume', 'victreebel', 'roserade', 'venomoth', 'swalot', 'toxtricity', 'toxtricitylowkey', 'garbodor', 'skuntank', 'dustox',
		'seviper', 'toedscruel'],
	shufflejab: ['hitmonlee', 'hitmonchan', 'hitmontop', 'throh', 'sawk', 'hariyama', 'falinks', 'granbull', 'spinda', 'machamp', 'conkeldurr', 'pangoro', 'primeape', 'poliwrath', 'toxicroak', 'lucario', 'infernape', 'medicham', 'mienshao', 'crabominable', 'passimian', 'hawlucha', 'grapploct', 'lopunny', 'scrafty', 'pawmot', 'kommoo'],
};

/*
 * Newer moves for older Pokemon: shared moves from Generations 8 and 9 that
 * skipped Pokemon who obviously fit them. Moves they already know are skipped
 * when the buffs are applied.
 */
const NEWER_MOVES = {
	'tripleaxel': [
		'froslass',
		'eiscue',
		'jynx',
		'smoochum',
		'mrrime',
		'mrmimegalar',
		'delibird',
		'hitmonlee',
		'hitmontop',
		'tyrogue',
		'lopunny',
		'buneary'
	],
	'icespinner': [
		'froslass',
		'snorunt',
		'glalie',
		'jynx',
		'smoochum',
		'cryogonal',
		'hitmontop',
		'delibird',
		'eiscue'
	],
	'chillingwater': [
		'seel',
		'dewgong',
		'spheal',
		'sealeo',
		'walrein',
		'lapras',
		'shellder',
		'cloyster',
		'bergmite',
		'avalugg',
		'cetoddle',
		'cetitan'
	],
	'snowscape': [
		'articuno',
		'regice',
		'jynx',
		'smoochum',
		'glalie',
		'froslass',
		'snorunt',
		'beartic',
		'cubchoo',
		'vanillite',
		'vanillish',
		'vanilluxe',
		'cryogonal',
		'snover',
		'abomasnow',
		'walrein',
		'avalugg',
		'eiscue',
		'delibird',
		'lapras',
		'dewgong',
		'swinub',
		'piloswine',
		'mamoswine',
		'glaceon',
		'snom',
		'frosmoth'
	],
	'axekick': [
		'hitmonlee',
		'hitmontop',
		'tyrogue',
		'lopunny',
		'buneary',
		'sawk',
		'mienfoo',
		'mienshao',
		'medicham',
		'meditite'
	],
	'temperflare': [
		'growlithe',
		'arcanine',
		'houndour',
		'houndoom',
		'magby',
		'magmar',
		'magmortar',
		'darumaka',
		'darmanitan',
		'tepig',
		'pignite',
		'emboar',
		'litten',
		'torracat',
		'incineroar',
		'numel',
		'camerupt',
		'flareon',
		'ponyta',
		'rapidash'
	],
	'trailblaze': [
		'treecko',
		'grovyle',
		'sceptile',
		'tropius',
		'deerling',
		'sawsbuck',
		'skiddo',
		'gogoat',
		'leavanny',
		'shroomish',
		'breloom',
		'cacnea',
		'cacturne',
		'ludicolo',
		'shiftry',
		'turtwig',
		'grotle',
		'torterra',
		'snover',
		'abomasnow',
		'carnivine',
		'maractus'
	],
	'pounce': [
		'spinarak',
		'ariados',
		'joltik',
		'galvantula',
		'scyther',
		'leavanny',
		'ninjask',
		'yanmega',
		'heracross',
		'pinsir',
		'durant',
		'escavalier',
		'accelgor',
		'dwebble',
		'crustle'
	],
	'hardpress': [
		'aron',
		'lairon',
		'aggron',
		'onix',
		'steelix',
		'shieldon',
		'bastiodon',
		'nosepass',
		'probopass',
		'bronzor',
		'bronzong',
		'klink',
		'klang',
		'klinklang',
		'cufant',
		'copperajah'
	],
	'psychicnoise': [
		'jynx',
		'mrmime',
		'grumpig',
		'chimecho',
		'xatu',
		'girafarig',
		'bronzong',
		'claydol',
		'gothitelle',
		'reuniclus',
		'beheeyem',
		'musharna',
		'sigilyph',
		'delphox',
		'meowstic',
		'meowsticf'
	],
	'alluringvoice': [
		'clefairy',
		'clefable',
		'jigglypuff',
		'wigglytuff',
		'togekiss',
		'gardevoir',
		'florges',
		'aromatisse',
		'slurpuff',
		'sylveon',
		'whimsicott',
		'primarina',
		'comfey'
	],
	'upperhand': [
		'hitmonlee',
		'hitmonchan',
		'hitmontop',
		'medicham',
		'mienshao',
		'sawk',
		'hawlucha',
		'infernape',
		'lucario'
	],
	'dragoncheer': [
		'altaria',
		'flygon',
		'kingdra',
		'dragalge',
		'noivern',
		'haxorus',
		'druddigon',
		'goodra',
		'turtonator'
	]
};

/*
 * Grass gets coverage: existing moves that answer the seven types resisting
 * Grass, matched to each Pokemon's stats and theme. Not Rillaboom, Ogerpon,
 * Venusaur, Amoonguss, Meowscarada, Breloom or Ferrothorn.
 */
const GRASS_COVERAGE = {
	'sunflora': [
		'earthpower',
		'sludgebomb',
		'fireblast'
	],
	'cherrim': [
		'earthpower',
		'fireblast'
	],
	'maractus': [
		'earthpower',
		'sludgebomb',
		'knockoff'
	],
	'jumpluff': [
		'knockoff',
		'earthquake'
	],
	'tropius': [
		'earthquake',
		'stoneedge',
		'knockoff'
	],
	'carnivine': [
		'knockoff',
		'earthquake',
		'gunkshot'
	],
	'shiinotic': [
		'earthpower',
		'sludgebomb'
	],
	'eldegoss': [
		'earthpower',
		'knockoff'
	],
	'sawsbuck': [
		'highhorsepower',
		'stoneedge',
		'knockoff'
	],
	'parasect': [
		'rockslide',
		'knockoff'
	],
	'wormadam': [
		'earthpower',
		'sludgebomb'
	],
	'cacturne': [
		'earthquake',
		'gunkshot'
	],
	'bellossom': [
		'earthpower',
		'sludgebomb'
	],
	'victreebel': [
		'earthquake',
		'knockoff'
	],
	'exeggutor': [
		'earthpower',
		'fireblast'
	],
	'exeggutoralola': [
		'dragonpulse',
		'earthquake',
		'flamethrower'
	],
	'ludicolo': [
		'earthpower'
	],
	'shiftry': [
		'rockslide',
		'earthquake'
	],
	'lurantis': [
		'knockoff',
		'earthquake',
		'stoneedge'
	],
	'gogoat': [
		'stoneedge',
		'highhorsepower'
	],
	'leavanny': [
		'knockoff',
		'rockslide'
	],
	'appletun': [
		'dragonpulse',
		'earthpower'
	],
	'flapple': [
		'stoneedge',
		'earthquake'
	],
	'dhelmise': [
		'stoneedge',
		'earthquake'
	],
	'abomasnow': [
		'earthpower',
		'earthquake'
	],
	'sceptile': [
		'earthpower',
		'sludgebomb'
	],
	'meganium': [
		'earthquake',
		'knockoff'
	],
	'arboliva': [
		'earthpower',
		'sludgebomb'
	],
	'scovillain': [
		'earthpower',
		'sludgebomb'
	],
	'cradily': [
		'earthpower',
		'sludgebomb'
	],
	'lilligant': [
		'earthpower',
		'sludgebomb'
	],
	'roserade': [
		'earthpower'
	],
	'trevenant': [
		'rockslide',
		'highhorsepower'
	],
	'gourgeist': [
		'earthquake',
		'rockslide'
	],
	'vileplume': [
		'earthpower'
	],
	'decidueye': [
		'stoneedge',
		'knockoff'
	],
	'chesnaught': [
		'stoneedge'
	],
	'toedscruel': [
		'sludgebomb',
		'knockoff'
	],
	'torterra': [
		'stoneedge'
	],
	'whimsicott': [
		'sludgebomb'
	]
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

	// Coverage for Grass types.
	for (const [id, moves] of Object.entries(GRASS_COVERAGE)) if (Pokedex[id]) add(id, moves, []);

	// Newer (Gen 8-9) shared moves for older Pokemon that fit them.
	for (const [move, ids] of Object.entries(NEWER_MOVES)) {
		for (const id of ids) if (Pokedex[id]) add(id, [move], []);
	}

	// The ten shared moves, handed out like TMs to everything they suit.
	for (const [move, ids] of Object.entries(TM_DISTRIBUTION)) {
		for (const id of ids) if (Pokedex[id]) add(id, [move], []);
	}

	// Pre-evolutions: the new move (not the coverage) and the ability.
	const SIGNATURES = ['continentalheave', 'aurorasquall', 'memorywipe', 'soulresonance', 'resolutestrike', 'gleamstalk'];
	const newMove = m => exports.MOVES[m] && !SIGNATURES.includes(m);
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

	// Luxray, now Electric/Dark (see unnerfs.js): Dark attacks for the new STAB and
	// Prankster with the stalker's support moves. Luxray only, not Shinx or Luxio.
	if (Pokedex.luxray) add('luxray', LUXRAY.moves, [LUXRAY.ability]);

	// The eeveelutions, after the pre-evolution pass so Eevee does not inherit them.
	for (const [id, e] of Object.entries(EEVEELUTIONS)) if (Pokedex[id]) add(id, e.moves, [e.ability]);

	// Mew learns every machine move there is, and these are handed out like machines.
	add('mew', Object.keys(exports.MOVES).filter(newMove), []);

	out.regigigas = { moves: ['continentalheave'], abilities: ['Colossus Unbound'], sole: true };
	// A Second Legend: Articuno keeps Pressure and Snow Cloak and gains its own.
	out.articuno = { moves: ['aurorasquall', 'freezedry', 'hurricane', 'calmmind', 'roost', 'uturn'], abilities: ['Polar Mantle'] };
	// The Legends Rise: each keeps what it had and gains its own. Uxie and Mesprit get
	// signature abilities, each letting Psychic moves hit Dark types.
	out.regice = { moves: ['freezedry', 'recover', 'aurorabeam', 'chillingwater', 'auroraveil'], abilities: ['Permafrost Core'] };
	out.uxie = { moves: ['memorywipe', 'slackoff', 'teleport', 'healbell'], abilities: ['Mind Keeper'] };
	out.mesprit = { moves: ['soulresonance', 'moonblast', 'calmmind', 'wish'], abilities: ['Heartfelt Resolve'] };
	out.azelf = { moves: ['resolutestrike', 'closecombat', 'swordsdance', 'knockoff'], abilities: ['Unbending Will'] };
	return out;
};

exports.GROUPS = GROUPS;
exports.TM_DISTRIBUTION = TM_DISTRIBUTION;
exports.NEWER_MOVES = NEWER_MOVES;
exports.GRASS_COVERAGE = GRASS_COVERAGE;
exports.SMALL = SMALL;
exports.ABILITY_GRANTS = ABILITY_GRANTS;
exports.EEVEELUTIONS = EEVEELUTIONS;

/**
 * Gleamstalk is Dark-type lightning: every ability that absorbs Electric moves
 * absorbs it too. Found by what the ability checks rather than by a list, so
 * Mudflat Ambush, Static Needles and anything added later come along; each is
 * shown the move as Electric and does exactly what it does to one.
 */
exports.patchAbsorbers = Abilities => {
	for (const ability of Object.values(Abilities)) {
		const original = ability && ability.onTryHit;
		if (typeof original !== 'function' || original.velvetGleamstalk || !/Electric/.test(String(original))) continue;
		ability.onTryHit = function (target, source, move) {
			if (move && move.id === 'gleamstalk') move = Object.create(move, { type: { value: 'Electric' } });
			return original.call(this, target, source, move);
		};
		ability.onTryHit.velvetGleamstalk = true;
	}
	return Abilities;
};
exports.LUXRAY = LUXRAY;
