'use strict';
/** Build a team for a wide slice of formats and re-validate every one. */
const { Dex, TeamValidator, Teams } = require('pokemon-showdown');
const { TeamBuilder } = require('../src/teambuilder');

const only = process.argv[2];
const tb = new TeamBuilder();

let formats = Dex.formats.all()
	.filter(f => f.effectType === 'Format' && f.exists)
	.filter(f => !f.team)                       // random formats need no team from us
	.filter(f => f.challengeShow !== false);
if (only) formats = formats.filter(f => f.id.includes(only));

let pass = 0, fail = 0, slow = 0;
const failures = [];
for (const f of formats) {
	const t0 = Date.now();
	try {
		const packed = tb.build(f.id);
		if (!packed) { console.log(`SKIP ${f.id}`); continue; }
		const team = Teams.unpack(packed);
		const problems = new TeamValidator(f.id).validateTeam(team);
		const ms = Date.now() - t0;
		if (ms > 4000) slow++;
		if (problems && problems.length) {
			fail++; failures.push([f.id, problems.slice(0, 2).join(' | ')]);
		} else {
			pass++;
			if (process.env.VERBOSE) console.log(`ok   ${f.id} (${ms}ms) ${team.map(p => p.species).join(',')}`);
		}
	} catch (e) {
		fail++; failures.push([f.id, String(e.message || e).slice(0, 140)]);
	}
}
console.log(`\n=== ${pass} passed, ${fail} failed, ${slow} slow (>4s), of ${pass + fail} formats`);
for (const [id, why] of failures) console.log(`FAIL ${id}: ${why}`);
process.exit(fail ? 1 : 0);
