'use strict';
/**
 * The Broken Pact, played out in a real battle.
 *
 *   node test/brokenpact.test.js
 *
 * A Nuzleaf holding one does not faint: it comes back at once as Nuzleaf-SOLD,
 * at full HP, with the item spent. That cancels a knockout half way through the
 * engine's own faint handling, which is exactly the sort of thing that leaves a
 * battle quietly waiting for a switch that is never coming - so this plays the
 * whole sequence rather than trusting the item's code to be right:
 *
 *   1. the Nuzleaf is put to zero and does NOT faint;
 *   2. it is back on the field as Nuzleaf-SOLD;
 *   3. nobody is asked to send anything out, and it still takes its move that
 *      same turn;
 *   4. the battle is still playable and still reaches a result;
 *   5. the SOLD forme is not immortal - knocked out later, that IS a faint, and
 *      a switch is asked for then;
 *   6. and the RP counts the sale as a knockout (src/rp-server.js), so the
 *      Pokemon goes into the box fainted and needs a Centre.
 */

const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const rp = require('../src/rp-server');

let passed = 0;
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (ok) passed++; else failed++; };

const SELLER = Teams.pack(Teams.import('Nuzleaf @ Broken Pact\nAbility: Chlorophyll\nLevel: 50\n- Razor Leaf\n\nPidgey\nAbility: Keen Eye\nLevel: 50\n- Tackle'));
const BUYER = Teams.pack(Teams.import('Machamp\nAbility: Guts\nLevel: 100\n- Close Combat\n\nSnorlax\nAbility: Immunity\nLevel: 100\n- Body Slam'));

async function play() {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const lines = [];
	const asks = { p1: 0 };

	/*
	 * Both sides play themselves, and both loops start before anything is
	 * awaited: a side whose requests nobody reads never answers, and the battle
	 * then sits at team preview until the timeout - which reads exactly like the
	 * item being broken when it is nothing of the sort.
	 */
	const drive = (side, reader) => {
		void (async () => {
			for await (const chunk of reader) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|request|')) continue;
					const req = JSON.parse(line.slice(9));
					if (req.forceSwitch && side === 'p1') asks.p1++;
					if (req.teamPreview) void streams.omniscient.write(`>${side} team 12\n`);
					else if (req.forceSwitch) void streams.omniscient.write(`>${side} switch 2\n`);
					else if (!req.wait) void streams.omniscient.write(`>${side} move 1\n`);
				}
			}
		})();
	};

	void streams.omniscient.write([
		`>start ${JSON.stringify({ formatid: 'gen9rpbattle' })}`,
		`>player p1 ${JSON.stringify({ name: 'Seller', team: SELLER })}`,
		`>player p2 ${JSON.stringify({ name: 'Buyer', team: BUYER })}`,
		'',
	].join('\n'));
	drive('p1', streams.p1);
	drive('p2', streams.p2);

	await new Promise(resolve => {
		const timer = setTimeout(resolve, 20000);
		void (async () => {
			for await (const chunk of streams.omniscient) {
				for (const line of chunk.split('\n')) lines.push(line);
				if (lines.some(l => l.startsWith('|win|'))) { clearTimeout(timer); resolve(); return; }
			}
		})();
	});
	return { lines, asks };
}

(async () => {
	const { lines, asks } = await play();
	const log = lines.join('\n');
	if (process.env.SHOWLOG) console.log(lines.filter(l => l && !l.startsWith('|t:')).join('\n'));

	check(/\|-enditem\|p1a: Nuzleaf\|Broken Pact/.test(log), 'the Broken Pact is spent');
	check(/\|detailschange\|p1a: Nuzleaf\|Nuzleaf-SOLD/.test(log), 'it comes back as Nuzleaf-SOLD');

	const soldAt = lines.findIndex(l => l.includes('Broken Pact'));
	check(!lines.slice(0, soldAt).some(l => /^\|faint\|p1a:/.test(l)), 'the Nuzleaf never faints on the way there');
	check(lines.slice(soldAt).some(l => /^\|move\|p1a: Nuzleaf\|/.test(l)), 'it still takes its move on the turn it was sold');

	/*
	 * A switch is asked for once per real faint - except the last one, which
	 * ends the battle: there is nothing left to send out and nothing to ask.
	 */
	const faints = lines.filter(l => /^\|faint\|p1a:/.test(l)).length;
	const wipedOut = /\|win\|Buyer/.test(log);
	const expected = Math.max(0, faints - (wipedOut ? 1 : 0));
	check(asks.p1 === expected,
		`p1 is asked to send something out once per faint that is not the last (${asks.p1} asks, ${faints} faints)`);
	check(/\|win\|/.test(log), 'the battle reaches a result rather than hanging');
	check(faints >= 1, 'Nuzleaf-SOLD is not immortal - it faints like anything else');

	// And the RP hears about the sale, though the battle never called it a faint.
	const fainted = rp.resultFromLog({ userid: 'seller', showdown: 'Seller' }, lines, 'seller').fainted;
	check(fainted.some(p => p.species === 'Nuzleaf'),
		`the sold Nuzleaf is reported to Discord as knocked out (${JSON.stringify(fainted)})`);

	console.log(failed ? `\n${failed} failed` : `\nall ${passed} passed`);
	process.exit(failed ? 1 : 0);
})();
