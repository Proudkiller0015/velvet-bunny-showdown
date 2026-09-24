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

		const theirActions = this.theirActions(gen, them, me, foe, field);
		if (!theirActions.length) return null;

		let best = null;
		for (const ours of candidates) {
			const outcomes = theirActions.map(theirs => this.expected(gen, { me, them, entry, foe }, ours, theirs, state, field, request));
			const worst = Math.min(...outcomes);
			const mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
			const lookahead = this.w.pessimism * worst + (1 - this.w.pessimism) * mean;
			// Combine, do not replace: the heuristic knows things a one-turn
			// playout does not.
			const score = (ours.score || 0) + this.w.searchWeight * lookahead;
			if (!best || score > best.score) best = { ...ours, score };
		}
		return best;
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

		const killsThem = myDamage >= theirHp;
		const killsUs = incoming >= myHp;

		if (weMoveFirst && killsThem && ours.kind !== 'switch') {
			// They never get to answer.
			score += w.koBonus + theirHp * w.theirHp;
			return score;
		}
		if (!weMoveFirst && killsUs) {
			// We are knocked out before doing anything.
			score -= w.faintPenalty + myHp * w.ourHp;
			// A priority move or a switch would at least have done something.
			return score;
		}

		// Both act.
		const dealt = Math.min(myDamage, theirHp);
		const taken = Math.min(incoming, myHp);
		score += dealt * w.theirHp * (killsThem ? 1 : w.chipDiscount);
		score -= taken * w.ourHp;
		if (killsThem) score += w.koBonus;
		if (killsUs) score -= w.faintPenalty;

		// Status and setup have no damage number; give them their heuristic worth.
		if (ours.heuristic) score += ours.heuristic * 0.4;
		void request;
		return score;
	}
}

module.exports = { TurnSearch, DEFAULT_WEIGHTS };
