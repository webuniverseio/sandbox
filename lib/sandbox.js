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

            var privateReference = [],
	            /**
	             * @type {PrivateData[]}
	             */
                privateData = [],
	            _defaults = {
		            cache: {
			            store: true,
			            expire: 0, //off by default
			            debounce: true
		            }
	            };

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

	        var tempParent = null;

	        function PrivateData(params) {
		        /**
		         * @type {Sandbox[]}
		         */
		        this.kids = [];
		        /**
		         * @type {Sandbox|null}
		         */
		        this.parent = params.parent;
		        /**
		         * @type {ListenerStorage[]}
		         */
		        this.listeners = [];
		        this.cache = [];
		        this.permissions = [];
		        /**
		         * @type {{cache: boolean, expire: number, debounce: boolean}}
		         */
		        this.settings = _.merge(_defaults, params.settings);
		        this.data = params.data;
	        }

	        /**
	         * @param {String} name
             * @param {*} [data]
             * @param {Object} [settings]
             * @constructor Sandbox
             */
            function Sandbox(name, data, settings) {
                if (!name) {
	                tempParent = null;
                    throw new SandboxError('name is required');
                }
	            var isRoot = name === rootName,
		            parent = tempParent || !isRoot && root || null;

	            var parentKids;
	            if (parent) {
		            parentKids = getPrivateData(parent).kids;
		            if (_.some(parentKids, _.partial(hasSameName, name)) || parent.name === name) {
			            //noinspection JSUnusedAssignment
			            tempParent = null;
			            throw new SandboxError('same level sandboxes should have unique names (' + name + ')');
		            }
		            parentKids.push(this);
	            } else if (isRoot && root) { //first time root will be undefined
		            //noinspection JSUnusedAssignment
		            tempParent = null;
		            throw new SandboxError(name + ' is reserved, please choose another name');
	            }

                this.name = name;

                var index = privateReference.push(this) - 1;

	            /**
	             * @type {PrivateData}
	             */
                privateData[index] = new PrivateData({parent: parent, settings: settings, data: data});

	            tempParent = null;
            }

            Sandbox.prototype = {
                constructor: Sandbox,
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

	        var rootName = '♥',
	            root = new Sandbox(rootName);

	        function defaults(newDefaults) {
		        if (newDefaults) {
			        _.merge(_defaults, newDefaults);
		        }
		        return _defaults;
	        }

	        /**
	         * get private data for sandbox instance
	         * @param {Sandbox} obj
	         * @return {*}
	         */
            function getPrivateData(obj) {
                //jshint validthis: true
                return privateData[_.indexOf(privateReference, obj)];
            }

	        /*
	         * sets/creates private data by key
	         * @param {String} key
	         * @param {*} data
	         * @this Sandbox
	         */
            /*function setPrivateData(key, data) {
                //jshint validthis: true
                getPrivateData(this)[key] = data;
            }*/

	        /**
	         * check if object has same name
	         * @param {String} name
	         * @param {Object} obj
	         * @return {Boolean}
	         */
            function hasSameName(name, obj) {
                return obj.name === name;
            }

	        /**
	         * creates new sandbox instance with parent-child references
	         * @this Sandbox
	         */
            function kid() {
                //jshint validthis: true
		        tempParent = this;
		        var Factory = _.partial.apply(_, [Sandbox].concat(_.toArray(arguments)));
		        return new Factory();
            }

	        /**
	         * @this Sandbox
	         * @return {*}
	         */
            function data() {
                //jshint validthis: true
	            var _data = getPrivateData(this).data;
                return _.isObject(_data) ? _.create(_data) : _data;
            }

	        /**
	         * @param {String} event
	         * @return {ListenerStorage[]}
	         */
            function getListenersForEvent(event) {
                //jshint validthis: true
	            var parentData = getPrivateData(this.parent);
                return _.where(
	                this.listeners.concat(parentData.listeners),
	                {event: event}
                );
            }

	        /**
	         * checks that listener has permissions and passes data over
	         * @param {Function[]} listeners
	         * @param {*} data
	         * @param {String} origin
	         * @this Sandbox
	         * @return {Boolean} true if listeners were called
	         */
	        function callListenersWithPermissions(listeners, data, origin) {
		        //jshint validthis: true
		        var that = this,
			        thisData = getPrivateData(that),
			        wereListenersCalled = false;
		        if (!origin) {
			        origin = this.name;
		        }
		        _.each(listeners, function (listener) {
			        var hasPermissions = _.find(thisData.permissions, {
						        target: origin,
						        source: listener.origin
					        }
				        ) || origin === listener.origin;

			        if (hasPermissions) {
				        listener.handler.apply(that, _.isArray(data) && data || [data]);
				        wereListenersCalled = true;
			        }
		        });

		        return wereListenersCalled;
	        }

	        function removeFromCache(thisData, cachedEvent) {
		        var index = _.findIndex(thisData.cache, cachedEvent);
		        thisData.cache.splice(index, 1);
	        }

	        /**
	         * @param {String} event
	         * @param {String} origin
	         * @this Sandbox
	         */
	        function callListenersWithCachedData(event, origin) {
		        //jshint validthis: true
		        var that = this,
			        thisData = getPrivateData(that),
			        parent = thisData.parent,
			        parentData = getPrivateData(parent),
			        cacheSettings = thisData.settings.cache;
		        if (!origin) {
			        origin = this.name;
		        }

		        _.each(parentData.cache, function (cachedEvent) {
			        var data = cachedEvent.data;
			        //remove in case some listeners fired
			        var result = callListenersWithPermissions.call(
					        parent,
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
						        removeFromCache(thisData, cachedEvent);
					        }, cacheSettings.expire);

					        if (cacheSettings.debounce) {
						        cachedEvent.invalidate = timingFn;
					        }
				        }
			        } else if (result) {
				        removeFromCache(thisData, cachedEvent);
			        }
		        });
	        }

	        /**
	         * subscribes handler to event
	         * @param {String} event
	         * @param {Function} handler
	         * @this Sandbox
	         */
	        function on(event, handler) {
		        //jshint validthis: true
		        var that = this,
		            name = that.name,
                    thisData = getPrivateData(that),
			        parentData = getPrivateData(thisData.parent);

		        parentData.listeners.push({
                    origin: name,
                    event: event,
                    handler: handler
                });

                if (thisData.settings.cache.store) {
	                callListenersWithCachedData.call(that, event, name);
                }

		        return that;
            }

	        /**
	         * emits event with given data
	         * @param {String} event
	         * @param {*} data
	         * @this Sandbox
	         */
            function emit(event, data) {
	            //jshint validthis: true
		        var that = this,
			        name = that.name,
			        thisData = getPrivateData(that),
			        parentData = getPrivateData(thisData.parent);

	            parentData.cache.push({
		            origin: name,
		            event: event,
		            data: data,
		            invalidate: null
	            });

	            callListenersWithCachedData.call(that, event, name);

		        return that;
            }

	        /**
	         * unsubscribe handlers from event
	         * @param {String} event
	         * @this Sandbox
	         */
	        function off(event) {
		        //jshint validthis: true
		        var name = this.name,
			        thisData = getPrivateData(this),
			        parent = thisData.parent,
			        parentData = getPrivateData(parent);
		        _.remove(parentData.listeners, function (listener) {
			        return listener.origin === name;
		        });

		        return this;
	        }

            /**
             * grant permissions to sandbox
             * @param {String|Array} to
             * @param {Object} permissions
             * @this Sandbox
             */
            function grant(to, permissions) {
	            //TODO: sandboxes should safe only permissions for themselves
                //jshint validthis: true
                if (arguments.length === 1) {
                    permissions = to;
                    to = this.name;
                }
                if (typeof to === 'string') {
                    to = [to];
                }

                var thisData = getPrivateData(this);

	            simplePermissions.grant(thisData.permissions, to, permissions);

	            return this;
            }

	        /**
	         * revoke permissions from sandbox
	         * @param {String|Array} from
	         * @param {Object} permissions
	         * @this Sandbox
	         */
            function revoke(from, permissions) {
                //jshint validthis: true
                if (arguments.length === 1) {
                    permissions = from;
                    from = this.name;
                }
                if (typeof from === 'string') {
                    from = [from];
                }

                var thisData = getPrivateData(this);
	            simplePermissions.revoke(thisData.permissions, from, permissions);

		        return this;
            }

	        /**
	         * @this Sandbox
	         */
            function destroy() {
		        // TODO: interesting technique - to make sure that function is not recreated each time you might take
		        // advantage of calling a function with 'this'
                //jshint validthis: true
		        var that = this,
		            index = _.indexOf(privateReference, that),
                    data = privateData.splice(index, 1),
	                parentData = getPrivateData(data[0].parent);
                privateReference.splice(index, 1);
		        _.invoke(data.kids, 'destroy');
		        _.pull(parentData.kids, that);
		        _.remove(parentData.cache, function (cachedEvent) {
			        return cachedEvent.origin === that.name;
		        });
		        _.remove(parentData.listeners, function (listener) {
			        return listener.origin === that.name;
		        });
            }

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