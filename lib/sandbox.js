/*global exports*/
//TODO: decouple simple-permissions
//TODO: add a way to plug-in

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
	     * sandbox constructor
	     * @param {String} [name] sandbox name
	     * @param {*} [data] stores data
	     * @name Sandbox
	     */
	    function Sandbox(name, data) {
		    if (typeof name !== 'string') {
			    data = name;
			    name = '';
		    }

		    name = getNotFalsy(name, _.uniqueId('empty'));
		    var parent = getCurrentParent();
		    var parentInfo = SandboxInfo.getFor(parent);
		    var prefix = createPrefix(parentInfo, name);
		    var childrenPrefix = prefix + '/' + _.uniqueId() + '/';

		    makeSureSiblingsNamesAreUnique(prefix, name);

		    new SandboxInfo(
			    {
				    name: name,
				    prefix: prefix,
				    childrenPrefix: childrenPrefix,
				    parentInfo: parentInfo,
				    data: data
			    }).mapTo(this);

		    new PrivateData().mapTo(prefix);
	    }
	    /**
	     * returns sandbox instance name
	     * @return {String}
	     */
	    Sandbox.prototype.name = function getSandboxName() {
		    return SandboxInfo.getFor(this).name;
	    };
	    /**
	     * use to set sandbox specific settings for cache adjustments, etc
	     * @param {Object} settings cache adjustment, etc
	     */
	    Sandbox.prototype.settings = function setSandboxSettings(settings) {
		    var info = SandboxInfo.getFor(this);
		    info.settings = _.merge(info.settings, settings);
	    };
	    /**
	     * creates new sandbox instance with parent-child references
	     * @return {Sandbox}
	     */
	    Sandbox.prototype.kid = function createSandboxKid() {
		    setCurrentParent(this);
		    var Factory = _.partial.apply(_, [Sandbox].concat(_.toArray(arguments)));
		    //noinspection JSValidateTypes
		    return new Factory();
	    };
	    /**
	     * returns immutable sandbox instance data
	     * @return {*}
	     */
	    Sandbox.prototype.data = function getSandboxData() {
		    var data = SandboxInfo.getFor(this).data;
		    return _.isObject(data) ? _.create(data) : data;
	    };
	    /**
	     * subscribes handler to event
	     * @param {String} eventName
	     * @param {Function} handler
	     * @param {Object} [thisBinding]
	     */
	    Sandbox.prototype.on = function sandboxOn(eventName, handler, thisBinding) {
		    var that = this;
		    var info = SandboxInfo.getFor(that);
		    var thisPrefix = info.prefix;

		    var candidates = new CandidatesData();
		    candidates.addBy([info.parentPrefix, [info.siblingPrefixRegExp, info.chindrenPrefixRegExp]]);

		    var listener = new SandboxListener({
			    event: eventName,
			    handler: handler,
			    binding: getNotFalsy(thisBinding, that),
			    prefix: thisPrefix
		    });
		    var privateData = candidates.getFor(listener.prefix);
		    privateData.addListeners(listener);

		    //TODO: finished reading here on process
		    forValidPermissions(
			    candidates,
			    _.partial(permitIsValid, thisPrefix, eventName),
			    _.partial(SandboxListener.process, listener)
		    );

		    return that;
	    };
	    /**
	     * unsubscribe handlers from event
	     * @param {String} eventName
	     */
	    Sandbox.prototype.off = function sandboxOff(eventName) {
		    var that = this;
		    var info = SandboxInfo.getFor(that);
		    var privateData = privateDataStorage[info.prefix];

		    _.remove(privateData.listeners, function listenerEventMatchesEventName(listener) {
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
		    var info = SandboxInfo.getFor(that);

		    var cachedEvent = new CachedEvent({
			    event: eventName,
			    data: data,
			    invalidate: false,
			    settings: info.settings.cache
		    });

		    var candidates = new CandidatesData();
		    candidates.addBy([info.parentPrefix, [info.siblingPrefixRegExp, info.chindrenPrefixRegExp]]);

		    forValidPermissions(
			    candidates,
			    _.partial(permitIsValid, info.prefix, eventName),
			    _.partial(CachedEvent.process, cachedEvent)
		    );

		    return that;
	    };
	    /**
	     * grant permissions to sandbox
	     * @param {String|Array} [to]
	     * @param {Object} permissionsMap
	     */
	    Sandbox.prototype.grant = function grantSandboxPermissions(to, permissionsMap) {
		    //TODO: if only permissions passed consider applying to all kids
		    //TODO: add a way to allow event(s) for all children
		    var info = SandboxInfo.getFor(this);
		    var candidates = new CandidatesData();
		    candidates.addBy([info.prefix, info.chindrenPrefixRegExp]);

		    if (arguments.length === 1) {
			    permissionsMap = to;
			    to = addChildrenPrefix(this.name(), info.parentInfo);
		    } else {
			    to = addChildrenPrefix(to, info);
		    }

		    _.each(candidates.storage, function (candidateData, prefix) {
			    if (~_.indexOf(to, prefix)) {
				    simplePermissions.grant(candidateData.permissions, prefix, permissionsMap);
			    }
		    });

		    return this;
	    };
	    /**
	     * revoke permissions from sandbox
	     * @param {String|Array} [from]
	     * @param {Object} permissionsMap
	     */
	    Sandbox.prototype.revoke = function revokeSandboxPermissions(from, permissionsMap) {
		    var info = SandboxInfo.getFor(this);
		    var candidates = new CandidatesData();
		    candidates.addBy([info.prefix, info.chindrenPrefixRegExp]);

		    if (arguments.length === 1) {
			    permissionsMap = from;
			    from = addChildrenPrefix(this.name(), info.parentInfo);
		    } else {
			    from = addChildrenPrefix(from, info);
		    }

		    _.each(candidates.storage, function (candidateData, prefix) {
			    if (~_.indexOf(from, prefix)) {
				    simplePermissions.revoke(candidateData.permissions, prefix, permissionsMap);
			    }
		    });

		    return this;
	    };

	    Sandbox.prototype.destroy = function destroySandbox() {
		    var data = SandboxInfo.getFor(this);
		    /**
		     * @type {PrivateData}
		     */
		    var privateData = PrivateData.getFor(data.prefix);
		    data.unMapFrom(this);
		    privateData.unMapFrom(data.prefix);
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
			    /**
			     * @param {Object} newDefaults
			     * @return {Object}
			     */
			    defaults: function sandboxDefaults(newDefaults) {
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
	     * after return sets temporary parent to null
	     * for kid proxy-initialization - returns temporary parent
	     * for sandboxes created directly with new Sandbox() - root object
	     * when root wasn't initialized - null
	     * @return {?Sandbox}
	     */
	    function getCurrentParent() {
		    var currentParent = tempParent || root || null;
		    tempParent = null;
		    return currentParent;
	    }
	    /**
	     * sets temporary parent to passed sandbox
	     * @param {Sandbox} parent
	     */
	    function setCurrentParent(parent) {
		    tempParent = parent;
	    }


	    /**
	     * @type {Sandbox[]}
	     */
	    var instanceReference = [];
	    /**
	     * @type {SandboxInfo[]}
	     */
	    var sandboxInfoStorage = [];
	    /**
	     * @class SandboxInfo
	     * @param {{name: String, prefix: String, childrenPrefix: string, parentInfo: ?SandboxInfo, data: *}} params
	     */
	    function SandboxInfo(params) {
		    var sandboxPrefix = params.prefix;
		    var parentInfo = params.parentInfo;
		    var parentPrefix;

		    if (parentInfo) {
			    parentPrefix = parentInfo.prefix;
			    this.siblingPrefixRegExp = new RegExp(parentInfo.childrenPrefix + '[^/]*$');
		    } else {
			    parentPrefix = null;
			    this.siblingPrefixRegExp = null;
		    }

		    this.name = params.name;
		    this.prefix = sandboxPrefix;
		    this.parentPrefix = parentPrefix;
		    this.childrenPrefix = params.childrenPrefix;
		    this.parentInfo = parentInfo;
		    this.chindrenPrefixRegExp = new RegExp(sandboxPrefix + '.+');
		    /**
		     * @type {{cache: {store: boolean, expire: number, debounce: boolean}}}
		     */
		    this.settings = _.cloneDeep(defaultSettings);
		    this.data = params.data;
	    }

	    /**
	     * @param {Sandbox} sandbox
	     */
	    SandboxInfo.prototype.mapTo = function assignSandboxInfoTo(sandbox) {
		    var index = instanceReference.push(sandbox) - 1;
		    sandboxInfoStorage[index] = this;
	    };
	    SandboxInfo.prototype.unMapFrom = function unAssignSandboxInfoFrom(sandbox) {
		    var index = _.indexOf(instanceReference, sandbox);
		    sandboxInfoStorage.splice(index, 1);
		    instanceReference.splice(index, 1);
	    };
	    _.extend(
		    SandboxInfo,
		    /**@lends SandboxInfo*/{
			    /**
			     * get instance data for sandbox
			     * @param {?Sandbox} obj
			     * @return {?SandboxInfo}
			     */
			    getFor: function getSandboxInfo(obj) {
				    if (obj) {
					    return sandboxInfoStorage[_.indexOf(instanceReference, obj)];
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
		     * @type {SandboxListener[]}
		     */
		    this.listeners = [];
		    this.cache = [];
		    this.permissions = [];
	    }
	    /**
	     * @param {String} prefix
	     */
	    PrivateData.prototype.mapTo = function mapTo(prefix) {
		    privateDataStorage[prefix] = this;
	    };
	    PrivateData.prototype.unMapFrom = function unMapPrivateDataFrom(prefix) {
		    delete privateDataStorage[prefix];
	    };
	    /**
	     * @param {Object} event
	     */
	    PrivateData.prototype.addToCache = function addToPrivateDataCache(event) {
		    this.cache.push(event);
	    };
	    /**
	     * @param {SandboxListener} listenerInfo
	     */
	    PrivateData.prototype.addListeners = function addListenersToPrivateData(listenerInfo) {
		    this.listeners.push(listenerInfo);
	    };
	    _.extend(
		    PrivateData,
		    /**@lends {PrivateData.prototype.constructor}*/{
			    /**
			     * @param {String} prefix
			     * @return {PrivateData}
			     */
			    getFor: function getPrivateData(prefix) {
				    return privateDataStorage[prefix];
			    },
			    /**
			     * @param {String} prefix
			     * @return {Object.<String, PrivateData>}
			     */
			    getWrappedBy: function getPrivateDatagetWrappedBy(prefix) {
				    return makeSimpleObject(prefix, PrivateData.getFor(prefix));
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
	     * @class SandboxListener
	     * @param {{event: String, handler: Function, binding: Object}} params
	     */
	    function SandboxListener(params) {
		    this.event = params.event;
		    this.handler = params.handler;
		    this.binding = params.binding;
		    this.prefix = params.prefix;
	    }
	    _.extend(
		    SandboxListener,
		    /**@lends {SandboxListener.prototype.constructor}*/{
			    /**
			     * @param {SandboxListener} listener
			     * @param {PrivateData} candidateData
			     * @param {String} prefix
			     */
			    process: function processSandboxListener(listener, candidateData, prefix) {
				    var storedCandidates = this;
				    var privateData = storedCandidates.getFor(listener.prefix);

				    _.each(_.filter(candidateData.cache, {event: listener.event}), function (cachedEvent) {
					    _.each(privateData.listeners, function (listenerData) {
						    listenerData.handler.apply(listenerData.binding, ensureIsArray(cachedEvent.data));
						    cachedEvent.updateExpiration();
					    });
				    });
			    }
		    }
	    );


	    /**
	     * stores multiple private data, accessible by prefix
	     * @class CandidatesData
	     */
	    function CandidatesData() {
		    /**
		     * @param {Object.<String, PrivateData>} data
		     */
		    this.storage = {};
	    }
	    /**
	     * @param {Array.<String|RegExp|RegExp[]>} prefixes
	     */
	    CandidatesData.prototype.addBy = function addCandidatesDataBy(prefixes) {
		    var that = this;
		    _.each(prefixes, function (prefix) {
			    var data;
			    if (typeof prefix === 'string') {
				    data = PrivateData.getWrappedBy(prefix);
			    } else {
				    data = PrivateData.getByRegExp(prefix);
			    }

			    _.extend(
				    that.storage,
				    data
			    );
		    });

		    return that;
	    };
	    /**
	     * @param {String} prefix
	     * @return {PrivateData}
	     */
	    CandidatesData.prototype.getFor = function getCandidatesData(prefix) {
		    return this.storage[prefix];
	    };


	    /**
	     * @param {{event: String, data: *, invalidate: boolean}} params
	     * @class CachedEvent
	     */
	    function CachedEvent(params) {
		    this.event = params.event;
		    this.data = params.data;
		    this.invalidate = params.invalidate;
		    this.settings = params.settings;
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
	     * @param {PrivateData} candidateData
	     */
	    CachedEvent.prototype.setupExpirationFor = function setupEventExpirationFor(candidateData) {
		    var cachedEvent = this;
		    var cacheSettings = cachedEvent.settings;
		    if (!cacheSettings.expire) {
			    return;
		    }

		    var timingFnName = CachedEvent.getTimingFnName(cacheSettings);
		    var timingFn;
		    timingFn = _[timingFnName](function () {
			    cachedEvent.removeFrom(candidateData.cache);
		    }, cacheSettings.expire);

		    if (cacheSettings.debounce) {
			    cachedEvent.invalidate = timingFn;
		    }
	    };
	    /**
	     * @param {PrivateData} candidateData
	     */
	    CachedEvent.prototype.whenUnhandledStoreIn = function whenUnhandledStoreEventIn(candidateData) {
		    var cachedEvent = this;
		    var candidateListeners = candidateData.listeners;
		    var storeInCache = cachedEvent.settings.store;
		    if (candidateListeners.length) {
			    storeInCache = false;
			    _.each(_.filter(candidateListeners, {event: cachedEvent.event}), function (listenerData) {
				    listenerData.handler.apply(listenerData.binding, ensureIsArray(cachedEvent.data));
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
	            },
			    /**
			     * @param {CachedEvent} event
			     * @param {PrivateData} candidateData
			     * @param {String} candidatePrefix
			     */
			    process: function processCachedEvent(event, candidateData, candidatePrefix) {
				    event.setupExpirationFor(candidateData);
				    event.whenUnhandledStoreIn(candidateData);
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
	        var permissionsMapForPrefix = _.find(source, function findByPrefixes(/**Entry*/entry) {
		        return ~_.indexOf(prefixes, entry.target);
	        });
	        return !!(permissionsMapForPrefix && ~_.indexOf(permissionsMapForPrefix.permissions, permit));
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
		        if (validator.apply(candidates, args)) {
			        callback.apply(candidates, args);
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
	     * @param {SandboxInfo} parentData
	     * @param {String} name
	     * @return {String}
	     */
	    function createPrefix(parentData, name) {
		    if (!root) { //root wasn't initialized yet
			    return rootName;
		    }

		    return parentData.childrenPrefix + name;
	    }

	    /**
	     * @param {String|Array} to name(s)
	     * @param {SandboxInfo} data
	     * @return {[]}
	     */
	    function addChildrenPrefix(to, data) {
		    if (_.isArray(to)) {
			    return _.map(to, function (target) {
				    return data.childrenPrefix + target;
			    });
		    } else {
			    return [data.childrenPrefix + to];
		    }
	    }


	    /**
	     * gets first not falsy value
	     * @param {*} initialValue
	     * @param {*} fallbackValue
	     * @return {*}
	     */
	    function getNotFalsy(initialValue, fallbackValue) {
		    return initialValue || fallbackValue;
	    }


	    /**
	     * returns object with a single key
	     * @param {String} key
	     * @param {*} value
	     * @return {{}}
	     */
	    function makeSimpleObject(key, value) {
		    var obj = {};
		    obj[key] = value;
		    return obj;
	    }


	    var rootName = '√';
	    var root = new Sandbox(rootName);

	    exports.Sandbox = Sandbox;
    })
);