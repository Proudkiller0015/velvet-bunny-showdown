'use strict';
/**
 * Christmas 2026: Mega Delibird.
 *
 * A new Mega, not a skin: Delibird has none of its own. Its stone, the Delibirdite,
 * comes from the Christmas banner first; the form itself stays for good.
 *
 *   Delibird-Mega    Ice/Flying, 45 / 69 / 51 / 124 / 5 / 136 (Delibird's 330 + 100)
 *   Present Power   Attack and Defense doubled, and no damage or effect from
 *                    entry hazards.
 *
 * The Special Defense of 5 is on purpose (the owner, 31 Oct 2026): special
 * priority - Vacuum Wave above all - is meant to be its counter.
 *
 * Like every Mega it comes in as plain Delibird the first time, so that first
 * entry still takes Stealth Rock; the ability covers every switch-in after. Named by the owner, 1 Nov 2026 (it was Santa's Shield).
 */

const FORME = 'Delibird-Mega';
const STONE = 'Delibirdite';
const ABILITY = "Present Power";
const HAZARDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'gmaxsteelsurge'];

exports.pokedex = (data) => {
	const base = data.delibird;
	if (!base) return data;
	data.delibirdmega = {
		num: base.num,
		name: FORME,
		baseSpecies: 'Delibird',
		forme: 'Mega',
		types: ['Ice', 'Flying'],
		baseStats: { hp: 45, atk: 69, def: 51, spa: 124, spd: 5, spe: 136 },
		abilities: { 0: ABILITY },
		heightm: 1.1,
		weightkg: 22,
		color: 'Red',
		eggGroups: ['Undiscovered'],
		requiredItem: STONE,
		// The Megas' generation, so it is legal wherever Megas are (Gen 6 on).
		gen: 6,
	};
	if (!(base.otherFormes || []).includes(FORME)) base.otherFormes = [...(base.otherFormes || []), FORME];
	base.formeOrder = base.formeOrder || ['Delibird'];
	if (!base.formeOrder.includes(FORME)) base.formeOrder = [...base.formeOrder, FORME];
	return data;
};

exports.formatsData = (data) => {
	// Uber, the owner's call (31 Oct 2026).
	data.delibirdmega = { tier: 'Uber', natDexTier: 'Uber' };
	return data;
};

exports.items = (data) => {
	const stone = data.abomasite;
	if (!stone) return data;
	data.delibirdite = {
		...stone,
		name: STONE,
		// A real positive number: National Dex treats a negative one as not existing.
		num: 3025,
		gen: 6,
		megaStone: { Delibird: FORME },
		itemUser: ['Delibird'],
		// Not 'Past', or the National Dex RP ladders refuse it (see halloween.js).
		isNonstandard: null,
		desc: "Christmas 2026 event item, from the Christmas banner. If held by a Delibird, it Mega Evolves into Mega Delibird: Ice/Flying, 45/69/51/124/5/136, ability Present Power (Attack and Defense doubled; takes no damage or effects from entry hazards).",
		shortDesc: "Christmas 2026 event. Delibird: Mega Evolves; Present Power.",
	};
	return data;
};

exports.abilities = (data) => {
	data.presentpower = {
		name: ABILITY,
		num: -320,
		gen: 9,
		rating: 4,
		// Huge Power's Attack and Fur Coat's Defense. Like Fur Coat, Mold Breaker gets past the Defense.
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(2);
		},
		onModifyDefPriority: 6,
		onModifyDef(def) {
			return this.chainModify(2);
		},
		// Hazard immunity is in the hazards themselves (moves below), the way Heavy-Duty Boots is.
		flags: { breakable: 1 },
		shortDesc: "Attack and Defense doubled. Immune to entry hazards.",
		desc: "This Pokemon's Attack and Defense are doubled. It takes no damage or effects from entry hazards: Stealth Rock, Spikes, Toxic Spikes, Sticky Web and G-Max Steelsurge.",
	};
	return data;
};

exports.moves = (data) => {
	// Delibird's signature (the owner, 1 Nov 2026): Present as a Water move, five hits of 25 (125 in
	// all) that never miss. Two rolls before it goes off, each one time in twenty, decide the whole
	// move: a heal (every hit heals the target a quarter instead, Present's heal) or a double (every
	// hit at 50). Only physical or special is rolled again on every hit. An Ice-type user gets STAB
	// on it (forceSTAB, as the engine's own).
	data.presentsurge = {
		num: -321,
		gen: 9,
		accuracy: true,
		basePower: 25,
		category: 'Special',
		name: 'Present Surge',
		pp: 10,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		multihit: 5,
		onModifyMove(move, pokemon) {
			if (pokemon.hasType('Ice')) move.forceSTAB = true;
			move.surgeHeal = this.random(20) === 0;
			move.surgeDoubled = !move.surgeHeal && this.random(20) === 0;
		},
		// Run on every hit, before the damage picks Attack or Special Attack from the category.
		basePowerCallback(pokemon, target, move) {
			move.category = this.random(2) ? 'Physical' : 'Special';
			if (move.surgeHeal) {
				// A heal on a target already at full HP does nothing, rather than failing (which
				// would end the move there, as Present's does): the five hits always land.
				if (target.hp < target.maxhp) {
					move.heal = [1, 4];
					move.infiltrates = true;
				} else {
					delete move.heal;
				}
				return 0;
			}
			return move.surgeDoubled ? 50 : 25;
		},
		secondary: null,
		target: 'normal',
		type: 'Water',
		shortDesc: "5 hits, never misses, random phys/spec per hit. STAB for Ice types (Delibird). 5%: heal, 5%: 2x.",
		desc: "Hits five times and does not check accuracy. Each hit is physical or special at random, one chance in two, using Attack or Special Attack to match. Before it goes off, two rolls decide the whole move: one time in twenty every hit deals no damage and heals the target by 1/4 of its maximum HP instead, as Present can; otherwise, one time in twenty every hit has double power (50). An Ice-type user, Delibird included, gets STAB on it as if it were Water-type. Delibird's signature move.",
	};
	// Each hazard skips a Pokemon with Present Power on switch-in, as it skips Heavy-Duty Boots.
	for (const id of HAZARDS) {
		const condition = data[id] && data[id].condition;
		if (!condition || !condition.onSwitchIn || condition.onSwitchIn.presentPower) continue;
		const onSwitchIn = condition.onSwitchIn;
		condition.onSwitchIn = function (pokemon) {
			if (pokemon.hasAbility('presentpower')) return;
			return onSwitchIn.call(this, pokemon);
		};
		condition.onSwitchIn.presentPower = true;
	}
	return data;
};

// Delibird learns everything Iron Bundle does (the owner, 31 Oct 2026); the Mega learns through it.
// The moves it gains are listed for the builder (scripts/build-buffs.js), as Awakened.
const ADDED_MOVES = [];
exports.ADDED_MOVES = ADDED_MOVES;

exports.learnsets = (data) => {
	const bundle = data.ironbundle && data.ironbundle.learnset;
	const own = data.delibird && data.delibird.learnset;
	if (!bundle || !own) return data;
	// And a modern movepool (the owner, 1 Nov 2026: 'delibird movepool is SO ass'): the physical Water
	// moves Iron Bundle lacks, for Present Power's doubled Attack, and the staples it never had.
	const MODERN = ['presentsurge', 'liquidation', 'aquajet', 'hurricane', 'roost', 'knockoff', 'iciclecrash', 'chillyreception', 'trick', 'switcheroo', 'surf', 'focusblast', 'calmmind', 'bellydrum'];
	for (const id of [...Object.keys(bundle), ...MODERN]) {
		if (own[id]) continue;
		own[id] = ['9M'];
		if (!ADDED_MOVES.includes(id)) ADDED_MOVES.push(id);
	}
	return data;
};

exports.MOVE_IDS = ['presentsurge'];

exports.EVENT_SPECIES = ['delibird', 'delibirdmega'];

// Extra ways to find the form by typing: "christmas", "santa", "megadelibird".
exports.SEARCH_ALIASES = [['christmas', 0], ['christmasdelibird', 0], ['santa', 0], ['santadelibird', 0], ['megadelibird', 0]];

exports.FORME = FORME;
exports.STONE = STONE;
