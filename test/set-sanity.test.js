'use strict';
/**
 * Set sanity on every build path (24 Sep 2026).
 *
 *   node test/set-sanity.test.js [teams per format, default 8]
 *
 * The checks a strong player makes on a set before looking at the team
 * (src/role-sets.js setProblems): no Choice item with a status move (Trick,
 * Switcheroo and the moves that end the user aside), no Assault Vest with one,
 * no trap item (Wide Lens, Scope Lens, Shell Bell...), at least three moves
 * that do something, a STAB attack. The draw that ladder bots use in Smogon
 * formats handed out Choice Specs Regigigas with Protect and Substitute, a
 * Wide Lens Lilligant-Hisui and a two-move Pangoro; this builds N teams per
 * format through every path - the Smogon draw, the assembler, the role sets
 * for this server's own Pokemon - and checks each set, and that every team
 * is still legal.
 */

const { Dex, TeamValidator, Teams } = require('pokemon-showdown');
const { TeamBuilder } = require('../src/teambuilder');
const RS = require('../src/role-sets');
const A = require('../src/team-assembler');
const TL = require('../src/team-logic');
const RPDex = require('../src/rp-dex')();

const N = Number(process.argv[2]) || 8;
let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
const seeded = seed => () => ((seed = seed * 16807 % 2147483647) / 2147483647);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/*
 * The problems this test forbids. A missing STAB is forgiven only where the
 * species learns no STAB attack worth having (base power 50+) at all.
 */
const FORBIDDEN = ['choice-status', 'av-status', 'trap-item', 'thin', 'no-stab', 'dup-move'];
function violations(dex, set, gameType) {
	return RS.setProblems(dex, set, { gameType }).filter(p => {
		if (!FORBIDDEN.includes(p.code)) return false;
		if (p.code === 'no-stab') {
			const species = dex.species.get(set.species);
			return [...RS.learnable(dex, species)].some(id => {
				const m = dex.moves.get(id);
				return m.exists && !m.isNonstandard && m.category !== 'Status' && m.basePower >= 50 && species.types.includes(m.type);
			});
		}
		return true;
	}).map(p => `${set.species}: ${p.text}`);
}

// ------------------------------------------------------------- unit checks
{
	const dex = Dex.forFormat('gen9ou');
	const bad = { species: 'Regigigas', ability: 'Slow Start', item: 'Choice Specs', moves: ['Protect', 'Substitute', 'Body Slam', 'Knock Off'] };
	check(RS.setProblems(dex, bad).some(p => p.code === 'choice-status'), 'Choice Specs with Protect and Substitute is flagged');
	RS.repairSet(dex, bad, {});
	check(!RS.setProblems(dex, bad).some(p => ['choice-status', 'wrong-side'].includes(p.code)), `and repaired (${bad.item}: ${bad.moves.join(', ')})`);
	const lens = { species: 'Lilligant-Hisui', ability: 'Hustle', item: 'Wide Lens', moves: ['Close Combat', 'Leaf Blade', 'Victory Dance', 'Ice Spinner'] };
	RS.repairSet(dex, lens, {});
	check(!RS.TRAP_ITEMS.includes(toID(lens.item)) && lens.item, `a Wide Lens is replaced (${lens.item})`);
	const pango = { species: 'Pangoro', ability: 'Iron Fist', item: 'Life Orb', moves: ['Shuffle Jab'] };
	RS.repairSet(RPDex, pango, {});
	check(pango.moves.length === 4 && !RS.setProblems(RPDex, pango).length, `a one-move set gets four that do something (${pango.moves.join(', ')} @ ${pango.item})`);
	const av = { species: 'Rillaboom', ability: 'Grassy Surge', item: 'Assault Vest', moves: ['Grassy Glide', 'Wood Hammer', 'Knock Off', 'Swords Dance'] };
	RS.repairSet(dex, av, {});
	check(!av.moves.includes('Swords Dance') && av.item === 'Assault Vest', `Assault Vest keeps its attacks, loses the setup move (${av.moves.join(', ')})`);
	const wall = { species: 'Blissey', ability: 'Natural Cure', item: 'Choice Band', moves: ['Soft-Boiled', 'Seismic Toss', 'Stealth Rock', 'Toxic'] };
	RS.repairSet(dex, wall, {});
	check(wall.moves.includes('Soft-Boiled') && !RS.CHOICE_ITEMS.includes(toID(wall.item)), `a wall keeps its moves and loses the Choice item (${wall.item})`);
	check(!RS.setProblems(dex, { species: 'Gholdengo', ability: 'Good as Gold', item: 'Choice Scarf', moves: ['Make It Rain', 'Shadow Ball', 'Trick', 'Recover'] }).length,
		'Scarf Trick Recover is a real set (after Trick the holder is free)');
	check(!RS.setProblems(dex, { species: 'Corviknight', ability: 'Pressure', item: 'Leftovers', moves: ['Body Press', 'Iron Defense', 'Roost', 'Defog'] }).length,
		'Body Press counts as a main attack');
	check(RS.itemFor(dex, dex.species.get('Gliscor'), { role: 'Bulky Support', ability: 'Poison Heal' }, ['Earthquake', 'Knock Off', 'Toxic', 'Protect'], 'Physical') === 'Toxic Orb',
		'Poison Heal gets its Toxic Orb');
	check(RS.ivsFor(dex, dex.species.get('Clefable'), ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower']).atk === 0 &&
		!RS.ivsFor(dex, dex.species.get('Garchomp'), ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang']),
	'0 Attack IVs on a special set, none on a physical one');
}

// ------------------------------------------------- whole teams, every path
(async () => {
	const tb = new TeamBuilder();
	for (const id of ['gen9ou', 'gen9rpou', 'gen9rpbattle', 'gen9doublesou']) {
		// Smogon's data when the cache or the network has it; the bundled sources otherwise.
		await Promise.race([tb.prefetch(id).catch(() => null), new Promise(r => setTimeout(r, 20000))]);
		const ctx = tb.context(id);
		const validator = new TeamValidator(id);
		let illegal = 0, sets = 0, hard = 0;
		const bad = [];
		for (let i = 0; i < N; i++) {
			let team;
			try { team = Teams.unpack(tb.build(id, 4242 + i * 7919)); } catch (e) { illegal++; continue; }
			const problems = validator.validateTeam(team);
			if (problems && problems.length) illegal++;
			for (const set of team) { sets++; bad.push(...violations(ctx.dex, set, ctx.gameType)); }
			if (ctx.gameType === 'singles') hard += TL.score(ctx.dex, team, { stage: 'full', threats: tb.threats(ctx) }).issues.filter(x => x.severity === 'hard').length;
		}
		check(!illegal, `${id}: ${N} teams, all legal (${illegal} not)`);
		check(!bad.length, `${id}: ${sets} sets, none with a Choice + status, trap item, thin set or missing STAB${bad.length ? ` (${bad.slice(0, 3).join('; ')})` : ''}`);
		if (ctx.gameType === 'singles') console.log(`     ${id}: ${(hard / N).toFixed(1)} hard checklist failures per team`);
	}

	// The assembler (RP trainers, Build my team, offline ladder teams) and the role sets for custom species.
	const box = ['Spiritomb', 'Glaceon', 'Garchomp', 'Roserade', 'Togekiss', 'Lucario', 'Infernape', 'Torterra', 'Empoleon', 'Blissey', 'Dragonite', 'Kingambit']
		.map(name => ({ species: name, strength: 1 }));
	const bad = [];
	for (let i = 0; i < N; i++) {
		const team = A.assemble(RPDex, box, { rng: seeded(11 + i), items: true, archetype: ['hyper offense', 'bulky offense', 'balance', 'stall'][i % 4] });
		for (const set of team) bad.push(...violations(RPDex, set, 'singles'));
	}
	check(!bad.length, `assembler: ${N} teams with items, every set sane${bad.length ? ` (${bad.slice(0, 3).join('; ')})` : ''}`);
	const custom = [];
	let n = 0;
	for (const s of RPDex.species.all()) {
		if (s.num >= 0 && !(s.isNonstandard === 'Custom')) continue;
		if (n++ >= 60) break;
		const set = RS.buildSet(RPDex, s.name, { rng: seeded(n) });
		if (!set) continue;
		RS.repairSet(RPDex, set, {});
		custom.push(...violations(RPDex, set, 'singles').filter(v => !/thin/.test(v) || set.moves.length >= 3));
	}
	check(!custom.length, `this server's own Pokemon (${n}): role sets pass sanity${custom.length ? ` (${custom.slice(0, 3).join('; ')})` : ''}`);

	// Lead order: a hazard setter or pivot first, a setup sweeper never.
	const ordered = A.leadOrder(RPDex, [
		{ species: 'Dragonite', moves: ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch'] },
		{ species: 'Garchomp', moves: ['Stealth Rock', 'Earthquake', 'Dragon Tail', 'Fire Blast'] },
		{ species: 'Blissey', moves: ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Heal Bell'] },
	]);
	check(ordered[0].species === 'Garchomp' && ordered[2].species === 'Dragonite', `lead order: the Stealth Rock setter leads, the sweeper goes last (${ordered.map(s => s.species).join(', ')})`);

	console.log(`\n${passed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
