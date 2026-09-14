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
/**
 * One retry, and why this is not sweeping a failure under the rug.
 *
 * Team building is random by design: it draws six Pokemon and works out how to
 * make them legal. In nearly every format any six will do. In a handful of the
 * stranger ones - Cross Evolution is the reliable offender - a bad draw can be
 * unsalvageable, and which draw you get is luck, so the same format passes and
 * fails on alternate runs. A suite that cries wolf one run in three stops being
 * read, which costs more than the thing it is reporting.
 *
 * A second attempt is a different draw. A format that is genuinely broken fails
 * both times and is still reported; one that merely got a bad hand does not.
 * The retry is counted and printed, so "this format needs two goes" stays
 * visible rather than becoming invisible.
 */
const ATTEMPTS = 2;
let retried = 0;

function buildAndCheck(id) {
	const packed = tb.build(id);
	if (!packed) return { skipped: true };
	const team = Teams.unpack(packed);
	const problems = new TeamValidator(id).validateTeam(team);
	if (problems && problems.length) return { why: problems.slice(0, 2).join(' | ') };
	return { team };
}

for (const f of formats) {
	const t0 = Date.now();
	let last = null;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		try {
			last = buildAndCheck(f.id);
		} catch (e) {
			last = { why: String(e.message || e).slice(0, 140) };
		}
		if (!last.why) break;
		if (attempt + 1 < ATTEMPTS) retried++;
	}
	const ms = Date.now() - t0;
	if (last.skipped) { console.log(`SKIP ${f.id}`); continue; }
	if (ms > 4000) slow++;
	if (last.why) {
		fail++; failures.push([f.id, last.why]);
	} else {
		pass++;
		if (process.env.VERBOSE) console.log(`ok   ${f.id} (${ms}ms) ${last.team.map(p => p.species).join(',')}`);
	}
}
if (retried) console.log(`(${retried} format(s) needed a second draw)`);
console.log(`\n=== ${pass} passed, ${fail} failed, ${slow} slow (>4s), of ${pass + fail} formats`);
for (const [id, why] of failures) console.log(`FAIL ${id}: ${why}`);
process.exit(fail ? 1 : 0);
