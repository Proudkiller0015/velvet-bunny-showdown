'use strict';
/**
 * Eternamax in place of Eternatus's Dynamax (10 Oct 2026).
 *
 *   node test/eternamax.test.js
 *
 * An Eternatus flagged Gigantamax (AG and up only) gets the Ultra Burst action, which
 * turns it into Eternatus-Eternamax for the rest of the battle. It is the side's Dynamax:
 * using either spends the other.
 */

const { BattleStream, getPlayerStreams, Teams, TeamValidator } = require('pokemon-showdown');

let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };

const ETERNATUS = (gmax) => `Eternatus @ Life Orb
Ability: Pressure
Level: 100
${gmax ? 'Gigantamax: Yes\n' : ''}EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Dynamax Cannon
- Flamethrower
- Sludge Bomb
- Recover`;
const MATE = `Glaceon @ Leftovers
Ability: Ice Body
Level: 100
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Blizzard
- Freeze-Dry
- Protect
- Calm Mind`;
const FOE = `Blissey @ Leftovers
Ability: Natural Cure
Level: 100
EVs: 252 HP / 252 Def
Bold Nature
- Soft-Boiled
- Seismic Toss
- Protect
- Toxic`;

// Validation: AG and RP Battle yes, Ubers and below no; the flag survives validation.
{
	const team = Teams.import(ETERNATUS(true));
	check(TeamValidator.get('gen9rpag').validateTeam(team) === null && team[0].gigantamax === true, 'RP AG accepts an Eternamax Eternatus and keeps the flag');
	check(TeamValidator.get('gen9rpbattle').validateTeam(Teams.import(ETERNATUS(true))) === null, 'RP Battle accepts it');
	check(/AG only/.test(String(TeamValidator.get('gen9rpubers').validateTeam(Teams.import(ETERNATUS(true))))), 'RP Ubers refuses it, saying why');
	check(TeamValidator.get('gen9rpubers').validateTeam(Teams.import(ETERNATUS(false))) === null, 'a plain Eternatus is still fine in Ubers');
}

/** Play: p1's choices per turn, return p1's requests and the log. */
async function play(p1Team, p1Choices, format = 'gen9rpag') {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const requests = [];
	let log = '';
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: format, seed: [1, 2, 3, 4] })}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: Teams.pack(Teams.import(p1Team)) })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: Teams.pack(Teams.import(FOE)) })}\n`
	);
	void (async () => { for await (const chunk of streams.p2) if (chunk.includes('|request|')) void streams.p2.write(chunk.includes('"teamPreview":true') ? 'team 1' : 'move 3'); })();
	void (async () => { for await (const chunk of streams.omniscient) log += chunk; })();
	let turn = 0;
	for await (const chunk of streams.p1) {
		const req = chunk.split('\n').find(l => l.startsWith('|request|'));
		if (!req) continue;
		const r = JSON.parse(req.slice(9));
		if (r.teamPreview) { void streams.p1.write('team 12'); continue; }
		if (r.wait || !r.active) continue;
		requests.push(r);
		if (turn >= p1Choices.length) break;
		void streams.p1.write(p1Choices[turn++]);
	}
	await new Promise(res => setTimeout(res, 50));
	return { requests, log };
}

(async () => {
	{
		const { requests, log } = await play(`${ETERNATUS(true)}\n\n${MATE}`, ['move 2 ultra', 'move 2']);
		check(requests[0].active[0].canUltraBurst === true, 'the flagged Eternatus is offered the Eternamax (Ultra Burst) button');
		check(!requests[0].active[0].canDynamax, 'and no Dynamax button');
		check(/detailschange\|p1a: Eternatus\|Eternatus-Eternamax/.test(log) && /unleashed its Eternamax form/.test(log), 'pressing it turns it into Eternamax');
		check(requests[1] && !requests[1].active[0].canUltraBurst && !requests[1].active[0].canDynamax && !requests[1].active[0].canTerastallize, 'and spends the button, Dynamax and its Tera');
		check(requests[1] && /Eternatus-Eternamax/.test(requests[1].side.pokemon[0].details), 'it stays Eternamax');
		const hp = requests[1] && requests[1].side.pokemon[0].condition;
		check(hp && Number(hp.split('/')[1]) > 500, `with Eternamax HP (${hp})`);
	}
	{
		const { requests } = await play(`${MATE}\n\n${ETERNATUS(true)}`, ['move 1 dynamax', 'switch 2', 'move 1']);
		const eternatusTurn = requests.find(r => /Eternatus/.test(r.side.pokemon[0].details));
		check(eternatusTurn && !eternatusTurn.active[0].canUltraBurst, 'after the side Dynamaxed, Eternatus has no Eternamax left');
	}
	{
		const { requests } = await play(`${ETERNATUS(false)}\n\n${MATE}`, ['move 1']);
		check(!requests[0].active[0].canUltraBurst, 'an unflagged Eternatus gets nothing');
	}
	console.log(`eternamax: ${passed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
