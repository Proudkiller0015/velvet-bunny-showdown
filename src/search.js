'use strict';
/**
 * Turn-level search.
 *
 * The rest of the AI scores each of our options against the position as it
 * stands, which quietly assumes the opponent will stand still and let it
 * happen. That is the single biggest thing separating it from a strong player:
 * the moves that lose games are the ones that look fine until the opponent
 * answers.
 *
 * This builds the payoff matrix of OUR options against THEIR likely replies,
 * plays each pair out for one turn, evaluates the resulting position, and picks
 * by a blend of the worst case and the average. It is one turn deep - Pokemon is
 * a simultaneous-move game with hidden information, so deeper search on guessed
 * sets mostly compounds the guesses.
 *
 * Every number it weighs by lives in WEIGHTS, so the trainer can tune them
 * against actual results rather than against my intuition.
 */

const DEFAULT_WEIGHTS = {
	// How much a point of percentage HP is worth, ours versus theirs.
	ourHp: 1.0,
	theirHp: 1.0,
	// A knockout is worth far more than the HP it happened to cost.
	koBonus: 60,
	faintPenalty: 70,
	// Giving up the turn to switch costs tempo; coming in on a hit costs HP.
	switchCost: 12,
	// How pessimistic to be. 1 = assume their best reply every time, 0 = assume
	// an average one. Pure minimax plays too scared against a human who cannot
	// see our set either.
	pessimism: 0.65,
	// Keeping something that still wins the game matters beyond its HP.
	valueWeight: 0.35,
	// Chip that does not threaten a KO is worth less than the number suggests.
	chipDiscount: 0.85,
	// How much to trust the search against the heuristic score it is re-ranking.
	// The heuristic carries judgement the one-turn playout cannot see - setup
	// value, hazards, status, what a Pokemon is still worth later - so the search
	// refines that ranking rather than replacing it. Replacing it outright
	// measured at 40% against champion; this is the knob that fixes that.
	searchWeight: 0.45,
};

// Chip that status does every turn it is out: burn a sixteenth, poison (and Toxic, averaged) an eighth.
const RESIDUAL_OF = { brn: 6.25, psn: 12.5, tox: 12.5 };

class TurnSearch {
	constructor(ai, weights) {
		this.ai = ai;
		this.w = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
	}

	/**
	 * @returns {{kind:'move'|'switch', n:number, target:number|null, score:number, name?:string}|null}
	 */
	choose(gen, active, entry, request, state, field, candidates, incoming) {
		const foes = state.foes();
		if (!foes.length || !candidates.length) return null;
		const foe = foes[0];
		const them = this.ai.foePokemon(gen, foe);
		const me = this.ai.myPokemon(gen, entry, state);
		const middle = !!this.ai.cfg.middleGround;

		const theirActions = this.theirActions(gen, them, me, foe, field);
		if (!theirActions.length) return null;

		/*
		 * Middle-ground plays (Pinkacross, "99% of Players Get This Wrong"; A6-A8,
		 * 24 Sep 2026). Not the safe play and not the greedy one: list their
		 * *likely* options, weight them by how likely they are, and pick what does
		 * well across the weighted spread, pricing the case it does not cover by
		 * what it would cost. How pessimistic to be follows the game state:
		 *   - well ahead, play safe - raise pessimism, so a line that can lose
		 *     the lead is avoided even when it is unlikely;
		 *   - clearly behind, stop playing middle ground and read them - lower
		 *     pessimism, and lean on their most likely play, which for a player
		 *     who thinks they are winning is the safe one (How to Make Comebacks).
		 */
		let pessimism = this.w.pessimism;
		/*
		 * Turn order as the rest of the AI reads it: boosts, paralysis, weather and
		 * Scarf through speedOf(), and their Speed at full investment through
		 * foeSpeed(). playTurn compared the raw stats - 85 Speed EVs for them - so
		 * the heuristic thought it moved second and the playout thought it moved
		 * first, or the other way round. (24 Sep 2026)
		 */
		let board = {
			me, them, entry, foe,
			mySpe: this.ai.speedOf(me, me.boosts, me.status, state.weather),
			theirSpe: this.ai.foeSpeed(gen, foe, state.weather),
		};
		if (middle) {
			this.weighReplies(gen, theirActions, me, foe, field, state);
			const edge = this.ai.advantage(state, request);
			if (edge > 0.15) pessimism = Math.min(0.9, pessimism + edge);
			else if (edge < -0.15) {
				pessimism = 0.3;
				// Their safe play gets the benefit of the doubt: the likeliest reply, and
				// the switch out of a bad matchup, count for more.
				const top = Math.max(...theirActions.map(a => a.weight));
				for (const a of theirActions) if (a.weight === top || a.switch) a.weight *= 1.5;
			}
			// A faint costs what the Pokemon was still worth, not a flat number.
			board = { ...board, value: this.ai.monValue(gen, entry, state, request) };
		}

		let best = null;
		for (const ours of candidates) {
			const outcomes = theirActions.map(theirs => this.expected(gen, board, ours, theirs, state, field, request));
			let worst, mean;
			if (middle) {
				// The worst case among replies they would plausibly make: an immune
				// move or a pointless one is not a case to play around.
				const top = Math.max(...theirActions.map(a => a.weight));
				const plausible = outcomes.filter((_, i) => theirActions[i].weight >= top * 0.25);
				worst = Math.min(...plausible);
				const total = theirActions.reduce((a, t) => a + t.weight, 0) || 1;
				mean = outcomes.reduce((a, o, i) => a + o * theirActions[i].weight, 0) / total;
			} else {
				worst = Math.min(...outcomes);
				mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
			}
			const lookahead = pessimism * worst + (1 - pessimism) * mean;
			// Combine, do not replace: the heuristic knows things a one-turn
			// playout does not.
			const score = (ours.score || 0) + this.w.searchWeight * lookahead;
			if (!best || score > best.score) best = { ...ours, score };
		}
		return best;
	}

	/**
	 * How plausible each of their replies is, written onto the replies as
	 * `weight`, plus the reply the old search never had: they switch out.
	 *
	 * An attack is as likely as it is good for them - how much it takes off us,
	 * and more again if it KOs - and one that does nothing (an immunity) is
	 * pruned to almost nothing, like a Sucker Punch into a status move. The
	 * switch is as likely as our pressure on them makes it (switchPressure): his
	 * U-turn-versus-Earthquake example only exists once "they switch" is on the
	 * list. (24 Sep 2026)
	 */
	weighReplies(gen, actions, me, foe, field, state) {
		const myHp = ((me.originalCurHP || me.maxHP()) / (me.maxHP() || 1)) * 100;
		for (const a of actions) {
			if (a.weight !== undefined) continue;
			a.weight = a.damage <= 1 ? 0.03 : 0.15 + Math.min(1, a.damage / 100) + (a.damage >= myHp ? 0.8 : 0);
			if (a.unseen) a.weight *= 0.7;
		}
		if (this.ai.cfg.switching === false) return;
		let pressure = 0;
		try { pressure = this.ai.switchPressure(gen, me, [foe], field); } catch (e) { pressure = 0; }
		if (pressure <= 0.1) return;
		/*
		 * Who comes in: whatever of theirs takes least from our hardest-hitting
		 * move - that is the switch a good player makes, and the one that turns
		 * our Earthquake into nothing (his example). Unknown when they have
		 * nothing benched that we know of.
		 */
		let switchIn = null;
		try {
			const bench = this.ai.foeRemaining(state).list.filter(f => f.bench && !f.fainted);
			const names = this.ai.myMoveNames || [];
			const hardest = f => Math.max(0, ...names.map(m => this.ai.damageToFoe(gen, me, f, m, field)));
			let least = Infinity;
			for (const f of bench) { const d = hardest(f); if (d < least) { least = d; switchIn = f; } }
		} catch (e) { switchIn = null; }
		actions.push({ name: null, damage: 0, priority: 7, switch: true, switchIn, weight: pressure * 1.2 });
	}

	/**
	 * One pairing, with our miss played out as its own branch.
	 *
	 * A 70% KO is two futures - the KO, and a turn where we did nothing and they
	 * hit us - not one future at 70% of the damage. Shrinking the damage instead
	 * would turn a sometimes-KO into a never-KO and lose the KO bonus entirely
	 * (A10, Pinkacross; 24 Sep 2026).
	 */
	expected(gen, board, ours, theirs, state, field, request) {
		const hit = ours.accuracy === undefined ? 1 : ours.accuracy;
		const landed = this.playTurn(gen, board, ours, theirs, state, field, request);
		if (hit >= 1 || !(ours.damage > 0)) return landed;
		const missed = this.playTurn(gen, board, { ...ours, damage: 0 }, theirs, state, field, request);
		return hit * landed + (1 - hit) * missed;
	}

	/** What the opponent might reasonably do this turn. */
	theirActions(gen, them, me, foe, field) {
		const seen = [...foe.moves];
		const out = [];
		/*
		 * With the foe model, its likely unseen attacks are replies too (a foe that
		 * had shown one move was playing out as a one-move Pokemon), at a little
		 * under the weight of the ones it has shown. (24 Sep 2026)
		 */
		const list = this.ai.modelsFoes && this.ai.modelsFoes() ? (this.ai.foeAttacks(gen, foe) || []) : seen;
		if (list.length) {
			for (const m of list) {
				out.push({ name: m, damage: this.ai.damagePct(gen, them, me, m, field), priority: this.movePriority(gen, m), unseen: !seen.includes(m) });
			}
		} else {
			// Nothing revealed: assume something around their best plausible hit.
			const rough = this.ai.roughIncoming(gen, them, me, field);
			out.push({ name: null, damage: rough, priority: 0 });
			out.push({ name: null, damage: rough * 0.5, priority: 0 });
		}
		// Shares of our maximum HP, the unit playTurn counts our HP in (hpUnits; see ai.chooseForSlot).
		if (this.ai.cfg.hpUnits) {
			const frac = (me.originalCurHP || me.maxHP()) / (me.maxHP() || 1);
			for (const a of out) a.damage *= frac;
		}
		return out;
	}

	movePriority(gen, name) {
		try {
			const move = require('@pkmn/dex').Dex.forGen(gen.num).moves.get(name);
			return move ? (move.priority || 0) : 0;
		} catch (e) {
			return 0;
		}
	}

	/**
	 * Play one turn out and score where it leaves us. Positive is good for us.
	 */
	playTurn(gen, board, ours, theirs, state, field, request) {
		const w = this.w;
		const meMaxHp = board.me.maxHP() || 1;
		let myHp = ((board.me.originalCurHP || meMaxHp) / meMaxHp) * 100;
		let theirHp = Math.max(0, board.foe.hp / (board.foe.maxhp || 100) * 100);

		let score = 0;
		// Our damage is a share of what they have left (100 kills); theirHp is a share of their maximum.
		let myDamage = (ours.damage || 0) * (this.ai.cfg.hpUnits ? theirHp / 100 : 1);
		let incoming = theirs.damage || 0;
		// Stall's Protect (ai.js marks it only for a stall team): their hit this turn is blocked (R9).
		if (ours.protect) incoming = 0;

		if (ours.kind === 'switch') {
			// We do nothing this turn and eat the hit on the way in. The
			// incoming figure was measured against the Pokemon leaving, so use
			// the replacement's own matchup where we have it.
			myDamage = 0;
			incoming = ours.incomingOnEntry !== undefined ? ours.incomingOnEntry : incoming;
			myHp = ours.hpPct !== undefined ? ours.hpPct : myHp;
			score -= w.switchCost;
			// What we bring in matters beyond this turn.
			score += (ours.value || 0) * w.valueWeight * 0.1;
		}

		// Turn order decides who gets to act at all when a knockout is involved.
		const mySpe = board.mySpe !== undefined ? board.mySpe : (board.me.stats && board.me.stats.spe) || 0;
		const theirSpe = board.theirSpe !== undefined ? board.theirSpe : (board.them.stats && board.them.stats.spe) || 0;
		const ourPriority = ours.priority || 0;
		const theirPriority = theirs.priority || 0;
		let weMoveFirst;
		if (ourPriority !== theirPriority) weMoveFirst = ourPriority > theirPriority;
		else weMoveFirst = state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe;
		if (ours.kind === 'switch') weMoveFirst = true;   // switches resolve first

		/*
		 * They switch out: our hit lands on whatever comes in, which was chosen
		 * to take it, so it counts for less and kills nothing; they deal nothing.
		 * A status or setup move gets its free turn. (24 Sep 2026)
		 */
		if (theirs.switch) {
			if (ours.kind === 'switch') return score;
			const onEntry = theirs.switchIn && ours.name && myDamage > 0
				? this.ai.damageToFoe(gen, board.me, theirs.switchIn, ours.name, field) : myDamage * 0.45;
			score += Math.min(onEntry, 100) * w.theirHp * w.chipDiscount;
			// A pivot answers their switch with ours: we bring in what beats the
			// newcomer, which is the whole point of U-turn over Earthquake.
			if (/^(uturn|voltswitch|flipturn)$/.test(String(ours.name || '').toLowerCase().replace(/[^a-z]/g, ''))) score += 12;
			if (ours.heuristic) score += ours.heuristic * 0.4;
			if (ours.heal) score += Math.min(ours.heal, 100 - myHp) * w.ourHp;
			return score;
		}

		/*
		 * A heal is HP like any other (recovery, 24 Sep 2026). It was credited
		 * nothing, so Recover could only ever lose the playout to an attack. Moving
		 * first, it lands before their hit and can turn a KO into a survival;
		 * moving second, it counts only if we are still there to use it.
		 */
		if (ours.heal && ours.kind !== 'switch') {
			if (weMoveFirst) {
				const gain = Math.min(ours.heal, 100 - myHp);
				myHp += gain;
				score += gain * w.ourHp;
			} else if (incoming < myHp) {
				score += Math.min(ours.heal, 100 - (myHp - incoming)) * w.ourHp;
			}
		}

		const killsThem = myDamage >= theirHp;
		const killsUs = incoming >= myHp;
		// The cost of the case our play does not cover is what it costs us: losing
		// the win condition is worse than losing the spare (middle ground, step 5).
		const faint = board.value === undefined ? w.faintPenalty : w.faintPenalty * (0.6 + 0.8 * board.value / 100);

		if (weMoveFirst && killsThem && ours.kind !== 'switch') {
			// They never get to answer.
			score += w.koBonus + theirHp * w.theirHp;
			return score;
		}
		if (!weMoveFirst && killsUs) {
			// We are knocked out before doing anything.
			score -= faint + myHp * w.ourHp;
			// A priority move or a switch would at least have done something.
			return score;
		}

		// Both act.
		const dealt = Math.min(myDamage, theirHp);
		const taken = Math.min(incoming, myHp);
		score += dealt * w.theirHp * (killsThem ? 1 : w.chipDiscount);
		score -= taken * w.ourHp;
		if (killsThem) score += w.koBonus;
		if (killsUs) score -= faint;

		// Status and setup have no damage number; give them their heuristic worth.
		if (ours.heuristic) score += ours.heuristic * 0.4;
		void request;
		return score;
	}

	// ------------------------------------------------------------------ endgame
	/**
	 * The endgame, planned exactly (Pinkacross, How to Play Like a Pro: the loose
	 * plan is for the midgame; with few Pokemon and turns left, plan "if they
	 * bring X I do Y, if they bring Z I sack W"; A16, 24 Sep 2026).
	 *
	 * With three or fewer on each side, every one of theirs seen, and singles,
	 * the whole remaining game is small enough to search a few turns deep over
	 * every move and switch of both sides, using damage numbers worked out once
	 * from the calculator. The model is deliberately plain - average damage
	 * scaled by accuracy, speed and priority for order, our hazards on our
	 * switch-ins, the best-matched replacement after a faint, burn and poison chip,
	 * no boosts gained - because its job is move ORDER and who-trades-with-whom,
	 * which that captures, not the last percent.
	 *
	 * It must never make the bot time out: iterative deepening under a hard
	 * wall-clock budget (ENDGAME_MS), checked as it goes, and the deepest
	 * finished depth is what counts. The rest of the AI has no timer of its own.
	 *
	 * Returns null when it does not apply; otherwise the model and the per-action
	 * values at our root.
	 */
	endgameModel(gen, request, state, field) {
		const ai = this.ai;
		if (!ai.cfg.endgame || !ai.cfg.search) return null;
		if ((request.active && request.active.length > 1) || (request.forceSwitch && request.forceSwitch.length > 1)) return null;
		if (state.gameType && state.gameType !== 'singles') return null;
		const ours = (request.side.pokemon || []).map((p, idx) => ({ p, i: idx + 1 })).filter(x => !/fnt/.test(x.p.condition || ''));
		if (!ours.length || ours.length > 3) return null;
		const { list, unknown } = ai.foeRemaining(state);
		const theirs = list.filter(f => !f.fainted && (f.hp === undefined || f.hp > 0));
		if (unknown > 0 || !theirs.length || theirs.length > 3) return null;

		const { Dex } = require('@pkmn/dex');
		const dex = Dex.forGen(gen.num);
		const attack = name => { const d = dex.moves.get(name); return d && d.exists && d.category !== 'Status' ? d : null; };
		/*
		 * Moves that work only on the first turn in (Fake Out, First Impression,
		 * Mat Block) are left out of the tree except as a root move of a Pokemon
		 * that has just arrived: Purugly used Fake Out four turns running because
		 * the tree thought it would flinch every time. (24 Sep 2026)
		 */
		const firstTurnOnly = d => /^(fakeout|firstimpression|matblock)$/.test(d.id);
		const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const meFresh = !!(state.mineCameIn && state.turn <= state.mineCameIn + 1) || state.turn <= 1;
		const foeFresh = !!(state.foeCameIn && state.turn <= state.foeCameIn + 1) || state.turn <= 1;
		const residual = (status, ability) => (/^(magicguard|poisonheal)$/.test(idOf(ability)) ? 0 : RESIDUAL_OF[status] || 0);
		const O = ours.map(({ p, i }) => {
			const mon = ai.myPokemon(gen, p, state);
			const hpFrac = (mon.originalCurHP || mon.maxHP()) / (mon.maxHP() || 1);
			const names = (p.active && ai.myMoveNames && ai.myMoveNames.length ? ai.myMoveNames : (p.moves || []).map(m => (dex.moves.get(m) || {}).name || m));
			const all = names.map(n => dex.moves.get(n)).filter(d => d && d.exists);
			const status = (/ (brn|psn|tox|par|slp|frz)/.exec(p.condition || '') || [])[1] || '';
			return {
				i, entry: p, mon, hp: hpFrac * 100, hpFrac, active: !!p.active,
				spe: ai.speedOf(mon, p.active ? mon.boosts : {}, mon.status, state.weather),
				moves: all.filter(d => d.category !== 'Status' && (!firstTurnOnly(d) || (p.active && meFresh))),
				// Burn, poison and paralysis moves are played for what they do, not as a pass.
				inflicts: all.filter(d => d.category === 'Status' && /^(brn|psn|tox|par)$/.test(d.status || '') && (d.accuracy === true || d.accuracy >= 75)),
				// Recover and the like, played as the HP they restore (Rest's sleep is not modelled, so not Rest).
				heals: ai.cfg.recovery ? all.filter(d => d.flags && d.flags.heal && d.target === 'self' && d.id !== 'rest' && d.id !== 'wish').map(d => ({ d, amount: ai.healShare(d, state) })) : [],
				choice: /^choice(band|specs|scarf)$/.test(idOf(p.item)),
				res: residual(status, p.ability || p.baseAbility),
				hz: p.active ? 0 : ai.entryHazards(gen, mon, p, state),
			};
		});
		const T = theirs.map(foe => {
			const mon = ai.foePokemon(gen, foe);
			const seen = [...(foe.moves || [])].filter(m => attack(m));
			let names = ai.modelsFoes && ai.modelsFoes()
				// The likely unseen attacks of the sets that fit what it has shown (foeModel).
				? (ai.foeAttacks(gen, foe) || []).filter(m => attack(m))
				: [...new Set([...seen, ...ai.hiddenAttacks(gen, foe), ...(seen.length >= 4 ? [] : (ai.knownAttacks(gen, foe.species) || []))])];
			if (!names.length) names = ai.probeAttacks(gen, mon);
			names = names.filter(n => !firstTurnOnly(attack(n) || {}) || (!foe.bench && foeFresh));
			const types = (foe.tera ? [foe.tera] : (dex.species.get(foe.transformed || foe.species) || {}).types) || [];
			const ability = idOf(foe.ability);
			// Which of our status moves would take on it: not already statused, not a type or ability that stops it.
			const takes = d => {
				if (foe.status || /^(goodasgold|magicbounce|prescience|purifyingsalt|comatose)$/.test(ability)) return false;
				if (foe.immuneTo && foe.immuneTo.has(d.name)) return false;
				if (d.status === 'brn') return !types.includes('Fire') && !/^(waterveil|waterbubble|thermalexchange)$/.test(ability);
				if (d.status === 'par') return !types.includes('Electric') && !(d.id === 'thunderwave' && types.includes('Ground')) && ability !== 'limber';
				return !types.includes('Poison') && !types.includes('Steel') && !/^(immunity|pastelveil)$/.test(ability);
			};
			return {
				foe, mon, hp: Math.max(0, (foe.hp || 0) / (foe.maxhp || 100) * 100), hpFrac: Math.max(0.01, (foe.hp || 0) / (foe.maxhp || 100)),
				active: !foe.bench, spe: ai.foeSpeed(gen, foe, state.weather), names, takes,
				status: foe.status || '', res: residual(foe.status, foe.ability),
			};
		});
		// Damage as a share of the target's MAXIMUM health, once per pairing.
		for (const o of O) {
			o.dmg = T.map(t => o.moves.map(d => ai.damageToFoe(gen, o.mon, t.foe, d.name, field) * t.hpFrac *
				(ai.cfg.accuracy ? ai.hitChance(gen, d, o.mon, t.foe, state) : 1)));
			o.lands = T.map(t => o.inflicts.map(d => t.takes(d)));
		}
		for (const t of T) {
			// Keep their four hardest-hitting options against our team; the rest are noise.
			const scored = t.names.map(name => {
				const d = attack(name);
				const into = O.map(o => (d ? ai.damagePct(gen, t.mon, o.mon, name, field) * o.hpFrac * (d.accuracy === true ? 1 : (d.accuracy || 100) / 100) : 0));
				return { d, into, top: Math.max(0, ...into) };
			}).filter(x => x.d && x.top > 0).sort((a, b) => b.top - a.top).slice(0, 4);
			t.moves = scored.map(x => x.d);
			t.dmg = O.map((_, a) => scored.map(x => x.into[a]));
		}
		const oa = O.findIndex(o => o.active), ta = T.findIndex(t => t.active);
		/*
		 * Locked into one move by a Choice item: the tree may not pick another until
		 * it switches. Indeedee-F clicked Hyper Voice into a Ghost sixteen times while
		 * the tree planned the better move it believed it could use next turn.
		 */
		let lock = -1;
		const act = request.active && request.active[0];
		if (oa >= 0 && O[oa].choice && act && act.moves) {
			const usable = act.moves.filter(m => !m.disabled && (m.pp === undefined || m.pp > 0));
			if (usable.length === 1 && act.moves.length > 1) lock = O[oa].moves.findIndex(d => d.name === usable[0].move);
		}
		return { O, T, oa: oa < 0 ? 0 : oa, ta: ta < 0 ? 0 : ta, trickRoom: !!state.trickRoom, lock };
	}

	/**
	 * Values of our root actions, deepest finished depth within the budget.
	 * Actions: { m } a move of the active, { st } a status move it inflicts, { hl } a heal,
	 * { sw } a switch, { pass } any other status move.
	 *
	 * Beyond the plain damage race (24 Sep 2026): a Choice-locked Pokemon of ours
	 * keeps its move until it switches; burn, poison and paralysis we inflict
	 * stay on their Pokemon, chip it every turn it is out, and a burn halves its
	 * physical hits and paralysis its Speed (Night Shade into a Normal type was
	 * kept by the tree because Will-O-Wisp read as doing nothing); and every
	 * turn discounts what follows, so the same result sooner is worth more -
	 * "switch now" beats "switch next turn".
	 */
	endgameSearch(model, { forcedFrom = null } = {}) {
		const ENDGAME_MS = 250, MAX_DEPTH = 4, DISCOUNT = 0.97;
		const started = Date.now();
		const { O, T, trickRoom } = model;
		const p = this.w.pessimism;
		let nodes = 0;
		const ABORT = {};
		const alive = hp => hp.some(h => h > 0);
		const actions = (side, act, hp, root, lock) => {
			const out = [];
			const me = side[act];
			if (hp[act] > 0) {
				if (side === O && lock >= 0) out.push({ m: lock });
				else {
					me.moves.forEach((_, m) => out.push({ m }));
					if (side === O) me.inflicts.forEach((_, s) => out.push({ st: s }));
					if (side === O) me.heals.forEach((_, h) => out.push({ hl: h }));
					if (root || !me.moves.length) out.push({ pass: true });
				}
			}
			side.forEach((_, k) => { if (k !== act && hp[k] > 0) out.push({ sw: k }); });
			return out.length ? out : [{ pass: true }];
		};
		// Who comes in after a faint: the best trade against what is in front.
		const replace = (side, other, hp, otherAct) => {
			let best = -1, bestScore = -Infinity;
			side.forEach((s, k) => {
				if (hp[k] <= 0) return;
				const out = Math.max(0, ...(s.dmg[otherAct] || []));
				const back = Math.max(0, ...((other[otherAct] && other[otherAct].dmg[k]) || []));
				const score = out - back;
				if (score > bestScore) { bestScore = score; best = k; }
			});
			return best;
		};
		// S: { lock, tst } - our Choice lock, and the status we have put on each of theirs.
		const step = (oa, ta, ohp, thp, a, b, S) => {
			ohp = ohp.slice(); thp = thp.slice();
			let lock = S.lock, tst = S.tst;
			if (a.sw !== undefined) { oa = a.sw; ohp[oa] = Math.max(0, ohp[oa] - O[oa].hz); lock = -1; }
			if (b.sw !== undefined) ta = b.sw;
			const ourMove = a.m !== undefined ? O[oa].moves[a.m] : null;
			const ourStatus = a.st !== undefined ? O[oa].inflicts[a.st] : null;
			const ourHeal = a.hl !== undefined ? O[oa].heals[a.hl] : null;
			const theirMove = b.m !== undefined ? T[ta].moves[b.m] : null;
			if (ourMove && O[oa].choice) lock = a.m;
			const inflicted = tst[ta];
			const ours = () => {
				if (ohp[oa] <= 0 || thp[ta] <= 0) return;
				if (ourHeal) { ohp[oa] = Math.min(100, ohp[oa] + ourHeal.amount); return; }
				if (ourMove) thp[ta] = Math.max(0, thp[ta] - O[oa].dmg[ta][a.m]);
				else if (ourStatus && !T[ta].status && !tst[ta] && O[oa].lands[ta][a.st]) { tst = tst.slice(); tst[ta] = ourStatus.status; }
			};
			const theirs = () => {
				if (!theirMove || thp[ta] <= 0 || ohp[oa] <= 0) return;
				let hit = T[ta].dmg[oa][b.m];
				if (inflicted === 'brn' && theirMove.category === 'Physical') hit *= 0.5;
				if (inflicted === 'par') hit *= 0.75;
				ohp[oa] = Math.max(0, ohp[oa] - hit);
			};
			let oursFirst;
			const op = ourMove ? ourMove.priority || 0 : ourStatus ? ourStatus.priority || 0 : ourHeal ? ourHeal.d.priority || 0 : 0, tp = theirMove ? theirMove.priority || 0 : 0;
			const theirSpe = inflicted === 'par' ? T[ta].spe * 0.5 : T[ta].spe;
			if (op !== tp) oursFirst = op > tp;
			else oursFirst = trickRoom ? O[oa].spe < theirSpe : O[oa].spe > theirSpe;   // a tie goes to them
			if (oursFirst) { ours(); theirs(); } else { theirs(); ours(); }
			// End of turn: status chip on whoever is out.
			if (thp[ta] > 0) thp[ta] = Math.max(0, thp[ta] - (T[ta].res || RESIDUAL_OF[tst[ta]] || 0));
			if (ohp[oa] > 0 && O[oa].res) ohp[oa] = Math.max(0, ohp[oa] - O[oa].res);
			if (ohp[oa] <= 0 && alive(ohp)) { oa = replace(O, T, ohp, ta); lock = -1; }
			if (thp[ta] <= 0 && alive(thp)) ta = replace(T, O, thp, oa);
			return [oa, ta, ohp, thp, lock === S.lock && tst === S.tst ? S : { lock, tst }];
		};
		const leaf = (ohp, thp) => {
			let v = 0;
			for (const h of ohp) if (h > 0) v += h + 60;
			for (const h of thp) if (h > 0) v -= h + 60;
			return v;
		};
		const value = (oa, ta, ohp, thp, depth, S) => {
			if (++nodes % 512 === 0 && Date.now() - started > ENDGAME_MS) throw ABORT;
			if (!alive(thp)) return 1000 + ohp.reduce((s, h) => s + Math.max(0, h), 0) + depth;
			if (!alive(ohp)) return -1000 - thp.reduce((s, h) => s + Math.max(0, h), 0) - depth;
			if (depth === 0) return leaf(ohp, thp);
			let best = -Infinity;
			const theirs = actions(T, ta, thp, false, -1);
			for (const a of actions(O, oa, ohp, false, S.lock)) {
				let worst = Infinity, sum = 0;
				for (const b of theirs) {
					const [oa2, ta2, ohp2, thp2, S2] = step(oa, ta, ohp, thp, a, b, S);
					const v = value(oa2, ta2, ohp2, thp2, depth - 1, S2);
					if (v < worst) worst = v;
					sum += v;
				}
				const blended = DISCOUNT * (p * worst + (1 - p) * sum / theirs.length);
				if (blended > best) best = blended;
			}
			return best;
		};

		const ohp0 = O.map(o => o.hp), thp0 = T.map(t => t.hp);
		const S0 = { lock: model.lock === undefined ? -1 : model.lock, tst: T.map(() => '') };
		let result = null, depthDone = 0;
		for (let depth = 1; depth <= MAX_DEPTH; depth++) {
			try {
				if (forcedFrom !== null) {
					// A forced replacement: the value of each of ours coming in, both sides then playing on.
					const vals = forcedFrom.map(k => ({ sw: k, value: value(k, model.ta, ohp0, thp0, depth, { ...S0, lock: -1 }) }));
					result = vals;
				} else {
					const theirs = actions(T, model.ta, thp0, false, -1);
					result = actions(O, model.oa, ohp0, true, S0.lock).map(a => {
						let worst = Infinity, sum = 0;
						for (const b of theirs) {
							const [oa2, ta2, ohp2, thp2, S2] = step(model.oa, model.ta, ohp0, thp0, a, b, S0);
							const v = value(oa2, ta2, ohp2, thp2, depth - 1, S2);
							if (v < worst) worst = v;
							sum += v;
						}
						return { ...a, value: DISCOUNT * (p * worst + (1 - p) * sum / theirs.length) };
					});
				}
				depthDone = depth;
			} catch (e) {
				if (e !== ABORT) throw e;
				break;
			}
			if (Date.now() - started > ENDGAME_MS / 3) break;   // the next depth would not finish
		}
		return result ? { actions: result, depth: depthDone, nodes, ms: Date.now() - started } : null;
	}

	/**
	 * The endgame's choice for a normal turn, blended with the heuristic ranking
	 * the rest of the AI produced: a status move is played as a pass in the tree
	 * (or as the status it inflicts) and keeps half its heuristic worth (the tree
	 * cannot see a heal or a boost); a damaging move keeps a little of its
	 * heuristic as a tie-break.
	 *
	 * A move the heuristic already knows fails - an immunity (-35), Fake Out after
	 * the first turn, a status into one that cannot take it (-25 to -30) - is not
	 * the tree's to pick while anything else is left, and then a switch needs no
	 * margin to beat it. (24 Sep 2026)
	 */
	endgame(gen, entry, request, state, field, ranked) {
		let model;
		try { model = this.endgameModel(gen, request, state, field); } catch (e) { return null; }
		if (!model) return null;
		const found = this.endgameSearch(model);
		if (!found || !found.actions.length) return null;
		const active = model.O[model.oa];
		const pass = found.actions.find(a => a.pass);
		const works = ranked.filter(r => !(r.score <= -25));
		const pool = works.length ? works : ranked;
		let best = null;
		for (const r of pool) {
			const m = active.moves.findIndex(d => d.name === r.name);
			const s = m < 0 ? active.inflicts.findIndex(d => d.name === r.name) : -1;
			const h = m < 0 && s < 0 ? active.heals.findIndex(x => x.d.name === r.name) : -1;
			const node = m >= 0 ? found.actions.find(a => a.m === m) : s >= 0 ? found.actions.find(a => a.st === s) : h >= 0 ? found.actions.find(a => a.hl === h) : pass;
			if (!node) continue;
			const score = node.value + (m >= 0 ? 0.3 : 0.5) * (r.score || 0);
			if (!best || score > best.score) best = { kind: 'move', n: r.n, target: r.target, name: r.name, score };
		}
		const margin = works.length ? 10 : 0;
		for (const a of found.actions) {
			if (a.sw === undefined) continue;
			// A switch must clearly beat the best move: it spends the turn.
			if (!best || a.value > best.score + margin) best = { kind: 'switch', i: model.O[a.sw].i, score: a.value };
		}
		if (best) best.endgame = { depth: found.depth, nodes: found.nodes, ms: found.ms };
		return best;
	}

	/** Which of ours to bring in after a faint, planned the same way. */
	endgameReplacement(gen, request, state, field) {
		let model;
		try { model = this.endgameModel(gen, request, state, field); } catch (e) { return null; }
		if (!model) return null;
		const options = model.O.map((o, k) => (o.entry.active ? -1 : k)).filter(k => k >= 0);
		if (!options.length) return null;
		const found = this.endgameSearch(model, { forcedFrom: options });
		if (!found || !found.actions.length) return null;
		const best = found.actions.slice().sort((a, b) => b.value - a.value)[0];
		return { i: model.O[best.sw].i, value: best.value, depth: found.depth };
	}
}

module.exports = { TurnSearch, DEFAULT_WEIGHTS };
