window['react-mozNotificationBar@jetpack'].AB.masterComponents = {
	Deck: 'notificationbox', // not a react component, just append this before inserting react component into it
	Notification: React.createClass({
		displayName: 'Notification',
		componentDidMount: function() {
			console.error('ok mounted'); // for some reason this doesnt trigger
		},
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
			//	pId - used in componentDidMount
			//	pBtns
			console.error('in render!!!');
			if (!this.initedInst) {
				// window[core.addon.id].AB.inst[this.props.pId].setState = this.setState.bind(this);
				this.initedInst = true;
			}
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
			pIcon: 'image',
			pPriority: 'priority'
		},
		shouldMirrorProps: function(aNextProps, aIsMount) { // works with this.customAttrs
			return; // becuased modded HTMLDOMPropertyConfig.Properties
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
			var cProps = merge_options(this.props, {});
			return React.createElement('notification', {label:this.props.pTxt, priority:this.props.pPriority, type:this.props.pType, image:this.props.pIcon});
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
			return; // becuased modded HTMLDOMPropertyConfig.Properties
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
			
			var cAccesskey = this.props.pKey ? this.props.pKey : undefined;
			var cImage = this.props.pIcon ? this.props.pIcon : undefined;
			
			return React.createElement('button', {
				className: 'notification-button notification-button-default',
				label: this.props.pTxt,
				accessKey: cAccesskey,
				image: cImage
			});
		}
	})
};