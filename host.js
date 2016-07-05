/* globals core.addon.id, Services.wm, Services.scriptloader, core.addon.cache_key, core.addon.path.scripts, core.addon.cache_key */
/* requires a directory in core.addon.path.scripts called 3rd which should contain react-with-addons.js and react-dom.js */
/* requires directory in core.addon.path.scripts called react-mozNotificationBar - it should be the imported submodule */

// start - AttentionBar mixin
var AB = { // AB stands for attention bar
	// based on https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/notificationbox#Methods && https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/notification.xml#79
	Insts: {
		/*
		##: {
			state: avail in bootstrap only. the dom does a JSON.parse(JSON.stringify()) on this when updating from it
			setState: avail only in dom, its the react connection to it
			callbackids: {}, only in bootstrap, used for help cleaning up on destroy. key is id of callback, value is meaningless
		}
		*/
	}, // holds all instances
	domIdPrefix: core.addon.id.replace(/[^a-z0-9-_\:\.]/ig,'AB'), // The ID and NAME elements must start with a letter i.e. upper case A to Z or lower case a to z; a number is not allowed. After the first letter any number of letters (a to z, A to Z), digits (0 to 9), hyphens (-), underscores (_), colons (:) and periods (.) are allowed. // http://www.electrictoolbox.com/valid-characters-html-id-attribute/
	Callbacks: {},
	// key is nid, if nid is of a notification then the callback is a close callback, else it is of a click callback.
	// all Callbacks have last arg of aBrowser which is the xul browser element that was focused when user triggered the cb
	// click callbacks have first arg doClose, you should call doClose(aBrowser) if you want to close out the AB
	// callbacks this is bound to useful stuff. all are passed by reference so modifying that modfieis the entry in AB.Insts
		// for example clicking a menu item:
			// this: Object { inststate: Object, btn: Object, menu: Array[2], menuitem: Object } bootstrap.js:501
		// clicking btn, inst will have inststate and btn
		// closing this has inststate only
	nid: -1, // stands for next_id, used for main toolbar, and also for each button, and also each menu item
	/*
	{
		id: genned id, each id gets its own container in aDOMWindow
		desc: aDesc,
		comp: stands for react component, this gets rendered
	}
	*/
	setStateDestroy: function(aInstId) {
		// destroys, and cleans up, this does not worry about callbacks. the nonDevUserSpecifiedCloseCb actually calls this

		// unmount from all windows dom && delete from all windows js
		var doit = function(aDOMWindow) {
			// start - copy block link77728110
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}
			var winAB = aDOMWindow[core.addon.id + '-AB'];
			if (winAB) {
				if (aInstId in winAB.Insts) {
					// unmount this
					console.error('aInstId:', aInstId, 'notificationbox-' + aInstId + '--' + AB.domIdPrefix);
					var cNotificationBox = aDOMWindow.document.getElementById('notificationbox-' + aInstId + '--' + AB.domIdPrefix);
					aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
					cNotificationBox.parentNode.removeChild(cNotificationBox);
					delete winAB.Insts[aInstId];
				}
			}
			// end - copy block link77728110
		};

		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				doit(aDOMWindow);
			}//  else { // not complete means its impossible it has this aInstId mounted in here
				// // aDOMWindow.addEventListener('load', function () {
				// // 	aDOMWindow.removeEventListener('load', arguments.callee, false);
				// // 	doit(aDOMWindow);
				// // }, false);
			//}
		}

		// delete callbacks
		for (var aCallbackId in AB.Insts[aInstId].callbackids) {
			delete AB.Callbacks[aCallbackId];
		}

		// delete from bootstrap js
		delete AB.Insts[aInstId];
	},
	setState: function(aInstState) { // :note: aInstState is really aInstStateState
		// this function will add to aInstState and all bts in aInstState.aBtns a id based on this.genId()
		// this function also sends setState message to all windows to update this instances
		// aInstState should be strings only, as it is sent to all windows

		// :note: to remove a callback you have to set it to an empty function - ```getScope().AB.Insts[0].state.aClose = function() {}; getScope().AB.setState(getScope().AB.Insts[0].state);```

		// RETURNS
			// updated aInstState


		var cInstDefaults = {
			// aId: this is auto added in
			aTxt: '', // this is the message body on the toolbar
			aPos: 0, // 1 for top, on where to append it
			aIcon: 'chrome://mozapps/skin/places/defaultFavicon.png', // icon on the toolbar
			aPriority: 1, // valid values 1-10
			aBtns: [], // must be array
			aHideClose: undefined, // if set to string 'true' or bool true, in dom it will get converted to string as 'true'. setting to 1 int will not work.
			aClose: undefined
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

		if (!('aId' in aInstState)) {
			Object.assign(cInstDefaults, aInstState);
			aInstState.aId = AB.genId();
			AB.Insts[aInstState.aId] = {
				state: aInstState,
				callbackids: {}
			};
			AB.Callbacks[aInstState.aId] = function(aBrowser) {
				AB.nonDevUserSpecifiedCloseCb(aInstState.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
			};
			AB.Insts[aInstState.aId].callbackids[aInstState.aId] = 1; // the close callback id
		}
		if (aInstState.aClose) {
			var aClose = aInstState.aClose.bind({inststate:aInstState});
			delete aInstState.aClose;

			AB.Callbacks[aInstState.aId] = function(aBrowser) {
				var rez_aClose = aClose(aBrowser);
				if (rez_aClose !== false) { // :note: if onClose returns false, it cancels the closing
					AB.nonDevUserSpecifiedCloseCb(aInstState.aId, aBrowser); // this one doesnt need bind, only devuser callbacks are bound
				}
			};

		}

		// give any newly added btns and menu items an id
		if (aInstState.aBtns) {
			for (var i=0; i<aInstState.aBtns.length; i++) {
				if (!('bId' in aInstState.aBtns[i])) {
					aInstState.aBtns[i].bId = AB.genId();
				}
				if (aInstState.aBtns[i].bClick) { // i dont do this only if bId is not there, because devuser can change it up. i detect change by presenence of the bClick, because after i move it out of state obj and into callbacks obj, i delete it from state obj. so its not here unless changed
					AB.Insts[aInstState.aId].callbackids[aInstState.aBtns[i].bId] = 1; // its ok if it was already there, its the same one ill be removing
					AB.Callbacks[aInstState.aBtns[i].bId] = aInstState.aBtns[i].bClick.bind({inststate:aInstState, btn:aInstState.aBtns[i]}, AB.Callbacks[aInstState.aId]);
					delete aInstState.aBtns[i].bClick; // AB.Callbacks[aInstState.aId] is the doClose callback devuser should call if they want it to close out
				}
				if (aInstState.aBtns[i].bMenu) {
					AB.iterMenuForIdAndCbs(aInstState.aBtns[i].bMenu, aInstState.aId, aInstState.aBtns[i]);
				}
			}
		}

		// go through all windows, if this id is not in it, then mount it, if its there then setState on it

		var doit = function(aDOMWindow) {
			// start - orig block link181888888
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}
			AB.ensureInitedIntoWindow(aDOMWindow);

			if (aInstState.aId in aDOMWindow[core.addon.id + '-AB'].Insts) {
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].setState(JSON.parse(JSON.stringify(aInstState)));
			} else {
				// mount it
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId] = {};
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
				var cDeck = aDOMWindow.document.getElementById('content-deck');
				var cNotificationBox = aDOMWindow.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
				console.error('inserting', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
				cNotificationBox.setAttribute('id', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
				if (!aInstState.aPos) {
					cDeck.parentNode.appendChild(cNotificationBox);
				} else {
					cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
				}
				aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement = aDOMWindow.React.createElement(aDOMWindow[core.addon.id + '-AB'].masterComponents.Notification, aInstState);
				aDOMWindow.ReactDOM.render(aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement, cNotificationBox);
			}
			// end - orig block link181888888
		};

		// have to do this, because if i call setState with a new object, one that is not AB.Insts[aId] then it wont get updated, and when loadInstancesIntoWindow it will not have the updated one
		AB.Insts[aInstState.aId].state = aInstState;

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

		return aInstState;
	},
	nonDevUserSpecifiedCloseCb: function(aInstId, aBrowser) {
		// this does the unmounting from all windows, and deletes entry from this.Insts

		// aBrowser.contentWindow.alert('ok this tab sent the close message for aInstId ' + aInstId);
		// on close go through and get all id's in there and remove all callbacks for it. and then unmount from all windows.
		AB.setStateDestroy(aInstId, true);
	},
	genId: function() {
		AB.nid++;
		return AB.nid;
	},
	iterMenuForIdAndCbs: function(jMenu, aCloseCallbackId, aBtnEntry) {
		// aCloseCallbackId is same as aInstId
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
				AB.Insts[aCloseCallbackId].callbackids[jEntry.cId] = 1; // its ok if it was already there, its the same one ill be removing
				AB.Callbacks[jEntry.cId] = jEntry.cClick.bind({inststate:AB.Insts[aCloseCallbackId].state, btn:aBtnEntry, menu:jMenu, menuitem:jEntry}, AB.Callbacks[aCloseCallbackId]);
				delete jEntry.cClick; // AB.Callbacks[aInst.aId] is the doClose callback devuser should call if they want it to close out
			}
		});
	},
	uninitFromWindow: function(aDOMWindow) {
		if (!aDOMWindow[core.addon.id + '-AB']) {
			return;
		}
		console.error('doing uninit from window');
		// start - original block link77728110
		var winAB = aDOMWindow[core.addon.id + '-AB'];
		for (var aInstsId in winAB.Insts) {
			// unmount this
			console.error('aInstsId:', aInstsId, 'notificationbox-' + aInstsId + '--' + AB.domIdPrefix);
			var cNotificationBox = aDOMWindow.document.getElementById('notificationbox-' + aInstsId + '--' + AB.domIdPrefix);
			aDOMWindow.ReactDOM.unmountComponentAtNode(cNotificationBox);
			cNotificationBox.parentNode.removeChild(cNotificationBox);
		}
		// end - original block link77728110
		delete aDOMWindow[core.addon.id + '-AB'];
		console.error('done uninit');
		aDOMWindow.removeEventListener(core.addon.id + '-AB', AB.msgEventListener, false);
	},
	ensureInitedIntoWindow: function(aDOMWindow) {
		// dont run this yoruself, ensureInstancesToWindow runs this. so if you want to run yourself, then run ensureInstancesToWindow(aDOMWindow)
		if (!aDOMWindow[core.addon.id + '-AB']) {
			aDOMWindow[core.addon.id + '-AB'] = {
				Insts: {},
				domIdPrefix: AB.domIdPrefix
			}; // ab stands for attention bar
			if (!aDOMWindow.React) {
				console.log('WILL NOW LOAD IN REACT');
				// resource://devtools/client/shared/vendor/react.js
				Services.scriptloader.loadSubScript(core.addon.path.scripts + '3rd/react-with-addons.js?' + core.addon.cache_key, aDOMWindow); // even if i load it into aDOMWindow.blah and .blah is an object, it goes into global, so i just do aDOMWindow now
			}
			if (!aDOMWindow.ReactDOM) {
				console.log('WILL NOW LOAD IN REACTDOM');
				// resource://devtools/client/shared/vendor/react-dom.js
				Services.scriptloader.loadSubScript(core.addon.path.scripts + '3rd/react-dom.js?' + core.addon.cache_key, aDOMWindow);
			}
			Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-mozNotificationBar/client.js?' + core.addon.cache_key, aDOMWindow);
			aDOMWindow.addEventListener(core.addon.id + '-AB', AB.msgEventListener, false);
		}
	},
	init: function() {
		// Services.mm.addMessageListener(core.addon.id + '-AB', AB.msgListener);

		Services.wm.addListener(AB.winListener);

		// i dont iterate all windows now and do ensureInitedIntoWindow, because i only run ensureInitedIntoWindow when there is something to add, so its lazy

		// and its impossible that Insts exists before Init, so no need to iterate through all windows.
	},
	uninit: function() {
		// Services.mm.removeMessageListener(core.addon.id + '-AB', AB.msgListener);
		// trigger close of any open bars
		for (var aId in AB.Insts) {
			AB.Callbacks[aId]();
		}

		Services.wm.removeListener(AB.winListener);

		// go through all windows and unmount
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow[core.addon.id + '-AB']) {
				AB.uninitFromWindow(aDOMWindow);
			}
		}
	},
	msgEventListener: function(e) {
		console.error('getting aMsgEvent, data:', e.detail);
		var cCallbackId = e.detail.cbid;
		var cBrowser = e.detail.browser;
		if (AB.Callbacks[cCallbackId]) { // need this check because react components always send message on click, but it may not have a callback
			AB.Callbacks[cCallbackId](cBrowser);
		}
	},
	// msgListener: {
	// 	receiveMessage: function(aMsgEvent) {
	// 		var aMsgEventData = aMsgEvent.data;
	// 		console.error('getting aMsgEvent, data:', aMsgEventData);
	// 		// this means trigger a callback with id aMsgEventData
	// 		var cCallbackId = aMsgEventData;
	// 		var cBrowser = aMsgEvent.target;
	// 		if (AB.Callbacks[cCallbackId]) { // need this check because react components always send message on click, but it may not have a callback
	// 			AB.Callbacks[cCallbackId](cBrowser);
	// 		}
	// 	}
	// },
	loadInstancesIntoWindow: function(aDOMWindow) {
		// this function is called when there may be instances in AB.Insts but and it needs to be verified that its mounted in window
		// basically this is called when a new window is opened

		var idsInsts = Object.keys(AB.Insts);
		if (!idsInsts.length) {
			return;
		}

		var doit = function(aDOMWindow) {
			// check again, in case by the time window loaded, AB.Insts changed
			var idsInsts = Object.keys(AB.Insts);
			if (!idsInsts.length) {
				return;
			}

			// start - copy of block link181888888
			if (!aDOMWindow.gBrowser) {
				return; // because i am targeting cDeck, windows without gBrowser won't have it
			}

			AB.ensureInitedIntoWindow(aDOMWindow);

			for (var aInstId in AB.Insts) {
				var aInstState = AB.Insts[aInstId].state;
				if (aInstState.aId in aDOMWindow[core.addon.id + '-AB'].Insts) {
					console.error('this is really weird, it should never happen, as i only call this function when a new window opens');
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].setState(JSON.parse(JSON.stringify(aInstState)));
				} else {
					// mount it
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId] = {};
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].state = aDOMWindow.JSON.parse(aDOMWindow.JSON.stringify(aInstState));
					var cDeck = aDOMWindow.document.getElementById('content-deck');
					var cNotificationBox = aDOMWindow.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'notificationbox');
					console.error('inserting', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
					cNotificationBox.setAttribute('id', 'notificationbox-' + aInstState.aId + '--' + AB.domIdPrefix);
					if (!aInstState.aPos) {
						cDeck.parentNode.appendChild(cNotificationBox);
					} else {
						cDeck.parentNode.insertBefore(cNotificationBox, cDeck); // for top
					}
					aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement = aDOMWindow.React.createElement(aDOMWindow[core.addon.id + '-AB'].masterComponents.Notification, aInstState);
					aDOMWindow.ReactDOM.render(aDOMWindow[core.addon.id + '-AB'].Insts[aInstState.aId].relement, cNotificationBox);
				}
				// end - copy of block link181888888
			}
		};


		if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
			doit(aDOMWindow);
		} else {
			aDOMWindow.addEventListener('load', function () {
				aDOMWindow.removeEventListener('load', arguments.callee, false);
				doit(aDOMWindow);
			}, false);
		}

	},
	winListener: {
		onOpenWindow: function (aXULWindow) {
			// Wait for the window to finish loading
			var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
			aDOMWindow.addEventListener('load', function () {
				aDOMWindow.removeEventListener('load', arguments.callee, false);
				AB.loadInstancesIntoWindow(aDOMWindow);
			}, false);
		},
		onCloseWindow: function (aXULWindow) {},
		onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	}
};
// end - AttentionBar mixin
