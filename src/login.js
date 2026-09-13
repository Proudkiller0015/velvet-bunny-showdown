'use strict';
/**
 * Logging a bot account in against Showdown's login server.
 *
 * Shared by the main bot and by every ladder queue, which until now simply
 * claimed their names: `/trn Name,0,` with no proof. That works only while the
 * server is running with `noguestsecurity`, which is the setting that lets
 * anybody be anybody. The moment real accounts are required - which is the point
 * of using Showdown's login server - an unproven name is refused, and a bot that
 * cannot log in cannot do anything at all.
 *
 * The exchange is the same one the client performs. The server issues a
 * challstr; the login server signs an assertion binding that challstr to the
 * account; the server verifies the signature against Showdown's public key,
 * which ships in its own config. Nothing here needs the server to be registered
 * with Smogon - only the account does.
 */

const LOGIN_URL = 'https://play.pokemonshowdown.com/api/login';

/**
 * @param {object} options
 * @param {string} options.name      the account name
 * @param {string} options.password  its password, or '' for an open server
 * @param {string} options.challstr  the two challstr parts, joined by a pipe
 * @param {(line: string) => void} options.send
 * @param {(msg: string) => void} [options.log]
 */
async function logIn({ name, password, challstr, send, log = () => {} }) {
	if (!password) {
		// No password configured: claim the name directly, which only an open
		// server will accept.
		send(`|/trn ${name},0,`);
		return false;
	}

	try {
		const body = new URLSearchParams({ act: 'login', name, pass: password, challstr });
		const response = await fetch(LOGIN_URL, { method: 'POST', body });
		const text = await response.text();
		// The login server prefixes its JSON with ']' to make it inedible to a
		// naive <script> include.
		const data = JSON.parse(text.startsWith(']') ? text.slice(1) : text);
		if (!data.assertion) throw new Error(data.actionerror || 'login refused');
		send(`|/trn ${name},0,${data.assertion}`);
		return true;
	} catch (e) {
		// Falling back is worth trying rather than giving up: on a server that
		// still allows it the bot carries on, and on one that does not the refusal
		// says plainly what happened.
		log(`${name}: login failed (${e.message}); trying the name unproven`);
		send(`|/trn ${name},0,`);
		return false;
	}
}

module.exports = { logIn, LOGIN_URL };
