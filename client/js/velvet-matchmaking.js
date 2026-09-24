/**
 * Who you want to play, on the screen where you ask to play someone.
 *
 * This server keeps a house bot on the ladder at several difficulties, and the
 * server already knows how to be told which one you want: `/bot hard`, `/bot
 * pvp` for people only, `/bot anyone` for whichever rung is closest to your
 * rating. All of it worked and none of it was anywhere a player would look -
 * it lived in a chat command and in a box the bot sends you in a private
 * message, which you have to know exists.
 *
 * So the same question is asked in the one place it belongs: the search form,
 * next to Format and Team, above the Battle! button.
 *
 *   Opponent:  [x] House bot  [ Hard v ]
 *
 * Unticked is "Players only", which is exactly what the words mean - you leave
 * every bot's queue and wait for a person.
 *
 * The choice is remembered here and sent to the server on every change and for
 * every user id the tab takes on (see tick), because the server keeps it per session: without that, a player who
 * ticked "Players only" last week would see it ticked and be handed a bot.
 */
(function () {
	'use strict';

	var KEY = 'velvet-opponent';
	var STATUS = '/velvet/ladder.json';

	// What to offer when the server's own list cannot be read. These are the
	// rungs this server has always run; the fetch below replaces them with
	// whatever is actually queued, which is the honest list.
	var FALLBACK = ['easy', 'normal', 'hard', 'champion'];

	var rungs = null;         // [{ id, label }] once the status is in
	var online = null;        // rung id -> connected, from the last good status read
	var fetchedAt = 0;        // when the status was last asked for
	var fetchedOk = false;    // and whether that answer could be used
	var fetching = false;
	var rungsChanged = false; // a later read changed the list the row was built from

	/* ------------------------------------------------------------- the choice */

	function saved() {
		try {
			var raw = window.localStorage.getItem(KEY);
			if (raw) return JSON.parse(raw);
		} catch (e) { /* private window, or nothing saved */ }
		return { bot: true, rung: 'anyone' };
	}

	function save(choice) {
		try { window.localStorage.setItem(KEY, JSON.stringify(choice)); } catch (e) { /* fine */ }
	}

	/** Tell the server, the way the chat command would. */
	function tell(choice) {
		if (!window.app || !window.app.send) return;
		// The main menu's own searches go out exactly like this - `app.send` with
		// no room writes `|/command`, which is the global context every one of
		// these commands runs in.
		window.app.send('/bot ' + (choice.bot ? (choice.rung || 'anyone') : 'pvp'));
	}

	/* ------------------------------------------------------------ the choices */

	/*
	 * 24 Sep 2026: read again now and then, not once. It used to be fetched on
	 * the first tick and never again, so one failed request (the server still
	 * starting, a dropped connection) left the fallback list and no hint for
	 * the whole session. Now a good answer is refreshed every minute and a bad
	 * one retried after fifteen seconds; the row is drawn from whatever is in
	 * hand meanwhile.
	 */
	function loadRungs(then) {
		var age = Date.now() - fetchedAt;
		if (rungs && (fetching || age < (fetchedOk ? 60000 : 15000))) return then();
		if (fetching) return;
		fetching = true;
		fetchedAt = Date.now();
		var done = function (status) {
			fetching = false;
			var next = [];
			var up = {};
			var seen = {};
			for (var name in (status && status.queues) || {}) {
				var queue = status.queues[name];
				if (!queue || !queue.difficulty) continue;
				if (!seen[queue.difficulty]) {
					seen[queue.difficulty] = true;
					next.push({ id: queue.difficulty, label: title(queue.difficulty) });
				}
				if (queue.connected) up[queue.difficulty] = true;
			}
			fetchedOk = next.length > 0;
			if (fetchedOk) {
				var before = rungs ? rungs.map(function (r) { return r.id; }).join() : '';
				if (rungs && before !== next.map(function (r) { return r.id; }).join()) rungsChanged = true;
				rungs = next;
				online = up;
			} else if (!rungs) {
				rungs = FALLBACK.map(function (id) { return { id: id, label: title(id) }; });
			}
			then();
		};
		var request = new XMLHttpRequest();
		request.open('GET', STATUS, true);
		request.onreadystatechange = function () {
			if (request.readyState !== 4) return;
			var status = null;
			try { status = JSON.parse(request.responseText); } catch (e) { /* the ladder has not started, or the file is not there */ }
			done(status);
		};
		try { request.send(); } catch (e) { done(null); }
	}

	function title(text) {
		return String(text).charAt(0).toUpperCase() + String(text).slice(1);
	}

	/* ----------------------------------------------------------------- the row */

	function build(choice) {
		var options = ['<option value="anyone"' + (choice.rung === 'anyone' ? ' selected' : '') +
			'>Anyone (closest to your rating)</option>'];
		for (var i = 0; i < rungs.length; i++) {
			var rung = rungs[i];
			options.push('<option value="' + rung.id + '"' + (choice.rung === rung.id ? ' selected' : '') +
				'>' + rung.label + '</option>');
		}
		return '<p class="velvet-opponent"><label class="label">Opponent:</label>' +
			'<label class="checkbox velvet-opponent-toggle">' +
			'<input type="checkbox" name="velvetbot"' + (choice.bot ? ' checked' : '') + ' /> ' +
			'House bot</label> ' +
			'<select name="velvetrung" class="button"' + (choice.bot ? '' : ' disabled') + '>' +
			options.join('') + '</select>' +
			'<small class="velvet-opponent-note"></small></p>';
	}

	/**
	 * Whether the bot you asked for can actually come.
	 *
	 * 24 Sep 2026: this used to warn when "no bot queues this format", from a
	 * per-queue `format` the status file stopped writing when the bots moved to
	 * being rung on demand for any format - so it could never fire. The
	 * question that is still worth answering is whether the rung you picked
	 * (or, for "Anyone", any rung) is connected at all. Quiet when the status
	 * could not be read: warning because a fetch failed is worse than silence.
	 */
	function note($row, choice) {
		var $note = $row.find('.velvet-opponent-note');
		if (!choice.bot) {
			$note.text('You will wait for a real opponent.');
			return;
		}
		if (!online) { $note.text(''); return; }
		var up = choice.rung && choice.rung !== 'anyone' ? !!online[choice.rung] : Object.keys(online).length > 0;
		$note.text(up ? '' : 'That bot is offline right now - you will wait for a player.');
	}

	function install() {
		var $form = $('form.battleform[data-search]');
		if (!$form.length) return false;
		var $existing = $form.find('.velvet-opponent');
		if ($existing.length && rungsChanged && !$existing.find('select:focus').length) {
			// A later status read changed the list of rungs: draw the row again.
			$existing.remove();
			$existing = $form.find('.velvet-opponent');
		}
		rungsChanged = false;
		if ($existing.length) {
			note($existing, saved());
			return true;
		}

		var choice = saved();
		// Above the Battle! button and below Team, which is the order the
		// questions are asked in: what, with whom, against whom, go.
		var $anchor = $form.find('p').filter(function () {
			return $(this).find('button[name=search]').length > 0;
		}).first();
		if (!$anchor.length) $anchor = $form.children('p').last();
		$anchor.before(build(choice));

		var $row = $form.find('.velvet-opponent');
		$row.on('change', 'input[name=velvetbot]', function () {
			choice = saved();
			choice.bot = $(this).is(':checked');
			$row.find('select[name=velvetrung]').prop('disabled', !choice.bot);
			save(choice);
			tell(choice);
			note($row, choice);
		});
		$row.on('change', 'select[name=velvetrung]', function () {
			choice = saved();
			choice.rung = String($(this).val() || 'anyone');
			save(choice);
			tell(choice);
			note($row, choice);
		});
		note($row, choice);
		return true;
	}

	/* ---------------------------------------------------------------- start-up
	 *
	 * The main menu is re-rendered whenever the format list arrives, a team is
	 * saved, or a search is cancelled, and each time it is rebuilt from scratch -
	 * so this is not a one-off. Checking a few times a second costs nothing and
	 * is what the client's own panels do; `install` returns without work when the
	 * row is already there.
	 */
	/*
	 * Once per account, so the server agrees with what the box shows.
	 *
	 * 24 Sep 2026: it was once per session, and only once named. The server
	 * keeps the preference by user id, and a guest's id changes when they pick
	 * a name (and again on every rename) - so a guest who ticked "Players only"
	 * and then named themselves, or anyone who renamed, searched under an id
	 * the server had never been told about and was handed a bot. Now it is
	 * sent for every id this tab is known by, guest ids included.
	 */
	var toldId = '';
	function tick() {
		if (!window.$ || !window.app) return;
		loadRungs(function () {
			install();
			var user = window.app.user;
			var id = user && user.get ? user.get('userid') : '';
			if (id && id !== toldId) {
				toldId = id;
				// A new id starts at the server's default ("anyone"), so only a
				// different choice needs saying - and saying nothing spares every
				// page load a reply line in chat.
				var choice = saved();
				if (!choice.bot || (choice.rung && choice.rung !== 'anyone')) tell(choice);
			}
		});
	}
	setInterval(tick, 500);
	tick();
})();
