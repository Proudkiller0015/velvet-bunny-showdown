'use strict';
/**
 * The 10 Oct 2026 minor update: Twister at 85 power and 30% flinch, and Explosion /
 * Self-Destruct halving the target's Defense as in Generations 1-4.
 *
 *   node test/classic-moves.test.js
 */

const { Battle } = require('pokemon-showdown');
const Dex = require('../src/rp-dex')();

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function battle(p1, p2, seed = [1, 2, 3, 4]) {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: p1.map(s => ({ level: 100, evs: { hp: 252, atk: 252, spa: 252 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	b.setPlayer('p2', { team: p2.map(s => ({ level: 100, evs: { hp: 252, def: 252, spd: 4 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	return b;
}

const twister = Dex.moves.get('twister');
check(twister.basePower === 85, `Twister is 85 power (${twister.basePower})`);
check(twister.secondary && twister.secondary.chance === 30 && twister.secondary.volatileStatus === 'flinch', 'Twister flinches 30%');

for (const id of ['explosion', 'selfdestruct']) {
	const b = battle(
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: [id] }],
		[{ species: 'Skarmory', ability: 'Sturdy', moves: ['splash'] }],
	);
	const [atk, def] = [b.p1.active[0], b.p2.active[0]];
	b.randomizer = d => d;   // no damage roll, so the two numbers compare
	const ours = b.actions.getDamage(atk, def, b.dex.getActiveMove(id), true);
	const plain = b.dex.getActiveMove(id);
	delete plain.onBasePower;
	const vanilla = b.actions.getDamage(atk, def, plain, true);
	// Doubling the power and halving Defense come out within a point or two of each other.
	check(Math.abs(ours / vanilla - 2) < 0.05, `${plain.name} hits as if Defense were halved (${vanilla} -> ${ours})`);
}

// Misty Explosion (12 Oct 2026): 200 power, Special Defense halved.
{
	const misty = Dex.moves.get('mistyexplosion');
	check(misty.basePower === 200, `Misty Explosion is 200 power (${misty.basePower})`);
	const b = battle(
		[{ species: 'Slurpuff', ability: 'Unburden', moves: ['mistyexplosion'] }],
		[{ species: 'Skarmory', ability: 'Sturdy', moves: ['splash'] }],
	);
	const [atk, def] = [b.p1.active[0], b.p2.active[0]];
	b.randomizer = d => d;
	const ours = b.actions.getDamage(atk, def, b.dex.getActiveMove('mistyexplosion'), true);
	const plain = b.dex.getActiveMove('mistyexplosion');
	delete plain.onBasePower;
	const unhalved = b.actions.getDamage(atk, def, plain, true);
	check(Math.abs(ours / unhalved - 2) < 0.05, `Misty Explosion hits as if Special Defense were halved (${unhalved} -> ${ours})`);
}

// Twister flinches about 30% of the time from a faster user.
{
	let flinched = 0;
	const N = 300;
	for (let i = 0; i < N; i++) {
		const b = battle(
			[{ species: 'Dragapult', ability: 'Infiltrator', moves: ['twister'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, i + 1, i + 2, i + 3],
		);
		b.makeChoices('move 1', 'move 1');
		if (/\|cant\|p2a: Blissey\|flinch/.test(b.log.join('\n'))) flinched++;
	}
	check(flinched / N > 0.24 && flinched / N < 0.36, `Twister flinch rate ${(100 * flinched / N).toFixed(0)}%`);
}

// Recharge (14 Oct 2026): a KO means no recharge turn, and the battle never shows "Must recharge" for it.
{
	const ko = battle(
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: ['gigaimpact', 'splash'] }],
		[{ species: 'Pichu', ability: 'Static', level: 5, moves: ['splash'] }, { species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	ko.makeChoices('move 1', 'move 1');
	const koLog = ko.log.join('\n');
	check(/\|faint\|p2a: Pichu/.test(koLog), 'Giga Impact knocks Pichu out');
	check(!/-mustrecharge/.test(koLog), 'no "Must recharge" after the KO');
	check(!ko.p1.active[0].volatiles['mustrecharge'], 'and no recharge turn');
	ko.choose('p2', 'switch 2');
	ko.makeChoices('move 2', 'move 1');
	check(!/\|cant\|p1a: Snorlax\|recharge/.test(ko.log.join('\n')), 'Snorlax moves freely the next turn');

	const hit = battle(
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: ['gigaimpact', 'splash'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	hit.makeChoices('move 1', 'move 1');
	check(/-mustrecharge\|p1a: Snorlax/.test(hit.log.join('\n')), 'without a KO it must recharge');
	hit.makeChoices('move 1', 'move 1');
	check(/\|cant\|p1a: Snorlax\|recharge/.test(hit.log.join('\n')), 'and loses the next turn');
}

{
	/*
	 * Gen 2's Rest and Sleep Talk (data/velvet/classic-mechanics.js), turn by turn against
	 * Showdown's own Gen 2 mod: the same Snorlax and the same Tauros in [Gen 2] Custom Game,
	 * in RP, and in plain Gen 9, which should be the odd one out.
	 */
	const play = (formatid, snorlaxMoves, turns) => {
		const gen2 = formatid.startsWith('gen2');
		const ability = gen2 ? 'No Ability' : '';
		const b = new Battle({ formatid, seed: [1, 2, 3, 4] });
		b.setPlayer('p1', { team: [{ species: 'Snorlax', ability, item: '', moves: snorlaxMoves, level: 100, evs: { hp: 252 }, ivs: {} }] });
		b.setPlayer('p2', { team: [{ species: 'Tauros', ability, item: '', moves: ['strength'], level: 50, evs: { atk: 252, spe: 252 }, ivs: {} }] });
		if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
		const snorlax = b.p1.active[0];
		const rows = [];
		for (let t = 0; t < turns && !b.ended; t++) {
			const before = b.log.length;
			b.makeChoices(t ? 'move 2' : 'move 1', 'move 1');   // Rest, then the second move
			const lines = b.log.slice(before).join('\n');
			rows.push([
				snorlax.status || '-',
				snorlax.status === 'slp' ? snorlax.statusState.time : 0,
				snorlax.hp === snorlax.maxhp ? 'full' : 'hurt',
				/\|move\|p1a: Snorlax\|/.test(lines) ? 'moved' : 'slept',
			].join(' '));
		}
		return rows;
	};
	// Rest, then Sleep Talk every turn: it can only call Rest, which in Gen 2 resets the nap.
	const restTalk = ['rest', 'sleeptalk'];
	const gen2 = play('gen2customgame', restTalk, 5);
	const ours = play('gen9rpcustomgame', restTalk, 5);
	const vanilla = play('gen9customgame', restTalk, 5);
	check(JSON.stringify(ours) === JSON.stringify(gen2), `RestTalk plays as in Gen 2 (${ours.join(' | ')})`);
	check(ours.slice(1).every(r => r.startsWith('slp 3 full')), 'Sleep Talk into Rest heals to full and restarts the sleep at 3, every turn');
	check(JSON.stringify(vanilla) !== JSON.stringify(gen2), `and plain Gen 9 does not (${vanilla.join(' | ')})`);
	// Rest, then sleep it off: two turns asleep, then wake and act on the third.
	const gen2Nap = play('gen2customgame', ['rest', 'headbutt'], 5);
	const ourNap = play('gen9rpcustomgame', ['rest', 'headbutt'], 5);
	check(JSON.stringify(ourNap.map(r => r.split(' ')[0] + ' ' + r.split(' ')[3])) === JSON.stringify(gen2Nap.map(r => r.split(' ')[0] + ' ' + r.split(' ')[3])),
		`waking matches Gen 2 (${ourNap.join(' | ')})`);
	// Rest at full HP still fails; Comatose still cannot Rest.
	const full = new Battle({ formatid: 'gen9rpcustomgame', seed: [1, 2, 3, 4] });
	full.setPlayer('p1', { team: [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['rest'], level: 100 }] });
	full.setPlayer('p2', { team: [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'], level: 100 }] });
	if (full.requestState === 'teampreview') full.makeChoices('team 1', 'team 1');
	full.makeChoices('move 1', 'move 1');
	check(full.p1.active[0].status === '' && /\|-fail\|p1a: Snorlax\|heal/.test(full.log.join('\n')), 'Rest at full HP fails');
	const rest = Dex.moves.get('rest');
	check(/already asleep/.test(rest.desc) && /Works while asleep/.test(rest.shortDesc), 'Rest says so in its description');
	check(/Generation 2/.test(Dex.moves.get('sleeptalk').desc), 'and so does Sleep Talk');
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
