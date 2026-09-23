'use strict';
/**
 * The Showdown half of RP encounters. Loaded by the server config, so it runs
 * in the process that owns the rooms, the users and the battles.
 *
 * How an encounter happens:
 *
 *   1. On Discord, a player types `!encounter 3 25` in the channel their
 *      character is standing in. The Discord bot signs a request - who, where,
 *      how many badges, level cap, which balls the character is carrying - and
 *      POSTs it to /rp/encounter.
 *   2. This checks the signature, works out the place from the channel, and
 *      rolls what appears (src/encounters.js). It hands the result to the RP
 *      bot, which challenges the player under the wild Pokemon's or trainer's
 *      name, and answers Discord with what appeared so it can be announced.
 *   3. The battle is played. A ball can only be thrown from the button, and
 *      only while the character has one of that kind left.
 *   4. Discord asks /rp/result/<id> until the battle is over, then pays the
 *      character, takes away the balls that were thrown, and records anything
 *      that was caught.
 *
 * Why signed: the endpoint is on the public internet, and anyone who could
 * post to it could hand themselves any encounter they liked. The Discord bot
 * holds a private key and this holds only the public half, so there is no
 * secret on this server to leak and nothing to configure on the host.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const E = require('./encounters');

const REGIONS = {
	kagura: () => require('./encounter-tables/kagura'),
	sinnoh: () => require('./encounter-tables/sinnoh'),
};
const PUBLIC_KEY_FILE = path.join(__dirname, '..', 'config', 'rp-encounter-key.pub.pem');
const RP_ROOM = 'roleplay';
const MAX_SKEW_MS = 5 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
const RESULT_KEEP_MS = 6 * 60 * 60 * 1000;

const toID = E.toID;

// ------------------------------------------------------------------ signing

function publicKey() {
	const pem = process.env.RP_ENCOUNTER_PUBLIC_KEY || (fs.existsSync(PUBLIC_KEY_FILE) ? fs.readFileSync(PUBLIC_KEY_FILE, 'utf8') : '');
	return pem ? crypto.createPublicKey(pem) : null;
}

/** `{ payload, sig }`, both base64: payload is the JSON request, sig its ed25519 signature. */
function verify(body, key = publicKey()) {
	if (!key) return { error: 'This server has no RP key configured.' };
	let payload;
	try {
		const bytes = Buffer.from(String(body.payload || ''), 'base64');
		const sig = Buffer.from(String(body.sig || ''), 'base64');
		if (!crypto.verify(null, bytes, key, sig)) return { error: 'Bad signature.' };
		payload = JSON.parse(bytes.toString('utf8'));
	} catch (e) {
		return { error: 'Unreadable request.' };
	}
	if (!payload || Math.abs(Date.now() - Number(payload.at)) > MAX_SKEW_MS) return { error: 'Request is too old.' };
	return { payload };
}

// ------------------------------------------------------------------- places

/** Which place a Discord channel is in. Channel names are unique across the region. */
function placeFor(region, channel) {
	const load = REGIONS[toID(region || 'kagura')];
	if (!load) return null;
	const tables = load();
	const name = String(channel || '').replace(/^#/, '').toLowerCase();
	for (const [id, place] of Object.entries(tables.locations)) {
		const channels = new Set([...(place.wild || []), ...(place.noTrainers || []), ...(place.channels || [])]);
		if (channels.has(name) || id === name) return { id, place, channel: name };
	}
	return null;
}

// --------------------------------------------------------------- encounters

/** id -> everything about one encounter, from the roll to the result. */
const encounters = new Map();

function sweep() {
	const now = Date.now();
	for (const [id, enc] of encounters) {
		if (now - enc.createdAt > RESULT_KEEP_MS) encounters.delete(id);
		else if (enc.status === 'waiting' && now - enc.createdAt > CHALLENGE_MS + 30000) enc.status = 'expired';
	}
}

/** The encounter a player already has open, if any - so declining one doesn't reroll it. */
function openFor(userid) {
	sweep();
	for (const enc of encounters.values()) {
		if (enc.userid === userid && (enc.status === 'waiting' || enc.status === 'battling')) return enc;
	}
	return null;
}

/**
 * Handle a verified request. Returns the JSON to answer with.
 *
 * `deps` is what this needs from the running server - kept separate so the
 * logic can be tested without one.
 */
function requestEncounter(payload, deps) {
	const userid = toID(payload.showdown);
	if (!userid) return { ok: false, code: 'noname', message: 'No Showdown name given.' };
	if (payload.tutorial) return requestTutorial(payload, deps);

	let found = placeFor(payload.region, payload.channel);
	// Staff can summon something anywhere - an event channel isn't on the map.
	if (!found && payload.summon) {
		const name = String(payload.channel || 'event').replace(/^#/, '').toLowerCase();
		found = { id: 'event', channel: name, place: { name: `#${name}`, types: [], trainers: [], wild: [name], channels: [name] } };
	}
	if (!found) {
		return { ok: false, code: 'noplace', message: `#${payload.channel} isn't a place on the map, so nothing can be met here. Use it in the channel your character is in.` };
	}
	const { place } = found;
	/*
	 * A spot inside a place: a channel with Pokémon of its own (Sakura's old well,
	 * the lamp room at Beacon Rock). It replaces the place's types, common and rare
	 * for wild Pokémon met in that channel; everything else - which channels have
	 * wild Pokémon or trainers, the levels - is still the place's.
	 */
	const spot = place.spots && place.spots[found.channel];
	const wildPlace = spot ? { ...place, types: spot.types || place.types, common: spot.common || place.common, rare: spot.rare || place.rare } : place;
	const wildHere = (place.wild || []).includes(found.channel);
	const trainersHere = (place.trainers || []).length && !(place.noTrainers || []).includes(found.channel);

	let kind = payload.kind === 'wild' || payload.kind === 'trainer' ? payload.kind : 'any';
	if (payload.summon) kind = payload.summon.kind === 'trainer' ? 'trainer' : 'wild';
	else if (kind === 'wild' && !wildHere) {
		const where = (place.wild || []).map(c => `#${c}`).join(', ');
		return { ok: false, code: 'nowild', message: `No wild Pokémon in #${found.channel}.` + (where ? ` Try ${where}.` : '') };
	}
	if (!payload.summon && kind === 'trainer' && !trainersHere) {
		return { ok: false, code: 'notrainers', message: `Nobody is looking for a battle in #${found.channel}.` };
	}
	if (kind === 'any') {
		if (!wildHere && !trainersHere) {
			return { ok: false, code: 'nothing', message: `Nothing to encounter in #${found.channel}. Head outside, onto a route or into the wilds.` };
		}
		kind = wildHere && (!trainersHere || Math.random() < 0.7) ? 'wild' : 'trainer';
	}

	const existing = openFor(userid);
	if (existing && payload.summon) {
		return { ok: false, code: 'busy', message: `${payload.showdown} already has an encounter open (${E.describe(existing)}). Finish it or use !complete first.` };
	}
	if (existing) {
		if (!deps.isOnline(userid)) {
			return { ok: false, code: 'offline', message: `You're not on Showdown as ${payload.showdown} right now.`, encounter: publicView(existing) };
		}
		// Declining it (or having it called off) and asking again brings the same
		// one back - checked against the box and bag as they are now.
		if (payload.box) existing.box = normaliseBox(payload.box);
		if (payload.balls && typeof payload.balls === 'object') existing.balls = normaliseBalls(payload.balls);
		if (payload.items && typeof payload.items === 'object') existing.items = normaliseItems(payload.items);
		if (payload.badges !== undefined) existing.badges = E.clampBadges(payload.badges);
		// A team picked since it was first sent: this time it opens rather than challenges.
		if (Array.isArray(payload.playerTeam) && payload.playerTeam.length) existing.playerTeam = payload.playerTeam.slice(0, 6);
		if (existing.status === 'waiting') deps.spawn(existing);
		return { ok: true, again: true, encounter: publicView(existing) };
	}

	if (!deps.isOnline(userid)) {
		return { ok: false, code: 'offline', message: `You're not on Showdown as **${payload.showdown}** right now. Open the Showdown site, log in with that name, then try again.` };
	}

	const badges = E.clampBadges(payload.badges);
	const levelCap = payload.levelCap ? E.clampLevel(payload.levelCap) : null;
	// The trainer's strongest Pokemon, which both a wild encounter and a trainer are measured against.
	const ace = E.aceLevel(payload.box);
	let rolled;
	if (payload.summon) {
		// Staff choosing what appears. The Discord bot only signs this for admins.
		rolled = summoned(payload.summon, { place, badges, levelCap, ace });
		if (rolled.error) return { ok: false, code: 'summon', message: rolled.error };
	} else {
		rolled = kind === 'wild'
			? E.rollWild({ place: wildPlace, badges, levelCap, shiny: payload.shiny || {}, ace })
			: E.rollTrainer({ place, badges, levelCap, ace });
	}
	if (!rolled.team.length) return { ok: false, code: 'empty', message: 'Nothing turned up. Try again.' };

	const enc = {
		id: crypto.randomBytes(8).toString('hex'),
		createdAt: Date.now(),
		userid,
		showdown: payload.showdown,
		character: payload.character || '',
		discord: payload.discord || '',
		place: found.id,
		placeName: place.name,
		channel: found.channel,
		balls: payload.balls && typeof payload.balls === 'object' ? normaliseBalls(payload.balls) : null,
		items: payload.items && typeof payload.items === 'object' ? normaliseItems(payload.items) : null,
		badges,
		warning: String(payload.warning || '').slice(0, 300),
		box: normaliseBox(payload.box),
		/*
		 * The team the player picked on Discord (Patch 2.1).
		 *
		 * With it, the encounter does not arrive as a challenge to accept: the
		 * server opens the battle itself, the same as a battle between two
		 * players. Without it, the bot challenges as it always has - so an
		 * encounter still works for somebody who has not picked a team.
		 */
		playerTeam: Array.isArray(payload.playerTeam) && payload.playerTeam.length ? payload.playerTeam.slice(0, 6) : null,
		caught: Math.max(0, Math.floor(Number(payload.caught) || 0)),
		gimmicks: payload.gimmicks && typeof payload.gimmicks === 'object'
			? { mega: !!payload.gimmicks.mega, zmove: !!payload.gimmicks.zmove, dynamax: !!payload.gimmicks.dynamax, tera: !!payload.gimmicks.tera }
			: null,
		...rolled,
		status: 'waiting',
		result: null,
	};
	encounters.set(enc.id, enc);
	deps.spawn(enc);
	return { ok: true, encounter: publicView(enc) };
}

/**
 * The tutorial battle: a Lv. 5 Rattata challenges the player, whose team the
 * format replaces with a Lv. 5 Pikachu. 1 Potion and 1 Pokéball, no box, no
 * cooldown. Asked for from Discord (`!tutorial`) or on Showdown (`/tutorial`).
 */
function requestTutorial(payload, deps) {
	const userid = toID(payload.showdown);
	if (!deps.isOnline(userid)) {
		return { ok: false, code: 'offline', message: `You're not on Showdown as **${payload.showdown}** right now. Open the Showdown site, log in with that name, then try again.` };
	}
	const existing = openFor(userid);
	if (existing) {
		if (existing.tutorial && existing.status === 'waiting') {
			deps.spawn(existing);
			return { ok: true, again: true, encounter: publicView(existing) };
		}
		return { ok: false, code: 'busy', message: `${payload.showdown} already has an encounter open (${E.describe(existing)}). Finish it first.` };
	}
	const enc = {
		id: crypto.randomBytes(8).toString('hex'),
		createdAt: Date.now(),
		userid,
		showdown: payload.showdown,
		character: payload.character || '',
		discord: payload.discord || '',
		place: 'tutorial', placeName: 'the tutorial', channel: String(payload.channel || ''),
		balls: { ...E.TUTORIAL_BAG.balls }, items: { ...E.TUTORIAL_BAG.items },
		warning: '', box: null, gimmicks: null,
		kind: 'wild', double: false, name: 'Wild Rattata', avatar: '', team: [E.TUTORIAL_RATTATA],
		ai: 'easy', format: E.TUTORIAL_FORMAT, badges: 0,
		tutorial: true,
		status: 'waiting',
		result: null,
	};
	encounters.set(enc.id, enc);
	deps.spawn(enc);
	return { ok: true, encounter: publicView(enc) };
}

/**
 * An encounter staff asked for by name: a species and level, or a trainer
 * class. Legendaries can be summoned - an event might want one to battle - but
 * the battle still refuses to let anyone catch one.
 */
/** What a cut Pokemon is forgiven for not knowing, the same table the RP formats read. */
let cutMoves = null;
function cutFor(species) {
	if (!cutMoves) { try { cutMoves = require('../data/velvet/cut-moves.json'); } catch (e) { cutMoves = {}; } }
	const base = species.baseSpecies && species.baseSpecies !== species.name ? toID(species.baseSpecies) : species.id;
	return new Set([...(cutMoves[base] || []), ...(cutMoves[species.id] || [])]);
}

/**
 * The moves and ability staff asked for, checked.
 *
 * "Legal" here is RP's idea of it: anything in the learnset of the Pokemon or
 * anything before it in its line, whatever the level, plus the machine moves a
 * cut Pokemon never had the chance at. The ability has to be one of its own.
 */
function chosenSet(Dex, species, summon) {
	const out = {};
	const wanted = Array.isArray(summon.moves) ? summon.moves : String(summon.moves || '').split(',');
	const names = wanted.map(m => String(m).trim()).filter(Boolean).slice(0, 4);
	if (names.length) {
		const RS = require('./role-sets');
		const pool = RS.learnable(Dex, species);
		const cut = cutFor(species);
		const moves = [];
		for (const name of names) {
			const move = Dex.moves.get(name);
			if (!move.exists) return { error: `There's no move called "${name}".` };
			if (!pool.has(move.id) && !cut.has(move.id)) return { error: `${species.name} can't learn ${move.name}.` };
			if (!moves.includes(move.name)) moves.push(move.name);
		}
		out.moves = moves;
	}
	if (summon.ability) {
		const want = toID(summon.ability);
		const own = Object.values(species.abilities || {}).filter(Boolean);
		const found = own.find(a => toID(a) === want);
		/*
		 * A Mega's ability is not up for discussion, and a set copied out of the
		 * teambuilder carries the ability it had BEFORE it mega evolved - "Ability:
		 * Frisk" on a Mega Banette. Refusing that would mean every pasted Mega set
		 * is rejected over a line that was right when it was written, so if the
		 * ability belongs to the form it changes from, the form's own is used.
		 */
		const base = species.changesFrom || (species.requiredItem && species.baseSpecies);
		const beforeMega = base ? Object.values(Dex.species.get(base).abilities || {}).filter(Boolean) : [];
		if (!found && beforeMega.some(a => toID(a) === want)) {
			out.ability = own[0];
		} else if (!found) {
			return { error: `${species.name} can't have ${Dex.abilities.get(summon.ability).name || summon.ability}. It can have: ${own.join(', ')}.` };
		} else {
			out.ability = found;
		}
	}
	return { set: out };
}

function summoned(summon, { place, badges, levelCap, ace = null }) {
	if (summon.kind === 'trainer') {
		const cls = summon.classId ? E.findClass(summon.classId) : null;
		if (summon.classId && !cls) return { error: `No trainer class called "${summon.classId}".` };
		const rolled = E.rollTrainer({ place, badges, levelCap, ace, classId: cls && cls.id, double: summon.double === undefined ? null : !!summon.double });
		/*
		 * A trainer the story has decided about: their name, and a Pokémon they
		 * must be carrying. The rest of the team is rolled as usual, so they still
		 * fit the place and the badge count.
		 */
		/*
		 * A name the story chose, under the class's title: "Champion Ballsack",
		 * the way every rolled trainer reads. The title is left off when the name
		 * already carries it, or when the two together would not fit.
		 *
		 * 18 characters, because that is what a Showdown name may be - a longer
		 * one is refused at login and the battle never starts (E.trainerName
		 * trims the rolled ones to the same limit for the same reason).
		 */
		if (summon.name) {
			const name = String(summon.name).trim().slice(0, 18);
			const titles = cls ? [cls.title, cls.short].filter(Boolean) : [];
			const already = titles.some(t => name.toLowerCase().startsWith(`${t.toLowerCase()} `));
			const titled = already ? null : titles.map(t => `${t} ${name}`).find(full => full.length <= 18);
			rolled.name = titled || name;
		}
		// How well they play, when the scene wants a pushover or a wall. Left out,
		// the badge count decides it, as it does for any trainer on the route.
		if (['easy', 'normal', 'hard'].includes(summon.ai)) rolled.ai = summon.ai;
		const Dex2 = require('./rp-dex')();
		const written = [];
		for (const want of (Array.isArray(summon.with) ? summon.with : []).slice(0, 6)) {
			// A name on its own, or a whole Pokémon: nickname, level, shiny, an
			// item, a set. Whatever is left out is rolled to suit the route.
			const wish = typeof want === 'string' ? { species: want } : (want || {});
			const species = Dex2.species.get(wish.species);
			if (!species.exists) return { error: `No Pokémon called "${wish.species || want}".` };
			/*
			 * A written level is the level, whatever the badges say - an arranged
			 * scene is allowed a Lv. 100 Champion in front of a two-badge trainer,
			 * and a Lv. 1 joke. "cap" asks for the player's own cap instead, and
			 * nothing written at all takes whatever the route rolled.
			 */
			const level = wish.level === 'cap' ? E.clampLevel(levelCap || 5) :
				wish.level ? E.clampLevel(wish.level) :
				rolled.team.length ? Math.max(...rolled.team.map(m => m.level)) : E.clampLevel(levelCap || 5);
			const set = E.trainerSet(species, level, badges, Math.random);
			const custom = chosenSet(Dex2, species, wish);
			if (custom.error) return custom;
			Object.assign(set, custom.set);
			if (wish.shiny) set.shiny = true;
			if (wish.nickname) set.name = String(wish.nickname).slice(0, 18);
			if (wish.item) {
				const item = Dex2.items.get(wish.item);
				if (!item.exists) return { error: `There's no item called "${wish.item}".` };
				set.item = item.name;
			}
			if (!written.some(m => toID(m.species) === species.id)) written.push(set);
		}
		/*
		 * The written ones lead the team, in the order they were written, and the
		 * route fills whatever is left - so a trainer written out to the last slot
		 * is exactly that trainer, and one given a single Pokémon still brings
		 * friends. (They used to be appended, which meant a full rolled team took
		 * them one at a time into its last slot and only the last one survived.)
		 */
		if (written.length) {
			const size = Math.max(written.length, rolled.team.length);
			const rest = rolled.team.filter(m => !written.some(w => toID(w.species) === toID(m.species)));
			rolled.team = [...written, ...rest].slice(0, Math.min(6, size));
		}
		return rolled;
	}
	const Dex = require('./rp-dex')();
	const species = Dex.species.get(summon.species);
	if (!species.exists || !E.encounterable(species)) return { error: `No Pokémon called "${summon.species}".` };
	// A written level ignores the badge cap on purpose; "cap" asks for it.
	const level = E.clampLevel(summon.level === 'cap' ? (levelCap || 5) : (summon.level || levelCap || 5));
	const set = E.wildSet(species, level);
	if (summon.shiny) set.shiny = true;
	/*
	 * A set staff chose: moves and an ability, for when the scene wants a
	 * particular joke or a particular threat. Legal only - a move the Pokemon can
	 * learn (RP's rules, so level and the TMs a cut Pokemon never got are
	 * forgiven) and an ability it can actually have.
	 */
	const custom = chosenSet(Dex, species, summon);
	if (custom.error) return custom;
	Object.assign(set, custom.set);
	if (summon.nickname) set.name = String(summon.nickname).slice(0, 18);
	if (summon.item) {
		const item = Dex.items.get(summon.item);
		if (!item.exists) return { error: `There's no item called "${summon.item}".` };
		set.item = item.name;
	}
	// Staff can summon two at once: a wild double battle (a second species, or two of the same).
	if (summon.double) {
		const second = Dex.species.get(summon.species2 || summon.species);
		if (!second.exists || !E.encounterable(second)) return { error: `No Pokémon called "${summon.species2}".` };
		return {
			kind: 'wild', double: true, name: 'Wild Pokemon', avatar: '', team: [set, E.wildSet(second, level)],
			ai: badges >= 6 ? 'hard' : badges >= 3 ? 'normal' : 'easy', format: E.WILD_DOUBLE_FORMAT, badges,
		};
	}
	return {
		kind: 'wild', double: false, name: E.wildName(species), avatar: '', team: [set],
		ai: badges >= 6 ? 'hard' : badges >= 3 ? 'normal' : 'easy', format: E.WILD_FORMAT, badges,
	};
}

/**
 * Finish an encounter without a battle, for staff: it counts as caught, won
 * or lost as they say, and the RP bot stops waiting for the player.
 */
function completeEncounter(payload, deps) {
	const enc = payload.id ? encounters.get(payload.id) : openFor(toID(payload.showdown));
	if (!enc) return { ok: false, code: 'none', message: 'No open encounter to complete.' };
	const outcome = ['caught', 'won', 'lost', 'cancelled'].includes(payload.outcome) ? payload.outcome : null;
	if (!outcome) return { ok: false, code: 'bad', message: 'Say caught, won, lost or cancel.' };
	if (outcome === 'caught' && enc.kind !== 'wild') return { ok: false, code: 'bad', message: "You can't catch a trainer's Pokémon." };
	const mon = enc.team[enc.team.length - 1];
	const ball = E.findBall(payload.ball || 'poke');
	enc.result = {
		outcome,
		caught: outcome === 'caught' ? { species: mon.species, level: mon.level, ball: ball ? ball.id : 'poke', shiny: !!mon.shiny } : null,
		ballsUsed: outcome === 'caught' && ball ? { [ball.id]: 1 } : {},
		player: enc.showdown,
		byStaff: true,
	};
	enc.status = 'done';
	if (deps.cancel) deps.cancel(enc);
	return { ok: true, encounter: publicView(enc) };
}

function normaliseItems(items) {
	const out = {};
	for (const [name, count] of Object.entries(items)) {
		const item = E.findBattleItem(name);
		if (item && Number(count) > 0) out[item.id] = (out[item.id] || 0) + Math.floor(Number(count));
	}
	return out;
}

/** Items of a kind used so far in a battle by this player, read off its log. */
function usedInLog(lines, side, itemName) {
	const needle = `|-message|${side} used `;
	return lines.filter(l => l.startsWith(needle) && new RegExp(`^\\|-message\\|.+ used an? ${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} on `).test(l)).length;
}

/** Whether a character may use this item now: an encounter, and one left in the bag. */
function canUseItem(enc, itemId, usedSoFar) {
	if (!enc) return { ok: false, message: 'Items can only be used in RP encounters (from !encounter on Discord).' };
	const item = E.findBattleItem(itemId);
	const have = enc.items ? enc.items[itemId] || 0 : 0;
	if (have - usedSoFar > 0) return { ok: true, left: have - usedSoFar - 1 };
	return { ok: false, message: have ? `That was your last ${item.name}.` : `${enc.character || 'Your character'} doesn't have a ${item.name}. Buy some with !buy on Discord.` };
}

/*
 * Healing items in RP battles between players.
 *
 * Showdown cannot ask Discord what is in a bag, and a PvP challenge is not
 * announced in advance, so the bot pushes the table: for each player with a
 * Showdown name and a character selected, that character's battle items and
 * whether it is an NPC. It replaces the whole table on every push (on start,
 * when a bag changes, and every few minutes, which also refills it after this
 * server restarts). An NPC has 5 of each and nothing is taken; a player's items
 * come off the bag when the replay is settled on Discord.
 */
const NPC_ITEMS_EACH = 5;
let bags = new Map();
function setBags(payload) {
	const next = new Map();
	for (const p of Array.isArray(payload.players) ? payload.players.slice(0, 2000) : []) {
		const id = toID(p.showdown);
		if (!id) continue;
		const items = {};
		for (const [itemId, n] of Object.entries(p.items || {})) {
			const item = E.findBattleItem(itemId);
			if (item && Number(n) > 0) items[item.id] = Math.floor(Number(n));
		}
		const entry = { character: String(p.character || '').slice(0, 60), npc: !!p.npc, items };
		// Patch 1.5: what a PvP or NPC battle checks - the box, badges and story items (not sent for NPCs).
		if (Array.isArray(p.box)) {
			entry.box = normaliseBox(p.box.map(m => (Array.isArray(m) ? { species: m[0], level: m[1], fainted: !!m[2], daycare: !!m[3] } : m)));
			entry.badges = Math.max(0, Math.min(8, Number(p.badges) || 0));
			const g = p.gimmicks || {};
			entry.gimmicks = { mega: !!g.mega, zmove: !!g.zmove, dynamax: !!g.dynamax, tera: !!g.tera };
		}
		next.set(id, entry);
	}
	bags = next;
	agreed = new Set((Array.isArray(payload.matches) ? payload.matches.slice(0, 500) : [])
		.map(m => String(m).toLowerCase()).filter(m => /^[a-z0-9]+-[a-z0-9]+$/.test(m)));
	return { ok: true, players: bags.size, matches: agreed.size };
}
function bagFor(userid) {
	return bags.get(toID(userid)) || null;
}

/*
 * The PvP matches both players agreed to on Discord with `!pvp`, pushed with
 * the bags. Only these are checked the way the story is, and only these are
 * settled for EXP; any other battle between two players is a friendly, so
 * nothing is checked, nothing is locked, and nothing counts. Keys are the two
 * Showdown ids, sorted and joined - the same id the bot keeps them under.
 */
let agreed = new Set();
/** Did both players agree to this battle on Discord? */
function isAgreed(ids) {
	const pair = (Array.isArray(ids) ? ids : []).map(toID).filter(Boolean);
	if (pair.length !== 2) return false;
	return agreed.has(pair.sort().join('-'));
}
/** What a player in an RP PvP battle may use: their bag, or 5 of each for an NPC. */
function pvpItemsFor(userid) {
	const bag = bagFor(userid);
	if (!bag) return null;
	if (!bag.npc) return bag.items;
	const out = {};
	for (const item of E.BATTLE_ITEMS) out[item.id] = NPC_ITEMS_EACH;
	return out;
}
/**
 * An RP battle between players (or against an NPC), checked the way an encounter
 * is: each player's team against their character's box, for the players the
 * bot has a box for. NPCs battle with any team. Returns { problems, notes }:
 * problems call the battle off; notes tell each player what applies to them.
 */
function pvpCheck(players, teamOf, agreedMatch = true) {
	const problems = [];
	const notes = new Map();
	for (const player of players) {
		const bag = bagFor(player.id);
		// A friendly: nothing is checked, because nothing is recorded.
		if (!agreedMatch) {
			notes.set(player.id, friendlyNotice(bag));
			continue;
		}
		if (!bag) {
			problems.push(`**${player.name}** has no character linked: set your Showdown name with !showdown on Discord and select a character (or play RP Custom Game)`);
			continue;
		}
		if (bag.npc) {
			notes.set(player.id, `You're battling as the NPC **${bag.character}**: any team, 5 of each healing item, and you earn nothing.`);
			continue;
		}
		if (bag.box) {
			const check = checkTeam({ box: bag.box, badges: bag.badges, character: bag.character }, teamOf(player.id));
			for (const p of check.problems) problems.push(`${player.name}: ${p}`);
		}
		notes.set(player.id, pvpNotice(bag));
	}
	return { problems, notes };
}

/** What applies in a friendly: nothing does, and here is how to make it count. */
function friendlyNotice(bag) {
	return [
		`🤝 **Friendly battle**${bag && !bag.npc && bag.character ? ` as **${bag.character}**` : ''}: nothing here counts.`,
		'Any team is fine and every gimmick is allowed. No EXP, no win or loss, and nothing comes off your bag.',
		'To play one that counts, both of you run `!pvp` at each other on Discord first, then challenge again.',
	].join(String.fromCharCode(10));
}

/** What applies to a player in this battle: their character, items, locks and badges. */
function pvpNotice(bag) {
	const lines = [`You're battling as **${bag.character}**.`];
	const items = Object.entries(bag.items || {}).filter(([, n]) => n > 0).map(([id, n]) => `${n}× ${(E.findBattleItem(id) || { name: id }).name}`);
	lines.push(items.length ? `🧴 Items in your bag: ${items.join(', ')} (use them from the panel; they come off your bag).` : '🧴 No healing items in your bag.');
	if (bag.gimmicks) {
		const locked = Object.keys(GIMMICK_ITEM).filter(k => !bag.gimmicks[k]).map(k => GIMMICK_NAME[k].replace(/^use /, ''));
		const open = Object.keys(GIMMICK_ITEM).filter(k => bag.gimmicks[k]).map(k => GIMMICK_NAME[k].replace(/^use /, ''));
		if (open.length) lines.push(`✅ You can ${open.join(', ')}.`);
		if (locked.length) lines.push(`🔒 Locked until the story gives you the item: ${locked.join(', ')}. The battle won't allow ${locked.length === 1 ? 'it' : 'them'}.`);
	}
	if (bag.badges !== undefined && bag.badges < 1) lines.push('⚠️ Held items unlock with your first badge (not blocked, so just do not).');
	if (bag.box) lines.push('📦 Your team was checked against your box: only Pokémon you own, at or below their box level, none fainted or at the daycare.');
	return lines.join(String.fromCharCode(10));
}

function canUsePvpItem(userid, itemId, usedSoFar) {
	const bag = bagFor(userid);
	if (!bag) return { ok: false, message: 'Link a character first: set your Showdown name with !showdown on Discord and select a character, then items from its bag work in RP battles.' };
	return canUseItem({ items: pvpItemsFor(userid), character: bag.character }, itemId, usedSoFar);
}

function normaliseBalls(balls) {
	const out = {};
	for (const [name, count] of Object.entries(balls)) {
		const ball = E.findBall(name);
		if (ball && Number(count) > 0) out[ball.id] = (out[ball.id] || 0) + Math.floor(Number(count));
	}
	return out;
}

/** What Discord gets told: enough to announce it, nothing about its moves. */
function publicView(enc) {
	return {
		id: enc.id,
		kind: enc.kind,
		double: enc.double,
		name: enc.name,
		className: enc.className || null,
		place: enc.placeName,
		channel: enc.channel,
		badges: enc.badges,
		format: enc.format,
		pokemon: enc.team.map(s => ({ species: s.species, level: s.level, shiny: !!s.shiny })),
		text: E.describe(enc),
		status: enc.status,
		result: enc.result,
		invalid: enc.invalid || null,
		tutorial: !!enc.tutorial,
	};
}

/*
 * The player's team against their character's box.
 *
 * RP is honour-based everywhere else, but a team is easy to check and easy to
 * get wrong - a Pokémon left at the builder's default level of 100, or one the
 * character never caught. Every Pokémon on the team has to be one in the box
 * (each box Pokémon counts once), at or below its box level. A form that only
 * exists in battle, or a cosmetic one, counts as its base Pokémon.
 */
function normaliseBox(box) {
	if (!Array.isArray(box)) return null;
	return box.slice(0, 500).map(m => ({
		species: String(m.species || ''), level: m.level == null ? null : Number(m.level),
		// Not on hand: fainted until a Pokémon Centre, or left at the daycare.
		away: m.fainted ? 'fainted' : m.daycare ? 'daycare' : null,
	}));
}

function checkTeam(enc, sets) {
	if (!enc || !enc.box || !Array.isArray(sets)) return { ok: true, problems: [] };
	const { Dex } = require('pokemon-showdown');
	const idsFor = name => {
		const s = Dex.species.get(name);
		if (!s.exists) return [toID(name)];
		const ids = [s.id];
		if (s.battleOnly) ids.push(...[].concat(s.battleOnly).map(toID));
		if (s.changesFrom) ids.push(toID(s.changesFrom));
		if (s.baseSpecies !== s.name && (Dex.species.get(s.baseSpecies).cosmeticFormes || []).includes(s.name)) ids.push(toID(s.baseSpecies));
		return ids;
	};
	/*
	 * Another form of a Pokémon you own is the same Pokémon (Landorus-Therian for
	 * a Landorus in the box): forms are free in the RP. A regional variant is not
	 * (an Alolan Vulpix is its own Pokémon), except Pikachu's caps.
	 */
	const REGION = /(^|-)(Alola|Galar|Hisui|Paldea)(-|$)/;
	const groupOf = name => {
		const s = Dex.species.get(name);
		if (!s.exists) return toID(name);
		const region = s.baseSpecies === 'Pikachu' ? '' : ((s.forme || '').match(REGION) || [])[2] || '';
		return `${toID(s.baseSpecies)}|${region}`;
	};
	const badges = Number(enc.badges) || 0;
	const all = enc.box.map(m => ({ id: toID(Dex.species.get(m.species).exists ? Dex.species.get(m.species).id : m.species), group: groupOf(m.species), level: m.level, away: m.away }));
	const left = all.filter(m => !m.away);
	const problems = [];
	for (const set of sets) {
		const name = set.species || set.name;
		const level = Number(set.level) || 100;
		const ids = idsFor(name);
		const species = Dex.species.get(name);
		let owned = left.filter(m => ids.includes(m.id));
		// The Let's Go partners stay illegal: an Eevee-Starter is not a box Eevee.
		if (!owned.length && species.isNonstandard !== 'LGPE') owned = left.filter(m => m.group === groupOf(name));
		// A different form that needs its held item (Giratina-Origin, Ogerpon's masks) waits for the first badge.
		const needsItem = species.exists && !species.battleOnly && (species.requiredItem || (species.requiredItems && species.requiredItems.length));
		if (owned.length && needsItem && badges < 1 && !owned.some(m => m.id === species.id)) {
			problems.push(`**${name}** needs its held item (${species.requiredItem || species.requiredItems.join(' or ')}), and held items unlock at the first badge: bring **${Dex.species.get(species.changesFrom || species.baseSpecies).name}** instead`);
			left.splice(left.indexOf(owned[0]), 1);
			continue;
		}
		if (!owned.length) {
			const away = all.find(m => m.away && ids.includes(m.id));
			problems.push(away && away.away === 'fainted' ? `**${name}** has fainted: heal it at a Pokémon Centre first (\`!heal\`)`
				: away ? `**${name}** is at the daycare`
				: `${enc.character || 'Your character'} doesn't have a **${name}**`);
			continue;
		}
		// Use up the box Pokémon that fits best: the lowest level it still fits under.
		const fits = owned.filter(m => m.level == null || level <= m.level).sort((a, b) => (a.level ?? 999) - (b.level ?? 999));
		if (!fits.length) {
			const best = Math.max(...owned.map(m => m.level));
			problems.push(`**${name}** is Lv. ${level} on your team but Lv. ${best} in your box`);
			left.splice(left.indexOf(owned.sort((a, b) => b.level - a.level)[0]), 1);
			continue;
		}
		left.splice(left.indexOf(fits[0]), 1);
	}
	return { ok: !problems.length, problems };
}

/** Which gimmick a battle choice uses, if any: "move 1 terastallize" -> 'tera'. */
function gimmickIn(choice) {
	const words = String(choice).toLowerCase();
	if (/\bterastall?ize\b/.test(words)) return 'tera';
	if (/\bmega[xy]?\b/.test(words)) return 'mega';
	if (/\b(zmove|ultra)\b/.test(words)) return 'zmove';
	if (/\b(dynamax|max|gigantamax)\b/.test(words)) return 'dynamax';
	return null;
}
const GIMMICK_ITEM = { tera: 'a Tera Orb', mega: 'a Key Stone', zmove: 'a Z-Ring', dynamax: 'a Dynamax Band' };
const GIMMICK_NAME = { tera: 'Terastallize', mega: 'Mega Evolve', zmove: 'use Z-Moves', dynamax: 'Dynamax' };

// -------------------------------------------------------------------- balls

/** Balls of a kind thrown so far in a battle, read off its own log. */
function thrownInLog(lines, side, ballName) {
	const needle = `|-message|${side} threw `;
	return lines.filter(l => l.startsWith(needle) && l.endsWith(`${ballName}!`)).length;
}

/**
 * Whether a character may throw this ball now.
 *
 * Without a bag (a staff-made encounter) any ball goes. With one, a ball of
 * that kind has to be left after the ones already thrown this battle.
 */
/*
 * A trainer's first few catches.
 *
 * Somebody who has caught nothing yet is one broken ball away from deciding this
 * game is not for them, and the first Pokemon after the starter is the one that
 * makes a team feel like a team. So the first FREE_CATCHES throws of a career
 * land, as long as what is in front of them is an ordinary Pokemon - a
 * legendary, a mythical, a Paradox, an Ultra Beast or a pseudo-legendary is
 * caught the hard way like everybody else's.
 *
 * Deliberately invisible: the ball wobbles three times and holds, which is what
 * a lucky throw looks like anyway. Nothing says it, in the battle or out of it.
 */
const FREE_CATCHES = 5;
const NOT_FREE = new Set(['boxart', 'legendary', 'mythical', 'paradox', 'ub', 'pseudo']);
function freeCatch(enc, species) {
	if (!enc || !species) return false;
	if ((enc.caught || 0) >= FREE_CATCHES) return false;
	try { return !NOT_FREE.has(require('./rarity').classOf(species)); } catch (e) { return false; }
}

/*
 * One legendary, allowed.
 *
 * A legendary is the story's to give, so the battle refuses every ball at one -
 * unless the owner says otherwise about this one encounter, which is a button in
 * a DM (the bot's ownerwatch.js). Nothing else can set it: the request is signed
 * with the bot's key like every other.
 */
function allowCatch(payload) {
	sweep();
	const enc = encounters.get(String(payload.id || ''));
	if (!enc) return { ok: false, code: 'gone', message: 'That encounter is over.' };
	// Three states: nothing said (the ordinary rules), yes (a legendary may be
	// caught this once), no (this one is here to be battled and not kept).
	enc.catchable = payload.allow === false ? false : true;
	return { ok: true, catchable: enc.catchable, encounter: publicView(enc) };
}

function canThrow(enc, ballId, thrownSoFar) {
	// Staff can send something that is not for keeping (the summon panel's Catchable: no).
	if (enc && enc.catchable === false) return { ok: false, message: 'This one is not for catching.' };
	if (!enc || !enc.balls) return { ok: true };
	const have = enc.balls[ballId] || 0;
	if (have - thrownSoFar > 0) return { ok: true, left: have - thrownSoFar - 1 };
	const ball = E.findBall(ballId);
	return { ok: false, message: have ? `That was your last ${ball.name}.` : `${enc.character || 'Your character'} doesn't have any ${ball.name}s. Buy some with !buy on Discord.` };
}

// ------------------------------------------------------------------ results

/** Read what happened out of a finished battle's log. */
function resultFromLog(enc, lines, winnerid) {
	const playerName = enc.showdown;
	const used = {};
	for (const line of lines) {
		const m = /^\|-message\|(.+) threw an? (.+)!$/.exec(line);
		if (!m || toID(m[1]) !== enc.userid) continue;
		const ball = E.findBall(m[2]);
		if (ball) used[ball.id] = (used[ball.id] || 0) + 1;
	}
	let caught = null;
	for (const line of lines) {
		const m = /\(\(Caught (.+?), Lv\. (\d+), with an? (.+?)\)\)/.exec(line);
		if (m) caught = { species: m[1], level: Number(m[2]), ball: E.findBall(m[3]) ? E.findBall(m[3]).id : null };
	}
	if (caught) {
		// The details a Pokemon is sent out with say "shiny" when it is one.
		caught.shiny = lines.some(l => /^\|(switch|drag)\|p\d[ab]?: /.test(l) && l.split('|')[3] &&
			l.split('|')[3].startsWith(caught.species) && /, shiny/.test(l.split('|')[3]));
	}
	const itemsUsed = {};
	for (const line of lines) {
		// "used a Potion on Gible!", and for an escape item plain "used a Poké Doll!".
		const m = /^\|-message\|(.+) used an? (.+) on .+!$/.exec(line) || /^\|-message\|(.+) used an? ([^!]+)!$/.exec(line);
		if (!m || toID(m[1]) !== enc.userid) continue;
		const item = E.findBattleItem(m[2]);
		if (item) itemsUsed[item.id] = (itemsUsed[item.id] || 0) + 1;
	}
	// The tutorial's catch goes nowhere, so it has no line for the doc: the "Gotcha" says it.
	if (!caught && enc.tutorial && lines.some(l => /^\|-message\|Gotcha! .+ was caught!$/.test(l))) {
		caught = { species: enc.team[0].species, level: enc.team[0].level, ball: 'poke', shiny: false };
	}
	const won = winnerid === enc.userid;
	return {
		outcome: caught ? 'caught' : won ? 'won' : winnerid ? 'lost' : 'tie',
		caught,
		ballsUsed: used,
		itemsUsed,
		fainted: faintedInLog(enc, lines),
		player: playerName,
	};
}

/**
 * The player's Pokémon that ended the battle fainted. In the RP they stay that
 * way until a Pokémon Centre, so Discord marks them. A Revive used mid-battle
 * brings one back, so it doesn't count.
 */
function faintedInLog(enc, lines) {
	return sidesInLog(lines)[enc.userid]?.fainted || [];
}

/**
 * Each player's side of a battle, read off its log: the Pokémon they sent out
 * and the ones that ended it fainted. Used for PvP results (NPC trainer battles,
 * the Hall of Fame) as well as encounters.
 */
function sidesInLog(lines) {
	const out = {};
	for (const line of lines) {
		const m = /^\|player\|(p\d)\|([^|]+)/.exec(line);
		if (m && !Object.values(out).some(s => s.slot === m[1])) out[toID(m[2])] = { slot: m[1], name: m[2], fainted: [], team: [] };
	}
	for (const side of Object.values(out)) {
		// Items used, by the "<player> used a Potion on ..." line useItem writes.
		side.itemsUsed = {};
		for (const line of lines) {
			const m = /^\|-message\|(.+) used an? (.+) on .+!$/.exec(line);
			if (!m || toID(m[1]) !== toID(side.name)) continue;
			const item = E.findBattleItem(m[2]);
			if (item) side.itemsUsed[item.id] = (side.itemsUsed[item.id] || 0) + 1;
		}
	}
	for (const [id, side] of Object.entries(out)) {
		const { fainted, team } = sideInLog(lines, side.slot, id);
		side.fainted = fainted;
		side.team = team;
	}
	return out;
}

function sideInLog(lines, slot, userid) {
	const who = new Map();   // nickname -> { species, level }
	const down = new Map();
	for (const line of lines) {
		const parts = line.split('|');
		if ((parts[1] === 'switch' || parts[1] === 'drag' || parts[1] === 'replace') && parts[2] && parts[2].startsWith(slot)) {
			const nick = parts[2].replace(/^p\d[a-z]?: /, '');
			const [species, ...rest] = (parts[3] || '').split(', ');
			const lv = rest.find(x => /^L\d+$/.test(x));
			who.set(nick, { species, level: lv ? Number(lv.slice(1)) : 100 });
		} else if (parts[1] === 'faint' && parts[2] && parts[2].startsWith(slot)) {
			const nick = parts[2].replace(/^p\d[a-z]?: /, '');
			if (who.has(nick)) down.set(nick, who.get(nick));
		} else if (parts[1] === '-enditem' && parts[2] && parts[2].startsWith(slot) && toID(parts[3]) === 'brokenpact') {
			/*
			 * A Nuzleaf with a Broken Pact does not faint - it comes back as
			 * Nuzleaf-SOLD at full HP, and the battle never writes a `faint` line
			 * for it (data/velvet/items.js). In the battle that is the whole point.
			 * Out here it is still a Pokemon that was knocked out: it goes into the
			 * box fainted like any other, and needs a Pokemon Centre before it can
			 * be brought again. The item is what it spent to stay on the field, not
			 * a way to walk out of the fight unhurt.
			 */
			const nick = parts[2].replace(/^p\d[a-z]?: /, '');
			if (who.has(nick)) down.set(nick, who.get(nick));
		} else if (parts[1] === '-message') {
			/*
			 * A Revive used in the battle heals it properly: it is back on its
			 * feet, and if it does not go down again it walks out of the fight
			 * fine and needs no Centre. That is the difference from a Broken
			 * Pact above, which keeps a Nuzleaf on the field without ever
			 * healing what happened to it.
			 */
			const m = /used an? (?:Max )?Revive on (.+)!$/.exec(parts.slice(2).join('|'));
			if (m && toID(parts.slice(2).join('|').split(' used ')[0]) === userid) down.delete(m[1]);
		}
	}
	// Team Preview lists the whole team; without one, the Pokémon that came out are all there is to go on.
	const preview = [];
	for (const line of lines) {
		const parts = line.split('|');
		if (parts[1] !== 'poke' || parts[2] !== slot) continue;
		const [species, ...rest] = (parts[3] || '').split(', ');
		const lv = rest.find(x => /^L\d+$/.test(x));
		preview.push({ species, level: lv ? Number(lv.slice(1)) : 100 });
	}
	return { fainted: [...down.values()], team: preview.length ? preview : [...who.values()] };
}

// ------------------------------------------------------------ replay feed

/**
 * Recently finished RP battles, newest last, for Discord's replay channels.
 *
 * In memory, so a restart forgets the last few - which only means a replay or
 * two isn't posted, never that one is posted twice. Each has a rising number;
 * Discord remembers the last one it posted and asks for anything after it.
 */
const finished = [];
let finishedSeq = 0;
function recordFinished(entry) {
	finished.push({ seq: ++finishedSeq, endedAt: Date.now(), ...entry });
	while (finished.length > 200) finished.shift();
}
function finishedSince(seq) {
	return finished.filter(f => f.seq > seq);
}

// ------------------------------------------------------------------- HTTP

// Big enough for a character's whole box (sent with every encounter, for the team check).
function readJson(req, limit = 256 * 1024) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on('data', c => {
			size += c.length;
			if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
			chunks.push(c);
		});
		req.on('end', () => {
			try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); }
		});
		req.on('error', reject);
	});
}

function send(res, status, body) {
	res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
	res.end(JSON.stringify(body));
}

/** An HTTP route for src/http-hooks.js. Returns true when it answered. */
/*
 * A battle the bot sets up for two people (Patch 2.1).
 *
 * Until now every battle between players had to be arranged on Showdown by the
 * players themselves: find each other, get the format right, accept. That is
 * three chances to get it wrong for something they already agreed to on
 * Discord - so the bot can now ask the server to make the battle itself.
 *
 * Both sides pick their team on Discord first (that is the `!preset` panel),
 * and once both have, this puts the two of them in a room with those teams.
 * Nobody accepts anything on Showdown: the battle is simply there.
 *
 * Both have to be logged in, and it says plainly who is not.
 */
function startMatch(payload, deps) {
	const sides = Array.isArray(payload.players) ? payload.players : [];
	if (sides.length !== 2) return { ok: false, code: 'bad', message: 'A battle takes two players.' };
	const format = String(payload.format || 'gen9rpbattle');
	for (const side of sides) {
		if (!side || !side.showdown) return { ok: false, code: 'bad', message: 'Both players need a Showdown name.' };
		if (!Array.isArray(side.team) || !side.team.length) {
			return { ok: false, code: 'noteam', message: `${side.character || side.showdown} has not picked a team yet.` };
		}
	}
	if (!deps.match) return { ok: false, code: 'error', message: 'This server cannot start battles for people.' };
	let out;
	try {
		out = deps.match({ players: sides, format });
	} catch (e) {
		log(`match failed: ${e.stack || e.message}`);
		return { ok: false, code: 'error', message: 'Something went wrong starting that battle.' };
	}
	return out;
}

function httpRoute(deps, log) {
	return (req, res) => {
		const url = String(req.url || '');
		if (url === '/rp/encounter' && req.method === 'POST') {
			readJson(req).then(body => {
				const checked = verify(body);
				if (checked.error) return send(res, 403, { ok: false, code: 'forbidden', message: checked.error });
				let answer;
				try {
					answer = checked.payload.complete ? completeEncounter(checked.payload, deps) : requestEncounter(checked.payload, deps);
				} catch (e) {
					log(`encounter failed: ${e.stack || e.message}`);
					answer = { ok: false, code: 'error', message: 'Something went wrong rolling that encounter.' };
				}
				/*
				 * An encounter opened with the player's Discord team: wait for the
				 * room (at most ~20 s, openEncounter) so Discord can post its link.
				 * roomid null means it could not be opened.
				 */
				const opening = answer.ok && answer.encounter && deps.opening ? deps.opening(answer.encounter.id) : undefined;
				if (!opening) return send(res, 200, answer);
				return Promise.resolve(opening).then(roomid => send(res, 200, { ...answer, opened: true, roomid: roomid || null }));
			}).catch(() => send(res, 400, { ok: false, code: 'bad', message: 'Bad request.' }));
			return true;
		}
		if (url === '/rp/allow' && req.method === 'POST') {
			readJson(req).then(body => {
				const checked = verify(body);
				if (checked.error) return send(res, 403, { ok: false, code: 'forbidden', message: checked.error });
				send(res, 200, allowCatch(checked.payload));
			}).catch(() => send(res, 400, { ok: false, code: 'bad', message: 'Bad request.' }));
			return true;
		}
		if (url === '/rp/match' && req.method === 'POST') {
			readJson(req).then(body => {
				const checked = verify(body);
				if (checked.error) return send(res, 403, { ok: false, code: 'forbidden', message: checked.error });
				send(res, 200, startMatch(checked.payload, deps));
			}).catch(() => send(res, 400, { ok: false, code: 'bad', message: 'Bad request.' }));
			return true;
		}
		if (url === '/rp/bags' && req.method === 'POST') {
			readJson(req).then(body => {
				const checked = verify(body);
				if (checked.error) return send(res, 403, { ok: false, code: 'forbidden', message: checked.error });
				send(res, 200, setBags(checked.payload));
			}).catch(() => send(res, 400, { ok: false, code: 'bad', message: 'Bad request.' }));
			return true;
		}
		const feed = /^\/rp\/finished(?:\?since=(\d+))?$/.exec(url);
		if (feed && req.method === 'GET') {
			// Server-restart aware: a `since` above anything this boot has seen
			// means the numbers started again, so everything is new.
			let since = Number(feed[1] || 0);
			if (since > finishedSeq) since = 0;
			send(res, 200, { ok: true, latest: finishedSeq, battles: finishedSince(since) });
			return true;
		}
		const m = /^\/rp\/result\/([a-f0-9]{16})$/.exec(url);
		if (m && req.method === 'GET') {
			sweep();
			const enc = encounters.get(m[1]);
			send(res, enc ? 200 : 404, enc ? { ok: true, encounter: publicView(enc) } : { ok: false, code: 'gone' });
			return true;
		}
		return false;
	};
}

module.exports = {
	freeCatch, FREE_CATCHES, allowCatch, summoned, chosenSet,
	pvpCheck, pvpNotice, friendlyNotice, isAgreed, verify, placeFor, requestEncounter, requestTutorial, completeEncounter, canUseItem, usedInLog, setBags, bagFor, pvpItemsFor, canUsePvpItem, NPC_ITEMS_EACH, publicView, canThrow, thrownInLog, resultFromLog, openFor,
	checkTeam, gimmickIn, GIMMICK_ITEM, GIMMICK_NAME, sidesInLog, startMatch,
	httpRoute, encounters, RP_ROOM, CHALLENGE_MS, recordFinished, finishedSince,
};
