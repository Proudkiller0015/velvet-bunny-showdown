'use strict';
/**
 * Collab (data/velvet/collab.js): crossover Pokemon, refused by every RP format but
 * RP Collab - all five of them, and the bot that drafts them. Then Funerfly's
 * Qliphoth Counter (two super-effective hits, or a teammate fainting beside it, and
 * it breaches for good), Solemn Lament's two Ghost hits, Butterfly Procession's
 * four-turn bind, Last Rites (a special Last Respects) and the ability's Technician.
 * The other four's own mechanics are in test/collab-mons.test.js.
 */
const assert = require('assert');
const { Battle, Dex, Teams, TeamValidator, toID } = require('pokemon-showdown');

const funerfly = (extra = {}) => ({
	name: 'Funerfly', species: 'Funerfly', item: '', ability: 'Qliphoth Counter',
	moves: ['Solemn Lament', 'Butterfly Procession', 'Last Rites', 'Calm Mind'],
	nature: 'Modest', evs: { hp: 252, def: 0, spa: 252, spd: 4, spe: 0, atk: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
	level: 100, gender: '', ...extra,
});
const mon = (species, moves, extra = {}) => ({ name: species, species, ability: '', item: '', moves, nature: 'Serious', evs: { hp: 252 }, level: 100, ...extra });
const battle = (mine, theirs, formatid = 'gen9rpcollab') => {
	const b = new Battle({ formatid });
	b.setPlayer('p1', { team: Teams.pack(mine) });
	b.setPlayer('p2', { team: Teams.pack(theirs) });
	const lead = n => 'team ' + Array.from({ length: n }, (_, i) => i + 1).join('');
	b.choose('p1', lead(formatid.includes('doubles') ? 2 : 1));
	b.choose('p2', lead(formatid.includes('doubles') ? 2 : 1));
	return b;
};
const turn = (b, p1, p2) => { b.choose('p1', p1); b.choose('p2', p2); };
const logSince = (b, from) => b.log.slice(from).join('\n');
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

// ---- Legality: RP Collab only, for every one of them.
const COLLAB = require('pokemon-showdown/dist/data/velvet/collab.js');
const rpDex = Dex.forFormat('gen9rpcollab');
const GUESTS = [
	funerfly(),
	mon('Punibird', ['Peck of Sin', 'Brave Bird'], { ability: 'Punishment' }),
	mon('Laetitia', ["Wee Witch's Gift", 'Play Rough'], { ability: 'Dear Friends' }),
	mon('Freischutz', ['Magic Bullet', 'Iron Head'], { ability: "The Devil's Seventh" }),
	mon('Hatrequeen', ['Arcana Slave', 'Moonblast'], { ability: 'Love and Justice' }),
];
ok(GUESTS.map(set => rpDex.species.get(set.species).id).join() === COLLAB.SPECIES.join(), `five collab Pokemon (${COLLAB.SPECIES.join(', ')})`);
const problems = (f, set = funerfly()) => new TeamValidator(f).validateTeam([set]);
for (const set of GUESTS) {
	ok(!problems('gen9rpcollab', set), `${set.species} legal in RP Collab (${problems('gen9rpcollab', set)})`);
	for (const f of ['gen9rpag', 'gen9rpubers', 'gen9rpou', 'gen9rpuu', 'gen9rpru', 'gen9rpnu', 'gen9rppu', 'gen9rpzu', 'gen9rplc', 'gen9rpdraft', 'gen8rpou']) {
		const p = problems(f, set) || [];
		ok(p.length && p.join(' ').includes(set.species), `${set.species} refused in ${f}: ${p[0]}`);
	}
	ok(/RP Collab/.test((problems('gen9rpag', set) || []).join(' ')), `the refusal names RP Collab (${set.species})`);
	for (const f of ['gen9rpbattle', 'gen9rpbattledoubles']) ok(!(problems(f, set) || []).some(x => x.includes(set.species) || /Collab/.test(x)), `${set.species} accepted in ${f}, the RP's own battles`);
}
// The battle-only formes: brought as one, each starts the battle as its base, and is refused outside RP Collab too.
for (const [forme, set] of [['Funerfly-Breach', GUESTS[0]], ['Punibird-Angry', GUESTS[1]], ['Hatrequeen-Hatred', GUESTS[4]]]) {
	const brought = { ...set, species: forme, name: forme };
	ok(!new TeamValidator('gen9rpcollab').validateTeam([brought]) && brought.species === set.species, `${forme} on a team starts as ${set.species}`);
	ok((new TeamValidator('gen9rpag').validateTeam([{ ...set, species: forme }]) || []).length, `${forme} is refused outside RP Collab`);
}
// Everything else RP AG takes, RP Collab takes too.
ok(!new TeamValidator('gen9rpcollab').validateTeam([mon('Zacian-Crowned', ['Behemoth Blade'], { item: 'Rusted Sword', ability: 'Intrepid Sword' })]), 'RP Collab is RP AG plus the collab Pokemon');
// Every format still builds its rule table (a bad ban line takes the whole format list down).
for (const f of Dex.formats.all()) if (f.effectType === 'Format') Dex.formats.getRuleTable(f);
ok(true, 'every format builds its rule table');
// The RP tier table and the builder's copy of it say Collab.
const rpTiers = require('../src/rp-tiers.json');
ok(COLLAB.SPECIES.every(id => rpTiers[id] === 'Collab'), 'src/rp-tiers.json files every one under Collab');
// Numbers of their own: 2004 on, clear of the Touhou Pokemon's 2101 and up.
ok(COLLAB.SPECIES.map(id => rpDex.species.get(id).num).join() === '2004,2005,2006,2007,2008', 'dex numbers 2004-2008');

// ---- The bot drafts one in RP Collab and nowhere else.
{
	const { TeamBuilder } = require('../src/teambuilder');
	const tb = new TeamBuilder();
	const isGuest = set => COLLAB.SPECIES.includes(toID(rpDex.species.get(set.species).baseSpecies));
	for (const id of COLLAB.SPECIES) {
		ok(tb.context('gen9rpcollab').pool.some(s => s.id === id), `${id} in the bot's RP Collab pool`);
		for (const f of ['gen9rpag', 'gen9rpubers', 'gen9rpou', 'gen9rpbattle']) ok(!tb.context(f).pool.some(s => s.id === id), `${id} not in the bot's ${f} pool`);
		ok(tb.newSpecies().has(id), `${id} drafted like our other new Pokemon`);
	}
	const brought = new Set();
	for (let seed = 1; seed <= 10; seed++) {
		const team = Teams.unpack(tb.build('gen9rpcollab', seed));
		const guests = team.filter(isGuest);
		guests.forEach(set => brought.add(set.species));
		ok(guests.length && !new TeamValidator('gen9rpcollab').validateTeam(team), `the bot's RP Collab team ${seed} brings ${guests.map(s => s.species).join(', ')}, legally`);
		if (seed <= 3) ok(!Teams.unpack(tb.build('gen9rpag', seed)).some(isGuest), `its RP AG team ${seed} does not`);
	}
	ok(brought.size >= 3, `and not always the same one (${[...brought].join(', ')})`);
}

// ---- Qliphoth Counter: two super-effective hits and it breaches, for good.
{
	const b = battle([funerfly(), mon('Blissey', ['Splash'])], [mon('Chansey', ['Ember', 'Splash'], { nature: 'Bold', evs: { hp: 252, def: 252 } })]);
	const me = () => b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Funerfly');
	ok(me().m.qliphoth === 2, 'starts at 2');
	turn(b, 'move 4', 'move 1');
	ok(me().m.qliphoth === 1 && me().species.id === 'funerfly', 'one super-effective hit: 1, still contained');
	// Kept across a switch.
	turn(b, 'switch 2', 'move 2');
	turn(b, 'switch 2', 'move 2');
	ok(me().m.qliphoth === 1, 'the counter survives a switch');
	const from = b.log.length;
	turn(b, 'move 4', 'move 1');
	const p = me();
	ok(p.m.qliphoth === 0 && p.species.id === 'funerflybreach' && p.baseSpecies.id === 'funerflybreach', `second hit: breached (${p.species.name})`);
	ok(logSince(b, from).includes('The funeral procession begins.'), 'it says so');
	const bs = p.species.baseStats;
	ok(bs.hp === 95 && bs.atk === 75 && bs.def === 85 && bs.spa === 150 && bs.spd === 95 && bs.spe === 120, 'with the breach stats');
	ok(p.storedStats.spa > b.dex.species.get('Funerfly').baseStats.spa * 2 + 100, `stats recalculated (SpA ${p.storedStats.spa})`);
	turn(b, 'switch 2', 'move 2');
	turn(b, 'switch 2', 'move 2');
	ok(me().species.id === 'funerflybreach', 'still breached after switching out and back');
	ok(me().getAbility().flags.cantsuppress && me().getAbility().flags.failskillswap, 'the ability cannot be suppressed or swapped');
}
// A two-hit super-effective move is one blow to the counter.
{
	const b = battle([funerfly()], [mon('Chansey', ['Dual Wingbeat'])]);
	turn(b, 'move 4', 'move 1');
	ok(b.p1.active[0].m.qliphoth === 1, 'Dual Wingbeat ticks it once');
}
// A neutral hit does nothing.
{
	const b = battle([funerfly()], [mon('Chansey', ['Water Gun'])]);
	turn(b, 'move 4', 'move 1');
	ok(b.p1.active[0].m.qliphoth === 2, 'a neutral hit leaves the counter alone');
}
// A teammate fainting beside it (doubles: in singles a teammate faints only while Funerfly is out of play).
{
	const b = battle([funerfly(), mon('Magikarp', ['Splash'], { level: 1 })],
		[mon('Garchomp', ['Tackle'], { evs: { atk: 252 } }), mon('Chansey', ['Splash'])], 'gen9rpbattledoubles');
	turn(b, 'move 4, move 1', 'move 1 2, move 1');
	ok(b.p1.pokemon.find(p => p.species.name === 'Magikarp').fainted, 'the teammate fainted');
	ok(b.p1.active[0].m.qliphoth === 1, `a teammate fainting ticks it (${b.p1.active[0].m.qliphoth})`);
}

// ---- Solemn Lament: two Ghost hits of 60.
{
	const b = battle([funerfly()], [mon('Blastoise', ['Splash'])]);
	const from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(/\|-hitcount\|p2a?: Blastoise\|2/.test(logSince(b, from)), 'hits twice');
	const move = b.dex.getActiveMove('solemnlament');
	ok(move.basePower === 60 && move.type === 'Ghost', 'Ghost, 60 a hit');
	const umbreon = battle([funerfly()], [mon('Umbreon', ['Splash'])]);
	ok(umbreon.p2.active[0].runEffectiveness(umbreon.dex.getActiveMove('solemnlament')) === -1, 'plain Ghost: resisted by Dark');
}

// ---- Butterfly Procession: trapped for 4 turns, 1/8 each.
{
	const b = battle([funerfly()], [mon('Blissey', ['Splash']), mon('Chansey', ['Splash'])]);
	const foe = b.p2.active[0];
	turn(b, 'move 2', 'move 1');
	ok(foe.volatiles['partiallytrapped'], 'the target is bound');
	ok(b.p2.activeRequest.active[0].trapped || b.p2.activeRequest.active[0].maybeTrapped, 'and cannot switch');
	const before = foe.hp;
	turn(b, 'move 4', 'move 1');
	ok(before - foe.hp === Math.floor(foe.baseMaxhp / 8), `1/8 at the end of the turn (${before - foe.hp} of ${foe.baseMaxhp})`);
	for (let i = 0; i < 4; i++) turn(b, 'move 4', 'move 1');
	// Each damage line is logged twice (exact HP for its side, percentage for everyone).
	const binds = b.log.filter(l => /\|-damage\|p2a: Blissey\|.*\[partiallytrapped\]/.test(l)).length / 2;
	ok(binds === 4 && !foe.volatiles['partiallytrapped'], `four turns, then free (${binds} hits)`);
}

// ---- Last Rites: a special Last Respects, 50 +50 for each fainted Pokemon on the user's side.
{
	const move = Dex.forFormat('gen9rpcollab').moves.get('lastrites');
	ok(move.category === 'Special' && move.type === 'Ghost' && move.accuracy === 100 && move.pp === 10 && move.basePower === 50, 'Ghost, special, 50, 100%, 10 PP');
	ok(!move.flags.heal && !move.heal && !move.drain && move.target === 'normal', 'an attack: no healing');
	// Power as the battle works it out, without the ability's Technician.
	const power = (b) => {
		const user = b.p1.active[0];
		const m = b.dex.getActiveMove('lastrites');
		return m.basePowerCallback.call(b, user, b.p2.active[0], m);
	};
	const b = battle([funerfly(), mon('Magikarp', ['Splash'], { level: 1 })], [mon('Blastoise', ['Splash', 'Water Gun'], { evs: { spa: 252 } })]);
	ok(power(b) === 50, `50 with nobody fainted (${power(b)})`);
	turn(b, 'switch 2', 'move 2');
	ok(b.p1.pokemon.find(p => p.species.name === 'Magikarp').fainted, 'a teammate fainted');
	b.choose('p1', 'switch 2');
	ok(b.p1.active[0].species.baseSpecies === 'Funerfly' && power(b) === 100, `100 with one ally fainted (${power(b)})`);
	// And it hurts, and heals nothing.
	const me = b.p1.active[0];
	me.hp = Math.floor(me.maxhp / 2);
	const foe = b.p2.active[0];
	const before = foe.hp;
	turn(b, 'move 3', 'move 1');
	ok(foe.hp < before && me.hp === Math.floor(me.maxhp / 2), `damages the target (${before - foe.hp}), heals nothing`);
}

// ---- Qliphoth Counter is also Technician: Solemn Lament is 90 a hit, Butterfly Procession stays 120.
{
	const b = battle([funerfly()], [mon('Blastoise', ['Splash'])]);
	const user = b.p1.active[0];
	const foe = b.p2.active[0];
	const runPower = (id) => {
		const m = b.dex.getActiveMove(id);
		const bp = m.basePowerCallback ? m.basePowerCallback.call(b, user, foe, m) : m.basePower;
		return b.runEvent('BasePower', user, foe, m, bp, true);
	};
	ok(runPower('solemnlament') === 90, `Solemn Lament: 90 a hit (${runPower('solemnlament')})`);
	ok(runPower('lastrites') === 75, `Last Rites at 50 is 75 with it (${runPower('lastrites')})`);
	ok(runPower('butterflyprocession') === 120, 'Butterfly Procession: 120, untouched');
	// The same move from a Pokemon without it hits softer.
	const dmg = (ability) => {
		let total = 0;
		for (let seed = 1; seed <= 4; seed++) {
			const t = new Battle({ formatid: 'gen9rpcollab', seed: [seed, seed, seed, seed] });
			t.setPlayer('p1', { team: Teams.pack([funerfly({ moves: ['Solemn Lament'] })]) });
			t.setPlayer('p2', { team: Teams.pack([mon('Blastoise', ['Splash'])]) });
			t.choose('p1', 'team 1'); t.choose('p2', 'team 1');
			if (!ability) t.p1.active[0].setAbility('Pressure', null, null, true);
			const f = t.p2.active[0];
			turn(t, 'move 1', 'move 1');
			total += f.maxhp - f.hp;
		}
		return total;
	};
	const withIt = dmg(true);
	const without = dmg(false);
	ok(withIt > without * 1.35, `Technician shows in the damage (${withIt} vs ${without})`);
}

// ---- Full battles with random choices: nothing throws.
{
	const pick = (rng, list) => list[Math.floor(rng() * list.length)];
	let seed = 7;
	const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const random = Teams.getGenerator('gen9randombattle', [1, 2, 3, 4]);
	const choiceFor = (side) => {
		const req = side.activeRequest;
		if (!req || req.wait) return null;
		const alive = req.side.pokemon.map((p, i) => [p, i + 1]).filter(([p]) => !p.active && !p.condition.endsWith(' fnt'));
		if (req.forceSwitch) return req.forceSwitch.map(() => (alive.length ? `switch ${pick(rng, alive)[1]}` : 'pass')).join(', ');
		if (req.teamPreview) return 'default';
		return req.active.map(a => {
			const moves = a.moves.map((m, i) => [m, i + 1]).filter(([m]) => !m.disabled);
			if (!a.trapped && alive.length && rng() < 0.15) return `switch ${pick(rng, alive)[1]}`;
			return moves.length ? `move ${pick(rng, moves)[1]}` : 'default';
		}).join(', ');
	};
	for (let game = 0; game < 6; game++) {
		const team = side => [funerfly({ moves: pick(rng, [['Solemn Lament', 'Butterfly Procession', 'Last Rites', 'Quiver Dance'], ['Shadow Ball', 'Bug Buzz', 'Last Rites', 'Destiny Bond'], ['Solemn Lament', 'Perish Song', 'Trick Room', 'U-turn']]) }), ...random.getTeam().slice(0, 5)];
		const b = battle(team(), team());
		let guard = 0;
		while (!b.ended && guard++ < 500) {
			for (const side of [b.p1, b.p2]) {
				const c = choiceFor(side);
				if (c && !b.ended) { if (!b.choose(side.id, c)) b.choose(side.id, 'default'); }
			}
		}
		ok(b.ended, `random battle ${game + 1} finished (${b.turn} turns, ${b.winner || 'tie'})`);
	}
}

console.log(`collab: ${n} checks passed`);
