/*global describe, it, expect, beforeEach, afterEach, jasmine*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandboxExport, _) {
		function name() {
			return _.uniqueId('sandbox_');
		}

		var parentName = 'Pa',
			Sandbox = sandboxExport.Sandbox,
            testData = {
                a: 1,
                b: 2
            };

        describe('sandbox api', function (param) {
	        var parent;
	        beforeEach(function () {
		        parent = new Sandbox(parentName, testData);
	        });
	        afterEach(function () {
		        parent.destroy();
	        });

            it('should have name', function () {
                expect(parent.name).toBe(parentName);
            });
            it('should throw when no name specified', function () {
                expect(function () {
                    //jshint nonew:false
	                new Sandbox();
                }).toThrow();
                expect(function () {
                    parent.kid();
                }).toThrow();
            });
            it('should have methods', function () {
	            _.each(['kid', 'data', 'on', 'off', 'emit', 'grant', 'revoke', 'destroy'], function (method) {
		            expect(parent[method]).toBeDefined();
	            });
            });
            it('should store data', function () {
	            var primitive = 5, s;
	            expect((s = new Sandbox(name(), primitive)).data()).toBe(primitive);
	            s.destroy();

	            var arr = [10];
	            expect((s = new Sandbox(name(), arr)).data()).toEqual(jasmine.objectContaining(arr));
	            s.destroy();
                expect(parent.data()).toEqual(jasmine.objectContaining(testData));
            });
	        it('should check that data is immutable', function () {
		        var data = parent.data();
		        data.c = 10;
		        expect(testData.c).not.toBeDefined();
		        expect(parent.data().c).not.toBeDefined();
		        var number = 20,
		            arr = [number],
			        s = new Sandbox(name(), arr),
			        sData = s.data();
		        sData[0] = number - 1;
		        sData[1] = number - 2;
		        expect(arr[0]).toBe(number);
		        expect(s.data()[0]).toBe(number);
		        expect(arr[1]).not.toBeDefined();
		        expect(s.data()[1]).not.toBeDefined();
		        s.destroy();
	        });
            it('should throw when call .data after .destroy', function () {
	            var s = new Sandbox(name(), testData);
	            s.destroy();
                expect(s.data).toThrow();
            });
        });
        describe('sandbox children', function () {
	        var parent, Father, Mother, Son, Daughter,
		        names = ['Father', 'Mother', 'Son', 'Daughter'];
	        beforeEach(function () {
		        parent = new Sandbox(parentName, testData);
		        Father = parent.kid(names[0]);
		        Mother = parent.kid(names[1]);
		        Son = Father.kid(names[2]);
		        Daughter = Father.kid(names[3]);
	        });
	        afterEach(function () {
		        parent.destroy();
	        });

            it('should be instance of Sandbox', function () {
                _.each([Father, Mother, Son, Daughter], function (obj) {
	                expect(obj).toEqual(jasmine.any(Sandbox));
                });
            });
            it('should throw if name is not unique', function () {
                expect(function () {
                    Father.kid(names[2]);
                }).toThrow();
	            expect(function () {
		            new Sandbox(parentName); // jshint ignore:line
	            }).toThrow();
            });
            it('should throw if name is same as parent/grand parent', function () {
                expect(function () {
	                Father.kid(names[0]);
                }).toThrow();
	            expect(function () {
		            Father.kid(parentName);
	            }).toThrow();
            });
	        it('should destroy children recursively', function () {
		        Father.destroy();
		        expect(Father.data).toThrow();
		        expect(Son.data).toThrow();
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
				sandbox = new Sandbox(name(), undefined, {
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
				sandbox = new Sandbox(name(), undefined, {
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
			var parent, Father, Mother, Son, Daughter, listener, listener2,
				names = ['Father', 'Mother', 'Son', 'Daughter'];
			beforeEach(function () {
				listener = jasmine.createSpy('listener');
				listener2 = jasmine.createSpy('listener');
				parent = new Sandbox(parentName, testData);
				Father = parent.kid(names[0]);
				Mother = parent.kid(names[1]);
				Son = Father.kid(names[2]);
				Daughter = Father.kid(names[3]);
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