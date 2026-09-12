"use strict";













var MAX_UNDO_HISTORY=100;var


MiniEdit=function(){




















































function MiniEdit(
el,options)
{var _this=this;this.element=void 0;this._setContent=void 0;this.pushHistory=void 0;this.composing=false;this.lastSelection=null;this.selectionChangeTimeout=null;this.pointerFocus=false;this.pointerFocusTimeout=null;this.onSelectionChange=function(){if(_this.selectionChangeTimeout)clearTimeout(_this.selectionChangeTimeout);_this.selectionChangeTimeout=setTimeout(function(){_this.selectionChangeTimeout=null;if(document.activeElement!==_this.element||!document.hasFocus())return;_this.lastSelection=_this.getSelection()||_this.lastSelection;},0);};this.onPointerDown=function(){_this.pointerFocus=true;if(_this.pointerFocusTimeout)clearTimeout(_this.pointerFocusTimeout);_this.pointerFocusTimeout=setTimeout(function(){_this.pointerFocus=false;_this.pointerFocusTimeout=null;},0);};this.onFocus=function(){if(!_this.pointerFocus)_this.setSelection(_this.lastSelection);};this.onKeyDown=function(ev){if(ev.isComposing)return;if(ev.keyCode===13){_this.replaceSelection('\n');ev.preventDefault();}};
this.element=el;

this._setContent=options.setContent;
this.onKeyDown=options.onKeyDown||this.onKeyDown;

this.element.setAttribute('contentEditable','true');
this.element.setAttribute('autoComplete','off');
this.element.setAttribute('spellCheck','false');
this.element.addEventListener('input',function(ev){
if(_this.composing||ev.isComposing)return;
_this.reformat();
});
this.element.addEventListener('compositionstart',function(){
_this.composing=true;
});
this.element.addEventListener('compositionend',function(){


_this.composing=false;
_this.reformat();
});
this.element.addEventListener('pointerdown',this.onPointerDown);
this.element.addEventListener('focus',this.onFocus);
this.element.addEventListener('keydown',this.onKeyDown);
document.addEventListener('selectionchange',this.onSelectionChange);for(var _i2=0,_MiniEdit$plugins2=

MiniEdit.plugins;_i2<_MiniEdit$plugins2.length;_i2++){var Plugin=_MiniEdit$plugins2[_i2];new Plugin(this);}
}var _proto=MiniEdit.prototype;_proto.
destroy=function destroy(){
document.removeEventListener('selectionchange',this.onSelectionChange);
if(this.selectionChangeTimeout)clearTimeout(this.selectionChangeTimeout);
if(this.pointerFocusTimeout)clearTimeout(this.pointerFocusTimeout);
};_proto.


traverseText=function traverseText(node,callback){
if(node.nodeType===3){
if(callback(node))return true;
}else{
for(var i=0,len=node.childNodes.length;i<len;++i){
if(this.traverseText(node.childNodes[i],callback))return true;
}
}
return false;
};_proto.

setValue=function setValue(text){var _this$pushHistory;var selection=arguments.length>1&&arguments[1]!==undefined?arguments[1]:this.getSelection();
this._setContent(text);

this.setSelection(selection);
(_this$pushHistory=this.pushHistory)==null||_this$pushHistory.call(this,text,selection);
};_proto.
getValue=function getValue(){
var text=this.element.textContent||'';
if(text.endsWith('\n'))return text.slice(0,-1);
return text;
};_proto.
reformat=function reformat(selection){
this.setValue(this.getValue(),selection);
};_proto.
replaceSelection=function replaceSelection(text){
var selection=this.getSelection();
var oldContent=this.getValue();
var newText=oldContent.slice(0,selection.start)+text+oldContent.slice(selection.end);
this.setValue(newText,{start:selection.start+text.length,end:selection.start+text.length});
};_proto.

getSelection=function getSelection(){
var sel=window.getSelection();
var offset=0;
var start=null;
var end=null;

if(sel.rangeCount){
var range=sel.getRangeAt(0);
this.traverseText(this.element,function(node){
if(start===null&&node===range.startContainer){
start=offset+range.startOffset;
}

if(start!==null&&node===range.endContainer){
end=offset+range.endOffset;
return true;
}

offset+=node.length;
return false;
});
}

return start===null||end===null?null:{start:start,end:end};
};_proto.

setSelection=function setSelection(sel){
if(sel===null)return;
this.lastSelection=sel;

var range=document.createRange();
var offset=0;
var found=false;
range.collapse(true);

if(this.traverseText(this.element,function(n){
var nextOffset=offset+n.length;

if(!found&&sel.start>=offset&&sel.start<=nextOffset){
range.setStart(n,sel.start-offset);
found=true;
}

if(found&&sel.end>=offset&&sel.end<=nextOffset){
range.setEnd(n,sel.end-offset);
return true;
}

offset=nextOffset;
return false;
})){
var selection=window.getSelection();
selection.removeAllRanges();
selection.addRange(range);
}
};_proto.
select=function select(){
this.setSelection({start:0,end:this.getValue().length});
};return MiniEdit;}();MiniEdit.plugins=[];


var HTML_BLOCK_TAGS=[
'ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DD','DIV','DL','DT',
'FIGCAPTION','FIGURE','FOOTER','H1','H2','H3','H4','H5','H6',
'HEADER','HR','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE',
'TBODY','TD','TFOOT','TH','THEAD','TR','UL'];var



MiniEditPastePlugin=function(){
function MiniEditPastePlugin(editor){var _this2=this;
editor.element.addEventListener('paste',function(e){

var text=_this2.getClipboardPlainText(e.clipboardData);
editor.replaceSelection(text);
e.preventDefault();
});
}var _proto2=MiniEditPastePlugin.prototype;_proto2.
getClipboardPlainText=function getClipboardPlainText(data){
var text=data.getData('text/plain');



var html=data.getData('text/html');
if(!html||text.includes('\n'))return text;

var htmlText=this.htmlToPlainText(html);
return htmlText.trim().includes('\n')?htmlText:text;
};_proto2.

htmlToPlainText=function htmlToPlainText(html){



return html.

replace(/<!--[\s\S]*?-->/g,'').
replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'').


replace(/\n/g,'').
replace(new RegExp("</?(?:"+HTML_BLOCK_TAGS.join('|')+")\\b[^>]*>",'gi'),'\n').
replace(/\n{2,}/g,'\n').
replace(/<br\b[^>]*>\n?/gi,'\n').

replace(/<[^>]*>/g,'').
replace(/^\n+$/g,'').
replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,function(entity,value){
switch(value.toLowerCase()){
case'amp':return'&';
case'gt':return'>';
case'lt':return'<';
case'nbsp':return' ';
case'quot':return'"';
case'apos':return"'";
default:
if(!value.startsWith('#'))return entity;
var code=value.charAt(1).toLowerCase()==='x'?
parseInt(value.slice(2),16):parseInt(value.slice(1),10);
return isNaN(code)?entity:String.fromCharCode(code);
}
});
};return MiniEditPastePlugin;}();

MiniEdit.plugins.push(MiniEditPastePlugin);var






MiniEditUndoPlugin=





function MiniEditUndoPlugin(editor){var _this3=this;this.editor=void 0;this.undoIndex=null;this.ignoreInput=false;this.history=[];this.







onPushHistory=function(text,selection){
if(_this3.ignoreInput){

_this3.ignoreInput=false;
return;
}

if(_this3.undoIndex!==null){

_this3.history.splice(_this3.undoIndex+1);
_this3.undoIndex=null;
}

_this3.history.push({text:text,selection:selection});

if(_this3.history.length>MAX_UNDO_HISTORY)_this3.history.shift();
};this.

onKeyDown=function(e){
if(e.isComposing)return;

var undoPressed=e.ctrlKey&&e.keyCode===90||e.metaKey&&!e.shiftKey&&e.keyCode===90;

var redoPressed=e.ctrlKey&&e.keyCode===89||e.metaKey&&e.shiftKey&&e.keyCode===90;

if(undoPressed){var _this3$undoIndex;
(_this3$undoIndex=_this3.undoIndex)!=null?_this3$undoIndex:_this3.undoIndex=_this3.history.length-1;
_this3.undoIndex--;

if(_this3.undoIndex<0){
_this3.undoIndex=0;
return;
}
}else if(redoPressed&&_this3.undoIndex!==null){
_this3.undoIndex++;

if(_this3.undoIndex>_this3.history.length-1){
_this3.undoIndex=null;
return;
}
}else{
return;
}

var _this3$history$_this=_this3.history[_this3.undoIndex],text=_this3$history$_this.text,selection=_this3$history$_this.selection;
_this3.ignoreInput=true;
_this3.editor.setValue(text,selection);
};this.editor=editor;this.history.push({text:editor.getValue(),selection:{start:0,end:0}});this.editor.pushHistory=this.onPushHistory;editor.element.addEventListener('keydown',this.onKeyDown);};

MiniEdit.plugins.push(MiniEditUndoPlugin);
//# sourceMappingURL=miniedit.js.map