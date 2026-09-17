'use strict';
/**
 * The bot's own teams against a fixed one, both sides played by the AI.
 *
 * The ladder bot lost twenty games in a row to the owner's team, and "the teams
 * are fine on the checklist" is not an answer to that. This plays the builder's
 * teams against a team from a file, so a change to team building can be judged
 * on games rather than on rules it satisfies.
 *
 *   node test/vs-team.js data/teams/owner.json 40 gen9rpou
 *   node test/vs-team.js data/teams/owner.json 40 gen9rpou champion
 *
 * The file is a PokePaste-style export or a packed team.
 */

const fs = require('fs');
const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const { BattleAI } = require('./../src/ai');
const { BattleState } = require('./../src/battle');
const { TeamBuilder } = require('./../src/teambuilder');

const FILE = process.argv[2];
const GAMES = Number(process.argv[3]) || 40;
const FORMAT = process.argv[4] || 'gen9rpou';
const DIFFICULTY = process.argv[5] || 'stockfish';
const OWN_FILE = process.argv[6] || null;   // a file here plays team-vs-team instead of builder-vs-team
if (!FILE) { console.error('usage: node test/vs-team.js <team file> [games] [format] [difficulty]'); process.exit(1); }

const raw = fs.readFileSync(FILE, 'utf8').trim();
const FIXED = raw.startsWith('[') ? Teams.pack(JSON.parse(raw)) : /\|/.test(raw.split('\n')[0]) ? raw : Teams.pack(Teams.import(raw));

async function playGame(builder, botFirst) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const bot = { side: botFirst ? 'p1' : 'p2' };
	const ai = { p1: new BattleAI({ difficulty: DIFFICULTY }), p2: new BattleAI({ difficulty: DIFFICULTY }) };
	for (const k of ['p1', 'p2']) ai[k].setFormat(FORMAT);
	const teams = { [bot.side]: builder ? builder.build(FORMAT) : global.OWN, [bot.side === 'p1' ? 'p2' : 'p1']: FIXED };
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: FORMAT })}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: teams.p1 })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: teams.p2 })}\n`
	);
	let errors = 0;
	const run = async who => {
		const state = new BattleState('t');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { errors++; continue; }
				if (parts[0] === 'request') {
					const rest = parts.slice(1).join('|');
					if (!rest) continue;
					let choice = null;
					try { choice = ai[who].decide(JSON.parse(rest), state); } catch (e) { errors++; choice = 'default'; }
					if (choice) void streams[who].write(choice);
					continue;
				}
				state.line(parts);
			}
		}
	};
	let winner = null;
	const watch = (async () => {
		for await (const chunk of streams.omniscient) {
			for (const line of chunk.split('\n')) {
				if (line.startsWith('|win|')) winner = line.slice(5).trim();
				if (line.startsWith('|tie')) winner = 'tie';
			}
		}
	})();
	await Promise.all([run('p1'), run('p2'), watch]);
	return { botWon: winner === (bot.side === 'p1' ? 'P1' : 'P2'), errors };
}

(async () => {
	const own = OWN_FILE ? fs.readFileSync(OWN_FILE, 'utf8').trim() : null;
	global.OWN = own ? (own.startsWith('[') ? Teams.pack(JSON.parse(own)) : Teams.pack(Teams.import(own))) : null;
	const builder = OWN_FILE ? null : new TeamBuilder();
	if (builder) { try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ } }
	let wins = 0, played = 0, errors = 0;
	for (let i = 0; i < GAMES; i++) {
		try {
			const r = await playGame(builder, i % 2 === 0);
			played++;
			if (r.botWon) wins++;
			errors += r.errors;
		} catch (e) { console.log('crash:', String(e.message || e).slice(0, 120)); }
	}
	const rate = played ? (wins / played) * 100 : 0;
	const se = played ? Math.sqrt(0.25 / played) * 196 : 0;
	console.log(`${DIFFICULTY} bot teams vs ${FILE} [${FORMAT}]: won ${wins}/${played} (${rate.toFixed(0)}% +/- ${se.toFixed(0)}), errors ${errors}`);
})();
