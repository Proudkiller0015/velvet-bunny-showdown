'use strict';
/**
 * Dedicated stall teams, picked by role instead of by usage (24 Sep 2026).
 *
 * The owner: "I want the ladder, including the RP tier, to build dedicated
 * stall sometimes... since it goes against usage." Every other path picks its
 * Pokemon from what the format plays most (src/teambuilder.js ranks the draw by
 * usage; src/team-assembler.js by strength), and stall is rare in usage - so an
 * archetype of 'stall' there came out as an offense team with bulkier sets.
 * Here the six are chosen for the jobs a stall team has, the way the real ones
 * are built (docs/research-stall.md, and the three Smogon National Dex stall
 * teams in data/teams/natdex/stall-*.txt):
 *
 *   - four to six walls with reliable recovery, physical and special ones;
 *   - Stealth Rock, ideally Spikes and Toxic Spikes too ("hazards are stall's
 *     main offence, and Spikes stack", research-stall C1);
 *   - hazard removal or a Ghost spinblocker (C2, C3);
 *   - Toxic and Will-O-Wisp ("status is stall's main damage", B1, B2);
 *   - an answer to setup: Unaware, a phazer or Haze (D1, D2);
 *   - a cleric or Wish (A5; "a cleric for stall", research-teambuilding A2);
 *   - a win condition: a setup wall (Calm Mind, Iron Defense + Body Press,
 *     Curse) or, failing that, residual damage (I3).
 *
 * Sets are defensive: 252 HP and the side the wall is for, a +Def or +SpD
 * nature, Leftovers / Black Sludge / Heavy-Duty Boots / Rocky Helmet, never a
 * Choice or one-use item. Everything is read from the dex handed in - moves by
 * their data (a custom move that heals half is recovery; Tectonic Shell is
 * Stealth Rock), abilities by name - so this server's own Pokemon, buffs and
 * Megas are candidates like any other.
 *
 * Callers: src/teambuilder.js (the ladder and challenge bots, every 6v6
 * singles format) and src/encounters.js (the stall Ace Trainer).
 */

const RS = require('./role-sets');
const TL = require('./team-logic');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/*
 * Reliable recovery: heals at will, every turn it is clicked. Rest is not on
 * the list - two turns asleep make it "not Recover" (research-stall A4,
 * Fildrong S7) - and neither is Pain Split, which heals nothing against a
 * wall. Custom moves join by their data (see healsHalf).
 */
const RELIABLE = ['recover', 'roost', 'softboiled', 'slackoff', 'shoreup', 'milkdrink', 'healorder', 'moonlight', 'morningsun',
	'synthesis', 'strengthsap', 'junglehealing', 'lunarblessing', 'tectonicshell', 'chrysalisveil'];
// Abilities that heal on their own: a Regenerator wall recovers a third on every switch.
const SELF_HEAL_ABILITIES = ['regenerator', 'poisonheal', 'prescience'];

/*
 * The jobs, and the moves that do each. A move can do two: Royal Decree phazes
 * and lays Spikes, Tectonic Shell heals and sets Stealth Rock.
 */
const JOBS = {
	sr: ['stealthrock', 'tectonicshell'],
	spikes: ['spikes', 'royaldecree'],
	tspikes: ['toxicspikes'],
	// Spin-type removal first: Defog also clears the team's own Spikes (research-teambuilding H1).
	removal: ['rapidspin', 'mortalspin', 'courtchange', 'defog'],
	toxic: ['toxic'],
	wisp: ['willowisp'],
	phaze: ['whirlwind', 'roar', 'dragontail', 'circlethrow', 'royaldecree'],
	haze: ['haze', 'clearsmog'],
	cleric: ['healbell', 'aromatherapy', 'wish', 'junglehealing', 'lunarblessing'],
};
/*
 * A setup wall and the attack it wins with (research-stall I3: "SD Gliscor,
 * Curse Dondozo, Calm Mind Blissey and Amnesia Clodsire win late"). `attack`
 * null: any attack of that side. Swords Dance only with Poison Heal, which
 * keeps the wall healthy while it boosts.
 */
const WINCONS = [
	{ setup: 'irondefense', attack: 'bodypress' },
	{ setup: 'acidarmor', attack: 'bodypress' },
	{ setup: 'cosmicpower', attack: 'bodypress' },
	{ setup: 'calmmind', side: 'Special' },
	{ setup: 'quiverdance', side: 'Special' },
	{ setup: 'curse', side: 'Physical' },
	{ setup: 'bulkup', side: 'Physical' },
	{ setup: 'swordsdance', side: 'Physical', ability: 'poisonheal' },
];
const FIXED_DAMAGE = ['seismictoss', 'nightshade'];
const NEVER_ITEMS = [...RS.CHOICE_ITEMS, ...TL.ONE_USE_ITEMS];

/*
 * Abilities a wall wants, best first. Unaware and Regenerator are what the
 * sample teams run (Clodsire, Toxapex, Dondozo); Magic Bounce is the reason
 * Mega Sableye defines NatDex stall (research-stall S1); Poison Heal with a
 * Toxic Orb is Gliscor's recovery. This server's own abilities come in by
 * their effect: Prescience is Magic Guard + Magic Bounce + Regenerator,
 * Keystone Legion survives a hit and curses the attacker.
 */
const ABILITY_VALUE = {
	prescience: 10, unaware: 9, regenerator: 9, magicbounce: 8, poisonheal: 8, keystonelegion: 7, purifyingsalt: 7,
	magicguard: 6, goodasgold: 6, naturalcure: 5, multiscale: 5, thickfat: 4, pressure: 4, levitate: 4, fluffy: 4,
	icescales: 4, filter: 3, solidrock: 3, waterabsorb: 4, voltabsorb: 4, flashfire: 4, sapsipper: 4, eartheater: 4,
	wellbakedbody: 4, stormdrain: 4, intimidate: 3, heatproof: 3, waterbubble: 3, owntempo: 1,
};

/** A status move that heals the user a third or more: Recover, and anything this server added like it. */
function healsHalf(move) {
	if (!move || !move.exists) return false;
	if (RELIABLE.includes(move.id)) return true;
	return move.category === 'Status' && move.target === 'self' && Array.isArray(move.heal) && move.heal[0] / move.heal[1] >= 1 / 3 && move.id !== 'rest';
}

/*
 * How much a wall's attack is worth. Not damage: a wall's attack earns its
 * slot by burning or poisoning (Scald, Lava Plume), removing an item (Knock
 * Off), doing set damage whatever the boosts (Seismic Toss, Night Shade; I2)
 * or hitting from Defense (Body Press). A self-dropping attack is a last
 * resort; the same valuation role-sets.js gives a Bulky Support set.
 */
function attackWorth(species, move, stats) {
	if (move.category === 'Status' || RS.selfDrop(move)) return RS.selfDrop(move) ? 5 : 0;
	// Seismic Toss is 100 a hit from any wall: better than a STAB from a base 75 attacking stat (Blissey's Hyper Voice).
	if (FIXED_DAMAGE.includes(move.id)) return 115;
	let value;
	if (move.id === 'bodypress') value = 80 * (species.types.includes('Fighting') ? 1.5 : 1) * Math.min(1.5, stats.def / 100);
	else if (move.id === 'foulplay') value = 60;
	// Each attack from its own stat: Alomomola's Scald was being judged off its Attack.
	else value = RS.attackValue(species, move, move.category) * Math.min(1.3, (move.category === 'Physical' ? stats.atk : stats.spa) / 100);
	/*
	 * The burn or poison is worth more than the damage, and does not depend on
	 * the wall's attacking stat: a flat bonus, not a multiplier, so base 40
	 * Special Attack Alomomola still takes Scald over Body Slam.
	 */
	const status = move.secondary && move.secondary.status && (move.secondary.chance || 100) >= 20 ? move.secondary.status : null;
	if (status) value += ['brn', 'tox', 'psn'].includes(status) ? 60 : 30;
	if (move.id === 'knockoff' || move.id === 'saltcure') value *= 1.4;
	if (move.recoil || move.selfdestruct || (move.self && move.self.volatileStatus === 'mustrecharge')) value *= 0.5;
	// Outrage and Petal Dance lock the wall in and confuse it: nothing a wall that switches all game wants.
	if (move.self && move.self.volatileStatus === 'lockedmove') value *= 0.4;
	if (move.flags && move.flags.charge) value *= 0.3;
	// Power that falls with the user's HP: a wall spends the game below full (Jellicent took Water Spout).
	if (['eruption', 'waterspout', 'dragonenergy'].includes(move.id)) value *= 0.4;
	// A wall attacks many times a game: Gunk Shot's misses cost more there than its power earns (Scald over it on Toxapex).
	if (move.accuracy !== true && move.accuracy < 90) value *= 0.7;
	return value;
}

/**
 * A candidate, read once: its bulk, its recovery and every job it can do.
 * `options.learn(species, moveId)` says whether this format lets it use a move.
 * `mega`: the Mega forme it becomes (stats, types and ability read from it;
 * the set is the base species holding the stone).
 */
function profile(dex, species, { learn, mega = null, eviolite = true } = {}) {
	const body = mega || species;
	const pool = RS.learnable(dex, species);
	const cache = new Map();
	const can = id => {
		if (!pool.has(id)) return false;
		if (!cache.has(id)) cache.set(id, !learn || learn(species, id));
		return cache.get(id);
	};
	const b = body.baseStats;
	const boost = !mega && eviolite && species.nfe ? 1.5 : 1;
	const phys = b.hp * b.def * boost, spec = b.hp * b.spd * boost;
	const abilities = Object.values((mega ? mega : species).abilities).filter(Boolean);
	// Only abilities this dex has: Sylveon's Ribbon Hymn (ours) does not exist in the Gen 6 RP tiers.
	const known = a => a && dex.abilities.get(a).exists;
	const setAbilities = Object.values(species.abilities).filter(known);
	const abilityOf = list => list.slice().sort((x, y) => abilityValue(dex, y) - abilityValue(dex, x))[0] || '';
	const ability = mega ? abilities[0] : abilityOf(setAbilities);

	const recovery = [...pool].filter(id => can(id) && healsHalf(dex.moves.get(id)))
		.sort((x, y) => (dex.moves.get(y).num < 0 ? 1 : 0) - (dex.moves.get(x).num < 0 ? 1 : 0))[0] || null;
	const wish = can('wish') && can('protect');
	const selfHeal = SELF_HEAL_ABILITIES.includes(toID(ability)) && (toID(ability) !== 'poisonheal' || !body.types.some(t => t === 'Poison' || t === 'Steel'));
	const jobs = {};
	for (const [job, ids] of Object.entries(JOBS)) jobs[job] = ids.filter(can);
	// Attacks: the best few by stall worth. Unlearnable ones are skipped before the costly check.
	const attacks = [...pool].map(id => dex.moves.get(id))
		.filter(m => m.exists && !m.isNonstandard && !m.isZ && !m.isMax && m.category !== 'Status' && (m.basePower >= 50 || FIXED_DAMAGE.includes(m.id)) && !RS.selfDrop(m) && !m.id.startsWith('hiddenpower'))
		.map(m => [m, attackWorth(body, m, b)])
		.sort((x, y) => y[1] - x[1])
		.filter(([m]) => can(m.id)).slice(0, 8);
	// A setup move only with an attack of its side to win with: Curse Mantine had nothing physical to hit with.
	const wincons = WINCONS.filter(w => can(w.setup) && (!w.ability || toID(ability) === w.ability) &&
		(w.attack ? can(w.attack) : attacks.some(([m]) => m.category === w.side || FIXED_DAMAGE.includes(m.id))));
	return {
		species, body, mega, ability, types: body.types, stats: b, phys, spec,
		side: phys >= spec ? 'Physical' : 'Special',
		quality: Math.log2(Math.max(phys, spec)) - 12,
		recovery, wish, selfHeal, jobs, wincons, attacks, can,
		protect: can('protect'),
		unaware: ['unaware', 'keystonelegion'].includes(toID(mega ? abilities[0] : ability)),
		magicBounce: ['magicbounce', 'prescience'].includes(toID(mega ? abilities[0] : ability)),
		ghost: body.types.includes('Ghost'),
		nfe: !mega && species.nfe,
	};
}

// Abilities that need a weather the stall team does not set: Harvest Tropius failed the checklist's weather rule.
const WEATHER_ABUSERS = ['harvest', 'chlorophyll', 'solarpower', 'flowergift', 'swiftswim', 'raindish', 'hydration', 'sandrush', 'sandforce', 'slushrush', 'icebody'];

function abilityValue(dex, name) {
	const a = dex.abilities.get(name);
	if (WEATHER_ABUSERS.includes(a.id)) return -5;
	const v = ABILITY_VALUE[a.id];
	if (v !== undefined) return v + (a.num < 0 ? 3 : 0);
	return (a.rating || 0) + (a.num < 0 ? 3 : 0);
}

/** Heals at will: reliable recovery, Wish + Protect, or an ability that heals. */
const heals = p => !!(p.recovery || p.wish || p.selfHeal);

/**
 * Whether a species is worth considering at all: bulky enough to wall one
 * side (a Toxapex is ~7600 HP x Def; a Pikachu 1400) and able to heal. Only
 * healers: a Leftovers Ting-Lu setting rocks is a wall without recovery, which
 * the checklist fails on a stall team (src/team-logic.js), and every member of
 * the three Smogon samples heals.
 */
function stallWorthy(p) {
	if (Math.max(p.phys, p.spec) < 6000 || Math.min(p.phys, p.spec) < 1800) return false;
	/*
	 * An Eviolite wall only when it is a real one on its own (Chansey 450,
	 * Gligar 430, Porygon2 515): the first RP OU games had Pineco, Slowpoke and
	 * Frillish on stall teams, whose Eviolite bulk read well and whose moves
	 * and stats did nothing.
	 */
	if (p.nfe && Object.values(p.species.baseStats).reduce((a, b) => a + b, 0) < 400) return false;
	return p.attacks.length > 0 && heals(p);
}

// ------------------------------------------------------------ the jobs

/*
 * Which member does which job, for a team of profiles: every member heals
 * (1 slot, 2 for Wish + Protect) and attacks (1 slot), which leaves two for
 * jobs. A job goes to the member that can do it and has the fewest other
 * uncovered jobs it could still do, so a Pokemon that is the team's only
 * Spikes setter is not spent on Toxic. Abilities and typing do some jobs for
 * free: Unaware answers setup, Magic Bounce bounces hazards, a Ghost spinblocks.
 */
const JOB_ORDER = ['sr', 'removal', 'answer', 'toxic', 'spikes', 'wisp', 'wincon', 'cleric', 'tspikes', 'answer2'];

function assign(members, rng = Math.random) {
	const plan = members.map(p => {
		if (p.fixed) return { p, moves: p.fixed.moves.map(toID), free: 0, wincon: null };
		const moves = [];
		if (p.recovery) moves.push(p.recovery);
		else if (p.wish) moves.push('wish', 'protect');
		return { p, moves, free: 4 - moves.length - 1, wincon: null };
	});
	const has = (id) => plan.some(x => x.moves.includes(id));
	const covered = {
		sr: () => plan.some(x => JOBS.sr.some(id => x.moves.includes(id))),
		spikes: () => plan.some(x => JOBS.spikes.some(id => x.moves.includes(id))),
		tspikes: () => has('toxicspikes'),
		removal: () => plan.some(x => JOBS.removal.some(id => x.moves.includes(id)) || x.p.magicBounce),
		toxic: () => has('toxic'),
		wisp: () => has('willowisp'),
		cleric: () => plan.some(x => JOBS.cleric.some(id => x.moves.includes(id))),
		answer: () => answers(plan) >= 1,
		answer2: () => answers(plan) >= 2,
		wincon: () => plan.some(x => x.wincon || (x.p.fixed && WINCONS.some(w => x.moves.includes(w.setup)))),
	};
	const options = (x, job) => {
		if (x.free < 1) return [];
		if (job === 'answer' || job === 'answer2') return [...x.p.jobs.haze, ...x.p.jobs.phaze].filter(id => !x.moves.includes(id));
		if (job === 'wincon') return x.p.wincons.map(w => w.setup);
		return x.p.jobs[job].filter(id => !x.moves.includes(id));
	};
	for (const job of JOB_ORDER) {
		if (covered[job]()) continue;
		const able = plan.filter(x => options(x, job).length);
		if (!able.length) continue;
		const flexibility = x => JOB_ORDER.filter(j => j !== job && !covered[j]() && options(x, j).length).length;
		able.sort((a, b) => flexibility(a) - flexibility(b) || b.free - a.free || rng() - 0.5);
		const x = able[0];
		const id = options(x, job)[0];
		x.moves.push(id);
		x.free--;
		if (job === 'wincon') x.wincon = x.p.wincons.find(w => w.setup === id);
	}
	return plan;
}

/** Distinct answers to setup: Unaware, phazing, Haze (each counted once). */
function answers(plan) {
	let n = 0;
	if (plan.some(x => x.p.unaware)) n++;
	if (plan.some(x => JOBS.phaze.some(id => x.moves.includes(id)))) n++;
	if (plan.some(x => JOBS.haze.some(id => x.moves.includes(id)))) n++;
	return n;
}

// ------------------------------------------------------------ the team

/*
 * How good a stall team the profiles make: the jobs covered (weighted by how
 * much the research leans on each), the walls' bulk, both sides walled, and
 * typing - three members weak to one type is a hole a breaker walks through.
 * `prior` (0-1, from the caller: usage or this server's own results) tips
 * a choice between two similar walls towards the one people actually play.
 */
function teamValue(dex, members, rng) {
	const plan = assign(members, rng);
	const setupAnswers = answers(plan);
	const moveIn = ids => plan.some(x => ids.some(id => x.moves.includes(id)));
	let v = 0;
	const healers = members.filter(p => p.fixed ? p.fixedHeals : heals(p)).length;
	v -= Math.max(0, Math.min(4, members.length) - healers) * 15;
	v -= Math.max(0, members.length - healers - 1) * 12;
	if (moveIn(JOBS.sr)) v += 12;
	if (moveIn(JOBS.removal) || plan.some(x => x.p.magicBounce)) v += 10;
	if (members.some(p => p.ghost)) v += 5;
	if (moveIn(JOBS.spikes)) v += 5;
	if (moveIn(JOBS.tspikes)) v += 3;
	if (moveIn(JOBS.toxic)) v += 8;
	if (moveIn(JOBS.wisp)) v += 5;
	if (setupAnswers >= 1) v += 12;
	if (setupAnswers >= 2) v += 4;
	if (moveIn(JOBS.cleric)) v += 4;
	if (plan.some(x => x.wincon) || members.some(p => p.fixed && WINCONS.some(w => p.fixed.moves.map(toID).includes(w.setup)))) v += 6;
	else if (moveIn(JOBS.toxic) && (moveIn(JOBS.sr) || moveIn(JOBS.spikes))) v += 3;
	v += members.reduce((n, p) => n + 2 * Math.max(-1, Math.min(3, p.quality)) + 3 * (p.prior || 0) + (p.taste || 0), 0);
	const physWalls = members.filter(p => p.side === 'Physical').length;
	const specWalls = members.length - physWalls;
	if (members.length >= 4) v -= Math.max(0, 2 - physWalls) * 5 + Math.max(0, 2 - specWalls) * 5;
	if (members.filter(p => p.mega).length > 1) v -= 100;
	// Typing: shared weaknesses, and something that resists each key attacking type.
	for (const type of dex.types.names()) {
		if (type === 'Stellar') continue;
		const weak = members.filter(p => mult(dex, type, p) >= 2).length;
		if (weak >= 3) v -= (weak - 2) * 5;
		if (TL.KEY_TYPES.includes(type) && members.length >= 4 && !members.some(p => mult(dex, type, p) <= 0.5)) v -= 8;
	}
	return v;
}

const IMMUNE_BY_ABILITY = { levitate: 'Ground', eartheater: 'Ground', flashfire: 'Fire', wellbakedbody: 'Fire', waterabsorb: 'Water',
	stormdrain: 'Water', dryskin: 'Water', voltabsorb: 'Electric', lightningrod: 'Electric', motordrive: 'Electric', sapsipper: 'Grass', purifyingsalt: 'Ghost' };
function mult(dex, type, p) {
	if (IMMUNE_BY_ABILITY[toID(p.ability)] === type) return 0;
	if (!dex.getImmunity(type, p.types)) return 0;
	let m = Math.pow(2, dex.getEffectiveness(type, p.types));
	if (toID(p.ability) === 'thickfat' && (type === 'Fire' || type === 'Ice')) m *= 0.5;
	return m;
}

/*
 * Six from the candidates: greedy from a random start, then single swaps that
 * raise the value. A few restarts from different seeds, and small noise in
 * the greedy step, so the ladder does not meet the same six every time.
 */
function chooseMembers(dex, all, { size, rng, fixed = [] }) {
	/*
	 * One of a family: Chansey and Blissey are two species to the Species
	 * Clause but one niche on a team, and the search took both whenever it
	 * could, since each ticks the same boxes.
	 */
	const familyOf = p => {
		let s = p.species;
		for (let i = 0; i < 4 && s.prevo; i++) { const up = dex.species.get(s.prevo); if (!up.exists) break; s = up; }
		return toID(s.baseSpecies);
	};
	const fits = (team, p) => !team.some(q => familyOf(q) === familyOf(p)) && !(p.mega && team.some(q => q.mega));
	const cands = shortlist(all, rng);
	let best = null, bestValue = -Infinity;
	for (let restart = 0; restart < 2; restart++) {
		const team = fixed.slice();
		const healers = cands.filter(heals);
		if (team.length < size && healers.length) {
			const pickFrom = healers.filter(p => fits(team, p));
			if (pickFrom.length) team.push(pickFrom[Math.floor(rng() * pickFrom.length)]);
		}
		while (team.length < size) {
			let top = null, topValue = -Infinity;
			for (const p of cands) {
				if (!fits(team, p)) continue;
				const v = teamValue(dex, [...team, p], rng) + rng() * 4;
				if (v > topValue) { topValue = v; top = p; }
			}
			if (!top) break;
			team.push(top);
		}
		let value = teamValue(dex, team, rng);
		for (let pass = 0; pass < 2; pass++) {
			let improved = false;
			for (let slot = fixed.length; slot < team.length; slot++) {
				for (const p of cands) {
					if (team.includes(p)) continue;
					const trial = team.slice();
					trial[slot] = p;
					if (!fits(trial.filter((q, i) => i !== slot), p)) continue;
					const v = teamValue(dex, trial, rng);
					if (v > value + 0.5) { value = v; team[slot] = p; improved = true; }
				}
			}
			if (!improved) break;
		}
		const noisy = value + rng() * 6;
		if (team.length === size && noisy > bestValue) { bestValue = noisy; best = team; }
	}
	return best;
}

/*
 * The candidates one build searches: a National Dex format has three hundred
 * stall-worthy Pokemon, and searching them all took two seconds - on the bots'
 * process, between battle turns. So a draw of the bulkiest and most played
 * (with noise, for variety), plus a few of each rarer job so a Spikes setter,
 * a remover, a Haze user, Unaware and a Ghost are always on offer.
 */
function shortlist(all, rng, size = 45, perJob = 5) {
	if (all.length <= size + 6 * perJob) return all;
	const score = p => Math.min(3, p.quality) + 2 * (p.prior || 0) + (heals(p) ? 1 : 0) + rng() * 2;
	const ranked = all.map(p => [p, score(p)]).sort((a, b) => b[1] - a[1]).map(([p]) => p);
	const out = new Set(ranked.slice(0, size));
	const jobTests = [
		p => p.jobs.sr.length, p => p.jobs.spikes.length, p => p.jobs.tspikes.length, p => p.jobs.removal.length || p.magicBounce,
		p => p.jobs.haze.length || p.jobs.phaze.length, p => p.unaware, p => p.ghost && heals(p), p => p.wincons.length, p => p.jobs.cleric.length,
	];
	for (const test of jobTests) {
		let added = 0;
		for (const p of ranked) { if (added >= perJob) break; if (test(p) && heals(p)) { out.add(p); added++; } }
	}
	return [...out];
}

// ------------------------------------------------------------ the sets

/** Items this set wants, best first (never a Choice or one-use item). */
function itemWants(dex, p, moves, team) {
	const out = [];
	if (p.mega) out.push(toID(p.mega.requiredItem));
	if (toID(p.ability) === 'poisonheal') out.push('toxicorb');
	if (p.nfe) out.push('eviolite');
	const rockWeak = mult(dex, 'Rock', p) >= 2;
	if (rockWeak) out.push('heavydutyboots');
	const physicalWall = p.side === 'Physical';
	const helmets = team.filter(x => x.item === 'rockyhelmet').length;
	if (physicalWall && !helmets && moves.some(id => healsHalf(dex.moves.get(id)))) out.push('rockyhelmet');
	if (p.types.includes('Poison')) out.push('blacksludge');
	out.push('leftovers', 'heavydutyboots', 'rockyhelmet', 'blacksludge');
	return out.filter(id => !NEVER_ITEMS.includes(id) && (id !== 'blacksludge' || p.types.includes('Poison')));
}

/*
 * A defensive Tera type (gen 9 formats that allow it): the one that resists
 * the most key attacking types and is weak to the fewest, or the wall's own
 * first type a third of the time - Tera Poison Clodsire, Tera Normal Blissey
 * in the sample teams keep their typing.
 */
const TERA_OPTIONS = ['Fairy', 'Steel', 'Water', 'Poison', 'Ghost', 'Dragon', 'Normal', 'Flying', 'Ground', 'Dark', 'Grass', 'Fire'];
function teraFor(dex, p, rng) {
	if (rng() < 0.33) return p.types[0];
	const score = t => TL.KEY_TYPES.reduce((n, type) => {
		const m = dex.getImmunity(type, [t]) ? Math.pow(2, dex.getEffectiveness(type, [t])) : 0;
		return n + (m === 0 ? 1.5 : m < 1 ? 1 : m > 1 ? -1.5 : 0);
	}, 0);
	// One of the best three, so a team is not six Tera Waters.
	return TERA_OPTIONS.map(t => [t, score(t) + rng()]).sort((a, b) => b[1] - a[1])[Math.floor(rng() * 3)][0];
}

function buildSets(dex, team, { rng, level = 100, items = null, uniqueItems = false, tera = true }) {
	const plan = assign(team, rng);
	const out = [];
	// Sides: at least two physical and two special walls when the stats allow a flip.
	const sides = team.map(p => p.side);
	const flip = want => {
		const cands = team.map((p, i) => [i, p]).filter(([i, p]) => sides[i] !== want && !p.fixed && Math.max(p.phys, p.spec) / Math.min(p.phys, p.spec) < 1.35);
		if (cands.length) sides[cands[0][0]] = want;
	};
	for (let k = 0; k < 2; k++) {
		if (sides.filter(s => s === 'Physical').length < 2) flip('Physical');
		if (sides.filter(s => s === 'Special').length < 2) flip('Special');
	}
	const attackCategories = [];
	plan.forEach((x, i) => {
		const p = x.p;
		if (p.fixed) { out.push({ ...p.fixed, moves: p.fixed.moves.slice() }); return; }
		const moves = x.moves.slice();
		// The attack: the wincon's own (Body Press), else the best stall attack, leaning to the side the team lacks.
		let attack = null;
		if (x.wincon && x.wincon.attack) attack = x.wincon.attack;
		else {
			const suits = p.attacks.filter(([m]) => !x.wincon || !x.wincon.side || m.category === x.wincon.side || FIXED_DAMAGE.includes(m.id));
			/*
			 * A STAB, Seismic Toss / Night Shade or Body Press when it has one: set
			 * sanity's "no STAB attack" (RS.setProblems) caught Scream Tail with
			 * only Body Slam, which a Fairy wall's Dazzling Gleam does better.
			 */
			const main = suits.filter(([m]) => RS.isStab(p.body, m, p.ability) || FIXED_DAMAGE.includes(m.id) || m.id === 'bodypress');
			const options = main.length ? main : suits;
			const lacking = attackCategories.length >= 2 && attackCategories.every(c => c === attackCategories[0]) ? (attackCategories[0] === 'Physical' ? 'Special' : 'Physical') : null;
			const top = options[0];
			const alt = lacking && top && options.find(([m, w]) => m.category === lacking && w >= 0.7 * top[1]);
			const chosen = (alt || top || [null])[0];
			attack = chosen ? chosen.id : null;
		}
		if (attack && !moves.includes(attack)) moves.splice(Math.min(moves.length, 1), 0, attack);
		if (attack) attackCategories.push(dex.moves.get(attack).category);
		// The rest: Protect for a Toxic or Poison Heal user, more of the team's jobs, then coverage.
		const fillers = [];
		if (p.protect && (moves.includes('toxic') || toID(p.ability) === 'poisonheal' || moves.includes('wish'))) fillers.push('protect');
		for (const id of ['toxic', 'willowisp', 'knockoff', ...p.jobs.haze, ...p.jobs.phaze, 'toxicspikes', 'healbell', 'thunderwave', 'protect']) {
			if (p.can(id)) fillers.push(id);
		}
		const teamMoves = new Set([...plan.flatMap(y => y.moves), ...out.flatMap(s => s.moves.map(toID))]);
		for (const id of fillers) {
			if (moves.length >= 4) break;
			if (moves.includes(id)) continue;
			// One setter of each hazard; a second Toxic is fine, a second Haze is not.
			if ([...JOBS.sr, ...JOBS.spikes, ...JOBS.tspikes, ...JOBS.removal, ...JOBS.haze].includes(id) && teamMoves.has(id)) continue;
			if (id === 'thunderwave' && moves.some(m => ['toxic', 'willowisp'].includes(m))) continue;
			moves.push(id);
		}
		for (const [m] of p.attacks) {
			if (moves.length >= 4) break;
			if (!moves.includes(m.id) && RS.coverageGain(dex, moves.map(id => dex.moves.get(id)), m) > 0) moves.push(m.id);
		}
		for (const [m] of p.attacks) { if (moves.length >= 4) break; if (!moves.includes(m.id)) moves.push(m.id); }
		const names = moves.slice(0, 4).map(id => dex.moves.get(id).name);
		const side = x.wincon && x.wincon.attack === 'bodypress' ? 'Physical' : sides[i];
		const physicalAttacker = moves.some(id => { const m = dex.moves.get(id); return m.category === 'Physical' && !['bodypress', 'foulplay', ...FIXED_DAMAGE].includes(m.id); });
		const nature = side === 'Physical' ? (physicalAttacker ? 'Impish' : 'Bold') : (physicalAttacker ? 'Careful' : 'Calm');
		const evs = side === 'Physical' ? { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 } : { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 };
		const set = {
			name: p.species.name, species: p.species.name, ability: p.mega ? Object.values(p.species.abilities)[0] : p.ability,
			item: '', moves: names, nature, evs, level, gender: '',
		};
		const ivs = RS.ivsFor(dex, p.species, names);
		if (ivs) set.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...ivs };
		if (tera) set.teraType = teraFor(dex, p, rng);
		set._p = p;
		out.push(set);
	});
	/*
	 * Items, the sets whose need is narrowest first: a Mega Stone, a Toxic Orb
	 * for Poison Heal, an Eviolite, Boots on a Rock-weak wall - so under Item
	 * Clause the Leftovers go to whoever is left, not the Boots to a Chansey.
	 */
	if (items !== false) {
		const taken = new Set(out.filter(s => s.item).map(s => toID(s.item)));
		const rank = set => {
			const first = itemWants(dex, set._p, set.moves.map(toID), [])[0];
			const at = ['toxicorb', 'eviolite', 'heavydutyboots'].indexOf(first);
			return set._p.mega ? -1 : at < 0 ? 3 : at;
		};
		const order = out.filter(s => s._p).sort((a, b) => rank(a) - rank(b));
		for (const set of order) {
			const wants = itemWants(dex, set._p, set.moves.map(toID), out.map(s => ({ item: toID(s.item) })));
			const id = wants.find(w => dex.items.get(w).exists && (!items || items.has(w)) && !(uniqueItems && taken.has(w)));
			if (id) { set.item = dex.items.get(id).name; taken.add(id); }
		}
	}
	for (const set of out) delete set._p;
	return out;
}

// ------------------------------------------------------------ the entry point

/**
 * A stall team, or null when the pool cannot make one.
 *
 * pool: [{ species (name or Species), prior?: 0-1, level? }]
 * options:
 *   size        6
 *   rng         Math.random
 *   level       100 (per-candidate `level` wins)
 *   learn       (species, moveId) => bool, the format's own learn check (default: any learnable move)
 *   items       Set of allowed item ids, null for any, false for no items
 *   uniqueItems Item Clause
 *   tera        give Tera types
 *   megas       (megaSpecies) => bool, whether a Mega forme may be used; default none
 *   fixed       whole sets that must be on the team (a sample team's core)
 *   profiles    a Map to cache profiles in (the teambuilder keeps one per format)
 */
function build(dex, pool, options = {}) {
	const { size = 6, rng = Math.random, level = 100, learn = null, items = null, uniqueItems = false, tera = true, megas = null, fixed = [], profiles = null } = options;
	const cands = [];
	for (const entry of pool) {
		const species = typeof entry.species === 'string' ? dex.species.get(entry.species) : entry.species;
		if (!species || !species.exists) continue;
		// A forme held in place by its item (Arceus-Fairy and its Plate): the item slot is not the builder's to give.
		if (species.requiredItem || (species.requiredItems && species.requiredItems.length)) continue;
		const forms = [null];
		if (megas && items !== false) {
			for (const name of species.otherFormes || []) {
				const f = dex.species.get(name);
				if (f.exists && f.isMega && f.requiredItem && (!items || items.has(toID(f.requiredItem))) && megas(f)) forms.push(f);
			}
		}
		for (const mega of forms) {
			const key = `${species.id}|${mega ? mega.id : ''}`;
			let p = profiles && profiles.get(key);
			if (!p) {
				p = profile(dex, species, { learn, mega, eviolite: items === null || (items && items.has('eviolite')) });
				if (profiles) profiles.set(key, p);
			}
			if (!stallWorthy(p)) continue;
			/*
			 * `taste`: this build's own liking for each candidate, drawn fresh every
			 * build. Without it the best wall on paper was on every team - Blissey
			 * on twelve of twelve RP OU stall teams - and the ladder would learn one
			 * team, not stall.
			 */
			cands.push({ ...p, prior: entry.prior || 0, level: entry.level || level, taste: rng() * 6 });
		}
	}
	const fixedProfiles = fixed.map(set => {
		const species = dex.species.get(set.species);
		const p = profile(dex, species, { learn: null, eviolite: false });
		const ids = set.moves.map(toID);
		return {
			...p, fixed: set, ability: set.ability, prior: 0,
			fixedHeals: ids.some(id => healsHalf(dex.moves.get(id)) || id === 'wish') || SELF_HEAL_ABILITIES.includes(toID(set.ability)),
			ghost: p.types.includes('Ghost'), unaware: ['unaware', 'keystonelegion'].includes(toID(set.ability)),
			magicBounce: ['magicbounce', 'prescience'].includes(toID(set.ability)),
		};
	});
	const usable = cands.filter(p => !fixedProfiles.some(f => f.species.baseSpecies === p.species.baseSpecies));
	if (usable.length + fixedProfiles.length < size) return null;
	const team = chooseMembers(dex, usable, { size, rng, fixed: fixedProfiles });
	if (!team) return null;
	const sets = buildSets(dex, team, { rng, level, items, uniqueItems, tera });
	team.forEach((p, i) => { if (!p.fixed) sets[i].level = p.level || level; });
	return sets;
}

/**
 * The stall checks, for a finished team of sets (the tests, and the
 * teambuilder before it accepts a team): walls with reliable recovery, hazards,
 * removal or a spinblocker, an answer to setup, and no Choice or one-use item.
 */
function stallReport(dex, sets) {
	const ids = set => set.moves.map(toID);
	const healer = set => ids(set).some(id => healsHalf(dex.moves.get(id)) || id === 'wish') || SELF_HEAL_ABILITIES.includes(toID(set.ability));
	const any = list => sets.some(set => ids(set).some(id => list.includes(id)));
	const types = set => dex.species.get(set.species).types;
	const report = {
		healers: sets.filter(healer).length,
		walls: sets.filter(set => TL.isDefensive(dex, set)).length,
		stealthRock: any(JOBS.sr),
		spikes: any([...JOBS.spikes, ...JOBS.tspikes]),
		removal: any(JOBS.removal) || sets.some(s => ['magicbounce', 'prescience'].includes(toID(s.ability)) || toID(s.item) === 'sablenite'),
		spinblocker: sets.some(s => types(s).includes('Ghost')),
		setupAnswer: any([...JOBS.phaze, ...JOBS.haze]) || sets.some(s => ['unaware', 'keystonelegion'].includes(toID(s.ability))),
		status: any(['toxic', 'willowisp', 'toxicspikes']),
		choice: sets.filter(s => RS.CHOICE_ITEMS.includes(toID(s.item))).map(s => s.species),
		oneUse: sets.filter(s => TL.ONE_USE_ITEMS.includes(toID(s.item))).map(s => s.species),
	};
	// Before Gen 4 there is no Stealth Rock: Spikes is the hazard (GSC and ADV stall's Skarmory and Forretress).
	const hazards = report.stealthRock || (dex.gen < 4 && report.spikes);
	report.ok = report.healers >= Math.min(4, sets.length - 1) && hazards && (report.removal || report.spinblocker) &&
		report.setupAnswer && !report.choice.length && !report.oneUse.length;
	return report;
}

module.exports = { build, stallReport, profile, healsHalf, assign, JOBS, RELIABLE };
