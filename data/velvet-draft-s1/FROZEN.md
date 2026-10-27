# Frozen: Kagura Draft League, Season 1

A copy of `data/velvet` as it stood when the Season 1 auction opened
(24 Oct 2026, commit 83be0457). `[Gen 9] RP Draft` plays on this copy through
its own mod (`gen9draftrp`), so balance patches made to `data/velvet` after that
day never reach the draft: the owner's rule is that the draft's rules stay the
same until the season ends.

Never edit these files. `test/draft-frozen.test.js` fails if anything here
changes. For Season 2, copy `data/velvet` again into a new folder.

One correction since, by the owner's call (24 Oct 2026): Dragonize (Mega Feraligatr)
was left at 1.2x when the other -ate abilities went back to 1.3x, which was our
mistake, not a balance change, so it was fixed here too (unnerfs.js).

Liepard learns Hustle Up here too, as in RP (owner, 27 Oct 2026; balance-patch-1.js).
