'use strict';
/**
 * Collab (data/velvet/collab.js): crossover Pokemon, refused by every RP format but
 * RP Collab. Funerfly's Qliphoth Counter (two super-effective hits, or a teammate
 * fainting beside it, and it breaches for good), Solemn Lament's Bug half, Butterfly
 * Procession's four-turn bind and Last Rites' once-a-battle heal.
 */
const assert = require('assert');
const { Battle, Dex, Teams, TeamValidator } = require('pokemon-showdown');

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

// ---- Legality: RP Collab only.
const problems = f => new TeamValidator(f).validateTeam([funerfly()]);
ok(!problems('gen9rpcollab'), `legal in RP Collab (${problems('gen9rpcollab')})`);
for (const f of ['gen9rpag', 'gen9rpubers', 'gen9rpou', 'gen9rpuu', 'gen9rpru', 'gen9rpnu', 'gen9rppu', 'gen9rpzu', 'gen9rplc', 'gen9rpbattle', 'gen9rpbattledoubles', 'gen9rpdraft', 'gen8rpou']) {
	const p = problems(f) || [];
	ok(p.length && /Funerfly/.test(p.join(' ')), `refused in ${f}: ${p[0]}`);
}
ok(/RP Collab/.test((problems('gen9rpag') || []).join(' ')), 'the refusal names RP Collab');
{
	// The breached forme is battle-only: brought as it, it starts the battle contained.
	const breach = funerfly({ species: 'Funerfly-Breach', name: 'Funerfly-Breach' });
	ok(!new TeamValidator('gen9rpcollab').validateTeam([breach]) && breach.species === 'Funerfly', 'Funerfly-Breach on a team starts as Funerfly');
	ok((new TeamValidator('gen9rpag').validateTeam([funerfly({ species: 'Funerfly-Breach' })]) || []).length, 'and is refused outside RP Collab too');
}
// Everything else RP AG takes, RP Collab takes too.
ok(!new TeamValidator('gen9rpcollab').validateTeam([mon('Zacian-Crowned', ['Behemoth Blade'], { item: 'Rusted Sword', ability: 'Intrepid Sword' })]), 'RP Collab is RP AG plus the collab Pokemon');
// Every format still builds its rule table (a bad ban line takes the whole format list down).
for (const f of Dex.formats.all()) if (f.effectType === 'Format') Dex.formats.getRuleTable(f);
ok(true, 'every format builds its rule table');
// The RP tier table and the builder's copy of it say Collab.
ok(require('../src/rp-tiers.json').funerfly === 'Collab', 'src/rp-tiers.json files it under Collab');

// ---- The bot drafts it in RP Collab and nowhere else.
{
	const { TeamBuilder } = require('../src/teambuilder');
	const tb = new TeamBuilder();
	ok(tb.context('gen9rpcollab').pool.some(s => s.id === 'funerfly'), 'in the bot\'s RP Collab pool');
	for (const f of ['gen9rpag', 'gen9rpubers', 'gen9rpou', 'gen9rpbattle']) ok(!tb.context(f).pool.some(s => s.id === 'funerfly'), `not in the bot's ${f} pool`);
	ok(tb.newSpecies().has('funerfly'), 'drafted like our other new Pokemon');
	for (let seed = 1; seed <= 3; seed++) {
		const team = Teams.unpack(tb.build('gen9rpcollab', seed));
		ok(team.some(s => s.species === 'Funerfly') && !new TeamValidator('gen9rpcollab').validateTeam(team), `the bot's RP Collab team ${seed} brings Funerfly, legally`);
		ok(!Teams.unpack(tb.build('gen9rpag', seed)).some(s => s.species.startsWith('Funerfly')), `its RP AG team ${seed} does not`);
	}
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
	ok(bs.hp === 80 && bs.atk === 70 && bs.def === 75 && bs.spa === 125 && bs.spd === 85 && bs.spe === 95, 'with the breach stats');
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

// ---- Solemn Lament: two hits, Ghost and Bug at once.
{
	const b = battle([funerfly()], [mon('Malamar', ['Splash'], { ability: 'Contrary' })]);
	const from = b.log.length;
	turn(b, 'move 1', 'move 1');
	const log = logSince(b, from);
	ok(/\|-hitcount\|p2a?: Malamar\|2/.test(log), 'hits twice');
	ok(/\|-supereffective\|p2a: Malamar/.test(log), 'super effective on Psychic/Dark');
	const move = b.dex.getActiveMove('solemnlament');
	ok(b.p2.active[0].runEffectiveness(move) === 2, 'quadruple: Ghost x Psychic/Dark (1x) and Bug x Psychic/Dark (4x)');
	const umbreon = battle([funerfly()], [mon('Umbreon', ['Splash'])]);
	ok(umbreon.p2.active[0].runEffectiveness(umbreon.dex.getActiveMove('solemnlament')) === 0, 'neutral on a plain Dark type (Ghost resisted, Bug super effective)');
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

// ---- Last Rites: 1/4 per fainted Pokemon on either side, once a battle.
{
	// Nobody has fainted: it fails.
	const b = battle([funerfly()], [mon('Chansey', ['Night Shade', 'Splash'])]);
	turn(b, 'move 4', 'move 1');
	const hurt = b.p1.active[0].hp;
	const from = b.log.length;
	turn(b, 'move 3', 'move 2');
	ok(hurt < b.p1.active[0].maxhp && b.p1.active[0].hp === hurt && /\|-fail\|p1a: Funerfly/.test(logSince(b, from)), 'fails while nobody has fainted');
}
{
	// One of theirs and one of ours down: 2/4 of its HP.
	const b = battle([funerfly(), mon('Magikarp', ['Splash'], { level: 1 })],
		[mon('Magikarp', ['Splash'], { level: 1 }), mon('Chansey', ['Night Shade', 'Splash'])]);
	turn(b, 'move 1', 'move 1');
	b.choose('p2', 'switch 2');
	turn(b, 'switch 2', 'move 1');
	b.choose('p1', 'switch 2');
	turn(b, 'move 4', 'move 1');
	turn(b, 'move 4', 'move 1');
	const me = b.p1.active[0];
	ok(me.species.baseSpecies === 'Funerfly' && b.p1.pokemon.filter(p => p.fainted).length === 1 && b.p2.pokemon.filter(p => p.fainted).length === 1, 'one down on each side');
	const missing = me.maxhp - me.hp;
	const before = me.hp;
	turn(b, 'move 3', 'move 2');
	const healed = me.hp - before;
	ok(missing > Math.floor(me.baseMaxhp / 4) * 2 && healed === Math.min(missing, Math.floor(me.baseMaxhp / 4) * 2), `heals 2/4 for two fainted (${healed}, ${missing} missing)`);
	turn(b, 'move 4', 'move 1');
	const hurt = me.hp;
	const from = b.log.length;
	turn(b, 'move 3', 'move 2');
	ok(me.m.lastRites && hurt < me.maxhp && me.hp === hurt && /\|-fail\|p1a: Funerfly/.test(logSince(b, from)), 'works once a battle');
}
{
	// At full HP it fails (and is not used up).
	const b = battle([funerfly()], [mon('Magikarp', ['Splash'], { level: 1 }), mon('Chansey', ['Night Shade', 'Splash'])]);
	turn(b, 'move 1', 'move 1');
	b.choose('p2', 'switch 2');
	turn(b, 'move 3', 'move 2');
	ok(!b.p1.active[0].m.lastRites, 'fails at full HP, and is still there to use');
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
