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
		
		this.nid++;
		var cId = this.nid;
		
		cInst.comp = React.createElement(this.masterComponents.Bar, {
			pId: cId,
			pTxt: aTxt,
			pPriority: aOptions.aPriority,
			pIcon: aOptions.aIcon,
			pBtns: aOptions.aBtns
		});
		
		this.inst.push(cInst);
	},
	getInst: function(aKey, aVal) {
		for (var i=0; i<this.inst.length; i++) {
			if (this.inst[i][aKey] && this.inst[i][aKey] == aVal) {
				return this.inst[i];
			}
		}
	},
	loadIntoWindow: function(aDOMWindow) {
		aDOMWindow[core.addon.id].AB = {}; // ab stands for attention bar components
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js', aDOMWindow.ABC);
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js', aDOMWindow.ABC);
	},
	loadIntoBootstrap: function(aBootstrap) {
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react.js', aBootstrap);
		Services.scriptloader.loadSubScript(core.addon.path.scripts + 'react-dom.js', aBootstrap);
	},
	unload: function() {
		// go through all DOMWindows and unmount react components
	},
	masterComponents: {
		Deck: 'notificationbox', // not a react component, just append this before inserting react component into it
		Bar: ReactReact.createClass({
			displayName: 'Bar',
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
				//	pLabel
				//	pIcon
				//	pId
				
				var barProps = {};
				
				// notif el needs priority attr
				barProps.priority = this.state.sPriority;
				
				// notif el needs type attr, based on priority attr
				if (this.state.sPriority <= 3) {
					barProps.type = 'info';
				} else if (this.state.sPriority <= 6) {
					barProps.type = 'warning';
				} else if (this.state.sPriority <= 10) {
					barProps.type = 'critical';
				} else {
					throw new Error('Invalid notification priority');
				}
				
				// notif el needs lael attr
				barProps.label = this.state.sTxt;
				
				// notif el needs image attr
				barProps.image = this.state.pIcon;
				
				// notif el needs value attr
				barProps.value = this.props.pId
				
				var barChildren = this.state.sBtns ? [] : undefined;
				if (barChildren) {
					for (var sBtn in this.state.sBtns) {
						barChildren.push(React.createElement(AB.masterComponents.Button, {
							pTxt: sBtn.bTxt,
							
						}));
					}
				}
				
				
				return React.createElement('notification', barProps,
					btns
				);
			}
		}),
		Button: React.createClass({
			displayName: 'Button',
			render: function() {
				// incoming properties
				//	pTxt
				//	pKey - optional
				//	pIcon - optional
				
				var cAccesskey = this.props.pKey ? this.props.pKey : undefined;
				var cImage = this.props.pIcon ? this.props.pIcon : undefined;
				
				return React.createElement('button', {
					className: 'notification-button notification-button-default',
					label: this.props.pTxt,
					accesskey: cAccesskey,
					image: cImage
				});
			}
		})
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
		
		aDOMWindow[core.addon.id] = {};
		AB.loadIntoWindow(aDOMWindow);
		
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }
		
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

	AB.loadIntoBootstrap(BOOTSTRAP);
	
	windowListener.register();
}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }

	AB.unload();
	
	windowListener.unregister();

}
// END - Addon Functionalities

// start - common helper functions

// end - common helper functions