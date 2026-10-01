'use strict';
/**
 * Play a saved battle back through the AI: what would it choose at each turn now?
 *
 *   node scripts/replay-ai.js <replay.json> [p1|p2] [difficulty] [--turns=3,14,27]
 *
 * Re-simulates the battle from the replay's input log (the same seed, so the same
 * battle), feeds one side's view to a fresh BattleAI exactly as src/bot.js does, and
 * at every request prints the AI's choice beside the one that was actually played.
 * For studying a blunder: change src/ai.js, run this again, and see whether the
 * turn in question comes out differently (owner, 1 Oct 2026: a stall game the bot
 * threw - Calm Mind into Gyro Ball, Strength Sap under Toxic, staying in on Bolt Beak).
 */
const fs = require('fs');
const BattleStreams = require('pokemon-showdown/dist/sim/battle-stream');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

const file = process.argv[2];
const side = process.argv[3] || 'p1';
const difficulty = process.argv[4] || 'stockfish';
const only = (process.argv.find(a => a.startsWith('--turns=')) || '').slice(8).split(',').filter(Boolean).map(Number);
if (!file) { console.error('usage: node scripts/replay-ai.js <replay.json> [p1|p2] [difficulty] [--turns=a,b]'); process.exit(1); }
const replay = JSON.parse(fs.readFileSync(file, 'utf8'));
const inputs = String(replay.inputlog || '').split('\n').filter(Boolean);
const formatId = String(replay.format || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
	const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
	const state = new BattleState('battle-' + formatId + '-1');
	const ai = new BattleAI({ difficulty });
	ai.setFormat(formatId);
	try {
		const { TeamBuilder } = require('../src/teambuilder');
		const usage = new TeamBuilder().usage.get(formatId);
		if (usage) ai.setUsage(usage);
	} catch (e) { /* no usage: the AI guesses as it does for a new format */ }
	state.myPlayer = side;
	const logs = [];
	ai.log = (...a) => logs.push(a.join(' '));

	let request = null, turn = 0;
	void (async () => {
		for await (const chunk of streams[side]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'request') { try { request = JSON.parse(parts.slice(1).join('|')); } catch (e) { /* empty */ } continue; }
				if (parts[0] === 'turn') turn = Number(parts[1]);
				if (parts[0] === 'player') {
					const name = (parts[2] || '').trim();
					if (parts[1] === side) state.myName = name;
				}
				state.line(parts);
			}
		}
	})();

	for (const input of inputs) {
		const mine = input.startsWith(`>${side} `);
		if (mine) {
			await sleep(40);
			const played = input.slice(side.length + 2);
			if (request && !request.wait && !request.teamPreview) {
				logs.length = 0;
				let choice;
				try { choice = ai.decide(request, state); } catch (e) { choice = 'ERROR ' + e.message; }
				const active = request.side.pokemon.find(p => p.active);
				const name = m => { const k = /^move (\d)/.exec(m); return k && request.active && request.active[0].moves[k[1] - 1] ? `${m} (${request.active[0].moves[k[1] - 1].move})` : m; };
				const sw = m => { const k = /^switch (\d)/.exec(m); return k ? `${m} (${request.side.pokemon[k[1] - 1].details.split(',')[0]})` : name(m); };
				if (!only.length || only.includes(turn)) {
					const norm = m => { const k = /^move (d)(.*)$/.exec(m); return k && request.active && request.active[0].moves[k[1] - 1] ? 'move ' + request.active[0].moves[k[1] - 1].id + k[2] : m; };
					const same = norm(String(choice).split('|')[0].trim()) === norm(played.trim());
					console.log(`turn ${String(turn).padStart(2)} ${String(active ? active.details.split(',')[0] : '?').padEnd(12)} ${active ? active.condition.padEnd(11) : ''} played: ${sw(played).padEnd(28)} now: ${sw(String(choice))}${same ? '' : '   <-- differs'}`);
					if (only.length) for (const l of logs) console.log('      ' + l);
				}
			}
		}
		streams.omniscient.write(input);
		if (mine) await sleep(10);
	}
	await sleep(100);
	process.exit(0);
})();
