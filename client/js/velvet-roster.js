/**
 * The guest book, next to the count of who is online.
 *
 * The client's room list has a button saying "N users online", and it answers
 * a question nobody running a server actually asks: who is here *this minute*.
 * The one worth asking - who has been here at all - is a command the server has
 * had all along and nowhere to click.
 *
 * So a second button goes beside the first, and only for the people allowed to
 * use it. The server refuses anybody else anyway; this is about not offering a
 * button that answers "access denied", which is worse than no button.
 *
 * Injected rather than built in. The room list is compiled client code from
 * upstream, and an edit there is an edit that disappears the next time that
 * file is taken from them. Watching for the button and putting ours beside it
 * survives that, at the cost of knowing one class name.
 */
(function () {
	'use strict';

	// Owner and Administrator, which is exactly who `checkCan('bypassall')`
	// admits on the server - see the visitors command in the config.
	var MAY_LOOK = ['&', '~'];
	var MARK = 'velvet-guestbook';

	/*
	 * 24 Sep 2026: this asked `window.PS`, which is the new client's global - and
	 * this site runs the old one (index.html loads oldclient/client.js), where
	 * the global is `app` and PS does not exist. So the button never appeared
	 * for anyone. The old client does not keep your own rank on app.user either
	 * (updateuser strips it), but every room you are in lists you with it, so
	 * that is where it is read from. The new-client check stays as a fallback.
	 */
	function myGroup() {
		var app = window.app;
		if (app && app.user && app.user.get) {
			if (!app.user.get('named')) return null;
			var id = app.user.get('userid');
			for (var roomid in app.rooms) {
				var room = app.rooms[roomid];
				var me = room && room.users && room.users[id];
				if (me && me.group) return me.group;
			}
			return null;
		}
		if (window.PS && PS.user && PS.user.named) return PS.user.group;
		return null;
	}

	function allowed() {
		try {
			return MAY_LOOK.indexOf(myGroup()) >= 0;
		} catch (e) {
			return false;
		}
	}

	/** Open a room in whichever client this is. */
	function openRoom(id) {
		if (window.app && app.joinRoom) return app.joinRoom(id);
		PS.join(id);
	}

	function complain(text) {
		if (window.app && app.addPopupMessage) return app.addPopupMessage(text);
		if (window.PS && PS.alert) PS.alert(text);
	}

	/**
	 * The room list redraws whenever a count changes, which is often, so this
	 * has to be cheap and it has to be idempotent: find the anchor, and do
	 * nothing at all if ours is already sitting next to it.
	 */
	function place() {
		if (!allowed()) return;
		var counters = document.querySelectorAll('.roomcounters');
		for (var i = 0; i < counters.length; i++) {
			var box = counters[i];
			if (box.querySelector('.' + MARK)) continue;

			var button = document.createElement('a');
			button.className = 'button ' + MARK;
			button.href = '/view-players';
			button.title = 'Everyone who has ever been on this server';
			button.style.marginLeft = '4px';
			button.innerHTML = '<i class="fa fa-book" aria-hidden="true"></i> <strong>Guest book</strong>';
			/*
			 * The client routes its own links; a plain href would reload the page
			 * and throw away the connection. app.joinRoom (PS.join in the new
			 * client) is how every other link in here opens a room.
			 */
			button.addEventListener('click', function (event) {
				event.preventDefault();
				try {
					openRoom('view-players');
				} catch (e) {
					// If the router ever changes shape, say so rather than doing
					// nothing at all - the command still works.
					complain('Could not open the guest book. Type /players in any chat instead.');
				}
			});
			box.appendChild(button);
		}
	}

	function start() {
		place();
		// Cheap, and the alternative is guessing when the room list has redrawn.
		var watcher = new MutationObserver(function () { place(); });
		watcher.observe(document.body, { childList: true, subtree: true });
		// And once more after login, since the rank arrives after the first draw
		// and nothing about the DOM changes when it does.
		setTimeout(place, 3000);
		setTimeout(place, 10000);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
