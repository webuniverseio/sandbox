/*global describe, it, expect, jasmine*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandboxExport, _) {
		var parentName = 'Pa';
		var Sandbox = sandboxExport.Sandbox,
            testData = {
                a: 1,
                b: 2
            },
            parent = new Sandbox(parentName, testData);

        describe('sandbox api', function (param) {
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
	            var primitive = 5;
	            expect(new Sandbox('s', primitive).data()).toBe(primitive);
	            var arr = [];
	            expect(new Sandbox('s', arr).data()).toEqual(arr);
                expect(parent.data()).toEqual(testData);
            });
	        it('should check that data is immutable', function () {
		        var data = parent.data();
		        data.c = 10;
		        expect(testData.c).not.toBeDefined();
		        expect(parent.data().c).not.toBeDefined();
		        var number = 20,
		            arr = [number],
			        s = new Sandbox('s', arr),
			        sData = s.data();
		        sData[1] = 10;
		        expect(arr[0]).toBe(number);
		        expect(s.data()[0]).toBe(number);
		        expect(arr[1]).not.toBeDefined();
		        expect(s.data()[1]).not.toBeDefined();
	        });
            it('should throw when call .data after .destroy', function () {
	            var s = new Sandbox('s', testData);
	            s.destroy();
                expect(s.data).toThrow();
            });
        });
        describe('sandbox children', function (param) {
            var names = ['Father', 'Mother', 'Son', 'Daughter'];
            var Father = parent.kid(names[0]),
                Mother = parent.kid(names[1]),
                Son = Father.kid(names[2]),
                Daughter = Father.kid(names[3]);
            it('should be instance of Sandbox', function () {
                _.each([Father, Mother, Son, Daughter], function (obj) {
	                expect(obj).toEqual(jasmine.any(Sandbox));
                });
            });
            it('should throw if name is not unique', function () {
                expect(function () {
                    Father.kid(names[2]);
                }).toThrow();
            });
            it('should throw if name is same as parent', function () {
                expect(function () {
                    Father.kid(names[0]);
                }).toThrow();
            });
        });

		describe('sandbox events functionality', function () {
			it('should subscribe, fire, unsubscribe to/from event', function () {
				var data = [
					'parent.on will get that',
					'plus that'
				];
				var listener = jasmine.createSpy('listener'),
					listener2 = jasmine.createSpy('listener2');

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
				expect(listener.callCount).toEqual(2);
				expect(listener2.callCount).toEqual(1);
			});

			/*parent.emit('someOtherEvent', 'this might (based on cache settings) be passed to parent when it\'ll
			start to listen');
			parent.on('someOtherEvent', function (data) {*//*...*//*}); //will receive notification right away if data
			was cached and upon next notification call

			Father.on('someOtherEvent', function (data) {*//*...*//*});
			Mother.on('someOtherEvent', function (data) {*//*...*//*});
			parent.emit('someOtherEvent', 'Father and Mother will not get this data, but parent will');
			Father.emit('someOtherEvent', 'parent and Mother will not get this data, but Father will');

			Father.emit('someOtherEvent', 'parent will not get this data (yet), but Father will');*/
		});

		/*it('check that Base can receive and emit cached events internally (without permissions) asynchronously',
		 function (done) {
		 var s = new Sandbox('B'),
		 receivedValue = false,
		 receivedValue2 = 0;
		 setTimeout(function () {
		 s.notify('someEvent', true);
		 s.notify('someOtherEvent', 1);
		 }, 200);

		 setTimeout(function () {
		 s.listen('someEvent', function (value) {
		 receivedValue = value;
		 });
		 s.listen('someOtherEvent', function (value) {
		 receivedValue2 = value;
		 });
		 }, 400);

		 setTimeout(function () {
		 expect(receivedValue).toEqual(true);
		 expect(receivedValue2).toEqual(1);
		 done();
		 }, 600);
		 });*/

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