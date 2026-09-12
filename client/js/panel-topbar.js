"use strict";function _inheritsLoose(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,_setPrototypeOf(t,o);}function _setPrototypeOf(t,e){return _setPrototypeOf=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t;},_setPrototypeOf(t,e);}/**
 * Topbar Panel
 *
 * Topbar view - handles the topbar and some generic popups.
 *
 * Also handles global drag-and-drop support.
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */










window.addEventListener('dragover',function(e){

e.preventDefault();
});var

PSHeader=function(_preact$Component){function PSHeader(){var _this;for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++){args[_key]=arguments[_key];}_this=_preact$Component.call.apply(_preact$Component,[this].concat(args))||this;_this.
faviconNotifying=false;_this.
updateFavicon=function(){
var notifying=Object.values(PS.rooms).some(function(room){return room==null?void 0:room.notifications.length;});
if(notifying===_this.faviconNotifying)return;

var favicon=document.querySelector('#dynamic-favicon');
if(!favicon)return;
favicon.href=""+Dex.resourcePrefix+(notifying?'favicon-notify.ico':'favicon.ico');
_this.faviconNotifying=notifying;
};_this.






































































































































handleResize=function(){var _this$base$querySelec,_this$base$querySelec2;
if(!_this.base)return;

if(PS.leftPanelWidth===null){
var width=document.documentElement.clientWidth;
var oldNarrowMode=PSView.narrowMode;
PSView.narrowMode=width<=700;
PSView.verticalHeaderWidth=PSView.narrowMode?NARROW_MODE_HEADER_WIDTH:VERTICAL_HEADER_WIDTH;
document.documentElement.style.width=PSView.useCSSScrollSnap()?
width+NARROW_MODE_HEADER_WIDTH+"px":'auto';
if(oldNarrowMode!==PSView.narrowMode){
PSView.updateScrollSnap();
PS.update();
}
return;
}
if(PSView.narrowMode){
document.documentElement.style.width='auto';
PSView.narrowMode=false;
PSView.updateScrollSnap();
}

var userbarLeft=(_this$base$querySelec=_this.base.querySelector('div.userbar .icon.button'))==null||(_this$base$querySelec=_this$base$querySelec.getBoundingClientRect())==null?void 0:_this$base$querySelec.left;
if(userbarLeft)userbarLeft-=5;
var plusTabRight=(_this$base$querySelec2=_this.base.querySelector('a.roomtab[href="/rooms"]'))==null||(_this$base$querySelec2=_this$base$querySelec2.getBoundingClientRect())==null?void 0:_this$base$querySelec2.right;
var overflow=_this.base.querySelector('.overflow');

if(!overflow||!userbarLeft||!plusTabRight)return;

var maintabbar=_this.base.querySelector('div.maintabbar');
if(maintabbar){
var userbarRight=window.innerWidth-userbarLeft;
maintabbar.style.marginRight=userbarRight+"px";
overflow.style.right=userbarRight+"px";
}

if(plusTabRight>userbarLeft-3){
overflow.style.display='block';
}else{
overflow.style.display='none';
}
};return _this;}_inheritsLoose(PSHeader,_preact$Component);PSHeader.roomInfo=function roomInfo(room){var RoomType=PS.roomTypes[room.type];var icon=(RoomType==null?void 0:RoomType.icon)||preact.h("i",{"class":"fa fa-file-text-o","aria-hidden":true});var title=room.getTitle();switch(room.type){case'battle':var idChunks=room.id.split('-');var formatName;if(idChunks.length<=2){if(idChunks[1]==='uploadedreplay')formatName='Uploaded Replay';}else{formatName=window.BattleLog?BattleLog.formatName(idChunks[1]):idChunks[1];}if(!title){var _battle$p,_battle$p2;var battle=room.battle;var p1=(battle==null||(_battle$p=battle.p1)==null?void 0:_battle$p.name)||'';var p2=(battle==null||(_battle$p2=battle.p2)==null?void 0:_battle$p2.name)||'';if(p1&&p2){title=p1+" v. "+p2;}else if(p1||p2){title=""+p1+p2;}else{title="(empty room)";}}icon=preact.h("i",{"class":"text"},formatName);break;case'html':default:if(title.startsWith('[')){var closeBracketIndex=title.indexOf(']');if(closeBracketIndex>0){icon=preact.h("i",{"class":"text"},title.slice(1,closeBracketIndex));title=title.slice(closeBracketIndex+1);break;}}break;}return{icon:icon,title:title};};PSHeader.renderRoomTab=function renderRoomTab(id,noAria){var includeMiniNotifications=arguments.length>2&&arguments[2]!==undefined?arguments[2]:true;var room=PS.rooms[id];if(!room)return null;var closable=id===''||id==='rooms'?'':' closable';var cur=PS.isVisiblePanel(room)?' cur':'';var notifying=room.isSubtleNotifying?' subtle-notifying':'';var hoverTitle='';var notifications=room.notifications;if(id===''&&includeMiniNotifications){for(var _i2=0,_PS$miniRoomList2=PS.miniRoomList;_i2<_PS$miniRoomList2.length;_i2++){var _PS$rooms$roomid;var roomid=_PS$miniRoomList2[_i2];var miniNotifications=(_PS$rooms$roomid=PS.rooms[roomid])==null?void 0:_PS$rooms$roomid.notifications;if(miniNotifications!=null&&miniNotifications.length)notifications=[].concat(notifications,miniNotifications);}}if(notifications.length){notifying=' notifying';for(var _i4=0,_notifications2=notifications;_i4<_notifications2.length;_i4++){var notif=_notifications2[_i4];if(!notif.body)continue;hoverTitle+=notif.title+"\n"+notif.body+"\n";}}var className="roomtab button"+notifying+closable+cur;var _PSHeader$roomInfo=PSHeader.roomInfo(room),icon=_PSHeader$roomInfo.icon,roomTitle=_PSHeader$roomInfo.title;if(room.type==='rooms'&&PS.leftPanelWidth!==null)roomTitle='';if(room.type==='battle')className+=' roomtab-battle';var closeButton=null;if(closable){closeButton=preact.h("button",{"class":"closebutton",name:"closeRoom",value:id,"aria-label":TL(["[Close]"])},preact.h("i",{"class":"fa fa-times-circle","aria-hidden":true}));}var aria=noAria?{}:{"role":"tab","id":"roomtab-"+id,"aria-selected":cur?"true":"false"};if(id==='rooms')aria['aria-label']=TL(["[Join chat]"]);return preact.h("li",{"class":id===''?'home-li':'',key:id},preact.h("a",Object.assign({"class":className,href:"/"+id,draggable:true,title:hoverTitle||undefined,onDragEnter:this.handleDragEnter,onDragStart:this.handleDragStart},aria),icon," ",roomTitle),closeButton);};PSHeader.notifyingMiniRoomTabs=function notifyingMiniRoomTabs(){return PS.miniRoomList.filter(function(roomid){var _PS$rooms$roomid2;return(_PS$rooms$roomid2=PS.rooms[roomid])==null?void 0:_PS$rooms$roomid2.notifications.length;});};var _proto=PSHeader.prototype;_proto.
componentDidMount=function componentDidMount(){var _this2=this;
PS.user.subscribe(function(){
_this2.forceUpdate();
});
window.addEventListener('resize',this.handleResize);
this.handleResize();
this.updateFavicon();
};_proto.
componentDidUpdate=function componentDidUpdate(){
this.handleResize();
this.updateFavicon();
};_proto.
renderUser=function renderUser(){var _PS$connection;
if(!((_PS$connection=PS.connection)!=null&&_PS$connection.connected)){
return preact.h("button",{"class":"button",disabled:true},preact.h("em",null,TL(["Offline"])));
}
if(PS.user.initializing){
return preact.h("button",{"class":"button",disabled:true},preact.h("em",null,TL(["Connecting..."])));
}
if(!PS.user.named){
return preact.h("a",{"class":"button",href:"login"},TL(["[Choose name]"]));
}
var userColor=window.BattleLog&&"color:"+(PS.user.away?'#888':BattleLog.usernameColor(PS.user.userid));
return preact.h("span",{"class":"username",style:userColor},
preact.h("span",{"class":"usernametext"},PS.user.name)
);
};_proto.
renderVertical=function renderVertical(){
var miniRoomTabs=PSHeader.notifyingMiniRoomTabs();
return preact.h("div",{
id:"header","class":"header-vertical",role:"navigation",
style:"width:"+(PSView.verticalHeaderWidth-7)+"px",onClick:PSView.scrollToHeader},

preact.h("div",{"class":"maintabbarbottom"}),
preact.h("div",{"class":"scrollable-part"},
preact.h("img",{
"class":"logo",
src:"https://"+Config.routes.client+"/favicon-256.png",
alt:"Pok\xE9mon Showdown! (beta)",
width:"50",height:"50"}
),
preact.h("div",{"class":"tablist",role:"tablist"},
preact.h("ul",null,
PSHeader.renderRoomTab(PS.leftRoomList[0],false,false),
miniRoomTabs.map(function(roomid){return PSHeader.renderRoomTab(roomid);})
),
preact.h("ul",null,
PS.leftRoomList.slice(1).map(function(roomid){return PSHeader.renderRoomTab(roomid);})
),
preact.h("ul",{"class":"siderooms"},
PS.rightRoomList.map(function(roomid){return PSHeader.renderRoomTab(roomid);})
)
)
),
preact.h("div",{"class":"userbar"},
this.renderUser()," ",
preact.h("div",{style:"float:right"},
preact.h("button",{
"class":"icon button","data-href":"volume",title:TL(["[Sound]"]),"aria-label":TL(["[Sound]"]),
onDblClick:PSHeader.toggleMute},

preact.h("i",{"class":PS.prefs.mute?'fa fa-volume-off':'fa fa-volume-up'})
)," ",
preact.h("button",{"class":"icon button","data-href":"options",title:TL(["[Options]"]),"aria-label":TL(["[Options]"])},
preact.h("i",{"class":"fa fa-cog","aria-hidden":true})
)
)
),
null,
null
);
};_proto.
render=function render(){
if(PS.leftPanelWidth===null){
return this.renderVertical();
}
return preact.h("div",{id:"header","class":"header",role:"navigation"},
preact.h("div",{"class":"maintabbarbottom"}),
null,
preact.h("div",{"class":"userbar"},
this.renderUser()," ",
preact.h("button",{
"class":"icon button","data-href":"volume",title:TL(["[Sound]"]),"aria-label":TL(["[Sound]"]),
onDblClick:PSHeader.toggleMute},

preact.h("i",{"class":PS.prefs.mute?'fa fa-volume-off':'fa fa-volume-up'})
)," ",
preact.h("button",{"class":"icon button","data-href":"options",title:TL(["[Options]"]),"aria-label":TL(["[Options]"])},
preact.h("i",{"class":"fa fa-cog","aria-hidden":true})
)
),
preact.h("div",{"class":"tabbar maintabbar"},preact.h("div",{"class":"inner-1",role:PS.leftPanelWidth?'none':'tablist'},preact.h("div",{"class":"inner-2"},
preact.h("ul",{"class":"maintabbar-left",style:{width:PS.leftPanelWidth+"px"},role:PS.leftPanelWidth?'tablist':'none'},
preact.h("li",null,
preact.h("img",{
"class":"logo",
src:"https://"+Config.routes.client+"/favicon-256.png",
alt:"Pok\xE9mon Showdown! (beta)",
width:"48",height:"48"}
)
),
PSHeader.renderRoomTab(PS.leftRoomList[0]),
PS.leftRoomList.slice(1).map(function(roomid){return PSHeader.renderRoomTab(roomid);})
),
preact.h("ul",{"class":"maintabbar-right",role:PS.leftPanelWidth?'tablist':'none'},
PS.rightRoomList.map(function(roomid){return PSHeader.renderRoomTab(roomid);})
)
))),
preact.h("div",{"class":"overflow"},
preact.h("button",{name:"tablist","class":"button","data-href":"roomtablist","aria-label":TL(["[All tabs]"]),type:"button"},
preact.h("i",{"class":"fa fa-caret-down","aria-hidden":true})
)
)
);
};return PSHeader;}(preact.Component);PSHeader.toggleMute=function(e){PS.prefs.set('mute',!PS.prefs.mute);PS.update();};PSHeader.handleDragEnter=function(e){var _PS$dragging;e.preventDefault();if(((_PS$dragging=PS.dragging)==null?void 0:_PS$dragging.type)!=='room')return;var target=e.currentTarget;var draggingRoom=PS.dragging.roomid;if(draggingRoom===null)return;var draggedOverRoom=PS.router.extractRoomID(target.href);if(draggedOverRoom===null)return;if(draggingRoom===draggedOverRoom)return;var leftIndex=PS.leftRoomList.indexOf(draggedOverRoom);if(leftIndex>=0){PS.dragOnto(PS.rooms[draggingRoom],'left',leftIndex);}else{var rightIndex=PS.rightRoomList.indexOf(draggedOverRoom);if(rightIndex>=0){PS.dragOnto(PS.rooms[draggingRoom],'right',rightIndex);}else{return;}}};PSHeader.handleDragStart=function(e){var roomid=PS.router.extractRoomID(e.currentTarget.href);if(!roomid)return;PS.dragging={type:'room',roomid:roomid};};var


PSMiniHeader=function(_preact$Component2){function PSMiniHeader(){var _this3;for(var _len2=arguments.length,args=new Array(_len2),_key2=0;_key2<_len2;_key2++){args[_key2]=arguments[_key2];}_this3=_preact$Component2.call.apply(_preact$Component2,[this].concat(args))||this;_this3.
menuOpen=void 0;_this3.






handleScroll=function(){
if(_this3.menuOpen!==!PSView.getScrollX())_this3.forceUpdate();
};return _this3;}_inheritsLoose(PSMiniHeader,_preact$Component2);var _proto2=PSMiniHeader.prototype;_proto2.componentDidMount=function componentDidMount(){PSView.addScrollListener(this.handleScroll);};_proto2.componentWillUnmount=function componentWillUnmount(){PSView.removeScrollListener(this.handleScroll);};_proto2.
render=function render(){
this.menuOpen=!PSView.getScrollX();

if(PS.leftPanelWidth!==null)return null;

var notificationsCount=Object.values(PS.rooms).filter(
function(room){return room!==PS.room&&(room==null?void 0:room.notifications.length);}
).length;
var _PSHeader$roomInfo2=PSHeader.roomInfo(PS.panel),icon=_PSHeader$roomInfo2.icon,title=_PSHeader$roomInfo2.title;
var userColor=window.BattleLog&&"color:"+(PS.user.away?'#888':BattleLog.usernameColor(PS.user.userid));
var showMenuButton=PSView.narrowMode;
var notifying=
!showMenuButton&&this.menuOpen&&Object.values(PS.rooms).some(function(room){return room.notifications.length;})?
' notifying':'';
var menuButton=!showMenuButton?
null:
!this.menuOpen?
preact.h("button",{onClick:PSView.scrollToHeader,"class":"mini-header-left "+notifying,"aria-label":TL(["[Menu]"])},
!!notificationsCount&&preact.h("div",{"class":"notification-badge"},notificationsCount),
preact.h("i",{"class":"fa fa-bars","aria-hidden":true})
):

preact.h("button",{onClick:PSView.scrollToRoom,"class":"mini-header-left","aria-label":TL(["[Menu]"])},
preact.h("i",{"class":"fa fa-arrow-right","aria-hidden":true})
);

return preact.h("div",{"class":"mini-header",style:"left:"+(PSView.verticalHeaderWidth+(PSView.narrowMode?0:-1))+"px;"},
menuButton,
preact.h("button",{"data-href":"options","class":"mini-header-right","aria-label":TL(["[Options]"])},
PS.user.named?preact.h("strong",{style:userColor},PS.user.name):preact.h("i",{"class":"fa fa-cog","aria-hidden":true})
),
icon," ",title
);
};return PSMiniHeader;}(preact.Component);


preact.render(preact.h(PSView,null),document.body,document.getElementById('ps-frame'));
//# sourceMappingURL=panel-topbar.js.map