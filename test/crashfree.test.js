'use strict';
/** Play RP OU games until the AI throws, and print where. */
const ROOT = 'C:/Users/Sam_0/Documents/Project/showdown/';
const { BattleStream, getPlayerStreams } = require(ROOT + 'node_modules/pokemon-showdown');
const { BattleAI } = require(ROOT + 'src/ai');
const { BattleState } = require(ROOT + 'src/battle');
const { TeamBuilder } = require(ROOT + 'src/teambuilder');

const FORMAT = process.argv[2] || 'gen9rpou';
const GAMES = Number(process.argv[3] || 10);

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline */ }

	let crashes = 0;
	const stacks = [];

	for (let attempt = 0; attempt < GAMES; attempt++) {
		const stream = new BattleStream();
		const streams = getPlayerStreams(stream);
		const bots = {
			p1: new BattleAI({ difficulty: 'champion' }),
			p2: new BattleAI({ difficulty: 'champion' }),
		};
		for (const bot of Object.values(bots)) bot.setFormat(FORMAT);

		void streams.omniscient.write(
			`>start ${JSON.stringify({ formatid: FORMAT })}\n` +
			`>player p1 ${JSON.stringify({ name: 'P1', team: builder.build(FORMAT) })}\n` +
			`>player p2 ${JSON.stringify({ name: 'P2', team: builder.build(FORMAT) })}\n`
		);

		const run = async who => {
			const state = new BattleState('x');
			state.myPlayer = who;
			for await (const chunk of streams[who]) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|')) continue;
					const parts = line.slice(1).split('|');
					if (parts[0] === 'request') {
						const raw = parts.slice(1).join('|');
						if (!raw) continue;
						try {
							const choice = bots[who].decide(JSON.parse(raw), state);
							if (choice) void streams[who].write(choice);
						} catch (e) {
							crashes++;
							if (stacks.length < 3) stacks.push(e.stack);
							void streams[who].write('default');
						}
						continue;
					}
					state.line(parts);
				}
			}
		};

		await Promise.all([
			run('p1'), run('p2'),
			(async () => { for await (const chunk of streams.omniscient) void chunk; })(),
		]);
	}

	console.log(`${FORMAT}: ${GAMES} games, ${crashes} turns the bot could not answer`);
	for (const stack of stacks) {
		console.log('---');
		console.log(String(stack).split(String.fromCharCode(10)).slice(0, 7).join(String.fromCharCode(10)));
	}
	if (crashes) {
		console.log('FAIL');
		process.exit(1);
	}
	console.log('no crashes');
})();
