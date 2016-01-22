window['react-mozNotificationBar@jetpack'].AB.id = 'react-mozNotificationBar@jetpack';
window['react-mozNotificationBar@jetpack'].AB.masterComponents = {
	Deck: 'notificationbox', // not a react component, just append this before inserting react component into it
	Notification: React.createClass({
		displayName: 'Notification',
		componentDidMount: function() {
			console.error('ok mounted'); // for some reason this doesnt trigger
			window['react-mozNotificationBar@jetpack'].AB.Insts[this.props.aId].setState = this.setState.bind(this);
		},
		getInitialState: function() {
			return {
				// matches cInstDefaults
				aId: this.props.aId,
				aTxt: this.props.aTxt,
				aPos: this.props.aPos,
				aIcon: this.props.aIcon,
				aPriority: this.props.aPriority,
				aBtns: this.props.aBtns,
				aId: this.props.aId
			}
		},
		render: function() {
			
			// incoming props
			// do not use props, use state

			var cBarProps = {
				pPriority: this.state.aPriority,
				// pType: // this is set below
				pTxt: this.state.aTxt,
				pIcon: this.state.aIcon,
			};
			
			if (this.state.aPriority <= 3) {
				cBarProps.pType = 'info';
			} else if (this.state.aPriority <= 6) {
				cBarProps.pType = 'warning';
			} else if (this.state.aPriority <= 10) {
				cBarProps.pType = 'critical';
			} else {
				throw new Error('Invalid notification priority');
			}
			
			cBarProps.pBtns = this.state.aBtns;
			cBarProps.pId = this.state.aId;
			
			return React.createElement(window['react-mozNotificationBar@jetpack'].AB.masterComponents.Bar, cBarProps);
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
			pIcon: 'image',
			pPriority: 'priority'
		},
		shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
			var node = ReactDOM.findDOMNode(this);
			console.log('node:', node);
			
			for (var nProp in aNextProps) {
				if (nProp in this.customAttrs) {
					if (aIsMount || this.props[nProp] !== aNextProps[nProp]) { // // i do aIsMount check, because on mount, old prop is same as new prop, becase i call in componentDidMount shouldMirrorProps(this.props)
						console.log(['setting custom attr "' + nProp + '"','old: ' + this.props[nProp], 'new: ' + aNextProps[nProp]].join('\n'));
						if (aNextProps[nProp] === null || aNextProps[nProp] === undefined) {
							node.removeAttribute(this.customAttrs[nProp]);
						} else {
							node.setAttribute(this.customAttrs[nProp], aNextProps[nProp]);
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
			//	pBtns
			//	pId - this is just how normally the notification bar happens, it sets the value to this
			var cChildren;
			if (this.props.pBtns && this.props.pBtns.length) {
				cChildren = [];
				for (var i=0; i<this.props.pBtns.length; i++) {
					var cButtonProps = {
						key: this.props.pBtns[i].bId,
						pId: this.props.pBtns[i].bId,
						pKey: this.props.pBtns[i].bKey,
						pTxt: this.props.pBtns[i].bTxt,
						pMenu: this.props.pBtns[i].bMenu,
						pIcon: this.props.pBtns[i].bIcon
					};
					cChildren.push(React.createElement(window['react-mozNotificationBar@jetpack'].AB.masterComponents.Button, cButtonProps));
				}
			}
			
			return React.createElement('notification', {label:this.props.pTxt, priority:this.props.pPriority, type:this.props.pType, image:this.props.pIcon, value:'notificationbox-' + this.props.pId + '--' + window['react-mozNotificationBar@jetpack'].AB.domIdPrefix},
				cChildren
			);
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
			pIcon: 'image'
		},
		shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
			var node = ReactDOM.findDOMNode(this);
			console.log('node:', node);
			for (var nProp in aNextProps) {
				if (nProp in this.customAttrs) {
					if (aIsMount || this.props[nProp] !== aNextProps[nProp]) { // // i do aIsMount check, because on mount, old prop is same as new prop, becase i call in componentDidMount shouldMirrorProps(this.props)
						console.log(['setting custom attr "' + nProp + '"','old: ' + this.props[nProp], 'new: ' + aNextProps[nProp]].join('\n'));
						if (aNextProps[nProp] === null || aNextProps[nProp] === undefined) {
							node.removeAttribute(this.customAttrs[nProp]);
						} else {
							node.setAttribute(this.customAttrs[nProp], aNextProps[nProp]);
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
			//	pMenu
			//	pId

			var cAccesskey = this.props.pKey ? this.props.pKey : undefined;
			var cImage = this.props.pIcon ? this.props.pIcon : undefined;
			
			var cProps = {
				className: 'notification-button notification-button-default',
				label: this.props.pTxt,
				accessKey: cAccesskey,
				image: cImage
			};
			var cChildren;			
			if (this.props.pMenu && this.props.pMenu.length) {
				cProps.type = 'menu';
				var cChildren = React.createElement(window['react-mozNotificationBar@jetpack'].AB.masterComponents.Menu, {pMenu:this.props.pMenu});
			}
			return React.createElement('button', cProps,
				cChildren
			);
		}
	}),
	Menu: React.createClass({
		displayName: 'Menu',
		render: function() {
			// incoming props
			//	pMenu - a array of menu items
			
			var cChildren = [];
			for (var i=0; i<this.props.pMenu.length; i++) {
				cChildren.push(React.createElement(window['react-mozNotificationBar@jetpack'].AB.masterComponents.MenuItem, this.props.pMenu[i]));
			}
			
			return React.createElement('menupopup', {},
				cChildren
			);
		}
	}),
	MenuItem: React.createClass({
		displayName: 'MenuItem',
		componentDidMount: function() {
			this.shouldMirrorProps(this.props, true);
		},
		componentWillReceiveProps: function(aNextProps) {
			this.shouldMirrorProps(aNextProps);
		},
		customAttrs: { // works with this.shouldMirrorProps // these are properties that should be made into attributes on the element - key is the string as found in this.props and value is the attr it should be applied as
			cIcon: 'image'
		},
		shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
			var node = ReactDOM.findDOMNode(this);
			console.log('node:', node);
			for (var nProp in aNextProps) {
				if (nProp in this.customAttrs) {
					if (aIsMount || this.props[nProp] !== aNextProps[nProp]) { // // i do aIsMount check, because on mount, old prop is same as new prop, becase i call in componentDidMount shouldMirrorProps(this.props)
						console.log(['setting custom attr "' + nProp + '"','old: ' + this.props[nProp], 'new: ' + aNextProps[nProp]].join('\n'));
						if (aNextProps[nProp] === null || aNextProps[nProp] === undefined) {
							node.removeAttribute(this.customAttrs[nProp]);
						} else {
							node.setAttribute(this.customAttrs[nProp], aNextProps[nProp]);
						}
					}
				}
			}
		},
		render: function() {
			// incoming props
			//	anything in a pMenu array like cMenu, cTxt, etc
			
			if (this.props.cMenu) {
				return React.createElement('menu', {label:this.props.cTxt},
					React.createElement(window['react-mozNotificationBar@jetpack'].AB.masterComponents.Menu, {pMenu:this.props.cMenu})
				);
			} else {
				return React.createElement('menuitem', {label:this.props.cTxt});
			}
		}
	})
};