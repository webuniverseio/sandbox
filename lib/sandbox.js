/*global exports*/

//noinspection ThisExpressionReferencesGlobalObjectJS,FunctionTooLongJS
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

		    new InstanceData(
			    {
				    name: getNotEmptyName(name, fallbackName),
				    prefix: prefix,
				    childrenPrefix: childrenPrefix,
				    parentData: parentData,
				    settings: settings,
				    data: data
			    }).assignTo(this);

		    new PrivateData().assignTo(prefix);

		    setCurrentParent(null);
	    }
	    /**
	     * @return {String}
	     */
	    Sandbox.prototype.name = function getSandboxName() {
		    return InstanceData.get(this).name;
	    };
	    /**
	     * creates new sandbox instance with parent-child references
	     */
	    Sandbox.prototype.kid = function createSandboxKid() {
		    setCurrentParent(this);
		    var Factory = _.partial.apply(_, [Sandbox].concat(_.toArray(arguments)));
		    return new Factory();
	    };
	    /**
	     * @this Sandbox
	     * @return {*}
	     */
	    Sandbox.prototype.data = function getSandboxData() {
		    var data = InstanceData.get(this).data;
		    return _.isObject(data) ? _.create(data) : data;
	    };
	    /**
	     * subscribes handler to event
	     * @param {String} eventName
	     * @param {Function} handler
	     */
	    Sandbox.prototype.on = function sandboxOn(eventName, handler) {
		    var that = this;
		    var info = new SandboxInfo(that);
		    //var data = info.data;
		    var thisPrefix = info.prefix;

		    var candidates = new CandidatesData();
		    candidates
			    .add(info.parentPrefix)
			    .addBatch(PrivateData.getByRegExp([info.siblingPrefixRegExp, info.chindrenPrefixRegExp]));

		    var thisPrivateData = candidates.get(thisPrefix);
		    thisPrivateData.addToListeners(
			    new ListenerInfo(
				    {
					    event: eventName,
					    handler: handler
				    }
			    )
		    );

		    forValidPermissions(
			    candidates,
			    _.partial(permitIsValid, thisPrefix, eventName),
			    function (candidateData, prefix) {
				    if (candidateData.listeners.length) {
					    _.each(_.filter(candidateData.cache, {event: eventName}), function (cachedEvent) {
						    _.each(thisPrivateData.listeners, function (listenerData) {
							    listenerData.handler.apply(that, ensureIsArray(cachedEvent.data));
							    cachedEvent.updateExpiration();
						    });
					    });
				    }
			    }
		    );

		    return that;
	    };
	    /**
	     * unsubscribe handlers from event
	     * @param {String} eventName
	     */
	    Sandbox.prototype.off = function sandboxOff(eventName) {
		    var that = this;
		    var thisData = InstanceData.get(that);
		    var thisPrivateData = privateDataStorage[thisData.prefix];

		    _.remove(thisPrivateData.listeners, function listenerEventMatchesEventName(listener) {
			    return listener.event === eventName;
		    });

		    return this;
	    };
	    /**
	     * emits event with given data
	     * @param {String} eventName
	     * @param {*} [data]
	     */
	    Sandbox.prototype.emit = function sandboxEmit(eventName, data) {
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
			    .addBatch(PrivateData.getByRegExp([info.siblingPrefixRegExp, info.chindrenPrefixRegExp]));

		    forValidPermissions(
			    candidates,
			    _.partial(permitIsValid, info.prefix, eventName),
			    _.partial(onValidPermissions, info, cachedEvent)
		    );

		    return that;
	    };
	    /**
	     * grant permissions to sandbox
	     * @param {String|Array} to
	     * @param {Object} permissionsMap
	     */
	    Sandbox.prototype.grant = function grantSandboxPermissions(to, permissionsMap) {
		    //TODO: if only permissions passed consider applying to all kids
		    var info = new SandboxInfo(this);
		    var candidates = new CandidatesData();
		    var childrenPrefixData = info.data;

		    candidates
			    .add(info.prefix)
			    .addBatch(PrivateData.getByRegExp(info.chindrenPrefixRegExp));

		    if (arguments.length === 1) {
			    permissionsMap = to;
			    to = this.name();
			    childrenPrefixData = info.data.parentData;
		    }

		    to = addChildrenPrefix(to, childrenPrefixData);

		    _.each(candidates.storage, function (candidateData, prefix) {
			    if (~_.indexOf(to, prefix)) {
				    simplePermissions.grant(candidateData.permissions, prefix, permissionsMap);
			    }
		    });

		    return this;
	    };
	    /**
	     * revoke permissions from sandbox
	     * @param {String|Array} from
	     * @param {Object} permissionsMap
	     */
	    Sandbox.prototype.revoke = function revokeSandboxPermissions(from, permissionsMap) {
		    var info = new SandboxInfo(this);
		    var candidates = new CandidatesData();
		    var childrenPrefixData = info.data;

		    candidates
			    .add(info.prefix)
			    .addBatch(PrivateData.getByRegExp(info.chindrenPrefixRegExp));

		    if (arguments.length === 1) {
			    permissionsMap = from;
			    from = this.name();
			    childrenPrefixData = info.data.parentData;
		    }

		    from = addChildrenPrefix(from, childrenPrefixData);

		    _.each(candidates.storage, function (candidateData, prefix) {
			    if (~_.indexOf(from, prefix)) {
				    simplePermissions.revoke(candidateData.permissions, prefix, permissionsMap);
			    }
		    });

		    return this;
	    };

	    Sandbox.prototype.destroy = function destroySandbox() {
		    var data = InstanceData.get(this);
		    /**
		     * @type {PrivateData}
		     */
		    var privateData = PrivateData.get(data.prefix);
		    data.unAssignFrom(this);
		    privateData.unAssignFrom(data.prefix);
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
	     * @param {Sandbox} sandbox
	     */
	    InstanceData.prototype.assignTo = function assignInstanceDataTo(sandbox) {
		    var index = instanceReference.push(sandbox) - 1;
		    instanceDataStorage[index] = this;
	    };
	    InstanceData.prototype.unAssignFrom = function unAssignInstanceDataFrom(sandbox) {
		    var index = _.indexOf(instanceReference, sandbox);
		    instanceDataStorage.splice(index, 1);
		    instanceReference.splice(index, 1);
	    };
	    _.extend(
		    InstanceData,
		    /**@lends InstanceData*/{
			    /**
			     * get instance data for sandbox
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
		     * @type {ListenerInfo[]}
		     */
		    this.listeners = [];
		    this.cache = [];
		    this.permissions = [];
	    }
	    /**
	     * @param {String} prefix
	     */
	    PrivateData.prototype.assignTo = function assignPrivateDataTo(prefix) {
		    privateDataStorage[prefix] = this;
	    };
	    PrivateData.prototype.unAssignFrom = function unAssignPrivateDataFrom(prefix) {
		    delete privateDataStorage[prefix];
	    };
	    /**
	     * @param {Object} event
	     */
	    PrivateData.prototype.addToCache = function addToPrivateDataCache(event) {
		    this.cache.push(event);
	    };
	    /**
	     * @param {ListenerInfo} listenerInfo
	     */
	    PrivateData.prototype.addToListeners = function addToPrivateDataListeners(listenerInfo) {
		    this.listeners.push(listenerInfo);
	    };
	    _.extend(
		    PrivateData,
		    /**@lends {PrivateData.prototype.constructor}*/{
			    /**
			     * @param {String} prefix
			     * @return {PrivateData}
			     */
			    get: function getPrivateData(prefix) {
				    return privateDataStorage[prefix];
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
	     * @class ListenerInfo
	     * @param {{event: String, handler: Function}} params
	     */
	    function ListenerInfo(params) {
		    this.event = params.event;
		    this.handler = params.handler;
	    }


	    /**
	     * @class CandidatesData
	     */
	    function CandidatesData() {
		    /**
		     * @param {Object.<String, PrivateData>} data
		     */
		    this.storage = {};
	    }
	    /**
	     * @param {String} prefix
	     */
	    CandidatesData.prototype.add = function addCandidatesData(prefix) {
		    this.storage[prefix] = PrivateData.get(prefix);
		    return this;
	    };
	    /**
	     * @param {Object.<String, PrivateData>} data
	     */
	    CandidatesData.prototype.addBatch = function addBatchCandidatesData(data) {
		    _.extend(
			    this.storage,
			    data
		    );
		    return this;
	    };
	    /**
	     * @param {String} prefix
	     * @return {PrivateData}
	     */
	    CandidatesData.prototype.get = function getCandidatesData(prefix) {
		    return this.storage[prefix];
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
		    this.chindrenPrefixRegExp = new RegExp(thisPrefix + '.+');
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
	     *
	     */
	    CachedEvent.prototype.updateExpiration = function updateEventExpiration() {
		    if (typeof this.invalidate === 'function') {
			    this.invalidate();
		    }
	    };

	    /**
	     * @param {{store: boolean, expire: number, debounce: boolean}} cacheSettings
	     * @param {PrivateData} candidateData
	     */
	    CachedEvent.prototype.setupExpiration = function setupEventExpiration(cacheSettings, candidateData) {
		    if (!cacheSettings.expire) {
			    return;
		    }

		    var timingFnName = CachedEvent.getTimingFnName(cacheSettings);
		    var timingFn;
		    var cachedEvent = this;
		    timingFn = _[timingFnName](function () {
			    cachedEvent.removeFrom(candidateData.cache);
		    }, cacheSettings.expire);

		    if (cacheSettings.debounce) {
			    cachedEvent.invalidate = timingFn;
		    }
	    };
	    /**
	     * @param {PrivateData} candidateData
	     * @param {SandboxInfo} sandboxInfo
	     */
	    CachedEvent.prototype.whenUnhandledStoreIn = function whenUnhandledStoreEventIn(candidateData, sandboxInfo) {
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
	    };
	    /**
	     * @param {[]} cache
	     */
	    CachedEvent.prototype.removeFrom = function removeEventFromCache(cache) {
		    var index = _.findIndex(cache, this);
		    if (~index) {
			    cache.splice(index, 1);
		    }
	    };
	    _.extend(
		    CachedEvent,
		    /**@lends {CachedEvent.prototype.constructor}*/{
			    /**
			     * @param {{store: boolean, expire: number, debounce: boolean}} cacheSettings
			     * @return {string}
			     */
			    getTimingFnName: function getTimingFnName(cacheSettings) {
		            return cacheSettings.debounce ? 'debounce' : 'delay';
	            }
		    }
	    );

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
	     * @param {PrivateData} candidateData
	     * @param {String} candidatePrefix
	     * @return {boolean}
	     */
	    function permitIsValid(sourcePrefix, permit, candidateData, candidatePrefix) {
		    var allowEverythingForSource = candidatePrefix === sourcePrefix;
		    return allowEverythingForSource || hasPermitByPrefixes(
			    candidateData.permissions,
			    permit,
			    [sourcePrefix, candidatePrefix]
		    );
	    }

        /**
         * checks if source could be found by prefix and contains permit
         * @param {Array} source
         * @param {String} permit
         * @param {String[]} prefixes
         * @return {boolean}
         */
        function hasPermitByPrefixes(source, permit, prefixes) {
	        var permissionsForPrefix = _.find(source, function findByPrefixes(/**Entry*/entry) {
		        return _.indexOf(prefixes, entry.target);
	        });
	        return !!(permissionsForPrefix && ~_.indexOf(permissionsForPrefix.permissions, permit));
        }

        /**
         * executes callback for candidates which pass validation
         * @param {CandidatesData} candidates
         * @param {Function} validator
         * @param {Function} callback
         */
        function forValidPermissions(candidates, validator, callback) {
	        _.each(candidates.storage, function (candidateData, prefix) {
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
		    var cacheSettings = sandboxInfo.data.settings.cache;
		    cachedEvent.setupExpiration(cacheSettings, candidateData);
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
	     * @param {String|Array} to name(s)
	     * @param {InstanceData} data
	     * @return {[]}
	     */
	    function addChildrenPrefix(to, data) {
		    if (_.isArray(to)) {
			    return _.map(to, function (target) {
				    return data.prefix + data.childrenPrefix + target;
			    });
		    } else {
			    return [data.prefix + data.childrenPrefix + to];
		    }
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

	    exports.Sandbox = Sandbox;
    })
);