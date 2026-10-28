# Moemon sprites

From the Moemon Project's sprite database (Google Sheet, exported as book.xlsx), used with the Project's permission (28 Oct 2026; not for an NDS game). Credited in the Moemon room.

1. Export the sheet as xlsx into this folder as book.xlsx (not committed: 17 MB).
2. python -I extract.py   -> rows.json (species, form, repo name, artist per spriteset)
3. python -I frames.py    -> client/sprites/moemon/m<row>{,-shiny,-back,-back-shiny}.png (64x64, background keyed out)
4. node ../../scripts/build-moemon.js rows.json -> client/js/velvet-moemon.js + data/moemon-credits.json

Row numbers are the file names, so a re-export that reorders rows must redo all three steps.
