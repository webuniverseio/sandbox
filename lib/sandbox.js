/*global exports*/
/**
 * @file Event driven Sandbox implementation with permission management for modular architecture
 * 1) sandbox can send and receive inside itself
   2) order of listeners and notifications doesn't matter, data should be cached and cache should be cleaned
      (with every delivered message or by timeout)
   3) sandbox manager can control who gets notifications from whom (allow/deny)
   4) sandbox can be destroyed to free resources
 * @author Sergey Zarouski, http://webuniverse.ca
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
        var Sandbox = (function () {
	        /**
	         * @typedef {{origin: String, event: String, handler: Function}} ListenerStorage
	         */

            var instanceReference = [],
	            /**
	             * @type {InstanceData[]}
	             */
                instanceData = [],
		        /**
		         * @type {Object.<String, PrivateData[]>}
		         */
		        privateData = {},
	            _defaults = {
		            cache: {
			            store: true,
			            expire: 0, //off by default
			            debounce: true
		            }
	            },
	            tempParent = null,
		        rootName = '√';

	        /**
	         * get private data for sandbox instance
	         * @param {Sandbox} obj
	         * @return {*}
	         */
            var getInstanceData = function (obj) {
                return instanceData[_.indexOf(instanceReference, obj)];
            };

	        /**
	         * @param {String} key
	         * @return {PrivateData}
	         */
	        var getPrivateData = function (key) {
		        return privateData[key];
	        };
	        var getPrivateDataByRegex = function (regex) {
		        return _.pick(privateData, function (data, prefix) {
			        return regex.test(prefix);
		        });
	        };

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

	        /**
	         * @this Sandbox
	         * @return {String}
	         */
	        var getName = function () {
		        return getInstanceData(this).name;
	        };

	        /**
	         * creates new sandbox instance with parent-child references
	         * @this Sandbox
	         */
            var kid = function () {
		        tempParent = this;
		        var Factory = _.partial.apply(_, [Sandbox].concat(_.toArray(arguments)));
		        return new Factory();
            };

	        /**
	         * @this Sandbox
	         * @return {*}
	         */
            var data = function data() {
	            var _data = getInstanceData(this).data;
                return _.isObject(_data) ? _.create(_data) : _data;
            };

	        function getKidListeners(kid) {
		        return getInstanceData(kid).listeners;
	        }

	        /**
	         * @param {String} event
	         * @return {ListenerStorage[]}
	         */
            var getListenersForEvent = function getListenersForEvent(event) {
	            var parentData = getInstanceData(this.parent),
		            siblingsAndSelfListeners = _.map(parentData.kids, getKidListeners),
		            kidListeners = _.map(this.kids, getKidListeners);
                return _.where(
	                _.flatten(kidListeners.concat([siblingsAndSelfListeners, parentData.listeners])),
	                {event: event}
                );
            };

	        /**
	         * checks that listener has permissions and passes data over
	         * @param {Function[]} listeners
	         * @param {*} data
	         * @param {String} origin
	         * @this Sandbox
	         * @return {Boolean} true if listeners were called
	         */
	        var callListenersWithPermissions = function (listeners, data, origin) {
		        var that = this,
			        thisData = getInstanceData(that),
			        parentData = getInstanceData(thisData.parent),
			        wereListenersCalled = false;

		        _.each(listeners, function (listener) {
			        var hasPermissions = _.find(thisData.permissions.concat(parentData.permissions), {
						        target: listener.origin
					        }
				        ) || origin === listener.origin;

			        if (hasPermissions) {
				        listener.handler.apply(that, _.isArray(data) && data || [data]);
				        wereListenersCalled = true;
			        }
		        });

		        return wereListenersCalled;
	        };

	        function removeEventFromCache(cache, event) {
		        var index = _.findIndex(cache, event);
		        cache.splice(index, 1);
	        }

	        /**
	         * @param {String} event
	         * @this Sandbox
	         */
	        var callListenersWithCachedData = function (event) {
		        var that = this,
			        thisData = getInstanceData(that),
			        parent = thisData.parent,
			        parentData = getInstanceData(parent),
			        cacheSettings = thisData.settings.cache;

		        _.each(parentData.cache, function (cachedEvent) {
			        //TODO: see if origin check can happen before calling listeners
			        var data = cachedEvent.data;
			        //remove in case some listeners fired
			        var result = callListenersWithPermissions.call(
					        that,
					        getListenersForEvent.call(thisData, event),
					        data,
					        origin
				        ),
				        timingFnName = cacheSettings.debounce ? 'debounce' : 'delay',
				        timingFn;
			        if (result && cacheSettings.expire) {
				        if (cachedEvent.invalidate) {
					        cachedEvent.invalidate();
				        } else {
					        timingFn = _[timingFnName](function () {
						        removeEventFromCache(parentData, cachedEvent);
					        }, cacheSettings.expire);

					        if (cacheSettings.debounce) {
						        cachedEvent.invalidate = timingFn;
					        }
				        }
			        } else if (result) {
				        removeEventFromCache(parentData, cachedEvent);
			        }
		        });
	        };

	        /**
	         * checks if source could be found by prefix and contains permit
	         * @param {Array} source
	         * @param {String} permit
	         * @param {String} sourcePrefix
	         * @return {boolean}
	         */
	        function hasPermitByPrefix(source, permit, sourcePrefix) {
		        var permissionsForPrefix = _.find(source, {target: sourcePrefix});
		        return !!(permissionsForPrefix && ~_.indexOf(permissionsForPrefix.properties, permit));
	        }

	        /**
	         * validates source prefix against candidate's permissions for a given permit
	         * if source's prefix is the same as candidate's, permit is not required
	         * @param {String} sourcePrefix
	         * @param {String} permit
	         * @param candidateData
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
	         * executes callback for candidates which pass validation
	         * @param {Object} candidates collection
	         * @param {Function} validator
	         * @param {Function} callback
	         */
	        function forValidPermissions(candidates, validator, callback) {
		        _.each(candidates, function (privateData, prefix) {
			        var args = _.toArray(arguments);
			        if (validator.apply(null, args)) {
				        callback.apply(null, args);
			        }
		        });
	        }

	        function ensureisArray(param) {
		        return _.isArray(param) ? param : [param];
	        }

	        /**
	         * subscribes handler to event
	         * @param {String} event
	         * @param {Function} handler
	         * @this Sandbox
	         */
	        var on = function (event, handler) {
		        var that = this;
		        var thisData = getInstanceData(that);
		        var thisPrefix = thisData.prefix;
		        var candidates = {};
		        var parentPrefix = thisData.parentData.prefix;
		        var siblingPrefixRegExp = new RegExp(
				        thisData.parentData.prefix +
				        thisData.parentData.childPrefix + '[^/]*$'
			        );
		        var kidsPrefixRegExp = new RegExp(thisPrefix + '.+');
		        var eventHandler = {
				        event: event,
				        handler: handler
			        };

		        candidates[parentPrefix] = getPrivateData(parentPrefix);
		        _.each(
			        _.extend(
				        getPrivateDataByRegex(siblingPrefixRegExp),
				        getPrivateDataByRegex(kidsPrefixRegExp)
			        ),
			        function (privateData, prefix) {
				        candidates[prefix] = privateData;
			        }
		        );

		        var thisPrivateData = candidates[thisPrefix];
		        thisPrivateData.listeners.push(eventHandler);

		        forValidPermissions(
			        candidates,
			        _.partial(permitIsValid, thisPrefix, event),
			        function (privateData, prefix) {
				        if (privateData.cache.length && privateData.listeners.length) {
					        _.each(_.filter(privateData.cache, {event: event}), function (cachedEvent) {
						        _.each(thisPrivateData.listeners, function (listenerData) {
							        listenerData.handler.apply(that, ensureisArray(cachedEvent.data));
							        if (cachedEvent.invalidate) {
								        cachedEvent.invalidate();
							        }
						        });
					        });
				        }
			        }
		        );

		        //TODO: should really invoke only own listeners

                /*if (thisData.settings.cache.store) {
	                callListenersWithCachedData.call(that, event, name);
                }*/

		        return that;
            };

	        /**
	         * emits event with given data
	         * @param {String} event
	         * @param {*} data
	         * @this Sandbox
	         */
            var emit = function (event, data) {
		        var that = this;
				var thisData = getInstanceData(that);
				var thisPrefix = thisData.prefix;
				var candidates = {};
				var parentPrefix = thisData.parentData.prefix;
				var siblingPrefixRegExp = new RegExp(
				        thisData.parentData.prefix +
				        thisData.parentData.childPrefix + '[^/]*$'
			        );
				var kidsPrefixRegExp = new RegExp(thisPrefix + '.+');
				var cachedEvent = {
				        event: event,
				        data: data,
				        invalidate: false
			        };

		        candidates[parentPrefix] = getPrivateData(parentPrefix);
		        _.each(
			        _.extend( //TODO: no need to go over privateData twice
				        getPrivateDataByRegex(siblingPrefixRegExp),
				        getPrivateDataByRegex(kidsPrefixRegExp)
			        ),
			        function (privateData, prefix) {
			            candidates[prefix] = privateData;
		            }
		        );

		        forValidPermissions(
			        candidates,
			        _.partial(permitIsValid, thisPrefix, event),
			        function (privateData, prefix) {
				        var cacheSettings = thisData.settings.cache;
				        var storeInCache = cacheSettings.store;
				        var candidateListeners = privateData.listeners;
				        var timingFnName = cacheSettings.debounce ? 'debounce' : 'delay';
				        var timingFn;
				        if (candidateListeners.length) {
					        storeInCache = false;
					        _.each(_.filter(candidateListeners, {event: event}), function (listenerData) {
						        listenerData.handler.apply(that, ensureisArray(data));
					        });
				        }
				        if (storeInCache) {
					        privateData.cache.push(cachedEvent);
				        }

				        if (cacheSettings.expire) {
					        if (cachedEvent.invalidate) {
						        cachedEvent.invalidate();
					        } else {
						        timingFn = _[timingFnName](function () {
							        removeEventFromCache(privateData.cache, cachedEvent);
						        }, cacheSettings.expire);

						        if (cacheSettings.debounce) {
							        cachedEvent.invalidate = timingFn;
						        }
					        }
				        }
			        }
		        );

	            /*callListenersWithCachedData.call(that, event);*/

		        return that;
            };

	        /**
	         * unsubscribe handlers from event
	         * @param {String} event
	         * @this Sandbox
	         */
	        var off = function (event) {
		        var that = this;
		        var thisData = getInstanceData(that);
		        var thisPrivateData = privateData[thisData.prefix];

		        _.remove(thisPrivateData.listeners, function (listener) {
			        return listener.event === event;
		        });

		        return this;
	        };

            /**
             * grant permissions to sandbox
             * @param {String|Array} to
             * @param {Object} permissions
             * @this Sandbox
             */
            var grant = function (to, permissions) {
	            //TODO: should store permissions in kids own privateData
	            var that = this;
	            var thisData = getInstanceData(that);
	            var thisPrefix = thisData.prefix;
	            var candidates = {};
	            var kidsPrefixRegExp = new RegExp(thisPrefix + '.+');

	            _.extend(
		            candidates,
		            getPrivateDataByRegex(kidsPrefixRegExp)
	            );

	            //TODO: if only permissions passed consider applying to all kids
                /*if (arguments.length === 1) {
                    permissions = to;
                    to = thisData.name;
                }*/

	            if (_.isArray(to)) {
		            to = _.map(to, function (target) {
			            return thisData.prefix + thisData.childPrefix + target;
		            });
	            } else {
		            to = [thisData.prefix + thisData.childPrefix + to];
	            }

	            _.each(candidates, function (privateData, prefix) {
		            if (~_.indexOf(to, prefix)) {
			            simplePermissions.grant(privateData.permissions, prefix, permissions);
		            }
	            });

	            return this;
            };

	        /**
	         * revoke permissions from sandbox
	         * @param {String|Array} from
	         * @param {Object} permissions
	         * @this Sandbox
	         */
            var revoke = function (from, permissions) {
		        var thisData = getInstanceData(this);
		        if (arguments.length === 1) {
                    permissions = from;
                    from = thisData.name;
                }

	            simplePermissions.revoke(thisData.permissions, from, permissions);

		        return this;
            };

	        /**
	         * @this Sandbox
	         */
            var destroy = function () {
		        // TODO: interesting technique - to make sure that function is not recreated each time you might take
		        // advantage of calling a function with 'this'
		        var that = this,
		            index = _.indexOf(instanceReference, that),
                    data = instanceData.splice(index, 1),
	                parentData = data[0].parentData;
                instanceReference.splice(index, 1);
		        _.invoke(data.kids, 'destroy');
		        _.pull(parentData.kids, that);
		        delete privateData[data[0].prefix];
            };

	        function defaults(newDefaults) {
		        if (newDefaults) {
			        _.merge(_defaults, newDefaults);
		        }
		        return _defaults;
	        }

	        /**
	         * creates sandbox error
	         * @param {String} message
	         * @constructor
	         */
	        function SandboxError(message) {
		        this.message = message;
	        }
	        SandboxError.prototype = new Error();
	        SandboxError.prototype.constructor = SandboxError;

	        /**
	         * @param {Object} params
	         * @constructor
	         */
	        function InstanceData(params) {
		        this.name = params.name;
		        this.prefix = params.prefix;
		        this.childPrefix = params.childPrefix;

		        /**
		         * @type {Sandbox|null}
		         */
		        this.parentData = params.parentData;
		        /**
		         * @type {{cache: boolean, expire: number, debounce: boolean}}
		         */
		        this.settings = _.merge(_.cloneDeep(_defaults), params.settings);
		        this.data = params.data;
	        }

	        /**
	         * @constructor
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
	         * @param {String} [name] optional, but highly recommended if you use grant/revoke functionality
	         * @param {*} [data]
	         * @param {Object} [settings]
	         * @constructor Sandbox
	         */
	        function Sandbox(name, data, settings) {
		        var parent = tempParent || root || null,
			        parentData = parent ? getInstanceData(parent) : null,
			        index = instanceReference.push(this) - 1,
			        noName = _.uniqueId('empty'),
			        childPrefix = _.uniqueId('/') + '/',
			        prefix = !root ? rootName : [
				        (parent ? parentData.prefix : ''),
				        parentData.childPrefix,
					    name || noName
			        ].join('');

		        if (prefix in privateData) {
			        tempParent = null;
			        throw new SandboxError([
				        'Siblings can\'t have same names. ',
				        name,
				        ' already exists.'
			        ].join(''));
		        }

		        /**
		         * @type {InstanceData}
		         */
		        instanceData[index] = new InstanceData({
			        name: name || noName,
			        prefix: prefix,
			        childPrefix: childPrefix,
			        parentData: parentData,
			        settings: settings,
			        data: data
		        });
		        privateData[prefix] = new PrivateData();

		        tempParent = null;
	        }

	        Sandbox.prototype = {
		        constructor: Sandbox,
		        name: getName,
		        kid: kid,
		        data: data,
		        on: on,
		        off: off,
		        emit: emit,
		        grant: grant,
		        revoke: revoke,
		        destroy: destroy
	        };
	        Sandbox.prototype.trigger = Sandbox.prototype.emit;
	        Sandbox.defaults = defaults;

	        var root = new Sandbox(rootName);

            return Sandbox;
        })();

        /**
         * @typedef {{Sandbox: Sandbox}} SandboxExports
         */
        var _exports = {
            Sandbox: Sandbox
        };
        _.extend(
            exports,
            _exports
        );
    })
);