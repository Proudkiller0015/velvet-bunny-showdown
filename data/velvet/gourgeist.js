'use strict';
/**
 * Gourgeist (the owner, 28 Oct 2026): its four sizes become one Pokemon that
 * changes size in battle.
 *
 *   Harvest Lantern   on switching in, the foe becomes part Ghost (as Trick-or-Treat).
 *                     At the end of each turn it grows or shrinks one size toward the
 *                     biggest pumpkin that still outspeeds the foe. If no size can,
 *                     it never shrinks for nothing: it grows toward Super. Under
 *                     Trick Room it grows. Its HP percentage stays the same.
 *   Phantom Pursuit   a 70 power Ghost Pursuit: double power on a foe switching out,
 *                     hitting it before it leaves.
 *   Lantern Lunge     a 60 power Ghost move with +1 priority.
 *   Moves             the haunted pumpkin's: its song curses whoever hears it (Sing,
 *                     Perish Song), its hair-like arms seize prey (Mean Look,
 *                     Shadow Claw) and its vines drink (Strength Sap, Horn Leech),
 *                     behind a thorned shell (Spiky Shield). Chilling Mist, a Ghost's ice move, for every size.
 *   Dark moves        a trick-or-treater's: Twilight Exit and Parting Shot to slip away,
 *                     Knock Off for the candy, Sucker Punch from the dark, Carrion Feast
 *                     on what its arms caught, and Taunt.
 *   Tier              NU, all four sizes (tiering.js).
 *
 * Both for the Pumpkaboo line, all four sizes; RP only (the draft is frozen).
 */

const SIZES = ['Small', '', 'Large', 'Super'];
const LINE = ['Pumpkaboo', 'Gourgeist'];
const sizeOf = species => SIZES.indexOf(species.forme || '');
const formeName = (base, i) => SIZES[i] ? `${base}-${SIZES[i]}` : base;
// Our moves borrow an official move's animation; the client has none of its own for them.
const anim = (...names) => function (target, pokemon) {
	this.attrLastMove('[still]');
	for (const name of names) this.add('-anim', pokemon, name, target);
};

exports.abilities = (data) => {
	data.harvestlantern = {
		name: 'Harvest Lantern',
		num: -253,
		gen: 9,
		rating: 3.5,
		onStart(pokemon) {
			for (const foe of pokemon.foes()) {
				if (foe.hasType('Ghost') || !foe.addType('Ghost')) continue;
				this.add('-start', foe, 'typeadd', 'Ghost', '[from] ability: Harvest Lantern', `[of] ${pokemon}`);
			}
		},
		onResidualOrder: 29,
		onResidual(pokemon) {
			const species = pokemon.species;
			if (pokemon.transformed || !LINE.includes(species.baseSpecies)) return;
			const foes = pokemon.foes();
			const now = sizeOf(species);
			if (!foes.length || now < 0) return;
			const foeSpeed = Math.max(...foes.map(foe => foe.getStat('spe')));
			// Its Speed in each size, with the boosts, items and paralysis it has now.
			const speed = this.trunc(pokemon.getStat('spe'));
			const speedAt = i => Math.floor(speed * this.statModify(this.dex.species.get(formeName(species.baseSpecies, i)).baseStats, pokemon.set, 'spe') / pokemon.storedStats.spe);
			let target = 3;
			if (!this.field.getPseudoWeather('trickroom')) {
				for (let i = 0; i < SIZES.length; i++) if (speedAt(i) > foeSpeed) target = i;
			}
			if (target === now) return;
			const next = now + Math.sign(target - now);
			const share = pokemon.hp / pokemon.maxhp;
			this.add('-activate', pokemon, 'ability: Harvest Lantern');
			pokemon.formeChange(formeName(species.baseSpecies, next), this.effect, true);
			// A permanent forme change hands it the new size's first ability: keep this one.
			pokemon.ability = pokemon.baseAbility = 'harvestlantern';
			pokemon.abilityState = this.initEffectState({ id: 'harvestlantern', target: pokemon });
			pokemon.hp = Math.max(1, Math.round(share * pokemon.maxhp));
			this.add('-sethp', pokemon, pokemon.getHealth, '[silent]');
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1 },
		shortDesc: "On entry, foes become part Ghost. Each turn, resizes to just outspeed the foe.",
		desc: "On switch-in, each opposing Pokemon that is not already Ghost type becomes part Ghost, as Trick-or-Treat does. At the end of each turn, this Pokemon grows or shrinks one size toward the biggest size that is still faster than the opposing Pokemon, counting stat stages, items and paralysis. If no size would be faster, it grows toward Super Size instead of shrinking. Under Trick Room it grows. Its HP percentage stays the same when it changes size, and the new size stays when it switches out. Only Pumpkaboo and Gourgeist can change size; this Ability cannot be copied or swapped.",
	};
	return data;
};

exports.moves = (data) => {
	data.lanternlunge = {
		num: -307,
		accuracy: 100,
		basePower: 60,
		category: 'Physical',
		name: 'Lantern Lunge',
		onPrepareHit: anim('Shadow Sneak'),
		pp: 20,
		priority: 1,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: "Usually goes first. Gourgeist's signature.",
		desc: "No additional effect. Moves before most others (+1 priority): the lantern's light leaps out of the dark. Shadow Sneak with 60 power. The Pumpkaboo line's signature move.",
	};
	data.phantompursuit = {
		num: -306,
		accuracy: 100,
		basePower: 70,
		basePowerCallback(pokemon, target, move) {
			if (target.beingCalledBack || target.switchFlag) return move.basePower * 2;
			return move.basePower;
		},
		category: 'Physical',
		name: 'Phantom Pursuit',
		onPrepareHit: anim('Shadow Claw'),
		pp: 20,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		beforeTurnCallback(pokemon) {
			pokemon.addVolatile('phantompursuit', pokemon, this.dex.getActiveMove('phantompursuit'));
		},
		onModifyMove(move, source, target) {
			if (target?.beingCalledBack || target?.switchFlag) {
				move.accuracy = true;
				move.tracksTarget = true;
			}
		},
		// Pursuit's, for this move.
		condition: {
			duration: 1,
			onFoeBeforeSwitchOut(pokemon) {
				const source = this.effectState.source;
				if (!source.isAdjacent(pokemon) || !source.hp ||
					(source.volatiles['encore'] && source.volatiles['encore'].move !== 'phantompursuit') ||
					!this.queue.cancelMove(source)) return;
				if (source.canMegaEvo || source.canUltraBurst || source.canTerastallize) {
					for (const [actionIndex, action] of this.queue.entries()) {
						if (action.pokemon !== source) continue;
						if (action.choice === 'megaEvo') this.actions.runMegaEvo(source);
						else if (action.choice === 'terastallize') this.actions.terastallize(source);
						else continue;
						this.queue.list.splice(actionIndex, 1);
						break;
					}
				}
				pokemon.removeVolatile('destinybond');
				this.actions.runMove('phantompursuit', source, source.getLocOf(pokemon), { sourceEffect: this.effectState.sourceEffect });
			},
		},
		secondary: null,
		target: 'normal',
		type: 'Ghost',
		shortDesc: "If a foe is switching out, hits it at 2x power first. Gourgeist's signature.",
		desc: "If an opposing Pokemon switches out this turn, this move hits it before it leaves the field, at double power and never missing. Pursuit, as a Ghost move. The Pumpkaboo line's signature move.",
	};
	return data;
};

/*
 * The Small and Large sizes have no learnset of their own: the validator reads their base's.
 * Our moves would give them one holding nothing else, and in the National Dex-based RP tiers
 * they then lost every move they were born with. So they start as a copy of their base's.
 */
exports.learnsets = (data) => {
	for (const [id, base] of [['gourgeistsmall', 'gourgeist'], ['gourgeistlarge', 'gourgeist'], ['pumpkaboosmall', 'pumpkaboo'], ['pumpkaboolarge', 'pumpkaboo']]) {
		if (!data[base] || (data[id] && data[id].learnset)) continue;
		data[id] = Object.assign({}, data[id], { learnset: Object.assign({}, data[base].learnset) });
	}
	return data;
};

const LINE_IDS = ['pumpkaboo', 'pumpkaboosmall', 'pumpkaboolarge', 'pumpkaboosuper', 'gourgeist', 'gourgeistsmall', 'gourgeistlarge', 'gourgeistsuper'];
const MOVES = ['phantompursuit', 'lanternlunge', 'sing', 'perishsong', 'meanlook', 'shadowclaw', 'strengthsap', 'hornleech', 'spikyshield', 'chillingmist',
	'twilightexit', 'partingshot', 'knockoff', 'suckerpunch', 'carrionfeast', 'taunt'];
exports.GRANTS = Object.fromEntries(LINE_IDS.map(id => [id, { ability: 'Harvest Lantern', moves: MOVES }]));
exports.MOVE_IDS = ['phantompursuit', 'lanternlunge'];
exports.ABILITY_IDS = ['harvestlantern'];
