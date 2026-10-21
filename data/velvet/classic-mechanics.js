'use strict';
/**
 * Old-generation mechanics brought back into RP (the owner, 29 Sep 2026).
 *
 *   Belly Drum    Gen 2's: at half HP or less it doesn't fail - it raises Attack by
 *                 2 and costs nothing. Above half HP it is the usual half HP for +6.
 *   Recharging    Gen 1's: Hyper Beam and every other recharge move skips the
 *                 recharge turn when it knocks the target out.
 */

exports.moves = (data) => {
	/*
	 * Pursuit catching a switch says so (owner, 2 Oct 2026: "pursuit message missing").
	 * This version of the move hits the Pokemon on its way out and never announces it, so a
	 * Dragapult simply took a Pursuit and fainted with no "is being withdrawn..." line - the
	 * line the client has had text for all along. Sent just before the hit, as it always was.
	 */
	const pursuit = data.pursuit;
	if (pursuit && pursuit.condition && pursuit.condition.onFoeBeforeSwitchOut) {
		const chase = pursuit.condition.onFoeBeforeSwitchOut;
		data.pursuit = {
			...pursuit,
			condition: {
				...pursuit.condition,
				onFoeBeforeSwitchOut(pokemon) {
					const source = this.effectState.source;
					const willChase = source && source.hp && source.isAdjacent(pokemon) && !(source.volatiles['encore'] && source.volatiles['encore'].move !== 'pursuit') && this.queue.willMove(source);
					if (willChase) this.add('-activate', pokemon, 'move: Pursuit');
					return chase.call(this, pokemon);
				},
			},
		};
	}
	/*
	 * The same gap, found by scripts/audit-messages.js: text the client has and the move
	 * never asks for. Brick Break, Psychic Fangs and Raging Bull took the screens down in
	 * silence ("Reflect wore off", as if it had run out); they say they shattered them now.
	 */
	for (const id of ['brickbreak', 'psychicfangs', 'ragingbull']) {
		const breaker = data[id];
		if (!breaker || !breaker.onTryHit) continue;
		const shatter = breaker.onTryHit;
		data[id] = {
			...breaker,
			onTryHit(target, source, move) {
				if (['reflect', 'lightscreen', 'auroraveil'].some(c => target.side.getSideCondition(c))) {
					this.add('-activate', source, 'move: Brick Break', `[of] ${target}`);
				}
				return shatter.call(this, target, source, move);
			},
		};
	}
	// Beat Up: each hit is one of the party's, and says whose.
	const beatUp = data.beatup;
	if (beatUp && beatUp.basePowerCallback) {
		const power = beatUp.basePowerCallback;
		data.beatup = {
			...beatUp,
			basePowerCallback(pokemon, target, move) {
				const ally = move.allies && move.allies[0];
				if (ally && ally.name) this.add('-activate', pokemon, 'move: Beat Up', `[of] ${ally.name}`);
				return power.call(this, pokemon, target, move);
			},
		};
	}
	const belly = data.bellydrum;
	if (belly) {
		data.bellydrum = {
			...belly,
			onHit(target) {
				if (target.boosts.atk >= 6 || target.maxhp === 1) return false;
				if (target.hp <= target.maxhp / 2) {
					this.boost({ atk: 2 }, target);
					return;
				}
				this.directDamage(target.maxhp / 2);
				this.boost({ atk: 12 }, target);
			},
			shortDesc: "User loses 50% max HP. Maximizes Attack. At 50% HP or less: +2 Atk, no HP cost.",
			desc: "Raises the user's Attack by 12 stages in exchange for the user losing 1/2 of its maximum HP, rounded down. If the user has 1/2 of its maximum HP or less, it instead raises its Attack by 2 stages and loses no HP, as in Generation 2. Fails if the user's Attack is already +6.",
		};
	}
	/*
	 * Rest and Sleep Talk, Gen 2's (the owner, 21 Oct 2026: "add gen 2 Sleep Talk", "gen 2 Rest").
	 *
	 * Read off pokemon-showdown's own Gen 2 mod (data/mods/gen2/moves.ts and conditions.ts;
	 * Gen 2 inherits Gen 3 and replaces both of these outright). What differs from Gen 9:
	 *
	 *   Rest      - Works while the user is already asleep. Gen 9's Rest fails on a sleeping
	 *               user, so Sleep Talk calling Rest did nothing; in Gen 2 it restarts the sleep
	 *               at Rest's count and heals to full again ("RestTalk": the sleeper keeps
	 *               resetting its own nap). The status is announced again ("-status ... [from]
	 *               move: Rest") instead of being set, and the sleep counts as self-inflicted.
	 *             - Fails only at full HP. Gen 9 adds the abilities; abilities did not exist in
	 *               Gen 2, so those checks are kept (Comatose, Insomnia, Vital Spirit), as Gen 2
	 *               itself would have refused the sleep through setStatus.
	 *             - The counter is the same 3 in both: asleep for two turns, waking on the third
	 *               and acting that turn. Rest restarted on a turn the counter already ticked
	 *               starts again from 3.
	 *   Sleep Talk - Gen 2's picks from the same moves as Gen 9's (not itself or any other
	 *               nosleeptalk move, no charge moves), and the picked move costs no PP in either.
	 *               What Gen 9 adds is leaving out Z-Moves and Max Moves, which Gen 2 did not
	 *               have; that stays, as a Z-Move cannot be called here either way. So Sleep
	 *               Talk's own code changes nothing: Gen 2's RestTalk lives in Rest. Its flags
	 *               (Gen 2: no noassist/failcopycat/failmimic/failinstruct, and no Sketch)
	 *               concern other moves calling or copying Sleep Talk, and stay Gen 9's.
	 *   Sleep     - Waking: both wake at the start of the turn the counter runs out and act
	 *               that same turn. Unchanged. (Gen 2's ordinary sleep lasts 1-7 turns rather
	 *               than 1-3; that is sleep itself, not Rest, and is not part of this.)
	 *
	 * Only the description of Sleep Talk changes, to say what it calls Rest into doing.
	 * test/classic-moves.test.js plays the same turns in [Gen 2] Custom Game and here.
	 */
	const rest = data.rest;
	if (rest) {
		data.rest = {
			...rest,
			onTry(source) {
				if (source.hasAbility('comatose')) return false;
				if (source.hp === source.maxhp) {
					this.add('-fail', source, 'heal');
					return null;
				}
				if (source.status === 'slp') return;
				if (source.hasAbility('insomnia')) {
					this.add('-fail', source, '[from] ability: Insomnia', `[of] ${source}`);
					return null;
				}
				if (source.hasAbility('vitalspirit')) {
					this.add('-fail', source, '[from] ability: Vital Spirit', `[of] ${source}`);
					return null;
				}
			},
			onHit(target, source, move) {
				if (target.status !== 'slp') {
					const result = target.setStatus('slp', source, move);
					if (!result) return result;
				} else {
					this.add('-status', target, 'slp', '[from] move: Rest');
				}
				target.statusState.time = 3;
				target.statusState.startTime = 3;
				target.statusState.source = target;
				this.heal(target.maxhp);
			},
			shortDesc: "User sleeps 2 turns and restores HP and status. Works while asleep.",
			desc: "The user falls asleep for the next two turns and restores all of its HP, curing itself of any non-volatile status condition in the process. As in Generation 2, it also works if the user is already asleep (called by Sleep Talk): the sleep starts over at two turns and the HP is restored again. Fails if the user has full HP or if another effect prevents it from falling asleep.",
		};
	}
	if (data.sleeptalk) {
		data.sleeptalk = {
			...data.sleeptalk,
			desc: "One of the user's known moves, besides this move, is selected for use at random. Fails if the user is not asleep. The selected move does not have PP deducted from it, and can currently have 0 PP. If it selects Rest, Rest works as in Generation 2: the user's sleep starts over at two turns and its HP is restored. This move cannot select Assist, Beak Blast, Belch, Bide, Blazing Torque, Celebrate, Chatter, Combat Torque, Copycat, Dynamax Cannon, Focus Punch, Hold Hands, Magical Torque, Me First, Metronome, Mimic, Mirror Move, Nature Power, Noxious Torque, Shell Trap, Sketch, Sleep Talk, Struggle, Uproar, Wicked Torque, or any two-turn move.",
			shortDesc: "User must be asleep. Uses another known move. Rest works (Gen 2).",
		};
	}
	for (const [id, move] of Object.entries(data)) {
		if (!move || !move.flags || !move.flags.recharge) continue;
		const own = move.onAfterMoveSecondarySelf;
		// The recharge is only added once the hit is known to have left the target standing:
		// adding it first and lifting it after a KO left "Must recharge" showing in the battle.
		let self = null;
		if (move.self) {
			const { volatileStatus, ...rest } = move.self;
			if (volatileStatus !== 'mustrecharge') rest.volatileStatus = volatileStatus;
			if (Object.keys(rest).length) self = rest;
		}
		data[id] = {
			...move,
			self,
			shortDesc: "User cannot move next turn, unless this knocks the target out.",
			desc: "If this move is successful, the user must recharge on the following turn and cannot select a move - unless it knocked the target out, as in Generation 1, in which case there is no recharge turn.",
			// Gen 1: a knockout means no recharge turn.
			onAfterMoveSecondarySelf(pokemon, target, activeMove) {
				if (own) own.call(this, pokemon, target, activeMove);
				if (target && target.hp && !target.fainted) {
					pokemon.addVolatile('mustrecharge');
				} else {
					this.add('-message', `${pokemon.name} doesn't need to recharge after the knockout!`);
				}
			},
		};
	}
	// Punishment, buffed (the owner): 75 base instead of 60, +20 per target boost, no cap,
	// and back in the current generation (it was cut from Scarlet and Violet).
	// Penance (balance-patch-1.js) is its Fairy, special twin on the same numbers.
	if (data.punishment) {
		data.punishment = {
			...data.punishment,
			isNonstandard: null,
			basePowerCallback(pokemon, target) {
				return 75 + 20 * target.positiveBoosts();
			},
			shortDesc: "75 power +20 for each of the target's stat boosts. No cap.",
			desc: "Power is 75, plus 20 for each of the target's positive stat stage changes, with no cap.",
		};
	}
	// Smeargle gets everything new (the owner): every move of ours can be Sketched,
	// the Balance Patch signatures included. Not Samantha's Queen moves, Nuzleaf-SOLD's
	// Merchant's Call, or the Halloween event's Witch's Snatch.
	const NEVER_SKETCH = ['queenbeam', 'queensdance', 'queensheal', 'queensblitz', 'merchantscall', 'witchssnatch'];
	for (const [id, move] of Object.entries(data)) {
		if (!move || !(move.num < 0) || move.isNonstandard === 'CAP') continue;
		// The excluded ones are locked outright: Queen's Blitz had no nosketch flag and
		// Smeargle could already take it.
		if (NEVER_SKETCH.includes(id)) { data[id] = { ...move, flags: { ...move.flags, nosketch: 1 } }; continue; }
		if (move.flags && move.flags.nosketch) {
			const flags = { ...move.flags };
			delete flags.nosketch;
			data[id] = { ...move, flags };
		}
	}
	// Z-Moves of our status moves (the owner): each gets its closest official move's
	// Z effect, so a Z-Crystal on one of ours does something, the way it would on theirs.
	for (const [id, zMove] of Object.entries(Z_STATUS)) {
		if (data[id] && !data[id].zMove) data[id] = { ...data[id], zMove };
	}
	// Wicked Blow: the Gen 9 nerf undone, 75 back to 80 (the owner, 30 Sep 2026, with Urshifu unbanned).
	if (data.wickedblow) data.wickedblow = { ...data.wickedblow, basePower: 80 };
	// Magma Storm: 75% accuracy up to 85% (the owner, 30 Sep 2026).
	if (data.magmastorm) data.magmastorm = { ...data.magmastorm, accuracy: 85 };
	// Power buffs (the owner, 10 Oct 2026): Dragon Pulse 85 -> 100, Icy Wind 55 -> 60, and the
	// three all-stat moves - Ancient Power, Ominous Wind, Silver Wind - 60 -> 70.
	for (const [id, power] of Object.entries({ dragonpulse: 100, icywind: 60, ancientpower: 70, ominouswind: 70, silverwind: 70 })) {
		if (data[id]) data[id] = { ...data[id], basePower: power };
	}
	// Twister: 40 power and a 20% flinch up to 85 and 30% (the owner, 10 Oct 2026) - a real Dragon special attack.
	if (data.twister) {
		data.twister = {
			...data.twister,
			basePower: 85,
			secondary: { chance: 30, volatileStatus: 'flinch' },
			shortDesc: "30% chance to make the foe(s) flinch.",
			desc: "Has a 30% chance to make the target flinch. Power doubles if the target is using Bounce, Fly, or Sky Drop, or is under the effect of Sky Drop.",
		};
	}
	/*
	 * Explosion and Self-Destruct as in Generations 1-4 (the owner, 10 Oct 2026): the
	 * target's Defense is halved for the hit. ModifyDef never asks the move itself, so it is
	 * done as double power, which is the same sum (Defense sits under the power in the formula).
	 */
	for (const id of ['explosion', 'selfdestruct']) {
		const move = data[id];
		if (!move) continue;
		const own = move.onBasePower;
		data[id] = {
			...move,
			onBasePower(basePower, pokemon, target, activeMove) {
				const power = own ? own.call(this, basePower, pokemon, target, activeMove) : undefined;
				this.chainModify(2);
				return power;
			},
			shortDesc: "Hits adjacent Pokemon. Target's Def halved. The user faints.",
			desc: "The user faints after using this move, even if this move fails for having no target. The target's Defense is halved during damage calculation, as in Generations 1-4. This move is prevented from executing if any active Pokemon has the Damp Ability.",
		};
	}
	/*
	 * Misty Explosion at 200 power with the target's Special Defense halved, the same way
	 * (the owner, 12 Oct 2026). Misty Terrain still adds its half on top.
	 */
	if (data.mistyexplosion) {
		const move = data.mistyexplosion;
		const own = move.onBasePower;
		data.mistyexplosion = {
			...move,
			basePower: 200,
			onBasePower(basePower, pokemon, target, activeMove) {
				const power = own ? own.call(this, basePower, pokemon, target, activeMove) : undefined;
				this.chainModify(2);
				return power;
			},
			shortDesc: "User faints. Target's Sp. Def halved. 1.5x on Misty Terrain.",
			desc: "The user faints after using this move, even if this move fails for having no target. The target's Special Defense is halved during damage calculation. If the current terrain is Misty Terrain and the user is grounded, this move's power is multiplied by 1.5. This move is prevented from executing if any active Pokemon has the Damp Ability.",
		};
	}
	return data;
};

const Z_STATUS = {
	queensdance: { effect: 'clearnegativeboost' },   // Dragon Dance
	queensheal: { effect: 'clearnegativeboost' },    // Recover
	hustleup: { effect: 'clearnegativeboost' },      // Dragon Dance
	chrysalisveil: { effect: 'clearnegativeboost' }, // Recover
	velvetguard: { effect: 'clearnegativeboost' },   // Cotton Guard
	sovereignrite: { effect: 'clearnegativeboost' }, // Tail Glow
	twilightexit: { effect: 'healreplacement' },     // Parting Shot: a pivot heals who comes in
	grandfeast: { boost: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } }, // Geomancy
	chillingmist: { boost: { spa: 1 } },             // Will-O-Wisp's +1 Atk, for the special burn
	gleamstalk: { boost: { spd: 1 } },               // Thunder Wave
	tectonicshell: { boost: { def: 1 } },            // Stealth Rock
	royaldecree: { boost: { def: 1 } },              // Roar
};
exports.Z_STATUS = Z_STATUS;

// For the client's move descriptions (scripts/build-buffs.js): every move this file changes.
exports.CHANGED_MOVES = ['punishment', 'bellydrum', 'rest', 'sleeptalk', 'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser', 'eternabeam', 'meteorassault', 'magmastorm', 'wickedblow', 'twister', 'explosion', 'selfdestruct', 'mistyexplosion', 'dragonpulse', 'icywind', 'ancientpower', 'ominouswind', 'silverwind'];
