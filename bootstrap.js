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
var RC = {}; // holds my react components
var RE = {}; // holds my react elements

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'as', function () { return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });

// START - Addon Functionalities

var AB = { // AB stands for attention bar
	inst: [], // holds all instances
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
	add: function(aDesc, aTxt, aOptions) {
		// RETURNS
			// id of tb made
		// aDesc stands for description. it would be something like "twitter" or soething
		// aTxt is a string
		// aOptions
		/*
		{
			// aScope: 'window' or 'tab' // not yet supported, it is just window level right now
			aPos: 'top' or 'bottom' - placement of bar. short for position
			aIcon: string to image path, it is the main icon
			aBtns: array of objects
			[
				{
					// bId - this is auto generated and stuck in here, with this.nid
					bIcon: optional, string to image path
					bTxt: required, text shown on button
					bClick: function.,
					bKey: 'B', // access key
				},
				{
					...
				}
			]
		}
		*/
		
		var cOptionsDefaults = {
			aPos: 'bottom',
			aIcon: '',
			aBtns: undefined,
			aPriority: 1
		};
		
		var cInst = {};
		
		var cBarId = this.genId();
		
		if (aOptions.aBtns) {
			for (var i=0; i<aOptions.aBtns.length; i++) {
				aOptions.aBtns[i].bId = this.genId();
			}
		}
		
		cInst.comp = React.createElement(this.masterComponents.Bar, {
			pId: cBarId,
			pTxt: aTxt,
			pPriority: aOptions.aPriority,
			pIcon: aOptions.aIcon,
			pBtns: aOptions.aBtns
		});
		
		this.inst.push(cInst);
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
			instIdsInBootstrap.push(this.inst[i].id);
		}
		
		// get all ids of instances in bootstrap
		var instIdsInWindow = [];
		for (var i=0; i<winAB.inst.length; i++) {
			instIdsInWindow.push(winAB.inst[i].id);
		}

		// check if need to unmount
		for (var i=0; i<instIdsInWindow.length; i++) {
			// this id is in the window
			if (instIdsInBootstrap.indexOf(instIdsInWindow[i]) == -1) {
				// this id is not in bootstrap
				// unmount this
				var cNotificationBox = aDOMWindow.document.getElementById(this.domIdPrefix + '-notificationbox-' + instIdsInWindow[i]);
				aDOMWindow.AB.ReactDOM.unmountComponentAtNode(cNotificationBox);
				cNotificationBox.parentNode.removeChild(cNotificationBox);
			}
		}
		
		// check if need to mount
		for (var i=0; i<instIdsInBootstrap.length; i++) {
			// this id is in the bootstrap
			if (instIdsInWindow.indexOf(instIdsInBootstrap[i]) == -1) {
				// this id is not in window
				// mount this
				var cNotificationBox = aDOMWindow.document.getElementById(this.domIdPrefix + '-notificationbox-' + instIdsInWindow[i]);
				aDOMWindow.AB.ReactDOM.render(this.inst[i].comp, cNotificationBox); // :note: comp must be value holding React.createElement(AB.masterComponents.Bar, {})
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
				aDOMWindow.AB.ReactDOM.unmountComponentAtNode(cNotificationBox);
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
		aDOMWindow[core.addon.id].AB = {
			inst: []
		}; // ab stands for attention bar
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js', aDOMWindow.AB);
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js', aDOMWindow.AB);
	},
	initIntoBootstrap: function(aBootstrap) {
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js', aBootstrap);
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js', aBootstrap);
		this.initMasterComponents();
	},
	masterComponents: {},
	initMasterComponents: function() {
		this.masterComponents = {
			Deck: 'notificationbox', // not a react component, just append this before inserting react component into it
			Notification: React.createClass({
				displayName: 'Notification',
				getInitialState: function() {
					return {
						sPriority: 1, // possible values 1-10. 10 being most critical. 1 being lowest.
						sTxt: this.props.pTxt,
						sIcon: this.props.pIcon,
						sBtns: this.props.pBtns
					}
				},
				render: function() {
					
					// incoming props
					//	pPriority
					//	pTxt
					//	pIcon
					//	pId - i dont do anything with this yet
					//	pBtns
					
					var barProps = {
						pPriority: this.state.sPriority,
						// pType: // this is set below
						pTxt: this.state.sTxt,
						pIcon: this.state.sIcon,
					};
					
					if (this.state.sPriority <= 3) {
						barProps.pType = 'info';
					} else if (this.state.sPriority <= 6) {
						barProps.pType = 'warning';
					} else if (this.state.sPriority <= 10) {
						barProps.pType = 'critical';
					} else {
						throw new Error('Invalid notification priority');
					}
					
					var barChildren;
					if (this.state.sBtns) {
						barChildren = [];
						for (var i=0; i<this.state.sBtns.length; i++) {
							var cBtnProps = {
								key: this.state.sBtns[i].bId,
								pKey: this.state.sBtns[i].bKey,
								pTxt: this.state.sBtns[i].bTxt,
							};
							barChildren.push(React.createElement(AB.masterComponents.Button, cBtnProps));
						}
					}
					return React.createElement(AB.masterComponents.Bar, barProps,
						barChildren
					);
				}
			}),
			Bar: React.createClass({
				displayName: 'Bar',
				componentDidMount: function() {
					this.shouldMirrorProps(this.props, true);
				},
				componentWillReceiveProps: function(aNextProps) {
					this.shouldMirrorProps(aNextProps);
				},
				customAttrs: { // works with this.shouldMirrorProps // these are properties that should be made into attributes on the element - key is the string as found in this.props and value is the attr it should be applied as
					pTxt: 'label',
					pType: 'type',
					pIcon: 'image',
					pPriority: 'priority'
				},
				shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
					var node = ReactDOM.findDOMNode(this);
					
					for (var nProp in aNextProps) {
						if (nProp in this.customAttrs) {
							if (aIsMount || this.props[nProp] !== aNextProps[nProp]) { // // i do aIsMount check, because on mount, old prop is same as new prop, becase i call in componentDidMount shouldMirrorProps(this.props)
								console.log(['setting custom attr "' + nProp + '"','old: ' + this.props[nProp], 'new: ' + aNextProps[nProp]].join('\n'));
								if (aNextProps[nProp] === null || aNextProps[nProp] === undefined) {
									node.removeAttribute(nProp);
								} else {
									node.setAttribute(nProp, aNextProps[nProp]);
								}
							}
						}
					}
				},
				render: function() {
					// incoming props
					//	pPriority
					//	pTxt
					//	pIcon
					//	pType
					return React.createElement('notificationbox', this.props);
				}
			}),
			Button: React.createClass({
				displayName: 'Button',
				componentDidMount: function() {
					this.shouldMirrorProps(this.props, true);
				},
				componentWillReceiveProps: function(aNextProps) {
					this.shouldMirrorProps(aNextProps);
				},
				customAttrs: { // works with this.shouldMirrorProps // these are properties that should be made into attributes on the element - key is the string as found in this.props and value is the attr it should be applied as
					pTxt: 'label',
					pKey: 'accesskey',
					pIcon: 'image'
				},
				shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
					var node = ReactDOM.findDOMNode(this);
					
					for (var nProp in aNextProps) {
						if (nProp in this.customAttrs) {
							if (aIsMount || this.props[nProp] !== aNextProps[nProp]) { // // i do aIsMount check, because on mount, old prop is same as new prop, becase i call in componentDidMount shouldMirrorProps(this.props)
								console.log(['setting custom attr "' + nProp + '"','old: ' + this.props[nProp], 'new: ' + aNextProps[nProp]].join('\n'));
								if (aNextProps[nProp] === null || aNextProps[nProp] === undefined) {
									node.removeAttribute(nProp);
								} else {
									node.setAttribute(nProp, aNextProps[nProp]);
								}
							}
						}
					}
				},
				render: function() {
					// incoming properties
					//	pTxt
					//	pKey - optional
					//	pIcon - optional
					
					// var cAccesskey = this.props.pKey ? this.props.pKey : undefined;
					// var cImage = this.props.pIcon ? this.props.pIcon : undefined;
					
					return React.createElement('button', {
						className: 'notification-button notification-button-default',
						// label: this.props.pTxt, // set by shouldMirrorPropsAsAttr
						// accesskey: cAccesskey,
						// image: cImage
					});
				}
			})
		};
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

	AB.initIntoBootstrap(BOOTSTRAP);
	
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

// end - common helper functions