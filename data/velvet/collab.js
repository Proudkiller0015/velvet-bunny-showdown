'use strict';
/**
 * Collab: crossover Pokemon, and the tier that holds them.
 *
 * A collab Pokemon is a guest from another series. It is not banned for being
 * strong - it is banned for being a guest: every RP format refuses it, RP AG
 * included, and the one format that takes it is RP Collab (RP AG's rules plus
 * these). On the ladder that is Collab > AG > Uber > OU > ... The refusal is a
 * banlist entry config/custom-formats.js puts on every other RP format, so the
 * validator, the bot's draft pool and anything else reading the rule table all
 * agree without being told.
 *
 * The first one: Funerfly, from Lobotomy Corporation's "The Funeral of the Dead
 * Butterflies" (T-01-68, HE risk). A humanoid in a suit with a coffin full of
 * butterflies, whose harm is to the mind - WHITE damage - so its attacks are special.
 *
 *   Funerfly          Bug/Ghost   95 / 65 / 100 / 115 / 110 / 85   570   contained
 *   Funerfly-Breach   Bug/Ghost   95 / 75 / 85 / 150 / 95 / 120    620   breached
 *
 *   Qliphoth Counter   starts at 2; -1 when a super-effective move hits it, -1 when
 *                      a teammate faints beside it (doubles: in singles the teammate
 *                      that faints is the one out, never beside it). At 0 it breaches,
 *                      for good: Funerfly-Breach until it faints, switches included.
 *   Solemn Lament      Ghost, special, 40 x2, 100%. Bug as well, as Flying Press is Flying.
 *   Butterfly Procession  Bug, special, 60, 100%. Traps for 4 turns, 1/8 a turn.
 *   Last Rites         Ghost, status, once a battle: heals 1/4 per fainted Pokemon, both sides.
 */

const ID = 'funerfly';
const BREACH = 'funerflybreach';
const ABILITY = 'Qliphoth Counter';
const COUNTER_START = 2;
const BREACH_LINE = 'The funeral procession begins.';

// The dex has no field for flavour text: exported for whatever shows one (DEX_ENTRIES).
const DEX_ENTRY = "Where does one go when they die? It carries a coffin full of butterflies for those who could never leave, though no coffin is large enough. Those whose spirit it breaks do not panic. They simply lie down, and the butterflies rest on them.";

exports.pokedex = (data) => {
	const common = {
		num: 2004,
		gen: 9,
		types: ['Bug', 'Ghost'],
		gender: 'N',
		abilities: { 0: ABILITY },
		heightm: 1.9,
		weightkg: 81,
		color: 'Black',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	data[ID] = {
		...common,
		name: 'Funerfly',
		baseStats: { hp: 95, atk: 65, def: 100, spa: 115, spd: 110, spe: 85 },
		otherFormes: ['Funerfly-Breach'],
		formeOrder: ['Funerfly', 'Funerfly-Breach'],
	};
	data[BREACH] = {
		...common,
		name: 'Funerfly-Breach',
		baseSpecies: 'Funerfly',
		forme: 'Breach',
		baseStats: { hp: 95, atk: 75, def: 85, spa: 150, spd: 95, spe: 120 },
		requiredAbility: ABILITY,
		battleOnly: 'Funerfly',
	};
	return data;
};

exports.formatsData = (data) => {
	for (const id of [ID, BREACH]) {
		data[id] = { isNonstandard: null, tier: 'Collab', doublesTier: 'Collab', natDexTier: 'Collab' };
	}
	return data;
};

/** The counter lives on the Pokemon, not the ability's state, so a switch keeps it. */
function counterOf(pokemon) {
	if (pokemon.m.qliphoth === undefined) pokemon.m.qliphoth = COUNTER_START;
	return pokemon.m.qliphoth;
}

/** One step down the counter, and the breach when it reaches 0. */
function tick(battle, pokemon, why) {
	if (pokemon.baseSpecies.baseSpecies !== 'Funerfly' || pokemon.transformed) return;
	if (pokemon.baseSpecies.id === BREACH || counterOf(pokemon) <= 0) return;
	pokemon.m.qliphoth--;
	battle.add('-activate', pokemon, `ability: ${ABILITY}`);
	battle.add('-message', `${pokemon.name}'s Qliphoth Counter fell to ${pokemon.m.qliphoth} (${why}).`);
	if (pokemon.m.qliphoth > 0) return;
	pokemon.formeChange('Funerfly-Breach', battle.dex.abilities.get(ABILITY), true);
	// Back to Funerfly when it faints, as Zygarde-Complete goes back to Zygarde.
	pokemon.formeRegression = true;
	battle.add('-message', BREACH_LINE);
}

exports.abilities = (data) => {
	data.qliphothcounter = {
		name: ABILITY,
		num: -67,
		gen: 9,
		rating: 3,
		onStart(pokemon) {
			if (pokemon.baseSpecies.id !== ID) return;
			// Contained again after fainting (Revival Blessing): the count starts over.
			if (counterOf(pokemon) <= 0) pokemon.m.qliphoth = COUNTER_START;
			this.add('-ability', pokemon, ABILITY);
			this.add('-message', `${pokemon.name}'s Qliphoth Counter is at ${pokemon.m.qliphoth}.`);
		},
		onDamagingHit(damage, target, source, move) {
			if (!target.hp || target.getMoveHitData(move).typeMod <= 0) return;
			// Once per move: the two hits of a Double Kick are one blow to the counter.
			if (move.hit > 1) return;
			tick(this, target, 'struck by a super-effective move');
		},
		onAllyFaint(ally) {
			const self = this.effectState.target;
			if (ally === self || !self.hp || !self.isActive) return;
			tick(this, self, `${ally.name} fainted`);
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		shortDesc: 'Counter 2: -1 when hit super effectively or an ally faints. At 0, becomes Funerfly-Breach.',
		desc: "Funerfly starts contained with a Qliphoth Counter of 2. The counter drops by 1 when a super-effective move hits it (once per move, however many hits), and by 1 when an ally faints while Funerfly is on the field. The counter is kept when it switches out. At 0 it breaches: it permanently becomes Funerfly-Breach (80/70/75/125/85/95) until it faints, switching included. This Ability can't be suppressed, copied, swapped or replaced.",
	};
	return data;
};

exports.moves = (data) => {
	data.solemnlament = {
		num: -63,
		gen: 9,
		accuracy: 100,
		basePower: 40,
		category: 'Special',
		name: 'Solemn Lament',
		pp: 10,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		multihit: 2,
		// Flying Press's rule: Bug's matchup on top of Ghost's.
		onEffectiveness(typeMod, target, type) {
			return typeMod + this.dex.getEffectiveness('Bug', type);
		},
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: 'Hits 2 times. Combines Bug in its type effectiveness. Funerfly.',
		desc: "Hits twice. This move combines Bug in its type effectiveness against the target, as Flying Press combines Flying: it is Ghost and Bug at once against each of the target's types. If the first hit breaks the target's substitute, it will take damage for the second hit. Funerfly's signature move.",
	};
	data.butterflyprocession = {
		num: -64,
		gen: 9,
		accuracy: 100,
		basePower: 60,
		category: 'Special',
		name: 'Butterfly Procession',
		pp: 15,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		// Infestation's binding, held to four turns whatever the user holds.
		onHit(target, source, move) {
			if (target.addVolatile('partiallytrapped', source, move)) target.volatiles['partiallytrapped'].duration = 5;
		},
		secondary: null,
		target: 'normal',
		type: 'Bug',
		shortDesc: 'Traps and damages the target for 4 turns. Funerfly.',
		desc: "Prevents the target from switching for four turns and causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding Binding Band), rounded down, at the end of each turn during effect. The effect ends early if the user leaves the field or uses Rapid Spin or Mortal Spin successfully. Grip Claw does not lengthen it. Funerfly's signature move.",
	};
	data.lastrites = {
		num: -65,
		gen: 9,
		accuracy: true,
		basePower: 0,
		category: 'Status',
		name: 'Last Rites',
		pp: 5,
		priority: 0,
		flags: { snatch: 1, heal: 1, metronome: 1 },
		onTry(source) {
			const fallen = this.sides.reduce((n, side) => n + side.pokemon.filter(p => p.fainted).length, 0);
			if (source.m.lastRites || !fallen || source.hp >= source.maxhp) return false;
		},
		onHit(pokemon) {
			const fallen = this.sides.reduce((n, side) => n + side.pokemon.filter(p => p.fainted).length, 0);
			if (!this.heal(Math.floor(pokemon.baseMaxhp / 4) * fallen, pokemon, pokemon)) return this.NOT_FAIL;
			// Once a battle: marked on the Pokemon, so a switch does not reset it.
			pokemon.m.lastRites = true;
		},
		secondary: null,
		target: 'self',
		type: 'Ghost',
		shortDesc: 'Heals 1/4 max HP per fainted Pokemon (both sides). Once per battle. Funerfly.',
		desc: "The user restores 1/4 of its maximum HP, rounded down, for each Pokemon on either side that has fainted. Fails if no Pokemon has fainted, if the user is at full HP, or if this Pokemon has already used it successfully this battle. Funerfly's signature move.",
	};
	return data;
};

const SIGNATURE = ['solemnlament', 'butterflyprocession', 'lastrites'];
const MOVES = [
	'shadowball', 'bugbuzz', 'hex', 'willowisp', 'quiverdance', 'calmmind', 'strengthsap', 'painsplit', 'destinybond',
	'perishsong', 'memento', 'uturn', 'trickroom', 'psychic', 'silverwind', 'ominouswind', 'protect',
	// What every new Pokemon of ours gets.
	'terablast', 'rest', 'sleeptalk', 'substitute', 'endure',
];

exports.learnsets = (data) => {
	const learnset = {};
	for (const move of SIGNATURE) learnset[move] = ['9L1'];
	for (const move of MOVES) learnset[move] = ['9M'];
	data[ID] = { learnset };
	return data;
};

exports.ID = ID;
exports.SPECIES = [ID];
exports.FORMES = [BREACH];
// What config/custom-formats.js bans by name from every RP format but RP Collab.
exports.NAMES = ['Funerfly', 'Funerfly-Breach'];
exports.MOVE_IDS = SIGNATURE;
exports.ABILITY_IDS = ['qliphothcounter'];
exports.LEARNSETS = { [ID]: { signature: SIGNATURE, moves: MOVES } };
exports.DEX_ENTRIES = { [ID]: DEX_ENTRY };
exports.TIER = 'Collab';
// For the builder's search: what it is from finds it too. [alias, species id, where in the id it starts].
exports.SEARCH_ALIASES = [['funeral', ID, 0], ['funeralofthedeadbutterflies', ID, 0], ['deadbutterflies', ID, 0], ['breach', BREACH, 8]];
exports.BREACH_LINE = BREACH_LINE;
