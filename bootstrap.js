// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
const core = {
	addon: {
		name: 'react-mozNotificationBar',
		id: 'react-mozNotificationBar@jetpack',
		path: {
			name: 'react-moznotificationbar',
			//
			content: 'chrome://react-moznotificationbar/content/',
			locale: 'chrome://react-moznotificationbar/locale/',
			//
			resources: 'chrome://react-moznotificationbar/content/resources/',
			images: 'chrome://react-moznotificationbar/content/resources/images/',
			scripts: 'chrome://react-moznotificationbar/content/resources/scripts/',
			styles: 'chrome://react-moznotificationbar/content/resources/styles/'
		},
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_simpleStorage = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage');
const OSPath_config = OS.Path.join(OSPath_simpleStorage, 'config.json');
const myPrefBranch = 'extensions.' + core.addon.id + '.';

var BOOTSTRAP = this;

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

var gNsiTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });

// START - Addon Functionalities

var AB = { // AB stands for attention bar
	// based on https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/notificationbox#Methods && https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/notification.xml#79
	Insts: {
		/*
		##: {
			state: avail in bootstrap only. the dom does a JSON.parse(JSON.stringify()) on this when updating from it
			setState: avail only in dom, its the react connection to it
		}
		*/
	}, // holds all instances
	domIdPrefix: core.addon.id.replace(/[^a-z0-9-_\:\.]/ig,'a'), // The ID and NAME elements must start with a letter i.e. upper case A to Z or lower case a to z; a number is not allowed. After the first letter any number of letters (a to z, A to Z), digits (0 to 9), hyphens (-), underscores (_), colons (:) and periods (.) are allowed. // http://www.electrictoolbox.com/valid-characters-html-id-attribute/
	Callbacks: {},
	// key is nid, if nid is of a notification then the callback is a close callback, else it is of a click callback.
	// all Callbacks have last arg of aBrowser which is the xul browser element that was focused when user triggered the cb
	// click callbacks have first arg doClose, you should call doClose(aBrowser) if you want to close out the AB
	// click callbacks are bound `this` to the button entry in aInst[id].state, so i can modify it can call setState again
	// close callbacks are bound `this` to the entry in aInst
	nid: -1, // stands for next_id, used for main toolbar, and also for each button, and also each menu item
	/*
	{
		id: genned id, each id gets its own container in aDOMWindow
		desc: aDesc,
		comp: stands for react component, this gets rendered
	}
	*/
	setState: function(aInst) {
		// this function will add to aInst and all bts in aInst.aBtns a id based on this.genId()
		// this function also sends setState message to all windows to update this instances
		// aInst should be strings only, as it is sent to all windows
		
		// :note: to remove a callback you have to set it to an empty function - ```getScope().AB.Insts[0].state.aClose = function() {}; getScope().AB.setState(getScope().AB.Insts[0].state);```
		
		// RETURNS
			// id of inst pushed

		
		var cInstDefaults = {
			// aId: this is auto added in
			aTxt: '', // this is the message body on the toolbar
			aPos: 0, // 1 for top, on where to append it
			aIcon: 'chrome://mozapps/skin/places/defaultFavicon.png', // icon on the toolbar
			aPriority: 1, // valid values 1-10
			aBtns: [], // must be array
			aHideClose: undefined // if set to string 'true' or bool true, in dom it will get converted to string as 'true'. setting to 1 int will not work.
		};
		
		/*
		aBtns: array of objects
		[
			{
				// bId - this is auto generated and stuck in here, with this.nid
				bIcon: optional, string to image path
				bTxt: required, text shown on button
				bKey: 'B', // access key
				bMenu: [
					{
						//mId: this is auto genned and added in here,
						mTxt: 'string'
					}
				]
			},
			{
				...
			}
		]
		*/
		
		if (!('aId' in aInst)) {
			validateOptionsObj(aInst, cInstDefaults);
			aInst.aId = this.genId();
			this.Insts[aInst.aId] = {
				state: aInst
			};
			this.Callbacks[aInst.aId] = function(aBrowser) {
				AB.nonDevUserSpecifiedCloseCb(aInst.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
			};
		}
		if (aInst.aClose) {
			var aClose = aInst.aClose.bind(aInst);
			delete aInst.aClose;
			
			this.Callbacks[aInst.aId] = function(aBrowser) {
				var rez_aClose = aClose(aBrowser);
				if (rez_aClose !== false) { // :note: if onClose returns false, it cancels the closing
					AB.nonDevUserSpecifiedCloseCb(aInst.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
				}
			};
			
		}
		
		// give any newly added btns and menu items an id		
		if (aInst.aBtns) {
			for (var i=0; i<aInst.aBtns.length; i++) {
				if (!('bId' in aInst.aBtns[i])) {
					aInst.aBtns[i].bId = this.genId();
				}
				if (aInst.aBtns[i].bClick) { // i dont do this only if bId is not there, because devuser can change it up. i detect change by presenence of the bClick, because after i move it out of state obj and into callbacks obj, i delete it from state obj. so its not here unless changed
					AB.Callbacks[aInst.aBtns[i].bId] = aInst.aBtns[i].bClick.bind(aInst.aBtns[i]);
					delete aInst.aBtns[i].bClick; // AB.Callbacks[aInst.aId] is the doClose callback devuser should call if they want it to close out
				}
				if (aInst.aBtns[i].bMenu) {
					AB.iterMenuForIdAndCbs(aInst.aBtns[i].bMenu, aInst.aId, aInst.aBtns[i]);
				}
			}
		}
		
		// go through all windows, if this id is not in it, then mount it, if its there then setState on it
		
		var doit = function(aDOMWindow) {
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}
			AB.ensureInitedIntoWindow(aDOMWindow);
			
			if (aInst.aId in aDOMWindow[core.addon.id].AB.Insts) {
				aDOMWindow[core.addon.id].AB.Insts[aInst.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInst));
				aDOMWindow[core.addon.id].AB.Insts[aInst.aId].setState(JSON.parse(JSON.stringify(aInst)));
			} else {
				// mount it
				aDOMWindow[core.addon.id].AB.Insts[aInst.aId] = {};
				aDOMWindow[core.addon.id].AB.Insts[aInst.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInst));
				var cDeck = aDOMWindow.document.getElementById('content-deck');
				var cNotificationBox = aDOMWindow.document.createElementNS(NS_XUL, 'notificationbox');
				console.error('inserting', 'notificationbox-' + aInst.aId + '--' + AB.domIdPrefix);
				cNotificationBox.setAttribute('id', 'notificationbox-' + aInst.aId + '--' + AB.domIdPrefix);
				if (!aInst.aPos) {
					cDeck.parentNode.appendChild(cNotificationBox);
				} else {
					cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
				}
				aDOMWindow[core.addon.id].AB.Insts[aInst.aId].relement = aDOMWindow.React.createElement(aDOMWindow[core.addon.id].AB.masterComponents.Notification, aInst);
				aDOMWindow.ReactDOM.render(aDOMWindow[core.addon.id].AB.Insts[aInst.aId].relement, cNotificationBox);
			}
		};
		
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				doit(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					doit(aDOMWindow);
				}, false);
			}
		}
	},
	nonDevUserSpecifiedCloseCb: function(aInstId, aBrowser) {
		// this does the unmounting from all windows, and deletes entry from this.Insts
		
		aBrowser.contentWindow.alert('ok this tab sent the close message for aInstId ' + aInstId);
		// on close go through and get all id's in there and remove all callbacks for it. and then unmount from all windows.
	},
	genId: function() {
		this.nid++;
		return this.nid;
	},
	iterMenuForIdAndCbs: function(jMenu, aCloseCallbackId, aBtnEntry) {
		// aBtnArrEntry is reference as its the btn object in the .aBtns arr
		// goes through and gives every menuitem and submenu item (anything that has cTxt) an id, as they are clickable
		// ALSO moves cClick callbacks into AB.Callbacks
		jMenu.forEach(function(jEntry, jIndex, jArr) {
			if (!jEntry.cId && jEntry.cTxt) { // cId will NEVER be 0 but if it does it would be a problem with !jEntry.cId because first the notification bar is genId and the button is genId and nid starts at 0 so its at least 2 by first jMenu
				jEntry.cId = AB.genId();
				if (jEntry.cMenu) {
					AB.iterMenuForIdAndCbs(jEntry.cMenu, aCloseCallbackId, aBtnEntry);
				}
			}
			if (jEntry.cClick) { // i dont do this only if bId is not there, because devuser can change it up. i detect change by presenence of the bClick, because after i move it out of state obj and into callbacks obj, i delete it from state obj. so its not here unless changed
				AB.Callbacks[jEntry.cId] = jEntry.cClick.bind(aBtnEntry);
				delete jEntry.cClick; // AB.Callbacks[aInst.aId] is the doClose callback devuser should call if they want it to close out
			}
		});
	},
	/*
	getInst: function(aKey, aVal) {
		for (var i=0; i<this.inst.length; i++) {
			if (this.inst[i][aKey] && this.inst[i][aKey] == aVal) {
				return this.inst[i];
			}
		}
	},
	ensureInstancesToAllWindows: function() {
		// matches the bootstrap inst into all windows
		// goes through all windows, checks if all instances are 
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				ensureInstancesToWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					ensureInstancesToWindow(aDOMWindow);
				}, false);
			}
		}
	},
	ensureInstancesToWindow: function(aDOMWindow) {
		// runs AB.initIntoWindow if needed
		if (!this.inst.length && (!aDOMWindow[core.addon.id] || !aDOMWindow[core.addon.id].AB || !aDOMWindow[core.addon.id].AB.inst || !aDOMWindow[core.addon.id].AB.inst.length)) {
			// bootstrap inst is empty, and so is window inst
			console.log('bootstrap inst is empty, and so is window inst');
			return;
		}
		if (!aDOMWindow[core.addon.id]) {
			AB.initIntoWindow(aDOMWindow);
		} else if (!aDOMWindow[core.addon.id].AB) {
			AB.initIntoWindow(aDOMWindow);
		}
		
		var winAB = aDOMWindow[core.addon.id].AB;
		
		// get all ids of instances in bootstrap
		var instIdsInBootstrap = [];
		for (var i=0; i<this.inst.length; i++) {
			instIdsInBootstrap.push(this.inst[i].aId);
		}
		
		// get all ids of instances in bootstrap
		// var instIdsInWindow = [];
		// for (var i=0; i<winAB.inst.length; i++) {
			// instIdsInWindow.push(winAB.inst[i].aId);
		// }
		var instIdsInWindow = Object.keys(winAB.inst); // i commented about the above and did like this due to link779928114

		// check if need to unmount
		for (var i=0; i<instIdsInWindow.length; i++) {
			// this id is in the window
			if (instIdsInBootstrap.indexOf(instIdsInWindow[i]) == -1) {
				// this id is not in bootstrap
				// unmount this
				var cNotificationBox = aDOMWindow.document.getElementById(this.domIdPrefix + '-notificationbox-' + instIdsInWindow[i]);
				aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
				cNotificationBox.parentNode.removeChild(cNotificationBox);
			}
		}
		
		// check if need to mount
		for (var i=0; i<instIdsInBootstrap.length; i++) {
			// this id is in the bootstrap
			if (instIdsInWindow.indexOf(instIdsInBootstrap[i]) == -1) {
				// this id is not in window
				// mount this
				var aDOMDocument = aDOMWindow.document;
				var cDeck = aDOMDocument.getElementById('content-deck');
				var cNotificationBox = aDOMDocument.createElementNS(NS_XUL, 'notificationbox');
				cNotificationBox.setAttribute('id', 'notificationbox-' + instIdsInBootstrap[i] + '--' + this.domIdPrefix);
				if (!this.inst[i].aOptions.aPos) {
					// by default place at bottom
					cDeck.parentNode.appendChild(cNotificationBox);
				} else {
					cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
				}
				aDOMWindow.ReactDOM.render(this.inst[i].comp, cNotificationBox); // :note: comp must be value holding React.createElement(AB.masterComponents.Bar, {});
				aDOMWindow[core.addon.id].AB.inst[this.inst[i].aId] = {}; // :note: in window, the inst is an array of ids. in bootstrap inst is an array of objects // link779928114
			}
		}
			
		
	},
	*/
	uninitFromWindow: function(aDOMWindow) {
		if (!aDOMWindow[core.addon.id]) {
			return;
		}
		if (!aDOMWindow[core.addon.id].AB) {
			return;
		}
		console.error('doing uninit from window');
		var winAB = aDOMWindow[core.addon.id].AB;
		for (var aInstsId in winAB.Insts) {
			// unmount this
			console.error('aInstsId:', aInstsId, 'notificationbox-' + aInstsId + '--' + this.domIdPrefix);
			var cNotificationBox = aDOMWindow.document.getElementById('notificationbox-' + aInstsId + '--' + this.domIdPrefix);
			aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
			cNotificationBox.parentNode.removeChild(cNotificationBox);
		}
		delete aDOMWindow[core.addon.id].AB;
		console.error('done uninit');
		// :note: i cant delete aDOMWindow[core.addon.id] on unload because i dont know if others are using it
	},
	ensureInitedIntoWindow: function(aDOMWindow) {
		// dont run this yoruself, ensureInstancesToWindow runs this. so if you want to run yourself, then run ensureInstancesToWindow(aDOMWindow)
		if (!aDOMWindow[core.addon.id]) {
			aDOMWindow[core.addon.id] = {}; // :note: i cant delete aDOMWindow[core.addon.id] on unload because i dont know if others are using it
		}
		if (!aDOMWindow[core.addon.id].AB) {
			aDOMWindow[core.addon.id].AB = {
				Insts: {},
				domIdPrefix: AB.domIdPrefix
			}; // ab stands for attention bar
			if (!aDOMWindow.React) {
				console.error('WILL NOW LOAD IN REACT');
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js?' + core.addon.cache_key, aDOMWindow); // even if i load it into aDOMWindow.blah and .blah is an object, it goes into global, so i just do aDOMWindow now
			}
			if (!aDOMWindow.ReactDOM) {
				console.error('WILL NOW LOAD IN REACTDOM');
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js?' + core.addon.cache_key, aDOMWindow);
			}
			Services.scriptloader.loadSubScript(core.addon.path.scripts + 'ab-react-components.js?' + core.addon.cache_key, aDOMWindow);
		}
	},
	init: function() {
		Services.mm.addMessageListener(core.addon.id + '-AB', this.msgListener);
	},
	uninit: function() {
		Services.mm.removeMessageListener(core.addon.id + '-AB', this.msgListener);
	},
	msgListener: {
		receiveMessage: function(aMsgEvent) {
			var aMsgEventData = aMsgEvent.data;
			console.error('getting aMsgEvent, data:', aMsgEventData);
			// this means trigger a callback with id aMsgEventData
			var cCallbackId = aMsgEventData;
			var cBrowser = aMsgEvent.target;
			if (AB.Callbacks[cCallbackId]) { // need this check because react components always send message on click, but it may not have a callback
				AB.Callbacks[cCallbackId](cBrowser);
			}
		}
	}
};

/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		// AB.ensureInstancesToWindow(aDOMWindow);
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
		AB.uninitFromWindow(aDOMWindow);
		delete aDOMWindow[core.addon.id];
	}
};
/*end - windowlistener*/

function install() {}

function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {

	}
}

function startup(aData, aReason) {
	// extendCore();
	
	AB.init(); // should do before windowListener.register(); which has AB.ensureInstancesToAllWindows in the loadIntoWindow proc
	
	windowListener.register();

	xpcomSetTimeout(gNsiTimer, 4000, function() {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'now', 'will now create it');
		
		AB.setState({
			aTxt: 'tweet this',
			aPriority: 1
		});
		
		xpcomSetTimeout(gNsiTimer, 4000, function() {
			Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'now', 'will now update it');
			
			AB.Insts['0'].state.aBtns = [
				{
					bTxt:'hi'
				},
				{
					bTxt:'bye',
					bIcon:'chrome://mozapps/skin/places/defaultFavicon.png'
				}
			];
			
			AB.Insts['0'].state.aTxt = 'i present to you two new buttons!';
			AB.Insts['0'].state.aPriority = 9;
			
			AB.setState(AB.Insts['0'].state);
			
			xpcomSetTimeout(gNsiTimer, 4000, function() {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'now', 'will now update it');
				
				AB.Insts['0'].state.aBtns[1].bMenu = [
					{
						cTxt:'item 1',
						cClass: 'menuitem-non-iconic',
						cMenu: [
							{
								cTxt: 'item1.1'
							},
							{
								cTxt: 'item1.2',
								cIcon:'chrome://mozapps/skin/places/defaultFavicon.png',
								cMenu: [
									{
										cTxt: 'item1.2.1',
										cIcon:'chrome://mozapps/skin/places/defaultFavicon.png'
									}
								]
							}
						]
					},
					{
						cTxt:'item2',
						cIcon:'chrome://mozapps/skin/places/defaultFavicon.png'
					}
				];
				/* 
				AB.Insts['0'].state.aBtns[1].bMenu = [
					{
						cTxt:'item 1'
					},					{
						cTxt:'item 2'
					}
				];
				 */
				AB.Insts['0'].state.aTxt = 'given menu to button 2!';
				AB.Insts['0'].state.aPriority = 5;
				
				AB.setState(AB.Insts['0'].state);
			});
			
		});
	});
}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }
	
	windowListener.unregister();
	AB.uninit(); // should call after windowListener.unregister()

}
// END - Addon Functionalities

// start - common helper functions
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {
			console.error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value, aOptionsDefaults:', aOptionsDefaults, 'aOptions:', aOptions);
			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}
	
	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}

function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions