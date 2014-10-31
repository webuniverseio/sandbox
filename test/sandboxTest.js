(function () {
	'use strict';
	//fallback for node testing
	var environment = typeof window === 'object' ? 'browser' : 'node',
		define, config, path, cwd;
	if (environment === 'node') {
		path = require('path');
		config = require(path.join(__dirname, 'test-main'));
		cwd = process.cwd();
		define = function define(deps, cb) {
			deps = deps.map(function (name) {
				var module = config.paths[name];
				if (!(name in config.paths)) {
					module = path.join(cwd, config.projectMainFolder + name);
				}
				return require(module);
			});
			cb.apply(null, deps);
		};
	} else {
		define = window.define;
	}

	define(['sandbox', '_'], function (/** SandboxExports */sandbox, _) {
		var Sandbox = sandbox.constructor;
		//var SandboxError = sandboxExport.SandboxError;

		describe('sandbox base api', function () {
			var foo;
			var testData = {
				a: 1,
				b: 2
			};
			beforeEach(function () {
				foo = new Sandbox(testData);
			});
			afterEach(function () {
				foo.destroy();
			});

			it('instance should have methods', function () {
				_.each(
					['kid', 'data', 'on', 'off', 'emit', 'trigger', 'grant', 'revoke', 'destroy', 'name', 'settings'],
					function (method) {
						expect(foo[method]).toBeDefined();
					}
				);
			});

			it('should have static methods', function () {
				expect(Sandbox.defaults).toBeDefined();
			});

			it('always have name', function () {
				var name = 'whoa';
				var bar = new Sandbox(name);
				expect(bar.name()).toBe(name);
				bar.destroy();

				var baz = new Sandbox();
				expect(baz.name()).toBeDefined();
				baz.destroy();
			});

			it('can store data', function () {
				expect(foo.data()).toEqual(jasmine.objectContaining(testData));

				var primitive = 5;
				var bar = new Sandbox(primitive);
				expect(bar.data()).toBe(primitive);
				bar.destroy();

				var arr = [10];
				bar = new Sandbox(arr);
				expect(bar.data()).toEqual(jasmine.objectContaining(arr));
				bar.destroy();
			});

			it('should check that data is immutable', function () {
				var data = foo.data();
				data.c = 10;
				expect(testData.c).not.toBeDefined();
				expect(foo.data().c).not.toBeDefined();

				var number = 20,
					arr = [number],
					bar = new Sandbox(arr),
					sData = bar.data();
				sData[0] = number - 1;
				sData[1] = number - 2;
				expect(arr[0]).toBe(number);
				expect(bar.data()[0]).toBe(number);
				expect(arr[1]).not.toBeDefined();
				expect(bar.data()[1]).not.toBeDefined();
				bar.destroy();
			});

			it('should throw when call .data after .destroy', function () {
				var bar = new Sandbox();
				bar.destroy();
				expect(_.bind(bar.data, bar)).toThrow();
			});

			it('should throw when settings are not an object', function () {
				var bar = new Sandbox();
				var invalidSettings = _.bind(bar.settings, bar, 5);
				var validSettings = _.bind(bar.settings, bar, {});
				expect(invalidSettings).toThrow();
				expect(validSettings).not.toThrow();
			});
		});

		describe('sandbox children', function () {
			var foo, bar, baz, qux;
			beforeEach(function () {
				foo = new Sandbox('foo');
				bar = foo.kid('bar');
				baz = bar.kid('baz');
				qux = baz.kid('qux');
			});
			afterEach(function () {
				foo.destroy();
				bar.destroy();
				baz.destroy();
				qux.destroy();
			});

			it('should be instance of Sandbox', function () {
				_.each([bar, baz, qux], function (obj) {
					expect(obj).toEqual(jasmine.any(Sandbox));
				});
			});

			it('should throw if siblings have same name', function () {
				expect(_.bind(foo.kid, foo, 'bar')).toThrow();
			});
		});

		describe('sandbox events functionality', function () {
			/**
			 * @type {jasmine.Spy|function}
			 */
			var listener;
			var foo;
			var originalTimeout;

			beforeEach(function() {
				listener = jasmine.createSpy('listener');

				originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
				jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
			});

			afterEach(function() {
				jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
				if (foo) {
					foo.destroy();
					foo = null;
				}
			});

			it('on is same as trigger', function () {
				foo = new Sandbox();
				expect(foo.emit).toBe(foo.trigger);
			});

			it('should call listener in bounded context', function () {
				var test = {
					value: 'abc',
					getValue: function getValue() {
						return this.value;
					}
				};
				/**
				 * @type {void|jasmine.Spy|function}
				 */
				var testListener = spyOn(test, 'getValue').and.callThrough();
				foo = new Sandbox();
				foo.on('someEvent', testListener, test);
				foo.emit('someEvent');

				expect(testListener.calls.all()[0].object).toBe(test);
			});

			it('should unsubscribe listeners for given event', function () {
				foo = new Sandbox();
				foo.on('someEvent', listener);
				foo.off('someEvent');
				foo.emit('someEvent');

				expect(listener.calls.count()).toBe(0);
			});

			it('should unsubscribe listeners for given event', function () {
				foo = new Sandbox();
				foo.on('someEvent', listener);
				foo.off('someEvent');
				foo.emit('someEvent');

				expect(listener.calls.count()).toBe(0);
			});
		});

		describe('test defaults', function() {
			/**
			 * @type {jasmine.Spy|function}
			 */
			var listener;
			/**
			 * @type {jasmine.Spy|function}
			 */
			var listener2;
			/**
			 * @type {jasmine.Spy|function}
			 */
			var listener3;
			var foo, bar;
			var data = [
				'aaa',
				'bbb'
			];
			var originalTimeout;

			beforeEach(function() {
				listener = jasmine.createSpy('listener');
				listener2 = jasmine.createSpy('listener2');
				listener3 = jasmine.createSpy('listener3');

				originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
				jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
			});

			afterEach(function() {
				jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
				if (foo) {
					foo.destroy();
					foo = null;
				}
				if (bar) {
					bar.destroy();
					bar = null;
				}
			});

			it('should return an object', function() {
				expect(Sandbox.defaults()).toEqual(jasmine.any(Object));
			});

			it('by default should store events in cache without expiration ' +
			'if listeners did not handle an event', function(done) {
				bar = new Sandbox();
				var eventName = 'someEvent';
				bar.emit(eventName, data);
				setTimeout(function () {
					bar.on(eventName, listener);
					expect(listener.calls.count()).toBe(1);
					var mostRecentCall = listener.calls.mostRecent();
					expect(mostRecentCall.args[0].type).toBe(eventName);
					expect(mostRecentCall.args[1]).toBe(data[0]);
					expect(mostRecentCall.args[2]).toBe(data[1]);
				}, 1200);
				setTimeout(function () {
					bar.off('someEvent').on('someEvent', listener2);
					expect(listener.calls.count()).toBe(1);
					expect(listener2.calls.count()).toBe(1);
					done();
				}, 2000);
			});

			it('possible to overwrite instance defaults', function (done) {
				bar = new Sandbox();
				bar.settings({
					cache: {
						expire: 1000
					}
				});
				bar.emit('someEvent', data);
				setTimeout(function () {
					bar.on('someEvent', listener);
					expect(listener.calls.count()).toBe(0);
					done();
				}, 1200);
			});

			it('possible to setup event expiration', function (done) {
				var defaults = _.cloneDeep(Sandbox.defaults());
				Sandbox.defaults({
					cache: {
						expire: 1000
					}
				});
				foo = new Sandbox();
				var eventName = 'someEvent';
				foo.emit(eventName, data);
				setTimeout(function () {
					//should wait for expire time
					foo.on(eventName, listener);
					expect(listener.calls.count()).toBe(1);
					var mostRecent = listener.calls.mostRecent();
					expect(mostRecent.args[1]).toBe(data[0]);
					expect(mostRecent.args[2]).toBe(data[1]);
					done();
				}, 750);

				Sandbox.defaults(defaults);
			});

			it('possible to set not to store events in cache', function(done) {
				var defaults = _.cloneDeep(Sandbox.defaults());
				Sandbox.defaults({
					cache: {
						store: false,
						expire: 2000
					}
				});
				bar = new Sandbox();
				bar.emit('someEvent', data);
				setTimeout(function () {
					bar.on('someEvent', listener);
					expect(listener.calls.count()).toBe(0);
					done();
				}, 1200);
				Sandbox.defaults(defaults);
			});

			it('debounce event expiration by default', function (done) {
				foo = new Sandbox();
				foo.settings({
					cache: {
						expire: 1000
					}
				});
				var eventName = 'someEvent';
				foo.emit(eventName, data);
				foo.on(eventName, listener);
				expect(listener.calls.count()).toBe(1);
				var mostRecent = listener.calls.mostRecent();
				expect(mostRecent.args[1]).toBe(data[0]);
				expect(mostRecent.args[2]).toBe(data[1]);
				setTimeout(function () {
					//should wait for expire time
					foo.on(eventName, listener2);
					expect(listener2.calls.count()).toBe(1);
					mostRecent = listener2.calls.mostRecent();
					expect(mostRecent.args[1]).toBe(data[0]);
					expect(mostRecent.args[2]).toBe(data[1]);
				}, 750);
				setTimeout(function () {
					//because it works as debounce by default
					foo.on(eventName, listener3);
					expect(listener3.calls.count()).toBe(1);
				}, 1500);
				setTimeout(function () {
					//expired
					foo.on(eventName, listener3);
					expect(listener3.calls.count()).toBe(1);
					done();
				}, 3000);
			});

			it('should store events in a cache and expire after timeout', function (done) {
				foo = new Sandbox();
				foo.settings({
					cache: {
						expire: 1000,
						debounce: false
					}
				});
				foo.emit('someEvent', data);
				foo.on('someEvent', listener);
				expect(listener.calls.count()).toBe(1);
				setTimeout(function () {
					//should wait for expire time
					foo.on('someEvent', listener2);
					expect(listener2.calls.count()).toBe(1);
				}, 750);
				setTimeout(function () {
					//expired
					foo.on('someEvent', listener2);
					expect(listener2.calls.count()).toBe(1);
					done();
				}, 1500);
			});
		});

		describe('sandbox permissions', function () {
			var testData = {
				a: 1,
				b: 2
			};
			var parent, Father, Mother, Son, Daughter, listener, listener2;
			var parentName = 'Parent';
			beforeEach(function () {
				listener = jasmine.createSpy('listener');
				listener2 = jasmine.createSpy('listener');
				parent = new Sandbox(parentName, testData);
				Father = parent.kid('Father');
				Mother = parent.kid('Mother');
				Son = Father.kid('Son');
				Daughter = Father.kid('Daughter');
			});
			afterEach(function () {
				parent.destroy();
				Father.destroy();
				Mother.destroy();
				Son.destroy();
				Daughter.destroy();
			});

			describe('parent from itself', function() {
				it('always get events without permissions', function () {
					var data = [
						'parent.on will get that',
						'plus that'
					];
					parent.on('someEvent', listener);
					expect(listener).not.toHaveBeenCalled();
					parent.emit('someEvent', data);
					expect(listener.calls.count()).toBe(1);
					parent.on('someEvent', listener2);
					parent.emit('someEvent', data[0]);
					expect(listener.calls.count()).toBe(2);
					expect(listener2.calls.count()).toBe(1);
					parent.off('someEvent');
					parent.emit('someEvent', data);
					expect(listener.calls.count()).toEqual(2);
					expect(listener2.calls.count()).toEqual(1);
				});
			});

			describe('when permissions granted and revoked right away', function() {
				it('nothing should be called', function () {
					var data = [
						'parent.on will get that',
						'plus that'
					];
					var event = 'someEvent';
					parent.grant(Father.name(), {Mother: [event]});
					parent.revoke(Father.name(), {Mother: [event]});
					Father.on(event, listener);
					Mother.emit(event, data);
					expect(listener.calls.count()).toEqual(0);
				});
			});

			describe('kids from parents', function() {
				it('can\'t get events', function () {
					Father.on('ping', listener);
					parent.emit('ping');
					expect(listener.calls.count()).toBe(0);
				});

				it('can get events with proper permissions', function () {
					var permissions = {};
					permissions[parent.name()] = ['ping'];
					parent.grant(['Father', 'Mother'], permissions);
					Father.on('ping', listener);
					Mother.on('ping', listener);
					parent
						.emit('ping')
						.revoke(['Father', 'Mother'], permissions)
						.emit('ping');
					expect(listener.calls.count()).toBe(2);
				});
			});

			describe('kids from kids', function() {
				it('can\'t get events', function () {
					Father.on('ping', listener);
					Mother.emit('ping');
					expect(listener.calls.count()).toBe(0);
				});

				it('can get events with proper permissions', function () {
					parent
						.grant(Father.name(), {Mother: ['ping']})
						.grant(Mother.name(), {Father: ['pong']});
					Father.on('ping', listener);
					Mother.on('pong', listener2);
					Mother.emit('ping');
					Father.emit('pong');
					parent
						.revoke(Father.name(), {Mother: ['ping']})
						.revoke(Mother.name(), {Father: ['pong']});
					Mother.emit('ping');
					Father.emit('pong');
					expect(listener.calls.count()).toBe(1);
					expect(listener2.calls.count()).toBe(1);
				});
			});

			describe('parent from kids', function() {
				it('can\'t get events', function () {
					Father.on('ping', listener);
					Son.emit('ping');
					expect(listener.calls.count()).toBe(0);
				});

				it('can get events with proper permissions', function () {
					parent
						.grant({Father: ['ping']})
						.on('ping', listener);
					Father.emit('ping');
					parent
						.revoke({Father: ['ping']});
					Father.emit('ping');
					expect(listener.calls.count()).toBe(1);
				});
			});

			describe('anonymous sandboxes', function() {
				it('can setup permissions using .name()', function () {
					var anonymous1 = new Sandbox();
					var anonymous2 = anonymous1.kid();
					var permissionsMap = {};
					permissionsMap[anonymous2.name()] = ['ping'];
					anonymous1.grant(permissionsMap);
					anonymous1.on('ping', listener);
					anonymous2.emit('ping');
					anonymous1.revoke(permissionsMap);
					anonymous2.emit('ping');
					expect(listener.calls.count()).toBe(1);
					anonymous1.destroy();
					anonymous2.destroy();
				});
			});
		});
		describe('asynchronous execution', function () {
			var parentName = 'Parent';
			var testData = {x: 1, y: 2};
			var parent, Father, Mother, Son, Daughter, listener, listener2;
			beforeEach(function () {
				/**
				 * @type {jasmine.Spy|Function}
				 */
				listener = jasmine.createSpy('listener');
				/**
				 * @type {jasmine.Spy|Function}
				 */
				listener2 = jasmine.createSpy('listener');
				parent = new Sandbox(parentName);
			});
			afterEach(function () {
				parent.destroy();
				Father.destroy();
				Mother.destroy();
			});

			it('should execute listener', function (done) {
				parent.grant('Mother', {Father: ['data']});
				setTimeout(function () {
					Father = parent.kid('Father');
					Father.emit('data', testData);
				}, 100);
				setTimeout(function () {
					Mother = parent.kid('Mother');
					Mother.on('data', listener);
					expect(listener.calls.argsFor(0)[1]).toBe(testData);
					Mother.grant(['Daughter', 'Son'], {Mother: ['kiss']});
					//Son was behaving bad, and will not get a kiss :(
					Mother.revoke('Son', {Mother: ['kiss']});
					Mother.emit('kiss');
					setTimeout(function () {
						Son = Mother.kid('Son');
						Daughter = Mother.kid('Daughter');
						Son.on('kiss', listener2);
						Daughter.on('kiss', listener2);
						expect(listener2.calls.count()).toBe(1);
						done();
					}, 200);
				}, 200);
			});
		});
		describe('all together', function () {
			it('all listeners should be called', function(done) {
				/**
				 * @type {jasmine.Spy|Function}
				 */
				var listener = jasmine.createSpy('listener');
				/**
				 * @type {jasmine.Spy|Function}
				 */
				var listener2 = jasmine.createSpy('listener');
				var anonymous1 = new Sandbox('1');
				anonymous1.settings({
					cache: {
						expire: 200
					}
				});
				var anonymous11 = anonymous1.kid('1.1');
				var anonymous12Name = '1.2';
				var permissionsMap = _.object([anonymous1.name()], [['ping']]);
				anonymous1.grant([anonymous11.name(), anonymous12Name], permissionsMap);
				var anonymous12 = anonymous1.kid(anonymous12Name);

				anonymous11.on('ping', listener);
				anonymous1.emit('ping');
				expect(listener.calls.count()).toBe(1);
				setTimeout(function () {
					anonymous12.on('ping', listener2);
					expect(listener2.calls.count()).toBe(1);
				}, 100);
				setTimeout(function () {
					anonymous1.revoke([anonymous12.name()], permissionsMap);
					anonymous12.on('ping', listener2);
					expect(listener2.calls.count()).toBe(1);
					anonymous1.destroy();
					anonymous11.destroy();
					anonymous12.destroy();
					done();
				}, 250);
			});
		});
	});
}());