'use strict';
/**
 * Makuro and Raishin: the Abyss and the Shrine.
 *
 * Two new legendaries, a pair, and the first Pokemon this server has added that
 * are meant to be played (Samantha and Nuzleaf-SOLD are illegal on purpose).
 * Designed by the owner; teased on Discord before they were built.
 *
 *   Makuro    Water/Dark      120 / 160 / 120 / 50 / 110 / 120   680
 *             Call of the Abyss: summons Abyssal Terrain on entry.
 *   Raishin   Electric/Ghost  100 / 160 / 100 / 50 / 120 / 150   680
 *             Call of the Shrine: summons Shrine Terrain on entry.
 *
 * The two terrains are the pair's real identity, and they share the one terrain
 * slot, so each Pokemon's arrival drowns out the other's:
 *
 *   Abyssal Terrain   the field sinks under water (night blue). Water and Dark
 *                     moves 1.3x; priority moves fail against Dark types.
 *   Shrine Terrain    purple lightning over a shrine. Electric and Ghost moves
 *                     1.3x; other Pokemon's status moves fail against Ghost types.
 *
 * Unlike the four official terrains neither asks whether a Pokemon is grounded:
 * the Abyss is the whole field under water, and a shrine's ward is not something
 * you fly over. They are named "... Terrain" because the client decides a field
 * effect is a terrain by the id ending in "terrain" - that is what makes one
 * replace another on screen and what picks the backdrop (client/style/velvet.css).
 *
 * They are Restricted Legendaries (src/rarity.js files them as box art: never wild)
 * with positive national numbers past the real dex, since a negative one collides
 * with the CAP Pokemon (-1 is Syclar as well as Samantha) and the client reads a
 * negative number as nonstandard. Tier: Ubers, the owner's call.
 */

const MAKURO = 'Makuro';
const RAISHIN = 'Raishin';

exports.pokedex = (data) => {
	data.makuro = {
		num: 2001,
		gen: 9,
		name: MAKURO,
		types: ['Water', 'Dark'],
		gender: 'N',
		baseStats: { hp: 120, atk: 160, def: 120, spa: 50, spd: 110, spe: 120 },
		abilities: { 0: 'Call of the Abyss' },
		heightm: 5.2,
		weightkg: 398,
		color: 'Black',
		eggGroups: ['Undiscovered'],
		tags: ['Restricted Legendary'],
	};
	data.raishin = {
		num: 2002,
		gen: 9,
		name: RAISHIN,
		types: ['Electric', 'Ghost'],
		gender: 'N',
		baseStats: { hp: 100, atk: 160, def: 100, spa: 50, spd: 120, spe: 150 },
		abilities: { 0: 'Call of the Shrine' },
		heightm: 2.1,
		weightkg: 88,
		color: 'White',
		eggGroups: ['Undiscovered'],
		tags: ['Restricted Legendary'],
	};
	return data;
};

exports.formatsData = (data) => {
	// Legal from RP Ubers up (the owner's call); refused in RP OU and below.
	for (const id of ['makuro', 'raishin']) {
		data[id] = { isNonstandard: null, tier: 'Uber', doublesTier: 'DUber', natDexTier: 'Uber' };
	}
	return data;
};

/** The terrains, found by id through the Conditions table (see index.js). */
function terrain({ name, from, types, blocks, startText }) {
	return {
		name,
		effectType: 'Terrain',
		duration: 5,
		durationCallback(source) {
			if (source?.hasItem('terrainextender')) return 8;
			return 5;
		},
		onBasePowerPriority: 6,
		onBasePower(basePower, attacker, defender, move) {
			if (types.includes(move.type) && !attacker.isSemiInvulnerable()) {
				this.debug(`${name} boost`);
				return this.chainModify([5325, 4096]);
			}
		},
		onTryHitPriority: 4,
		onTryHit(target, source, move) {
			if (!blocks(target, source, move)) return;
			if (target.isSemiInvulnerable() || target === source || target.isAlly(source)) return;
			this.add('-activate', target, `move: ${name}`);
			return null;
		},
		onFieldStart(field, source, effect) {
			if (effect?.effectType === 'Ability') {
				this.add('-fieldstart', `move: ${name}`, `[from] ability: ${effect.name}`, `[of] ${source}`);
			} else {
				this.add('-fieldstart', `move: ${name}`);
			}
			// The client's own line ("The battlefield sank into the abyss!") comes from
			// client/js/velvet-data.js; this one says what the terrain does.
			this.add('-message', startText);
		},
		onFieldResidualOrder: 27,
		onFieldResidualSubOrder: 7,
		onFieldEnd() {
			this.add('-fieldend', `move: ${name}`);
		},
	};
}

exports.conditions = (data) => {
	data.abyssalterrain = terrain({
		name: 'Abyssal Terrain',
		types: ['Water', 'Dark'],
		startText: 'Water and Dark moves grow stronger, and Dark types are shielded from priority moves.',
		// Psychic Terrain's rule, for Dark types: a move whose priority was raised
		// (Prankster, Gale Wings, Quick Attack...) aimed at one fails.
		blocks(target, source, move) {
			if (!move || move.priority <= 0.1 || move.target === 'self') return false;
			return target.hasType('Dark');
		},
	});
	data.shrineterrain = terrain({
		name: 'Shrine Terrain',
		types: ['Electric', 'Ghost'],
		startText: 'Electric and Ghost moves grow stronger, and Ghost types are warded from status moves.',
		// The ward: another Pokemon's status move aimed at a Ghost type fails, the
		// way Good as Gold turns them away - its own and its allies' still land.
		blocks(target, source, move) {
			if (!move || move.category !== 'Status' || move.target === 'self') return false;
			return target.hasType('Ghost');
		},
	});
	return data;
};

exports.abilities = (data) => {
	data.calloftheabyss = {
		name: 'Call of the Abyss',
		num: -31,
		gen: 9,
		rating: 4.5,
		onStart(source) {
			this.field.setTerrain('abyssalterrain');
		},
		flags: {},
		shortDesc: "On switch-in, summons Abyssal Terrain: Water/Dark moves 1.3x; priority fails vs Dark types.",
		desc: "On switch-in, this Pokemon summons Abyssal Terrain for 5 turns (8 with a Terrain Extender). While it lasts, the power of Water- and Dark-type attacks is multiplied by 1.3, and moves with raised priority fail against Dark-type Pokemon. It affects every Pokemon, grounded or not, and replaces any other terrain.",
	};
	data.calloftheshrine = {
		name: 'Call of the Shrine',
		num: -32,
		gen: 9,
		rating: 4.5,
		onStart(source) {
			this.field.setTerrain('shrineterrain');
		},
		flags: {},
		shortDesc: "On switch-in, summons Shrine Terrain: Electric/Ghost moves 1.3x; foes' status moves fail vs Ghost types.",
		desc: "On switch-in, this Pokemon summons Shrine Terrain for 5 turns (8 with a Terrain Extender). While it lasts, the power of Electric- and Ghost-type attacks is multiplied by 1.3, and status moves used by other Pokemon fail against Ghost-type Pokemon (a Pokemon's own and its allies' still work). It affects every Pokemon, grounded or not, and replaces any other terrain.",
	};
	return data;
};

exports.moves = (data) => {
	data.abyssalmaw = {
		num: -42,
		gen: 9,
		accuracy: 100,
		basePower: 90,
		category: 'Physical',
		name: 'Abyssal Maw',
		pp: 10,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, bite: 1 },
		// Fishious Rend's test: the target has not acted yet this turn, or has only just come in.
		basePowerCallback(pokemon, target, move) {
			if (target.newlyActivated || this.queue.willMove(target)) {
				this.debug('Abyssal Maw 1.5x');
				return move.basePower * 1.5;
			}
			return move.basePower;
		},
		secondary: null,
		target: 'normal',
		type: 'Dark',
		shortDesc: "1.5x power if the target hasn't moved yet this turn or just switched in. Makuro.",
		desc: "Power is multiplied by 1.5 if the target has not used a move this turn, including a target that switched in this turn. Makes contact; boosted by Strong Jaw. Makuro's signature move.",
	};
	data.shrinebellstrike = {
		num: -43,
		gen: 9,
		accuracy: 100,
		basePower: 85,
		category: 'Physical',
		name: 'Shrine Bell Strike',
		pp: 15,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// The shrine bell reaches every spirit: super effective on Normal types, which a
		// Ghost move would otherwise not touch at all.
		ignoreImmunity: { Ghost: true },
		onEffectiveness(typeMod, target, type) {
			if (type === 'Normal') return 1;
		},
		secondary: { chance: 30, status: 'par' },
		target: 'normal',
		type: 'Ghost',
		shortDesc: "30% chance to paralyze. Super effective on Normal types. Raishin.",
		desc: "Has a 30% chance to paralyze the target. Super effective against Normal-type Pokemon, which are not immune to it. Makes contact. Raishin's signature move.",
	};
	return data;
};

// Every move is ['9M'] except the signatures, learned at level 1 so they read as
// the Pokemon's own. A wide legendary movepool (the owner's call): their own two
// types in depth, the coverage their bodies suggest, and the usual legendary
// utility - no other Pokemon's signature moves.
const MOVES = {
	makuro: {
		signature: ['abyssalmaw'],
		moves: [
			// Water
			'wavecrash', 'liquidation', 'waterfall', 'aquajet', 'aquatail', 'razorshell', 'aquacutter', 'flipturn', 'dive',
			'surf', 'hydropump', 'hydrocannon', 'scald', 'muddywater', 'brine', 'waterpulse', 'chillingwater', 'whirlpool',
			'watergun', 'aquaring', 'raindance', 'soak',
			// Dark
			'crunch', 'knockoff', 'suckerpunch', 'throatchop', 'nightslash', 'jawlock', 'lashout', 'foulplay', 'bite', 'payback',
			'assurance', 'brutalswing', 'thief', 'darkpulse', 'snarl', 'nastyplot', 'taunt', 'torment', 'memento', 'faketears', 'pursuit',
			// Coverage: the jaws, the ice of the deep, the weight of the body
			'icefang', 'psychicfangs', 'firefang', 'thunderfang', 'poisonfang', 'icebeam', 'blizzard', 'iciclecrash', 'avalanche', 'freezedry',
			'earthquake', 'bulldoze', 'highhorsepower', 'stoneedge', 'rockslide', 'rocktomb', 'ironhead', 'heavyslam', 'bodypress',
			'zenheadbutt', 'closecombat', 'superpower', 'outrage', 'dragontail', 'dragonpulse', 'playrough',
			'bodyslam', 'doubleedge', 'headbutt', 'takedown', 'gigaimpact', 'hyperbeam', 'terablast',
			// Setup and utility
			'swordsdance', 'dragondance', 'bulkup', 'calmmind', 'amnesia', 'haze', 'mist', 'snowscape', 'hail', 'roar', 'whirlwind',
			'scaryface', 'yawn', 'encore', 'toxic', 'protect', 'detect', 'rest', 'sleeptalk', 'snore', 'substitute', 'endure',
			'facade', 'helpinghand', 'round',
		],
	},
	raishin: {
		signature: ['shrinebellstrike'],
		moves: [
			// Electric
			'wildcharge', 'supercellslam', 'thunderfang', 'spark', 'nuzzle', 'voltswitch', 'thunderbolt', 'thunder', 'discharge',
			'risingvoltage', 'electroweb', 'thundershock', 'shockwave', 'zapcannon', 'electroball', 'chargebeam', 'thunderwave',
			'charge', 'electricterrain', 'magnetrise', 'eerieimpulse',
			// Ghost
			'poltergeist', 'shadowclaw', 'shadowsneak', 'phantomforce', 'shadowball', 'hex', 'lick', 'astonish', 'nightshade',
			'confuseray', 'willowisp', 'destinybond', 'curse', 'spite', 'grudge', 'painsplit', 'trickortreat',
			// Coverage: the fangs and claws, the shrine's blade and its old magic
			'crunch', 'psychicfangs', 'firefang', 'icefang', 'playrough', 'sacredsword', 'knockoff', 'uturn', 'aerialace', 'acrobatics',
			'irontail', 'zenheadbutt', 'extrasensory', 'psychic', 'dazzlinggleam', 'darkpulse', 'snarl', 'flareblitz', 'trailblaze',
			'quickattack', 'bodyslam', 'doubleedge', 'takedown', 'gigaimpact', 'hyperbeam', 'terablast',
			// Setup and utility
			'swordsdance', 'agility', 'nastyplot', 'calmmind', 'howl', 'safeguard', 'reflect', 'lightscreen', 'futuresight',
			'roar', 'scaryface', 'taunt', 'encore', 'toxic', 'protect', 'detect', 'rest', 'sleeptalk', 'snore', 'substitute',
			'endure', 'facade', 'helpinghand', 'round',
		],
	},
};

exports.learnsets = (data) => {
	for (const [id, { signature, moves }] of Object.entries(MOVES)) {
		const learnset = {};
		for (const move of signature) learnset[move] = ['9L1'];
		for (const move of moves) learnset[move] = ['9M'];
		data[id] = { learnset };
	}
	return data;
};

exports.SPECIES = ['makuro', 'raishin'];
exports.MOVE_IDS = ['abyssalmaw', 'shrinebellstrike'];
exports.ABILITY_IDS = ['calloftheabyss', 'calloftheshrine'];
exports.TERRAINS = ['abyssalterrain', 'shrineterrain'];
exports.LEARNSETS = MOVES;
