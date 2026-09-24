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
		let board = { me, them, entry, foe };
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
		if (seen.length) {
			for (const m of seen) {
				out.push({ name: m, damage: this.ai.damagePct(gen, them, me, m, field), priority: this.movePriority(gen, m) });
			}
		} else {
			// Nothing revealed: assume something around their best plausible hit.
			const rough = this.ai.roughIncoming(gen, them, me, field);
			out.push({ name: null, damage: rough, priority: 0 });
			out.push({ name: null, damage: rough * 0.5, priority: 0 });
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
		let myDamage = ours.damage || 0;
		let incoming = theirs.damage || 0;

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
		const mySpe = (board.me.stats && board.me.stats.spe) || 0;
		const theirSpe = (board.them.stats && board.them.stats.spe) || 0;
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
			return score;
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
}

module.exports = { TurnSearch, DEFAULT_WEIGHTS };
