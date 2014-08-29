/*global describe, it, expect, beforeEach, afterEach, jasmine*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandboxExport, _) {
		var Sandbox = sandboxExport.Sandbox,
            testData = {
                a: 1,
                b: 2
            };

        describe('sandbox api', function (param) {
	        var foo;
	        beforeEach(function () {
		        foo = new Sandbox(false, testData);
	        });
	        afterEach(function () {
		        foo.destroy();
	        });

            it('should have methods', function () {
	            _.each(['kid', 'data', 'on', 'off', 'emit', 'grant', 'revoke', 'destroy', 'name'], function (method) {
		            expect(foo[method]).toBeDefined();
	            });
            });
	        it('can have name', function () {
		        var name = 'whoa';
		        expect(new Sandbox(name).name()).toBe(name);
	        });
            it('should store data', function () {
	            var primitive = 5, bar;
	            expect((bar = new Sandbox(false, primitive)).data()).toBe(primitive);
	            bar.destroy();

	            var arr = [10];
	            expect((bar = new Sandbox(false, arr)).data()).toEqual(jasmine.objectContaining(arr));
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
			        bar = new Sandbox(false, arr),
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
                expect(bar.data).toThrow();
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
	        });

            it('should be instance of Sandbox', function () {
                _.each([bar, baz, qux], function (obj) {
	                expect(obj).toEqual(jasmine.any(Sandbox));
                });
            });
	        it('should throw if siblings have same name', function () {
		        expect(_.bind(foo.kid, foo, 'bar')).toThrow();
	        });
	        it('should destroy children recursively', function () {
		        foo.destroy();
		        expect(bar.data).toThrow();
		        expect(qux.data).toThrow();
	        });
        });

		describe('sandbox events functionality', function () {
			var listener, listener2, listener3,
				sandbox,
				data = [
					'parent.on will get that',
					'plus that'
				],
				originalTimeout;

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
				}
			});

			it('should store events in a cache if no listeners existed yet', function (done) {
				sandbox = new Sandbox(false, undefined, {
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
				sandbox = new Sandbox(false, undefined, {
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
						.revoke(['Father', 'Mother'], permissions);
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
						.grant(Father.name, {Mother: ['ping']})
						.grant(Mother.name, {Father: ['pong']});
					Father.on('ping', listener);
					Mother.on('pong', listener2);
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
					expect(listener.calls.count()).toBe(1);
				});
			});
		});
		 //subscribe parent to receive Father['someOtherEvent'] notifications
		/*parent.grant({Father: ['someOtherEvent']});
		Father.emit('someOtherEvent', 'parent will get that message from Father');
		parent.emit('someOtherEvent', 'only parent will get that message, because Father wasn\'t subscribed
		 to get messages from parent');
		parent
			.grant('Father', {parent: ['someOtherEvent']})
			.grant('Mother', {parent: ['someOtherEvent']})
			//or parent.grant(['Father', 'Mother'], {parent: ['someOtherEvent']});
			.emit('someOtherEvent', 'parent, Father and Mother will get that notification from parent');
		parent
			.off('someOtherEvent')
			.reject('Father', {parent: ['someOtherEvent']})
			.reject('Mother', {parent: ['someOtherEvent']})
			//or parent.reject(['Father', 'Mother'], {parent: ['someOtherEvent']});
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
		Son.on('feedBackEvent', function (data) {*//*got feedback*//*});
		Daughter.on('feedBackEvent', function (data) {*//*got feedback*//*});
		Father.reject(['Daughter', 'Son'], {Father: ['feedBackEvent']});*/
	});
}());