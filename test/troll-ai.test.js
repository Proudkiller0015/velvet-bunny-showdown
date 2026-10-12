'use strict';
/**
 * The troll AI (ai.js trollChoice), played out: a Larper of each theme against
 * Champion, whole battles in the simulator. It must play its gimmick, every
 * turn it can, and never send a choice the battle refuses.
 *
 *   node test/troll-ai.test.js [games per theme]
 */
const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const E = require('../src/encounters');

const GAMES = Number(process.argv[2] || 4);
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function rng(seed) {
	let s = seed;
	return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const place = { name: 'Route 1', trainers: ['youngster', 'lass', 'hiker'], types: [] };
const GIMMICK = {
	explosion: /^(Explosion|Self-Destruct|Misty Explosion)$/,
	perish: /^(Perish Song|Mean Look|Block|Spider Web)$/,
	trap: /^(Mean Look|Block|Spider Web|Toxic|Leech Seed)$/,
	evasion: /^(Double Team|Minimize)$/,
	memento: /^(Memento|Healing Wish|Final Gambit|Destiny Bond)$/,
	splash: /^Splash$/,
	terrorist: /^(Explosion|Self-Destruct|Misty Explosion)$/,
};

async function play(troll, foe) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const bots = { p1: new BattleAI({ difficulty: troll.ai }), p2: new BattleAI({ difficulty: 'champion' }) };
	for (const bot of Object.values(bots)) bot.setFormat(troll.format);
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: troll.format })}\n` +
		`>player p1 ${JSON.stringify({ name: 'Troll', team: Teams.pack(troll.team) })}\n` +
		`>player p2 ${JSON.stringify({ name: 'Foe', team: Teams.pack(foe.team) })}\n`
	);
	const used = [];
	const by = [];
	const errors = [];
	let crashes = 0;
	let winner = null;
	const run = async who => {
		const state = new BattleState('x');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (line.startsWith('|error|')) errors.push(`${who} ${line}`);
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
						void streams[who].write('default');
					}
					continue;
				}
				if (who === 'p1' && parts[0] === 'move' && /^p1/.test(parts[1]) && !/\[from\]/.test(line)) {
					used.push(parts[2]);
					by.push({ who: parts[1].replace(/^p1[a-c]?: /, ''), move: parts[2], foeTrapped: !!Object.values(state.opponent).find(m => m && !m.fainted && m.trapped) });
				}
				if (who === 'p1' && parts[0] === 'win') winner = parts[1];
				state.line(parts);
			}
		}
	};
	await Promise.all([run('p1'), run('p2'), (async () => { for await (const c of streams.omniscient) void c; })()]);
	return { used, by, errors, crashes, winner };
}

(async () => {
	for (const theme of Object.keys(GIMMICK)) {
		const cls = theme === 'terrorist' ? E.findClass('terrorist') : { ...E.findClass('larper'), trollTheme: theme };
		let gimmicks = 0, moves = 0, errors = [], crashes = 0, games = 0, songs = 0, loose = 0, karpMoves = 0, splashes = 0;
		for (let seed = 1; seed <= GAMES; seed++) {
			const badges = 3 + seed % 5;
			const troll = E.rollTrainer({ place, badges, cls, rng: rng(seed * 31 + theme.length) });
			if (troll.theme !== (cls.trollTheme || theme)) continue;
			const foe = E.rollTrainer({ place, badges, cls: E.findClass('acetrainer'), double: false, rng: rng(seed) });
			const game = await play(troll, foe);
			// TROLL_TRACE=perish: every move the troll made, * where the foe was trapped.
			if (process.env.TROLL_TRACE === theme) console.log(`     ${troll.team.map(t => t.species).join('/')} vs ${foe.team.map(t => t.species).join('/')}
     ${game.by.map(b => `${b.who}:${b.move}${b.foeTrapped ? '*' : ''}`).join(' ')}`);
			games++;
			gimmicks += game.used.filter(m => GIMMICK[cls.trollTheme].test(m)).length;
			moves += game.used.length;
			errors.push(...game.errors);
			crashes += game.crashes;
			for (const b of game.by) {
				if (b.move === 'Perish Song') { songs++; if (!b.foeTrapped) loose++; }
				if (b.who === 'Magikarp') { karpMoves++; if (b.move === 'Splash') splashes++; }
			}
			if (seed === 1) console.log(`     ${theme}: ${game.used.slice(0, 12).join(', ')}${game.used.length > 12 ? ' ...' : ''}`);
		}
		check(games > 0 && crashes === 0 && errors.length === 0, `${theme}: ${games} games, no crash and no refused choice (${errors.slice(0, 2).join(' ')})`);
		const share = moves ? gimmicks / moves : 0;
		if (theme === 'splash') {
			// The Gyarados at the back plays for real; every Magikarp only ever Splashes.
			check(karpMoves > 0 && splashes === karpMoves, `splash: the Magikarp only Splash (${splashes}/${karpMoves})`);
		} else if (theme === 'perish') {
			// Perish Song only on something that can't leave.
			check(songs > 0 && loose === 0, `perish: sung ${songs} times in ${games} games, never at a foe that could leave (${loose})`);
		} else {
			check(share >= 0.25, `${theme}: the gimmick is ${Math.round(share * 100)}% of its moves (${gimmicks}/${moves})`);
		}
	}
	// Not offered to players picking a bot's difficulty on the site.
	check(!BattleAI.difficulties().includes('troll'), 'the troll AI is not in the site bots\' difficulty list');
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
