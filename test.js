//TODO: finish this (merge all, use it for registered modules too, make sure that module names don't repeat)

/**
 * var GrandParent = new Sandbox('Granny'),
 * {
 *      name: 'Granny',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: null,
 *      _kids: [],
 *      _listeners: {}
 * }
 *     Father = GrandParent.kid('Father'),
 * {
 *      name: 'Father',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: GrandParent,
 *      _kids: [], //GrandParent.kids[Father]
 *      _listeners: {}
 * }
 *     Mother = GrandParent.kid('Mother'),
 * {
 *      name: 'Mother',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: GrandParent,
 *      _kids: [], //GrandParent.kids[Father, Mother]
 *      _listeners: {}
 * }
 *     Son = Father.kid('Son'),
 * {
 *      name: 'Mother',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: GrandParent,
 *      _kids: [], //GrandParent.kids[Father, Mother]
 *      _listeners: {}
 * }
 *     Daughter = Father.kid('Daughter');
 * {
 *      name: 'Daughter',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: Father,
 *      _kids: [], //Father.kids[Daughter]
 *      _listeners: {}
 * }
 *
 * GrandParent.on('someEvent', function (data) {'...'}); //listen for event
 * {
 *      name: 'Granny',
 *      _settings: {cache: true},
 *      _cache: [],
 *      _permissions: [],
 *      _parent: null,
 *      _kids: [],
 *      _listeners: {
 *          someEvent: [function]
 *      }
 * }
 * Sandbox.prototype.on = function (event, callback) { //add callback to self and check if there is a cached data in self and parent, if so call listeners
 *      var listeners = this._listeners[event] = this._listeners[event] || [],
 *          parentListeners = this._parent.listeners[event] || [],
 *          kidsListeners = _.map(this._parent._kids, function (kid) {
 *              return kid.listeners[event] || [];
 *          }),
 *          allListeners = _.union(listeners, parentListeners, kidsListeners);
 *      listeners.push(callback);
 *      function processFromCache(cache) {
 *          return _.some(allListeners, function (fn) {
 *              fn(cache.data);
 *              return true;
 *          });
 *      }
 *      if (this._settings.cache) {
 *          _.remove(_.where(this._cache, {target: this.name}), processFromCache);
 *          _.remove(_.where((this.parent || {}).cache, {target: this.name}), processFromCache);
 *      }
 * }
 *
 * GrandParent.emit('someEvent', 'GrandParent.on will get that');
 * Sandbox.prototype.emit = function (event, data) { //save to self and parent cache and call events for data from parent and self cache
 *      var listeners = this._listeners[event],
 *          cache = this._cache,
 *          permissions = this._parent._permissions;
 *      _.each(_.where(permissions, {event: event, source: this.name}), function (permission) { //save in parents cache if have permissions
 *          (this.parent || {}).cache.push({
 *              target: permission.target,
 *              source: this.name,
 *              event: event,
 *              data: data
 *          });
 *      });
 *      if (this._settings.cache) {
 *          cache.push({ //save in local cache
 *              source: this.name,
 *              target: this.name,
 *              event: event,
 *              data: data
 *          });
 *      }
 *
 *      function processFromCache(cache) {
 *          return _.some(listeners, function (fn) {
 *              fn(cache.data);
 *              return true;
 *          });
 *      }
 *      _.remove(_.where(this._cache, {target: this.name}), processFromCache);
 *      _.remove(_.where((this.parent || {}).cache, {target: this.name}), processFromCache);
 * }
 * GrandParent.off('someEvent');
 * Sandbox.prototype.off = function (event) {
 *      delete this._listeners[event];
 * }
 *
 * GrandParent.emit('someOtherEvent', 'this might (based on cache settings) be passed to GrandParent when it\'ll start to listen');
 * GrandParent.on('someOtherEvent', function (data) {'...'}); //will receive notification right away if data was cached and upon next notification call
 *
 * Father.on('someOtherEvent', function (data) {'...'});
 * Mother.on('someOtherEvent', function (data) {'...'});
 * GrandParent.emit('someOtherEvent', 'Father and Mother will not get this data, but GrandParent will');
 * Father.emit('someOtherEvent', 'GrandParent and Mother will not get this data, but Father will');
 *
 * Father.emit('someOtherEvent', 'GrandParent will not get this data (yet), but Father will');
 * GrandParent.grant({Father: ['someOtherEvent']}); //subscribe GrandParent to receive Father['someOtherEvent'] notifications
 * Father.emit('someOtherEvent', 'GrandParent will get that message from Father');
 * GrandParent.emit('someOtherEvent', 'only GrandParent will get that message, because Father wasn\'t subscribed to get messages from GrandParent');
 * GrandParent
 *     .grant('Father', {GrandParent: ['someOtherEvent']})
 *     .grant('Mother', {GrandParent: ['someOtherEvent']})
 *     //or GrandParent.grant(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
 *     .emit('someOtherEvent', 'GrandParent, Father and Mother will get that notification from GrandParent');
 * GrandParent
 *     .off('someOtherEvent')
 *     .reject('Father', {GrandParent: ['someOtherEvent']})
 *     .reject('Mother', {GrandParent: ['someOtherEvent']})
 *     //or GrandParent.reject(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
 *     .emit('someOtherEvent', 'no one will get that message');
 *
 * Son.emit('yetAnotherEvent', 'who do you think will get that message');
 * Daughter.emit('yetAnotherEvent', 'and who do you think will get that message');
 * Father
 *     .grant({Son: ['yetAnotherEvent'], Daughter: ['yetAnotherEvent']})
 *     //or Father.grant(['Son', 'Daughter'], {Father: ['yetAnotherEvent']})
 *     .grant('Daughter', {Son: ['yetAnotherEvent'], Father: ['feedBackEvent']})
 *     .grant('Son', {Daughter: ['yetAnotherEvent'], Father: ['feedBackEvent']});
 * Father.on('yetAnotherEvent', function (data) {
 *     var kid = 'Son';
 *     if (/^who/.test(data)) {
 *         kid = 'Daughter';
 *     }
 *     Father.emit('feedBackEvent', 'Thank you ' + kid);
 * });
 * Son.on('feedBackEvent', function (data) {'got feedback'});
 * Daughter.on('feedBackEvent', function (data) {'got feedback'});
 * Father.reject(['Daughter', 'Son'], {Father: ['feedBackEvent']});
 */

/**event names (any)
module names (unique) <- make sure they are unique
module permissions (specific to module and event)
subscriptions (depend on permissions)

when deleted - remove module name and target modules

/**
var m = Sandbox('Master');
{
    listeners: {
        event1: listeners[],
        event2: listeners[]
    },
    internalCache: {
    },
    permissions: [
    ]
},
var a = m.kid('A');
m.grant('B', {'A': ['bla']})
{
    listeners: {
        event1: listeners[],
        event2: listeners[]
    },
    cache: [{
        source: A,
        target: B,
        eventName: bla,
        storage: []
    }]
}
a.emit('bla', ['whoa']);
{
    listeners: {
        event1: listeners[],
        event2: listeners[]
    },
    cache: [{
        source: A,
        target: B,
        eventName: bla,
        storage: [['whoa']]
    }]
}
var b = m.kid('B');

b.listen('bla', function () {});
{
    listeners: {
        event1: listeners[],
        event2: listeners[]
    },
    cache: [{
        source: A,
        target: B,
        eventName: bla,
        storage: []
    }]
}
*/

//TODO: check case for from kid to kid
/**
 * @file Event driven Sandbox implementation with permission management for modular architecture
 * 1) sandbox can send and receive inside itself
 2) order of listeners and notifications doesn't matter, data should be cached and cache should be cleaned (with every delivered message or by timeout)
 3) sandbox manager can control who gets notifications from whom (allow/deny)
 4) sandbox can be destroyed to free resources
 * @author Sergey Zarouski, http://webuniverse.ca
 * @licence MIT
 * @example
 * var GrandParent = new Sandbox('Granny'),
 {
    //should have private parent and private kids

    settins: {
        cache: true
    },
    name: 'Granny',
    getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
    listeners: {
        event1: listeners[],
        event2: listeners[]
    },
    internalCache: {
    },
    permissions: [
    ]
}
 *     Father = GrandParent.kid('Father', {cache: true}),
 {
    settins: {
        cache: true
    },
   name: 'Father',
   getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Father', eventName: event)},
   listeners: {
       event1: listeners[],
       event2: listeners[]
   },
   internalCache: {
   },
   permissions: [
   ]
}
 *     Mother = GrandParent.kid('Mother'),
 {
    settins: {
        cache: true
    },
  name: 'Mother',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Mother', eventName: event)},
  listeners: {
      event1: listeners[],
      event2: listeners[]
  },
  internalCache: {
  },
   permissions: [
   ]
}
 *     Son = Father.kid('Son'),
 {
    settins: {
        cache: true
    },
 name: 'Son',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Son', eventName: event)},
 listeners: {
     event1: listeners[],
     event2: listeners[]
 },
 internalCache: {
 },
   permissions: [
   ]
}
 *     Daughter = Father.kid('Daughter');
 {
    settins: {
        cache: true
    },
name: 'Daughter',
getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Daughter', eventName: event)},
listeners: {
    event1: listeners[],
    event2: listeners[]
},
internalCache: {
},
   permissions: [
   ]
}
 *
 * GrandParent.on('someEvent', function (data) {'...'}); //listen for event
 {
    //on - creates [] in listeners and pushes handler
    settins: {
        cache: true
    },
    name: 'Granny',
    getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
    listeners: {
        someEvent: [function ()],
    },
    internalCache: {
    },
    permissions: [
    ]
}
 * GrandParent.emit('someEvent', 'GrandParent.on will get that');
 {
    //emit - checks listeners and invoke functions, if no event listeners and settings.cache == true, save {source: GrandParent,
        target: GrandParent,
        eventName: someEvent,
        storage: ['GrandParent.on will get that']} to cache

        //from kid to parent
        if (parent) {
        var permissions = _.where(parent.permissions, {source: this.name, target: parent.name, eventName: event});
        var hasListeners = _.size(parent.listeners.eventName);
        var canCache = parent.settings.cache;
        if (permissions.length) {
            if (hasListeners) -> call listeners for passed data and if _.size(permissions.cache) for each item from permissions.cache
            elseif (canCache) -> save to permissions.cache
        }
        }

        //from parent to kid
        if (_.size(kids)) {
        var that = this;
            _.each(kids, function (kid) {
                var permissions = _.where(parent.permissions, {source: this.name, target: kid.name, eventName: event});
                var hasListeners = _.size(parent.listeners.eventName);
                var canCache = parent.settings.cache;
                if (permissions.length) {
                    if (hasListeners) -> call listeners for passed data and if _.size(permissions.cache) for each item from permissions.cache
                    elseif (canCache) -> save to permissions.cache
                }
            })
        }
    settins: {
        cache: true
    },
    name: 'Granny',
    getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
    listeners: {
        someEvent: [function ()],
    },
    internalCache: {
    },
    permissions: [
    ]
}
 * GrandParent.off('someEvent');
 {
    //off - delete listeners.event
    settins: {
        cache: true
    },
    name: 'Granny',
    getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
    listeners: {
        someEvent: [function ()],
    },
    internalCache: {
    },
    permissions: [
    ]
}
 *
 * GrandParent.emit('someOtherEvent', 'this might (based on cache settings) be passed to GrandParent when it\'ll start to listen');
 {
   settins: {
       cache: true
   },
   name: 'Granny',
   getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
   listeners: {
       someEvent: [function ()],
   },
   internalCache: {
    someOtherEvent: ['this might (based on cache settings) be passed to GrandParent when it\'ll start to listen']
    },
   permissions: [
   ]
}
 * GrandParent.on('someOtherEvent', function (data) {'...'}); //will receive notification right away if data was cached and upon next notification call
 {
 //on - if _.size(this.internalCache.eventName) execute listener right away and delete this.internalCache.eventName

  settins: {
      cache: true
  },
  name: 'Granny',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
  listeners: {
      someEvent: [function ()],
      someOtherEvent: [function ()]
  },
  internalCache: {
  },
  permissions: [
  ]
}
 *
 * Father.on('someOtherEvent', function (data) {'...'});
 {
   settins: {
       cache: true
   },
  name: 'Father',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Father', eventName: event)},
  listeners: {
      someOtherEvent: [function() {}]
  },
  internalCache: {
  },
  permissions: [
  ]
}
 * Mother.on('someOtherEvent', function (data) {'...'});
 {
  settins: {
      cache: true
  },
 name: 'Mother',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Mother', eventName: event)},
 listeners: {
     someOtherEvent: [function() {}]
 },
 internalCache: {
  },
 permissions: [
 ]
}
 * GrandParent.emit('someOtherEvent', 'Father and Mother will not get this data, but GrandParent will');
 {
  settins: {
      cache: true
  },
  name: 'Granny',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
  listeners: {
      someEvent: [function ()],
      someOtherEvent: [function ()]
  },
  internalCache: {
  },
  permissions: [
  ]
}
 * Father.emit('someOtherEvent', 'GrandParent and Mother will not get this data, but Father will');
 {
   settins: {
       cache: true
   },
  name: 'Father',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Father', eventName: event)},
  listeners: {
      someOtherEvent: [function() {}]
  },
  internalCache: {
  },
  permissions: [
  ]
}
 * GrandParent.grant({Father: ['someOtherEvent']}); //subscribe GrandParent to receive Father['someOtherEvent'] notifications
 {
  settins: {
      cache: true
  },
  name: 'Granny',
  getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
  listeners: {
      someEvent: [function ()],
      someOtherEvent: [function ()]
  },
  internalCache: {
  },
  permissions: [{
  target: 'Granny',
  source: 'Father',
  eventName: 'someOtherEvent',
  cache: []
  }]
}
 * Father.emit('someOtherEvent', 'GrandParent will get that message from Father');

 * GrandParent.emit('someOtherEvent', 'only GrandParent will get that message, because Father wasn\'t subscribed to get messages from GrandParent');

 * GrandParent
 *     .grant('Father', {GrandParent: ['someOtherEvent']})
 *     .grant('Mother', {GrandParent: ['someOtherEvent']})
 *     //or GrandParent.grant(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
 {
 settins: {
     cache: true
 },
 name: 'Granny',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
 listeners: {
     someEvent: [function ()],
     someOtherEvent: [function ()]
 },
 internalCache: {
  },
 permissions: [{
 target: 'Granny',
 source: 'Father',
 eventName: 'someOtherEvent',
 cache: []
 }, {
 target: 'Father',
 source: 'Granny',
 eventName: 'someOtherEvent',
 cache: []
 }]
}
 *     .emit('someOtherEvent', 'GrandParent, Father and Mother will get that notification from GrandParent');
 * GrandParent
 *     .off('someOtherEvent')
 {
 //off remove listeners and _.remove(this.permissions, {target: this.name})
 settins: {
     cache: true
 },
 name: 'Granny',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
 listeners: {
     someEvent: [function ()],
 },
 internalCache: {
  },
 permissions: [{
 target: 'Father',
 source: 'Granny',
 eventName: 'someOtherEvent',
 cache: []
 }]
}
 *     .reject('Father', {GrandParent: ['someOtherEvent']})
 *     .reject('Mother', {GrandParent: ['someOtherEvent']})
 *     //or GrandParent.reject(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
 {
 settins: {
     cache: true
 },
 name: 'Granny',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
 listeners: {
     someEvent: [function ()],
 },
 internalCache: {
  },
 permissions: []
}
 *     .emit('someOtherEvent', 'no one will get that message');
 {
 settins: {
     cache: true
 },
 name: 'Granny',
 getCacheForEvent: function (event) {return _.where(parent.cache, target: 'Granny', eventName: event)},
 listeners: {
     someEvent: [function ()],
 },
 internalCache: {
    someOtherEvent: ['no one will get that message']
  },
 permissions: []
}
 * Son.emit('yetAnotherEvent', 'who do you think will get that message');
 * Daughter.emit('yetAnotherEvent', 'and who do you think will get that message');
 * Father
 *     .grant({Son: ['yetAnotherEvent'], Daughter: ['yetAnotherEvent']})
 *     //or Father.grant(['Son', 'Daughter'], {Father: ['yetAnotherEvent']})
 *     .grant('Daughter', {Son: ['yetAnotherEvent'], Father: ['feedBackEvent']})
 *     .grant('Son', {Daughter: ['yetAnotherEvent'], Father: ['feedBackEvent']});
 * Father.on('yetAnotherEvent', function (data) {
 *     var kid = 'Son';
 *     if (/^who/.test(data)) {
 *         kid = 'Daughter';
 *     }
 *     Father.emit('feedBackEvent', 'Thank you ' + kid);
 * });
 * Son.on('feedBackEvent', function (data) {'got feedback'});
 * Daughter.on('feedBackEvent', function (data) {'got feedback'});
 * Father.reject(['Daughter', 'Son'], {Father: ['feedBackEvent']});
 */

/*global _*/
(function () {
	'use strict';

    /**
     * @param {*} data
     * @returns {Function}
     */
    function getEqualComparator(data) {
        return _.partial(_.isEqual, data);
    }

    /**
     * @param {String} type
     * @param {*} data
     */
    function addToCollection(type, data) {
        //jshint validthis: true
        this[type].push(data);
    }

    /**
     * @param {String} type
     * @param {*} data
     */
    function removeFromCollection(type, data) {
        //jshint validthis: true
        this[type].splice(_.findIndex(this[type], getEqualComparator(data)), 1);
    }

    /**
     * @param {String} type
     */
    function clearCollection(type) {
        //jshint validthis: true
        this[type].length = 0;
    }

    function ModuleData() {
        this.cache = [];
        this.permissions = [];
        this.handlers = [];
    }
    ModuleData.prototype = {
        constructor: ModuleData,
        addCache: _.partial(addToCollection, 'cache'),
        removeCache: _.partial(removeFromCollection, 'cache'),
        clearCache: clearCollection('cache'),
        addPermissions: _.partial(addToCollection, 'permissions'),
        clearPermissions: clearCollection('cache'),
        removePermissions: _.partial(removeFromCollection, 'permissions'),
        addHandler: _.partial(addToCollection, 'handlers'),
        removeHandler: _.partial(removeFromCollection, 'handlers'),
        clearHandlers: clearCollection('cache')
    };

    function Event(event, name) {
        this.name = event;
        this.moduleData = new ModuleData();
    }

	/**
	 * Sandbox constructor, takes properties to extend an instance (not deeply)
	 * @class
	 * @param {{moduleName: String}|String} props
	 * @property {String} moduleName
	 */
	function Sandbox(props) {
		var cacheAndPermissions = {
			eventStorage: [],
			//would you like to see sandbox log in console?
			log: false,
			//would you like to store data in cache in case when you don't know if trigger will execute before subscription
			keepCachedEvents: false,
			//reference to parent sandbox
			parent: null
		};
		_.extend(this, props, {
			_internal: cacheAndPermissions
		});
	}
	Sandbox.prototype = {
		constructor: Sandbox,
		/**
		 * subscribe to event
		 * @param {String} event
		 * @param {function(this:Sandbox, *)} cb
		 * @param {Boolean} onlyFresh
		 */
		on: function (event, cb, onlyFresh) {
			var that = this,
			    internalData = that._internal,
			    parentInternalData = internalData.parent && internalData.parent._internal,
			    //if sandbox has a parent, than data should be stored in parent's internal data so that it can control permissions
			    resolvedInternalData = parentInternalData || internalData,
			    moduleName = that.moduleName,
			    shouldWeLog = internalData.log;
			//>>excludeStart("production", pragmas.production);
			console.assert(
				typeof event === 'string' && typeof cb === 'function',
				'event should be a string, cb should be a function, instead was: ',
				event,
				cb
			);
			//>>excludeEnd("production");

			//set event listener
			if (shouldWeLog) {
				console.log('\'' + moduleName + '\' is listening for \'' + event + '\'');
			}

			var fullEventName = event + '_' + moduleName;

			resolvedInternalData.eventSubscriptionsList.push({namespace: moduleName, event: event});
			if (!(fullEventName in resolvedInternalData.eventListeners)) {
				resolvedInternalData.eventListeners[fullEventName] = [];
			}
			resolvedInternalData.eventListeners[fullEventName].push(function () {
				if (shouldWeLog) {
					console.log('\'' + moduleName + '\' received \'' + event + '\' notification');
				}

				cb.apply(this, [].slice.call(arguments));
			});

			//check if event was already in the cache
			var eventDataSet;
			if (event in resolvedInternalData.eventCache) {
				//eventDataSet has following structure [[e, data1], [e, data2], ...]
				eventDataSet = resolvedInternalData.eventCache[event];
				//you would normally use each here, however remove will also iterate through collection
				//and based on app settings we can control if we want to store cache or clean it after handler
				_.remove(eventDataSet, function (dataEntry) {
					//iterate through cache for this particular event and check if event was for that particular module
					if (dataEntry.namespace === moduleName) { //TODO: we can potentially get rid of namespace and use type with fullEventName here
						//if so fire event
						if (!onlyFresh) {
							_.each(resolvedInternalData.eventListeners, function (callbacks, triggerEvent) {
								if (triggerEvent === fullEventName) {
									_.each(callbacks, function (callback) {
										callback(dataEntry.data, { //TODO: why event is second? should I flip that?
											type: dataEntry.type
										});
									});
								}
							});
						}
						if (!that.keepCachedEvents) {
							return true;
						}
					}
					return false;
				});
			}

			return that;
		},
		/**
		 * unsubscribe from event
		 * @param {String} event
		 */
		off: function (event) {},
		/**
		 * trigger event
		 * @param {String} event
		 * @param {*} data
		 */
		trigger: function (event, data) {
			var that = this,
			    /**
			     * @type _internal
			     */
			    internalData = that._internal,
			    /**
			     * @type {_internal|undefined}
			     */
			    parentInternalData = internalData.parent && internalData.parent._internal,
			    //if sandbox has a parent, than data should be stored in parent's internal data so that it can control permissions
			    /**
			     * @type _internal
			     */
			    resolvedInternalData = parentInternalData || internalData,
			    moduleName = that.moduleName,
			    shouldWeLog = internalData.log;
			//>>excludeStart("production", pragmas.production);
			console.assert(
				typeof event === 'string',
				'event should be a string, instead was: ',
				event
			);
			//>>excludeEnd("production");

			//check if event have permissions to be triggered/added to cache...
			_.each(resolvedInternalData.eventPermissions, function (emitterModulesRules, emitterModuleName) {
				//...if yes then...
				if (emitterModuleName === moduleName) {
					//...go through target modules rules and...
					_.each(emitterModulesRules, function (targetEventsMap, targetModuleName) {
						//...go through events map per target module and if event name is in allowed list...
						if (~_.indexOf(targetEventsMap, event) && ~_.indexOf(resolvedInternalData.registeredNames, targetModuleName)) {
							//...add events data to cache and trigger event
							addEventToCacheAndTrigger({
								moduleName: emitterModuleName,
								targetModuleName: targetModuleName,
								event: event,
								data: data,
								shouldWeLog: shouldWeLog
							});
						}
					});
				}
			});

			//trigger event for module itself
			addEventToCacheAndTrigger({
				moduleName: moduleName,
				targetModuleName: moduleName,
				event: event,
				data: data,
				shouldWeLog: shouldWeLog,
				_internal: resolvedInternalData
			});

			return that;
		},
		/**
		 * removes all associated data from sandbox
		 */
		destroy: function () {},
		/**
		 * grant some modules permissions to get one or multiple events from other modules
		 * @param {String|Array} [moduleName]
		 * @param {Object} eventsMap
		 */
		grant: function (moduleName, eventsMap) {}, //warn about unregistered
		/**
		 * reject permissions for some modules to get one or multiple events from other modules
		 * @param {Object} eventsMap
		 */
		reject: function (eventsMap) {},
		/**
		 * @class
		 * @param {{moduleName: String}|String} props
		 * @property {String} moduleName
		 * @returns Sandbox
		 */
		kid: function (props) {}
	};

	/**
	 * @type {Sandbox.prototype.trigger}
	 */
	Sandbox.prototype.emit = Sandbox.prototype.trigger;

	/**
	 * Sandbox error constructor
	 * @class SandboxError
	 * @param {String} message
	 * @extends Error
	 */
	function SandboxError(message) {
		this.message = message;
	}
	SandboxError.prototype = new Error();
	SandboxError.prototype.constructor = SandboxError;

	/**
	 * adds new event to internal cache and triggers event
	 * @param {Object} parameters
	 * @param {String} parameters.moduleName
	 * @param {String} parameters.targetModuleName
	 * @param {String} parameters.event
	 * @param {*} parameters.data
	 * @param {Boolean} parameters.shouldWeLog
	 * @param {_internal} parameters._internal
	 */
	function addEventToCacheAndTrigger(parameters) {
		var moduleName = parameters.moduleName,
			targetModuleName = parameters.targetModuleName,
			event = parameters.event,
			data = parameters.data,
			shouldWeLog = parameters.shouldWeLog,
			_internal = parameters._internal;
		if (shouldWeLog) {
			console.log('\'' + (moduleName) + '\' is sending \'' + event + '\' notification to \'' + targetModuleName + '\':', data);
		}

		var fullEventName = event + '_' + targetModuleName;

		if (!(event in _internal.eventCache)) {
			_internal.eventCache[event] = [];
		}

		//push new event to cache
		_internal.eventCache[event]
			.push({
				type: fullEventName,
				namespace: targetModuleName,
				data: data
			});

		_.each(_internal.eventListeners, function (callbacks, triggerEvent) {
			if (triggerEvent === fullEventName) {
				_.each(callbacks, function (callback) {
					callback(data, {
						type: fullEventName
					});
				});
			}
		});
	}
}());