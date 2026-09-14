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

	function allowed() {
		try {
			return !!(window.PS && PS.user && PS.user.named && MAY_LOOK.indexOf(PS.user.group) >= 0);
		} catch (e) {
			return false;
		}
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
			 * and throw away the connection. `PS.join` is how every other link in
			 * here opens a room.
			 */
			button.addEventListener('click', function (event) {
				event.preventDefault();
				try {
					PS.join('view-players');
				} catch (e) {
					// If the router ever changes shape, say so rather than doing
					// nothing at all - the command still works.
					PS.alert('Could not open the guest book. Type /players in any chat instead.');
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
