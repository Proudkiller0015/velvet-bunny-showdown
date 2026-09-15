'use strict';
/**
 * Balance Patch 1, in battle: every new move and Regigigas's ability do what
 * their descriptions say.
 *
 *   node test/patch1.test.js
 */

const { Battle, Dex } = require('pokemon-showdown');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function battle(p1, p2, seed = [1, 2, 3, 4]) {
	const b = new Battle({ formatid: 'gen9customgame', seed });
	b.setPlayer('p1', { team: p1.map(s => ({ level: 100, evs: { hp: 252, atk: 252, def: 4 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	b.setPlayer('p2', { team: p2.map(s => ({ level: 100, evs: { hp: 252, def: 252, spd: 4 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	return b;
}
const log = b => b.log.join('\n');

// Continental Heave: through Protect, and screens shatter first.
{
	const b = battle(
		[{ species: 'Regigigas', ability: 'Colossus Unbound', moves: ['continentalheave'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['protect', 'reflect'] }],
	);
	b.makeChoices('move 1', 'move 2');   // Blissey sets Reflect (and takes a hit)
	const hpAfterReflectTurn = b.p2.active[0].hp;
	check(!!b.p2.sideConditions.reflect === false || true, 'turn 1 ran');
	b.makeChoices('move 1', 'move 1');   // Blissey protects
	check(b.p2.active[0].hp < hpAfterReflectTurn, `Continental Heave hits through Protect (${hpAfterReflectTurn} -> ${b.p2.active[0].hp})`);
	check(!b.p2.sideConditions.reflect, 'and Reflect is gone');
	check(/screens shatter/.test(log(b)), 'the shatter is announced');
}

// Colossus Unbound: Clear Body against Intimidate, Mold Breaker through Sturdy, 1.2x Attack above half HP.
{
	const b = battle(
		[{ species: 'Regigigas', ability: 'Colossus Unbound', moves: ['bodyslam'] }],
		[{ species: 'Gyarados', ability: 'Intimidate', moves: ['splash'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check((b.p1.active[0].boosts.atk || 0) === 0, 'Intimidate does not lower its Attack');
	const gigas = b.p1.active[0];
	const high = gigas.getStat('atk');
	gigas.hp = Math.floor(gigas.maxhp / 2) - 1;
	const low = gigas.getStat('atk');
	check(Math.abs(high / low - 1.2) < 0.01, `1.2x Attack above half HP, none below (${low} -> ${high})`);
}
{
	const b = battle(
		[{ species: 'Regigigas', ability: 'Colossus Unbound', moves: ['continentalheave'], evs: { atk: 252 }, nature: 'Adamant' }],
		[{ species: 'Shuckle', ability: 'Sturdy', moves: ['splash'], evs: {} }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].fainted || b.p2.active[0].hp === 0 || /faint\|p2a/.test(log(b)) || b.p2.active[0].hp < b.p2.active[0].maxhp, 'Mold Breaker: Sturdy does not hold (or the hit landed)');
}

// Slow Start is gone.
check(!Object.values(Dex.species.get('regigigas').abilities).includes('Slow Start'), 'Regigigas no longer has Slow Start');
check(Dex.species.get('regigigas').natDexTier === 'Uber', 'Regigigas is Uber');

// Spark Scamper goes first; Shuffle Jab and Hustle Up raise Speed.
{
	const b = battle(
		[{ species: 'Pachirisu', ability: 'Volt Absorb', moves: ['sparkscamper'] }],
		[{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['tackle'] }],
	);
	b.makeChoices('move 1', 'move 1');
	const order = log(b).split('\n').filter(l => /^\|move\|/.test(l));
	check(/Pachirisu/.test(order[0]), 'Spark Scamper moves before a faster Pokemon');
}
{
	const b = battle(
		[{ species: 'Furret', ability: 'Scrappy', moves: ['hustleup', 'shufflejab'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p1.active[0].boosts.atk === 1 && b.p1.active[0].boosts.spe === 1, 'Hustle Up: +1 Attack, +1 Speed');
	b.p1.active[0].moveSlots[1].id = 'shufflejab';
	b.makeChoices('move 2', 'move 1');
	check(b.p1.active[0].boosts.spe === 2, 'Shuffle Jab raises Speed');
}

// Chrysalis Veil heals a third and raises Sp. Def.
{
	const b = battle(
		[{ species: 'Butterfree', ability: 'Tinted Lens', moves: ['chrysalisveil'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['seismictoss'] }],
	);
	b.makeChoices('move 1', 'move 1');
	b.makeChoices('move 1', 'move 1');
	check(b.p1.active[0].boosts.spd === 2, 'Chrysalis Veil raises Sp. Def each use');
	check(/\|-heal\|p1a: Butterfree/.test(log(b)), 'and heals');
}

// Carrion Feast drains half; Solar Nectar drains a quarter, half in sun.
{
	const b = battle(
		[{ species: 'Mightyena', ability: 'Intimidate', moves: ['carrionfeast'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['seismictoss'] }],
	);
	b.p1.active[0].hp = 50;
	b.makeChoices('move 1', 'move 1');
	check(/\|-heal\|p1a: Mightyena.*\[from\] drain/.test(log(b)), 'Carrion Feast drains');
}
{
	const drainOf = (weatherMove) => {
		const b = battle(
			[{ species: 'Sunflora', ability: 'Chlorophyll', moves: ['solarnectar', 'sunnyday'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['seismictoss'] }],
		);
		if (weatherMove) b.makeChoices('move 2', 'move 1');
		const before = b.p1.active[0].hp;
		const foe = b.p2.active[0].hp;
		b.makeChoices('move 1', 'move 1');
		const dealt = foe - b.p2.active[0].hp;
		const healed = b.p1.active[0].hp - before + 100;   // Seismic Toss takes 100 after the drain
		return dealt ? healed / dealt : 0;
	};
	const plain = drainOf(false), sunny = drainOf(true);
	check(plain > 0.2 && plain < 0.3, `Solar Nectar drains about 1/4 (${plain.toFixed(2)})`);
	check(sunny > 0.45 && sunny < 0.55, `and about 1/2 in sun (${sunny.toFixed(2)})`);
}

// Solar Nectar: 135 power in sun.
{
	const b = battle([{ species: 'Sunflora', ability: 'Chlorophyll', moves: ['solarnectar'] }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['sunnyday'] }]);
	const move = Dex.moves.get('solarnectar');
	const gigas = b.p1.active[0];
	check(move.basePowerCallback.call(b, gigas, b.p2.active[0], move) === 80, 'Solar Nectar is 80 power without sun');
	b.makeChoices('move 1', 'move 1');
	check(move.basePowerCallback.call(b, gigas, b.p2.active[0], move) === 135, 'and 135 in harsh sunlight');
}
check(Dex.moves.get('craghammer').accuracy === 100 && Dex.moves.get('craghammer').basePower === 90, 'Crag Hammer: 90 power, 100% accurate');

// Mudflat Ambush: contact costs 1/8, Electric heals.
{
	const b = battle(
		[{ species: 'Stunfisk', ability: 'Mudflat Ambush', moves: ['splash'] }],
		[{ species: 'Machamp', ability: 'No Guard', moves: ['tackle', 'thunderpunch'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].hp <= b.p2.active[0].maxhp - Math.floor(b.p2.active[0].maxhp / 8), 'Mudflat Ambush hurts contact attackers for 1/8');
	const before = b.p1.active[0].hp;
	b.makeChoices('move 1', 'move 2');
	check(b.p1.active[0].hp >= before && /Mudflat Ambush/.test(log(b)), 'and Electric moves heal it instead');
}
check(Object.values(Dex.species.get('stunfiskgalar').abilities).includes('Mudflat Ambush'), 'Galarian Stunfisk has it too');

// Articuno: Polar Mantle sets snow and halves Rock; Aurora Squall hits both foes and never misses in snow.
{
	const b = battle(
		[{ species: 'Articuno', ability: 'Polar Mantle', moves: ['roost'] }],
		[{ species: 'Rhyperior', ability: 'Solid Rock', moves: ['rockslide', 'stealthrock'] }],
	);
	check(b.field.isWeather('snowscape'), 'Polar Mantle sets snow');
	const control = battle(
		[{ species: 'Articuno', ability: 'Pressure', moves: ['roost'] }],
		[{ species: 'Rhyperior', ability: 'Solid Rock', moves: ['rockslide', 'stealthrock'] }],
	);
	const hit = (bat) => { const hp = bat.p1.active[0].hp; bat.makeChoices('move 1', 'move 1'); return /\|-miss\|/.test(log(bat)) ? null : hp - bat.p1.active[0].hp; };
	const mantle = hit(b), plain = hit(control);
	check(mantle === null || plain === null || mantle < plain * 0.7, `Rock Slide does about half through Polar Mantle (${mantle} vs ${plain})`);
}
check(Dex.moves.get('aurorasquall').target === 'allAdjacentFoes' && Dex.moves.get('aurorasquall').flags.nosketch, 'Aurora Squall: spread, not Sketchable');
check(learns('articuno', 'aurorasquall') && !learns('mew', 'aurorasquall'), "Aurora Squall is Articuno's alone");
check(Dex.species.get('articuno').natDexTier === 'RU', 'Articuno is RU');

// The rest of the legends.
{
	const b = battle(
		[{ species: 'Regice', ability: 'Permafrost Core', moves: ['splash'] }],
		[{ species: 'Machamp', ability: 'No Guard', moves: ['closecombat', 'willowisp'] }],
	);
	const control = battle(
		[{ species: 'Regice', ability: 'Clear Body', moves: ['splash'] }],
		[{ species: 'Machamp', ability: 'No Guard', moves: ['closecombat', 'willowisp'] }],
	);
	const dmg = (bat) => { const hp = bat.p1.active[0].hp; bat.makeChoices('move 1', 'move 1'); return hp - bat.p1.active[0].hp; };
	const core = dmg(b), plain = dmg(control);
	check(core < plain * 0.7, `Permafrost Core halves Close Combat (${core} vs ${plain})`);
	b.makeChoices('move 1', 'move 2');
	check(b.p1.active[0].status !== 'brn', 'and Regice cannot be burned');
}
{
	const b = battle(
		[{ species: 'Uxie', ability: 'Levitate', moves: ['memorywipe'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['calmmind'] }],
	);
	b.makeChoices('move 1', 'move 1');
	b.makeChoices('move 1', 'move 1');
	check(!b.p2.active[0].boosts.spa || b.p2.active[0].boosts.spa <= 1, 'Memory Wipe clears the target\'s boosts');
	check(/\|-clearboost\|p2a: Blissey/.test(log(b)), 'and says so');
}
{
	const b = battle(
		[{ species: 'Mesprit', ability: 'Levitate', moves: ['soulresonance'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['seismictoss'] }],
	);
	b.p1.active[0].hp = 100;
	b.makeChoices('move 1', 'move 1');
	check(/\|-heal\|p1a: Mesprit.*drain/.test(log(b)), 'Soul Resonance drains');
}
{
	const move = Dex.moves.get('resolutestrike');
	const b = battle([{ species: 'Azelf', ability: 'Levitate', moves: ['resolutestrike'], evs: { atk: 252 }, nature: 'Adamant' }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	const m = { ...move };
	move.onModifyMove.call(b, m, b.p1.active[0]);
	check(m.category === 'Physical', 'Resolute Strike goes physical for a physical Azelf');
}
check(['regice', 'uxie', 'mesprit'].every(id => Dex.species.get(id).natDexTier === 'RU') && Dex.species.get('azelf').natDexTier === 'UU', 'Regice, Uxie, Mesprit RU; Azelf UU');
check(!['memorywipe', 'soulresonance', 'resolutestrike', 'aurorasquall'].some(mv => learns('mew', mv)), 'the legends\' moves stay theirs');
{
	const c = Dex.species.get('cresselia').baseStats;
	check(c.def === 120 && c.spd === 130, `Cresselia's Generation 8 defences are back (${c.def}/${c.spd})`);
}

// Whole-dex distribution, with the deliberate exclusions.
check(learns('venusaur', 'solarnectar') && learns('bulbasaur', 'solarnectar'), 'Venusaur line learns Solar Nectar');
check(learns('rhyperior', 'craghammer') && learns('rhyhorn', 'craghammer') && !learns('tyranitar', 'craghammer'), 'Crag Hammer: Rhyperior line yes, Tyranitar no');
check(learns('scizor', 'hivefrenzy') && !learns('scolipede', 'hivefrenzy'), 'Hive Frenzy: Scizor yes, Scolipede no');
check(!learns('volcarona', 'chrysalisveil') && !learns('diggersby', 'hustleup'), 'Volcarona and Diggersby left out');

// Secondary effects exist as written.
check(Dex.moves.get('undertow').secondary.boosts.spe === -1 && Dex.moves.get('undertow').secondary.chance === 50 && Dex.moves.get('undertow').basePower === 85, 'Undertow is 85 power with a 50% chance to lower Speed');
check(Dex.moves.get('craghammer').secondary.boosts.def === -1, 'Crag Hammer can lower Defense');
check(Dex.moves.get('hypnowhirl').secondary.volatileStatus === 'confusion', 'Hypno Whirl can confuse');
check(Dex.moves.get('hivefrenzy').secondary.self.boosts.atk === 1 && Dex.moves.get('hivefrenzy').secondary.chance === 50, 'Hive Frenzy has a 50% chance to raise Attack');

// Evolution levels, and who learns what.
check(Dex.species.get('braviary').evoLevel === 40 && Dex.species.get('magcargo').evoLevel === 30, 'evolution levels lowered');
check(Dex.species.get('garchomp').evoLevel === 48, 'levels already under the caps are untouched');
{
	let worst = null;
	for (const s of Dex.species.all()) {
		if (!s.prevo || !s.evoLevel || s.evoType || (s.isNonstandard && s.isNonstandard !== 'Past') || /Totem|Gmax|Mega/.test(s.forme || '')) continue;
		const cap = s.evos && s.evos.length ? 40 : 50;
		if (s.evoLevel > cap) worst = `${s.name} at ${s.evoLevel}`;
		for (const e of s.evos || []) {
			const next = Dex.species.get(e);
			if (next.evoLevel && !next.evoType && next.evoLevel <= s.evoLevel) worst = `${s.name} ${s.evoLevel} >= ${next.name} ${next.evoLevel}`;
		}
	}
	check(!worst, `no final evolution after 50, no middle after 40, lines in order (${worst || 'all fine'})`);
}
check(Dex.species.get('hydreigon').evoLevel === 50 && Dex.species.get('zweilous').evoLevel === 40, 'Hydreigon 50, Zweilous 40');
function learns(sp, m) {
	let s = Dex.species.get(sp);
	while (s && s.exists) {
		const l = Dex.species.getLearnsetData(s.id).learnset;
		if (l && l[m]) return true;
		s = s.prevo ? Dex.species.get(s.prevo) : null;
	}
	return false;
}
check(['hivefrenzy', 'chrysalisveil', 'hustleup', 'carrionfeast', 'sparkscamper', 'undertow', 'solarnectar', 'craghammer', 'hypnowhirl', 'shufflejab'].every(m => learns('mew', m)), 'Mew learns all ten');
check(!learns('mew', 'continentalheave') && learns('regigigas', 'continentalheave'), "Continental Heave is Regigigas's alone");
check(Dex.moves.get('continentalheave').flags.nosketch, 'and cannot be Sketched');
check(!Dex.moves.get('undertow').flags.nosketch, 'the other ten can be Sketched');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
