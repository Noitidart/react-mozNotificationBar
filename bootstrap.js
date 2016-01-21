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

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });

// START - Addon Functionalities

var AB = { // AB stands for attention bar
	inst: {}, // holds all instances
	domIdPrefix: core.addon.id.replace(/[^a-z0-9-_\:\.]/ig,'a'), // The ID and NAME elements must start with a letter i.e. upper case A to Z or lower case a to z; a number is not allowed. After the first letter any number of letters (a to z, A to Z), digits (0 to 9), hyphens (-), underscores (_), colons (:) and periods (.) are allowed. // http://www.electrictoolbox.com/valid-characters-html-id-attribute/
	click_cbs: {}, // key is nid, and value is a function
	close_cbs: {}, // key is nid, and value is a function
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
		
		// RETURNS
			// id of inst pushed

		
		var cInstDefaults = {
			// aId: this is auto added in
			aTxt: '', // this is the message body on the toolbar
			aPos: 0, // 1 for top, on where to append it
			aIcon: 'chrome://mozapps/skin/places/defaultFavicon.png', // icon on the toolbar
			aPriority: 1,
			aBtns: [] // must be array
		};
		
		/*
		aBtns: array of objects
		[
			{
				// bId - this is auto generated and stuck in here, with this.nid
				bIcon: optional, string to image path
				bTxt: required, text shown on button
				bClick: function.,
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
		} else {
			aInst.aId = this.genId();
			this.inst.push(cInst);
		}
		
		// give any newly added btns and menu items an id
		if (aInst.aBtns) {
			for (var i=0; i<aInst.aBtns.length; i++) {
				if (!('bId' in aInst.aBtns[i])) {
					aInst.aBtns[i].bId = this.genId();
				}
				if (aInst.aBtns[i].bMenu) {
					for (var j=0; j<aInst.aBtns[i].bMenu.length; j++) {
						if (!('mId' in aInst.aBtns[i].bMenu[j])) {
							aInst.aBtns[i].bMenu[j].mId = this.genId();
						}
					}
				}
			}
		}
	},
	genId: function() {
		this.nid++;
		return this.nid;
	},
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
	uninitFromWindow: function(aDOMWindow) {
		if (!aDOMWindow[core.addon.id]) {
			return;
		}
		if (!aDOMWindow[core.addon.id].AB) {
			return;
		}
		var winAB = aDOMWindow[core.addon.id].AB;
		if (winAB.inst && winAB.inst.length) {
			for (var i=0; i<winAB.inst.length; i++) {
				// unmount this
				var cNotificationBox = aDOMWindow.document.getElementById(this.domIdPrefix + '-notificationbox-' + instIdsInWindow[i]);
				aDOMWindow[core.addon.id].AB.ReactDOM.unmountComponentAtNode(cNotificationBox);
				cNotificationBox.parentNode.removeChild(cNotificationBox);
			}
		}
		delete aDOMWindow[core.addon.id].AB;
		// :note: i cant delete aDOMWindow[core.addon.id] on unload because i dont know if others are using it
	},
	initIntoWindow: function(aDOMWindow) {
		// dont run this yoruself, ensureInstancesToWindow runs this. so if you want to run yourself, then run ensureInstancesToWindow(aDOMWindow)
		if (!aDOMWindow[core.addon.id]) {
			aDOMWindow[core.addon.id] = {}; // :note: i cant delete aDOMWindow[core.addon.id] on unload because i dont know if others are using it
		}
		if (!aDOMWindow[core.addon.id].AB) {
			aDOMWindow[core.addon.id].AB = {
				inst: []
			}; // ab stands for attention bar)
			if (!aDOMWindow.React) {
				console.error('WILL NOW LOAD IN REACT');
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js', aDOMWindow); // even if i load it into aDOMWindow.blah and .blah is an object, it goes into global, so i just do aDOMWindow now
			}
			if (!aDOMWindow.ReactDOM) {
				console.error('WILL NOW LOAD IN REACTDOM');
				Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js', aDOMWindow);
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
		
		AB.ensureInstancesToWindow(aDOMWindow);
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
	
	windowListener.register();
	console.log('started succesfully');
}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }

	AB.unload();
	
	windowListener.unregister();

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

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function merge_options(obj1,obj2){
	// http://stackoverflow.com/questions/171251/how-can-i-merge-properties-of-two-javascript-objects-dynamically
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}
// end - common helper functions