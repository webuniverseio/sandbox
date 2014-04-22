/*global describe, it, expect, runs, waitsFor*/
(function () {
	'use strict';
	define(['sandbox', '_'], function (/** SandboxExports */sandbox, _) {
		var Sandbox = sandbox.Base,
		    SandboxManager = sandbox.Manager;
		describe('test sandboxes interface', function () {
			it('should contain Base and Manager constructors', function () {
				expect(typeof sandbox.Base === 'function' && typeof sandbox.Manager === 'function').toBe(true);
			});
			it('both Manager and Base can accept both {moduleName: String} and string for constructor initialization', function () {
				var sandboxNames = [];
				function success() {
					_.each({
						sm: new SandboxManager('sm1'),
						sm2: new SandboxManager({
							moduleName: 'sm2'
						}),
						s: new Sandbox('s1'),
						s2: new Sandbox({
							moduleName: 's2'
						})
					}, function (sandbox) {
						var name = sandbox.moduleName;
						if (name) {
							sandboxNames.push(name);
						}
					});
				}
				function failManager() {
					//noinspection JSUnusedLocalSymbols
					var sm = new SandboxManager();
				}
				function failSandbox() {
					//noinspection JSUnusedLocalSymbols
					var s = new Sandbox();
				}
				expect(success).not.toThrow();
				expect(failManager).toThrow();
				expect(failSandbox).toThrow();
				expect(sandboxNames.length).toEqual(4);
			});
			it('Manager should have allow and deny methods', function () {
				var sm = new SandboxManager('test');
				expect(typeof sm.allow === 'function' && typeof sm.deny === 'function').toBe(true);
			});
			it('Make sure prototype chain is correct', function () {
				var sm = new SandboxManager('test');
				expect(sm instanceof SandboxManager).toBe(true);
				expect(sm instanceof Sandbox).toBe(true);
			});
			it('Base should have listen, notify, forget and destroy methods', function () {
				var s = new Sandbox('test');
				expect(
						typeof s.listen === 'function' &&
						typeof s.notify === 'function' &&
						typeof s.forget === 'function' &&
						typeof s.destroy === 'function'
				).toBe(true);
			});
		});
		describe('test sandbox api synchronously', function () {
			it('check that Manager can receive and emit not cached events internally (without permissions)', function () {
				var sm = new SandboxManager('Core'),
				    receivedValue = true,
				    receivedValue2 = 1;
				sm.listen('someEvent', function (value) {
					receivedValue = value;
				});
				sm.listen('someOtherEvent', function (value) {
					receivedValue2 = value;
				});
				sm.notify('someEvent', false);
				sm.notify('someOtherEvent', 0);

				expect(receivedValue).toEqual(false);
				expect(receivedValue2).toEqual(0);
			});

			it('check that Base can receive and emit cached events internally (without permissions)', function () {
				var s = new Sandbox('A'),
				    receivedValue = false,
				    receivedValue2 = 0;
				s.notify('someEvent', true);
				s.notify('someOtherEvent', 1);
				s.listen('someEvent', function (value) {
					receivedValue = value;
				});
				s.listen('someOtherEvent', function (value) {
					receivedValue2 = value;
				});

				expect(receivedValue).toEqual(true);
				expect(receivedValue2).toEqual(1);
			});

			it('check that Base can receive and emit cached events internally (without permissions) asynchronously', function (done) {
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
			});
		});
	});
}());