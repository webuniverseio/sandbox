/*global describe, it, expect, beforeEach, afterEach, jasmine, spyOn*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandboxExport, _) {
		var Sandbox = sandboxExport.Sandbox;
		var testData = {
                a: 1,
                b: 2
            };

        describe('sandbox api', function () {
	        var foo;
	        beforeEach(function () {
		        foo = new Sandbox(testData);
	        });
	        afterEach(function () {
		        foo.destroy();
	        });

            it('should have methods', function () {
	            _.each(
		            ['kid', 'data', 'on', 'off', 'emit', 'trigger', 'grant', 'revoke', 'destroy', 'name'],
		            function (method) {
			            expect(foo[method]).toBeDefined();
		            }
	            );
            });
	        it('should have static methods', function () {
		        expect(Sandbox.defaults).toBeDefined();
	        });
	        it('can have name', function () {
		        var name = 'whoa';
		        var s = new Sandbox(name);
		        expect(s.name()).toBe(name);
		        s.destroy();
	        });
            it('can store data', function () {
	            var primitive = 5;
	            var bar = new Sandbox(primitive);
	            expect(bar.data()).toBe(primitive);
	            bar.destroy();

	            var arr = [10];
	            bar = new Sandbox(arr);
	            expect(bar.data()).toEqual(jasmine.objectContaining(arr));
	            bar.destroy();
                expect(foo.data()).toEqual(jasmine.objectContaining(testData));
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
			var listener, listener2, listener3;
			var sandbox, sandbox2;
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
				if (sandbox) {
					sandbox.destroy();
					sandbox = null;
				}
				if (sandbox2) {
					sandbox2.destroy();
					sandbox2 = null;
				}
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
				sandbox = new Sandbox();
				sandbox
					.on('someEvent', testListener, test)
					.emit('someEvent');

				expect(testListener.calls.all()[0].object).toBe(test);
			});

			it('cache settings could be adjusted through Sandbox.defaults', function (done) {
				var defaults = _.cloneDeep(Sandbox.defaults());
				Sandbox.defaults({
					cache: {
						expire: 1000
					}
				});
				sandbox = new Sandbox();
				sandbox.emit('someEvent', data);
				setTimeout(function () {
					//should wait for expire time
					sandbox.on('someEvent', listener);
					expect(listener).toHaveBeenCalledWith(data[0], data[1]);
				}, 750);

				Sandbox.defaults(defaults);
				sandbox2 = new Sandbox();
				sandbox2.emit('someEvent', data);
				setTimeout(function () {
					sandbox2.on('someEvent', listener2);
					expect(listener2).toHaveBeenCalledWith(data[0], data[1]);
					done();
				}, 760);
			});
			it('should store events in a cache if no listeners existed yet', function (done) {
				sandbox = new Sandbox();
				sandbox.settings({
					cache: {
						expire: 1000
					}
				});
				sandbox.emit('someEvent', data);
				sandbox.on('someEvent', listener);
				expect(listener).toHaveBeenCalledWith(data[0], data[1]);
				setTimeout(function () {
					//should wait for expire time
					sandbox.on('someEvent', listener2);
					expect(listener2).toHaveBeenCalledWith(data[0], data[1]);
				}, 750);
				setTimeout(function () {
					//because it works as debounce by default
					sandbox.on('someEvent', listener2);
					expect(listener2).toHaveBeenCalledWith(data[0], data[1]);
				}, 1500);
				setTimeout(function () {
				    //expired
					sandbox.on('someEvent', listener3);
					expect(listener3).not.toHaveBeenCalled();
					done();
				}, 3000);
			});

			it('should store events in a cache and expire after timeout', function (done) {
				sandbox = new Sandbox();
				sandbox.settings({
					cache: {
						expire: 1000,
						debounce: false
					}
				});
				sandbox.emit('someEvent', data);
				sandbox.on('someEvent', listener);
				expect(listener).toHaveBeenCalledWith(data[0], data[1]);
				setTimeout(function () {
					//should wait for expire time
					sandbox.on('someEvent', listener2);
					expect(listener2).toHaveBeenCalledWith(data[0], data[1]);
				}, 750);
				setTimeout(function () {
					//because it works as debounce by default
					sandbox.on('someEvent', listener2);
					expect(listener2).toHaveBeenCalledWith(data[0], data[1]);
					done();
				}, 1500);
			});
		});

		describe('sandbox permissions', function () {
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
					expect(listener).toHaveBeenCalledWith(data[0], data[1]);
					parent.on('someEvent', listener2);
					parent.emit('someEvent', data[0]);
					expect(listener).toHaveBeenCalledWith(data[0]);
					expect(listener2).toHaveBeenCalledWith(data[0]);
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
					parent
						.grant(Father.name(), {Mother: [event]})
						.revoke(Father.name(), {Mother: [event]});
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
					permissions[parentName] = ['ping'];
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
					anonymous1
						.grant(permissionsMap)
						.on('ping', listener);
					anonymous2.emit('ping');
					anonymous1
						.revoke(permissionsMap);
					anonymous2.emit('ping');
					expect(listener.calls.count()).toBe(1);
				});
			});
		});
	});
}());