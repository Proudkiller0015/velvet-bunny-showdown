'use strict';
/**
 * /battles lists every running battle (private ones too) and /forcejoin puts the owner or an
 * administrator in one, from its full name or from the short link it had before going private.
 *
 *   node test/forcejoin.test.js
 */
const path = require('path');
const config = require(path.join(__dirname, '..', 'node_modules', 'pokemon-showdown', 'config', 'config.js'));

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

class ErrorMessage extends Error {}
global.Chat = { escapeHTML: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), ErrorMessage };
const battle = (roomid, title, players, extra = {}) => ({
	roomid, title, settings: { isPrivate: extra.isPrivate || false },
	battle: { ended: !!extra.ended, turn: extra.turn || 0, players: players.map(name => ({ name })) },
});
const rooms = [
	battle('battle-gen9rpdraft-53-abcdefghijklmnopqrstuvwxyz12345pw', 'Prev0w1 vs. Keiko_Sama', ['Prev0w1', 'Keiko_Sama'], { isPrivate: 'hidden', turn: 6 }),
	battle('battle-gen9ou-7', 'A vs. <b>B</b>', ['A', '<b>B</b>'], { turn: 2 }),
	battle('battle-gen9ou-8', 'Done', ['C', 'D'], { ended: true }),
	{ roomid: 'lobby', title: 'Lobby', settings: {} },
];
global.Rooms = { rooms: new Map(rooms.map(r => [r.roomid, r])), get: id => rooms.find(r => r.roomid === id) };

function run(command, target, can) {
	const out = { replies: [], parsed: [], joined: [] };
	const user = { joinRoom: (roomid, connection) => out.joined.push([roomid, connection]) };
	const context = {
		checkCan: perm => { if (!can(perm)) throw new ErrorMessage(`denied ${perm}`); },
		sendReplyBox: html => out.replies.push(html),
		parse: text => out.parsed.push(text),
	};
	try {
		config.commands[command].call(context, target, null, user, 'conn');
	} catch (e) {
		out.error = e;
	}
	return out;
}
const owner = perm => perm === 'bypassall';
const player = () => false;

const list = run('battles', '', owner);
const html = list.replies[0] || '';
check(/forcejoin battle-gen9rpdraft-53-abcdefghijklmnopqrstuvwxyz12345pw/.test(html) && /\(private\)/.test(html) && /turn 6/.test(html),
	'/battles shows the private battle with its full name, marked private');
check(/battle-gen9ou-7/.test(html) && /&lt;b&gt;B&lt;\/b&gt;/.test(html) && !/<b>B<\/b>/.test(html), 'and the public one, names escaped');
check(!/battle-gen9ou-8/.test(html) && !/lobby/i.test(html), 'but not finished battles or chat rooms');
check(run('battles', '', player).error instanceof ErrorMessage, 'a player cannot list battles');

const short = run('forcejoin', 'https://velvet-bunny-showdown.onrender.com/battle-gen9rpdraft-53', owner);
check(short.joined[0] && short.joined[0][0] === 'battle-gen9rpdraft-53-abcdefghijklmnopqrstuvwxyz12345pw' && short.joined[0][1] === 'conn',
	'/forcejoin with the short link joins the private battle it became');
const full = run('forcejoin', 'battle-gen9ou-7', owner);
check(full.joined[0] && full.joined[0][0] === 'battle-gen9ou-7', 'and with a full name joins that room');
const none = run('forcejoin', 'battle-gen9ou-99', owner);
check(none.error instanceof ErrorMessage && !none.joined.length, 'a room that does not exist says so');
const notFive = run('forcejoin', 'battle-gen9rpdraft-5', owner);
check(notFive.error instanceof ErrorMessage, 'battle 5 is not mistaken for battle 53');
check(run('forcejoin', 'battle-gen9ou-7', player).error instanceof ErrorMessage, 'a player cannot force their way in');
check(run('forcejoin', '', owner).parsed[0] === '/help forcejoin', 'no target shows the help');

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
