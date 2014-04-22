/*global _*/
(function () {
	'use strict';

	function Sandbox(props) {
		var cacheAndPermissions = {
			//used for caching event data
			//structure: {event1: [{namespace: moduleSuffix, type: event1_moduleSuffix, data: mixed}, ...], ...}
			eventCache: {},
		    //store listeners related to events
		    //structure: {event1_moduleSuffix: [callback: function, ...], ...}
		    eventListeners: {},
		    //manager decides which events should be delivered to which modules
		    //permissions separation structure: {emitterModule1: {targetModule1: ['event1', 'event2', ...], ...}, ...}
		    eventPermissions: {},
		    //event subscription list used to track for which events sandbox was subscribed and
		    //unsubscribe from them upon module destruction
		    eventSubscriptionsList: [],
		    //registered names used to check which modules are currently registered
		    //in order to figure out if we need to send them messages
		    registeredNames: []
		};
		_.extend(this, props, {
			_internal: cacheAndPermissions
		});
	}
	Sandbox.prototype = {
		constructor: Sandbox,
		on: function (event, cb) {},
		off: function (event) {},
		trigger: function (event, data) {},
		destroy: function () {},
		/**
		 * @param {String|Array} [moduleName]
		 * @param {Object} eventsMap
		 */
		grant: function (moduleName, eventsMap) {}, //warn about unregistered
		reject: function (eventsMap) {},
		kid: function (props) {}
	};

	Sandbox.prototype.emit = Sandbox.prototype.trigger;

	var GrandParent = new Sandbox('Granny'),
	    Father = GrandParent.kid('Father'),
	    Mother = GrandParent.kid('Mother'),
	    Son = Father.kid('Son'),
	    Daughter = Father.kid('Daughter');

	GrandParent.on('someEvent', function (data) {/*...*/}); //listen for event
	GrandParent.emit('someEvent', 'GrandParent.on will get that');
	GrandParent.off('someEvent');

	GrandParent.emit('someOtherEvent', 'this might (based on cache settings) be passed to GrandParent when it\'ll start to listen');
	GrandParent.on('someOtherEvent', function (data) {/*...*/}); //will receive notification right away if data was cached and upon next notification call

	Father.on('someOtherEvent', function (data) {/*...*/});
	Mother.on('someOtherEvent', function (data) {/*...*/});
	GrandParent.emit('someOtherEvent', 'Father and Mother will not get this data, but GrandParent will');
	Father.emit('someOtherEvent', 'GrandParent and Mother will not get this data, but Father will');

	Father.emit('someOtherEvent', 'GrandParent will not get this data (yet), but Father will');
	GrandParent.grant({Father: ['someOtherEvent']}); //subscribe GrandParent to receive Father['someOtherEvent'] notifications
	Father.emit('someOtherEvent', 'GrandParent will get that message from Father');
	GrandParent.emit('someOtherEvent', 'only GrandParent will get that message, because Father wasn\'t subscribed to get messages from GrandParent');
	GrandParent
		.grant('Father', {GrandParent: ['someOtherEvent']})
		.grant('Mother', {GrandParent: ['someOtherEvent']})
		//or GrandParent.grant(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
		.emit('someOtherEvent', 'GrandParent, Father and Mother will get that notification from GrandParent');
	GrandParent
		.off('someOtherEvent')
		.reject('Father', {GrandParent: ['someOtherEvent']})
		.reject('Mother', {GrandParent: ['someOtherEvent']})
		//or GrandParent.reject(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
		.emit('someOtherEvent', 'no one will get that message');

	Son.emit('yetAnotherEvent', 'who do you think will get that message');
	Daughter.emit('yetAnotherEvent', 'and who do you think will get that message');
	Father
		.grant({Son: ['yetAnotherEvent'], Daughter: ['yetAnotherEvent']})
		//or Father.grant(['Son', 'Daughter'], {Father: ['yetAnotherEvent']})
		.grant('Daughter', {Son: ['yetAnotherEvent'], Father: ['feedBackEvent']})
		.grant('Son', {Daughter: ['yetAnotherEvent'], Father: ['feedBackEvent']});
	Father.on('yetAnotherEvent', function (data) {
		var kid = 'Son';
		if (/^who/.test(data)) {
			kid = 'Daughter';
		}
		Father.emit('feedBackEvent', 'Thank you ' + kid);
	});
	Son.on('feedBackEvent', function (data) {/*got feedback*/});
	Daughter.on('feedBackEvent', function (data) {/*got feedback*/});
	Father.reject(['Daughter', 'Son'], {Father: ['feedBackEvent']});
}());