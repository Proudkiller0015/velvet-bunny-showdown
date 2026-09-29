'use strict';
/**
 * Makuro, Raishin and Chimai: the Abyss, the Shrine and the Sanctuary.
 *
 * Three new legendaries, a trio, and the first Pokemon this server has added that
 * are meant to be played (Samantha and Nuzleaf-SOLD are illegal on purpose).
 * Designed by the owner; teased on Discord before they were built.
 *
 *   Makuro    Water/Dark      120 / 160 / 120 / 50 / 110 / 120   680
 *             Call of the Abyss: summons Abyssal Terrain on entry.
 *   Raishin   Electric/Ghost  100 / 160 / 100 / 50 / 120 / 150   680
 *             Call of the Shrine: summons Shrine Terrain on entry.
 *   Chimai    Ground/Fairy    120 / 50 / 120 / 160 / 120 / 110   680
 *             Call of the Sanctuary: summons Sanctuary Terrain on entry.
 *
 * The terrains are the trio's real identity, and they share the one terrain
 * slot, so each Pokemon's arrival drowns out the others':
 *
 *   Abyssal Terrain   the field sinks under water (night blue). Water and Dark
 *                     moves 1.3x; priority moves fail against Dark types.
 *   Shrine Terrain    purple lightning over a shrine. Electric and Ghost moves
 *                     1.3x; other Pokemon's status moves fail against Ghost types.
 *   Sanctuary Terrain a pink-lit sanctuary on the earth. Ground and Fairy moves
 *                     1.3x; other Pokemon cannot lower a Fairy type's stats.
 *
 * Each has two signature attacks that grow stronger in its own terrain, and a
 * wide legendary movepool (the owner: "better than Zacian", "look at Dialga").
 *
 * Unlike the four official terrains none asks whether a Pokemon is grounded: the
 * Abyss is the whole field under water, and a ward is not something you fly
 * over. They are named "... Terrain" because the client decides a field effect is
 * a terrain by the id ending in "terrain" - that is what makes one replace another
 * on screen and what picks the backdrop (client/style/velvet.css).
 *
 * They are Restricted Legendaries (src/rarity.js files them as box art: never wild)
 * with positive national numbers past the real dex, since a negative one collides
 * with the CAP Pokemon (-1 is Syclar as well as Samantha) and the client reads a
 * negative number as nonstandard. Tier: Ubers, the owner's call.
 */

exports.pokedex = (data) => {
	data.makuro = {
		num: 2001,
		gen: 9,
		name: 'Makuro',
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
		name: 'Raishin',
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
	data.chimai = {
		num: 2003,
		gen: 9,
		name: 'Chimai',
		types: ['Ground', 'Fairy'],
		gender: 'N',
		baseStats: { hp: 120, atk: 50, def: 120, spa: 160, spd: 120, spe: 110 },
		abilities: { 0: 'Call of the Sanctuary' },
		heightm: 2.6,
		weightkg: 240,
		color: 'Brown',
		eggGroups: ['Undiscovered'],
		tags: ['Restricted Legendary'],
	};
	return data;
};

exports.formatsData = (data) => {
	// Legal from RP Ubers up (the owner's call); refused in RP OU and below.
	for (const id of ['makuro', 'raishin', 'chimai']) {
		data[id] = { isNonstandard: null, tier: 'Uber', doublesTier: 'DUber', natDexTier: 'Uber' };
	}
	return data;
};

/** The terrains, found by id through the Conditions table (see index.js). */
function terrain({ name, types, blocks, startText, extra }) {
	return {
		...extra,
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
			if (!blocks || !blocks(target, source, move)) return;
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
	data.sanctuaryterrain = terrain({
		name: 'Sanctuary Terrain',
		types: ['Ground', 'Fairy'],
		startText: 'Ground and Fairy moves grow stronger, and Fairy types are sheltered from having their stats lowered.',
		// The shelter: Mist's rule, for Fairy types - another Pokemon's move or ability
		// (Intimidate, Parting Shot, a Moonblast's drop...) cannot lower their stats.
		extra: {
			onTryBoost(boost, target, source, effect) {
				if (!target.hasType('Fairy') || !source || target === source) return;
				let blocked = false;
				for (const stat in boost) {
					if (boost[stat] < 0) {
						delete boost[stat];
						blocked = true;
					}
				}
				if (blocked && !(effect && effect.secondaries)) this.add('-activate', target, 'move: Sanctuary Terrain');
			},
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
	data.callofthesanctuary = {
		name: 'Call of the Sanctuary',
		num: -33,
		gen: 9,
		rating: 4.5,
		onStart(source) {
			this.field.setTerrain('sanctuaryterrain');
		},
		flags: {},
		shortDesc: "On switch-in, summons Sanctuary Terrain: Ground/Fairy moves 1.3x; others can't lower Fairy types' stats.",
		desc: "On switch-in, this Pokemon summons Sanctuary Terrain for 5 turns (8 with a Terrain Extender). While it lasts, the power of Ground- and Fairy-type attacks is multiplied by 1.3, and other Pokemon cannot lower the stats of Fairy-type Pokemon (Intimidate, stat-dropping moves and their side effects all fail); a Pokemon can still lower its own. It affects every Pokemon, grounded or not, and replaces any other terrain.",
	};
	return data;
};

/*
 * Two signatures each, all 120 power and 100% accurate with a side effect worth
 * having and no drawback (the owner's rule), each one better in its own terrain -
 * the way Behemoth Blade is the whole of Zacian, these are the whole of the trio.
 */
exports.moves = (data) => {
	const sig = (id, row) => {
		data[id] = { gen: 9, accuracy: 100, basePower: 120, pp: 10, priority: 0, target: 'normal', ...row };
	};
	// ---- Makuro
	sig('abyssalmaw', {
		num: -42, name: 'Abyssal Maw', type: 'Dark', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, bite: 1 },
		// Dragged into the deep: Spirit Shackle's trap, for as long as the user stays in -
		// and in the Abyss the jaws hold on hard enough to draw strength back out.
		onModifyMove(move) {
			if (this.field.isTerrain('abyssalterrain')) move.drain = [1, 4];
		},
		secondary: {
			chance: 100,
			onHit(target, source, move) {
				if (source.isActive) target.addVolatile('trapped', source, move, 'trapper');
			},
		},
		shortDesc: "Traps the target. In Abyssal Terrain, heals 1/4 of the damage. Makuro.",
		desc: "Prevents the target from switching out while the user remains active (a Ghost type, or a Pokemon holding Shed Shell, still can). While Abyssal Terrain is active the user also recovers 1/4 of the HP lost by the target. Makes contact; boosted by Strong Jaw. Makuro's signature move.",
	});
	sig('leviathancrash', {
		num: -45, name: 'Leviathan Crash', type: 'Water', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// The weight of the deep: the target is dragged down (Speed), always in the Abyss.
		secondary: { chance: 50, boosts: { spe: -1 } },
		onModifyMove(move) {
			if (this.field.isTerrain('abyssalterrain') && move.secondaries) {
				for (const s of move.secondaries) if (s.boosts) s.chance = 100;
			}
		},
		shortDesc: "50% chance to lower Speed by 1; always in Abyssal Terrain. No recoil. Makuro.",
		desc: "Has a 50% chance to lower the target's Speed by 1 stage, raised to 100% while Abyssal Terrain is active. No recoil. Makes contact. Makuro's signature move.",
	});
	// ---- Raishin
	sig('shrinebellstrike', {
		num: -43, name: 'Shrine Bell Strike', type: 'Ghost', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// The shrine bell reaches every spirit: super effective on Normal types, which a
		// Ghost move would otherwise not touch at all.
		ignoreImmunity: { Ghost: true },
		onEffectiveness(typeMod, target, type) {
			if (type === 'Normal') return 1;
		},
		// Rung in its own shrine, it always finds the weak spot.
		onModifyMove(move) {
			if (this.field.isTerrain('shrineterrain')) move.willCrit = true;
		},
		secondary: { chance: 30, status: 'par' },
		shortDesc: "30% par. Super effective on Normal. Always crits in Shrine Terrain. Raishin.",
		desc: "Has a 30% chance to paralyze the target. Super effective against Normal-type Pokemon, which are not immune to it. Always results in a critical hit while Shrine Terrain is active. Makes contact. Raishin's signature move.",
	});
	sig('spiritthunder', {
		num: -46, name: 'Spirit Thunder', type: 'Electric', category: 'Physical',
		flags: { protect: 1, mirror: 1, metronome: 1 },
		// No guard counts against it (Sacred Sword's rule), and in its own shrine the
		// paralysis always takes.
		ignoreDefensive: true,
		ignoreEvasion: true,
		secondary: { chance: 30, status: 'par' },
		onModifyMove(move) {
			if (this.field.isTerrain('shrineterrain') && move.secondaries) {
				for (const s of move.secondaries) if (s.status === 'par') s.chance = 100;
			}
		},
		shortDesc: "Ignores the target's stat changes. 30% par; always in Shrine Terrain. Raishin.",
		desc: "Ignores the target's stat stage changes, except Speed. Has a 30% chance to paralyze the target, raised to 100% while Shrine Terrain is active. Raishin's signature move.",
	});
	// ---- Chimai
	sig('sanctuarypulse', {
		num: -44, name: 'Sanctuary Pulse', type: 'Fairy', category: 'Special',
		flags: { protect: 1, mirror: 1, metronome: 1, pulse: 1, heal: 1 },
		// The sanctuary gives back: a third of the damage, half inside its walls.
		drain: [1, 3],
		onModifyMove(move) {
			if (this.field.isTerrain('sanctuaryterrain')) move.drain = [1, 2];
		},
		secondary: null,
		shortDesc: "User heals 1/3 of the damage dealt; 1/2 in Sanctuary Terrain. Chimai.",
		desc: "The user recovers 1/3 of the HP lost by the target, or 1/2 while Sanctuary Terrain is active, rounded half up. Boosted by Mega Launcher. Chimai's signature move.",
	});
	sig('hallowedquake', {
		num: -47, name: 'Hallowed Quake', type: 'Ground', category: 'Special',
		flags: { protect: 1, mirror: 1, metronome: 1, nonsky: 1 },
		// Shakes loose whatever the target built up; within the sanctuary the ground
		// reaches everyone, Flying types and Levitate included.
		onModifyMove(move) {
			if (this.field.isTerrain('sanctuaryterrain')) move.ignoreImmunity = { Ground: true };
		},
		onHit(target) {
			if (!target.hp) return;
			if (Object.values(target.boosts).some(b => b > 0)) {
				for (const stat in target.boosts) if (target.boosts[stat] > 0) target.boosts[stat] = 0;
				this.add('-clearpositiveboost', target, target, 'move: Hallowed Quake');
			}
		},
		secondary: null,
		shortDesc: "Clears the target's boosts. Hits Flying/Levitate in Sanctuary Terrain. Chimai.",
		desc: "Removes the target's positive stat stages. While Sanctuary Terrain is active it also hits Flying-type Pokemon and Pokemon with Levitate or an Air Balloon. Chimai's signature move.",
	});
	return data;
};

/*
 * The movepools: wide, like a box legend's (Dialga's 92), with real options in
 * both categories, coverage across many types, and the utility a legendary gets -
 * but nothing that is only there to pad the list, and no other Pokemon's signature.
 * Every move is ['9M'] except the signatures, learned at level 1.
 */
const MOVES = {
	makuro: {
		signature: ['abyssalmaw', 'leviathancrash'],
		moves: [
			// Water
			'wavecrash', 'liquidation', 'waterfall', 'aquajet', 'aquatail', 'razorshell', 'aquacutter', 'flipturn', 'dive',
			'surf', 'hydropump', 'hydrocannon', 'scald', 'muddywater', 'whirlpool', 'raindance',
			// Dark
			'knockoff', 'suckerpunch', 'throatchop', 'crunch', 'nightslash', 'jawlock', 'lashout', 'foulplay', 'partingshot',
			'darkpulse', 'snarl', 'pursuit', 'taunt', 'torment', 'memento',
			// Coverage: the jaws, the ice of the deep, the weight of the body
			'icefang', 'psychicfangs', 'firefang', 'thunderfang', 'poisonfang', 'iciclecrash', 'icespinner', 'tripleaxel', 'icebeam',
			'blizzard', 'earthquake', 'highhorsepower', 'stompingtantrum', 'stoneedge', 'rockslide', 'ironhead', 'heavyslam',
			'bodypress', 'zenheadbutt', 'closecombat', 'superpower', 'outrage', 'dragontail', 'scaleshot', 'playrough', 'gunkshot',
			'bodyslam', 'doubleedge', 'gigaimpact', 'hyperbeam', 'terablast',
			// Setup and utility
			'swordsdance', 'dragondance', 'bulkup', 'curse', 'haze', 'roar', 'whirlwind', 'yawn', 'encore', 'toxic', 'snowscape',
			'recover', 'protect', 'detect', 'rest', 'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand', 'scaryface',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			'wavecharge', 'carrionfeast', 'rimecleaver', 'craghammer', 'hustleup', 'twilightexit', 'shufflejab', 'undertow',
		],
	},
	raishin: {
		signature: ['shrinebellstrike', 'spiritthunder'],
		moves: [
			// Electric
			'supercellslam', 'wildcharge', 'thunderfang', 'voltswitch', 'nuzzle', 'thunderbolt', 'thunder', 'risingvoltage',
			'discharge', 'electroweb', 'thunderwave', 'charge', 'electricterrain', 'magnetrise',
			// Ghost
			'poltergeist', 'shadowclaw', 'shadowsneak', 'phantomforce', 'shadowball', 'hex', 'nightshade', 'willowisp',
			'destinybond', 'curse', 'spite', 'painsplit', 'confuseray',
			// Coverage: the fangs and claws, the shrine's blade, its old magic and its fire
			'closecombat', 'sacredsword', 'playrough', 'crunch', 'knockoff', 'suckerpunch', 'psychicfangs', 'firefang', 'icefang',
			'flareblitz', 'bravebird', 'acrobatics', 'uturn', 'irontail', 'zenheadbutt', 'psychocut', 'leafblade', 'xscissor',
			'extrasensory', 'dazzlinggleam', 'darkpulse', 'quickattack', 'bodyslam', 'doubleedge', 'gigaimpact', 'hyperbeam',
			'terablast',
			// Setup and utility
			'swordsdance', 'agility', 'bulkup', 'safeguard', 'reflect', 'lightscreen', 'roar', 'taunt', 'encore', 'toxic', 'trick',
			'recover', 'protect', 'detect', 'rest', 'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand', 'scaryface',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			'voltaiclance', 'sparkscamper', 'carrionfeast', 'rimecleaver', 'craghammer', 'hivefrenzy', 'shufflejab', 'hustleup', 'twilightexit',
		],
	},
	chimai: {
		signature: ['sanctuarypulse', 'hallowedquake'],
		moves: [
			// Ground
			'earthpower', 'scorchingsands', 'mudshot', 'sandtomb', 'earthquake', 'bulldoze', 'highhorsepower', 'stompingtantrum',
			'sandstorm', 'stealthrock', 'spikes',
			// Fairy
			'moonblast', 'dazzlinggleam', 'drainingkiss', 'mistyexplosion', 'playrough', 'mistyterrain', 'moonlight', 'charm', 'decorate',
			// Coverage: the sanctuary's old magic, its stone and its flame
			'psychic', 'psyshock', 'futuresight', 'extrasensory', 'powergem', 'meteorbeam', 'flamethrower', 'fireblast',
			'mysticalfire', 'heatwave', 'energyball', 'gigadrain', 'grassknot', 'shadowball', 'aurasphere', 'focusblast', 'sludgebomb',
			'hypervoice', 'icebeam', 'thunderbolt', 'darkpulse', 'dragonpulse', 'bodypress', 'hyperbeam', 'terablast',
			// Setup and utility
			'calmmind', 'nastyplot', 'irondefense', 'amnesia', 'wish', 'healbell', 'safeguard', 'reflect', 'lightscreen', 'trickroom',
			'gravity', 'sunnyday', 'roar', 'whirlwind', 'taunt', 'encore', 'toxic', 'yawn', 'trick', 'recover', 'protect', 'detect', 'rest',
			'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			// A dancer (the owner): every dance there is, Quiver Dance for its Speed first.
			'quiverdance', 'dragondance', 'victorydance', 'clangoroussoul', 'fierydance', 'revelationdance', 'aquastep', 'petaldance',
			'featherdance', 'teeterdance', 'lunardance', 'swordsdance', 'raindance',
			'tremorshot', 'oxidize', 'undertow', 'hypnowhirl', 'solarnectar', 'chrysalisveil', 'twilightexit',
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

exports.SPECIES = ['makuro', 'raishin', 'chimai'];
exports.MOVE_IDS = ['abyssalmaw', 'leviathancrash', 'shrinebellstrike', 'spiritthunder', 'sanctuarypulse', 'hallowedquake'];
exports.ABILITY_IDS = ['calloftheabyss', 'calloftheshrine', 'callofthesanctuary'];
exports.TERRAINS = ['abyssalterrain', 'shrineterrain', 'sanctuaryterrain'];
exports.LEARNSETS = MOVES;
