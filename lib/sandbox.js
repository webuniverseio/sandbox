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

//TODO: make sure that deny cleans cache, overall check how cache management works (including callbacks storage)

// Sandbox module provides access to specific settings which are set upon sandbox initialization.
// It also provides convenient way to publish/subscribe data between modules, with events data caching - something so
// important when you work with AMD.
/*
(function (root, factory) {
	'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['exports', '_'], factory);
    } else if (typeof exports === 'object') {
        factory(exports, require('_'));
    } else {
        factory((root.sandbox = {}), root._);
    }
}(this, function initSandBox(exports, _) {
	'use strict';

		//used for caching event data
		//structure: {event1: [{namespace: moduleSuffix, type: event1_moduleSuffix, data: mixed}, ...], ...}
	var eventCache = {},
	    //store callbacks related to events
	    //structure: {event1_moduleSuffix: [callback: function, ...], ...}
	    eventCallbacks = {},
	    //manager decides which events should be delivered to which modules
	    //permissions separation structure: {emitterModule1: {targetModule1: ['event1', 'event2', ...], ...}, ...}
	    eventPermissions = {},
	    //event subscription list used to track for which events sandbox was subscribed and
	    //unsubscribe from them upon module destruction
	    eventSubscriptionsList = [],
	    //registered names used to check which modules are currently registered
	    //in order to figure out if we need to send them messages
	    registeredNames = [];

	*/
/*

	function SandboxError(message) {
		this.message = message;
	}
	SandboxError.prototype = new Error();
	SandboxError.prototype.constructor = SandboxError;

	*/
/*

	function Sandbox(props) {
		var propsIsString = typeof props === 'string';
		if (!(_.isPlainObject(props) && ('moduleName' in props) || propsIsString)) {
			throw new SandboxError('sandbox moduleName should be set');
		}

		//if only module name was passed
		if (propsIsString) {
			props = {
				moduleName: props
			};
		}

		if (!~_.indexOf(registeredNames, props.moduleName)) {
			registeredNames.push(props.moduleName);
		}

		_.extend(this, props);
	}
	Sandbox.prototype = {
		constructor: Sandbox,
		listen: function (event, callback, onlyFresh) {
			//>>excludeStart("production", pragmas.production);
			console.assert(
				typeof event === 'string',
				'event should be a string, instead was: ',
				event
			);
			console.assert(
				typeof callback === 'function',
				'callback should be a function, instead was: ',
				callback
			);
			//>>excludeEnd("production");
			var that = this;

			//eventDataSet has following structure [[e, data1], [e, data2], ...]
			//set event listener
//			if (settings.log) {
//				console.log('\'' + that.moduleName + '\' is listening for \'' + event + '\'');
//			}

			var fullEventName = event + '_' + that.moduleName;

			eventSubscriptionsList.push({namespace: that.moduleName, event: event});
			if (!(fullEventName in eventCallbacks)) {
				eventCallbacks[fullEventName] = [];
			}
			eventCallbacks[fullEventName].push(function () {
//				if (settings.log) {
//					console.log('\'' + that.moduleName + '\' received \'' + event + '\' notification');
//				}

				callback.apply(this, [].slice.call(arguments));
			});

			//check if event was already in cache
			var eventDataSet;
			if (event in eventCache) {
				eventDataSet = eventCache[event];
				//you would normally use each here, however remove will also iterate through collection
				//and based on app settings we can control if we want to store cache or clean it after handler
				_.remove(eventDataSet, function (dataEntry) {
					//iterate through cache for this particular event and check if event was for that particular module
					if (dataEntry.namespace === that.moduleName) {
						//if so fire event
						if (!onlyFresh) {
							_.each(eventCallbacks, function (callbacks, triggerEvent) {
								if (triggerEvent === fullEventName) {
									_.each(callbacks, function (callback) {
										callback(dataEntry.data, {
											type: dataEntry.type
										});
									});
								}
							});
						}
//						if (!settings.keepCachedEvents) {
//							return true;
//						}
					}
					return false;
				});
			}

			return that;
		},
		//see addSubscription property for Sandbox initialization for better understanding
		notify: function (event, data) {
			//>>excludeStart("production", pragmas.production);
			console.assert(
				typeof event === 'string',
				'event should be a string, instead was: ',
				event
			);
			//>>excludeEnd("production");
			var that = this;

			//check if event have permissions to be triggered/added to cache...
			_.each(eventPermissions, function (emitterModulesRules, emitterModuleName) {
				//...if yes then...
				if (emitterModuleName === that.moduleName) {
					//...go through target modules rules and...
					_.each(emitterModulesRules, function (targetEventsMap, targetModuleName) {
						//...go through events map per target module and if event name is in allowed list...
						if (~_.indexOf(targetEventsMap, event) && ~_.indexOf(registeredNames, targetModuleName)) {
							//...add events data to cache and trigger event
							addEventToCacheAndTrigger(emitterModuleName, targetModuleName, event, data);
						}
					});
				}
			});

			//trigger event for module itself
			addEventToCacheAndTrigger(that.moduleName, that.moduleName, event, data);

			return that;
		},
		forget: function (event, wipeCache) {
			//>>excludeStart("production", pragmas.production);
			console.assert(
				typeof event === 'string',
				'event should be a string, instead was: ',
				event
			);
			//>>excludeEnd("production");
			var that = this;

			_.remove(eventCallbacks, function (callbacks, triggerEvent) {
				//noinspection RedundantIfStatementJS
				if (triggerEvent === event + '_' + that.moduleName) {
//					if (settings.log) {
//						console.log('\'' + that.moduleName + '\' stopped listening for \'' + event + '\'');
//					}

					return true;
				}

				return false;
			});

			var eventDataSet;
			//check if event was already in cache and wipeCache tag wasn't set
			if (wipeCache && event in eventCache) {
				eventDataSet = eventCache[event];
				_.remove(eventDataSet, function (dataEntry, key) {
					//iterate through cache for this particular event and check if event was for that particular module
					return dataEntry.namespace === that.moduleName;
				});
			}

			return that;
		},
		destroy: function () {
			var that = this;

			_.remove(eventSubscriptionsList, function (subscription) {
				if (that.moduleName === subscription.namespace) {
					that.forget(subscription.event);
					return true;
				}
				return false;
			});

			var registeredIndex = _.indexOf(registeredNames, that.moduleName);
			registeredNames.splice(registeredIndex, 1);
		}
	};

	*/
/*

	function SandboxManager(props) {
		Sandbox.call(this, props);
	}
	SandboxManager.prototype = _.create(Sandbox.prototype, {
		constructor: SandboxManager,
		allow: function (forModule, eventsMap) {
			//if there is no second argument
			if (arguments.length === 1) {
				//assume eventsMap was passed in first argument
				eventsMap = forModule;
				//and current Manager module name should be used
				forModule = this.moduleName;
			}

			//add permissions for event for selected module
			addToEventPermissions(forModule, eventsMap);
			return this;
		},
		deny: function (forModule, eventsMap) {
			//if there is no second argument
			if (arguments.length === 1) {
				//assume eventsMap was passed in first argument
				eventsMap = forModule;
				//and current Manager module name should be used
				forModule = this.moduleName;
			}

			removeFromEventPermissions(forModule, eventsMap);
			return this;
		}
	});

	//adds new event to cache and trigger event
	function addEventToCacheAndTrigger(moduleName, targetModuleName, event, data) {
//		if (settings.log) {
//			console.log('\'' + (moduleName) + '\' is sending \'' + event + '\' notification to \''
+ targetModuleName + '\':', data);
//		}

		var fullEventName = event + '_' + targetModuleName;

		if (!(event in eventCache)) {
			eventCache[event] = [];
		}

		//push new event to cache
		eventCache[event]
			.push({
				type: fullEventName,
				namespace: targetModuleName,
				data: data
			});

		_.each(eventCallbacks, function (callbacks, triggerEvent) {
			if (triggerEvent === fullEventName) {
				_.each(callbacks, function (callback) {
					callback(data, {
						type: fullEventName
					});
				});
			}
		});
	}

	function addToEventPermissions(moduleName, eventsMap) {
		//>>excludeStart("production", pragmas.production);
		console.assert(
			eventsMap instanceof Object,
			'eventsMap should be an Object: ',
			eventsMap
		);
		//>>excludeEnd("production");
		if (eventsMap instanceof Object) {
//			if (settings.log) {
//				_.each(eventsMap, function (targetModuleEvents, targetModuleName) {
//					console.log('\'' + targetModuleName + '\' allowed to receive \'' +
targetModuleEvents.join('\', \'') + '\' notifications from \'' + moduleName + '\'');
//				});
//			}

			//add events map to permissions:
			//1) if there are existing event maps for that module then...
			if (moduleName in eventPermissions) {
				//...merge existing events map with new one...
				_.merge(eventPermissions[moduleName], eventsMap, function (a, b) {
					//...in a way to ensure that events are not repeating (union)
					return _.isArray(a) ? _.union(a, b) : undefined;
				});
			}
			//2) if there are no event maps for that module, lets add first one
			else {
				eventPermissions[moduleName] = eventsMap;
			}
		}
	}
	function removeFromEventPermissions(moduleName, eventsMap) {
		//>>excludeStart("production", pragmas.production);
		console.assert(
				eventsMap instanceof Object,
			'eventsMap should be an Object: ',
			eventsMap
		);
		//>>excludeEnd("production");
		if (eventsMap instanceof Object) {
//			if (settings.log) {
//				_.each(eventsMap, function (targetModuleEvents, targetModuleName) {
//					console.log('\'' + targetModuleName + '\' denied to receive \'' +
targetModuleEvents.join('\', \'') + '\' notifications from \'' + moduleName + '\'');
//				});
//			}

			//check if we have any permissions for that module...
			_.each(eventPermissions, function (emitterModuleRules, emitterModuleName) {
				//...if yes then...
				if (moduleName === emitterModuleName) {
					//...subtract matching rules for modules...
					eventPermissions[moduleName] = _.difference(emitterModuleRules, eventsMap);
				}
			});
		}
	}

	_.extend(exports,
	*//*

	{
		Base: Sandbox,
		Manager: SandboxManager
	});
}));*/

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
    function initSandBox(/*Object*/exports, /*_.LoDashStatic*/_, /*PermissionsExports*/simplePermissions) {
        'use strict';

        /* {
        *      name: 'Granny',
        *      _settings: {cache: true},
        *      _cache: [],
        *      _permissions: [],
        *      _parent: null,
        *      _kids: [],
        *      _listeners: {}
        * }
        */
        var Sandbox = (function () {
            var privateReference = [],
	            /**
	             * @type {PrivateData[]}
	             */
                privateData = [],
	            _defaults = {
		            cache: {
			            store: true
		            }
	            };

            function SandboxError(message) {
                this.message = message;
            }
            SandboxError.prototype = new Error();
            SandboxError.prototype.constructor = SandboxError;

	        function F() {}
	        function objectCreateLite(prototype) {
		        F.prototype = prototype;
		        return new F();
	        }

            /**
             * @param name
             * @param data
             * @param settings
             * @constructor Sandbox
             */
            function Sandbox(name, data, settings) {
                if (!name) {
                    throw new SandboxError('name is required');
                }
                this.name = name;

                var index = privateReference.push(this) - 1;

	            /**
	             * @typedef {{origin: String, event: String, handler: Function}} ListenerStorage
	             */

	            /**
	             * @typedef {{kids: Sandbox[], parent: (Sandbox|null), listeners: ListenerStorage[], cache: Array,
	             * permissions: Array,
	             * settings: {cache: {store: boolean, timeout: number, debounce: boolean}}, data: *}} PrivateData
	             */

	            /**
	             * @type {PrivateData}
	             */
                privateData[index] = {
                    kids: [],
	                parent: root,
                    listeners: [],
                    cache: [],
                    permissions: [],
                    settings: _.merge(_defaults, settings),
                    data: data
                };
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

	        var root = new Sandbox('♥');

	        function defaults(newDefaults) {
		        _.merge(_defaults, newDefaults);
	        }

            function getPrivateData(obj) {
                //jshint validthis: true
                return privateData[_.indexOf(privateReference, obj)];
            }
            function setPrivateData(key, data) {
                //jshint validthis: true
                getPrivateData(this)[key] = data;
            }

            var addParent = _.partial(setPrivateData, 'parent');

            function hasSameName(name, obj) {
                return obj.name === name;
            }

            function kid(name) {
                //jshint validthis: true
	            var parent = this,
		            kids = getPrivateData(parent).kids;

                if (_.some(kids, _.partial(hasSameName, name)) || parent.name === name) {
                    throw new SandboxError('kids should have unique names');
                }
                var kido = new Sandbox(name);
                kids.push(kido);
                addParent.call(kido, parent);

                return kido;
            }

            function data() {
                //jshint validthis: true
	            var _data = getPrivateData(this).data;
                return _.isObject(_data) ? objectCreateLite(_data) : _data;
            }

            function getListenersForEvent(event) {
                //jshint validthis: true
                return _.where(this.listeners, {event: event});
            }

	        /**
	         * checks that listener has permissions and passes data over
	         * @param {Function[]} listeners
	         * @param {*} data
	         * @return {Boolean} true if listeners were called
	         */
	        function callListenersWithPermissions(listeners, data) {
		        //jshint validthis: true
		        var that = this,
			        thisData = getPrivateData(that),
			        name = this.name,
			        wereListenersCalled = false;
		        _.each(listeners, function (listener) {
			        var hasPermissions = _.find(thisData.permissions, {
						        target: name,
						        source: listener.origin
					        }
				        ) || name === listener.origin;

			        if (hasPermissions) {
				        listener.handler.apply(that, _.isArray(data) && data || [data]);
				        wereListenersCalled = true;
			        }
		        });

		        return wereListenersCalled;
	        }

	        /**
	         * @param {String} event
	         */
	        function callListenersWithCachedData(event) {
		        //jshint validthis: true
		        var that = this,
			        thisData = getPrivateData(that),
		            parent = thisData.parent,
		            parentData = getPrivateData(parent);

		        _.remove(parentData.cache, function (cachedEvent) {
			        var data = cachedEvent.data;
			        //remove in case some listeners fired
			        return callListenersWithPermissions.call(
				        that,
				        getListenersForEvent.call(parentData, event),
				        data
			        );
		        });
	        }

	        function on(event, handler) {
		        //jshint validthis: true
		        var name = this.name,
                    thisData = getPrivateData(this),
			        parent = thisData.parent,
			        parentData = getPrivateData(parent);

		        parentData.listeners.push({
                    origin: name,
                    event: event,
                    handler: handler
                });

                if (thisData.settings.cache.store) {
	                callListenersWithCachedData.call(this, event);
                }
            }

            function emit(event, data) {
	            //jshint validthis: true
	            var name = this.name,
		            thisData = getPrivateData(this),
		            parent = thisData.parent,
		            parentData = getPrivateData(parent);

	            parentData.cache.push({
		            origin: name,
		            event: event,
		            data: data
	            });

	            callListenersWithCachedData.call(this, event);
            }

	        function off(event) {
		        //jshint validthis: true
		        var name = this.name,
			        thisData = getPrivateData(this),
			        parent = thisData.parent,
			        parentData = getPrivateData(parent);
		        _.remove(parentData.listeners, function (listener) {
			        return listener.origin === name;
		        });
	        }

            /**
             * @param {String|Array|Object} to
             * @param {Object} permissions
             */
            function grant(to, permissions) {
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
            }

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
            }

            function destroy() {
	            //TODO: should also clean parentsData cache
                //jshint validthis: true
                var index = _.indexOf(privateReference, this);
                privateReference.splice(index, 1);
                privateData.splice(index, 1);
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