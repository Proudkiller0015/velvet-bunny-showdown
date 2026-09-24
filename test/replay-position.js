'use strict';
/**
 * Replay a saved battle's input log through the simulator and ask the current
 * AI what it would choose at each of the bot's requests, with the state it
 * would have had live (the same side view, fed line by line).
 *
 *   const { replayPositions } = require('./replay-position');
 *   const seen = await replayPositions('gen9rpou-6-tlvwbi', { upTo: 25 });
 *   // seen[turn] = { request, state, ai, played, decide() }
 *
 * The battle always follows what was really played (the input log), so every
 * position is the one the bot met; `decide()` asks the AI on a copy of it.
 */

const path = require('path');
const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

const clone = v => {
	if (v instanceof Set) return new Set([...v].map(clone));
	if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, clone(x)]));
	if (Array.isArray(v)) return v.map(clone);
	if (v && typeof v === 'object') {
		const o = Object.create(Object.getPrototypeOf(v));
		for (const k of Object.keys(v)) o[k] = clone(v[k]);
		return o;
	}
	return v;
};

/**
 * @param {string} id replay id under data/replays
 * @param {{ side?: string, difficulty?: string, upTo?: number, cfg?: object }} opts
 * @returns {Promise<Object<number, {request, state, ai, played, decide: Function}>>}
 */
async function replayPositions(id, opts = {}) {
	const replay = require(path.join(__dirname, '..', 'data', 'replays', `${id}.json`));
	const side = opts.side || 'p1';
	const upTo = opts.upTo || Infinity;
	const lines = String(replay.inputlog).split('\n').filter(Boolean);
	const start = lines.find(l => l.startsWith('>start '));
	const players = lines.filter(l => l.startsWith('>player '));
	const format = JSON.parse(start.slice(7)).formatid;
	// Each side's choices, in order.
	const choices = { p1: [], p2: [] };
	for (const l of lines) {
		const m = /^>(p[12]) (.*)$/.exec(l);
		if (m) choices[m[1]].push(m[2]);
	}
	const foe = side === 'p1' ? 'p2' : 'p1';

	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	void streams.omniscient.write(`${start}\n${players.join('\n')}\n`);
	void (async () => { for await (const chunk of streams.omniscient) void chunk; })();

	const state = new BattleState(`battle-${format}-replay`);
	state.myName = (replay.players || [])[side === 'p1' ? 0 : 1];
	const ai = new BattleAI({ difficulty: opts.difficulty || 'stockfish', cfg: opts.cfg });
	ai.setFormat(format);
	const seen = {};
	let turn = 0;
	const next = { p1: 0, p2: 0 };
	const send = who => { const c = choices[who][next[who]++]; if (c !== undefined) void streams.omniscient.write(`>${who} ${c}\n`); };

	// The foe only answers; its requests are answered from the log as they come.
	void (async () => {
		for await (const chunk of streams[foe]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|request|')) continue;
				const req = JSON.parse(line.slice(9));
				if (req.wait) continue;
				send(foe);
			}
		}
	})();

	await new Promise(resolve => {
		const timer = setTimeout(resolve, 30000);
		void (async () => {
			for await (const chunk of streams[side]) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|')) continue;
					const parts = line.slice(1).split('|');
					if (parts[0] === 'request') {
						const req = JSON.parse(parts.slice(1).join('|'));
						if (req.wait) continue;
						if (req.teamPreview) { send(side); continue; }
						// The live AI saw every request, so this one does too (it keeps memory).
						const snap = { request: clone(req), state: clone(state) };
						const choice = ai.decide(req, state);
						const played = choices[side][next[side]];
						const key = req.forceSwitch ? `${turn}f` : turn;
						seen[key] = { ...snap, ai, choice, played, decide: (o = {}) => {
							const fresh = new BattleAI({ difficulty: o.difficulty || opts.difficulty || 'stockfish', cfg: o.cfg || opts.cfg, log: o.log });
							fresh.setFormat(format);
							return fresh.decide(clone(snap.request), clone(snap.state));
						} };
						if (turn >= upTo) { clearTimeout(timer); resolve(); return; }
						send(side);
						continue;
					}
					if (parts[0] === 'turn') turn = +parts[1];
					if (parts[0] === 'win' || parts[0] === 'tie') { clearTimeout(timer); state.line(parts); resolve(); return; }
					if (parts[0] === 'player' && (parts[2] || '') === state.myName) state.myPlayer = parts[1];
					state.line(parts);
				}
			}
		})();
	});
	return seen;
}

/** A choice as the input log writes it: "move 2 terastallize" -> "move imperialtorrent terastallize". */
function named(request, choice) {
	const m = /^move (\d+)(.*)$/.exec(choice || '');
	if (!m || !request.active) return choice;
	const mv = request.active[0].moves[+m[1] - 1];
	return mv ? `move ${mv.id}${m[2]}` : choice;
}

module.exports = { replayPositions, named };

if (require.main === module) {
	// node test/replay-position.js gen9rpou-6-tlvwbi [upTo]: what the AI picks now against what was played.
	(async () => {
		const seen = await replayPositions(process.argv[2], { upTo: +process.argv[3] || Infinity });
		for (const [t, s] of Object.entries(seen)) {
			const now = named(s.request, s.choice);
			const mark = now === s.played ? '  ' : '* ';
			const me = s.request.side.pokemon.find(p => p.active);
			console.log(`${mark}T${t}  ${me ? me.details.split(',')[0] + ' ' + me.condition : ''}  now: ${now}   then: ${s.played}`);
		}
		process.exit(0);
	})();
}
