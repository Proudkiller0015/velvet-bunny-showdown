"use strict";function _inheritsLoose(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,_setPrototypeOf(t,o);}function _setPrototypeOf(t,e){return _setPrototypeOf=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t;},_setPrototypeOf(t,e);}/**
 * Page Panel
 *
 * Panel for static content and server-rendered HTML.
 *
 * @author Adam Tran <aviettran@gmail.com>
 * @license MIT
 */var








SanitizedHTML=function(_preact$Component){function SanitizedHTML(){return _preact$Component.apply(this,arguments)||this;}_inheritsLoose(SanitizedHTML,_preact$Component);var _proto=SanitizedHTML.prototype;_proto.
componentDidMount=function componentDidMount(){
this.updateHTML(this.props.children);
};_proto.
shouldComponentUpdate=function shouldComponentUpdate(nextProps){
if(nextProps.children!==this.props.children)this.updateHTML(nextProps.children);
return false;
};_proto.
updateHTML=function updateHTML(html){
this.base.innerHTML=BattleLog.sanitizeHTML(html);
};_proto.
render=function render(){
return preact.h("div",null);
};return SanitizedHTML;}(preact.Component);var


PageRoom=function(_PSRoom){













function PageRoom(options){var _this;
_this=_PSRoom.call(this,options)||this;_this.classType='html';_this.page=_this.id.split("-")[1];_this.connectMode='normal';_this.loading=true;_this.htmlData=void 0;_this.setHTMLData=function(htmlData){_this.loading=false;_this.htmlData=htmlData;_this.update(null);};
if(options.connectMode!==undefined)_this.connectMode=options.connectMode;
_this.connect();
_this.title=_this.id.split('-')[1];return _this;
}_inheritsLoose(PageRoom,_PSRoom);var _proto2=PageRoom.prototype;_proto2.
connect=function connect(){
if(PagePanel.clientRooms.hasOwnProperty(this.id.split('-')[1])){
this.connectMode=null;
}else if(!this.connected&&(
this.connectMode==='normal'||this.connectMode==='pending-reconnect'||
this.connectMode==='pending-login'))
{
PS.send("/join "+this.id);
this.connected='pending';
}
};return PageRoom;}(PSRoom);


function PageLadderHelp(){
return preact.h("div",{"class":"ladder pad"},
preact.h("p",null,
preact.h("button",{"class":"button","data-href":"/ladder","data-target":"replace"},
preact.h("i",{"class":"fa fa-chevron-left","aria-hidden":true})," ",TL(["[All formats]"])
)
),
preact.h("h3",null,"How the ladder works"),
preact.h("p",null,"Our ladder displays three ratings: Elo, GXE, and Glicko-1."

),
preact.h("p",null,
preact.h("strong",null,"Elo")," is the main ladder rating. It's a pretty normal ladder rating: goes up when you win and down when you lose."


),
preact.h("p",null,
preact.h("strong",null,"GXE")," (Glicko X-Act Estimate) is an estimate of your win chance against an average ladder player."

),
preact.h("p",null,
preact.h("strong",null,"Glicko-1")," is ",
preact.h("a",{href:"https://en.wikipedia.org/wiki/Glicko_rating_system"},"another rating system"),". It has rating and deviation values."

),
preact.h("p",null,
preact.h("strong",null,"COIL")," (Converging Order Invariant Ladder) is used for suspect tests. The more games you play, the closer it will get to your GXE \xD7 4000. How fast it reaches GXE \xD7 4000 depends on ",



preact.h("a",{href:"https://www.smogon.com/forums/threads/reintroducing-coil.3747719/",target:"_blank"},"a custom B value")," ","which is different for each suspect test."

),
preact.h("p",null,"Note that win/loss should not be used to estimate skill, since who you play against is much more important than how many times you win or lose. Our other stats like Elo and GXE are much better for estimating skill."




)
);
}var

PagePanel=function(_PSRoomPanel){function PagePanel(){return _PSRoomPanel.apply(this,arguments)||this;}_inheritsLoose(PagePanel,_PSRoomPanel);var _proto3=PagePanel.prototype;_proto3.








receiveLine=function receiveLine(args){
var room=this.props.room;
switch(args[0]){
case'title':
room.title=args[1];
PS.update();
return true;
case'tempnotify':{
var id=args[1],title=args[2],body=args[3];
room.notify({title:title,body:body,id:id});
return true;
}
case'tempnotifyoff':{
var _id=args[1];
room.dismissNotification(_id);
return true;
}
case'selectorhtml':
var pageHTMLContainer=this.base.querySelector('.page-html-container');
var selectedElement=pageHTMLContainer==null?void 0:pageHTMLContainer.querySelector(args[1]);
if(!selectedElement)return;
selectedElement.innerHTML=BattleLog.sanitizeHTML(args.slice(2).join('|'));
room.subtleNotify();
return true;
case'noinit':
if(args[1]==='namerequired'){
room.setHTMLData(args[2]);
}
return true;
case'pagehtml':
room.setHTMLData(args[1]);
room.subtleNotify();
return true;
}
};_proto3.
render=function render(){
var room=this.props.room;
var renderPage;
if(room.page!==undefined&&PagePanel.clientRooms[room.page]){
renderPage=PagePanel.clientRooms[room.page];
}else{
if(room.loading){
renderPage=preact.h("p",null,TL(["Loading..."]));
}else{
renderPage=preact.h("div",{"class":"page-html-container"},
preact.h(SanitizedHTML,null,room.htmlData||'')
);
}
}
return preact.h(PSPanelWrapper,{room:room},
renderPage
);
};return PagePanel;}(PSRoomPanel);PagePanel.id='html';PagePanel.routes=['view-*'];PagePanel.Model=PageRoom;PagePanel.clientRooms={'ladderhelp':preact.h(PageLadderHelp,null)};


PS.addRoomType(PagePanel);
//# sourceMappingURL=panel-page.js.map