// Build the client's src/battle-log-misc.js.
//
// Upstream generates this file by compiling the SERVER's chat-formatter.ts into
// it (see build-tools/update). A plain clone of the client repo ships a stale
// copy that does not define formatText, so the chat log throws
// "formatText is not defined" the moment anything is rendered. We have the
// compiled formatter in the pokemon-showdown package, so use that - and it
// matches the server we actually run against.
const fs = require('fs');
const path = require('path');

const CLIENT_MISC = process.argv[2];
const FORMATTER = process.argv[3];
const OUT = process.argv[4];

const misc = fs.readFileSync(CLIENT_MISC, 'utf8');
const formatter = fs.readFileSync(FORMATTER, 'utf8')
	.replace(/\/\/# sourceMappingURL=.*$/m, '');

if (!/function formatText/.test(formatter)) {
	throw new Error('the formatter source does not define formatText');
}

const wrapped = `${misc}

/**
 * Chat formatting, compiled from the server's chat-formatter and exposed as the
 * globals the client expects. The CommonJS wrapper is neutralised rather than
 * stripped, so this stays a verbatim copy of the server's own implementation
 * and the two cannot drift apart in how they render a message.
 */
(function () {
	var module = { exports: {} };
	var exports = module.exports;
${formatter.split('\n').map(l => (l ? '\t' + l : l)).join('\n')}
	window.formatText = typeof formatText !== 'undefined' ? formatText : module.exports.formatText;
	window.stripFormatting = typeof stripFormatting !== 'undefined' ? stripFormatting : module.exports.stripFormatting;
	if (typeof window.formatText !== 'function') {
		console.error('battle-log-misc: formatText failed to load');
	}
})();
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, wrapped);
console.log(`wrote ${OUT} (${(wrapped.length / 1024).toFixed(1)} KB)`);
