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

exports.moves = (data) => {
	/*
	 * The six signatures, reworked to be equal (the owner: crits "too broken", heal and
	 * Speed drops "unoriginal"). Every one: 120 power, 100% accurate, ignores the
	 * target's stat changes, and in its own terrain goes through Protect and
	 * Substitute. Each keeps exactly one effect of its own, all of them disruption.
	 */
	const OWN = { abyssalmaw: 'abyssalterrain', leviathancrash: 'abyssalterrain', shrinebellstrike: 'shrineterrain', spiritthunder: 'shrineterrain', sanctuarypulse: 'sanctuaryterrain', hallowedquake: 'sanctuaryterrain' };
	const sig = (id, row) => {
		data[id] = {
			gen: 9, accuracy: 100, basePower: 120, pp: 10, priority: 0, target: 'normal',
			ignoreDefensive: true, ignoreEvasion: true,
			onModifyMove(move) {
				if (!this.field.isTerrain(OWN[move.id])) return;
				// Through Protect (the flag the protections check) and through Substitute.
				move.flags = { ...move.flags };
				delete move.flags['protect'];
				move.infiltrates = true;
			},
			secondary: null,
			...row,
		};
	};
	const TERRAIN_NOTE = "Ignores the target's stat stage changes. In its own terrain it also goes through Protect and Substitute.";
	// ---- Makuro
	sig('abyssalmaw', {
		num: -42, name: 'Abyssal Maw', type: 'Dark', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, bite: 1 },
		// The abyss swallows its power: Gastro Acid for as long as the target stays in.
		onHit(target) {
			if (target.hp && !target.getAbility().flags['cantsuppress'] && !target.volatiles['gastroacid']) target.addVolatile('gastroacid');
		},
		shortDesc: "Suppresses the target's ability while it stays in. Makuro.",
		desc: "The target's Ability is suppressed until it switches out, as Gastro Acid does. " + TERRAIN_NOTE + " Boosted by Strong Jaw. Makuro's signature move.",
	});
	sig('leviathancrash', {
		num: -45, name: 'Leviathan Crash', type: 'Water', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// A tidal wave: the foe's screens are torn down and Makuro's side is washed clean.
		onAfterHit(target, source) {
			if (!source.hp) return;
			for (const screen of ['reflect', 'lightscreen', 'auroraveil']) {
				if (target.side.removeSideCondition(screen)) this.add('-sideend', target.side, this.dex.conditions.get(screen).name, '[from] move: Leviathan Crash', `[of] ${source}`);
			}
			for (const hazard of ['spikes', 'toxicspikes', 'stealthrock', 'stickyweb', 'gmaxsteelsurge']) {
				if (source.side.removeSideCondition(hazard)) this.add('-sideend', source.side, this.dex.conditions.get(hazard).name, '[from] move: Leviathan Crash', `[of] ${source}`);
			}
		},
		shortDesc: "Removes the target side's screens and the user side's hazards. Makuro.",
		desc: "After hitting, removes Reflect, Light Screen and Aurora Veil from the target's side, and Spikes, Toxic Spikes, Stealth Rock, Sticky Web and G-Max Steelsurge from the user's side. " + TERRAIN_NOTE + " Makuro's signature move.",
	});
	// ---- Raishin
	sig('shrinebellstrike', {
		num: -43, name: 'Shrine Bell Strike', type: 'Ghost', category: 'Physical',
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// The bell silences: Taunt, three turns. It reaches Normal types, as a bell would.
		ignoreImmunity: { Ghost: true },
		onHit(target) {
			if (target.hp && !target.volatiles['taunt']) target.addVolatile('taunt');
		},
		shortDesc: "Taunts the target for 3 turns. Hits Normal types. Raishin.",
		desc: "The target is Taunted for 3 turns: it can only use attacking moves. Normal-type Pokemon are not immune to it. " + TERRAIN_NOTE + " Raishin's signature move.",
	});
	sig('spiritthunder', {
		num: -46, name: 'Spirit Thunder', type: 'Electric', category: 'Physical',
		flags: { protect: 1, mirror: 1, metronome: 1 },
		// The spirit seals what it just saw: the target's last move is Disabled.
		onHit(target, source) {
			if (target.hp && target.lastMove && !target.volatiles['disable']) target.addVolatile('disable', source);
		},
		shortDesc: "Disables the target's last used move. Raishin.",
		desc: "The last move the target used is Disabled for 4 turns, as Disable does. " + TERRAIN_NOTE + " Raishin's signature move.",
	});
	// ---- Chimai
	sig('sanctuarypulse', {
		num: -44, name: 'Sanctuary Pulse', type: 'Fairy', category: 'Special',
		flags: { protect: 1, mirror: 1, metronome: 1, pulse: 1 },
		// Purification: every status on Chimai's side is cured, as Heal Bell does.
		onAfterHit(target, source) {
			let cured = false;
			for (const ally of source.side.pokemon) if (ally.status && ally.hp) { ally.cureStatus(true); cured = true; }
			if (cured) this.add('-cureteam', source, '[from] move: Sanctuary Pulse');
		},
		shortDesc: "Cures the status of every Pokemon on the user's side. Chimai.",
		desc: "After hitting, every Pokemon on the user's side, in battle or not, is cured of its non-volatile status condition, as Heal Bell does. " + TERRAIN_NOTE + " Boosted by Mega Launcher. Chimai's signature move.",
	});
	sig('hallowedquake', {
		num: -47, name: 'Hallowed Quake', type: 'Ground', category: 'Special',
		flags: { protect: 1, mirror: 1, metronome: 1, nonsky: 1 },
		// The sacred ground seals the target's item: Embargo, five turns.
		onHit(target) {
			if (target.hp && !target.volatiles['embargo']) target.addVolatile('embargo');
		},
		shortDesc: "Embargoes the target's item for 5 turns. Chimai.",
		desc: "The target can't use its held item for 5 turns, as Embargo does. " + TERRAIN_NOTE + " Chimai's signature move.",
	});
	// Warped Hourglass: the room lasts 8 turns when its holder sets it.
	if (data.trickroom && data.trickroom.condition) {
		const original = data.trickroom.condition.durationCallback;
		data.trickroom = { ...data.trickroom, condition: { ...data.trickroom.condition, durationCallback(source, effect) {
			if (source?.hasItem('warpedhourglass')) return 8;
			return original ? original.call(this, source, effect) : 5;
		} } };
	}
	// ---- The trio's shared signature: Tail Glow for the physical side (the owner).
	data.sovereignrite = {
		num: -50, gen: 9, name: 'Sovereign Rite', type: 'Normal', category: 'Status',
		basePower: 0, accuracy: true, pp: 10, priority: 0,
		flags: { snatch: 1, metronome: 1 },
		boosts: { atk: 3 },
		secondary: null,
		target: 'self',
		shortDesc: "Raises the user's Attack by 3. Makuro, Raishin and Chimai.",
		desc: "Raises the user's Attack by 3 stages. The signature move shared by Makuro, Raishin and Chimai, as Tail Glow is to Special Attack.",
	};
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
		signature: ['abyssalmaw', 'leviathancrash', 'sovereignrite'],
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
			'cottonguard', 'velvetguard', 'velvetpress', 'tailglow', 'recover', 'protect', 'detect', 'rest', 'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand', 'scaryface',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			'wavecharge', 'carrionfeast', 'rimecleaver', 'craghammer', 'hustleup', 'twilightexit', 'shufflejab', 'undertow',
			// Utility and pivots (the owner: "more utility, Knock Off etc, ways to rotate").
			'uturn', 'stealthrock', 'rapidspin', 'defog', 'courtchange', 'trick', 'trickroom',
		],
	},
	raishin: {
		signature: ['shrinebellstrike', 'spiritthunder', 'sovereignrite'],
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
			'cottonguard', 'velvetguard', 'velvetpress', 'tailglow', 'recover', 'protect', 'detect', 'rest', 'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand', 'scaryface',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			'voltaiclance', 'sparkscamper', 'carrionfeast', 'rimecleaver', 'craghammer', 'hivefrenzy', 'shufflejab', 'hustleup', 'twilightexit',
			// Utility and pivots (the owner: "more utility, Knock Off etc, ways to rotate").
			'partingshot', 'teleport', 'batonpass', 'defog', 'healbell', 'memento', 'trickroom',
		],
	},
	chimai: {
		signature: ['sanctuarypulse', 'hallowedquake', 'sovereignrite'],
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
			'gravity', 'sunnyday', 'roar', 'whirlwind', 'taunt', 'encore', 'toxic', 'yawn', 'trick', 'cottonguard', 'velvetguard', 'velvetpress', 'tailglow', 'recover', 'protect', 'detect', 'rest',
			'sleeptalk', 'substitute', 'endure', 'facade', 'helpinghand',
			// This server's own shared moves (balance-patch-1.js), where they fit.
			// A dancer (the owner): every dance there is, Quiver Dance for its Speed first.
			'quiverdance', 'dragondance', 'victorydance', 'clangoroussoul', 'fierydance', 'revelationdance', 'aquastep', 'petaldance',
			'featherdance', 'teeterdance', 'lunardance', 'swordsdance', 'raindance',
			'tremorshot', 'oxidize', 'undertow', 'hypnowhirl', 'solarnectar', 'chrysalisveil', 'twilightexit',
			// Utility and pivots (the owner: "more utility, Knock Off etc, ways to rotate").
			'knockoff', 'uturn', 'teleport', 'batonpass', 'healingwish', 'memento', 'toxicspikes', 'defog', 'courtchange', 'thunderwave',
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

/*
 * The signature items (the owner: "invert their Speed and worst attacking stat, for
 * Trick Room, 1.2 power on all their moves"). Held by its owner, each swaps the
 * Pokemon's Speed with its weaker attacking stat - Makuro becomes a 50-Speed Trick
 * Room attacker with 120 Sp. Atk - and powers every move it uses by 1.2x.
 *
 * The swap is done in the stat hooks rather than by trading storedStats (as Power
 * Trick does), because stored stats outlive a switch and a swap on every entry
 * would undo itself on the second one. Each hook takes the other stat's stored
 * value and keeps whatever boosts and modifiers were applied to its own.
 * Positive numbers, like the Z-A stones: National Dex treats a negative item as
 * not existing.
 */
const ITEMS = {
	abyssalpearl: { num: 3001, name: 'Abyssal Pearl', owner: 'makuro', worst: 'spa', spritenum: 94 },
	shrinebell: { num: 3002, name: 'Shrine Bell', owner: 'raishin', worst: 'spa', spritenum: 461 },
	sanctuarylotus: { num: 3003, name: 'Sanctuary Lotus', owner: 'chimai', worst: 'atk', spritenum: 610 },
};
const STAT_NAMES = { atk: 'Attack', spa: 'Sp. Atk' };

exports.items = (data) => {
	for (const [id, it] of Object.entries(ITEMS)) {
		const mine = pokemon => pokemon && pokemon.baseSpecies.id === it.owner;
		const swapped = (value, pokemon, from, to) => {
			const own = pokemon.storedStats[from];
			return own ? Math.floor(pokemon.storedStats[to] * value / own) : value;
		};
		const owner = it.owner.charAt(0).toUpperCase() + it.owner.slice(1);
		const item = {
			num: it.num, gen: 9, name: it.name, spritenum: it.spritenum, isNonstandard: null,
			itemUser: [owner],
			fling: { basePower: 30 },
			onModifySpePriority: 1,
			onModifySpe(spe, pokemon) {
				if (mine(pokemon)) return swapped(spe, pokemon, 'spe', it.worst);
			},
			onBasePowerPriority: 15,
			onBasePower(basePower, user) {
				if (mine(user)) return this.chainModify([4915, 4096]);
			},
			// Like Rusted Sword: it never leaves its owner, and nobody takes it from one.
			onTakeItem(item, pokemon, source) {
				return !(mine(pokemon) || mine(source));
			},
			desc: `If held by ${owner}, its Speed and ${STAT_NAMES[it.worst]} are swapped (for Trick Room), and the power of all its moves is multiplied by 1.2. Can't be removed from ${owner} or stolen by one.`,
			shortDesc: `${owner}: swaps Speed and ${STAT_NAMES[it.worst]}; all its moves 1.2x power.`,
		};
		item[it.worst === 'spa' ? 'onModifySpAPriority' : 'onModifyAtkPriority'] = 1;
		item[it.worst === 'spa' ? 'onModifySpA' : 'onModifyAtk'] = function (value, pokemon) {
			if (mine(pokemon)) return swapped(value, pokemon, it.worst, 'spe');
		};
		data[id] = item;
	}
	// Warped Hourglass (the owner): Light Clay for Trick Room - any Pokemon, 8 turns
	// instead of 5 when the holder sets the room (Twilight Exit included). The turns
	// are decided by Trick Room's own durationCallback, patched in moves() below.
	data.warpedhourglass = {
		num: 3004, gen: 9, name: 'Warped Hourglass', spritenum: 717, isNonstandard: null,
		fling: { basePower: 10 },
		desc: "If the holder sets Trick Room, it lasts 8 turns instead of 5 (Persistent still makes it 7 on a holder without this item).",
		shortDesc: "Holder's Trick Room lasts 8 turns instead of 5.",
	};
	return data;
};
exports.ITEM_IDS = [...Object.keys(ITEMS), 'warpedhourglass'];

exports.SPECIES = ['makuro', 'raishin', 'chimai'];
exports.MOVE_IDS = ['abyssalmaw', 'leviathancrash', 'shrinebellstrike', 'spiritthunder', 'sanctuarypulse', 'hallowedquake', 'sovereignrite'];
exports.ABILITY_IDS = ['calloftheabyss', 'calloftheshrine', 'callofthesanctuary'];
exports.TERRAINS = ['abyssalterrain', 'shrineterrain', 'sanctuaryterrain'];
exports.LEARNSETS = MOVES;
