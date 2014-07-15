/*global describe, it, expect, runs, waitsFor*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandboxExport, _) {
        var Sandbox = sandboxExport.Sandbox,
            testData = {
                a: 1,
                b: 2
            },
            GrandParent = new Sandbox('Granny', testData);

        describe('test api', function (param) {
            it('should have name', function () {
                expect(GrandParent.name).toEqual('Granny');
            });
            it('should throw when no name specified', function () {
                expect(function () {
                    var t = new Sandbox();
                }).toThrow();
                expect(function () {
                    GrandParent.kid();
                }).toThrow();
            });
            it('should have methods', function () {
                expect(GrandParent.kid).toBeDefined();
                expect(GrandParent.data).toBeDefined();
                expect(GrandParent.on).toBeDefined();
                expect(GrandParent.off).toBeDefined();
                expect(GrandParent.emit).toBeDefined();
                expect(GrandParent.grant).toBeDefined();
                expect(GrandParent.revoke).toBeDefined();
                expect(GrandParent.destroy).toBeDefined();
            });
            it('should store data', function () {
                expect(GrandParent.data()).toEqual(testData);
            });
            it('should throw when call .data after .destroy', function () {
                GrandParent.destroy();
                expect(GrandParent.data).toThrow();
            });
        });
        describe('test children', function (param) {
            var names = ['Father', 'Mother', 'Son', 'Daughter'];
            var Father = GrandParent.kid(names[0]),
                Mother = GrandParent.kid(names[1]),
                Son = Father.kid(names[2]),
                Daughter = Father.kid(names[3]);
            it('should be instance of Sandbox', function () {
                expect(_.every([Father, Mother, Son, Daughter], function (obj) {
                    return obj instanceof Sandbox;
                })).toBeTruthy();
            });
            it('should throw if kid name is not unique', function () {
                expect(function () {
                    Father.kid(names[2]);
                }).toThrow();
            });
            it('should throw if kid name is same as parent', function () {
                expect(function () {
                    Father.kid(names[0]);
                }).toThrow();
            });
        });

		describe('test sandbox api synchronously', function () {
			/*it('check that Base can receive and emit cached events internally (without permissions) asynchronously', function (done) {
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

		});

		/*
		GrandParent.on('someEvent', function (data) {*//*...*//*}); //listen for event
		GrandParent.emit('someEvent', 'GrandParent.on will get that');
		GrandParent.off('someEvent');

		GrandParent.emit('someOtherEvent', 'this might (based on cache settings) be passed to GrandParent when it\'ll start to listen');
		GrandParent.on('someOtherEvent', function (data) {*//*...*//*}); //will receive notification right away if data was cached and upon next notification call

		Father.on('someOtherEvent', function (data) {*//*...*//*});
		Mother.on('someOtherEvent', function (data) {*//*...*//*});
		GrandParent.emit('someOtherEvent', 'Father and Mother will not get this data, but GrandParent will');
		Father.emit('someOtherEvent', 'GrandParent and Mother will not get this data, but Father will');

		Father.emit('someOtherEvent', 'GrandParent will not get this data (yet), but Father will');
		GrandParent.grant({Father: ['someOtherEvent']}); //subscribe GrandParent to receive Father['someOtherEvent'] notifications
		Father.emit('someOtherEvent', 'GrandParent will get that message from Father');
		GrandParent.emit('someOtherEvent', 'only GrandParent will get that message, because Father wasn\'t subscribed to get messages from GrandParent');
		GrandParent
			.grant('Father', {GrandParent: ['someOtherEvent']})
			.grant('Mother', {GrandParent: ['someOtherEvent']})
			//or GrandParent.grant(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
			.emit('someOtherEvent', 'GrandParent, Father and Mother will get that notification from GrandParent');
		GrandParent
			.off('someOtherEvent')
			.reject('Father', {GrandParent: ['someOtherEvent']})
			.reject('Mother', {GrandParent: ['someOtherEvent']})
			//or GrandParent.reject(['Father', 'Mother'], {GrandParent: ['someOtherEvent']});
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