'use strict';
/* eslint-disable no-empty */
try {
	// RP Random Battle needs the random team generator taught about the Pokemon
	// this server buffs. Done here because this file is loaded inside the
	// simulator process, which is the process that builds the teams - patching
	// it from the server's own entry point would never reach them.
	require('../data/velvet/random-sets.js').installRandomSets();
} catch (e) {
	console.log('[velvet] RP Random Battle sets unavailable: ' + e.message);
}
/**
 * Formats this server adds, on top of Showdown's own.
 *
 * Copied into the package's dist/config before boot, which is where the
 * simulator looks - sim/dex-formats.js resolves `config/custom-formats`
 * relative to dist/sim, which is a different directory to the one the server
 * config lives in. Being a supported hook rather than an edit to the package's
 * own format list, it survives upgrades.
 *
 * They all live in one section, RP, which the server lifts to the top of the
 * format list on boot (see rpSectionFirst() in showdown-config.js).
 *
 * The section is declared once, as its own entry. A format must NOT carry a
 * `section` of its own: the merge that joins this list to Showdown's reads any
 * entry with one as a section marker, so a tagged format is silently dropped -
 * which is exactly what happened, and it took every RP format with it.
 */

/**
 * Mega Evolution, Dynamax and Terastallization: all three, one each per side,
 * and one per Pokemon.
 *
 * Each belongs to a different generation and the engine only offers the one
 * that matches. Dynamax is refused twice over outside generation 8 - a side
 * begins with its one use already spent, and the check that reads that flag
 * refuses anyway - while a Pokemon holding a Mega Stone is quietly barred from
 * the other two, because no format has ever had to think about a Pokemon that
 * could do all three.
 *
 * "Once per side" needs no help: the engine already clears the option from
 * every team-mate as soon as one of them uses it. What is added here is the
 * crossover, and it is patched onto the battle in hand rather than onto the
 * classes, so no other format on this server sees any of it.
 */
function allGimmicks() {
	const battle = this;

	/** One gimmick to a Pokemon: using any of them uses up the others. */
	const spend = pokemon => {
		if (!pokemon) return;
		pokemon.m.rpGimmickUsed = true;
		pokemon.canMegaEvo = null;
		pokemon.canMegaEvoX = null;
		pokemon.canMegaEvoY = null;
		pokemon.canTerastallize = null;
	};

	/*
	 * Each gimmick only exists from the generation that invented it.
	 *
	 * RP runs in eight generations now, and handing a Gen 4 battle the
	 * Terastallization code is not "all three gimmicks", it is a crash waiting
	 * for somebody to click something. Mega Evolution starts in 6, Dynamax in 8,
	 * Terastallization in 9, and each block below is gated on its own.
	 */
	const hasMega = battle.gen >= 6;
	const hasDynamax = battle.gen >= 8;
	const hasTera = battle.gen >= 9;
	const hasZMove = battle.gen >= 7;

	for (const side of battle.sides) {
		// Everything Dynamax needs - the volatile, the Max moves, the base power
		// tables - is still in the ninth-generation data, marked as belonging to
		// the past. Only the two refusals are in the way.
		if (hasDynamax) {
			side.dynamaxUsed = false;
			side.canDynamaxNow = function () { return !this.dynamaxUsed; };
		}

		for (const pokemon of side.pokemon) {
			// Terastallization is taken away from two kinds of Pokemon before a
			// battle starts: anyone holding a Mega Stone (the engine keeping two
			// mechanics apart) and everyone at all under National Dex's Terastal
			// Clause. RP offers all three, so it is handed back here - at the start
			// of the battle, where the tier's own rules have already been applied and
			// undoing one cannot take the format list down with it.
			if (hasTera && !pokemon.canTerastallize && pokemon.teraType) {
				pokemon.canTerastallize = pokemon.teraType;
			}

			if (hasDynamax) {
				const dynamaxRequest = pokemon.getDynamaxRequest.bind(pokemon);
				pokemon.getDynamaxRequest = function (skipChecks) {
					/*
					 * Two questions share this method, and only one of them is ours.
					 *
					 * Without skipChecks it means "may this Pokemon Dynamax now",
					 * which a spent gimmick refuses. With skipChecks it means "what
					 * are its Max moves called" - and that is what the engine asks to
					 * fill in the buttons on every turn a Pokemon is *already*
					 * Dynamaxed. Refusing that one is why the menu went back to
					 * showing Imperial Torrent and Roost on turns two and three,
					 * while the Pokemon was really using Max Geyser and Max Guard.
					 */
					if (this.m.rpGimmickUsed && !skipChecks) return undefined;
					// The engine refuses Dynamax to anyone holding a Mega Stone or a
					// Z-crystal - two rules about not mixing generations rather than
					// about balance, which is the one thing this format is for. Both
					// are hidden for the length of the question and put straight back.
					const stone = this.canMegaEvo;
					const item = this.item;
					this.canMegaEvo = null;
					if (this.getItem().zMove) this.item = '';
					try {
						return dynamaxRequest(skipChecks);
					} finally {
						this.canMegaEvo = stone;
						this.item = item;
					}
				};
			}
		}
	}

	const actions = battle.actions;
	if (hasMega && actions.runMegaEvo) {
		const runMegaEvo = actions.runMegaEvo.bind(actions);
		actions.runMegaEvo = function (pokemon) {
			const evolved = runMegaEvo(pokemon);
			if (evolved) spend(pokemon);
			return evolved;
		};
	}

	if (hasTera && actions.terastallize) {
		const terastallize = actions.terastallize.bind(actions);
		actions.terastallize = function (pokemon) {
			const result = terastallize(pokemon);
			spend(pokemon);
			return result;
		};
	}

	// Dynamax has no method of its own - the battle applies it inline - so it is
	// caught where the action is run rather than where it is written.
	/*
	 * Z-moves are the fourth gimmick, and they play by the same rule.
	 *
	 * A Z-crystal holder can Mega Evolve, Dynamax or Terastallize instead - the
	 * engine forbids all three, for the same not-mixing-generations reason it
	 * forbids everything else here - and doing so costs them the Z-move.
	 * Firing the Z-move first costs them the other three. One per Pokemon,
	 * whichever they reach for.
	 */
	if (hasZMove && actions.canZMove) {
		const canZMove = actions.canZMove.bind(actions);
		actions.canZMove = function (pokemon) {
			if (pokemon.m.rpGimmickUsed) return undefined;
			return canZMove(pokemon);
		};

		// Where a Z-move is actually fired: the engine sets `side.zMoveUsed` here
		// and nowhere else, so this is the one place that knows it happened.
		const runMove = actions.runMove.bind(actions);
		actions.runMove = function (moveOrMoveName, pokemon, targetLoc, options) {
			const result = runMove(moveOrMoveName, pokemon, targetLoc, options);
			if (options && options.zMove) spend(pokemon);
			return result;
		};
	}

	if (hasDynamax) {
		const runAction = battle.runAction.bind(battle);
		battle.runAction = function (action) {
			const result = runAction(action);
			if (action.choice === 'runDynamax') spend(action.pokemon);
			return result;
		};
	}
}

/**
 * Moves without the level they are learned at.
 *
 * A level 5 Charizard that knows Flamethrower is the point of an RP tier: the
 * character is who they are, and the number beside the name is a detail of the
 * story rather than a record of how much grinding happened.
 *
 * Only the level is lifted. The move still has to be one that Pokemon can
 * actually learn - Blissey cannot have Flamethrower here any more than
 * anywhere else - because a tier where movepools are free is a different tier,
 * and that one is RP Battle.
 *
 * `this` is the validator, so calling its own checkCanLearn runs the real
 * check, with the level briefly set to the highest anything is learned at.
 */
/**
 * The TMs a cut Pokemon never got offered, because it was not there.
 *
 * Built by scripts/build-cut-moves.js and explained there. Short version: every
 * machine move generations 8 and 9 introduced was handed to the Pokemon
 * standing in those games, and the four hundred and fifty-four that had been
 * cut got none of them - Tera Blast included, which seven hundred and
 * twenty-seven of the seven hundred and thirty-three present Pokemon learn. RP
 * hands Terastallization back to every tier, so here that is a Pokemon that can
 * Terastallize and has nothing to do with it.
 *
 * Missing is fine and is the case on a fresh checkout: nothing is granted and
 * the check below behaves exactly as it did before the table existed.
 */
let CUT_MOVES = {};
try {
	CUT_MOVES = require('../data/velvet/cut-moves.json');
} catch (e) {
	console.log('[velvet] no cut-moves.json; run scripts/build-cut-moves.js - ' + e.message);
}

/**
 * Is this one of them, for this Pokemon?
 *
 * The table is keyed by base species, because that is the level the measurement
 * was made at and because a forme's movepool is its base form's - Rotom-Heat
 * has no learnset of its own, and neither does a Mega. So the base form is
 * asked first and the forme only if it somehow has its own row.
 */
/*
 * The starter moves the games never gave them (Patch 1.4).
 *
 * Built by scripts/build-rp-moves.js and read exactly the way CUT_MOVES is: a
 * starter line gets the coverage its own first type received everywhere else,
 * and nothing else. Meganium has never learned Earth Power in any game, which
 * is the complaint this answers.
 */
let RP_MOVES = {};
try {
	RP_MOVES = require('../data/velvet/rp-moves.json');
} catch (e) {
	console.log('[velvet] no rp-moves.json; run scripts/build-rp-moves.js - ' + e.message);
}

function grantedToCut(dex, species, move) {
	const base = species.baseSpecies && species.baseSpecies !== species.name ?
		dex.species.get(species.baseSpecies) : species;
	const list = [...(CUT_MOVES[base.id] || CUT_MOVES[species.id] || []), ...(RP_MOVES[base.id] || RP_MOVES[species.id] || [])];
	return list.includes(move.id);
}

/**
 * The learn check every RP tier uses, and the two things it forgives.
 *
 * The level is the first: RP does not care that Charizard learns Flamethrower
 * at 41 when the set is level 50, so the check is asked at 100 and the real
 * level put back.
 *
 * The TM a cut Pokemon never had the chance to be taught is the second, and it
 * is only forgiven after the ordinary check has already said no - so nothing
 * here can make an illegal set legal for any other reason. A move it could not
 * learn for a different reason is refused with that reason, unchanged.
 *
 * Both are RP's own. This function is the whole of the difference, which is why
 * it is the only place the table is read: National Dex on this server is
 * Smogon's National Dex.
 */
function levelFreeMoves(move, species, setSources, set) {
	const level = set.level;
	set.level = 100;
	try {
		const problem = this.checkCanLearn(move, species, setSources, set);
		if (!problem) return null;
		if (grantedToCut(this.dex, species, move)) return null;
		return problem;
	} finally {
		set.level = level;
	}
}

/**
 * What every tiered RP format shares.
 *
 * `!Obtainable Misc` is where the evolution level lives: under that rule the
 * validator refuses a Charizard below level 36, and nothing else governs it.
 *
 * Terastallization is *not* switched back on here, and this is the sharp edge:
 * removing a rule that a format does not have is an error, not a no-op, and it
 * is thrown while building the format list that every connecting client asks
 * for - so one `!Terastal Clause` too many took the whole server down, not just
 * the format. National Dex bans Terastal; its sub-tiers do not all inherit that
 * ban; and there is no way to ask from here. allGimmicks() hands Terastal back
 * at the start of the battle instead, where the question can actually be asked.
 */
// Eternal Floette is what Mega Floette (a Z-A Mega this server unlocked) evolves from;
// National Dex calls it nonexistent and refused every Floettite team on the RP ladders.
const RP_RULES = ['!Obtainable Misc', '+Floette-Eternal'];

/**
 * One RP tier, standing on the Smogon tier of the same shape.
 *
 * `gen` picks which generation it is played in, and with it which list it
 * stands on: the ninth and eighth have National Dex, so those are what RP uses
 * there; nothing before the eighth has a National Dex at all, so those stand on
 * the ordinary tier of that generation.
 *
 * `rules` is for a base that has to be argued with - see the Terastal note at
 * the call sites, which is the only thing that uses it and the only thing that
 * has ever taken this server down.
 */
function rpTier(name, base, { gen = 9, rules = [], ...extra } = {}) {
	return {
		name: `[Gen ${gen}] RP ${name}`,
		mod: `gen${gen}`,
		ruleset: [base, ...RP_RULES, ...rules],
		checkCanLearn: levelFreeMoves,
		onBegin: allGimmicks,
		searchShow: true,
		challengeShow: true,
		tournamentShow: true,
		rated: true,
		...extra,
	};
}

/**
 * Terastallization, handed back where the tier took it away.
 *
 * RP offers all three gimmicks, and this is the one that needs help: National
 * Dex bans Terastallization outright, and its clause is not a validator rule
 * but an `onBegin` that walks every Pokemon and sets `canTerastallize = null`.
 * That runs after the format's own onBegin, so allGimmicks handing it back was
 * being undone a moment later - which is why Tera could be used in RP Ubers,
 * whose base has no clause, and not in RP OU, whose base does.
 *
 * The rule is therefore removed rather than worked around. Removing a rule a
 * format does not have is an error, not a no-op, and it is thrown while
 * building the format list that every connecting client asks for - one
 * `!Terastal Clause` too many took the whole server down once. So this is
 * applied only to the three bases that actually carry it, which was measured
 * rather than assumed:
 *
 *   National Dex, National Dex UU, National Dex RU       carry it
 *   National Dex Ubers, National Dex AG, National Dex LC,
 *   NU, PU, ZU                                           do not
 *
 * The check that every format builds its rule table runs before each deploy and
 * is what would catch this changing upstream.
 */
const UNBAN_TERA = ['!Terastal Clause'];

/**
 * And the same argument for Dynamax, in the eighth generation.
 *
 * National Dex bans Dynamax there exactly as it bans Terastallization in the
 * ninth, and for the same reason: it is the tier's defining decision. RP's
 * defining decision is the opposite one, so the clause comes off.
 *
 * Measured as well: both Gen 8 National Dex and Gen 8 National Dex Ubers carry
 * it, so both Gen 8 RP tiers remove it and nothing else does.
 */
const UNBAN_DYNAMAX = ['!Dynamax Clause'];

/**
 * Catching, for the RP Wild Encounter format.
 *
 * The rules live in src/encounters.js, shared with the chat commands and the
 * RP bot. This file is copied into the package's dist/config before it runs, so
 * the project is four directories up from here - and one when a test loads it
 * from config/ directly.
 */
function encounters() {
	const path = require('path');
	for (const up of ['../../../../src/encounters', '../src/encounters']) {
		try { return require(path.join(__dirname, up)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
	}
	throw new Error('src/encounters.js not found');
}

// "an X Attack": X is said "ex".
const aOrAn = name => (/^([AEIOU]|X )/i.test(name) ? `an ${name}` : `a ${name}`);

/** The ball buttons, posted into the battle so nobody has to type a command. */
function ballPanel(E, note) {
	const main = ['poke', 'great', 'ultra'].map(id => E.findBall(id));
	const buttons = main.map(b =>
		`<button class="button" name="send" value="/throwball ${b.id}">Throw ${aOrAn(b.name)}</button>`).join(' ');
	// Buttons, not a form: the client turns a submitted form into "Submitted!", so a second throw had nothing to press.
	const others = E.BALLS.filter(b => !['poke', 'great', 'ultra'].includes(b.id)).map(b =>
		`<button class="button" name="send" value="/throwball ${b.id}"${b.note ? ` title="${b.note.replace(/"/g, '&quot;')}"` : ''}>${b.name}</button>`).join(' ');
	// Running is a wild-battle option like throwing, so it sits with the throws.
	const escapes = E.BATTLE_ITEMS.filter(i => i.escape).map(i =>
		`<button class="button" name="send" value="/run ${i.id}">${i.name}</button>`).join(' ');
	return `<div class="infobox" style="margin:4px 0">` +
		(note ? `<div style="margin-bottom:4px">${note}</div>` : '') +
		`<b>Catch it:</b> ${buttons}` +
		`<details style="margin-top:4px"><summary>Other balls</summary>${others}</details>` +
		`<div style="margin-top:4px"><b>Or leave:</b> <button class="button" name="send" value="/run">Run</button> ${escapes}` +
		`<br/><small>Running is your turn, and it goes on your Speed against its Speed - each failed try makes the next easier. A Poké Doll always works. Legendaries never let you go.</small></div>` +
		`<small>Throwing a ball uses your turn. Weaken it and give it a status first to make it easier. ` +
		`Only use balls your character actually has.</small></div>`;
}

/** A side is wild when it is one or two Pokemon under a "Wild ..." name - which only the RP bot plays as. */
function isWildSide(side) {
	return !!side && /^Wild /.test(side.name) && side.pokemon.length <= 2;
}

/**
 * A choice for one of your Pokemon that the engine will accept, for a turn
 * spent throwing. Its move never happens - the format stops it - but the
 * engine needs a real choice for every Pokemon before the turn can run, and a
 * move that needs a target needs a legal one.
 */
function fillerChoice(battle, pokemon) {
	if (!pokemon || pokemon.fainted) return 'pass';
	const request = pokemon.getMoveRequestData();
	for (let i = 0; i < request.moves.length; i++) {
		const move = request.moves[i];
		if (move.disabled) continue;
		const needsTarget = battle.gameType !== 'singles' &&
			['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(move.target);
		if (!needsTarget) return `move ${i + 1}`;
		for (const loc of [1, 2, -1, -2]) {
			if (battle.validTargetLoc(loc, pokemon, move.target)) return `move ${i + 1} ${loc}`;
		}
	}
	return null;
}

/**
 * Using an item from the bag: "item potion Pikachu" is a choice, like a ball.
 *
 * Same machinery as throwing a ball, and for the same reasons: the choice is
 * filled with a move the engine accepts, flagged, and the format swaps it for
 * the item when the turn runs. It takes the whole turn and goes first. The
 * target is named rather than numbered, because a party's order changes every
 * time someone switches and nobody can be expected to track it.
 *
 * Installed in every RP Battle format. Whether a character may use an item at
 * all - is it an RP encounter, is there one in the bag - is the server's call,
 * made in /useitem before the choice ever reaches the battle.
 */
function installItems(battle) {
	const E = encounters();
	for (const side of battle.sides) {
		if (side.rpItemsInstalled) continue;
		side.rpItemsInstalled = true;
		const choose = side.choose;
		const clearChoice = side.clearChoice;
		const commitChoices = side.commitChoices;
		side.clearChoice = function (...args) {
			this.rpPendingItem = null;
			return clearChoice.apply(this, args);
		};
		side.commitChoices = function (...args) {
			this.rpItem = this.rpPendingItem || null;
			return commitChoices.apply(this, args);
		};
		side.choose = function (input) {
			const m = /^\s*item\s+(\S+)\s+(.+)$/i.exec(String(input));
			if (!m) return choose.call(this, input);
			if (this.requestState !== 'move') return this.emitChoiceError(`Can't use an item right now`);
			const item = E.findBattleItem(m[1]);
			if (!item) return this.emitChoiceError(`There's no battle item called "${m[1]}"`);
			const wanted = E.toID(m[2]);
			const named = this.pokemon.filter(p => E.toID(p.name) === wanted || E.toID(p.species.name) === wanted || E.toID(p.species.baseSpecies) === wanted);
			if (!named.length) return this.emitChoiceError(`None of your Pokémon is called "${m[2]}"`);
			const state = p => ({ fainted: p.fainted, hurt: p.hp < p.maxhp, status: p.status, active: p.isActive, ppUsed: p.moveSlots.some(s => s.pp < s.maxpp) });
			const target = named.find(p => E.itemHelps(item, state(p)));
			if (!target) {
				const p = named[0];
				return this.emitChoiceError(item.revive ? (p.fainted ? `${p.name} has to be on the bench to be revived` : `${p.name} hasn't fainted`) :
					p.fainted ? `${p.name} has fainted: it needs a Revive` :
					(item.boost || item.crit || item.mist) ? `${item.name} only works on a Pokémon out on the field` : `${p.name} doesn't need ${aOrAn(item.name)}`);
			}
			const fillers = this.active.map(p => fillerChoice(battle, p));
			if (fillers.some(f => f === null) || fillers.every(f => f === 'pass')) {
				return this.emitChoiceError(`Can't use an item this turn`);
			}
			if (!choose.call(this, fillers.join(', '))) return false;
			this.rpPendingItem = { id: item.id, target: target.position === undefined ? null : target, turn: battle.turn, used: false };
			this.rpPendingItem.target = target;
			return true;
		};
	}
}

/** The tutorial's closing box: what to do to play for real. */
function tutorialNextSteps(battle) {
	if (battle.rpTutorialDone) return;
	battle.rpTutorialDone = true;
	battle.add('raw', '<div class="broadcast-blue"><b>Tutorial done! Ready for the real thing?</b><br/>' +
		'1. <a href="https://discord.gg/pH86q7sdg7">Join the Kagura RP on Discord</a> to play for real, and make a character: <code>!character add &lt;name&gt;</code><br/>' +
		'2. Pick your starter: <code>!pick</code><br/>' +
		'3. Link this Showdown account: <code>!showdown &lt;your name&gt;</code><br/>' +
		'4. Build your RP team in the Teambuilder, then type <code>!encounter</code> in your character\'s channel.<br/>' +
		// Players reported no way out of the finished practice battle; this does what the Main menu button does.
		'<button class="button" name="closeAndMainMenu">Close this battle</button></div>');
}

function useItem(battle, side, itemId, target) {
	const E = encounters();
	const item = E.findBattleItem(itemId);
	if (!item || !target) return;
	battle.add('-message', `${side.name} used ${aOrAn(item.name)} on ${target.name}!`);
	if ((battle.format.id || battle.format) === 'gen9rptutorial') battle.add('-message', "Real items come from your character's bag (!bag on Discord, buy more with !buy).");
	const noEffect = () => battle.add('-message', 'It had no effect.');
	if (item.revive) {
		// Sacred Ash brings back every fainted Pokémon on the bench.
		const who = item.all ? side.pokemon.filter(p => p.fainted && !p.isActive) : [target];
		if (!who.some(p => p.fainted && !p.isActive)) return noEffect();
		for (const p of who) {
			if (!p.fainted || p.isActive) continue;
			p.fainted = false;
			p.faintQueued = false;
			p.status = '';
			p.hp = Math.max(1, Math.floor(p.maxhp * item.revive));
			side.pokemonLeft++;
			battle.add('-message', `${p.name} was revived!`);
		}
		return;
	}
	if (target.fainted) return noEffect();
	if (item.pp) {
		const slots = target.moveSlots;
		if (item.pp === 'all') for (const slot of slots) slot.pp = slot.maxpp;
		else if (item.pp.all) for (const slot of slots) slot.pp = Math.min(slot.maxpp, slot.pp + item.pp.all);
		else {
			// The move that has used the most of its PP.
			const slot = slots.filter(x => x.pp < x.maxpp).sort((a, b) => a.pp / a.maxpp - b.pp / b.maxpp)[0];
			if (!slot) return noEffect();
			slot.pp = item.pp.one === 'full' ? slot.maxpp : Math.min(slot.maxpp, slot.pp + item.pp.one);
			return battle.add('-message', `${target.name}'s ${slot.move} had its PP restored.`);
		}
		return battle.add('-message', `${target.name}'s PP was restored.`);
	}
	if (item.boost) {
		if (!target.isActive) return noEffect();
		battle.boost(item.boost, target, target);
		return;
	}
	if (item.crit) {
		if (!target.isActive || !target.addVolatile('focusenergy')) return noEffect();
		return;
	}
	if (item.mist) {
		if (!side.addSideCondition('mist')) return noEffect();
		return;
	}
	if (item.heal) {
		const amount = item.heal === 'full' ? target.maxhp : item.heal;
		const healed = target.heal(amount);
		if (target.isActive) battle.add('-heal', target, target.getHealth, `[from] item: ${item.name}`);
		else if (healed) battle.add('-message', `${target.name} recovered ${healed} HP.`);
	}
	if (item.cure && target.status && (item.cure === true || item.cure === 'all' || item.cure.includes(target.status))) {
		const was = target.status;
		target.cureStatus();
		if (!target.isActive) battle.add('-message', `${target.name} was cured of its ${{ brn: 'burn', par: 'paralysis', slp: 'sleep', frz: 'freeze', psn: 'poison', tox: 'poison' }[was] || 'status'}.`);
	} else if (!item.heal) {
		noEffect();
	}
}

/** Everything RP battles do instead of a move: throwing a ball, using an item. */
const RP_TURN_ACTIONS = {
	onModifyPriority(priority, pokemon) {
		const side = pokemon.side;
		if ((side.rpBall && side.rpBall.turn === this.turn) || (side.rpItem && side.rpItem.turn === this.turn) ||
			(side.rpRun && side.rpRun.turn === this.turn)) return priority + 20;
	},
	onBeforeMovePriority: 100,
	onBeforeMove(pokemon) {
		const side = pokemon.side;
		const ball = side.rpBall;
		const item = side.rpItem;
		const run = side.rpRun;
		if (run && run.turn === this.turn) {
			if (!run.tried) { run.tried = true; tryRun(this, pokemon); }
			return false;
		}
		if (item && item.turn === this.turn) {
			// The first of your Pokemon to act uses it; any other just waits.
			if (!item.used) { item.used = true; useItem(this, side, item.id, item.target); }
			return false;
		}
		if (!ball || ball.turn !== this.turn) return;
		if (!ball.thrown) {
			ball.thrown = true;
			throwBall(this, pokemon, ball.id);
		}
		return false;
	},
};

function installCatching(battle) {
	const E = encounters();
	for (const side of battle.sides) {
		side.rpMisses = 0;
		const choose = side.choose;
		const clearChoice = side.clearChoice;
		const commitChoices = side.commitChoices;
		// A pending throw belongs to the choice, so undoing the choice drops it.
		side.clearChoice = function (...args) {
			this.rpPendingBall = null;
			this.rpPendingRun = null;
			return clearChoice.apply(this, args);
		};
		// The engine clears every choice after queueing it and before running it,
		// so the throw is moved off the choice at the moment it is locked in.
		side.commitChoices = function (...args) {
			this.rpBall = this.rpPendingBall || null;
			this.rpRun = this.rpPendingRun || null;
			return commitChoices.apply(this, args);
		};
		/*
		 * "ball ultra" is a choice, like "move 1".
		 *
		 * It is turned into the first move the Pokemon can use, flagged, so the
		 * engine does everything it normally does with a choice - timers, undo,
		 * both players locking in - and the format swaps the move for the throw
		 * when it comes up. Everything about the throw, including the random roll,
		 * happens inside the battle, so replays show exactly what happened.
		 */
		side.choose = function (input) {
			// "run [item]" is a choice like "ball ultra": the turn is spent either way.
			const r = /^\s*run\b\s*(.*)$/i.exec(String(input));
			if (r) {
				const foe = this.foe;
				if (this.requestState !== 'move' || !this.active[0] || this.active[0].fainted) {
					return this.emitChoiceError(`Can't run right now: send a Pokémon out first`);
				}
				if (!isWildSide(foe)) {
					return this.emitChoiceError(`You can't run from a trainer - that battle is settled in the RP`);
				}
				const wild = foe.active.find(p => p && !p.fainted);
				if (!wild) return this.emitChoiceError(`There's nothing to run from`);
				if (E.isLegendary(wild.species)) {
					return this.emitChoiceError(`${wild.species.name} will not let you leave. Legendaries are not escapable`);
				}
				const item = r[1] ? E.findBattleItem(r[1]) : null;
				if (r[1] && (!item || !item.escape)) return this.emitChoiceError(`"${r[1]}" is not something that gets you out of a battle`);
				const fillers = this.active.map(p => fillerChoice(battle, p));
				if (fillers.some(f => f === null) || fillers.every(f => f === 'pass')) {
					return this.emitChoiceError(`Can't run this turn`);
				}
				if (!choose.call(this, fillers.join(', '))) return false;
				this.rpRunItem = item || null;
				this.rpPendingRun = { turn: battle.turn, tried: false };
				return true;
			}
			const m = /^\s*ball\b\s*(.*)$/i.exec(String(input));
			if (!m) return choose.call(this, input);
			const foe = this.foe;
			if (this.requestState !== 'move' || !this.active[0] || this.active[0].fainted) {
				return this.emitChoiceError(`Can't throw a ball right now: pick a Pokémon to send out first`);
			}
			if (!isWildSide(foe)) {
				return this.emitChoiceError(`Can't throw a ball: that Pokémon belongs to somebody`);
			}
			// Two wild Pokemon at once can't be caught: the ball wouldn't know which.
			// Same as the games - knock one out, then throw at the other.
			const standing = foe.active.filter(p => p && !p.fainted);
			if (standing.length > 1) {
				return this.emitChoiceError(`There are two wild Pokémon out. Knock one out first, then throw at the other`);
			}
			const wild = standing[0];
			if (!wild) return this.emitChoiceError(`There's nothing to throw at`);
			if (E.isLegendary(wild.species)) {
				return this.emitChoiceError(`${wild.species.name} can't be caught on Showdown: legendaries happen in the RP`);
			}
			const ball = E.findBall(m[1]);
			if (!ball) return this.emitChoiceError(`There's no ball called "${m[1]}"`);
			// Throwing is the whole turn. In a double battle both of your
			// Pokemon wait for it, so neither can knock out what you're catching.
			const fillers = this.active.map(p => fillerChoice(battle, p));
			if (fillers.some(f => f === null) || fillers.every(f => f === 'pass')) {
				return this.emitChoiceError(`Can't throw a ball this turn`);
			}
			if (!choose.call(this, fillers.join(', '))) return false;
			this.rpPendingBall = { id: ball.id, turn: battle.turn, thrown: false };
			return true;
		};
	}
}

/*
 * Running away (Patch 1.4).
 *
 * The games' own arithmetic, kept: your Speed against its Speed, and every
 * failed attempt makes the next one likelier, so nobody is ever truly stuck -
 *
 *   odds = (yourSpeed * 128 / itsSpeed + 30 * attempts) out of 256
 *
 * and being faster than it is an escape every time. Two things change it: a
 * Poké Doll or a Smoke Ball in the bag walks you out on the spot, and a
 * legendary never lets you leave at all. A trainer battle is not escapable
 * either - that is a person standing in front of you, and the RP settles it.
 */
function tryRun(battle, pokemon) {
	const E = encounters();
	const side = pokemon.side;
	const wild = side.foe.active.find(p => p && !p.fainted);
	if (!wild) return;
	side.rpRuns = (side.rpRuns || 0) + 1;
	if (E.isLegendary(wild.species)) {
		battle.add('-message', `${pokemon.name} tried to get away - but ${wild.name} is not letting anyone leave.`);
		return;
	}
	const item = side.rpRunItem;
	side.rpRunItem = null;
	const mine = pokemon.getStat('spe');
	const theirs = Math.max(1, wild.getStat('spe'));
	const odds = mine > theirs ? 256 : (mine * 128) / theirs + 30 * side.rpRuns;
	const got = !!item || battle.random(256) < odds;
	battle.add('-message', item ?
		`${side.name} used ${aOrAn(item.name)}!` :
		`${pokemon.name} tried to get away...`);
	if (!got) {
		battle.add('-message', `${wild.name} blocked the way! (the next try is easier)`);
		return;
	}
	battle.add('-message', `Got away safely!`);
	battle.add('raw', `<div class="broadcast-blue"><b>You ran.</b> Nothing was caught and nothing was lost - ` +
		`the encounter closes with no winner.</div>`);
	battle.tie();
}

function throwBall(battle, pokemon, ballId) {
	const E = encounters();
	const side = pokemon.side;
	const wild = side.foe.active.find(p => p && !p.fainted);
	const ball = E.findBall(ballId);
	if (!wild || wild.fainted || !ball) return;

	const species = wild.species;
	const chance = E.catchChance({
		ball,
		hpFraction: wild.hp / wild.maxhp,
		status: wild.status,
		rate: E.catchRate(species),
		misses: side.rpMisses,
		turn: battle.turn,
		types: wild.getTypes(),
		wildLevel: wild.level,
		myLevel: pokemon.level,
		baseSpeed: species.baseStats.spe,
		weightkg: species.weightkg,
		moonStone: (species.evos || []).some(e => battle.dex.species.get(e).evoItem === 'Moon Stone'),
		sameSpeciesOppositeGender: pokemon.species.baseSpecies === species.baseSpecies &&
			!!pokemon.gender && !!wild.gender && pokemon.gender !== wild.gender,
		ultraBeast: (species.tags || []).includes('Ultra Beast'),
	});

	const rng = () => battle.random();
	const caught = rng() < chance;
	const shakes = caught ? 3 : E.shakesFor(chance, rng);

	battle.add('-message', `${side.name} threw ${aOrAn(ball.name)}!`);
	// A ball arcing onto the target: Weather Ball's animation, which is a ball thrown up and down onto it.
	battle.add('-anim', pokemon, 'Weather Ball', wild);
	for (let i = 0; i < shakes; i++) battle.add('-message', '...wobble...');
	if (caught && (battle.format.id || battle.format) === 'gen9rptutorial') {
		battle.add('-message', `Gotcha! ${wild.name} was caught!`);
		battle.add('-message', "In a real encounter, what you catch goes into your character's box (on the bot and in the doc), and the ball comes out of your bag. Here nothing is kept.");
		tutorialNextSteps(battle);
		battle.win(side);
		return;
	}
	if (caught) {
		battle.add('-message', `Gotcha! ${wild.name} was caught!`);
		battle.add('raw', `<div class="broadcast-green"><b>Caught ${species.name}!</b> ` +
			`Post this in your RP scene so the doc can be updated:<br/>` +
			`<code>((Caught ${species.name}, Lv. ${wild.level}, with ${aOrAn(ball.name)}))</code></div>`);
		battle.win(side);
		return;
	}
	side.rpMisses++;
	battle.add('-message', [
		'Oh no! The Pokémon broke free!',
		'Aww! It appeared to be caught!',
		'Aargh! Almost had it!',
		'Shoot! It was so close, too!',
	][shakes]);
	battle.add('uhtml', `rpball${battle.turn}`, ballPanel(E,
		`Missed. The next ball is ${Math.round(E.PITY_PER_MISS * 100)}% likelier to hold.`));
}

/**
 * The Broken Pact, kept where it belongs.
 *
 * A Nuzleaf is an RU Pokemon holding a nine-hundred-point base stat total: the
 * first knockout turns it into 190 / 190 / 190, and Merchant's Call means the
 * knockout is on a five-PP timer the other player does not get a vote on. That
 * is an Ubers item on a Pokemon nobody prepares for, which is funny exactly once
 * per tier and then stops being funny.
 *
 * So it is banned by name everywhere below Ubers, and legal in Ubers, AG and RP
 * Battle. Only the ninth generation needs saying: the item is `gen: 9`, and the
 * validator refuses an item from a later generation than the format's on its
 * own, so the past-gen RP tiers are already covered.
 */
const UBERS_ONLY_ITEM = { banlist: ['Broken Pact'] };

/* Assigned inside the list below; RP Wild Double Encounter borrows its handlers. */
let WILD;

exports.Formats = [
	{
		section: "RP",
		column: 1,
	},
	{
		name: "[Gen 9] RP Battle",

		/**
		 * The one with no rules at all.
		 *
		 * Custom Game under a name people can find, and the only tier Samantha is
		 * legal in: no clauses, no bans, nothing checked, teams of up to 24, moves
		 * that need not be learnable, levels up to 9999. The tiers below are for
		 * battles that are meant to be fair; this one is for whatever the story
		 * needs.
		 */
		ruleset: [
			'Team Preview',
			'Cancel Mod',
			'Max Team Size = 24',
			'Max Move Count = 24',
			'Max Level = 9999',
			'Default Level = 100',
		],

		/**
		 * The stat overflow the cartridge has, which Custom Game turns off.
		 *
		 * Nature multipliers are applied as `trunc(trunc(stat * 110, 16) / 100)` -
		 * truncated to sixteen bits, the way the games do it. A stat above 595 with
		 * a boosting nature overflows: Samantha's 599 Speed becomes 65890, which
		 * wraps to 354, which divides to 3. She was outrun by everything.
		 *
		 * Custom Game sidesteps it by replacing the battle's `trunc` with one that
		 * ignores the bit width, which is what a format allowing level 9999 and 250
		 * base stats needs. This format allows the same things.
		 */
		battle: { trunc: Math.trunc },

		onBegin() {
			allGimmicks.call(this);
			installItems(this);
		},
		...RP_TURN_ACTIONS,

		// Challengeable and usable in the builder, but kept off the ladder:
		// nothing with no rules at all belongs on a rating.
		searchShow: false,
		challengeShow: true,
		rated: false,
	},
	{
		name: "[Gen 9] RP Custom Game",
		desc: "Anything goes: hackmons, illegal Pokémon, fun battles. Not for RP progression.",

		/**
		 * Custom Game, with RP's name on it, for the battles that are not part of
		 * the story: hackmons sets, Pokemon that are not legal anywhere else
		 * (Eevee-Starter), levels and movepools nobody could have. Nothing is
		 * checked, as in Custom Game.
		 *
		 * Challenge only and unrated, and never an encounter format: encounters
		 * keep RP Battle. It still keeps a replay like every RP battle, which
		 * Discord posts to the PvP replays, but the bot gives it no EXP.
		 */
		ruleset: [
			'Team Preview',
			'Cancel Mod',
			'Max Team Size = 24',
			'Max Move Count = 24',
			'Max Level = 9999',
			'Default Level = 100',
		],
		battle: { trunc: Math.trunc },
		// Healing items too, unlimited: /useitem checks nothing in this format.
		onBegin() {
			allGimmicks.call(this);
			installItems(this);
		},
		...RP_TURN_ACTIONS,

		searchShow: false,
		challengeShow: true,
		rated: false,
	},
	{
		name: "[Gen 9] RP Tutorial",
		desc: "A practice wild battle: a Lv. 5 Pikachu, 1 Potion and 1 Poké Ball against a Lv. 5 Rattata. Start it with /tutorial.",

		/**
		 * No team needed, and none used: `team` makes the server skip asking for
		 * one, and the battle then puts the tutorial Pokemon on both sides before
		 * anything is sent out. The Rattata is the side named "Wild ...".
		 */
		team: 'random',
		ruleset: ['Cancel Mod'],
		battle: { trunc: Math.trunc },
		onBegin() {
			const E = encounters();
			for (const side of this.sides) {
				const set = /^Wild /.test(side.name) ? E.TUTORIAL_RATTATA : E.TUTORIAL_PIKACHU;
				side.team = [set];
				side.pokemon = [];
				side.pokemonLeft = 0;
				side.addPokemon(set);
			}
			installCatching(this);
			installItems(this);
			this.add('-message', 'This is a practice battle. Normally a wild Pokémon or a trainer challenges you here when you type !encounter on Discord, in your character\'s channel, and you battle with your own RP team from your box.');
			this.add('-message', 'Step 1: pick Thunder Shock to attack.');
			this.add('-message', 'Hurt? Use your 1 Potion from the item panel in the chat (it uses your turn).');
		},
		// The Throw buttons, as in a wild encounter (which posts them from its own onBattleStart).
		onBattleStart() {
			this.add('uhtml', 'rpball0', ballPanel(encounters(), 'You have 1 Poké Ball and 1 Potion. The Potion buttons appear in the item panel once Pikachu is hurt.'));
		},
		onFaint(pokemon) {
			if (pokemon.side.pokemonLeft > 1) return;
			this.add('-message', "Normally you'd earn money, EXP and team EXP (!share) now, and a fainted Pokémon stays fainted until !heal at a Pokémon Centre.");
			tutorialNextSteps(this);
		},
		onResidualOrder: 99,
		onResidual() {
			const wild = this.sides.find(s => /^Wild /.test(s.name));
			const mon = wild && wild.active[0];
			if (!mon || mon.fainted || this.rpTutorialHinted) return;
			if (mon.hp <= mon.maxhp / 2) {
				this.rpTutorialHinted = true;
				this.add('-message', "Step 2: Rattata is weak! Press Throw in the chat to throw your Poké Ball and catch it (or finish it off).");
			}
		},
		...RP_TURN_ACTIONS,

		searchShow: false,
		challengeShow: true,
		rated: false,
	},
	WILD = {
		name: "[Gen 9] RP Battle (Wild Encounter)",
		desc: "A wild Pokémon from the RP. Beat it, or weaken it and throw a ball.",

		/**
		 * RP Battle's rules, plus a ball.
		 *
		 * The wild side is always one Pokemon played by the RP bot under a
		 * "Wild ..." name, and it comes from /wild in the Roleplay room rather
		 * than from a challenge anybody types. Your own side is your RP team,
		 * as free as RP Battle is, because the level cap and what you own are
		 * the RP's business and not this server's.
		 *
		 * No team preview: you don't get to see what's in the grass before it
		 * jumps out.
		 */
		ruleset: [
			'Cancel Mod',
			'Max Team Size = 24',
			'Max Move Count = 24',
			'Max Level = 9999',
			'Default Level = 100',
		],
		battle: { trunc: Math.trunc },

		onBegin() {
			allGimmicks.call(this);
			installCatching(this);
			installItems(this);
		},
		onBattleStart() {
			if (this.sides.some(isWildSide)) this.add('uhtml', 'rpball0', ballPanel(encounters()));
		},

		// A throw or an item happens before anything else that turn, the way it does in the games.
		...RP_TURN_ACTIONS,

		searchShow: false,
		challengeShow: true,
		rated: false,
	},


	{
		name: "[Gen 9] RP Battle (Wild Doubles)",
		desc: "Two wild Pokémon at once. Knock one out, then catch the other.",
		/*
		 * The same as RP Wild Encounter in every respect but the number of
		 * Pokemon: it borrows that format's rules and handlers rather than
		 * keeping a second copy of them that could drift.
		 */
		gameType: 'doubles',
		ruleset: ['Cancel Mod', 'Max Team Size = 24', 'Max Move Count = 24', 'Max Level = 9999', 'Default Level = 100'],
		battle: { trunc: Math.trunc },
		onBegin() { WILD.onBegin.call(this); },
		onBattleStart() { WILD.onBattleStart.call(this); },
		onModifyPriority(priority, pokemon) { return WILD.onModifyPriority.call(this, priority, pokemon); },
		onBeforeMovePriority: 100,
		onBeforeMove(pokemon) { return WILD.onBeforeMove.call(this, pokemon); },
		searchShow: false,
		challengeShow: true,
		rated: false,
	},
	{
		name: "[Gen 9] RP Battle (Doubles)",
		desc: "RP Battle as a double battle: no rules, two Pokémon out a side.",
		gameType: 'doubles',
		ruleset: ['Team Preview', 'Cancel Mod', 'Max Team Size = 24', 'Max Move Count = 24', 'Max Level = 9999', 'Default Level = 100'],
		battle: { trunc: Math.trunc },
		onBegin() {
			allGimmicks.call(this);
			installItems(this);
		},
		...RP_TURN_ACTIONS,
		searchShow: false,
		challengeShow: true,
		rated: false,
	},

	/**
	 * The ladder: our own National Dex, tier by tier.
	 *
	 * Every Pokemon that ever existed, tiered by how it actually performs rather
	 * than by which generation it came from. These four stand on Smogon's own
	 * National Dex lists, which is the part nobody should invent from scratch:
	 * they are built from real usage and they update when Smogon updates.
	 *
	 * National Dex tiering stops at RU - everything below is pooled there - so
	 * NU, PU and ZU need a list that does not exist yet and are missing rather
	 * than present and wrong. See scripts/build-rp-tiers.js when they arrive.
	 */
	{
		name: "[Gen 9] RP Random Battle",
		desc: "Random teams on this server's own dex - buffs, un-nerfs and all.",

		/**
		 * Random Battle, but played on our data.
		 *
		 * Every change this server makes lives in the base dex, so a random
		 * battle here already hands out the un-nerfed Protean, the Battle Bond
		 * that still transforms, and Dark Void at the accuracy it used to have.
		 * What it could not do was roll a buffed Pokemon: Showdown's set table
		 * has no entry for a Simisage, so the one format meant to show this
		 * server off was the one that never showed any of it.
		 *
		 * data/velvet/random-sets.js fills that in, for this format only.
		 */
		mod: 'gen9',
		team: 'random',
		ruleset: ['Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod'],

		searchShow: true,
		challengeShow: true,
		tournamentShow: true,
		rated: true,
	},

	// Above Ubers: the tier with nothing taken out of it.
	rpTier('AG', '[Gen 9] National Dex AG'),
	rpTier('Ubers', '[Gen 9] National Dex Ubers'),
	rpTier('OU', '[Gen 9] National Dex', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),
	rpTier('UU', '[Gen 9] National Dex UU', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),
	rpTier('RU', '[Gen 9] National Dex RU', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),

	/**
	 * Below RU, where National Dex stops.
	 *
	 * National Dex tiers everything weaker than RU *as* RU - one pool of nearly
	 * six hundred Pokemon - so there is no ND list to stand on down here. These
	 * three stand on the ninth generation's own NU, PU and ZU instead, which are
	 * real lists maintained from real usage.
	 *
	 * The trade is that a Pokemon with no ninth-generation tier - anything that
	 * did not make it into Scarlet and Violet - is not in them, so these are the
	 * three RP tiers that are not full National Dex. Fixing that means tiering
	 * several hundred Pokemon from usage statistics, which is a job of its own
	 * and a list that has to be maintained; until then, being narrower than
	 * promised beats being wrong about who belongs.
	 */
	/*
	 * Little Cup, which is where this server's own Pokemon are actually played.
	 *
	 * The monkeys were rebuilt here - a terrain setter, the priority move that
	 * goes with it, thirty-odd moves each - and then their pre-evolutions were
	 * given the same, on the principle that a buff belongs to a family. Pansage,
	 * Pansear and Panpour are the stage that has a game to be in, at 316 base
	 * stats, and this server had no format they could be brought to.
	 *
	 * National Dex LC rather than the ninth generation's own, for the same
	 * reason every RP tier above it stands on National Dex: the Pokemon that
	 * were cut are the whole point.
	 *
	 * No !Terastal Clause, and that is not an oversight. National Dex LC does
	 * not carry the clause - measured, not assumed - and removing a rule a
	 * format does not have is an error thrown while building the list every
	 * connecting client asks for. One of those took the whole server down once.
	 */
	rpTier('LC', '[Gen 9] National Dex LC', UBERS_ONLY_ITEM),

	rpTier('NU', '[Gen 9] NU', UBERS_ONLY_ITEM),
	rpTier('PU', '[Gen 9] PU', UBERS_ONLY_ITEM),
	rpTier('ZU', '[Gen 9] ZU', UBERS_ONLY_ITEM),

	/**
	 * The same idea, in the generations that came before.
	 *
	 * OU and Ubers only. Those are the two tiers every generation has had for
	 * its whole life, they are the two anybody asks for, and a past generation
	 * with nine RP tiers in it would be nine empty queues.
	 *
	 * What each stands on differs, and has to: the eighth generation has a
	 * National Dex and uses it, so RP there is the same "everything that ever
	 * existed" idea as the ninth. Nothing earlier has a National Dex at all -
	 * the concept did not exist - so those stand on that generation's own OU and
	 * Ubers, which is what those words mean there.
	 *
	 * Gimmicks follow the generation rather than the tier. allGimmicks hands out
	 * Mega Evolution from the sixth, Dynamax from the eighth and
	 * Terastallization from the ninth, so a Gen 8 RP battle has Megas and
	 * Dynamax and no Tera, and a Gen 3 RP battle has none of the three - which
	 * is the point of playing Gen 3.
	 */
	{
		section: "RP Past Gens",
		column: 1,
	},
	rpTier('Ubers', '[Gen 8] National Dex Ubers', { gen: 8, rules: UNBAN_DYNAMAX }),
	rpTier('OU', '[Gen 8] National Dex', { gen: 8, rules: UNBAN_DYNAMAX }),
	rpTier('Ubers', '[Gen 7] Ubers', { gen: 7 }),
	rpTier('OU', '[Gen 7] OU', { gen: 7 }),
	rpTier('Ubers', '[Gen 6] Ubers', { gen: 6 }),
	rpTier('OU', '[Gen 6] OU', { gen: 6 }),
	rpTier('Ubers', '[Gen 5] Ubers', { gen: 5 }),
	rpTier('OU', '[Gen 5] OU', { gen: 5 }),
	rpTier('Ubers', '[Gen 4] Ubers', { gen: 4 }),
	rpTier('OU', '[Gen 4] OU', { gen: 4 }),
	rpTier('Ubers', '[Gen 3] Ubers', { gen: 3 }),
	rpTier('OU', '[Gen 3] OU', { gen: 3 }),
	rpTier('Ubers', '[Gen 2] Ubers', { gen: 2 }),
	rpTier('OU', '[Gen 2] OU', { gen: 2 }),
	rpTier('Ubers', '[Gen 1] Ubers', { gen: 1 }),
	rpTier('OU', '[Gen 1] OU', { gen: 1 }),
];

/*
 * Halloween 2026 event rule, in every format above: the Banettite-Halloween
 * belongs to the shiny Banette the Witching Hour board hands out, so only a
 * shiny Banette may hold it. Chained after any set check a format already has.
 */
function witchStoneRule(set) {
	// Shown on the Mega's builder page, never picked: Poltergeist becomes it on Mega Evolution.
	if ((set.moves || []).some(m => this.dex.moves.get(m).id === 'witchssnatch')) {
		return [`${set.name || set.species} can't pick Witch's Snatch: give it Poltergeist, which becomes Witch's Snatch when it Mega Evolves (Halloween 2026 event).`];
	}
	if (this.dex.items.get(set.item).id !== 'banettitehalloween') return [];
	if (set.shiny) return [];
	return [`${set.name || set.species} must be shiny to hold the Banettite-Halloween (Halloween 2026 event rule).`];
}
for (const format of exports.Formats) {
	if (!format.name) continue;
	const own = format.onValidateSet;
	format.onValidateSet = function (set, fmt, setHas, teamHas) {
		const problems = [...((own && own.call(this, set, fmt, setHas, teamHas)) || []), ...witchStoneRule.call(this, set)];
		return problems.length ? problems : undefined;
	};
}
