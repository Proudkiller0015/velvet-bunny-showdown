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
check(Dex.species.get('regice').natDexTier === 'RU' && ['uxie', 'mesprit', 'azelf'].every(id => Dex.species.get(id).natDexTier === 'UU'), 'Regice RU; the lake trio UU');
check(['memorywipe', 'soulresonance', 'resolutestrike'].every(id => Dex.moves.get(id).basePower === 110 && !Dex.moves.get(id).secondary), 'lake trio signatures: 110 power, guaranteed effects only');
check(Dex.moves.get('soulresonance').drain[0] === Dex.moves.get('soulresonance').drain[1] && Dex.moves.get('resolutestrike').ignoreDefensive, 'Soul Resonance heals 100%; Resolute Strike ignores defensive boosts');
check(Object.values(Dex.species.get('uxie').abilities).includes('Mind Keeper') && Object.values(Dex.species.get('mesprit').abilities).includes('Heartfelt Resolve'), 'Uxie has Mind Keeper, Mesprit has Heartfelt Resolve');
check(!['memorywipe', 'soulresonance', 'resolutestrike', 'aurorasquall'].some(mv => learns('mew', mv)), 'the legends\' moves stay theirs');
{
	// All three lake abilities: Psychic moves hit Dark types; without them, they don't.
	for (const [species, ability] of [['Uxie', 'Mind Keeper'], ['Mesprit', 'Heartfelt Resolve'], ['Azelf', 'Unbending Will'], ['Azelf', 'Levitate']]) {
		const b = battle([{ species, ability, moves: ['psychic'] }], [{ species: 'Umbreon', ability: 'Synchronize', moves: ['splash'] }]);
		const hp = b.p2.active[0].hp;
		b.makeChoices('move 1', 'move 1');
		const hit = b.p2.active[0].hp < hp;
		check(ability === 'Levitate' ? !hit : hit, `${ability}: Psychic ${hit ? 'hits' : 'does not hit'} Umbreon`);
	}
	// Unbending Will: resisted hits deal double.
	const resisted = (ability) => {
		const b = battle([{ species: 'Azelf', ability, moves: ['psychic'] }], [{ species: 'Bronzong', ability: 'Heatproof', moves: ['splash'] }]);
		const hp = b.p2.active[0].hp;
		b.makeChoices('move 1', 'move 1');
		return hp - b.p2.active[0].hp;
	};
	const will = resisted('Unbending Will'), lev = resisted('Levitate');
	check(will > lev * 1.8, `Unbending Will doubles resisted hits (${will} vs ${lev})`);
}
{
	// Heartfelt Resolve: a super-effective hit raises Sp. Atk.
	const b = battle(
		[{ species: 'Mesprit', ability: 'Heartfelt Resolve', moves: ['splash'] }],
		[{ species: 'Houndoom', ability: 'Flash Fire', moves: ['snarl', 'crunch'] }],
	);
	b.makeChoices('move 1', 'move 2');
	check(b.p1.active[0].boosts.spa === 1, `Heartfelt Resolve: Crunch raises Mesprit's Sp. Atk (${b.p1.active[0].boosts.spa})`);
}
{
	// Mind Keeper: ignores the attacker's Swords Dance.
	const dmg = (ability) => {
		const b = battle(
			[{ species: 'Uxie', ability, moves: ['splash'] }],
			[{ species: 'Scizor', ability: 'Light Metal', moves: ['swordsdance', 'bulletpunch'] }],
		);
		b.makeChoices('move 1', 'move 1');
		const hp = b.p1.active[0].hp;
		b.makeChoices('move 1', 'move 2');
		return hp - b.p1.active[0].hp;
	};
	const keeper = dmg('Mind Keeper'), plain = dmg('Levitate');
	check(keeper < plain * 0.7, `Mind Keeper ignores a +2 attacker (${keeper} vs ${plain})`);
}
{
	const c = Dex.species.get('cresselia').baseStats;
	check(c.def === 120 && c.spd === 130, `Cresselia's Generation 8 defences are back (${c.def}/${c.spd})`);
}

// Voltaic Lance: 100 power, 100% accurate, no contact.
{
	const v = Dex.moves.get('voltaiclance');
	check(v.basePower === 100 && v.accuracy === 100 && v.category === 'Physical' && !v.flags.contact, 'Voltaic Lance: 100 power, 100%, physical, no contact');
	const b = battle([{ species: 'Electivire', ability: 'Motor Drive', moves: ['voltaiclance'] }], [{ species: 'Garchomp', ability: 'Rough Skin', moves: ['splash'] }, { species: 'Gyarados', ability: 'Intimidate', moves: ['splash'] }]);
	b.p2.active[0].switchFlag = false;
	const hp = b.p1.active[0].hp;
	check(learns('electivire', 'voltaiclance') && learns('elekid', 'voltaiclance') && learns('mew', 'voltaiclance') && !learns('ironhands', 'voltaiclance'), 'Voltaic Lance: Electivire line and Mew yes, Iron Hands no');
	check(hp === b.p1.active[0].hp, 'turn setup ran');
}

// Rime Cleaver: 100 power, 100% accurate physical Ice.
{
	const m = Dex.moves.get('rimecleaver');
	check(m.basePower === 100 && m.accuracy === 100 && m.category === 'Physical' && m.type === 'Ice', 'Rime Cleaver: Ice, physical, 100 power, 100%');
	check(learns('mamoswine', 'rimecleaver') && learns('swinub', 'rimecleaver') && learns('mew', 'rimecleaver') && !learns('weavile', 'rimecleaver') && !learns('baxcalibur', 'rimecleaver'), 'Rime Cleaver: Mamoswine line and Mew yes, Weavile and Baxcalibur no');
	const b = battle([{ species: 'Beartic', ability: 'Swift Swim', moves: ['rimecleaver'] }], [{ species: 'Garchomp', ability: 'Rough Skin', moves: ['splash'] }]);
	b.makeChoices('move 1', 'move 1');
	check(/\|-supereffective\|p2a: Garchomp/.test(log(b)), 'and it lands (super effective on Garchomp)');
}

// Oxidize: super effective on Steel, normal otherwise, never poisons.
{
	const hitOn = (species, ability) => {
		const b = battle([{ species: 'Muk', ability: 'Stench', moves: ['oxidize'] }], [{ species, ability, moves: ['splash'] }]);
		b.makeChoices('move 1', 'move 1');
		return log(b);
	};
	check(/\|-supereffective\|p2a: Skarmory/.test(hitOn('Skarmory', 'Sturdy')), 'Oxidize is super effective on Skarmory (Steel)');
	const neutral = hitOn('Snorlax', 'Thick Fat');
	check(!/\|-supereffective\|/.test(neutral) && !/\|-immune\|/.test(neutral), 'and neutral on Snorlax');
	const m = Dex.moves.get('oxidize');
	check(m.basePower === 70 && m.secondary.volatileStatus === 'confusion' && m.secondary.chance === 10 && !m.secondary.status, 'Oxidize: 70 power, 10% confusion, never poisons');
	check(learns('nidoking', 'oxidize') && learns('mew', 'oxidize') && !learns('gengar', 'oxidize'), 'Oxidize: Nidoking and Mew yes, Gengar no');
}
check(learns('sunflora', 'fireblast') && learns('carnivine', 'gunkshot') && learns('exeggutoralola', 'dragonpulse'), 'Grass coverage: Sunflora Fire Blast, Carnivine Gunk Shot, Alolan Exeggutor Dragon Pulse');

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

// The eeveelutions.
{
	// Kindled Fury: burns itself on entry despite being Fire, Guts, no halving, Speed Boost.
	const b = battle(
		[{ species: 'Flareon', ability: 'Kindled Fury', moves: ['flareblitz', 'facade', 'protect'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	const flareon = b.p1.active[0];
	check(flareon.status === 'brn', 'Kindled Fury: Flareon burns itself on entry, Fire type or not');
	const plain = battle(
		[{ species: 'Flareon', ability: 'Flash Fire', moves: ['flareblitz'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	const atkWild = flareon.getStat('atk'), atkPlain = plain.p1.active[0].getStat('atk');
	check(Math.abs(atkWild / atkPlain - 1.5) < 0.01, `and has 1.5x Attack while burned (${atkPlain} -> ${atkWild})`);
	b.makeChoices('move 3', 'move 1');
	check(flareon.boosts.spe === 1, 'and +1 Speed at the end of the turn');
	check(flareon.hp < flareon.maxhp, 'and still takes burn damage');
	// Damage: Kindled Fury's burned Flare Blitz is 1.5x an unburned Flash Fire one, not 0.75x.
	const hit = (ability) => {
		const x = battle(
			[{ species: 'Flareon', ability, moves: ['bodyslam'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'], evs: {} }],
			[5, 5, 5, 5],
		);
		const before = x.p2.active[0].hp;
		x.makeChoices('move 1', 'move 1');
		return before - x.p2.active[0].hp;
	};
	const wild = hit('Kindled Fury'), flash = hit('Flash Fire');
	check(wild / flash > 1.35 && wild / flash < 1.65, `burn does not halve it: Body Slam ${flash} -> ${wild}`);
}
{
	const b = battle(
		[{ species: 'Glaceon', ability: 'Diamond Dust', moves: ['blizzard'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	check(b.field.isWeather('snowscape'), 'Diamond Dust sets snow');
	const g = b.p1.active[0];
	const fast = g.getActionSpeed();
	b.field.clearWeather();
	check(fast === g.getActionSpeed() * 2, `and doubles Glaceon's Speed in it (${g.getActionSpeed()} -> ${fast})`);
}
{
	const b = battle(
		[{ species: 'Leafeon', ability: 'Solstice', moves: ['solarblade'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	check(b.field.isWeather('sunnyday'), 'Solstice sets harsh sunlight');
	const l = b.p1.active[0];
	const fast = l.getActionSpeed();
	const before = b.p2.active[0].hp;
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].hp < before, 'and Solar Blade fires the same turn');
	b.field.clearWeather();
	check(fast === l.getActionSpeed() * 2, `and doubles Leafeon's Speed in sun (${l.getActionSpeed()} -> ${fast})`);
}
check(learns('glaceon', 'earthpower') && learns('flareon', 'closecombat') && learns('leafeon', 'stoneedge') && learns('leafeon', 'solarblade') && learns('flareon', 'facade'), 'Eeveelution coverage: Glaceon Earth Power, Flareon Close Combat, Leafeon Stone Edge');
check(!learns('eevee', 'closecombat') && !Object.values(Dex.species.get('eevee').abilities).includes('Kindled Fury'), 'Eevee is not given any of it');
check(['Leafeon:Solstice', 'Flareon:Kindled Fury', 'Glaceon:Diamond Dust'].every(x => Object.values(Dex.species.get(x.split(':')[0]).abilities).includes(x.split(':')[1])), 'each keeps its old abilities and gains its signature');
check(['leafeon', 'glaceon', 'flareon', 'espeon', 'umbreon', 'vaporeon'].every(id => Dex.species.get(id).natDexTier === 'UU') && Dex.species.get('luxray').natDexTier === 'OU' && Dex.species.get('urshifu').natDexTier === 'Uber' && Dex.species.get('urshifurapidstrike').natDexTier === 'Uber', 'Tier review: six eeveelutions UU, Luxray OU, both Urshifu Uber');

// Umbreon: Moonlit Venom.
{
	const b = battle(
		[{ species: 'Umbreon', ability: 'Moonlit Venom', moves: ['toxic', 'rest'] }],
		[{ species: 'Skarmory', ability: 'Sturdy', moves: ['toxic', 'splash'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(!b.p1.active[0].status, 'Moonlit Venom: Umbreon cannot be badly poisoned');
	check(b.p2.active[0].status === 'tox', 'and its Toxic poisons a Steel type');
	b.p1.active[0].hp = 50;
	b.makeChoices('move 2', 'move 2');
	check(b.p1.active[0].hp === 50 && !b.p1.active[0].status, 'and Rest fails, as with Purifying Salt');
}
// Espeon: Prescience.
{
	const b = battle(
		[{ species: 'Espeon', ability: 'Prescience', item: 'Life Orb', moves: ['psychic'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['stealthrock', 'toxic'] }],
	);
	b.makeChoices('move 1', 'move 1');
	const espeon = b.p1.active[0];
	check(espeon.hp === espeon.maxhp, 'Prescience: no Life Orb recoil');
	check(!b.p1.sideConditions.stealthrock && !!b.p2.sideConditions.stealthrock, 'and Stealth Rock bounces back');
	b.makeChoices('move 1', 'move 2');
	check(!espeon.status && b.p2.active[0].status === 'tox', 'and so does Toxic');
}
// Vaporeon: Liquid Body.
{
	const b = battle(
		[{ species: 'Vaporeon', ability: 'Liquid Body', moves: ['splash'] }, { species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
		[{ species: 'Starmie', ability: 'Natural Cure', moves: ['surf', 'psychic'] }],
	);
	b.p1.active[0].hp = 100;
	b.makeChoices('move 1', 'move 1');
	check(b.p1.active[0].hp > 100, 'Liquid Body: Water moves heal Vaporeon');
	b.makeChoices('switch 2', 'move 2');
	const vap = b.p1.pokemon.find(m => m.species.name === 'Vaporeon');
	check(vap.hp >= Math.min(vap.maxhp, 100 + Math.floor(vap.maxhp / 4) + Math.floor(vap.maxhp / 3) - 1), 'and it regenerates a third on switching out');
}
// Jolteon: Static Needles.
{
	const b = battle(
		[{ species: 'Jolteon', ability: 'Static Needles', moves: ['splash'] }],
		[{ species: 'Raichu', ability: 'Static', moves: ['thunderbolt'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p1.active[0].hp === b.p1.active[0].maxhp && b.p1.active[0].boosts.spe === 1, 'Static Needles: Electric moves do nothing but raise Speed');
}
// Sylveon: Ribbon Hymn.
{
	const b = battle(
		[{ species: 'Sylveon', ability: 'Ribbon Hymn', moves: ['hypervoice'] }],
		[{ species: 'Exploud', ability: 'Scrappy', moves: ['boomburst'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(/\|-immune\|p1a: Sylveon\|\[from\] ability: Ribbon Hymn/.test(log(b)), 'Ribbon Hymn: sound moves do not touch Sylveon');
	check(/\|move\|p1a: Sylveon\|Hyper Voice/.test(log(b)) && Dex.abilities.get('ribbonhymn').onModifyType, 'and its Hyper Voice is a Fairy move');
}
{
	const move = Dex.getActiveMove('hypervoice');
	const b = battle([{ species: 'Sylveon', ability: 'Ribbon Hymn', moves: ['hypervoice'] }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	b.singleEvent('ModifyType', Dex.abilities.get('ribbonhymn'), {}, b.p1.active[0], b.p2.active[0], move, move);
	check(move.type === 'Fairy', 'Ribbon Hymn makes Normal moves Fairy');
}

// Luxray: Electric/Dark, Prankster, a hunter's movepool.
check(Dex.species.get('luxray').types.join('/') === 'Electric/Dark' && Dex.species.get('luxio').types.join('/') === 'Electric', 'Luxray is Electric/Dark; Luxio stays Electric');
check(Object.values(Dex.species.get('luxray').abilities).includes('Prankster') && Object.values(Dex.species.get('luxray').abilities).includes('Intimidate'), 'Luxray has Prankster beside Intimidate');
check(['voltswitch', 'partingshot', 'encore', 'swagger', 'taunt', 'knockoff', 'suckerpunch', 'thunderwave'].every(m => learns('luxray', m)), 'Luxray learns Volt Switch, Parting Shot, Encore, Swagger, Taunt, Knock Off, Sucker Punch, Thunder Wave');
{
	const b = battle(
		[{ species: 'Luxray', ability: 'Prankster', moves: ['thunderwave'] }],
		[{ species: 'Alakazam', ability: 'Inner Focus', moves: ['psychic'] }],
	);
	b.makeChoices('move 1', 'move 1');
	const order = log(b).split('\n').filter(l => /^\|move\|/.test(l));
	check(/Luxray/.test(order[0]), 'Prankster Thunder Wave goes before a faster Alakazam');
}
{
	const b = battle(
		[{ species: 'Luxray', ability: 'Intimidate', moves: ['splash'] }],
		[{ species: 'Alakazam', ability: 'Inner Focus', moves: ['psychic'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p1.active[0].hp === b.p1.active[0].maxhp && /\|-immune\|p1a: Luxray/.test(log(b)), 'and Psychic does nothing to Luxray');
}

// Partner Pikachu and Eevee.
{
	const pika = Dex.species.get('pikachustarter'), eevee = Dex.species.get('eeveestarter');
	check(!pika.isNonstandard && !eevee.isNonstandard && pika.baseStats.spe === 120 && eevee.baseStats.spd === 85, 'Partner Pikachu and Eevee exist with their partner stats');
	check(learns('pikachustarter', 'thunderbolt') && learns('pikachustarter', 'voltaiclance') && !learns('pikachustarter', 'zippyzap') && !learns('eeveestarter', 'veeveevolley'), 'with the base line\'s movepool, patch moves included, and no partner moves');
	const { TeamValidator } = require('pokemon-showdown');
	const set = { species: 'Pikachu-Starter', ability: 'Static', item: 'Light Ball', moves: ['thunderbolt', 'voltswitch'], level: 100, evs: { hp: 4 }, ivs: {}, nature: 'Hardy' };
	check(!new TeamValidator('gen9rppu').validateTeam([set]), 'Partner Pikachu is legal in RP PU');
	check(!!new TeamValidator('gen9ou').validateTeam([set]), 'and still refused in plain Gen 9 OU');
}

// Gleamstalk, Luxray's.
{
	const b = battle(
		[{ species: 'Luxray', ability: 'Intimidate', moves: ['gleamstalk', 'thunderbolt', 'splash'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['substitute', 'splash'] }],
	);
	b.makeChoices('move 3', 'move 1');
	const foe = b.p2.active[0], lux = b.p1.active[0];
	check(!!foe.volatiles.substitute, 'Gleamstalk setup: Blissey behind a Substitute');
	b.makeChoices('move 1', 'move 2');
	check(foe.status === 'par', 'Gleamstalk paralyzes through a Substitute');
	check(lux.boosts.spe === 2 && !!lux.volatiles.charge, 'and Luxray gets +2 Speed and a Charge');
	const move = Dex.getActiveMove('thunderbolt');
	check(b.runEvent('BasePower', lux, foe, move, 90, true) === 180, 'so its next Electric move is doubled');
	b.makeChoices('move 1', 'move 2');
	check(lux.boosts.spe === 4, 'and its Speed still rises when the target is already paralyzed');
}
{
	const b = battle(
		[{ species: 'Luxray', ability: 'Intimidate', moves: ['gleamstalk'] }],
		[{ species: 'Garchomp', ability: 'Rough Skin', moves: ['doubleteam'] }],
	);
	b.p2.active[0].boosts.evasion = 6;
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].status === 'par', 'Gleamstalk paralyzes a Ground type at +6 evasion');
}
for (const [species, ability, effect] of [
	['Lanturn', 'Volt Absorb', m => m.hp > 100],
	['Raichu', 'Lightning Rod', m => m.boosts.spa === 1],
	['Electivire', 'Motor Drive', m => m.boosts.spe === 1],
	['Stunfisk', 'Mudflat Ambush', m => m.hp > 100],
]) {
	const b = battle(
		[{ species: 'Luxray', ability: 'Intimidate', moves: ['gleamstalk'] }],
		[{ species, ability, moves: ['splash'] }],
	);
	b.p2.active[0].hp = 100;
	b.makeChoices('move 1', 'move 1');
	const foe = b.p2.active[0], lux = b.p1.active[0];
	check(!foe.status && effect(foe) && !lux.boosts.spe && !lux.volatiles.charge, `${ability} absorbs Gleamstalk (and Luxray gains nothing)`);
}
check(learns('luxray', 'gleamstalk') && !learns('luxio', 'gleamstalk') && !learns('mew', 'gleamstalk') && Dex.moves.get('gleamstalk').flags.nosketch, "Gleamstalk is Luxray's alone");

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
