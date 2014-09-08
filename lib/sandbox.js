/*global exports*/
//noinspection ThisExpressionReferencesGlobalObjectJS
/**
 * @file Event driven Sandbox implementation with permission management for modular architecture
 * 1) sandbox can send and receive inside itself
   2) order of listeners and notifications doesn't matter, data should be cached and cache should be cleaned
      (with every delivered message or by timeout)
   3) sandbox manager can control who gets notifications from whom (allow/deny)
   4) sandbox can be destroyed to free resources
 * @author serge.zarouski@gmail.com (Sergey Zarouski, http://webuniverse.ca)
 * @licence MIT
 * @example
 * var GrandParent = new Sandbox('Granny'),
 *     Father = GrandParent.kid('Father'),
 *     Mother = GrandParent.kid('Mother'),
 *     Son = Father.kid('Son'),
 *     Daughter = Father.kid('Daughter');
 *
 * GrandParent.on('someEvent', function (data) {'...'}); //listen for event
 * GrandParent.emit('someEvent', 'GrandParent.on will get that');
 * GrandParent.off('someEvent');
 *
 * GrandParent.emit('someOtherEvent', 'this might (based on cache settings) be passed to GrandParent when it\'ll
 * start to listen');
 * GrandParent.on('someOtherEvent', function (data) {'...'}); //will receive notification right away if data was cached
 * and upon next notification call
 *
 * Father.on('someOtherEvent', function (data) {'...'});
 * Mother.on('someOtherEvent', function (data) {'...'});
 * GrandParent.emit('someOtherEvent', 'Father and Mother will not get this data, but GrandParent will');
 * Father.emit('someOtherEvent', 'GrandParent and Mother will not get this data, but Father will');
 *
 * Father.emit('someOtherEvent', 'GrandParent will not get this data (yet), but Father will');
 * //subscribe GrandParent to receive Father['someOtherEvent'] notifications
 * GrandParent.grant({Father: ['someOtherEvent']});
 * Father.emit('someOtherEvent', 'GrandParent will get that message from Father');
 * GrandParent.emit('someOtherEvent', 'only GrandParent will get that message');
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

// Sandbox module provides access to specific settings which are set upon sandbox initialization.
// It also provides convenient way to publish/subscribe data between modules, with events data caching - something so
// important when you work with AMD.

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['exports', '_', 'simple-permissions'], factory);
    } else if (typeof exports === 'object') {
        //noinspection JSCheckFunctionSignatures
	    factory(exports, require('_', 'simple-permissions'));
    } else {
        factory((root.sandboxExports = {}), root._, root.permissionsExports);
    }
}(
	this,
    function initSandBox(
        /*Object*/exports,
        /*_.LoDashStatic*/_,
        /*PermissionsExports*/simplePermissions
	) {
        'use strict';
	    /**
	     * @name SandboxExports
	     * @type {{Sandbox: Sandbox}}
	     */

	    /**
	     * @param {String} [name] optional, but highly recommended if you use grant/revoke functionality
	     * @param {*} [data]
	     * @param {Object} [settings]
	     * @name Sandbox
	     */
	    function Sandbox(name, data, settings) {
		    var parent = getCurrentParent();
		    var parentData = InstanceData.get(parent);
		    var fallbackName = _.uniqueId('empty');
		    var childrenPrefix = '/' + _.uniqueId() + '/';
		    var prefix = createPrefix(parentData, name, fallbackName);

		    makeSureSiblingsNamesAreUnique(prefix, name);

		    var index = instanceReference.push(this) - 1;

		    new InstanceData(
			    {
				    name: getNotEmptyName(name, fallbackName),
				    prefix: prefix,
				    childrenPrefix: childrenPrefix,
				    parentData: parentData,
				    settings: settings,
				    data: data
			    }).addToStorage(index);

		    new PrivateData().addToStorage(prefix);

		    setCurrentParent(null);
	    }

	    /**
	     * @type {Sandbox.prototype}
	     */
	    Sandbox.prototype = {
		    constructor: Sandbox,
		    /**
		     * @return {String}
		     */
		    name: function getSandboxName() {
			    return InstanceData.get(this).name;
		    },
		    /**
		     * creates new sandbox instance with parent-child references
		     */
		    kid: function createSandboxKid() {
			    setCurrentParent(this);
			    var Factory = _.partial.apply(_, [Sandbox].concat(_.toArray(arguments)));
			    return new Factory();
		    },
		    /**
		     * @this Sandbox
		     * @return {*}
		     */
		    data: function getSandboxData() {
			    var data = InstanceData.get(this).data;
			    return _.isObject(data) ? _.create(data) : data;
		    },
		    /**
		     * subscribes handler to event
		     * @param {String} eventName
		     * @param {Function} handler
		     */
		    on: function sandboxOn(eventName, handler) {
			    var that = this;
			    var info = new SandboxInfo(that);
			    //var data = info.data;
			    var thisPrefix = info.prefix;

			    var candidates = new CandidatesData();
			    candidates
				    .add(info.parentPrefix)
				    .addBatch(PrivateData.getByRegExp([info.siblingPrefixRegExp, info.kidsPrefixRegExp]));

			    var thisPrivateData = candidates.get(thisPrefix);
			    thisPrivateData.listeners.push(
				    new ListenerStorage(
					    {
						    event: eventName,
						    handler: handler
					    }
				    )
			    );

			    forValidPermissions(
				    candidates,
				    _.partial(permitIsValid, thisPrefix, eventName),
				    function (privateData, prefix) {
					    if (privateData.cache.length && privateData.listeners.length) {
						    _.each(_.filter(privateData.cache, {event: eventName}), function (cachedEvent) {
							    _.each(thisPrivateData.listeners, function (listenerData) {
								    listenerData.handler.apply(that, ensureIsArray(cachedEvent.data));
								    if (cachedEvent.invalidate) {
									    cachedEvent.invalidate();
								    }
							    });
						    });
					    }
				    }
			    );

			    //TODO: should really invoke only own listeners

			    /*if (data.settings.cache.store) {
					callListenersWithCachedData.call(that, event, name);
				}*/

			    return that;
		    },
		    /**
		     * unsubscribe handlers from event
		     * @param {String} eventName
		     */
		    off: function sandboxOff(eventName) {
			    var that = this;
			    var thisData = InstanceData.get(that);
			    var thisPrivateData = privateDataStorage[thisData.prefix];

			    _.remove(thisPrivateData.listeners, function (listener) {
				    return listener.event === eventName;
			    });

			    return this;
		    },
		    /**
		     * emits event with given data
		     * @param {String} eventName
		     * @param {*} data
		     */
		    emit: function sandboxEmit(eventName, data) {
			    var that = this;
			    var info = new SandboxInfo(that);
			    var cachedEvent = new CachedEvent(
				    {
					    event: eventName,
					    data: data,
					    invalidate: false
				    }
			    );

			    var candidates = new CandidatesData();
			    candidates
				    .add(info.parentPrefix)//TODO: unify getPrivateData, so that we can get rid of add/addBatch
				    .addBatch(PrivateData.getByRegExp([info.siblingPrefixRegExp, info.kidsPrefixRegExp]));

			    forValidPermissions(
				    candidates,
				    _.partial(permitIsValid, info.prefix, eventName),
				    _.partial(onValidPermissions, info, cachedEvent)
			    );

			    /*callListenersWithCachedData.call(that, event);*/

			    return that;
		    },
		    /**
		     * grant permissions to sandbox
		     * @param {String|Array} to
		     * @param {Object} permissions
		     */
		    grant: function grantSandboxPermissions(to, permissions) {
			    //TODO: should store permissions in kids own privateDataStorage
			    var that = this;
			    var info = new SandboxInfo(that);
			    var thisData = info.data;
			    //var thisPrefix = info.prefix;
			    var candidates = new CandidatesData();
			    candidates.addBatch(PrivateData.getByRegExp(info.kidsPrefixRegExp));

			    //TODO: if only permissions passed consider applying to all kids
			    /*if (arguments.length === 1) {
					permissions = to;
					to = thisData.name;
				}*/

			    if (_.isArray(to)) {
				    to = _.map(to, function (target) {
					    return thisData.prefix + thisData.childrenPrefix + target;
				    });
			    } else {
				    to = [thisData.prefix + thisData.childrenPrefix + to];
			    }

			    _.each(candidates.storage, function (privateData, prefix) {
				    if (~_.indexOf(to, prefix)) {
					    simplePermissions.grant(privateData.permissions, prefix, permissions);
				    }
			    });

			    return this;
		    },
		    /**
		     * revoke permissions from sandbox
		     * @param {String|Array} from
		     * @param {Object} permissions
		     */
		    revoke: function revokeSandboxPermissions(from, permissions) {
			    var thisData = InstanceData.get(this);
			    if (arguments.length === 1) {
				    permissions = from;
				    from = thisData.name;
			    }

			    simplePermissions.revoke(thisData.permissions, from, permissions);

			    return this;
		    },
		    destroy: function destroySandox() {
			    var that = this,
				    index = _.indexOf(instanceReference, that),
				    data = instanceDataStorage.splice(index, 1),
				    parentData = data[0].parentData;
			    instanceReference.splice(index, 1);
			    _.invoke(data.kids, 'destroy');
			    _.pull(parentData.kids, that);
			    delete privateDataStorage[data[0].prefix];
		    }
	    };
	    /**
	     * @see emit
	     */
	    Sandbox.prototype.trigger = Sandbox.prototype.emit;
	    var defaultSettings = {
		    cache: {
			    store: true,
			    expire: 0, //off by default
			    debounce: true
		    }
	    };
	    _.extend(
		    Sandbox,
		    /** @lends {Sandbox.prototype.constructor}*/{
			    setDefaults: function setDefaults(newDefaults) {
				    if (newDefaults) {
					    _.merge(defaultSettings, newDefaults);
				    }
				    return defaultSettings;
			    }
		    }
	    );


	    /**
	     * @type {?Sandbox}
	     */
	    var tempParent = null;
	    /**
	     * returns temporary parent from kid initialization, root object for sandboxes created directly
	     * with new Sandbox(), or when root wasn't initialized - null
	     * @return {?Sandbox}
	     */
	    function getCurrentParent() {
		    return tempParent || root || null;
	    }
	    /**
	     * @param {?Sandbox} parent
	     */
	    function setCurrentParent(parent) {
		    tempParent = parent;
	    }


	    /**
	     * @type {Sandbox[]}
	     */
	    var instanceReference = [];
	    /**
	     * @type {InstanceData[]}
	     */
	    var instanceDataStorage = [];
	    /**
	     * @class InstanceData
	     * @param {{name: String, prefix: String, childrenPrefix: string, parentData: ?InstanceData,
         * settings: Object, data: *}} params
	     */
	    function InstanceData(params) {
		    this.name = params.name;
		    this.prefix = params.prefix;
		    this.childrenPrefix = params.childrenPrefix;
		    this.parentData = params.parentData;
		    /**
		     * @type {{cache: {store: boolean, expire: number, debounce: boolean}}}
		     */
		    this.settings = _.merge(_.cloneDeep(defaultSettings), params.settings);
		    this.data = params.data;
	    }
	    /**
	     * @type {InstanceData.prototype.constructor}
	     */
	    InstanceData.prototype = {
		    constructor: InstanceData,
		    /**
		     * @param {Number} index
		     */
		    addToStorage: function addToInstanceDataStorage(index) {
			    instanceDataStorage[index] = this;
		    }
	    };
	    _.extend(
		    InstanceData,
		    /**@lends InstanceData*/{
			    /**
			     * get private data for sandbox instance
			     * @param {?Sandbox} obj
			     * @return {?InstanceData}
			     */
			    get: function getInstanceData(obj) {
				    if (obj) {
					    return instanceDataStorage[_.indexOf(instanceReference, obj)];
				    }
				    return null;
			    }
		    }
	    );


	    /**
	     * make sure that prefix doesn't exist in private data, otherwise throw an error
	     * @param {String} prefix
	     * @param {String} name
	     * @throws SandboxError
	     */
	    function makeSureSiblingsNamesAreUnique(prefix, name) {
		    if (prefix in privateDataStorage) {
			    setCurrentParent(null);
			    throw new SandboxError(
				    [
					    'Siblings can\'t have same names. ',
					    name,
					    ' already exists.'
				    ].join('')
			    );
		    }
	    }


	    /**
	     * @type {Object.<String, PrivateData>}
	     */
	    var privateDataStorage = {};
	    /**
	     * @class PrivateData
	     */
	    function PrivateData() {
		    /**
		     * @type {ListenerStorage[]}
		     */
		    this.listeners = [];
		    this.cache = [];
		    this.permissions = [];
	    }
	    /**
	     * @type {PrivateData.prototype}
	     */
	    PrivateData.prototype = {
		    constructor: PrivateData,
		    /**
		     * @param {String} prefix
		     */
		    addToStorage: function addPrivateDataToStorage(prefix) {
			    privateDataStorage[prefix] = this;
		    },
		    /**
		     * @param {Object} event
		     */
		    addToCache: function addToPrivateDataCache(event) {
			    this.cache.push(event);
		    }
	    };
	    _.extend(
		    PrivateData,
		    /**@lends {PrivateData.prototype.constructor}*/{
			    /**
			     * @param {String} key
			     * @return {PrivateData}
			     */
			    get: function getPrivateData(key) {
				    return privateDataStorage[key];
			    },
			    /**
			     * @param {RegExp|RegExp[]} regExpOrArray
			     * @return {Object.<String, PrivateData>}
			     */
			    getByRegExp: function getPrivateDataByRegExp(regExpOrArray) {
				    var regExes = ensureIsArray(regExpOrArray);
				    return _.pick(privateDataStorage, function (data, prefix) {
					    return _.some(regExes, function (regExp) {
						    return regExp.test(prefix);
					    });
				    });
			    }
	        }
	    );


	    /**
	     * @class ListenerStorage
	     * @param {{event: String, handler: Function}} params
	     */
	    function ListenerStorage(params) {
		    this.event = params.event;
		    this.handler = params.handler;
	    }


	    /**
	     * @class CandidatesData
	     */
	    function CandidatesData() {
		    this.storage = {};
	    }
	    /**
	     * @type {CandidatesData.prototype}
	     */
	    CandidatesData.prototype = {
		    constructor: CandidatesData,
		    /**
		     * @param {String} prefix
		     */
		    add: function addCandidatesData(prefix) {
			    this.storage[prefix] = PrivateData.get(prefix);
			    return this;
		    },
		    /**
		     * @param {Object.<String, PrivateData>} data
		     */
		    addBatch: function addBatchCandidatesData(data) {
			    _.extend(
				    this.storage,
				    data
			    );
			    return this;
		    },
		    /**
		     * @param {String} prefix
		     * @return {PrivateData}
		     */
		    get: function getCandidatesData(prefix) {
			    return this.storage[prefix];
		    }
	    };


	    /**
	     *
	     * @param {Sandbox} sandbox
	     * @class SandboxInfo
	     */
	    function SandboxInfo(sandbox) {
		    var thisData = InstanceData.get(sandbox);
		    /**
		     * @type {string}
		     */
		    var thisPrefix = thisData.prefix;
		    /**
		     * @type {string}
		     */
		    var parentPrefix = thisData.parentData.prefix;

		    this.sandbox = sandbox;
		    /**
		     * @type {InstanceData}
		     */
		    this.data = thisData;
		    this.prefix = thisPrefix;
		    this.parentPrefix = parentPrefix;
		    this.siblingPrefixRegExp = new RegExp(parentPrefix + thisData.parentData.childrenPrefix + '[^/]*$');
		    this.kidsPrefixRegExp = new RegExp(thisPrefix + '.+');
	    }


	    /**
	     * @param {{event: String, data: *, invalidate: boolean}} params
	     * @class CachedEvent
	     */
	    function CachedEvent(params) {
		    this.event = params.event;
		    this.data = params.data;
		    this.invalidate = params.invalidate;
	    }
	    /**
	     * @type {CachedEvent.prototype.constructor}
	     */
	    CachedEvent.prototype = {
		    constructor: CachedEvent,
		    /**
		     * @param {SandboxInfo} sandboxInfo
		     * @param {PrivateData} candidateData
		     */
		    updateExpiration: function updateEventExpiration(sandboxInfo, candidateData) {
			    var cacheSettings = sandboxInfo.data.settings.cache;
			    if (cacheSettings.expire) {
				    if (this.invalidate) {
					    this.invalidate();
				    } else {
					    this.setupExpiration(cacheSettings, candidateData);
				    }
			    }
		    },
		    /**
		     * @param {{store: boolean, expire: number, debounce: boolean}} cacheSettings
		     * @param {PrivateData} candidateData
		     */
		    setupExpiration: function setupEventExpiration(cacheSettings, candidateData) {
			    var timingFnName = cacheSettings.debounce ? 'debounce' : 'delay';
			    var timingFn;
			    var cachedEvent = this;
			    timingFn = _[timingFnName](function () {
				    cachedEvent.removeFrom(candidateData.cache);
			    }, cacheSettings.expire);

			    if (cacheSettings.debounce) {
				    cachedEvent.invalidate = timingFn;
			    }
		    },
		    /**
		     * @param {PrivateData} candidateData
		     * @param {SandboxInfo} sandboxInfo
		     */
		    whenUnhandledStoreIn: function whenUnhandledStoreEventIn(candidateData, sandboxInfo) {
			    var cachedEvent = this;
			    var cacheSettings = sandboxInfo.data.settings.cache;
			    var candidateListeners = candidateData.listeners;
			    var storeInCache = cacheSettings.store;
			    if (candidateListeners.length) {
				    storeInCache = false;
				    _.each(_.filter(candidateListeners, {event: cachedEvent.event}), function (listenerData) {
					    listenerData.handler.apply(sandboxInfo.sandbox, ensureIsArray(cachedEvent.data));
				    });
			    }
			    if (storeInCache) {
				    candidateData.addToCache(this);
			    }
		    },
		    /**
		     * @param {[]} cache
		     */
		    removeFrom: function removeEventFromCache(cache) {
			    var index = _.findIndex(cache, this);
			    cache.splice(index, 1);
		    }
	    };


	    /**
	     * creates sandbox error
	     * @param {String} message
	     * @class SandboxError
	     */
	    function SandboxError(message) {
		    this.message = message;
	    }
	    SandboxError.prototype = new Error();
	    SandboxError.prototype.constructor = SandboxError;


	    /**
	     * validates source prefix against candidate's permissions for a given permit
	     * if source's prefix is the same as candidate's, permit is not required
	     * @param {String} sourcePrefix
	     * @param {String} permit
	     * @param {*} candidateData
	     * @param {String} candidatePrefix
	     * @return {boolean}
	     */
	    function permitIsValid(sourcePrefix, permit, candidateData, candidatePrefix) {
		    return candidatePrefix === sourcePrefix || hasPermitByPrefix(
			    candidateData.permissions,
			    permit,
			    sourcePrefix
		    );
	    }

        /**
         * checks if source could be found by prefix and contains permit
         * @param {Array} source
         * @param {String} permit
         * @param {String} sourcePrefix
         * @return {boolean}
         */
        function hasPermitByPrefix(source, permit, sourcePrefix) {
	        var permissionsForPrefix = _.find(source, {target: sourcePrefix});
	        return !!(permissionsForPrefix && ~_.indexOf(permissionsForPrefix.permissions, permit));
        }

        /**
         * executes callback for candidates which pass validation
         * @param {CandidatesData} candidates
         * @param {Function} validator
         * @param {Function} callback
         */
        function forValidPermissions(candidates, validator, callback) {
	        _.each(candidates.storage, function (privateData, prefix) {
		        var args = _.toArray(arguments);
		        if (validator.apply(null, args)) {
			        callback.apply(null, args);
		        }
	        });
        }

	    /**
	     * @param {*} param
	     * @return {[]}
	     */
        function ensureIsArray(param) {
	        return _.isArray(param) ? param : [param];
        }


	    /**
	     * @param {SandboxInfo} sandboxInfo
	     * @param {CachedEvent} cachedEvent
	     * @param {PrivateData} candidateData
	     * @param {String} prefix
	     */
	    function onValidPermissions(sandboxInfo, cachedEvent, candidateData, prefix) {
		    cachedEvent.updateExpiration(sandboxInfo, candidateData);
		    cachedEvent.whenUnhandledStoreIn(candidateData, sandboxInfo);
	    }


	    /**
	     * @param {InstanceData} parentData
	     * @param {?String|undefined} name
	     * @param {String} fallbackName
	     * @return {String}
	     */
	    function createPrefix(parentData, name, fallbackName) {
		    if (!root) { //root wasn't initialized yet
			    return rootName;
		    }

		    return [
			    parentData.prefix,
			    parentData.childrenPrefix,
			    getNotEmptyName(name, fallbackName)
		    ].join('');
	    }


	    /**
	     * @param {?String|undefined} name
	     * @param {String} fallbackName
	     * @return {String}
	     */
	    function getNotEmptyName(name, fallbackName) {
		    return name || fallbackName;
	    }


	    var rootName = '√';
	    var root = new Sandbox(rootName);


	    /*
         * sets/creates private data by key
         * @param {String} key
         * @param {*} data
         * @this Sandbox
         */
	    /*function setPrivateData(key, data) {
		//jshint validthis: true
		getInstanceData(this)[key] = data;
	}*/

	    //function getKidListeners(kid) {
	    //   return getInstanceData(kid).listeners;
	    //}

	    ///**
	    //* @param {String} event
	    //* @return {ListenerStorage[]}
	    //*/
	    //var getListenersForEvent = function getListenersForEvent(event) {
	    //   var parentData = getInstanceData(this.parent),
	    //       siblingsAndSelfListeners = _.map(parentData.kids, getKidListeners),
	    //       kidListeners = _.map(this.kids, getKidListeners);
	    //    return _.where(
	    //       _.flatten(kidListeners.concat([siblingsAndSelfListeners, parentData.listeners])),
	    //       {event: event}
	    //    );
	    //};

	    ///**
	    // * checks that listener has permissions and passes data over
	    // * @param {Function[]} listeners
	    // * @param {*} data
	    // * @param {String} origin
	    // * @this Sandbox
	    // * @return {Boolean} true if listeners were called
	    // */
	    //var callListenersWithPermissions = function (listeners, data, origin) {
	    //   var that = this,
	    //       thisData = getInstanceData(that),
	    //       parentData = getInstanceData(thisData.parent),
	    //       wereListenersCalled = false;
	    //
	    //   _.each(listeners, function (listener) {
	    //       var hasPermissions = _.find(thisData.permissions.concat(parentData.permissions), {
	    //		        target: listener.origin
	    //	        }
	    //        ) || origin === listener.origin;
	    //
	    //       if (hasPermissions) {
	    //        listener.handler.apply(that, _.isArray(data) && data || [data]);
	    //        wereListenersCalled = true;
	    //       }
	    //   });
	    //
	    //   return wereListenersCalled;
	    //};

	    ///**
	    // * @param {String} event
	    // * @this Sandbox
	    // */
	    //var callListenersWithCachedData = function (event) {
	    //   var that = this,
	    //       thisData = getInstanceData(that),
	    //       parent = thisData.parent,
	    //       parentData = getInstanceData(parent),
	    //       cacheSettings = thisData.settings.cache;
	    //
	    //   _.each(parentData.cache, function (cachedEvent) {
	    //       //TODO: see if origin check can happen before calling listeners
	    //       var data = cachedEvent.data;
	    //       //remove in case some listeners fired
	    //       var result = callListenersWithPermissions.call(
	    //	        that,
	    //	        getListenersForEvent.call(thisData, event),
	    //	        data,
	    //	        origin
	    //        ),
	    //        timingFnName = cacheSettings.debounce ? 'debounce' : 'delay',
	    //        timingFn;
	    //       if (result && cacheSettings.expire) {
	    //        if (cachedEvent.invalidate) {
	    //	        cachedEvent.invalidate();
	    //        } else {
	    //	        timingFn = _[timingFnName](function () {
	    //		        removeEventFromCache(parentData, cachedEvent);
	    //	        }, cacheSettings.expire);
	    //
	    //	        if (cacheSettings.debounce) {
	    //		        cachedEvent.invalidate = timingFn;
	    //	        }
	    //        }
	    //       } else if (result) {
	    //        removeEventFromCache(parentData, cachedEvent);
	    //       }
	    //   });
	    //};

	    exports.Sandbox = Sandbox;
    })
);