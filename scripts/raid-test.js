'use strict';
/**
 * Shared raids, end to end in this process (src/raid.js, config/custom-formats.js
 * installSharedRaid): two stand-in people (the AI plays them) and two NPC raiders
 * against one boss, then a trio. Checks the HP really is shared, the bosses
 * Dynamax for three turns only, nobody faints a boss, and the raid finishes.
 *
 *   npm run setup && node scripts/raid-test.js [games]
 */
const { BattleStream, getPlayerStreams } = require('pokemon-showdown/dist/sim/battle-stream');
const { Teams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const R = require('../src/raid');
const E = require('../src/encounters');
const Dex = require('../src/rp-dex')();

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('FAIL', what); } };
const FORMAT = ['gen9rpraidbattle', 'gen9rpraidbattleduo', 'gen9rpraidbattletrio'];

function bossTeam(names) {
	return Teams.pack(names.map(n => { const set = E.wildSet(Dex.species.get(n), 200); set.level = 200; return set; }));
}

/** One person's battle, the AI standing in for them. Resolves with what happened in it. */
async function person(name, pokemon, format, bossName, team) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const set = E.trainerSet(Dex.species.get(pokemon), 100, 8, Math.random);
	set.level = 100;
	const ai = { p1: new BattleAI({ difficulty: 'hard' }), p2: new BattleAI({ difficulty: 'hard' }) };
	ai.p1.setFormat(format); ai.p2.setFormat(format);
	void streams.omniscient.write(`>start ${JSON.stringify({ formatid: format })}\n` +
		`>player p1 ${JSON.stringify({ name, team: Teams.pack([set]) })}\n>player p2 ${JSON.stringify({ name: bossName, team })}\n`);
	const seen = { dmaxStart: 0, dmaxEnd: 0, bossFaint: 0, turns: 0, winner: null, sethp: 0, errors: [] };
	const play = async who => {
		const state = new BattleState('battle-' + format + '-t');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { seen.errors.push(parts.slice(1).join('|')); void streams[who].write('default'); continue; }
				if (parts[0] !== 'request') { state.line(parts); continue; }
				const raw = parts.slice(1).join('|');
				if (!raw) continue;
				const request = JSON.parse(raw);
				if (request.wait) continue;
				let choice = 'default';
				try { choice = ai[who].decide(request, state) || 'default'; } catch (e) { seen.errors.push('ai: ' + e.message); }
				// Once a boss is worn out, a person throws a ball.
				const raid = R.forRaider(name);
				if (who === 'p1' && raid && raid.bosses.some(b => b.down) && request.active) choice = 'ball ultra allow';
				void streams[who].write(choice);
			}
		}
	};
	const watch = (async () => {
		for await (const chunk of streams.omniscient) {
			for (const line of chunk.split('\n')) {
				if (/^\|-start\|p2.*\|Dynamax/.test(line)) seen.dmaxStart++;
				if (/^\|-end\|p2.*\|Dynamax/.test(line)) seen.dmaxEnd++;
				if (/^\|faint\|p2/.test(line)) seen.bossFaint++;
				if (/^\|-sethp\|/.test(line)) seen.sethp++;
				if (line.startsWith('|turn|')) seen.turns = +line.slice(6);
				if (line.startsWith('|win|')) seen.winner = line.slice(5);
				if (line.startsWith('|tie')) seen.winner = 'tie';
				if (/^\|error\|/.test(line) || /\|-message\|.*crash/i.test(line)) seen.errors.push(line);
			}
		}
	})();
	await Promise.all([play('p1'), play('p2'), watch]);
	return seen;
}

async function raid(bosses, label) {
	const id = 'test-' + label;
	const format = FORMAT[bosses.length - 1];
	const bossName = `Raid ${bosses[0]}`.slice(0, 18);
	const r = R.create({ id, bosses: bosses.map(species => ({ species })), raiders: [{ name: 'Tester One', pokemon: 'Garchomp' }, { name: 'Tester Two', pokemon: 'Metagross' }] });
	ok(r.raiders.length === 4 && r.raiders.filter(x => x.npc).length === 2, `${label}: two NPCs fill the empty seats`);
	const team = bossTeam(bosses);
	const npcs = r.raiders.filter(x => x.npc).map(x => R.runNpc(r, x, { format, bossName, bossTeam: team }));
	const people = await Promise.all([person('Tester One', 'Garchomp', format, bossName, team), person('Tester Two', 'Metagross', format, bossName, team)]);
	await Promise.race([Promise.all(npcs), new Promise(done => setTimeout(done, 20000))]);
	for (const [i, p] of people.entries()) {
		console.log(`  ${label} person ${i + 1}: ${p.turns} turns, winner ${p.winner}, Dynamax ${p.dmaxStart} on / ${p.dmaxEnd} off, sethp ${p.sethp}, errors ${p.errors.length}${p.errors.length ? ' ' + p.errors.slice(0, 2).join(' / ') : ''}`);
		ok(p.dmaxStart === bosses.length, `${label}: every boss Dynamaxes once (${p.dmaxStart})`);
		ok(p.bossFaint === 0, `${label}: no boss ever faints`);
		ok(p.winner !== null, `${label}: the battle finishes`);
		ok(!p.errors.length, `${label}: no errors`);
	}
	ok(people.some(p => p.sethp > 0) || people.every(p => p.turns <= 1), `${label}: HP was synced between battles`);
	console.log(`  ${label}: raid ${r.status}; bosses ${r.bosses.map(b => `${b.species} ${Math.round(b.hp * 100)}%${b.caughtBy ? ' caught by ' + b.caughtBy : ''}`).join(', ')}; ` +
		r.raiders.map(x => `${x.name} ${x.state} ${Math.round(x.dealt * 100)}%`).join(', '));
	ok(r.status !== 'on' || r.raiders.every(x => x.state !== 'fighting'), `${label}: the raid ends`);
}

(async () => {
	await raid(['Rayquaza-Mega'], 'solo');
	await raid(['Groudon', 'Kyogre', 'Rayquaza'], 'trio');
	console.log(`raid: ${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
	process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
