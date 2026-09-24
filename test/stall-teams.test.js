'use strict';
/**
 * Dedicated stall teams (src/stall-builder.js): the ladder's, in [Gen 9] RP OU
 * and [Gen 9] National Dex, and the RP's stall Ace Trainer.
 *
 *   node test/stall-teams.test.js          50 teams per format
 *   node test/stall-teams.test.js 10       10 per format (quicker)
 *
 * Every team must be legal and real stall: walls that heal (four or more),
 * Stealth Rock, removal or a Ghost spinblocker, an answer to setup (Unaware, a
 * phazer, Haze), status to spread, and no Choice or one-use item. The
 * checklist (src/team-logic.js) must judge it as stall and not complain that
 * it is passive or has no breaker. And stall must come up at the configured
 * share of builds (src/ladder-defaults.js), no more, no less.
 */

const { TeamBuilder } = require('../src/teambuilder');
const { Teams, TeamValidator } = require('pokemon-showdown');
const SB = require('../src/stall-builder');
const TL = require('../src/team-logic');
const RS = require('../src/role-sets');
const E = require('../src/encounters');
const { stallShare } = require('../src/ladder-defaults');

const N = Number(process.argv[2]) || 50;
let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Complaints a stall team must never get: they are offense's rules, and stall is exempt from them.
const OFFENSE_ONLY = /too passive|passive members|immediate power|wallbreaker|break a wall|no priority move|no pivot|speed control a/i;

function stallChecks(dex, team, label) {
	const r = SB.stallReport(dex, team);
	const problems = [];
	if (r.healers < 4) problems.push(`${r.healers} healers`);
	if (r.walls < 4) problems.push(`${r.walls} walls`);
	if (!r.stealthRock) problems.push('no Stealth Rock');
	if (!r.removal && !r.spinblocker) problems.push('no removal or spinblocker');
	if (!r.setupAnswer) problems.push('no answer to setup');
	if (!r.status) problems.push('no status');
	if (r.choice.length) problems.push(`Choice items on ${r.choice}`);
	if (r.oneUse.length) problems.push(`one-use items on ${r.oneUse}`);
	// Set sanity, as every other build path is held to it (test/set-sanity.test.js).
	for (const set of team) {
		const insane = RS.setProblems(dex, set);
		if (insane.length) problems.push(`${set.species}: ${insane.map(x => x.text).join(', ')}`);
	}
	const found = TL.score(dex, team, { stage: 'full', archetype: 'stall' });
	if (found.report.style !== 'stall') problems.push(`the checklist reads it as ${found.report.style}`);
	const offense = found.issues.filter(i => OFFENSE_ONLY.test(i.text));
	if (offense.length) problems.push(`offense complaints: ${offense.map(i => i.text).join('; ')}`);
	const stallHard = found.issues.filter(i => i.severity === 'hard' && /stall team/.test(i.text));
	if (stallHard.length) problems.push(`stall rules: ${stallHard.map(i => i.text).join('; ')}`);
	return { problems, hard: found.issues.filter(i => i.severity === 'hard').map(i => i.text), report: r };
}

(async () => {
	const builder = new TeamBuilder();
	for (const format of ['gen9rpou', 'gen9nationaldex']) {
		try { await builder.prefetch(format); } catch (e) { /* offline: the stall path needs no usage data */ }
		const ctx = builder.context(format);
		let legal = 0, stall = 0, spikes = 0, toxic = 0, wincon = 0, cleric = 0;
		const bad = [];
		const species = new Map();
		const hardCount = new Map();
		const t0 = Date.now();
		for (let i = 0; i < N; i++) {
			const team = Teams.unpack(builder.build(format, 7001 + i * 104729, { archetype: 'stall' }));
			const problems = ctx.validator.validateTeam(team);
			if (!problems || !problems.length) legal++; else bad.push(`#${i} illegal: ${problems.slice(0, 2).join(' | ')}`);
			const c = stallChecks(ctx.dex, team, `#${i}`);
			if (!c.problems.length) stall++; else bad.push(`#${i} ${c.problems.join(', ')}: ${team.map(s => s.species).join(', ')}`);
			if (c.report.spikes) spikes++;
			const ids = team.flatMap(s => s.moves.map(toID));
			if (ids.includes('toxic')) toxic++;
			if (team.some(s => s.moves.map(toID).some(id => ['calmmind', 'irondefense', 'curse', 'bulkup', 'swordsdance', 'quiverdance', 'acidarmor', 'cosmicpower'].includes(id)))) wincon++;
			if (ids.some(id => ['healbell', 'aromatherapy', 'wish', 'junglehealing', 'lunarblessing'].includes(id))) cleric++;
			for (const s of team) species.set(s.species, (species.get(s.species) || 0) + 1);
			for (const h of c.hard) { const key = h.replace(/\(.*\)/g, '').slice(0, 40); hardCount.set(key, (hardCount.get(key) || 0) + 1); }
		}
		const ms = Math.round((Date.now() - t0) / N);
		for (const line of bad.slice(0, 8)) console.log(`     ${line}`);
		check(legal === N, `${format}: ${legal}/${N} stall teams legal`);
		check(stall === N, `${format}: ${stall}/${N} are real stall (4+ healing walls, rocks, removal or spinblock, a setup answer, status, no Choice or one-use item, judged stall)`);
		check(spikes >= N * 0.6, `${format}: Spikes or Toxic Spikes on ${spikes}/${N}`);
		check(toxic >= N * 0.9, `${format}: Toxic on ${toxic}/${N}`);
		check(wincon >= N * 0.3, `${format}: a setup wall on ${wincon}/${N} (the rest win on residual)`);
		check(cleric >= N * 0.3, `${format}: a cleric or Wish on ${cleric}/${N}`);
		check(species.size >= 18, `${format}: ${species.size} different Pokemon across the ${N} teams (variety)`);
		check(ms < 2500, `${format}: ${ms} ms a team`);
		const top = [...species].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, n]) => `${s} ${n}`).join(', ');
		console.log(`     most used: ${top}`);
		if (hardCount.size) console.log(`     other hard checklist issues: ${[...hardCount].map(([t, n]) => `${t} x${n}`).join('; ')}`);
		if (process.env.SHOW) console.log(Teams.export(Teams.unpack(builder.build(format, 99, { archetype: 'stall' }))));
	}

	// How often: the draw, at the configured share, with the builder's own rng shape.
	{
		const ctx = builder.context('gen9rpou');
		const share = stallShare('gen9rpou');
		let s = 12345, hits = 0;
		const rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
		for (let i = 0; i < 20000; i++) if (builder.wantsStall(ctx, {}, rng)) hits++;
		check(share >= 0.12 && share <= 0.15, `the default share is ${share}`);
		check(Math.abs(hits / 20000 - share) < 0.01, `stall drawn for ${(100 * hits / 20000).toFixed(1)}% of gen9rpou builds`);
		check(!builder.wantsStall(ctx, {}, () => 0, { archetype: 'balance' }), 'another archetype asked for rules stall out');
		check(builder.wantsStall(ctx, {}, () => 0.99, { archetype: 'stall' }), 'stall asked for is always stall');
		const was = process.env.PS_STALL_SHARE;
		process.env.PS_STALL_SHARE = 'gen9rpou=0.3,default=0.05';
		check(stallShare('gen9rpou') === 0.3 && stallShare('gen9ou') === 0.05, 'PS_STALL_SHARE sets it per format');
		process.env.PS_STALL_SHARE = '0';
		check(!builder.wantsStall(ctx, {}, () => 0), 'PS_STALL_SHARE=0 turns it off');
		if (was === undefined) delete process.env.PS_STALL_SHARE; else process.env.PS_STALL_SHARE = was;
		// Doubles and the formats with their own team rules keep the plain draw.
		check(!builder.wantsStall(builder.context('gen9doublesou'), {}, () => 0), 'no stall in doubles');
	}

	// The RP's stall Ace Trainer.
	{
		const Dex = require('../src/rp-dex')();
		const validator = TeamValidator.get(E.TRAINER_FORMAT);
		let s = 99;
		const rng = () => ((s = s * 16807 % 2147483647) / 2147483647);
		let ok = 0, legal = 0, runs = 0;
		const bad = [];
		for (const badges of [4, 5, 6, 7, 8]) {
			for (let i = 0; i < 4; i++) {
				runs++;
				const enc = E.rollTrainer({ place: null, badges, classId: 'stallace', rng });
				const r = SB.stallReport(Dex, enc.team);
				if (enc.style === 'stall' && enc.className === 'Ace Trainer' && r.ok && enc.team.length === E.BADGE_TIERS[badges].size) ok++;
				else bad.push(`${badges} badges: ${enc.style} ${JSON.stringify(r)}`);
				const problems = validator.validateTeam(enc.team);
				if (!problems) legal++; else bad.push(`${badges} badges illegal: ${problems.slice(0, 2).join(' | ')}`);
				const top = Math.max(...enc.team.map(m => m.level));
				const [, hi] = E.levelRange(badges, null);
				if (top !== hi) bad.push(`${badges} badges: ace at ${top}, not ${hi}`);
				const ev = badges * 10;
				if (enc.team.some(m => Object.values(m.evs).reduce((a, b) => a + b, 0) > 6 * ev)) bad.push(`${badges} badges: EVs over the badge budget`);
				if (enc.team.some(m => m.ivs.hp !== Math.min(31, 8 + badges * 3))) bad.push(`${badges} badges: IVs not the badge rule`);
			}
		}
		for (const line of bad.slice(0, 6)) console.log(`     ${line}`);
		check(ok === runs, `the stall Ace Trainer brings real stall at 4-8 badges (${ok}/${runs})`);
		check(legal === runs, `and it is legal in ${E.TRAINER_FORMAT} (${legal}/${runs})`);
		check(!bad.some(l => /ace at|EVs over|IVs not/.test(l)), 'levels, IVs and EVs follow the badge rules');
		const low = E.rollTrainer({ place: null, badges: 2, classId: 'stallace', rng });
		check(low.style !== 'stall' && low.team.length, 'below four badges it brings an ordinary team');
		// An ordinary Ace Trainer from six badges brings stall about one time in four.
		let stallAces = 0;
		for (let i = 0; i < 80; i++) if (E.rollTrainer({ place: null, badges: 7, classId: 'acetrainer', double: false, rng }).style === 'stall') stallAces++;
		check(stallAces >= 8 && stallAces <= 34, `an Ace Trainer at 7 badges brought stall ${stallAces}/80 times (${E.ACE_STALL_CHANCE * 100}% expected)`);
		let others = 0;
		for (let i = 0; i < 20; i++) if (E.rollTrainer({ place: null, badges: 7, classId: 'hiker', double: false, rng }).style === 'stall') others++;
		check(others === 0, 'no other class brings stall');
		if (process.env.SHOW) console.log(Teams.export(E.rollTrainer({ place: null, badges: 8, classId: 'stallace', rng }).team));
	}

	console.log(`\n${passed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
