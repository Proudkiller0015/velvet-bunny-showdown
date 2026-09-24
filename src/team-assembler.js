'use strict';
/**
 * Six Pokemon that make a team, from whatever pool there is to choose from.
 *
 * Every automated team on this server goes through here: a character's box for
 * the RP bot's !preset, a trainer's line-up in RP encounters, and the ladder and
 * lobby bots. Each gives its own pool and rules; the thinking is shared.
 *
 *   1. Every candidate gets a set per role it can play (src/role-sets.js):
 *      Garchomp as a Stealth Rock lead or a Swords Dance sweeper.
 *   2. A local search picks which candidates, in which roles, score best on the
 *      teambuilding checklist (src/team-logic.js) plus raw strength - so a much
 *      weaker Pokemon is not taken just to patch a weakness, and six strong
 *      Pokemon that all lose to one Fire move are not taken either.
 *   3. Then the checklist's fixed slots: exactly one Stealth Rock, hazard
 *      removal when the team takes heavy rock damage, taught to whoever learns
 *      it and loses the least by it.
 *   4. Items by role, from a bag when there is one, defensive members first.
 *
 * How strict the checklist is comes from the caller: `stage` 'movesets' (only
 * good sets), 'basics' (no pile of shared weaknesses, both attacking sides) or
 * 'full'. RP trainers scale it by badges.
 */

const RS = require('./role-sets');
const TL = require('./team-logic');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** How much a move is worth keeping on a set, for choosing which one to replace. */
function keepValue(dex, set, index) {
	const species = dex.species.get(set.species);
	const move = dex.moves.get(set.moves[index]);
	const role = set.role || '';
	if (move.category !== 'Status') {
		const sameType = set.moves.filter(n => dex.moves.get(n).category !== 'Status' && dex.moves.get(n).type === move.type).length;
		const attacks = set.moves.filter(n => dex.moves.get(n).category !== 'Status').length;
		if (attacks <= 1) return 1000;
		return RS.attackValue(species, move) * (sameType > 1 ? 0.5 : 1) + (move.num < 0 ? 60 : 0);
	}
	if (RS.RECOVERY.includes(move.id) && (RS.BULKY_ROLES.includes(role) || RS.SUPPORT_ROLES.includes(role))) return 500;
	if (RS.SETUP.includes(move.id) && RS.SETUP_ROLES.includes(role)) return 500;
	if (move.num < 0) return 400;
	return 90;
}

/** Give a set one of `moveIds` if it can learn one, replacing what it misses least. */
function teach(dex, set, moveIds, legal) {
	if (set.moves.some(m => moveIds.includes(toID(m)))) return true;
	const pool = legal ? new Set([...legal].map(toID)) : RS.learnable(dex, dex.species.get(set.species));
	const id = moveIds.find(m => pool.has(m));
	if (!id) return false;
	const name = dex.moves.get(id).name;
	if (set.moves.length < 4) { set.moves.push(name); return true; }
	let worst = 0;
	for (let i = 1; i < set.moves.length; i++) if (keepValue(dex, set, i) < keepValue(dex, set, worst)) worst = i;
	if (keepValue(dex, set, worst) >= 500) return false;
	set.moves[worst] = name;
	return true;
}

/** Take `moveIds` off a set, putting back the best move of its role pool it lacks. */
function untrain(dex, set, moveIds, legal) {
	const index = set.moves.findIndex(m => moveIds.includes(toID(m)));
	if (index < 0) return;
	const species = dex.species.get(set.species);
	const roles = RS.roleSets(dex, set.species, legal);
	const pool = ((roles.find(r => r.role === set.role) || roles[0] || {}).movepool || [])
		.map(n => dex.moves.get(n))
		// Never a hazard in its place: taking Spikes off Ferrothorn used to hand it a second Stealth Rock.
		.filter(m => !moveIds.includes(m.id) && !RS.HAZARDS.includes(m.id) && !set.moves.some(x => toID(x) === m.id))
		.sort((a, b) => RS.attackValue(species, b) - RS.attackValue(species, a));
	if (pool.length) { set.moves[index] = pool[0].name; return; }
	// Nothing in the role's pool: anything else it may use, but a trainer with a short
	// list keeps the duplicate hazard rather than going into battle with three moves.
	const rest = [...(legal ? new Set([...legal].map(toID)) : RS.learnable(dex, species))].map(id => dex.moves.get(id))
		.filter(m => m.exists && !m.isNonstandard && !m.id.startsWith('hiddenpower') && !moveIds.includes(m.id) && !RS.HAZARDS.includes(m.id) && !set.moves.some(x => toID(x) === m.id))
		.sort((a, b) => (b.category !== 'Status') - (a.category !== 'Status') || RS.attackValue(species, b) - RS.attackValue(species, a));
	if (rest.length) set.moves[index] = rest[0].name;
}

/**
 * candidates: [{ species, level?, strength? (any scale, higher is better), legal? (Set of move ids), ref? }]
 * options:
 *   size       how many to pick (6)
 *   stage      'movesets' | 'basics' | 'full' (the checklist's strictness)
 *   themed     a type specialist: shared weaknesses are the point, not a flaw
 *   rng        for variety between builds
 *   items      false (none), true (any, by role), or { bag: { itemid: count } }
 *   strengthWeight   how much raw strength counts against the checklist (25)
 *   roles      at most this many roles tried per candidate (3)
 *   fixed      candidates that must be on the team (a trainer's ace)
 *   threats    the format's common Pokemon ([{ name or types, weight?, ability? }]), when
 *              known: sets pick coverage against them and the checklist's rule 5
 *              (every threat hit neutrally by two members) is scored
 *
 * Returns [{ ...set, ref, level }]: species, role, ability, item, moves, nature, evs, teraType.
 */
function assemble(dex, candidates, options = {}) {
	const {
		size = 6, stage = 'full', themed = false, rng = Math.random, items = true,
		strengthWeight = 25, roles = 3, fixed = [], maxEvaluations = 4000, threats = null,
	} = options;
	const usable = candidates.filter(c => dex.species.get(c.species).exists);
	if (!usable.length) return [];
	const strongest = Math.max(...usable.map(c => c.strength || 1)) || 1;

	// Every (candidate, role) option, built once.
	const options_ = new Map();
	for (const c of usable) {
		const found = RS.roleSets(dex, c.species, c.legal || null).slice(0, roles);
		const built = [];
		for (const r of found) {
			const set = RS.buildSet(dex, c.species, { role: r.role, rng, level: c.level || 100, items: false, legal: c.legal || null, threats });
			if (set && !built.some(b => b.moves.slice().sort().join() === set.moves.slice().sort().join())) built.push(set);
		}
		if (built.length) options_.set(c, built);
	}
	const pool = usable.filter(c => options_.has(c));
	if (!pool.length) return [];

	const value = picks => {
		const sets = picks.map(([c, i]) => options_.get(c)[i]);
		const logic = stage === 'movesets' ? 0 : TL.score(dex, sets, { stage, themed, threats }).score;
		const power = picks.reduce((n, [c]) => n + (c.strength || 1) / strongest, 0) / Math.max(1, picks.length);
		// Two of the same role is fine; four setup sweepers and no support is not a team.
		const roleCounts = {};
		for (const s of sets) roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
		const crowding = Object.values(roleCounts).reduce((n, k) => n + Math.max(0, k - 2) * 2, 0);
		/*
		 * A set with one or two moves is not a member, whatever box it ticks: an Unown
		 * with Hypno Whirl and a Choice Scarf was taken as "speed control" once the
		 * checklist counted it. Each missing move below three costs as much as a
		 * soft rule, where the Pokemon has anything better to be swapped for.
		 */
		const thin = sets.reduce((n, s) => n + Math.max(0, 3 - s.moves.length) * 4, 0);
		return logic + strengthWeight * power - crowding - thin + core(picks, sets) + rng() * 0.01;
	};

	// Start from the strongest, fixed members first, each in a random role of theirs.
	const byStrength = pool.slice().sort((a, b) => (b.strength || 1) - (a.strength || 1));
	/*
	 * Breaking core first (24 Sep 2026). "Start from a progress-making core, not
	 * a defensive one. If the seed is a wall, the very next pick is a breaker
	 * that exploits the Pokemon that wall draws in" - walls stacked on walls
	 * turn into "an accidental bad stall team" (Pinkacross, How to Build Around
	 * Defensive Pokemon; B1 in docs/research-pinkacross.md). The seed is the
	 * first fixed member (a trainer's ace), else the strongest candidate. When
	 * it plays a wall, what it draws in is what its attacks cannot hurt - the
	 * format's threats when known, else the eighteen types - and a breaker
	 * (TL.isBreaker) that hits those hard earns up to CORE_WEIGHT, two soft
	 * rules' worth: enough to steer the search, not to outvote a hard rule.
	 */
	const seed = fixed.find(c => pool.includes(c)) || byStrength[0];
	const coreCache = new Map();
	const core = (picks, sets) => {
		if (stage === 'movesets') return 0;
		const at = picks.findIndex(([c]) => c === seed);
		if (at < 0 || !TL.isDefensive(dex, sets[at])) return 0;
		const wall = sets[at];
		if (!coreCache.has(wall)) coreCache.set(wall, { drawn: drawnIn(dex, wall, threats), by: new Map() });
		const memo = coreCache.get(wall);
		let bestCover = 0;
		sets.forEach((set, i) => {
			if (i === at) return;
			if (!memo.by.has(set)) memo.by.set(set, TL.isBreaker(dex, set) ? cover(dex, set, memo.drawn) : 0);
			bestCover = Math.max(bestCover, memo.by.get(set));
		});
		return CORE_WEIGHT * bestCover;
	};
	const start = [...fixed.filter(c => pool.includes(c)), ...byStrength.filter(c => !fixed.includes(c))].slice(0, size);
	let picks = start.map(c => [c, Math.floor(rng() * options_.get(c).length)]);
	let best = value(picks);
	let evaluations = 1;

	for (let pass = 0, improved = true; improved && pass < 8 && evaluations < maxEvaluations; pass++) {
		improved = false;
		for (let slot = 0; slot < picks.length && evaluations < maxEvaluations; slot++) {
			const [current] = picks[slot];
			const locked = fixed.includes(current);
			for (const c of locked ? [current] : pool) {
				if (c !== current && picks.some(([p]) => p === c)) continue;
				const count = options_.get(c).length;
				for (let i = 0; i < count; i++) {
					if (c === current && i === picks[slot][1]) continue;
					const trial = picks.slice();
					trial[slot] = [c, i];
					const v = value(trial);
					evaluations++;
					if (v > best + 0.5) { best = v; picks = trial; improved = true; }
				}
			}
		}
	}

	const team = picks.map(([c, i]) => ({ ...options_.get(c)[i], moves: options_.get(c)[i].moves.slice(), ref: c.ref, level: c.level || 100, legal: c.legal || null }));

	// One Stealth Rock is all a team uses, at any strictness.
	if (stage !== 'movesets') {
		const report = TL.analyze(dex, team);
		for (const set of team.filter(s => report.stealthRock.includes(s.species)).slice(1)) untrain(dex, set, TL.MOVES.stealthRock, set.legal);
		oneSetterEach(dex, team);
	}
	if (stage === 'full' && team.length >= 3) {
		let report = TL.analyze(dex, team);
		if (!report.stealthRock.length) {
			// The bulkiest, supportive members set rocks best.
			const setters = team.slice().sort((a, b) => supportRank(b) - supportRank(a));
			for (const set of setters) if (teach(dex, set, TL.MOVES.stealthRock, set.legal)) break;
		} else {
			for (const set of team.filter(s => report.stealthRock.includes(s.species)).slice(1)) untrain(dex, set, TL.MOVES.stealthRock, set.legal);
		}
		report = TL.analyze(dex, team);
		if (report.rockWeak.length >= 2 && !report.removal.length && report.style !== 'hyper offense') {
			const helpers = team.filter(s => !report.stealthRock.includes(s.species)).sort((a, b) => supportRank(b) - supportRank(a));
			for (const set of helpers) if (teach(dex, set, TL.MOVES.removal, set.legal)) break;
		}
		// Again: a second Stealth Rock taken off above may have been replaced by Spikes.
		oneSetterEach(dex, team);
		answerSetup(dex, team);
		addSpeedControl(dex, team);
		addKnockOff(dex, team);
	}

	if (items) assignItems(dex, team, items === true ? null : items.bag || {}, { stage, themed, threats });
	return team.map(({ legal, ...set }) => set);
}

/*
 * Rule 11 after the search: two distinct ways to stop a setup sweeper, one of
 * them good against a special one. The search scores it, but the six it picks
 * can still be short - a team of attackers whose only answer is one burn. Then
 * a supportive member learns the missing mechanism, the kind a wall runs
 * anyway: Haze, Whirlwind or Roar, Encore, Thunder Wave, Will-O-Wisp last
 * (it does nothing to Calm Mind). A move a set would miss more than the answer
 * (its recovery, its setup, its only attack) is never replaced - see teach().
 */
const SETUP_ANSWER_MOVES = [
	['haze', 'clearsmog'], ['whirlwind', 'roar', 'dragontail', 'circlethrow'], ['encore'], ['thunderwave', 'glare', 'nuzzle'], ['willowisp'],
];
function answerSetup(dex, team) {
	for (let tries = 0; tries < 2; tries++) {
		const report = TL.analyze(dex, team);
		if (report.setupMechanisms.length >= 2 && report.specialSetupAnswer) return;
		// Not an Assault Vest pivot: the vest it is about to be given cannot click Roar.
		const helpers = team.filter(s => supportRank(s) >= 2 && s.role !== 'AV Pivot').sort((a, b) => supportRank(b) - supportRank(a));
		let taught = false;
		for (const moves of SETUP_ANSWER_MOVES) {
			// A second burner adds nothing when the special side is what is missing.
			if (moves.includes('willowisp') && report.setupMechanisms.length) continue;
			for (const set of helpers) {
				if (set.moves.some(m => SETUP_ANSWER_MOVES.flat().includes(toID(m)))) continue;
				if (teach(dex, set, moves, set.legal)) { taught = true; break; }
			}
			if (taught) break;
		}
		if (!taught) return;
	}
}

/*
 * Rule 7 after the search: an offensive team short of speed control gets a
 * priority attack on an attacker that learns a strong one - Extreme Speed,
 * Sucker Punch, Bullet Punch, Aqua Jet on a Water type (see
 * RS.priorityValue) - in place of its least useful coverage move.
 */
function addSpeedControl(dex, team) {
	const need = { 'hyper offense': 3, 'bulky offense': 2, balance: 1 };
	for (let tries = 0; tries < 2; tries++) {
		const report = TL.analyze(dex, team);
		if (report.speedControl.length >= (need[report.style] || 0)) return;
		const attackers = team.filter(s => !report.speedControl.includes(s.species) && supportRank(s) <= 1);
		let taught = false;
		for (const set of attackers) {
			const species = dex.species.get(set.species);
			const side = TL.attackSide(dex, set) === 'special' ? 'Special' : 'Physical';
			const pool = set.legal ? new Set([...set.legal].map(toID)) : RS.learnable(dex, species);
			const best = [...pool].map(id => dex.moves.get(id)).filter(m => m.exists && !m.isNonstandard)
				.map(m => [m, RS.priorityValue(species, m, side, set.ability)])
				.filter(([, v]) => v >= RS.STRONG_PRIORITY)
				.sort((a, b) => b[1] - a[1])[0];
			if (best && teach(dex, set, [best[0].id], set.legal)) { taught = true; break; }
		}
		if (!taught) return;
	}
}

/*
 * The other hazards work like Stealth Rock: a team has a Spikes setter, not
 * three Pokemon each spending a slot on Spikes. Each kind gets one setter, and
 * where there is a choice it is not the rocker - rocks and Spikes can sit on two
 * different Pokemon, which leaves the rocker a slot for something else.
 */
const OTHER_HAZARDS = [['spikes'], ['toxicspikes'], ['stickyweb']];
function oneSetterEach(dex, team) {
	const rocker = set => set.moves.some(m => TL.MOVES.stealthRock.includes(toID(m)));
	for (const kind of OTHER_HAZARDS) {
		const setters = team.filter(s => s.moves.some(m => kind.includes(toID(m))))
			.sort((a, b) => rocker(a) - rocker(b) || supportRank(b) - supportRank(a));
		for (const set of setters.slice(1)) untrain(dex, set, kind, set.legal);
	}
}

/*
 * Knock Off (24 Sep 2026): "1-2 users" on every team but hyper offense
 * (Pinkacross, 18 Things Every Team Needs). The search scores it as a soft
 * rule; when the six it picks still have none, the most supportive member that
 * learns it takes it in place of what it misses least (teach()), the way a
 * wall picks up Haze in answerSetup(). Never a second one: three users is
 * past his diminishing-returns point, and the soft rule says so.
 */
function addKnockOff(dex, team) {
	const report = TL.analyze(dex, team);
	if (report.knockOff.length || ['hyper offense', 'stall'].includes(report.style)) return;
	const helpers = team.filter(s => supportRank(s) >= 2).sort((a, b) => supportRank(b) - supportRank(a));
	for (const set of helpers) if (teach(dex, set, ['knockoff'], set.legal)) return;
}

/*
 * What a wall draws in (breaking core, above): the threats - or, without a
 * list, the eighteen types - that its attacks hit for less than neutral, so
 * they switch into it freely. With no attacks at all, everything does.
 */
const CORE_WEIGHT = 6;
function drawnIn(dex, wall, threats) {
	const fixedDamage = m => ['seismictoss', 'nightshade'].includes(m.id);
	const attacks = wall.moves.map(n => dex.moves.get(n)).filter(m => m.exists && m.category !== 'Status' && (m.basePower > 0 || fixedDamage(m)));
	const list = threats && threats.length
		? threats.map(t => {
			const sp = dex.species.get(t.name || t.species || '');
			return { types: t.types || (sp.exists ? sp.types : []), ability: t.ability || '', weight: t.weight > 0 ? t.weight : 1 };
		}).filter(t => t.types.length)
		: dex.types.names().filter(t => t !== 'Stellar').map(t => ({ types: [t], ability: '', weight: 1 }));
	// Seismic Toss and Night Shade do set damage to anything not immune to their type.
	const hit = (m, t) => (fixedDamage(m) ? (dex.getImmunity(m.type, t.types) ? 1 : 0) : RS.hitOn(dex, m, t.types, t.ability));
	return list.filter(t => !attacks.some(m => hit(m, t) >= 1));
}
/** How well a breaker's attacks hit what a wall draws in: 0-1, super effective in full, neutral a third. */
function cover(dex, set, drawn) {
	const total = drawn.reduce((n, t) => n + t.weight, 0);
	if (!total) return 0;
	const attacks = set.moves.map(n => dex.moves.get(n)).filter(m => m.exists && m.category !== 'Status' && m.basePower > 0);
	let got = 0;
	for (const t of drawn) {
		const best = attacks.reduce((n, m) => Math.max(n, RS.hitOn(dex, m, t.types, t.ability)), 0);
		got += t.weight * (best >= 2 ? 1 : best >= 1 ? 0.35 : 0);
	}
	return got / total;
}

function supportRank(set) {
	return RS.SUPPORT_ROLES.includes(set.role) ? 3 : RS.BULKY_ROLES.includes(set.role) ? 2 : set.role === 'Fast Attacker' ? 1 : 0;
}

/**
 * Items by role; with a bag, only what is in it, as many as there are.
 * `options` (all optional): the checklist's { stage, themed, threats }, for
 * the pass that fixes what the role-by-role choice left the team short of.
 */
function assignItems(dex, team, bag, options = {}) {
	const report = TL.analyze(dex, team);
	const left = bag ? { ...bag } : null;
	// A balance or stall team plays a long game: no one-use items where anything else fits (see RS.ONE_USE).
	const oneUse = !['balance', 'stall'].includes(report.style);
	const order = team.slice().sort((a, b) => report.defensive.includes(b.species) - report.defensive.includes(a.species) || supportRank(b) - supportRank(a));
	for (const set of order) {
		const species = dex.species.get(set.species);
		const side = TL.attackSide(dex, set) === 'special' ? 'Special' : 'Physical';
		const role = { role: set.role };
		let allowed = null;
		if (left) {
			allowed = new Set(Object.entries(left).filter(([, n]) => n > 0).map(([id]) => id).filter(id => dex.items.get(id).exists));
			if (!allowed.size) { set.item = ''; continue; }
		}
		set.item = RS.itemFor(dex, species, role, set.moves, side, allowed ? new Set(heldOnly(dex, allowed)) : null, { oneUse });
		if (left && set.item) left[toID(set.item)]--;
	}
	if (options.stage && options.stage !== 'movesets' && team.length >= 3) improveItems(dex, team, left, options);
}

/*
 * Items for the team, not only the role (24 Sep 2026). itemFor() picks one set
 * at a time, so a team can end up with its only all-out attacker on a Choice
 * Scarf or Boots and no immediate power (Pinkacross, 18 Things: "Choice
 * Band/Specs, or a raw breaker"), or with no contact punisher when a wall
 * could carry a Rocky Helmet. Each set may swap to a better item for the
 * team - Band/Specs or Life Orb on an attacker, a Rocky Helmet on a wall that
 * heals without Leftovers, Boots on a Stealth Rock-weak one - and a swap is
 * kept only when the checklist's score rises, so a Scarf that was the team's
 * speed control stays a Scarf. With a bag, only what is left in it.
 */
function improveItems(dex, team, left, { stage = 'full', themed = false, threats = null } = {}) {
	const scoreOf = () => TL.score(dex, team, { stage, themed, threats }).score;
	const available = id => !left || (left[id] || 0) > 0;
	for (let pass = 0; pass < 2; pass++) {
		let changed = false;
		for (const set of team) {
			if (set.moves.some(m => ['trick', 'switcheroo'].includes(toID(m)))) continue;
			const species = dex.species.get(set.species);
			const moves = set.moves.map(n => dex.moves.get(n));
			const allAttacks = moves.length >= 3 && moves.every(m => m.category !== 'Status');
			const options = [];
			if (!RS.BULKY_ROLES.includes(set.role) && !RS.SUPPORT_ROLES.includes(set.role) && !moves.some(m => RS.SETUP.includes(m.id))) {
				if (allAttacks) options.push(TL.attackSide(dex, set) === 'special' ? 'choicespecs' : 'choiceband');
				options.push('lifeorb');
			}
			const heals = set.moves.some(m => RS.RECOVERY.includes(toID(m))) || toID(set.ability) === 'regenerator';
			if (TL.isDefensive(dex, set) && heals) options.push('rockyhelmet');
			if (dex.getEffectiveness('Rock', species.types) >= 1 && dex.getImmunity('Rock', species.types)) options.push('heavydutyboots');
			const current = toID(set.item);
			let best = scoreOf(), choice = null;
			for (const id of options) {
				if (id === current || !available(id) || !dex.items.get(id).exists) continue;
				const was = set.item;
				set.item = dex.items.get(id).name;
				const s = scoreOf();
				set.item = was;
				if (s > best + 0.01) { best = s; choice = id; }
			}
			if (!choice) continue;
			if (left && current) left[current] = (left[current] || 0) + 1;
			if (left) left[choice]--;
			set.item = dex.items.get(choice).name;
			changed = true;
		}
		if (!changed) return;
	}
}

/** Only items worth holding in battle (no balls, no evolution stones). */
function heldOnly(dex, ids) {
	return [...ids].filter(id => {
		const item = dex.items.get(id);
		return item.exists && !item.isPokeball && !item.megaStone && !item.zMove && !/stone$/.test(id) && !item.isGem;
	});
}

module.exports = { assemble, teach, untrain, assignItems, improveItems, keepValue, drawnIn, cover };
