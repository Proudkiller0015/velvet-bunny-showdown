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
	 * switch-ins, the best-matched replacement after a faint, no status chip,
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
		const O = ours.map(({ p, i }) => {
			const mon = ai.myPokemon(gen, p, state);
			const hpFrac = (mon.originalCurHP || mon.maxHP()) / (mon.maxHP() || 1);
			const names = (p.active && ai.myMoveNames && ai.myMoveNames.length ? ai.myMoveNames : (p.moves || []).map(m => (dex.moves.get(m) || {}).name || m));
			return {
				i, entry: p, mon, hp: hpFrac * 100, hpFrac, active: !!p.active,
				spe: ai.speedOf(mon, p.active ? mon.boosts : {}, mon.status, state.weather),
				moves: names.map(attack).filter(Boolean),
				hz: p.active ? 0 : ai.entryHazards(gen, mon, p, state),
			};
		});
		const T = theirs.map(foe => {
			const mon = ai.foePokemon(gen, foe);
			const seen = [...(foe.moves || [])].filter(m => attack(m));
			let names = [...new Set([...seen, ...ai.hiddenAttacks(gen, foe), ...(seen.length >= 4 ? [] : (ai.knownAttacks(gen, foe.species) || []))])];
			if (!names.length) names = ai.probeAttacks(gen, mon);
			return {
				foe, mon, hp: Math.max(0, (foe.hp || 0) / (foe.maxhp || 100) * 100), hpFrac: Math.max(0.01, (foe.hp || 0) / (foe.maxhp || 100)),
				active: !foe.bench, spe: ai.foeSpeed(gen, foe, state.weather), names,
			};
		});
		// Damage as a share of the target's MAXIMUM health, once per pairing.
		for (const o of O) {
			o.dmg = T.map(t => o.moves.map(d => ai.damageToFoe(gen, o.mon, t.foe, d.name, field) * t.hpFrac *
				(ai.cfg.accuracy ? ai.hitChance(gen, d, o.mon, t.foe, state) : 1)));
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
		return { O, T, oa: oa < 0 ? 0 : oa, ta: ta < 0 ? 0 : ta, trickRoom: !!state.trickRoom };
	}

	/**
	 * Values of our root actions, deepest finished depth within the budget.
	 * Actions: { m } a move of the active, { sw } a switch, { pass } a status move.
	 */
	endgameSearch(model, { forcedFrom = null } = {}) {
		const ENDGAME_MS = 250, MAX_DEPTH = 4;
		const started = Date.now();
		const { O, T, trickRoom } = model;
		const p = this.w.pessimism;
		let nodes = 0;
		const ABORT = {};
		const alive = hp => hp.some(h => h > 0);
		const actions = (side, act, hp, root) => {
			const out = [];
			const me = side[act];
			if (hp[act] > 0) {
				me.moves.forEach((_, m) => out.push({ m }));
				if (root || !me.moves.length) out.push({ pass: true });
			}
			side.forEach((_, k) => { if (k !== act && hp[k] > 0) out.push({ sw: k }); });
			return out.length ? out : [{ pass: true }];
		};
		// Who comes in after a faint: the best trade against what is in front.
		const replace = (side, other, hp, otherAct, mine) => {
			let best = -1, bestScore = -Infinity;
			side.forEach((s, k) => {
				if (hp[k] <= 0) return;
				const out = Math.max(0, ...(s.dmg[otherAct] || []));
				const back = Math.max(0, ...((other[otherAct] && other[otherAct].dmg[k]) || []));
				const score = out - back + (mine ? 0 : 0);
				if (score > bestScore) { bestScore = score; best = k; }
			});
			return best;
		};
		const step = (oa, ta, ohp, thp, a, b) => {
			ohp = ohp.slice(); thp = thp.slice();
			if (a.sw !== undefined) { oa = a.sw; ohp[oa] = Math.max(0, ohp[oa] - O[oa].hz); }
			if (b.sw !== undefined) ta = b.sw;
			const ourMove = a.m !== undefined ? O[oa].moves[a.m] : null;
			const theirMove = b.m !== undefined ? T[ta].moves[b.m] : null;
			const ours = () => { if (ourMove && ohp[oa] > 0 && thp[ta] > 0) thp[ta] = Math.max(0, thp[ta] - O[oa].dmg[ta][a.m]); };
			const theirs = () => { if (theirMove && thp[ta] > 0 && ohp[oa] > 0) ohp[oa] = Math.max(0, ohp[oa] - T[ta].dmg[oa][b.m]); };
			let oursFirst;
			const op = ourMove ? ourMove.priority || 0 : 0, tp = theirMove ? theirMove.priority || 0 : 0;
			if (op !== tp) oursFirst = op > tp;
			else oursFirst = trickRoom ? O[oa].spe < T[ta].spe : O[oa].spe > T[ta].spe;   // a tie goes to them
			if (oursFirst) { ours(); theirs(); } else { theirs(); ours(); }
			if (ohp[oa] <= 0 && alive(ohp)) oa = replace(O, T, ohp, ta, true);
			if (thp[ta] <= 0 && alive(thp)) ta = replace(T, O, thp, oa, false);
			return [oa, ta, ohp, thp];
		};
		const leaf = (ohp, thp) => {
			let v = 0;
			for (const h of ohp) if (h > 0) v += h + 60;
			for (const h of thp) if (h > 0) v -= h + 60;
			return v;
		};
		const value = (oa, ta, ohp, thp, depth) => {
			if (++nodes % 512 === 0 && Date.now() - started > ENDGAME_MS) throw ABORT;
			if (!alive(thp)) return 1000 + ohp.reduce((s, h) => s + Math.max(0, h), 0) + depth;
			if (!alive(ohp)) return -1000 - thp.reduce((s, h) => s + Math.max(0, h), 0) - depth;
			if (depth === 0) return leaf(ohp, thp);
			let best = -Infinity;
			const theirs = actions(T, ta, thp, false);
			for (const a of actions(O, oa, ohp, false)) {
				let worst = Infinity, sum = 0;
				for (const b of theirs) {
					const [oa2, ta2, ohp2, thp2] = step(oa, ta, ohp, thp, a, b);
					const v = value(oa2, ta2, ohp2, thp2, depth - 1);
					if (v < worst) worst = v;
					sum += v;
				}
				const blended = p * worst + (1 - p) * sum / theirs.length;
				if (blended > best) best = blended;
			}
			return best;
		};

		const ohp0 = O.map(o => o.hp), thp0 = T.map(t => t.hp);
		let result = null, depthDone = 0;
		for (let depth = 1; depth <= MAX_DEPTH; depth++) {
			try {
				if (forcedFrom !== null) {
					// A forced replacement: the value of each of ours coming in, both sides then playing on.
					const vals = forcedFrom.map(k => ({ sw: k, value: value(k, model.ta, ohp0, thp0, depth) }));
					result = vals;
				} else {
					const theirs = actions(T, model.ta, thp0, false);
					result = actions(O, model.oa, ohp0, true).map(a => {
						let worst = Infinity, sum = 0;
						for (const b of theirs) {
							const [oa2, ta2, ohp2, thp2] = step(model.oa, model.ta, ohp0, thp0, a, b);
							const v = value(oa2, ta2, ohp2, thp2, depth - 1);
							if (v < worst) worst = v;
							sum += v;
						}
						return { ...a, value: p * worst + (1 - p) * sum / theirs.length };
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
	 * and keeps half its heuristic worth (the tree cannot see a heal or a boost);
	 * a damaging move keeps a little of its heuristic as a tie-break.
	 */
	endgame(gen, entry, request, state, field, ranked) {
		let model;
		try { model = this.endgameModel(gen, request, state, field); } catch (e) { return null; }
		if (!model) return null;
		const found = this.endgameSearch(model);
		if (!found || !found.actions.length) return null;
		const active = model.O[model.oa];
		const pass = found.actions.find(a => a.pass);
		let best = null;
		for (const r of ranked) {
			const m = active.moves.findIndex(d => d.name === r.name);
			const node = m >= 0 ? found.actions.find(a => a.m === m) : pass;
			if (!node) continue;
			const score = node.value + (m >= 0 ? 0.3 : 0.5) * (r.score || 0);
			if (!best || score > best.score) best = { kind: 'move', n: r.n, target: r.target, name: r.name, score };
		}
		for (const a of found.actions) {
			if (a.sw === undefined) continue;
			// A switch must clearly beat the best move: it spends the turn.
			if (!best || a.value > best.score + 10) best = { kind: 'switch', i: model.O[a.sw].i, score: a.value };
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
