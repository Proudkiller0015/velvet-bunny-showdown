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
 * The choice is remembered here and sent to the server on every change and once
 * at login, because the server keeps it per session: without that, a player who
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

	var rungs = null;         // [{ id, label, formats: Set }] once the status is in
	var queuedFormats = null; // every format any bot is queued for

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

	function loadRungs(then) {
		if (rungs) return then();
		var request = new XMLHttpRequest();
		request.open('GET', STATUS, true);
		request.onreadystatechange = function () {
			if (request.readyState !== 4) return;
			rungs = [];
			queuedFormats = {};
			try {
				var status = JSON.parse(request.responseText);
				var seen = {};
				for (var name in status.queues || {}) {
					var queue = status.queues[name];
					if (!queue || !queue.difficulty) continue;
					if (!seen[queue.difficulty]) {
						seen[queue.difficulty] = { id: queue.difficulty, label: title(queue.difficulty), formats: {} };
						rungs.push(seen[queue.difficulty]);
					}
					if (queue.format) {
						seen[queue.difficulty].formats[queue.format] = queue.connected !== false;
						queuedFormats[queue.format] = true;
					}
				}
			} catch (e) { /* the ladder has not started, or the file is not there */ }
			if (!rungs.length) {
				rungs = FALLBACK.map(function (id) { return { id: id, label: title(id), formats: {} }; });
			}
			then();
		};
		try { request.send(); } catch (e) { rungs = FALLBACK.map(function (id) { return { id: id, label: title(id), formats: {} }; }); then(); }
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
	 * Whether the bot you asked for is actually queued for the format you picked.
	 *
	 * The bots queue a fixed list of formats. Searching one they do not queue is
	 * not an error and not broken - it just means waiting for a person - but
	 * finding that out by waiting is a bad way to find it out.
	 */
	function note($row, choice) {
		var $note = $row.find('.velvet-opponent-note');
		if (!choice.bot) {
			$note.text('You will wait for a real opponent.');
			return;
		}
		var format = String($('button.formatselect').first().val() || '');
		// Quiet unless there is something to say. An empty map means the status
		// could not be read - not that nothing is queued - and warning about
		// every format because a fetch failed is worse than saying nothing.
		var known = queuedFormats && Object.keys(queuedFormats).length;
		if (!format || !known || queuedFormats[format]) { $note.text(''); return; }
		$note.text('No bot queues this format - you will wait for a player.');
	}

	function install() {
		var $form = $('form.battleform[data-search]');
		if (!$form.length) return false;
		if ($form.find('.velvet-opponent').length) {
			note($form.find('.velvet-opponent'), saved());
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
	var toldTheServer = false;
	function tick() {
		if (!window.$ || !window.app) return;
		loadRungs(function () {
			install();
			// Once per session, so the server agrees with what the box shows.
			if (!toldTheServer && window.app.user && window.app.user.get &&
				window.app.user.get('named')) {
				toldTheServer = true;
				tell(saved());
			}
		});
	}
	setInterval(tick, 500);
	tick();
})();
