'use strict';
/**
 * Does the bot know what this server added, and does it stay legal knowing it?
 *
 *   node test/ourstuff.test.js
 *
 * Two failures are possible here and they pull in opposite directions.
 *
 * The bot could ignore everything this server invented - which is what it did
 * before, because its sets come from Smogon analyses and usage statistics, and
 * neither of those has ever heard of Jungle Rush. A Simisage that never brings
 * the move the whole family was given is the plainest possible sign that the
 * additions are decorative.
 *
 * Or it could go the other way and put them on everything, which is worse: a
 * team of Pokemon holding our moves because they are ours rather than because
 * they are good is both weaker and obviously artificial.
 *
 * So this checks that it happens, that it does not happen too much, and - the
 * part that would actually break a battle - that every team it builds is still
 * legal for the format it was built for.
 */

const { Dex, TeamValidator, Teams } = require('pokemon-showdown');
const { TeamBuilder } = require('../src/teambuilder');

const FORMAT = process.argv[2] || 'gen9rpbattle';
const RUNS = Number(process.argv[3]) || 30;

const builder = new TeamBuilder();

/*
 * Fetched first, the way the bot does it.
 *
 * Without this the builder has no Smogon sets and no usage table for the
 * format and falls through to "anything legal", which draws Hoppip into an OU
 * team and looks like a bug in the draw. It is not: it is a test that skipped
 * the step every real caller takes.
 */
(async () => {
try { await builder.prefetch(FORMAT); } catch (e) { /* offline: bundled data still works */ }
const ourMoves = new Set(Dex.moves.all().filter(m => m.exists && m.num < 0).map(m => m.name));
const ourAbilities = new Set(Dex.abilities.all().filter(a => a.exists && a.num < 0).map(a => a.name));

let pass = 0, bad = 0;
const problems = [];
let pokemonSeen = 0, withOurMove = 0, withOurAbility = 0;
const speciesSeen = new Map();

for (let i = 0; i < RUNS; i++) {
	const packed = builder.build(FORMAT);
	if (!packed) { problems.push(`build ${i} produced nothing`); bad++; continue; }
	const team = Teams.unpack(packed);
	const said = new TeamValidator(FORMAT).validateTeam(team);
	if (said) { problems.push(`build ${i}: ${said.join('; ')}`); bad++; } else pass++;

	for (const set of team) {
		pokemonSeen++;
		speciesSeen.set(set.species, (speciesSeen.get(set.species) || 0) + 1);
		if ((set.moves || []).some(move => ourMoves.has(Dex.moves.get(move).name))) withOurMove++;
		if (set.ability && ourAbilities.has(Dex.abilities.get(set.ability).name)) withOurAbility++;
	}
}

const share = n => Math.round(n / Math.max(1, pokemonSeen) * 1000) / 10;
console.log(`${FORMAT}: ${RUNS} teams, ${pokemonSeen} Pokemon`);
console.log(`  legal            ${pass}/${RUNS}`);
console.log(`  with one of our moves      ${withOurMove} (${share(withOurMove)}%)`);
console.log(`  with one of our abilities  ${withOurAbility} (${share(withOurAbility)}%)`);

const top = [...speciesSeen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('  most drawn: ' + top.map(([name, n]) => `${name} x${n}`).join(', '));

if (problems.length) {
	console.log('\nproblems:');
	for (const line of problems.slice(0, 10)) console.log('  ' + line);
}

// Legality is the hard requirement. The rest is a report, not a threshold: how
// often our things turn up depends on who the draw happened to pick, and a
// pass/fail on a random draw would be a flaky test rather than a useful one.
if (bad) {
	console.log(`\nFAIL: ${bad} of ${RUNS} teams were not legal`);
	process.exit(1);
}
console.log('\nevery team legal');
})();
