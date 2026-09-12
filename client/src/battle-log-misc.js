/**
 * Pokemon Showdown Log Misc
 *
 * Some miscellaneous helper functions for battle-log.ts, namely:
 *
 * - an MD5 hasher
 *
 * - nothing else, currently
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

/* eslint-disable */

// MD5 minified
function MD5(f){function i(b,c){var d,e,f,g,h;f=b&2147483648;g=c&2147483648;d=b&1073741824;e=c&1073741824;h=(b&1073741823)+(c&1073741823);return d&e?h^2147483648^f^g:d|e?h&1073741824?h^3221225472^f^g:h^1073741824^f^g:h^f^g}function j(b,c,d,e,f,g,h){b=i(b,i(i(c&d|~c&e,f),h));return i(b<<g|b>>>32-g,c)}function k(b,c,d,e,f,g,h){b=i(b,i(i(c&e|d&~e,f),h));return i(b<<g|b>>>32-g,c)}function l(b,c,e,d,f,g,h){b=i(b,i(i(c^e^d,f),h));return i(b<<g|b>>>32-g,c)}function m(b,c,e,d,f,g,h){b=i(b,i(i(e^(c|~d),
f),h));return i(b<<g|b>>>32-g,c)}function n(b){var c="",e="",d;for(d=0;d<=3;d++)e=b>>>d*8&255,e="0"+e.toString(16),c+=e.substr(e.length-2,2);return c}var g=[],o,p,q,r,b,c,d,e,f=function(b){for(var b=b.replace(/\r\n/g,"\n"),c="",e=0;e<b.length;e++){var d=b.charCodeAt(e);d<128?c+=String.fromCharCode(d):(d>127&&d<2048?c+=String.fromCharCode(d>>6|192):(c+=String.fromCharCode(d>>12|224),c+=String.fromCharCode(d>>6&63|128)),c+=String.fromCharCode(d&63|128))}return c}(f),g=function(b){var c,d=b.length;c=
d+8;for(var e=((c-c%64)/64+1)*16,f=Array(e-1),g=0,h=0;h<d;)c=(h-h%4)/4,g=h%4*8,f[c]|=b.charCodeAt(h)<<g,h++;f[(h-h%4)/4]|=128<<h%4*8;f[e-2]=d<<3;f[e-1]=d>>>29;return f}(f);b=1732584193;c=4023233417;d=2562383102;e=271733878;for(f=0;f<g.length;f+=16)o=b,p=c,q=d,r=e,b=j(b,c,d,e,g[f+0],7,3614090360),e=j(e,b,c,d,g[f+1],12,3905402710),d=j(d,e,b,c,g[f+2],17,606105819),c=j(c,d,e,b,g[f+3],22,3250441966),b=j(b,c,d,e,g[f+4],7,4118548399),e=j(e,b,c,d,g[f+5],12,1200080426),d=j(d,e,b,c,g[f+6],17,2821735955),c=
j(c,d,e,b,g[f+7],22,4249261313),b=j(b,c,d,e,g[f+8],7,1770035416),e=j(e,b,c,d,g[f+9],12,2336552879),d=j(d,e,b,c,g[f+10],17,4294925233),c=j(c,d,e,b,g[f+11],22,2304563134),b=j(b,c,d,e,g[f+12],7,1804603682),e=j(e,b,c,d,g[f+13],12,4254626195),d=j(d,e,b,c,g[f+14],17,2792965006),c=j(c,d,e,b,g[f+15],22,1236535329),b=k(b,c,d,e,g[f+1],5,4129170786),e=k(e,b,c,d,g[f+6],9,3225465664),d=k(d,e,b,c,g[f+11],14,643717713),c=k(c,d,e,b,g[f+0],20,3921069994),b=k(b,c,d,e,g[f+5],5,3593408605),e=k(e,b,c,d,g[f+10],9,38016083),
d=k(d,e,b,c,g[f+15],14,3634488961),c=k(c,d,e,b,g[f+4],20,3889429448),b=k(b,c,d,e,g[f+9],5,568446438),e=k(e,b,c,d,g[f+14],9,3275163606),d=k(d,e,b,c,g[f+3],14,4107603335),c=k(c,d,e,b,g[f+8],20,1163531501),b=k(b,c,d,e,g[f+13],5,2850285829),e=k(e,b,c,d,g[f+2],9,4243563512),d=k(d,e,b,c,g[f+7],14,1735328473),c=k(c,d,e,b,g[f+12],20,2368359562),b=l(b,c,d,e,g[f+5],4,4294588738),e=l(e,b,c,d,g[f+8],11,2272392833),d=l(d,e,b,c,g[f+11],16,1839030562),c=l(c,d,e,b,g[f+14],23,4259657740),b=l(b,c,d,e,g[f+1],4,2763975236),
e=l(e,b,c,d,g[f+4],11,1272893353),d=l(d,e,b,c,g[f+7],16,4139469664),c=l(c,d,e,b,g[f+10],23,3200236656),b=l(b,c,d,e,g[f+13],4,681279174),e=l(e,b,c,d,g[f+0],11,3936430074),d=l(d,e,b,c,g[f+3],16,3572445317),c=l(c,d,e,b,g[f+6],23,76029189),b=l(b,c,d,e,g[f+9],4,3654602809),e=l(e,b,c,d,g[f+12],11,3873151461),d=l(d,e,b,c,g[f+15],16,530742520),c=l(c,d,e,b,g[f+2],23,3299628645),b=m(b,c,d,e,g[f+0],6,4096336452),e=m(e,b,c,d,g[f+7],10,1126891415),d=m(d,e,b,c,g[f+14],15,2878612391),c=m(c,d,e,b,g[f+5],21,4237533241),
b=m(b,c,d,e,g[f+12],6,1700485571),e=m(e,b,c,d,g[f+3],10,2399980690),d=m(d,e,b,c,g[f+10],15,4293915773),c=m(c,d,e,b,g[f+1],21,2240044497),b=m(b,c,d,e,g[f+8],6,1873313359),e=m(e,b,c,d,g[f+15],10,4264355552),d=m(d,e,b,c,g[f+6],15,2734768916),c=m(c,d,e,b,g[f+13],21,1309151649),b=m(b,c,d,e,g[f+4],6,4149444226),e=m(e,b,c,d,g[f+11],10,3174756917),d=m(d,e,b,c,g[f+2],15,718787259),c=m(c,d,e,b,g[f+9],21,3951481745),b=i(b,o),c=i(c,p),d=i(d,q),e=i(e,r);return(n(b)+n(c)+n(d)+n(e)).toLowerCase()};
/* eslint-enable */


/**
 * Chat formatting, compiled from the server's chat-formatter and exposed as the
 * globals the client expects. The CommonJS wrapper is neutralised rather than
 * stripped, so this stays a verbatim copy of the server's own implementation
 * and the two cannot drift apart in how they render a message.
 */
(function () {
	var module = { exports: {} };
	var exports = module.exports;
	"use strict";
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
	  for (var name in all)
	    __defProp(target, name, { get: all[name], enumerable: true });
	};
	var __copyProps = (to, from, except, desc) => {
	  if (from && typeof from === "object" || typeof from === "function") {
	    for (let key of __getOwnPropNames(from))
	      if (!__hasOwnProp.call(to, key) && key !== except)
	        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
	  }
	  return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var chat_formatter_exports = {};
	__export(chat_formatter_exports, {
	  formatText: () => formatText,
	  linkRegex: () => linkRegex,
	  stripFormatting: () => stripFormatting
	});
	module.exports = __toCommonJS(chat_formatter_exports);
	/**
	 * Chat parser
	 * Pokemon Showdown - http://pokemonshowdown.com/
	 *
	 * Parses format.
	 *
	 * @license MIT
	 */
	const linkRegex = /(?:(?:https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*|www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:(?:com?|org|net|edu|info|us|jp)\b|[a-z]{2,3}(?=:[0-9]|\/)))(?::[0-9]+)?(?:\/(?:(?:[^\s()&<>[\]`]|&amp;|&quot;|\((?:[^\s()<>&[\]]|&amp;)*\)|\[(?:[^\s()<>&[\]]|&amp;)*])*(?:[^\s()[\]{}".,!?;:&<>*`^~\\]|\((?:[^\s()<>&[\]]|&amp;)*\)))?)?|[a-z0-9.]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?![^ ]*&gt;)/ig;
	class TextFormatter {
	  constructor(str, isTrusted = false, replaceLinebreaks = false, showSyntax = false) {
	    str = `${str}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	    str = str.replace(linkRegex, (uri) => {
	      if (showSyntax) return `<u>${uri}</u>`;
	      let fulluri;
	      if (/^[a-z0-9.]+@/ig.test(uri)) {
	        fulluri = "mailto:" + uri;
	      } else {
	        fulluri = uri.replace(/^([a-z]*[^a-z:])/g, "http://$1");
	        if (uri.startsWith("https://docs.google.com/") || uri.startsWith("docs.google.com/")) {
	          if (uri.startsWith("https")) uri = uri.slice(8);
	          if (uri.endsWith("?usp=sharing") || uri.endsWith("&usp=sharing")) uri = uri.slice(0, -12);
	          if (uri.endsWith("#gid=0")) uri = uri.slice(0, -6);
	          let slashIndex = uri.lastIndexOf("/");
	          if (uri.length - slashIndex > 18) slashIndex = uri.length;
	          if (slashIndex - 4 > 19 + 3) {
	            uri = `${uri.slice(0, 19)}<small class="message-overflow">${uri.slice(19, slashIndex - 4)}</small>${uri.slice(slashIndex - 4)}`;
	          }
	        }
	      }
	      return `<a href="${fulluri}" rel="noopener" target="_blank">${uri}</a>`;
	    });
	    this.str = str;
	    this.buffers = [];
	    this.stack = [];
	    this.isTrusted = isTrusted;
	    this.replaceLinebreaks = this.isTrusted || replaceLinebreaks;
	    this.showSyntax = showSyntax;
	    this.offset = 0;
	  }
	  // debugAt(i=0, j=i+1) { console.log(`${this.slice(0, i)}[${this.slice(i, j)}]${this.slice(j, this.str.length)}`); }
	  slice(start, end) {
	    return this.str.slice(start, end);
	  }
	  at(start) {
	    return this.str.charAt(start);
	  }
	  /**
	   * We've encountered a possible start for a span. It's pushed onto our span
	   * stack.
	   *
	   * The span stack saves the start position so it can be replaced with HTML
	   * if we find an end for the span, but we don't actually replace it until
	   * `closeSpan` is called, so nothing happens (it stays plaintext) if no end
	   * is found.
	   */
	  pushSpan(spanType, start, end) {
	    this.pushSlice(start);
	    this.stack.push([spanType, this.buffers.length]);
	    this.buffers.push(this.slice(start, end));
	    this.offset = end;
	  }
	  pushSlice(end) {
	    if (end !== this.offset) {
	      this.buffers.push(this.slice(this.offset, end));
	      this.offset = end;
	    }
	  }
	  closeParenSpan(start) {
	    let stackPosition = -1;
	    for (let i = this.stack.length - 1; i >= 0; i--) {
	      const span = this.stack[i];
	      if (span[0] === "(") {
	        stackPosition = i;
	        break;
	      }
	      if (span[0] !== "spoiler") break;
	    }
	    if (stackPosition === -1) return false;
	    this.pushSlice(start);
	    while (this.stack.length > stackPosition) this.popSpan(start);
	    this.offset = start;
	    return true;
	  }
	  /**
	   * We've encountered a possible end for a span. If it's in the span stack,
	   * we transform it into HTML.
	   */
	  closeSpan(spanType, start, end) {
	    let stackPosition = -1;
	    for (let i = this.stack.length - 1; i >= 0; i--) {
	      const span2 = this.stack[i];
	      if (span2[0] === spanType) {
	        stackPosition = i;
	        break;
	      }
	    }
	    if (stackPosition === -1) return false;
	    this.pushSlice(start);
	    while (this.stack.length > stackPosition + 1) this.popSpan(start);
	    const span = this.stack.pop();
	    const startIndex = span[1];
	    let tagName = "";
	    let attrs = "";
	    switch (spanType) {
	      case "_":
	        tagName = "i";
	        break;
	      case "*":
	        tagName = "b";
	        break;
	      case "~":
	        tagName = "s";
	        break;
	      case "^":
	        tagName = "sup";
	        break;
	      case "\\":
	        tagName = "sub";
	        break;
	      case "|":
	        tagName = "span";
	        attrs = this.showSyntax ? ' class="spoiler-shown"' : ' class="spoiler"';
	        break;
	    }
	    const syntax = this.showSyntax ? `<tt>${spanType}${spanType}</tt>` : "";
	    if (tagName) {
	      this.buffers[startIndex] = `${syntax}<${tagName}${attrs}>`;
	      this.buffers.push(`</${tagName}>${syntax}`);
	      this.offset = end;
	    }
	    return true;
	  }
	  /**
	   * Ends a span without an ending symbol. For most spans, this means
	   * they don't take effect, but certain spans like spoiler tags don't
	   * require ending symbols.
	   */
	  popSpan(end) {
	    const span = this.stack.pop();
	    if (!span) return false;
	    this.pushSlice(end);
	    switch (span[0]) {
	      case "spoiler":
	        this.buffers.push(`</span>`);
	        this.buffers[span[1]] = this.showSyntax ? `<span class="spoiler-shown">` : `<span class="spoiler">`;
	        break;
	      case ">":
	        this.buffers.push(`</span>`);
	        this.buffers[span[1]] = `<span class="greentext">`;
	        break;
	      default:
	        break;
	    }
	    return true;
	  }
	  popAllSpans(end) {
	    while (this.stack.length) this.popSpan(end);
	    this.pushSlice(end);
	  }
	  toUriComponent(html) {
	    const component = html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
	    return encodeURIComponent(component);
	  }
	  runEvalLookahead(i) {
	    const evalIndex = this.slice(0, 9) === "&gt;&gt; " ? 8 : this.slice(0, 13) === "&gt;&gt;&gt; " ? 12 : 0;
	    if (!evalIndex) return false;
	    this.pushSlice(i);
	    this.buffers.push(`<tt class="message-cmd"><strong>`);
	    this.buffers.push(this.slice(i, i + evalIndex));
	    this.buffers.push(`</strong>`);
	    this.buffers.push(this.str.slice(i + evalIndex));
	    this.buffers.push(`</tt>`);
	    this.offset = this.str.length;
	    return true;
	  }
	  runCommandLookahead(i) {
	    if (!this.str || !"!/".includes(this.at(i))) return false;
	    if (this.at(i + 1) === "/") {
	      if (this.at(i) === "!") return false;
	      this.pushSlice(i);
	      this.buffers.push(`<tt>/</tt>`);
	      this.offset = i + 1;
	      return true;
	    }
	    let spaceIndex = this.str.indexOf(" ", i);
	    if (spaceIndex < 0) spaceIndex = this.str.length;
	    if (this.slice(i, i + 9).toLowerCase() === `/me&apos;`) spaceIndex = i + 3;
	    const command = this.slice(i + 1, spaceIndex);
	    switch (command.toLowerCase()) {
	      case "me":
	      case "mee":
	      case "announce":
	        this.pushSlice(i);
	        this.buffers.push(`<tt class="message-cmd"><strong>`);
	        this.buffers.push(this.slice(i, spaceIndex));
	        this.buffers.push(`</strong></tt>`);
	        this.offset = spaceIndex;
	        return true;
	      case "":
	        if (this.at(i) === "!") return false;
	        this.pushSlice(i);
	        this.buffers.push(`<tt class="message-error"><strong>/</strong>`);
	        this.buffers.push(this.str.slice(i + 1));
	        this.buffers.push(`</tt>`);
	        this.offset = this.str.length;
	        return true;
	    }
	    this.pushSlice(i);
	    this.buffers.push(`<tt class="message-cmd"><strong>`);
	    this.buffers.push(this.slice(i, spaceIndex));
	    this.buffers.push(`</strong>`);
	    this.buffers.push(this.str.slice(spaceIndex));
	    this.buffers.push(`</tt>`);
	    this.offset = this.str.length;
	    return true;
	  }
	  /**
	   * Handles special cases.
	   */
	  runLookahead(spanType, start) {
	    switch (spanType) {
	      case "`":
	        {
	          let delimLength = 0;
	          let i = start;
	          while (this.at(i) === "`") {
	            delimLength++;
	            i++;
	          }
	          let curDelimLength = 0;
	          while (i < this.str.length) {
	            const char = this.at(i);
	            if (char === "\n") break;
	            if (char === "`") {
	              curDelimLength++;
	            } else {
	              if (curDelimLength === delimLength) break;
	              curDelimLength = 0;
	            }
	            i++;
	          }
	          if (curDelimLength !== delimLength) return false;
	          const end = i;
	          this.pushSlice(start);
	          let innerStart = start + delimLength;
	          let innerEnd = i - delimLength;
	          if (innerStart + 1 >= innerEnd) {
	          } else if (this.at(innerStart) === " " && this.at(innerEnd - 1) === " ") {
	            innerStart++;
	            innerEnd--;
	          } else if (this.at(innerStart) === " " && this.at(innerStart + 1) === "`") {
	            innerStart++;
	          } else if (this.at(innerEnd - 1) === " " && this.at(innerEnd - 2) === "`") {
	            innerEnd--;
	          }
	          if (this.showSyntax) this.buffers.push(`<tt>${this.slice(start, innerStart)}</tt>`);
	          this.buffers.push(`<code>`);
	          this.buffers.push(this.slice(innerStart, innerEnd));
	          this.buffers.push(`</code>`);
	          if (this.showSyntax) this.buffers.push(`<tt>${this.slice(innerEnd, end)}</tt>`);
	          this.offset = end;
	        }
	        return true;
	      case "[":
	        {
	          if (this.slice(start, start + 2) !== "[[") return false;
	          let i = start + 2;
	          let colonPos = -1;
	          let anglePos = -1;
	          while (i < this.str.length) {
	            const char = this.at(i);
	            if (char === "]" || char === "\n") break;
	            if (char === ":" && colonPos < 0) colonPos = i;
	            if (char === "&" && this.slice(i, i + 4) === "&lt;") anglePos = i;
	            i++;
	          }
	          if (this.slice(i, i + 2) !== "]]") return false;
	          this.pushSlice(start);
	          this.offset = i + 2;
	          let termEnd = i;
	          let uri = "";
	          if (anglePos >= 0 && this.slice(i - 4, i) === "&gt;") {
	            uri = this.slice(anglePos + 4, i - 4);
	            termEnd = anglePos;
	            if (this.at(termEnd - 1) === " ") termEnd--;
	            uri = encodeURI(uri.replace(/^([a-z]*[^a-z:])/g, "http://$1"));
	          }
	          let term = this.slice(start + 2, termEnd).replace(/<\/?[au](?: [^>]+)?>/g, "");
	          if (this.showSyntax) {
	            term += `<small>${this.slice(termEnd, i)}</small>`;
	          } else if (uri && !this.isTrusted) {
	            const shortUri = uri.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
	            term += `<small> &lt;${shortUri}&gt;</small>`;
	            uri += '" rel="noopener';
	          }
	          if (colonPos > 0) {
	            const key = this.slice(start + 2, colonPos).toLowerCase();
	            switch (key) {
	              case "w":
	              case "wiki":
	                if (this.showSyntax) break;
	                term = term.slice(term.charAt(key.length + 1) === " " ? key.length + 2 : key.length + 1);
	                uri = `//en.wikipedia.org/w/index.php?title=Special:Search&search=${this.toUriComponent(term)}`;
	                term = `wiki: ${term}`;
	                break;
	              case "pokemon":
	              case "item":
	              case "type":
	              case "category":
	                if (this.showSyntax) {
	                  this.buffers.push(`<tt>${this.slice(start, this.offset)}</tt>`);
	                  return true;
	                }
	                term = term.slice(term.charAt(key.length + 1) === " " ? key.length + 2 : key.length + 1);
	                let display = "";
	                if (this.isTrusted) {
	                  display = `<psicon ${key}="${term}" />`;
	                } else {
	                  display = `[${term}]`;
	                }
	                let dir = key;
	                if (key === "item") dir += "s";
	                if (key === "category") dir = "categories";
	                uri = `//dex.pokemonshowdown.com/${dir}/${toID(term)}`;
	                term = display;
	            }
	          }
	          if (!uri) {
	            uri = `//www.google.com/search?ie=UTF-8&btnI&q=${this.toUriComponent(term)}`;
	          }
	          if (this.showSyntax) {
	            this.buffers.push(`<tt>[[</tt><u>${term}</u><tt>]]</tt>`);
	          } else {
	            this.buffers.push(`<a href="${uri}" target="_blank">${term}</a>`);
	          }
	        }
	        return true;
	      case "<":
	        {
	          if (this.slice(start, start + 8) !== "&lt;&lt;") return false;
	          let i = start + 8;
	          while (/[a-z0-9-]/.test(this.at(i))) i++;
	          if (this.slice(i, i + 8) !== "&gt;&gt;") return false;
	          this.pushSlice(start);
	          const roomid = this.slice(start + 8, i);
	          if (this.showSyntax) {
	            this.buffers.push(`<small>&lt;&lt;</small><u>${roomid}</u><small>&gt;&gt;</small>`);
	          } else {
	            this.buffers.push(`&laquo;<a href="/${roomid}" target="_blank">${roomid}</a>&raquo;`);
	          }
	          this.offset = i + 8;
	        }
	        return true;
	      case "a":
	      case "u":
	        {
	          let i = start + 2;
	          while (this.at(i) !== "<" || this.at(i + 1) !== "/" || this.at(i + 3) !== ">") {
	            if (i >= this.str.length) {
	              throw new Error(`Unclosed URL span when parsing: ${this.str}`);
	            }
	            i++;
	          }
	          i += 4;
	          this.pushSlice(i);
	        }
	        return true;
	    }
	    return false;
	  }
	  get() {
	    let beginningOfLine = this.offset;
	    for (let i = beginningOfLine; i < this.str.length; i++) {
	      const char = this.at(i);
	      switch (char) {
	        case "/":
	        case "!":
	          if (!this.showSyntax || i !== beginningOfLine) break;
	          this.runCommandLookahead(i);
	          if (i < this.offset) {
	            i = this.offset;
	            break;
	          }
	          break;
	        case "_":
	        case "*":
	        case "~":
	        case "^":
	        case "\\":
	        case "|":
	          if (this.at(i + 1) === char && this.at(i + 2) !== char) {
	            if (!(this.at(i - 1) !== " " && this.closeSpan(char, i, i + 2))) {
	              if (this.at(i + 2) !== " ") this.pushSpan(char, i, i + 2);
	            }
	            if (i < this.offset) {
	              i = this.offset - 1;
	              break;
	            }
	          }
	          while (this.at(i + 1) === char) i++;
	          break;
	        case "(":
	          this.stack.push(["(", -1]);
	          break;
	        case ")":
	          this.closeParenSpan(i);
	          if (i < this.offset) {
	            i = this.offset - 1;
	            break;
	          }
	          break;
	        case "`":
	          if (this.at(i + 1) === "`") this.runLookahead("`", i);
	          if (i < this.offset) {
	            i = this.offset - 1;
	            break;
	          }
	          while (this.at(i + 1) === "`") i++;
	          break;
	        case "[":
	          this.runLookahead("[", i);
	          if (i < this.offset) {
	            i = this.offset - 1;
	            break;
	          }
	          while (this.at(i + 1) === "[") i++;
	          break;
	        case ":":
	          if (i < 7) break;
	          if (this.slice(i - 7, i + 1).toLowerCase() === "spoiler:" || this.slice(i - 8, i + 1).toLowerCase() === "spoilers:") {
	            if (this.at(i + 1) === " ") i++;
	            this.pushSpan("spoiler", i + 1, i + 1);
	          }
	          break;
	        case "&":
	          if (i === beginningOfLine && this.slice(i, i + 4) === "&gt;") {
	            if (this.runEvalLookahead(i)) {
	            } else if (!"._/=:;".includes(this.at(i + 4)) && !["w&lt;", "w&gt;"].includes(this.slice(i + 4, i + 9))) {
	              this.pushSpan(">", i, i);
	            }
	          } else {
	            this.runLookahead("<", i);
	          }
	          if (i < this.offset) {
	            i = this.offset - 1;
	            break;
	          }
	          while (this.slice(i + 1, i + 5) === "lt;&") i += 4;
	          break;
	        case "<":
	          this.runLookahead("a", i);
	          if (i < this.offset) {
	            i = this.offset - 1;
	            break;
	          }
	          break;
	        case "\r":
	        case "\n":
	          this.popAllSpans(i);
	          if (this.replaceLinebreaks) {
	            this.buffers.push(`<br />`);
	            this.offset++;
	          }
	          beginningOfLine = i + 1;
	          break;
	      }
	    }
	    this.popAllSpans(this.str.length);
	    return this.buffers.join("");
	  }
	}
	function formatText(str, isTrusted = false, replaceLinebreaks = false, showSyntax = false) {
	  return new TextFormatter(str, isTrusted, replaceLinebreaks, showSyntax).get();
	}
	function stripFormatting(str) {
	  str = str.replace(
	    /\*\*([^\s*]+)\*\*|__([^\s_]+)__|~~([^\s~]+)~~|``([^\s`]+)``|\^\^([^\s^]+)\^\^|\\([^\s\\]+)\\/g,
	    (match, $1, $2, $3, $4, $5, $6) => $1 || $2 || $3 || $4 || $5 || $6
	  );
	  return str.replace(/\[\[(?:([^<]*)\s*<[^>]+>|([^\]]+))\]\]/g, (match, $1, $2) => $1 || $2 || "");
	}


	window.formatText = typeof formatText !== 'undefined' ? formatText : module.exports.formatText;
	window.stripFormatting = typeof stripFormatting !== 'undefined' ? stripFormatting : module.exports.stripFormatting;
	if (typeof window.formatText !== 'function') {
		console.error('battle-log-misc: formatText failed to load');
	}
})();
