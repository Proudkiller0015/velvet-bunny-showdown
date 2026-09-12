"use strict";var _PSView,_navigator$platform;function _inheritsLoose(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,_setPrototypeOf(t,o);}function _setPrototypeOf(t,e){return _setPrototypeOf=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t;},_setPrototypeOf(t,e);}/**
 * Panels
 *
 * Main view - sets up the frame, and the generic panels.
 *
 * Also sets up most global event listeners.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */














var EXTERNAL_REDIRECTS=/^(appeals?|rooms?suggestions?|suggestions?|adminrequests?|bugs?|bugreports?|rules?|faq|credits?|privacy|contact|dex|insecure)$/;var

PSRouter=function(){


function PSRouter(){this.roomid='';this.panelState='';
var currentRoomid=location.pathname.slice(1);
if(/^[a-z0-9-]*$/.test(currentRoomid)){
this.subscribeHistory();
}else if(location.pathname.endsWith('.html')){
this.subscribeHash();
}
}var _proto=PSRouter.prototype;_proto.
extractRoomID=function extractRoomID(url){
if(!url)return null;
if(url.startsWith(document.location.origin)){
url=url.slice(document.location.origin.length);
}else{
if(url.startsWith('http://')){
url=url.slice(7);
}else if(url.startsWith('https://')){
url=url.slice(8);
}
if(url.startsWith('psim.us/t/')){
url="viewteam-"+url.slice(10);
}
if(url.startsWith('teams.pokemonshowdown.com/view/')&&/[0-9]/.test(url.charAt(31))){
url="viewteam-"+url.slice(31);
}
if(url.startsWith('psim.us/r/')){
url="battle-"+url.slice(10);
}
if(url.startsWith('replay.pokemonshowdown.com/')&&/[a-z]/.test(url.charAt(27))){
url="battle-"+url.slice(27);
}
if(url.startsWith(document.location.host)){
url=url.slice(document.location.host.length);
}else if(PS.server.id==='showdown'&&url.startsWith('play.pokemonshowdown.com')){
url=url.slice(24);
}else if(PS.server.id==='showdown'&&url.startsWith('psim.us')){
url=url.slice(7);
}else if(url.startsWith('replay.pokemonshowdown.com')){
url=url.slice(26).replace('/','/battle-');
}
}
if(url.startsWith('/'))url=url.slice(1);
if(url==='.')url='';


if(!/^[a-z0-9-]*$/.test(url)&&!url.startsWith('view-'))return null;

if(EXTERNAL_REDIRECTS.test(url))return null;

if(url.startsWith('view-teams-view-')){
var teamid=url.slice(16);
url="viewteam-"+teamid;
}
return url;
};_proto.

updatePanelState=function updatePanelState(){
var room=PS.room;


if(room.noURL)room=PS.rooms[PS.popups[PS.popups.length-2]]||PS.panel;
if(room.noURL)room=PS.panel;


if(room.id==='news'&&room.location==='mini-window')room=PS.mainmenu;
if(room.id===''&&PS.leftPanelWidth&&PS.rightPanel){
room=PS.rightPanel;
}
if(room.id==='rooms'&&PS.leftPanelWidth)room=PS.leftPanel;

var roomid=room.id;
var panelState=PS.leftPanelWidth&&room===PS.panel?
PS.leftPanel.id+'..'+PS.rightPanel.id:
room.id;
var newTitle=roomid===''?'Showdown!':room.getTitle()+" - Showdown!";
var changed=roomid!==this.roomid;

this.roomid=roomid;
if(this.panelState===panelState)changed=null;
this.panelState=panelState;
return{roomid:roomid,changed:changed,newTitle:newTitle};
};_proto.
subscribeHash=function subscribeHash(){var _this=this;
if(location.hash){
var currentRoomid=location.hash.slice(1);
if(/^[a-z0-9-]+$/.test(currentRoomid)){
PS.join(currentRoomid);
}
}
{
var _this$updatePanelStat=this.updatePanelState(),newTitle=_this$updatePanelStat.newTitle;
document.title=newTitle;
}
PS.subscribe(function(){
var _this$updatePanelStat2=_this.updatePanelState(),roomid=_this$updatePanelStat2.roomid,changed=_this$updatePanelStat2.changed,newTitle=_this$updatePanelStat2.newTitle;
if(changed)location.hash=roomid?"#"+roomid:'';

document.title=newTitle;
});
window.addEventListener('hashchange',function(e){var _PS$rooms$PS$popups;

if(PS.popups.length&&(_PS$rooms$PS$popups=PS.rooms[PS.popups[PS.popups.length-1]])!=null&&_PS$rooms$PS$popups.noURL)return;
var possibleRoomid=location.hash.slice(1);
var currentRoomid=null;
if(/^[a-z0-9-]*$/.test(possibleRoomid)){
currentRoomid=possibleRoomid;
}
if(currentRoomid!==null){
if(currentRoomid===_this.roomid)return;
_this.roomid=currentRoomid;
PS.join(currentRoomid);
}
});
};_proto.
subscribeHistory=function subscribeHistory(){var _this2=this;
var currentRoomid=location.pathname.slice(1);
if(/^[a-z0-9-]+$/.test(currentRoomid)){
if(currentRoomid!=='preactalpha'&&currentRoomid!=='preactbeta'&&currentRoomid!=='beta'){
PS.join(currentRoomid);
}
}
if(!window.history)return;
{
var _this$updatePanelStat3=this.updatePanelState(),roomid=_this$updatePanelStat3.roomid,newTitle=_this$updatePanelStat3.newTitle;
history.replaceState(this.panelState,'',"/"+roomid);
document.title=newTitle;
}
PS.subscribe(function(){
var _this2$updatePanelSta=_this2.updatePanelState(),roomid=_this2$updatePanelSta.roomid,changed=_this2$updatePanelSta.changed,newTitle=_this2$updatePanelSta.newTitle;
if(changed){
history.pushState(_this2.panelState,'',"/"+roomid);
}else if(changed!==null){
history.replaceState(_this2.panelState,'',"/"+roomid);
}

document.title=newTitle;
});
window.addEventListener('popstate',function(e){
var possibleRoomid=location.pathname.slice(1);
var roomid=null;
if(/^[a-z0-9-]*$/.test(possibleRoomid)){
roomid=possibleRoomid;
}
if(typeof e.state==='string'){
var _ref=e.state.split('..'),leftRoomid=_ref[0],rightRoomid=_ref[1];
if(rightRoomid){
PS.addRoom({id:leftRoomid,location:'left',autofocus:false});
PS.addRoom({id:rightRoomid,location:'right',autofocus:false});
PS.leftPanel=PS.rooms[leftRoomid]||PS.leftPanel;
PS.rightPanel=PS.rooms[rightRoomid]||PS.rightPanel;
}
}
if(roomid!==null){
_this2.roomid=roomid;
PS.join(roomid);
}
});
};return PSRouter;}();

PS.router=new PSRouter();var

PSRoomPanel=function(_preact$Component){function PSRoomPanel(){var _this3;for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++){args[_key]=arguments[_key];}_this3=_preact$Component.call.apply(_preact$Component,[this].concat(args))||this;_this3.
subscriptions=[];_this3.
wasVisible=true;_this3.























justUpdatedDimensions=false;return _this3;}_inheritsLoose(PSRoomPanel,_preact$Component);var _proto2=PSRoomPanel.prototype;_proto2.subscribeTo=function subscribeTo(model){var _this4=this;var callback=arguments.length>1&&arguments[1]!==undefined?arguments[1]:function(){_this4.forceUpdate();};var subscription=model.subscribe(callback);this.subscriptions.push(subscription);return subscription;};_proto2.componentDidMount=function componentDidMount(){var _this5=this;this.props.room.onRequestFocus=function(options){return _this5.focus(options);};this.subscriptions.push(this.props.room.subscribe(function(args){if(!args)_this5.forceUpdate();else _this5.receiveLine(args);}));this.props.room.__view=this;this.componentDidUpdate();};_proto2.shouldComponentUpdate=function shouldComponentUpdate(){var wasVisible=this.wasVisible;var visible=PS.isVisible(this.props.room);this.wasVisible=visible;return visible||wasVisible;};_proto2.
updateDimensions=function updateDimensions(){
var justUpdated=this.justUpdatedDimensions;
this.justUpdatedDimensions=false;

var room=this.props.room;
var newWidth=this.base.offsetWidth;
var newHeight=this.base.offsetHeight;
if(room.width===newWidth&&room.height===newHeight){
return;
}

room.width=newWidth;
room.height=newHeight;

if(justUpdated)return;
this.justUpdatedDimensions=true;
this.forceUpdate();
};_proto2.
componentDidUpdate=function componentDidUpdate(){
var room=this.props.room;
var currentlyHidden=!room.width&&room.parentElem&&['popup','modal-popup'].includes(room.location);
this.updateDimensions();
if(currentlyHidden)return;
if(room.focusNextUpdate){
var focusOptions=room.focusNextUpdate===true?undefined:room.focusNextUpdate;
room.focusNextUpdate=false;
this.focus(focusOptions);
}
};_proto2.
componentWillUnmount=function componentWillUnmount(){
this.props.room.onRequestFocus=null;for(var _i2=0,_this$subscriptions2=
this.subscriptions;_i2<_this$subscriptions2.length;_i2++){var subscription=_this$subscriptions2[_i2];
subscription.unsubscribe();
}
this.subscriptions=[];
};_proto2.
close=function close(){
PS.leave(this.props.room.id);
};_proto2.
componentDidCatch=function componentDidCatch(err){
this.props.room.caughtError=PSUtils.normalizeError(err);
this.setState({});
};_proto2.
receiveLine=function receiveLine(args){};_proto2.





chooseParentValue=function chooseParentValue(value){
var dropdownButton=this.props.room.parentElem;
dropdownButton.value=value;
if(!dropdownButton.getAttribute('data-href')){

dropdownButton.innerText=value;
}
var changeEvent=new Event('change');
dropdownButton.dispatchEvent(changeEvent);
PS.closePopup();
};_proto2.
focus=function focus(options){var _this$base;
if(!(options!=null&&options.preventScroll)&&!PS.isPopup(this.props.room))PSView.scrollToRoom();
if(PSView.hasTapped)return;

var autofocus=(_this$base=this.base)==null?void 0:_this$base.querySelector('.autofocus');
PSView.politeFocus(autofocus);
autofocus==null||autofocus.select==null||autofocus.select();
};_proto2.
render=function render(){
return preact.h(PSPanelWrapper,{room:this.props.room},
preact.h("div",{"class":"mainmessage"},preact.h("p",null,TL(["Loading..."])))
);
};return PSRoomPanel;}(preact.Component);


function PSPanelWrapper(props)


















{
var room=props.room;
var contents=room.caughtError?
preact.h("div",{"class":"broadcast broadcast-red"},preact.h("pre",null,room.caughtError)):
props.children;
if(room.location==='mini-window'){
var size=props.fullSize?' mini-window-flex':'';
var scrollable=!props.noScroll&&!props.fullSize?' scrollable':'';
return preact.h("div",{
id:"room-"+room.id,
"class":"mini-window-contents tiny-layout ps-room-light"+scrollable+size,
onClick:props.focusClick?PSView.focusIfNoSelection:undefined,onDragEnter:props.onDragEnter},

contents
);
}
if(PS.isPopup(room)){
var _style=PSView.getPopupStyle(room,props.width,props.fullSize);
return preact.h("div",{"class":"ps-popup",id:"room-"+room.id,style:_style,onDragEnter:props.onDragEnter},
contents
);
}
var style=PSView.posStyle(room);
if(props.noScroll==='hidden')style.overflow='hidden';
var tinyLayout=room.width<620?' tiny-layout':'';
return preact.h("div",{
"class":"ps-room"+(room.id===''?'':' ps-room-light')+(!props.noScroll?' scrollable':'')+tinyLayout,
id:"room-"+room.id,role:"tabpanel","aria-labelledby":"roomtab-"+room.id,
style:style,onClick:props.focusClick?PSView.focusIfNoSelection:undefined,onDragEnter:props.onDragEnter},

contents
);
}var

PSPanelErrorBoundary=function(_preact$Component2){function PSPanelErrorBoundary(){return _preact$Component2.apply(this,arguments)||this;}_inheritsLoose(PSPanelErrorBoundary,_preact$Component2);var _proto3=PSPanelErrorBoundary.prototype;_proto3.
componentDidCatch=function componentDidCatch(err){
this.props.room.caughtError=PSUtils.normalizeError(err);
this.setState({});
};_proto3.
render=function render(){
var room=this.props.room;
var RoomType=PS.roomTypes[room.type];
var Panel=RoomType&&!room.isPlaceholder&&!room.caughtError?RoomType:PSRoomPanel;
return preact.h(Panel,{room:room});
};return PSPanelErrorBoundary;}(preact.Component);var


PSView=function(_preact$Component3){





















































































































































































































































































































































































































































































































































































































function PSView(){var _window$visualViewpor,_window$visualViewpor2;var _this6;
_this6=_preact$Component3.call(this)||this;_this6.commandPreviewTextbox=null;_this6.commandPreviewPlaceholder=null;_this6.handleCommandPointerOver=function(ev){if(ev.pointerType==='touch')return;var hover=_this6.getHoveredCommand(ev.target);if(!hover)return;var textbox=_this6.getCommandPreviewTextbox(hover.elem);if(!textbox)return;_this6.setCommandPreview(textbox,hover.cmd);};_this6.handleCommandPointerOut=function(ev){if(ev.pointerType==='touch')return;var hover=_this6.getHoveredCommand(ev.target);if(!hover)return;var nextHover=_this6.getHoveredCommand(ev.relatedTarget);if((nextHover==null?void 0:nextHover.elem)===hover.elem)return;_this6.clearCommandPreview();};_this6.















































































































































































































































































































































































































































































handleClickOverlay=function(ev){var _ev$target;


if(((_ev$target=ev.target)==null?void 0:_ev$target.className)==='ps-overlay'){
if(PS.room.closable){
PS.closePopup();
}
ev.preventDefault();
ev.stopImmediatePropagation();
}
};PS.subscribe(function(){return _this6.forceUpdate();});if(PSView.isSafari){var _document$querySelect;(_document$querySelect=document.querySelector('meta[name=viewport]'))==null||_document$querySelect.setAttribute('content','width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0');}window.onbeforeunload=function(ev){for(var _i4=0,_Object$values2=Object.values(PS.rooms);_i4<_Object$values2.length;_i4++){var room=_Object$values2[_i4];var interruptClose=room.interruptClose(true);if(typeof interruptClose==='string')return interruptClose;}if(PS.prefs.refreshprompt){return"Are you sure you want to leave?";}return null;};window.addEventListener('focus',function(){for(var _i6=0,_ref3=[PS.leftPanel,PS.rightPanel];_i6<_ref3.length;_i6++){var room=_ref3[_i6];if(room&&PS.isVisiblePanel(room)){room.autoDismissNotifications();}}});window.addEventListener('submit',function(ev){var elem=ev.target;if(elem!=null&&elem.getAttribute('data-submitsend')){var inputs=Net.formData(elem);var cmd=elem.getAttribute('data-submitsend');for(var _i8=0,_Object$entries2=Object.entries(inputs);_i8<_Object$entries2.length;_i8++){var _ref4=_Object$entries2[_i8];var name=_ref4[0];var value=_ref4[1];cmd=cmd.replace("{"+name+"}",value===true?'on':value===false?'off':value);}cmd=cmd.replace(/\{([a-z0-9-]+)\}/g,function(_,match){var _elem$querySelector;return((_elem$querySelector=elem.querySelector("button[name=\""+match+"\"]"))==null?void 0:_elem$querySelector.value)||'';});var room=PS.getRoom(elem)||PS.mainmenu;room.sendDirect(cmd);ev.preventDefault();ev.stopImmediatePropagation();}});window.addEventListener('focusin',function(){return PSView.handleActiveElementChange();});window.addEventListener('focusout',function(){return PSView.handleActiveElementChange();});window.addEventListener('pointerdown',function(ev){PSView.hasTapped=ev.pointerType==='touch'||ev.pointerType==='pen';PSView.handleSnapPointerDown(ev);});window.addEventListener('pointermove',function(ev){return PSView.handleSnapPointerMove(ev);});window.addEventListener('pointerup',function(ev){return PSView.handleSnapPointerUp(ev);});window.addEventListener('pointercancel',function(ev){return PSView.handleSnapPointerUp(ev);});if(window.TouchEvent){window.addEventListener('touchstart',function(ev){return PSView.handleSnapTouchStart(ev);},{passive:true});window.addEventListener('touchmove',function(ev){return PSView.handleSnapTouchMove(ev);},{passive:false});window.addEventListener('touchend',function(ev){return PSView.handleSnapTouchEnd(ev);},{passive:true});window.addEventListener('touchcancel',function(ev){return PSView.handleSnapTouchEnd(ev);},{passive:true});}window.addEventListener('scroll',function(){return PSView.notifyScrollListeners();});(_window$visualViewpor=window.visualViewport)==null||_window$visualViewpor.addEventListener('resize',function(){return PSView.handleVisualViewportChange();});(_window$visualViewpor2=window.visualViewport)==null||_window$visualViewpor2.addEventListener('scroll',function(){return PSView.handleVisualViewportChange();});window.addEventListener('pointerover',_this6.handleCommandPointerOver);window.addEventListener('pointerout',_this6.handleCommandPointerOut);window.addEventListener('click',function(ev){var elem=ev.target;if(BattleTooltips.isLocked){var tooltipWrapper=document.getElementById('tooltipwrapper');if(!(tooltipWrapper!=null&&tooltipWrapper.contains(elem)))BattleTooltips.hideTooltip();}var clickedRoom=PS.getRoom(elem);while(elem){if(elem.className==='spoiler'){elem.className='spoiler-shown';}else if(elem.className==='spoiler-shown'){elem.className='spoiler';}if(elem.classList.contains('username')){var name=elem.getAttribute('data-name')||elem.innerText;var userid=toID(name);var roomid=(elem.classList.contains('no-interact')?'viewuser':'user')+"-"+userid;PS.join(roomid,{parentElem:elem,rightPopup:elem.className==='userbutton username',args:{username:name}});ev.preventDefault();ev.stopImmediatePropagation();return;}if(elem.tagName==='A'||elem.getAttribute('data-href')){if(ev.ctrlKey||ev.metaKey||ev.shiftKey)break;var href=elem.getAttribute('data-href')||elem.getAttribute('href');var _roomid=PS.router.extractRoomID(href);var shortLinks=/^(rooms?suggestions?|suggestions?|adminrequests?|forgotpassword|bugs?(reports?)?|formatsuggestions|rules?|faq|credits?|privacy|contact|dex|(damage)?calc|insecure|replays?|devdiscord|smogdex|smogcord|forums?|trustworthy-dlc-link)$/;if(_roomid==='appeal'||_roomid==='appeals')_roomid='view-help-request--appeal';if(_roomid==='report')_roomid='view-help-request--report';if(_roomid==='requesthelp')_roomid='view-help-request--other';if(_roomid!==null&&elem.className!=='no-panel-intercept'&&!shortLinks.test(_roomid)){var _location=null;if(elem.getAttribute('data-target')==='replace'){var room=PS.getRoom(elem);if(room){PS.leave(room.id);_location=room.location;}}PS.join(_roomid,{parentElem:elem,location:_location});if(!PS.isPopup(PS.rooms[_roomid])){PS.closeAllPopups();}ev.preventDefault();ev.stopImmediatePropagation();}return;}if(elem.getAttribute('data-cmd')){var cmd=elem.getAttribute('data-cmd');var _room=PS.getRoom(elem)||PS.mainmenu;_room.send(cmd,elem);ev.preventDefault();ev.stopImmediatePropagation();return;}if(elem.getAttribute('data-sendraw')){var _cmd=elem.getAttribute('data-sendraw');var _room2=PS.getRoom(elem)||PS.mainmenu;_room2.sendDirect(_cmd);ev.preventDefault();ev.stopImmediatePropagation();return;}if(elem.tagName==='BUTTON'){if(_this6.handleButtonClick(elem)){ev.preventDefault();ev.stopImmediatePropagation();return;}else if(!elem.getAttribute('type')){}}if(elem.id.startsWith('room-')){break;}elem=elem.parentElement;}if(PS.room!==clickedRoom){if(clickedRoom)PS.room=clickedRoom;PS.room.autoDismissNotifications();PS.closePopupsAbove(clickedRoom);PS.update();}if(clickedRoom&&!PS.isPopup(clickedRoom)){PSView.scrollToRoom();}});window.addEventListener('keydown',function(ev){var elem=ev.target;var isTextInput=false;var isNonEmptyTextInput=false;if(elem){isTextInput=elem.tagName==='INPUT'||elem.tagName==='TEXTAREA';if(isTextInput&&['button','radio','checkbox','file'].includes(elem.type)){isTextInput=false;}if(isTextInput&&elem.value){isNonEmptyTextInput=true;}if(elem.contentEditable==='true'){isTextInput=true;if(elem.textContent&&elem.textContent!=='\n'){isNonEmptyTextInput=true;}}}if(!isNonEmptyTextInput){if((PS.room.onParentKeyDown==null?void 0:PS.room.onParentKeyDown(ev))===false){ev.stopImmediatePropagation();ev.preventDefault();return;}}var modifierKey=ev.ctrlKey||ev.altKey||ev.metaKey||ev.shiftKey;var altKey=!ev.ctrlKey&&ev.altKey&&!ev.metaKey&&!ev.shiftKey;var altShiftKey=!ev.ctrlKey&&ev.altKey&&!ev.metaKey&&ev.shiftKey;var shiftKey=!ev.ctrlKey&&!ev.altKey&&!ev.metaKey&&ev.shiftKey;var kc=ev.keyCode;if(altKey&&kc===38){PS.arrowKeysUsed=true;PS.focusUpRoom();}else if(altKey&&kc===40){PS.arrowKeysUsed=true;PS.focusDownRoom();}else if(!modifierKey&&kc===27){if(BattleTooltips.elem){ev.stopImmediatePropagation();ev.preventDefault();BattleTooltips.hideTooltip();return;}if(PS.popups.length){ev.stopImmediatePropagation();ev.preventDefault();if(PS.room.closable){PS.closePopup();PS.focusRoom(PS.room.id);}}else if(PS.room.id==='rooms'){PS.hideRightRoom();}}if(isNonEmptyTextInput)return;if(altShiftKey&&(kc===37||kc===38)){PS.arrowKeysUsed=true;PS.focusUnreadRoom('left');}else if(altShiftKey&&(kc===39||kc===40)){PS.arrowKeysUsed=true;PS.focusUnreadRoom('right');}else if(altKey&&kc===37){PS.arrowKeysUsed=true;PS.focusLeftRoom();}else if(altKey&&kc===39){PS.arrowKeysUsed=true;PS.focusRightRoom();}else if(shiftKey&&kc===37){if(PS.leftPanelWidth===null)return;var curLoc=PS.room.location;var newLoc=curLoc;var newIndex=null;switch(curLoc){case'right':{newIndex=PS.rightRoomList.indexOf(PS.room.id)-1;if(newIndex<0){newLoc='left';newIndex=PS.leftRoomList.length+1;}break;}case'left':{newIndex=PS.leftRoomList.indexOf(PS.room.id)-1;if(newIndex<=0){newLoc='mini-window';newIndex=PS.miniRoomList.length+1;}break;}case'mini-window':{newIndex=PS.miniRoomList.indexOf(PS.room.id)-1;if(newIndex<0){newLoc='right';newIndex=PS.rightRoomList.length+1;}break;}}if(newIndex!==null){PS.moveRoom(PS.room,newLoc,false,newIndex);PS.update();}}else if(shiftKey&&kc===39){if(PS.leftPanelWidth===null)return;var _curLoc=PS.room.location;var _newLoc=_curLoc;var _newIndex=null;switch(_curLoc){case'right':{_newIndex=PS.rightRoomList.indexOf(PS.room.id)+1;if(_newIndex>=PS.rightRoomList.length-1){_newLoc='mini-window';_newIndex=1;}break;}case'left':{_newIndex=PS.leftRoomList.indexOf(PS.room.id)+1;if(_newIndex>=PS.leftRoomList.length){_newLoc='right';_newIndex=0;}break;}case'mini-window':{_newIndex=PS.miniRoomList.indexOf(PS.room.id)+1;if(_newIndex>=PS.miniRoomList.length){_newLoc='left';_newIndex=1;}break;}}if(_newIndex!==null){PS.moveRoom(PS.room,_newLoc,false,_newIndex);PS.update();}}else if(shiftKey&&kc===38){if(PS.prefs.onepanel!=='vertical')return;var _newIndex2=PS.rightRoomList.indexOf(PS.room.id)-1;if(_newIndex2<0)_newIndex2=PS.rightRoomList.length-1;PS.moveRoom(PS.room,'right',false,_newIndex2);PS.update();}else if(shiftKey&&kc===40){if(PS.prefs.onepanel!=='vertical')return;var _newIndex3=PS.rightRoomList.indexOf(PS.room.id)+1;if(_newIndex3>=PS.rightRoomList.length-1)_newIndex3=0;PS.moveRoom(PS.room,'right',false,_newIndex3);PS.update();}if(modifierKey)return;if(kc===37&&(elem==null?void 0:elem.type)!=='radio'){PS.arrowKeysUsed=true;PS.focusLeftRoom();}else if(kc===39&&(elem==null?void 0:elem.type)!=='radio'){PS.arrowKeysUsed=true;PS.focusRightRoom();}else if(kc===191&&!isTextInput&&PS.room===PS.mainmenu){ev.stopImmediatePropagation();ev.preventDefault();PS.join('dm---');}});window.addEventListener('dragend',function(ev){PS.dragging=null;ev.preventDefault();});window.addEventListener('drop',function(ev){var _ev$dataTransfer,_PS$dragging;console.log("drop: "+((_ev$dataTransfer=ev.dataTransfer)==null?void 0:_ev$dataTransfer.dropEffect));var target=ev.target;if(((_PS$dragging=PS.dragging)==null?void 0:_PS$dragging.type)==='room'){var _type;if((_type=target.type)!=null&&_type.startsWith("text")){PS.dragging=null;return;}PS.updateAutojoin();ev.preventDefault();PS.dragging=null;return;}if(!PS.dragging||PS.dragging.type==='?'){var _ev$dataTransfer2;if(!((_ev$dataTransfer2=ev.dataTransfer)!=null&&_ev$dataTransfer2.files.length))return;}ev.preventDefault();for(var _i10=0,_Object$values4=Object.values(PS.roomTypes);_i10<_Object$values4.length;_i10++){var Panel=_Object$values4[_i10];if(Panel.handleDrop!=null&&Panel.handleDrop(ev)){PS.dragging=null;return;}}PS.alert(TL(["Sorry, we don't know what to do with that file.\n\nSupported file types:\n- images (to set your background)\n- downloaded replay files\n- team files"]));PS.dragging=null;});var colorSchemeQuery=window.matchMedia==null?void 0:window.matchMedia('(prefers-color-scheme: dark)');if((colorSchemeQuery==null?void 0:colorSchemeQuery.media)!=='not all'){colorSchemeQuery.addEventListener('change',function(cs){if(PS.prefs.theme==='system')document.body.className=cs.matches?'dark':'';});}PS.prefs.subscribeAndRun(function(key){if(!key||key==='theme'){var dark=PS.prefs.theme==='dark'||PS.prefs.theme==='system'&&(colorSchemeQuery==null?void 0:colorSchemeQuery.matches);document.body.className=dark?'dark':'';}});return _this6;}_inheritsLoose(PSView,_preact$Component3);PSView.setDebug=function setDebug(mode){var _this7=this;this.debugMenu=mode;PS.update();if(mode===null){var elem=document.getElementById('ps-debug-menu');if(elem)elem.style.display='none';return;}setTimeout(function(){return _this7.updateSnapDebug("command "+(_this7.debugMenu||'off'));},1);};var _proto4=PSView.prototype;_proto4.componentDidMount=function componentDidMount(){var _PSView$scrollFrame;PSView.scrollFrame=this.base.children[0];(_PSView$scrollFrame=PSView.scrollFrame)==null||_PSView$scrollFrame.addEventListener('scroll',PSView.handleFrameScroll);if(PSView.isFirefox){document.documentElement.style.height='100%';}PSView.updateScrollSnap();};_proto4.componentWillUnmount=function componentWillUnmount(){var _PSView$scrollFrame2;(_PSView$scrollFrame2=PSView.scrollFrame)==null||_PSView$scrollFrame2.removeEventListener('scroll',PSView.handleFrameScroll);PSView.scrollFrame=null;};PSView.addScrollListener=function addScrollListener(listener){if(!this.scrollListeners.includes(listener))this.scrollListeners.push(listener);};PSView.removeScrollListener=function removeScrollListener(listener){var index=this.scrollListeners.indexOf(listener);if(index>=0)this.scrollListeners.splice(index,1);};PSView.notifyScrollListeners=function notifyScrollListeners(){for(var _i12=0,_this$scrollListeners2=this.scrollListeners;_i12<_this$scrollListeners2.length;_i12++){var listener=_this$scrollListeners2[_i12];listener();}};PSView.useCSSScrollSnap=function useCSSScrollSnap(){return this.narrowMode&&this.cssScrollSnap;};PSView.useScrollFrame=function useScrollFrame(){return this.narrowMode&&!this.cssScrollSnap;};PSView.getScrollX=function getScrollX(){var _this$scrollFrame;return this.useScrollFrame()?((_this$scrollFrame=this.scrollFrame)==null?void 0:_this$scrollFrame.scrollLeft)||0:window.scrollX;};PSView.setScrollX=function setScrollX(x){if(this.useScrollFrame()){if(!this.scrollFrame)return;this.scrollFrame.scrollLeft=x;this.notifyScrollListeners();}else{window.scrollTo(x,0);}};PSView.updateScrollSnap=function updateScrollSnap(){document.documentElement.classList.toggle('scroll-frame-enabled',this.useScrollFrame());if(this.scrollFrame){if(this.useScrollFrame()){this.scrollFrame.scrollLeft=Math.max(this.scrollFrame.scrollLeft,window.scrollX);}else if(this.scrollFrame.scrollLeft){this.scrollFrame.scrollLeft=0;}}if(this.useCSSScrollSnap()&&!this.isTextboxFocused()&&!this.isViewportZoomed()){document.documentElement.classList.add('scroll-snap-enabled');}else{document.documentElement.classList.remove('scroll-snap-enabled');}if(!this.shouldJSSnap())this.clearSnap();this.updateSnapDebug('mode');};PSView.shouldJSSnap=function shouldJSSnap(){return this.useScrollFrame()&&!!this.scrollFrame&&!this.isViewportZoomed();};PSView.prefersReducedMotion=function prefersReducedMotion(){return window.matchMedia==null?void 0:window.matchMedia('(prefers-reduced-motion: reduce)').matches;};PSView.isViewportZoomed=function isViewportZoomed(){var _window$visualViewpor3;return(((_window$visualViewpor3=window.visualViewport)==null?void 0:_window$visualViewpor3.scale)||1)>1.05;};PSView.handleVisualViewportChange=function handleVisualViewportChange(){if(this.narrowMode)this.updateScrollSnap();};PSView.isTextboxElement=function isTextboxElement(elem){if(!(elem instanceof HTMLElement))return false;if(elem.isContentEditable)return true;if(elem instanceof HTMLTextAreaElement)return true;if(!(elem instanceof HTMLInputElement))return false;var nonTextTypes=['button','checkbox','color','file','hidden','image','radio','range','reset','submit'];return!nonTextTypes.includes(elem.type);};PSView.isTextboxFocused=function isTextboxFocused(){return this.isTextboxElement(document.activeElement);};PSView.isRoomTextboxFocused=function isRoomTextboxFocused(){if(!this.isTextboxElement(document.activeElement))return false;var room=PS.getRoom(document.activeElement);return!!room&&!PS.isPopup(room);};PSView.politeFocus=function politeFocus(elem){var polite=arguments.length>1&&arguments[1]!==undefined?arguments[1]:true;try{elem==null||elem.focus({preventScroll:polite});}catch(_unused){elem==null||elem.focus();}};PSView.jumpToRoom=function jumpToRoom(){if(this.getScrollX()<NARROW_MODE_HEADER_WIDTH)this.setScrollX(NARROW_MODE_HEADER_WIDTH);};PSView.handleActiveElementChange=function handleActiveElementChange(){var _this8=this;setTimeout(function(){_this8.updateScrollSnap();if(_this8.narrowMode&&_this8.isRoomTextboxFocused()&&!_this8.isViewportZoomed()){_this8.jumpToRoom();requestAnimationFrame(function(){if(_this8.narrowMode&&_this8.isRoomTextboxFocused()&&!_this8.isViewportZoomed()){_this8.jumpToRoom();}requestAnimationFrame(function(){if(_this8.narrowMode&&_this8.isRoomTextboxFocused()&&!_this8.isViewportZoomed()){_this8.jumpToRoom();}});});return;}if(_this8.shouldJSSnap())_this8.scheduleScrollSnap();},1);};PSView.canScrollHorizontally=function canScrollHorizontally(elem,dx){if(elem.scrollWidth<=elem.clientWidth+1)return false;var style=getComputedStyle(elem);if(!/^(auto|scroll|overlay)$/i.test(style.overflowX))return false;if(dx>0)return elem.scrollLeft>0;return elem.scrollLeft<elem.scrollWidth-elem.clientWidth-1;};PSView.hasHorizontalScroller=function hasHorizontalScroller(target,dx){var elem=target instanceof Element?target:null;while(elem&&elem!==document.documentElement){if(elem instanceof HTMLElement&&this.canScrollHorizontally(elem,dx))return true;elem=elem.parentElement;}return false;};PSView.canSnapHorizontally=function canSnapHorizontally(scrollX,dx){if(dx<0)return scrollX<NARROW_MODE_HEADER_WIDTH-1;if(dx>0)return scrollX>1;return true;};PSView.hasTextSelection=function hasTextSelection(){var _window$getSelection;return((_window$getSelection=window.getSelection())==null?void 0:_window$getSelection.type)==='Range';};PSView.clearSnap=function clearSnap(){if(this.snapTimeout){clearTimeout(this.snapTimeout);this.snapTimeout=null;}if(this.snapFrame!==null){cancelAnimationFrame(this.snapFrame);this.snapFrame=null;}this.snapStart=null;this.snapTarget=null;this.snapAnimating=false;};PSView.scheduleScrollSnap=function scheduleScrollSnap(){var _this9=this;var delay=arguments.length>0&&arguments[0]!==undefined?arguments[0]:120;if(!this.shouldJSSnap())return;if(this.snapTimeout)clearTimeout(this.snapTimeout);this.snapTimeout=setTimeout(function(){return _this9.settleSnap();},delay);this.updateSnapDebug('schedule scroll snap');};PSView.choosePassiveSnapTarget=function choosePassiveSnapTarget(){var x=this.getScrollX();var roomX=NARROW_MODE_HEADER_WIDTH;if(this.snapRestingX<=0)return x>=30?roomX:0;return x<=roomX-30?0:roomX;};PSView.chooseSnapTarget=function chooseSnapTarget(){var x=arguments.length>0&&arguments[0]!==undefined?arguments[0]:this.getScrollX();var velocity=arguments.length>1&&arguments[1]!==undefined?arguments[1]:this.snapVelocityX;var roomX=NARROW_MODE_HEADER_WIDTH;var naturalEndpoint=Math.max(0,Math.min(roomX,x+velocity*260));return naturalEndpoint<roomX/2?0:roomX;};PSView.updateSnapDebug=function updateSnapDebug(){var _this$snapStart;var event=arguments.length>0&&arguments[0]!==undefined?arguments[0]:'';if(this.debugMenu!=='snap'||this.cssScrollSnap||!this.narrowMode){return;}var elem=document.getElementById('ps-debug-menu');if(!elem)return;var x=this.getScrollX();var roomX=NARROW_MODE_HEADER_WIDTH;var velocity=this.snapVelocityX;var velocityThreshold=(roomX/2-x)/260;var naturalEndpoint=Math.max(0,Math.min(roomX,x+velocity*260));var target=this.chooseSnapTarget(x,velocity);var passiveTarget=this.choosePassiveSnapTarget();var dragging=(_this$snapStart=this.snapStart)!=null&&_this$snapStart.dragging?'yes':this.snapStart?'pending':'no';var side=function(pos){return pos<=0?'menu':'room';};elem.style.display='block';elem.textContent=["snap "+event,"x "+x.toFixed(1)+" / "+roomX,"v "+velocity.toFixed(3)+" px/ms ("+(velocity*1000).toFixed(0)+" px/s)","target flips at v >= "+velocityThreshold.toFixed(3)+" px/ms","projected "+naturalEndpoint.toFixed(1)+" -> "+side(target),"passive -> "+side(passiveTarget)+"; resting "+side(this.snapRestingX),"drag "+dragging+"; anim "+(this.snapAnimating?'yes':'no'),"zoom "+(this.isViewportZoomed()?'yes':'no')].join('\n');};PSView.settleSnap=function settleSnap(){var target=arguments.length>0&&arguments[0]!==undefined?arguments[0]:this.snapTarget;if(!this.shouldJSSnap())return;if(this.snapTimeout){clearTimeout(this.snapTimeout);this.snapTimeout=null;}target=target!=null?target:this.chooseSnapTarget();this.updateSnapDebug("settle "+(target<=0?'menu':'room'));this.snapTarget=null;var scrollX=this.getScrollX();if(target===NARROW_MODE_HEADER_WIDTH&&scrollX>=target){this.snapRestingX=target;this.updateSnapDebug('settled');return;}if(Math.abs(scrollX-target)<2){if(scrollX!==target)this.setScrollX(target);this.snapRestingX=target;this.updateSnapDebug('settled');return;}this.animateSnap(target);};PSView.animateSnap=function animateSnap(target,duration){var _this10=this;if(this.snapFrame!==null)cancelAnimationFrame(this.snapFrame);var startX=this.getScrollX();var distance=target-startX;if(target===NARROW_MODE_HEADER_WIDTH&&startX>=target){this.snapAnimating=false;this.snapRestingX=target;this.updateSnapDebug('already past room');return;}if(this.prefersReducedMotion()||duration===0){this.setScrollX(target);this.snapAnimating=false;this.snapRestingX=target;this.updateSnapDebug('reduced motion');return;}var velocity=Math.abs(this.snapVelocityX);duration!=null?duration:duration=Math.max(120,Math.min(260,180+Math.abs(distance)*0.35-velocity*45));var startTime=performance.now();this.snapAnimating=true;this.updateSnapDebug('animate start');var animate=function(now){if(!_this10.shouldJSSnap()){_this10.clearSnap();return;}var progress=Math.max(0,Math.min(1,(now-startTime)/duration));var eased=1-Math.pow(1-progress,3);_this10.setScrollX(startX+distance*eased);if(progress<1){_this10.snapFrame=requestAnimationFrame(animate);}else{_this10.snapFrame=null;_this10.snapAnimating=false;if(_this10.getScrollX()!==target)_this10.setScrollX(target);_this10.snapRestingX=target;_this10.updateSnapDebug('animate end');}};this.snapFrame=requestAnimationFrame(animate);};PSView.startSnapGesture=function startSnapGesture(x,y,target){if(!this.shouldJSSnap()||this.hasTextSelection())return;if((target==null?void 0:target.type)==='range')return;this.clearSnap();var now=performance.now();this.snapStart={x:x,y:y,scrollX:this.getScrollX(),startTime:now,lastX:x,lastY:y,lastTime:now,dragging:false,target:target};this.snapTarget=null;this.snapLastScrollX=this.getScrollX();this.snapLastScrollTime=now;this.snapVelocityX=0;this.updateSnapDebug('start');};PSView.moveSnapGesture=function moveSnapGesture(x,y){if(!this.snapStart)return false;if(!this.shouldJSSnap()){this.clearSnap();return false;}if(this.hasTextSelection()){this.snapStart=null;this.updateSnapDebug('text selection');return false;}var start=this.snapStart;var now=performance.now();var dx=x-start.x;var dy=y-start.y;if(!start.dragging){if(Math.abs(dx)>8&&!this.canSnapHorizontally(start.scrollX,dx)){this.snapStart=null;this.updateSnapDebug('wrong direction');return false;}if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)*1.15){this.snapStart=null;return false;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return false;if(this.hasHorizontalScroller(start.target,dx)){this.snapStart=null;this.updateSnapDebug('nested scroller');return false;}start.dragging=true;this.snapLastScrollTime=0;}var dt=Math.max(now-start.lastTime,1);this.snapVelocityX=-(x-start.lastX)/dt;start.lastX=x;start.lastY=y;start.lastTime=now;var roomX=NARROW_MODE_HEADER_WIDTH;var targetX=Math.max(0,Math.min(roomX,start.scrollX-dx*1.45));this.setScrollX(targetX);this.updateSnapDebug('drag');return true;};PSView.finishSnapGesture=function finishSnapGesture(x,y){if(!this.snapStart)return;if(!this.shouldJSSnap()){this.clearSnap();return;}if(this.hasTextSelection()){this.snapStart=null;this.updateSnapDebug('text selection');return;}var now=performance.now();var dx=x-this.snapStart.x;var dy=y-this.snapStart.y;var dragging=this.snapStart.dragging;var target=this.snapStart.target;var scrollX=this.snapStart.scrollX;var velocity=this.snapVelocityX;var fullGestureVelocity=-dx/Math.max(now-this.snapStart.startTime,1);if(!Number.isFinite(velocity)||Math.abs(fullGestureVelocity)>Math.abs(velocity))velocity=fullGestureVelocity;var isHorizontal=Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.05;var flicking=isHorizontal&&Math.abs(velocity)>0.35;this.snapStart=null;if(!dragging&&Math.abs(dx)>8&&!this.canSnapHorizontally(scrollX,dx)){this.updateSnapDebug('wrong direction');return;}if(flicking&&this.hasHorizontalScroller(target,dx))return;if(dragging||flicking||Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.25){this.snapVelocityX=velocity;this.snapTarget=this.chooseSnapTarget(this.getScrollX(),velocity);this.updateSnapDebug(flicking?'flick':'release');this.settleSnap(this.snapTarget);}};PSView.handleSnapPointerDown=function handleSnapPointerDown(ev){if(ev.pointerType==='touch'&&window.TouchEvent)return;if(ev.pointerType!=='touch'&&ev.pointerType!=='pen')return;this.startSnapGesture(ev.clientX,ev.clientY,ev.target);};PSView.handleSnapPointerMove=function handleSnapPointerMove(ev){if(ev.pointerType==='touch'&&window.TouchEvent)return;if(ev.pointerType!=='touch'&&ev.pointerType!=='pen')return;if(this.moveSnapGesture(ev.clientX,ev.clientY))ev.preventDefault();};PSView.handleSnapPointerUp=function handleSnapPointerUp(ev){if(ev.pointerType==='touch'&&window.TouchEvent)return;if(ev.pointerType!=='touch'&&ev.pointerType!=='pen')return;this.finishSnapGesture(ev.clientX,ev.clientY);};PSView.handleSnapTouchStart=function handleSnapTouchStart(ev){var touch=ev.touches[0];if(touch)this.startSnapGesture(touch.clientX,touch.clientY,ev.target);};PSView.handleSnapTouchMove=function handleSnapTouchMove(ev){var touch=ev.touches[0];if(touch&&this.moveSnapGesture(touch.clientX,touch.clientY))ev.preventDefault();};PSView.handleSnapTouchEnd=function handleSnapTouchEnd(ev){var touch=ev.changedTouches[0];if(touch)this.finishSnapGesture(touch.clientX,touch.clientY);};PSView.handleSnapScroll=function handleSnapScroll(){if(!this.shouldJSSnap())return;var now=performance.now();var x=this.getScrollX();if(this.snapLastScrollTime){var dt=now-this.snapLastScrollTime;if(dt>0){var velocity=(x-this.snapLastScrollX)/dt;this.snapVelocityX=this.snapVelocityX*0.7+velocity*0.3;}}this.snapLastScrollX=x;this.snapLastScrollTime=now;if(this.snapStart)return;if(this.snapAnimating)return;this.snapTarget=this.choosePassiveSnapTarget();this.updateSnapDebug('passive scroll');this.scheduleScrollSnap();};PSView.focusPreview=function focusPreview(room){if(room!==PS.room)return'';var verticalBuf=this.verticalFocusPreview();if(verticalBuf)return verticalBuf;var isMiniRoom=PS.room.location==='mini-window';var _PS$horizontalNav=PS.horizontalNav(),rooms=_PS$horizontalNav.rooms,index=_PS$horizontalNav.index;if(index===-1)return'';var buf=' ';var leftRoom=PS.rooms[rooms[index-1]];if(leftRoom)buf+="\u2190 "+leftRoom.title;buf+=PS.arrowKeysUsed||isMiniRoom?" | ":" (use arrow keys) ";var rightRoom=PS.rooms[rooms[index+1]];if(rightRoom)buf+=rightRoom.title+" \u2192";return buf;};PSView.verticalFocusPreview=function verticalFocusPreview(){var _PS$verticalNav=PS.verticalNav(),rooms=_PS$verticalNav.rooms,index=_PS$verticalNav.index;if(index===-1)return'';var upRoom=PS.rooms[rooms[index-1]];var downRoom=PS.rooms[rooms[index+1]];if(index===rooms.length-2&&rooms[index+1]==='news')downRoom=undefined;if(!upRoom&&!downRoom)return'';var buf=' ';var altLabel=PSView.isMac?'ᴏᴘᴛ':'ᴀʟᴛ';if(upRoom)buf+=altLabel+"\u2191 "+upRoom.title;buf+=" | ";if(downRoom)buf+=altLabel+"\u2193 "+downRoom.title;return buf;};_proto4.getHoveredCommand=function getHoveredCommand(target){var _ref5;if(!(target instanceof Element))return null;var elem=target.closest('[data-cmd], [data-sendraw], [data-cmdpreview], [data-href], button[name=send], button[name=parseCommand], button[name=joinRoom], button[name=closeRoom], a, .username');if(!elem)return null;var cmd=elem.getAttribute('data-cmdpreview')||elem.getAttribute('data-cmd')||elem.getAttribute('data-sendraw');if(cmd)return{elem:elem,cmd:cmd};if(elem.name==='parseCommand'||elem.name==='send'){return{elem:elem,cmd:elem.value};}if(elem.name==='closeRoom'){return{elem:elem,cmd:'/close '+elem.value};}var href=(_ref5=elem.getAttribute('data-href')||elem.getAttribute('href'))==null?void 0:_ref5.replace(/^\//,'');if(href&&/^[a-z0-9-]+$/.test(href)){if(EXTERNAL_REDIRECTS.test(href))return null;if(href==='login')return{elem:elem,cmd:'/nick'};if(href==='formatdropdown'||href==='teamdropdown')return null;if(href.startsWith('challenge-'))return{elem:elem,cmd:"/challenge "+href.slice(10)};return{elem:elem,cmd:'/j '+href};}if(elem.classList.contains('username')){return{elem:elem,cmd:'/user '+toID(elem.getAttribute('data-user')||elem.innerText)};}return null;};_proto4.getCommandPreviewTextbox=function getCommandPreviewTextbox(elem){var rooms=[PS.getRoom(elem),PS.room,PS.panel,PS.leftPanel,PS.rightPanel];for(var _i14=0;_i14<rooms.length;_i14++){var room=rooms[_i14];if(!room||!(room.type==='chat'||room.type==='battle'||room.type==='rooms')){continue;}var roomElem=document.getElementById("room-"+room.id);if(!roomElem)continue;var textbox=room.type==='rooms'?roomElem.querySelector('input[name=roomsearch].textbox'):roomElem.querySelector('.chat-log-add .textbox');if(!textbox)continue;if(!textbox.getClientRects().length)continue;return textbox;}return null;};_proto4.setCommandPreview=function setCommandPreview(textbox,cmd){if(this.commandPreviewTextbox!==textbox){this.clearCommandPreview();this.commandPreviewTextbox=textbox;this.commandPreviewPlaceholder=textbox.getAttribute('placeholder');}if(textbox.getAttribute('placeholder')!==cmd)textbox.setAttribute('placeholder',cmd);};_proto4.clearCommandPreview=function clearCommandPreview(){if(!this.commandPreviewTextbox)return;if(this.commandPreviewPlaceholder===null){this.commandPreviewTextbox.removeAttribute('placeholder');}else{this.commandPreviewTextbox.setAttribute('placeholder',this.commandPreviewPlaceholder);}this.commandPreviewTextbox=null;this.commandPreviewPlaceholder=null;};PSView.scrollToHeader=function scrollToHeader(){if(PSView.isViewportZoomed())return;if(PSView.narrowMode&&PSView.getScrollX()>0){if(!PSView.cssScrollSnap){PSView.clearSnap();PSView.animateSnap(0);}else if(PSView.isSafari||PSView.isFirefox){document.documentElement.classList.remove('scroll-snap-enabled');PSView.setScrollX(0);setTimeout(function(){PSView.updateScrollSnap();},1);}else{PSView.setScrollX(0);}}};PSView.scrollToRoom=function scrollToRoom(){if(PSView.isViewportZoomed())return;if(PSView.narrowMode&&PSView.getScrollX()<NARROW_MODE_HEADER_WIDTH){if(!PSView.cssScrollSnap){PSView.clearSnap();PSView.animateSnap(NARROW_MODE_HEADER_WIDTH,PS.prefs.noanim?0:160);}else if(PSView.isSafari||PSView.isFirefox){document.documentElement.classList.remove('scroll-snap-enabled');PSView.jumpToRoom();setTimeout(function(){PSView.updateScrollSnap();},1);}else{PSView.jumpToRoom();}}};_proto4.
handleButtonClick=function handleButtonClick(elem){
if(elem.classList.contains('formatselect')){

PS.join('formatdropdown',{
parentElem:elem
});
return true;
}
switch(elem.name){
case'closeRoom':{var _PS$getRoom,_PS$rooms$roomid;
var roomid=elem.value||((_PS$getRoom=PS.getRoom(elem))==null?void 0:_PS$getRoom.id)||'';
(_PS$rooms$roomid=PS.rooms[roomid])==null||_PS$rooms$roomid.send('/close',elem);
return true;
}
case'joinRoom':
PS.join(elem.value,{
parentElem:elem
});
return true;
case'format':
PS.join('formatdropdown',{
parentElem:elem
});
return true;
case'register':
PS.join('register',{
parentElem:elem
});
return true;
case'openOptions':
PS.join('options',{
parentElem:elem
});
return true;
case'showOtherFormats':{

var table=elem.closest('table');
var _room3=PS.getRoom(elem);
if(table){var _log;for(var _i16=0,_table$querySelectorA2=
table.querySelectorAll('tr.hidden');_i16<_table$querySelectorA2.length;_i16++){var row=_table$querySelectorA2[_i16];
row.style.display='table-row';
}for(var _i18=0,_table$querySelectorA4=
table.querySelectorAll('tr.no-matches');_i18<_table$querySelectorA4.length;_i18++){var _row=_table$querySelectorA4[_i18];
_row.style.display='none';
}
elem.closest('tr').style.display='none';
(_log=_room3.log)==null||_log.updateScroll();
}
return true;
}
case'copyText':
var dummyInput=document.createElement("input");



dummyInput.id="dummyInput";
dummyInput.value=elem.value||elem.href||"";
dummyInput.style.position='absolute';
elem.appendChild(dummyInput);
dummyInput.select();
document.execCommand("copy");
elem.removeChild(dummyInput);
elem.innerText='Copied!';
return true;
case'send':
case'cmd':
var room=PS.getRoom(elem)||PS.mainmenu;
if(elem.name==='send'){

if(room.pmTarget){
PS.send(elem.value);
}else{
room.sendDirect(elem.value);
}
}else{
room.send(elem.value);
}
return true;
}
return false;
};_proto4.
componentDidCatch=function componentDidCatch(err){
PS.mainmenu.caughtError=PSUtils.normalizeError(err);
this.setState({});
};PSView.
containingRoomid=function containingRoomid(elem){
var curElem=elem;
while(curElem){
if(curElem.id.startsWith('room-')){
return curElem.id.slice(5);
}
curElem=curElem.parentElement;
}
return null;
};PSView.
isEmptyClick=function isEmptyClick(e){
try{
var selection=window.getSelection();
if(selection.type==='Range')return false;
}catch(_unused2){}
BattleTooltips.hideTooltip();
};PSView.
posStyle=function posStyle(room){
if(PS.leftPanelWidth===null){

if(room===PS.panel){

return{top:'30px',left:PSView.verticalHeaderWidth+"px",minWidth:"none"};
}
}else if(PS.leftPanelWidth===0){

if(room===PS.panel)return{};
}else{

if(room===PS.leftPanel)return{width:PS.leftPanelWidth+"px",right:'auto'};
if(room===PS.rightPanel)return{top:"56px",left:PS.leftPanelWidth+1+"px"};
}

return{display:'none'};
};PSView.
getPopupStyle=function getPopupStyle(room,maxWidth,fullSize){var _room$parentElem,_document$getElementB;
if(fullSize){
return{width:'90%',maxHeight:'90%',maxWidth:'none',position:'relative',margin:'5vh auto 0'};
}

var source=(_room$parentElem=room.parentElem)==null?void 0:_room$parentElem.getBoundingClientRect();
if(source&&!source.width&&!source.height&&!source.top&&!source.left){

room.parentElem=null;
PS.update();
}

if(!room.parentElem||!source){
return{maxWidth:maxWidth||480};
}
if(!room.width||!room.height){
room.focusNextUpdate=true;


return Object.assign({
position:'absolute',
visibility:'hidden',
margin:0,
top:0,
left:0},
maxWidth?{maxWidth:typeof maxWidth==='number'?maxWidth-2:maxWidth}:{});

}

var style={
position:'absolute',
margin:0
};




var isFixed=room.location!=='popup';
var offsetLeft=isFixed||this.useScrollFrame()?0:window.scrollX;
var offsetTop=isFixed?0:window.scrollY;


var overlay=isFixed?(_document$getElementB=document.getElementById("room-"+room.id))==null?void 0:_document$getElementB.parentElement:null;
var availableWidth=((overlay==null?void 0:overlay.clientWidth)||document.documentElement.clientWidth)+offsetLeft;
var availableHeight=(overlay==null?void 0:overlay.clientHeight)||document.documentElement.clientHeight;

var sourceWidth=source.width;
var sourceHeight=source.height;
var sourceTop=source.top+offsetTop;
var sourceLeft=source.left+offsetLeft;

var height=room.height;
var width=room.width;

if(room.rightPopup){

if(availableHeight>sourceTop+height+5&&(
sourceTop<availableHeight*2/3||sourceTop+200<availableHeight)){
style.top=sourceTop;
}else if(sourceTop+sourceHeight>=height){
style.bottom=Math.max(availableHeight-sourceTop-sourceHeight,0);
}else{
style.top=Math.max(0,availableHeight-height);
}
var popupLeft=sourceLeft+sourceWidth;
if(popupLeft+width>availableWidth){

style={
position:'absolute',
margin:0
};
}else{
style.left=popupLeft;
}

}

if(style.left===undefined){

if(availableHeight>sourceTop+sourceHeight+height+5&&(
sourceTop+sourceHeight<availableHeight*2/3||sourceTop+sourceHeight+200<availableHeight)){
style.top=sourceTop+sourceHeight;
}else if(height+30<=sourceTop){
style.bottom=Math.max(availableHeight-sourceTop,0);
}else if(height+35<availableHeight){
style.bottom=5;
}else{
style.top=25;
}

var availableAlignedWidth=availableWidth-sourceLeft;
if(availableAlignedWidth<width+10){


style.left=Math.max(availableWidth-width-10,offsetLeft);
}else{
style.left=sourceLeft;
}

}


if(maxWidth)style.maxWidth=typeof maxWidth==='number'?maxWidth-2:maxWidth;

return style;
};_proto4.
renderPopup=function renderPopup(room){
if(room.location==='popup'&&room.parentElem){
return preact.h(PSPanelErrorBoundary,{key:room.id,room:room});
}
return preact.h("div",{key:room.id,"class":"ps-overlay",onClick:this.handleClickOverlay,role:"dialog"},
preact.h(PSPanelErrorBoundary,{room:room})
);
};_proto4.
renderDebugMenu=function renderDebugMenu(){
if(PSView.debugMenu==='panels'){var _PS$room,_PS$room2,_PS$room3,_PS$panel,_PS$leftPanel,_PS$rightPanel;
return"room: "+JSON.stringify((_PS$room=PS.room)==null?void 0:_PS$room.id)+" (connected: "+JSON.stringify((_PS$room2=PS.room)==null?void 0:_PS$room2.connected)+") (connectMode: "+JSON.stringify((_PS$room3=PS.room)==null?void 0:_PS$room3.connectMode)+")\n"+("onepanel: "+
JSON.stringify(PS.prefs.onepanel)+", leftPanelWidth: "+JSON.stringify(PS.leftPanelWidth)+"\n")+("panel: "+
JSON.stringify((_PS$panel=PS.panel)==null?void 0:_PS$panel.id)+", left: "+JSON.stringify((_PS$leftPanel=PS.leftPanel)==null?void 0:_PS$leftPanel.id)+", right: "+JSON.stringify((_PS$rightPanel=PS.rightPanel)==null?void 0:_PS$rightPanel.id)+"\n")+("popups: "+
JSON.stringify(PS.popups));
}
return null;
};_proto4.
render=function render(){var _this11=this;
var rooms=[];
for(var roomid in PS.rooms){
var room=PS.rooms[roomid];
if(PS.isPanel(room)){
rooms.push(preact.h(PSPanelErrorBoundary,{key:room.id,room:room}));
}
}
return preact.h("div",{"class":"ps-frame",role:"none"},
preact.h("div",{"class":"ps-scroll-frame"},
preact.h("div",{"class":"ps-scroll-content"},
preact.h(PSHeader,null),
preact.h(PSMiniHeader,null),
rooms
)
),
PSView.debugMenu&&preact.h("pre",{id:"ps-debug-menu","aria-hidden":"true",style:{display:'block'}},
this.renderDebugMenu()
),
PS.popups.map(function(roomid){return _this11.renderPopup(PS.rooms[roomid]);})
);
};return PSView;}(preact.Component);_PSView=PSView;PSView.isIOS=['iPad Simulator','iPhone Simulator','iPod Simulator','iPad','iPhone','iPod'].includes(navigator.platform);PSView.isChrome=navigator.userAgent.includes(' Chrome/');PSView.isSafari=!_PSView.isChrome&&navigator.userAgent.includes(' Safari/');PSView.isFirefox=navigator.userAgent.includes(' Firefox/');PSView.isMac=(_navigator$platform=navigator.platform)==null?void 0:_navigator$platform.startsWith('Mac');PSView.isAndroid=/Mobi|Android/i.test(navigator.userAgent)&&!_PSView.isIOS;PSView.dragend=null;PSView.hasTapped=false;PSView.narrowMode=false;PSView.cssScrollSnap=false;PSView.useContentEditable=!_PSView.isIOS&&!_PSView.isAndroid;PSView.verticalHeaderWidth=VERTICAL_HEADER_WIDTH;PSView.scrollFrame=null;PSView.scrollListeners=[];PSView.snapTimeout=null;PSView.snapFrame=null;PSView.snapStart=null;PSView.snapTarget=null;PSView.snapLastScrollX=0;PSView.snapLastScrollTime=0;PSView.snapVelocityX=0;PSView.snapAnimating=false;PSView.snapRestingX=NARROW_MODE_HEADER_WIDTH;PSView.debugMenu=null;PSView.handleFrameScroll=function(){_PSView.handleSnapScroll();_PSView.notifyScrollListeners();};PSView.focusIfNoSelection=function(ev){var _window$getSelection2;var room=PS.getRoom(ev.target,true);if(!room)return;if((window.getSelection==null||(_window$getSelection2=window.getSelection())==null?void 0:_window$getSelection2.type)==='Range')return;room.autoDismissNotifications();PS.setFocus(room);};var


ReconnectTimer=function(_preact$Component4){function ReconnectTimer(){var _this12;for(var _len2=arguments.length,args=new Array(_len2),_key2=0;_key2<_len2;_key2++){args[_key2]=arguments[_key2];}_this12=_preact$Component4.call.apply(_preact$Component4,[this].concat(args))||this;_this12.
timer=null;return _this12;}_inheritsLoose(ReconnectTimer,_preact$Component4);var _proto5=ReconnectTimer.prototype;_proto5.
componentDidMount=function componentDidMount(){var _this13=this;
this.timer=setInterval(function(){return _this13.forceUpdate();},1000);
};_proto5.
componentWillUnmount=function componentWillUnmount(){
if(this.timer)clearInterval(this.timer);
};_proto5.
render=function render(){var _PS$connection;
var nextRetryTime=(_PS$connection=PS.connection)==null?void 0:_PS$connection.nextRetryTime;
if(!nextRetryTime)return null;
var secs=Math.ceil((nextRetryTime-Date.now())/1000);
return preact.h("small",null,secs>0?"(Autoreconnect in "+secs+"s)":"(Reconnecting...)");
};return ReconnectTimer;}(preact.Component);


function PSIcon(
props)


{
if('pokemon'in props){
return preact.h("span",{"class":"picon",style:Dex.getPokemonIcon(props.pokemon)});
}
if('item'in props){
return preact.h("span",{"class":"itemicon",style:Dex.getItemIcon(props.item)});
}
if('type'in props){
var type=Dex.types.get(props.type);
var typeName=type.name||'???';
if(props["new"]){
return preact.h("span",{"class":"typeicon typeicon-"+typeName+(props.tera?' tera':'')},TL(type));
}
var sanitizedType=typeName.replace(/\?/g,'%3f');
return preact.h("img",{
src:Dex.resourcePrefix+"sprites/types/"+sanitizedType+".png",alt:Dex.text.typeName(typeName),
height:"14",width:"32","class":"pixelated"+(props.b?' b':''),style:"vertical-align:middle"}
);
}
if('category'in props){
var categoryID=toID(props.category);
var sanitizedCategory='';
switch(categoryID){
case'physical':
case'special':
case'status':
sanitizedCategory=categoryID.charAt(0).toUpperCase()+categoryID.slice(1);
break;
default:
sanitizedCategory='undefined';
break;
}
return preact.h("img",{
src:Dex.resourcePrefix+"sprites/categories/"+sanitizedCategory+".png",
alt:Dex.text.categoryName(sanitizedCategory),
height:"14",width:"32","class":"pixelated",style:"vertical-align:middle"}
);
}
if('gender'in props){
return preact.h("img",{
src:Dex.resourcePrefix+"sprites/misc/gender-"+props.gender.toLowerCase()+".png",
width:18,height:18,alt:Dex.text.genderName(props.gender),style:"margin-top: -1px; filter: grayscale(30%)"}
);
}
return null;
}
//# sourceMappingURL=panels.js.map