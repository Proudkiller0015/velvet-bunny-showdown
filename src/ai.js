'use strict';
/**
 * Battle AI: aims for competent, not perfect.
 *
 * Every decision is grounded in a real damage calculation (@smogon/calc), so the
 * bot clicks the move that actually kills rather than the one with the biggest
 * base power. On top of that sit a handful of rules that separate "OK" play from
 * random play:
 *
 *   - take a guaranteed KO, and take it with priority when it is not faster
 *   - do not set up, heal, or click status in front of something that KOes it
 *   - switch out of a matchup where it is being 2HKOed and cannot 2HKO back
 *   - keep hazards, recovery and status as cheap value when nothing better exists
 *   - Terastallize only when it materially changes the turn
 *
 * Unknown opponent sets are assumed to be neutral-natured and uninvested, which
 * under-rates them slightly; the switch rule is deliberately trigger-happy to
 * compensate.
 */

const { Generations } = require('@pkmn/data');
const { Dex: PkmnDex } = require('@pkmn/dex');
const calc = require('@smogon/calc');
const { TurnSearch, DEFAULT_WEIGHTS } = require('./search');
const { loadBrain } = require('./brain');

const GENS = new Generations(PkmnDex);

const HAZARDS = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'];
const RECOVERY = ['Recover', 'Roost', 'Soft-Boiled', 'Slack Off', 'Synthesis', 'Moonlight',
	'Morning Sun', 'Rest', 'Shore Up', 'Milk Drink', 'Heal Order', 'Strength Sap'];
const PIVOT = ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport', 'Baton Pass'];

/**
 * One representative attack per type, for estimating what an opponent that has
 * revealed nothing might do. Kept in both flavours so the guess matches whether
 * the attacker is physically or specially inclined.
 */
const PHYSICAL_PROBES = {
	Normal: 'Body Slam', Fire: 'Flare Blitz', Water: 'Waterfall', Electric: 'Wild Charge',
	Grass: 'Power Whip', Ice: 'Icicle Crash', Fighting: 'Close Combat', Poison: 'Gunk Shot',
	Ground: 'Earthquake', Flying: 'Brave Bird', Psychic: 'Zen Headbutt', Bug: 'U-turn',
	Rock: 'Stone Edge', Ghost: 'Poltergeist', Dragon: 'Outrage', Dark: 'Knock Off',
	Steel: 'Iron Head', Fairy: 'Play Rough',
};
const SPECIAL_PROBES = {
	Normal: 'Hyper Voice', Fire: 'Flamethrower', Water: 'Surf', Electric: 'Thunderbolt',
	Grass: 'Energy Ball', Ice: 'Ice Beam', Fighting: 'Aura Sphere', Poison: 'Sludge Bomb',
	Ground: 'Earth Power', Flying: 'Air Slash', Psychic: 'Psychic', Bug: 'Bug Buzz',
	Rock: 'Power Gem', Ghost: 'Shadow Ball', Dragon: 'Draco Meteor', Dark: 'Dark Pulse',
	Steel: 'Flash Cannon', Fairy: 'Moonblast',
};

/** Move targets that must be given an explicit slot number in doubles. */
const NEEDS_TARGET = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);

/**
 * Difficulty knobs. The bot is meant to be a fun opponent across a range of
 * players, so the lower rungs are not "the same AI with worse luck" - they have
 * genuinely less machinery switched on.
 *
 *   blunder    chance of simply picking a random legal move instead of thinking
 *   greedy     only counts damage - no setup, hazards, status or tempo judgement
 *   noise      random points added to every score, for small misjudgements
 *   switching  may voluntarily switch out of a bad matchup
 *   tempo      values Pokemon by what they can still win, and sacrifices cheaply
 *   predict    assumes the opponent answers with its own best move
 *   switchMargin how much better the bench must look before spending a turn
 *
 * The rungs differ in what they can do, not just in how often they slip, so the
 * ladder holds up over a run of games instead of dissolving into variance.
 */
const DIFFICULTIES = {
	easy:     { blunder: 0.55, greedy: true,  noise: 40, switching: false, tempo: false, predict: false, tera: false, switchMargin: 999 },
	normal:   { blunder: 0.10, greedy: true,  noise: 20, switching: false, tempo: false, predict: false, tera: true,  switchMargin: 999 },
	hard:     { blunder: 0,    greedy: false, noise: 6,  switching: true,  tempo: true,  predict: false, tera: true,  switchMargin: 35 },
	champion: { blunder: 0,    greedy: false, noise: 0,  switching: true,  tempo: true,  predict: true,  tera: true,  switchMargin: 25 },
	// Experimental. Everything champion does, plus a one-turn search over our
	// options against their likely replies, weighted by numbers the trainer
	// tuned from self-play rather than by hand.
	stockfish: { blunder: 0,   greedy: false, noise: 0,  switching: true,  tempo: true,  predict: true,  tera: true,  switchMargin: 25, search: true },
};
const DEFAULT_DIFFICULTY = 'hard';

function toName(id, kind) {
	const entry = PkmnDex.forGen(9)[kind].get(id);
	return entry ? entry.name : id;
}

class BattleAI {
	constructor(options = {}) {
		this.log = options.log || (() => {});
		// Weights the trainer produced, if there are any; otherwise the defaults.
		this.brain = options.brain || loadBrain();
		this.search = new TurnSearch(this, this.brain.weights);
		this.setDifficulty(options.difficulty);
	}

	setDifficulty(name) {
		const key = String(name || DEFAULT_DIFFICULTY).toLowerCase();
		this.difficultyName = DIFFICULTIES[key] ? key : DEFAULT_DIFFICULTY;
		this.cfg = DIFFICULTIES[this.difficultyName];
		return this.difficultyName;
	}

	static difficulties() { return Object.keys(DIFFICULTIES); }

	jitter() { return this.cfg.noise ? (Math.random() - 0.5) * 2 * this.cfg.noise : 0; }

	gen(n) { return GENS.get(Math.max(1, Math.min(9, n || 9))); }

	/** Build a calc Pokemon for one of our own mon (we know everything). */
	myPokemon(gen, entry, state) {
		const ownSpecies = (entry.details || entry.ident || '').split(',')[0].replace(/^p[12][a-c]?: /, '').trim();
		const level = (/, L(\d+)/.exec(entry.details || '') || [])[1];
		const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
		const status = (/ (brn|psn|tox|par|slp|frz)/.exec(entry.condition || '') || [])[1];
		// Look the live state up by the Pokemon's own name - that is what the
		// protocol calls it even after it has transformed.
		const live = state && state.mine && Object.values(state.mine).find(m => m && m.species === ownSpecies);

		// A transformed Pokemon fights with the copied species' stats, types and
		// moves. Modelling it as its own species (Ditto: base 48 across the board)
		// makes it look useless, and the bot throws it away or refuses to send it
		// in. Its HP stays its own, which is why the condition is still applied.
		const transformed = live && live.transformed ? live.transformed : null;
		const species = transformed || ownSpecies;

		const opts = {
			level: level ? +level : 100,
			item: entry.item ? toName(entry.item, 'items') : undefined,
			ability: entry.ability || entry.baseAbility ? toName(entry.ability || entry.baseAbility, 'abilities') : undefined,
			status: status || undefined,
			boosts: live ? live.boosts : undefined,
			teraType: live && live.tera ? live.tera : undefined,
		};
		if (cond) { opts.curHP = +cond[1]; opts.originalCurHP = +cond[1]; }
		if (entry.stats && !transformed) {
			// Showdown hands us final stats; feed them back as the calc's own.
			// Skipped when transformed, because the reported stats are still the
			// original Pokemon's while the copied ones are what it actually uses.
			opts.overrides = { baseStats: undefined };
			opts.rawStats = entry.stats;
		}
		try {
			const mon = new calc.Pokemon(gen, species, opts);
			if (entry.stats && !transformed) {
				for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) if (entry.stats[k]) mon.stats[k] = entry.stats[k];
			}
			if (cond) {
				// maxHP() reads rawStats.hp, and Showdown's request stats carry no
				// hp field at all - so without this the current and maximum HP were
				// in different units and every "what fraction of my HP is that"
				// judgement (setup, switching, Tera, Dynamax) was working off a
				// number that could be out by a factor of two or more.
				const maxhp = +cond[2];
				if (maxhp > 0) {
					if (mon.rawStats) mon.rawStats.hp = maxhp;
					if (mon.stats) mon.stats.hp = maxhp;
				}
				mon.originalCurHP = +cond[1];
			}
			return mon;
		} catch (e) {
			return new calc.Pokemon(gen, species, { level: opts.level });
		}
	}

	/** Build a calc Pokemon for an opponent we can only partially see. */
	foePokemon(gen, foe) {
		const species = foe.transformed || foe.species;
		const opts = {
			level: foe.level || 100,
			boosts: foe.boosts,
			status: foe.status || undefined,
			item: foe.item ? toName(foe.item, 'items') : undefined,
			ability: foe.ability ? toName(foe.ability, 'abilities') : undefined,
			teraType: foe.tera || undefined,
			// Unknown spread: assume a balanced, plausible investment rather than 0s.
			evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
		};
		try {
			const mon = new calc.Pokemon(gen, species, opts);
			if (foe.maxhp === 100 && foe.hp < 100) mon.originalCurHP = Math.max(1, Math.round(mon.maxHP() * foe.hp / 100));
			return mon;
		} catch (e) {
			return new calc.Pokemon(gen, 'Pikachu', { level: opts.level });
		}
	}

	/** Percent of the target's remaining HP a move is expected to remove. */
	damagePct(gen, attacker, defender, moveName, field) {
		try {
			const move = new calc.Move(gen, moveName);
			if (!move.bp) return 0;
			const result = calc.calculate(gen, attacker, defender, move, field);
			const dmg = result.damage;
			const rolls = Array.isArray(dmg) ? dmg.flat().filter(n => typeof n === 'number') : [dmg];
			if (!rolls.length) return 0;
			const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
			const hp = defender.originalCurHP || defender.maxHP();
			return Math.max(0, (avg / hp) * 100);
		} catch (e) {
			return 0;
		}
	}

	// --------------------------------------------------------------------- tempo
	/**
	 * Is speed worth anything right now? Under Trick Room the whole axis flips,
	 * and a slow Pokemon on a team that still has Trick Room available is a win
	 * condition rather than dead weight.
	 */
	speedPolarity(request, state) {
		if (state.trickRoom) return -1;
		const hasTrickRoom = (request.side.pokemon || []).some(p =>
			!/fnt/.test(p.condition) && (p.moves || []).some(m => String(m).replace(/\W/g, '').toLowerCase() === 'trickroom'));
		return hasTrickRoom ? -0.35 : 1;   // available but not up: slow is a liability, not a write-off
	}

	/**
	 * What a Pokemon is still worth for the rest of the game, 0-100.
	 *
	 * This is what stops the bot trading its last fast attacker to save a wall it
	 * will never need again. A healthy, fast, hard-hitting mon that outspeeds what
	 * the opponent has left is a win condition and is protected accordingly; a
	 * slow one with nothing left to do is cheap, and spending it to keep the win
	 * condition alive is the correct play.
	 */
	monValue(gen, entry, state, request) {
		if (/fnt/.test(entry.condition || '')) return 0;   // dead is worth nothing

		const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
		const hpPct = cond ? (+cond[1] / +cond[2]) * 100 : 100;
		const me = this.myPokemon(gen, entry, state);
		const polarity = this.speedPolarity(request, state);

		// Speed measured against what the opponent actually has left on the field.
		const foes = state.foes();
		let speedEdge = 0;
		if (foes.length) {
			const mySpe = (me.stats && me.stats.spe) || 0;
			const theirSpe = foes.map(f => { const t = this.foePokemon(gen, f); return (t.stats && t.stats.spe) || 0; });
			const faster = theirSpe.filter(sp => mySpe > sp).length / theirSpe.length;
			speedEdge = (faster - 0.5) * 2;              // -1 (outsped by all) .. +1 (outspeeds all)
		}
		// Choice Scarf is the classic late-game cleaner item.
		const item = String(entry.item || '');
		if (item === 'choicescarf') speedEdge = Math.min(1, speedEdge + 0.6);

		let value = 30;
		value += speedEdge * polarity * 22;

		// Offensive presence: can it still threaten what is in front of it?
		if (foes.length) {
			const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
			let best = 0;
			for (const foe of foes) {
				const them = this.foePokemon(gen, foe);
				for (const m of entry.moves || []) best = Math.max(best, this.damagePct(gen, me, them, toName(m, 'moves'), field));
			}
			value += Math.min(45, best * 0.45);
		}

		// Status eats most of what makes a sweeper a sweeper.
		const status = (/ (brn|psn|tox|par|slp|frz)/.exec(entry.condition || '') || [])[1];
		if (status === 'par') value *= 0.55;             // a paralysed cleaner cannot clean
		else if (status === 'slp' || status === 'frz') value *= 0.45;
		else if (status === 'tox') value *= 0.7;
		else if (status === 'brn') value *= 0.75;

		// HP matters, but a Focus Sash / 1 HP cleaner still cleans - so this is a
		// gentle curve rather than a straight multiplier.
		value *= 0.55 + 0.45 * (hpPct / 100);
		return Math.max(0, Math.min(100, value));
	}

	/** Rank of this mon's value within the surviving team, 0 (worst) .. 1 (best). */
	valueRank(gen, entry, state, request) {
		const alive = (request.side.pokemon || []).filter(p => !/fnt/.test(p.condition));
		if (alive.length < 2) return 1;
		const mine = this.monValue(gen, entry, state, request);
		const below = alive.filter(p => this.monValue(gen, p, state, request) < mine).length;
		return below / (alive.length - 1);
	}

	// ------------------------------------------------------------------ scoring
	/**
	 * How likely is the opponent to leave this turn?
	 *
	 * The classic case: our Water-type is in front of their Fire-type. They are
	 * not going to stay and be washed away, so the free turn is real and setting
	 * up is correct even though a resisted hit looks scary on paper. Returns
	 * roughly 0 (they are thrilled to be here) .. 1 (they must leave or lose it).
	 */
	switchPressure(gen, me, foes, field) {
		if (!foes.length) return 0;
		let pressure = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			let ourBest = 0;
			for (const m of this.myMoveNames) ourBest = Math.max(ourBest, this.damagePct(gen, me, them, m, field));
			const seen = [...foe.moves];
			const theirBest = seen.length
				? Math.max(...seen.map(m => this.damagePct(gen, them, me, m, field)))
				: this.roughIncoming(gen, them, me, field);

			let p = 0;
			if (ourBest >= 100) p = 0.95;                       // stay and die
			else if (ourBest >= 55) p = 0.6;                    // 2HKO, uncomfortable
			else if (ourBest >= 35) p = 0.3;
			// If they cannot meaningfully hurt us back, staying is pointless for them.
			if (theirBest < 20) p = Math.max(p, 0.55);
			else if (theirBest > 70) p *= 0.45;                 // they are happy to trade
			if (foe.hp / (foe.maxhp || 100) < 0.35) p = Math.max(p, 0.5);
			pressure = Math.max(pressure, p);
		}
		return Math.min(1, pressure);
	}

	/** After this boost, does the board actually fall over? */
	sweepPotential(gen, entry, state, foes, field, boosts) {
		if (!foes.length) return 0;
		const boosted = this.myPokemon(gen, entry, state);
		const current = boosted.boosts || {};
		boosted.boosts = { ...current };
		for (const [stat, delta] of Object.entries(boosts || {})) {
			if (delta > 0) boosted.boosts[stat] = Math.max(-6, Math.min(6, (current[stat] || 0) + delta));
		}
		let best = 0, fasterThanAll = true;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			for (const m of this.myMoveNames) best = Math.max(best, this.damagePct(gen, boosted, them, m, field));
			const theirSpe = (them.stats && them.stats.spe) || 0;
			const mySpe = (boosted.stats && boosted.stats.spe) || 0;
			if (state.trickRoom ? mySpe > theirSpe : mySpe < theirSpe) fasterThanAll = false;
		}
		if (best >= 100) return fasterThanAll ? 1 : 0.6;
		if (best >= 70) return fasterThanAll ? 0.55 : 0.3;
		return best / 200;
	}

	/** Score a status move by what it is actually worth this turn. */
	statusScore(gen, moveName, me, foe, state, incoming, ctx = {}) {
		const move = PkmnDex.forGen(gen.num).moves.get(moveName);
		if (!move) return 0;
		const myHpPct = (me.originalCurHP / me.maxHP()) * 100;
		const dying = incoming >= myHpPct;
		const boostsUp = move.boosts || (move.self && move.self.boosts);
		const isSetup = boostsUp && Object.values(boostsUp).some(v => v > 0);
		const pressure = ctx.foes ? this.switchPressure(gen, me, ctx.foes, ctx.field) : 0;

		// Nothing that takes a turn is worth it when the turn is the last one -
		// unless the opponent is not going to be there to take it.
		if (dying && !(isSetup && pressure >= 0.7)) return move.priority > 0 ? 5 : -20;

		if (RECOVERY.includes(move.name)) return myHpPct < 55 ? 60 - myHpPct : -10;
		if (HAZARDS.includes(move.name)) {
			const theirSide = state.hazards[state.theirPlayer] || {};
			return theirSide[move.name] ? -30 : 38;
		}
		if (PIVOT.includes(move.name)) return 20;

		if (isSetup) {
			// Setup is a win condition, not a tic. It is worth a turn when the
			// opponent is likely to be leaving, and it is a throw when they are
			// about to knock us out and have no reason to go anywhere.
			const sweep = ctx.foes ? this.sweepPotential(gen, ctx.entry, state, ctx.foes, ctx.field, boostsUp) : 0;
			const danger = incoming / Math.max(1, myHpPct);      // 1 = exactly lethal
			// A free turn bought by threatening them is the whole point.
			const safety = Math.max(1 - danger, pressure);
			if (safety < 0.25) return -40;
			let score = 18 + safety * 34 + sweep * 45;
			if (myHpPct < 45 && pressure < 0.6) score -= 25;
			return score;
		}
		if (move.status) {
			if (foe.status) return -25;
			if (move.status === 'slp') return 45;
			if (move.status === 'par' || move.status === 'brn' || move.status === 'tox') return 32;
		}
		if (/taunt|encore|disable|haze|defog|rapidspin|trick|knockoff/i.test(move.id)) return 22;
		if (move.id === 'protect' || move.id === 'detect') return 8;
		return 6;
	}

	/**
	 * @param {object} request the parsed |request| payload
	 * @param {BattleState} state
	 * @returns {string} the choice string, e.g. "move 1" or "switch 3"
	 */
	decide(request, state) {
		if (request.wait) return null;
		if (request.teamPreview) return this.teamOrder(request, state);
		if (request.forceSwitch) return this.forceSwitch(request, state);
		if (request.active) return this.turnChoice(request, state);
		return 'default';
	}

	teamOrder(request, state) {
		// No opponent information at preview, so lead with the fastest healthy mon.
		const gen = this.gen(state.gen);
		const mons = request.side.pokemon.map((p, i) => {
			const mon = this.myPokemon(gen, p, state);
			return { i: i + 1, spe: mon.stats ? mon.stats.spe : 0 };
		});
		mons.sort((a, b) => b.spe - a.spe);
		return `team ${mons.map(m => m.i).join('')}`;
	}

	/**
	 * Rate how well a benched mon would do against what is out right now.
	 *
	 * Switching is not free: the incoming mon eats a hit on the way in. With tempo
	 * enabled that cost is charged against how much the mon is still worth, so the
	 * bot will happily walk a spent wall into a hit but will not throw its last
	 * fast cleaner in front of one.
	 */
	benchScore(gen, entry, state, field, request) {
		const foes = state.foes();
		if (!foes.length) return 0;
		const me = this.switchInAs(gen, entry, state, foes);
		let best = 0, worst = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			const mine = (entry.moves || []).map(m => this.damagePct(gen, me, them, toName(m, 'moves'), field));
			best = Math.max(best, ...(mine.length ? mine : [0]));
			const seen = [...foe.moves];
			const back = seen.length
				? seen.map(m => this.damagePct(gen, them, me, m, field))
				: [this.roughIncoming(gen, them, me, field)];
			worst = Math.max(worst, ...back);
		}

		let score = best - worst;
		if (this.cfg.tempo && request) {
			const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
			const hpPct = cond ? (+cond[1] / +cond[2]) * 100 : 100;
			const value = this.monValue(gen, entry, state, request);
			// Bringing it in costs a hit; losing it outright costs its whole value.
			const dies = worst >= hpPct;
			score -= (worst / 100) * value * 0.5;
			if (dies) score -= value * 0.8;
		}
		return score;
	}

	/**
	 * What this Pokemon would actually be once it is on the field.
	 *
	 * Imposter copies the Pokemon it comes in on, so a benched Ditto is not the
	 * 48-base-stat blob the dex says it is - it is a mirror of whatever is out
	 * there. Judging it on its own stats is why it loses switch-ins it should win.
	 */
	switchInAs(gen, entry, state, foes) {
		const ability = String(entry.ability || entry.baseAbility || '').toLowerCase();
		if (ability === 'imposter' && foes.length) {
			const copy = this.foePokemon(gen, foes[0]);
			// It arrives with its own HP, and Imposter does not copy HP.
			const cond = /^(\d+)\/(\d+)/.exec(entry.condition || '');
			if (cond) {
				const pct = +cond[1] / +cond[2];
				copy.originalCurHP = Math.max(1, Math.round(copy.maxHP() * pct));
			}
			return copy;
		}
		return this.myPokemon(gen, entry, state);
	}

	/** Worst-case estimate when the opponent has revealed nothing. */
	roughIncoming(gen, them, me, field) {
		const species = PkmnDex.forGen(gen.num).species.get(them.name);
		if (!species) return 35;
		// Probe with the side of the attacker that actually hits hard. Guessing a
		// special move against a physical attacker badly under-rates the threat -
		// it is what let a Gallade stand in front of an unrevealed Dachsbun.
		const physical = ((them.stats && them.stats.atk) || 0) >= ((them.stats && them.stats.spa) || 0);
		const PROBES = physical ? PHYSICAL_PROBES : SPECIAL_PROBES;
		let worst = 0;
		for (const type of species.types) {
			const probe = PROBES[type];
			if (probe) worst = Math.max(worst, this.damagePct(gen, them, me, probe, field));
		}
		return worst;
	}

	forceSwitch(request, state) {
		const gen = this.gen(state.gen);
		const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
		const options = request.side.pokemon
			.map((p, i) => ({ p, i: i + 1 }))
			.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
		if (!options.length) return 'default';
		let best = options[0], bestScore = -Infinity;
		for (const opt of options) {
			const score = this.benchScore(gen, opt.p, state, field, request) + this.jitter();
			if (score > bestScore) { bestScore = score; best = opt; }
		}
		return `switch ${best.i}`;
	}

	turnChoice(request, state) {
		const gen = this.gen(state.gen);
		const field = new calc.Field({ weather: state.weather || undefined, terrain: state.terrain || undefined });
		const choices = [];

		request.active.forEach((active, index) => {
			const entry = request.side.pokemon[index];
			if (!entry || /fnt/.test(entry.condition)) { choices.push('pass'); return; }
			choices.push(this.chooseForSlot(gen, active, entry, index, request, state, field));
		});
		return choices.join(', ');
	}

	/**
	 * Would Terastallizing right now actually change anything?
	 *
	 * Tera cuts both ways and the defensive half is the half people win with:
	 * changing type to resist the hit coming at you can turn a knockout into a
	 * free turn. Both directions are measured against the same Tera type, because
	 * the type is fixed by the set (Random Battle sets pick it in advance), so
	 * the only real question is whether *this* is the turn to spend it.
	 */
	teraWorthIt(gen, active, entry, state, foes, field, best, incoming) {
		const teraType = typeof active.canTerastallize === 'string' ? active.canTerastallize : null;
		if (!teraType || !foes.length) return false;

		const me = this.myPokemon(gen, entry, state);
		const teraMe = this.myPokemon(gen, entry, state);
		teraMe.teraType = teraType;
		const hpPct = (me.originalCurHP / me.maxHP()) * 100;

		let plainOut = 0, teraOut = 0;     // what we deal
		let plainIn = 0, teraIn = 0;       // what we take
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			if (best && best.name) {
				plainOut = Math.max(plainOut, this.damagePct(gen, me, them, best.name, field));
				teraOut = Math.max(teraOut, this.damagePct(gen, teraMe, them, best.name, field));
			}
			const seen = [...foe.moves];
			if (seen.length) {
				for (const m of seen) {
					plainIn = Math.max(plainIn, this.damagePct(gen, them, me, m, field));
					teraIn = Math.max(teraIn, this.damagePct(gen, them, teraMe, m, field));
				}
			} else {
				plainIn = Math.max(plainIn, this.roughIncoming(gen, them, me, field));
				teraIn = Math.max(teraIn, this.roughIncoming(gen, them, teraMe, field));
			}
		}

		// Offensive: it turns something that was not a kill into one.
		if (teraOut >= 100 && plainOut < 100) return true;
		// Defensive: it turns a hit we do not survive into one we do. This is the
		// case that saves a Pokemon outright, so it beats hoarding the Tera.
		if (plainIn >= hpPct && teraIn < hpPct) return true;
		// Beyond that, do not spend it on a turn we are knocked out anyway.
		if (plainIn >= hpPct) return false;
		// A worthwhile margin in either direction.
		return teraOut > plainOut * 1.25 || teraIn < plainIn * 0.6;
	}

	/**
	 * Dynamax (gen 8) doubles HP as well as boosting moves, so like Tera it has a
	 * defensive use: a hit that would knock us out may not once the HP bar is
	 * twice the size.
	 */
	dynamaxWorthIt(hpPct, incoming, best) {
		if (incoming >= hpPct && incoming < hpPct * 2) return true;   // survives it
		if (incoming >= hpPct) return false;                          // dies regardless
		return best ? best.score >= 40 : false;
	}

	chooseForSlot(gen, active, entry, index, request, state, field) {
		const me = this.myPokemon(gen, entry, state);
		const foes = state.foes();
		// switchPressure/sweepPotential need to know what we can actually click.
		this.myMoveNames = (active.moves || []).map(m => m.move || toName(m.id, 'moves'));
		const legal = (active.moves || []).map((m, i) => ({ ...m, n: i + 1 }))
			.filter(m => !m.disabled && (m.pp === undefined || m.pp > 0));
		if (!legal.length) return 'move 1';

		// A weaker opponent should feel like a weaker player, not an unlucky one:
		// it simply does not work the position out some of the time.
		if (this.cfg.blunder && Math.random() < this.cfg.blunder) {
			const roll = legal[Math.floor(Math.random() * legal.length)];
			const needs = request.active.length > 1 && NEEDS_TARGET.has(roll.target);
			return needs ? `move ${roll.n} 1` : `move ${roll.n}`;
		}

		// How hard we are about to be hit, used by every other judgement below.
		let incoming = 0;
		for (const foe of foes) {
			const them = this.foePokemon(gen, foe);
			const seen = [...foe.moves];
			const back = seen.length ? seen.map(m => this.damagePct(gen, them, me, m, field))
				: [this.roughIncoming(gen, them, me, field)];
			incoming = Math.max(incoming, ...back);
		}

		// Turn order is information, and acting on it is the difference between
		// "that move kills" and "that move kills in time". If we move first and
		// the KO is there, whatever they were going to do never happens.
		let movesFirst = false;
		if (this.cfg.predict && foes.length) {
			const mySpe = (me.stats && me.stats.spe) || 0;
			movesFirst = foes.every(foe => {
				const theirSpe = (this.foePokemon(gen, foe).stats || {}).spe || 0;
				return state.trickRoom ? mySpe < theirSpe : mySpe > theirSpe;
			});
		}

		let best = null;
		const ranked = [];
		for (const move of legal) {
			const name = move.move || toName(move.id, 'moves');
			const data = PkmnDex.forGen(gen.num).moves.get(name);
			let score, target = null;

			if (data && data.category === 'Status') {
				const foe = foes[0];
				// A greedy player sees status moves as "the ones that do no damage".
				if (this.cfg.greedy) score = 2;
				else score = foe
					? this.statusScore(gen, name, me, this.foePokemon(gen, foe), state, incoming, { foes, field, entry })
					: 5;
				if (foes.length > 1 && foe) target = foe.slot === 'b' ? 2 : 1;
			} else {
				score = -Infinity;
				for (const foe of foes) {
					const them = this.foePokemon(gen, foe);
					const pct = this.damagePct(gen, me, them, name, field);
					let s = pct;
					if (pct >= 100) s += 60;                                  // a kill is worth more than damage
					if (pct >= 100 && data && data.priority > 0) s += 25;      // and a priority kill even more
					// A KO we land first costs us nothing, so it beats retreating.
					if (pct >= 100 && (movesFirst || (data && data.priority > 0))) s += 40;
					if (data && data.recoil && pct < 100) s -= 6;
					if (s > score) { score = s; target = foe.slot === 'b' ? 2 : 1; }
				}
			}
			score += this.jitter();
			if (!best || score > best.score) best = { score, n: move.n, target, name };
			// Keep every option around; the search re-ranks them by what the
			// opponent can do about it, which the heuristic score cannot see.
			ranked.push({
				kind: 'move', n: move.n, target, name, score,
				damage: data && data.category !== 'Status'
					? Math.max(0, ...foes.map(f => this.damagePct(gen, me, this.foePokemon(gen, f), name, field)))
					: 0,
				priority: data ? (data.priority || 0) : 0,
				heuristic: data && data.category === 'Status' ? score : 0,
			});
		}

		// Search: play each of our options out against each of their likely
		// replies and score where the turn ends, rather than scoring the move
		// against a position the opponent is assumed not to touch.
		if (this.cfg.search && ranked.length) {
			const shortlist = ranked.slice().sort((a, b) => b.score - a.score).slice(0, 5);
			const searched = this.search.choose(gen, active, entry, request, state, field, shortlist, incoming);
			if (searched) best = { score: searched.score, n: searched.n, target: searched.target, name: searched.name };
		}

		// Would anything on the bench do better than what we are about to do here?
		if (this.cfg.switching && request.side.pokemon.length > 1 && !active.trapped && !active.maybeTrapped) {
			const myHpPct = (me.originalCurHP / me.maxHP()) * 100;
			const doomed = incoming >= myHpPct;
			const losing = incoming >= myHpPct * 0.5 && best.score < 55;
			if (losing) {
				const bench = request.side.pokemon
					.map((p, i) => ({ p, i: i + 1 }))
					.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
				let alt = null;
				for (const opt of bench) {
					const score = this.benchScore(gen, opt.p, state, field, request) + this.jitter();
					if (!alt || score > alt.score) alt = { score, i: opt.i };
				}
				// Tempo: when this one is dying anyway, letting it fall is often
				// better than spending a switch-in to save it - but only if it is
				// the cheap end of the team. The mon that still wins the game is
				// worth a turn.
				let margin = this.cfg.switchMargin !== undefined ? this.cfg.switchMargin : 25;
				if (this.cfg.tempo) {
					const rank = this.valueRank(gen, entry, state, request);
					if (doomed && rank < 0.5) margin = 70;   // let the spare one go
					else if (doomed && rank >= 0.75) margin = 8;  // save the win condition
				}
				if (alt && alt.score > best.score + margin) return `switch ${alt.i}`;
			}
		}

		let choice = `move ${best.n}`;
		// In doubles a single-target move is rejected outright without a target
		// number, so take the requirement from the request rather than guessing
		// from how many foes happen to be standing.
		const chosen = legal.find(m => m.n === best.n);
		if (request.active.length > 1 && chosen && NEEDS_TARGET.has(chosen.target)) {
			const slot = best.target || (foes[0] && foes[0].slot === 'b' ? 2 : 1) || 1;
			choice += ` ${slot}`;
		}

		// Terastallizing is once per battle, so spend it only when this turn is
		// measurably better for it. Committing it on a turn we are knocked out
		// anyway - which is how a Gallade burned its Tera and fainted without
		// moving - is the single worst way to use it.
		if (this.cfg.tera && active.canTerastallize && this.teraWorthIt(gen, active, entry, state, foes, field, best, incoming)) {
			choice += ' terastallize';
		}
		else if (active.canMegaEvo) choice += ' mega';
		else if (active.canUltraBurst) choice += ' ultra';
		else if (active.canDynamax && this.dynamaxWorthIt((me.originalCurHP / me.maxHP()) * 100, incoming, best)) {
			choice += ' dynamax';
		}
		return choice;
	}
}

module.exports = { BattleAI };
