# Sandbox
Sandbox implementation with permission management for modular architecture
- Crossbrowser (IE8+)/Crossplatform
- tested with ~100% coverage
- support for event-driven architecture
- order of listeners and notifications doesn't matter, data will be cached and cache will be cleaned (when message is
delivered or by timeout/debounce) - really useful for AMD and upcoming ES6 modules
- parent-siblings-child permissions management via grant/revoke
- sandbox can be destroyed to free resources
- if you plan to use sandbox as data proxy you can immutable plain arrays/objects by default
- caching strategies can be defined on various levels
- familiar API

License
- http://unlicense.org/

________
##Installation:
`bower install simple-permissions`    
`npm install simple-permissions`

##Tests:
To launch tests make sure you have `karma-cli` installed globally and run `npm install`.
For browsers run `npm test` (you might want to adjust karma.conf.js). For node `npm run test-node`.

If you want to contribute make sure you have `grunt-cli` installed globally and run `grunt`. Please don't include _dist_ folder in your commit.

##API:
```js
/**
 * constructs a sandbox
 * @param {String} [name] sandbox name
 * @param {*} [data] stores data
 * @name Sandbox
 */
function Sandbox(name, data) {
}

/**
 * returns sandbox instance name
 * @return {String} sandbox name
 */
Sandbox.prototype.name = function getSandboxName() {
};
/**
 * sets sandbox specific settings for cache adjustments, etc
 * @param {Object} settings cache adjustment, etc
 */
Sandbox.prototype.settings = function setSandboxSettings(settings) {
};
/**
 * Settings example (those are defaults)
 */
var defaultSettings = {
	cache: {
		store: true,
		expire: 0, //off
		debounce: true
	}
};
/**
 * creates a new Sandbox instance, changes current parent, so that Sandbox constructor can create
 * parent-child relations
 * @return {Sandbox}
 */
Sandbox.prototype.kid = function createSandboxKid() {
};
/**
 * returns immutable sandbox instance data
 * @return {*} sandbox data
 */
Sandbox.prototype.data = function getSandboxData() {
};
/**
 * subscribes handler to event
 * @param {String} eventName event name
 * @param {Function} handler event handler
 * @param {Object} [thisBinding=this] this binding
 */
Sandbox.prototype.on = function sandboxOn(eventName, handler, thisBinding) {
};
/**
 * unsubscribes handlers from event
 * @param {String} eventName event name
 */
Sandbox.prototype.off = function sandboxOff(eventName) {
};
/**
 * emits event with given data
 * @param {String} eventName event name
 * @param {*} [data] event data
 */
Sandbox.prototype.emit = function sandboxEmit(eventName, data) {
};
/**
 * @see emit
 */
Sandbox.prototype.trigger = Sandbox.prototype.emit;

/**
 * grants permissions
 * @param {String|String[]} [to] sandbox name(s) to grant permissions to
 * @param {Object.<String, String[]>} permissionsMap permissions map
 */
Sandbox.prototype.grant = function () {to, permissionsMap}

/**
 * revokes permissions
 * @param {String|String[]} [from] sandbox name(s) to revoke permissions from
 * @param {Object.<String, String[]>} permissionsMap permissions map
 */
Sandbox.prototype.revoke = function () {from, permissionsMap}

/**
 * frees resources by removing links to private and info data
 */
Sandbox.prototype.destroy = function destroySandbox() {
};
```

##Examples:
```js
//anonymous
var a = new Sandbox();
a.name(); //random string

//named
var bar = new Sandbox('BAR');
bar.name(); //'BAR'

//data
var bar = new Sandbox(5);
bar.data(); //5

//named with data
var bar = new Sandbox('BAR', 5);
bar.name(); //'BAR'
bar.data(); //5

//plain objects or arrays are immutable
var x = {a: 10};
var bar = new Sandbox(x);
bar.data().a; //10
bar.data().a = 20;
bar.data().a; //20
x.a; //10

//after destroy
var x = new Sandbox(5);
x.destroy();
x.data(); //throws Sandbox exception

//children sandboxes creation
var appSandbox = new Sandbox('APP');
var moduleASandbox = appSandbox.kid('ModuleA');
var moduleBSandbox = appSandbox.kid('ModuleB');
var moduleAASandbox = moduleASandbox.kid('ModuleAA');
//but following will throw, because siblings should have unique names
var moduleAlphaSandbox = appSandbox.kid('ModuleA');
```

##Subscribe/publish and caching
```js
var foo = new Sandbox();
var test = {
		value: 'abc',
		getValue: function getValue() {
			return this.value;
		}
	};
foo.on('someEvent', function testListener() {}, test);
foo.emit('someEvent'); //testListener was called with this set to test object
foo.off('someEvent'); //un-subscribed

//order doesn't matter, can subscribe late (even after emit) and you'll still get data
foo.emit('bla', 1);
foo.on('bla', function (e, number) { //will fire right away
	console.log(number);
});
setTimeout(function () {
	foo.emit('bla', 2); //still listening, will log 2
}, 100);

//event expiration time for event debounce by default (also possible to set expiration settings for sandbox instance)
var foo = new Sandbox('FOO');
foo.settings({
	cache: {
		expire: 1000
	}
});
foo.emit('eventName');
foo.on('eventName', function eventListener() {}); //will be called right away
setTimeout(function () {
	foo.on('eventName', function anotherListener() {}); //event is cached, execute the callback
}, 750);
setTimeout(function () {
	//event is still cached event though expiration time exceeded, cause by default expiration time debounce
	foo.on('eventName', function yetAnotherListener() {});
}, 1500);
setTimeout(function () {
	//now event expired
	foo.on('eventName', function lastTry() {});
}, 3000);

//get default caching settings
var defaults = Sandbox.defaults(); //{cache: {store: true, expire: 0, debounce: true}}
//set caching settings globally
Sandbox.defaults({
	cache: {
		expire: 1000, //events will expire after 1s
		debounce: false
	}
});
foo.emit('hoho', [0, 'abc']);
foo.on('hoho', function (e, alpha, beta) { //will log 'hoho', 0, 'abc'
	console.log(e.type);
	console.log(alpha);
	console.log(beta);
});
setTimeout(function () {
	foo.emit('hoho', [1, 'abc']); //logs to console: 'hoho', 1, 'abc'
}, 550);
setTimeout(function () {
	foo.emit('hoho', [2, 'abc']); //nothing, event expired because of global settings
}, 1100);

//no store settings
Sandbox.defaults({
	cache: {
        store: false
    }
});
var foo = new Sandbox('FOO');
foo.emit('heyAnyOne');
foo.on('heyAnyOne', function hello() {}); //hello will not execute
foo.emit('heyAnyOne'); //hello will be called
```

##Permissions management
```js
//setup code
var Parent = new Sandbox('Parent', {
	    a: 1,
	    b: 2
	});
var Father = Parent.kid('Father');
var Mother = Parent.kid('Mother');
var Son = Mother.kid('Son');

//sandbox can get data from itself
Parent.on('someEvent', listener);
Parent.emit('someEvent', data); //listener called once
Parent.on('someEvent', listener2); //listener called second time, listener2 called once
Parent.off('someEvent'); //unsubscribe
Parent.emit('someEvent', data); //nothing changed

//kids from parents - no permissions:
Father.on('ping', listener);
Parent.emit('ping'); //Father's listener didn't execute because of lack of permissions

//kids from parents - with permissions:
//grant Father and Mother permissions to get events from Parent's ping event
Parent.grant(['Father', 'Mother'], {Parent: ['ping']});
Father.on('ping', listener);
Mother.on('ping', listener);
Parent
	.emit('ping') //will call listener twice (for Father and Mother)
	.revoke(['Father', 'Mother'], {Parent: ['ping']}) //revoke permissions
	.emit('ping'); //listener call count didn't change

//kids from kids - no permissions:
Father.on('ping', listener);
Mother.emit('ping'); //Father's listener didn't execute because of lack of permissions

//kids from kids - with permissions:
//grant Father access to Mother's ping and grant Mother access to Father's pong :)
Parent
	.grant(Father.name(), {Mother: ['ping']})
	.grant(Mother.name(), {Father: ['pong']});
Father.on('ping', listener);
Mother.on('pong', listener2);
Mother.emit('ping'); //called right away
Father.emit('pong'); //called right away
//revoke permissions
Parent
	.revoke(Father.name(), {Mother: ['ping']})
	.revoke(Mother.name(), {Father: ['pong']});
Mother.emit('ping'); //nothing happens
Father.emit('pong'); //nothing happens

//parents from kids - no permissions
Mother.on('ping', listener);
Son.emit('ping'); //Father's listener didn't execute because of lack of permissions

//parents from kids - with permissions
//grant Mother permissions to Son's ping and subscribe
Mother
	.grant({Son: ['ping']})
	.on('ping', listener);
Son.emit('ping'); //listener was called
Mother //revoke permissions
	.revoke({Son: ['ping']});
Son.emit('ping'); //nothing
```

##Real world example
When populate cities module gets new cities data, initialize popup links in different module
```js
//in core.js
var coreSandbox = new Sandbox('Core');
require(['searchBar'], function (module) {
	var moduleProps = {
		searchUrl: appSettings.searchUrl
	};
	var moduleSandbox = coreSandbox.kid('searchBar', moduleProps);
	module.init(moduleSandbox);
});

require(['populateCities'], function (module) {
	var moduleProps = {
		citiesJsonUrl: appSettings.citiesJsonUrl,
		citiesList: this.listNode
	};
	var moduleSandbox = coreSandbox.kid('populateCities', moduleProps);
	//allow searchBar to get 'new-search-popup-links'
	//loading order doesn't matter as long as your caching settings set properly
	coreSandbox.grant('searchBar', {populateCities: ['new-search-popup-links']});
	module.init(moduleSandbox);
});

//inside search-bar.js
//...
sandbox.on('new-search-popup-links', function (e, data) {
	makePopupLinks(data.links);
});
//...

//inside populate-cities.js
//...
sandbox.emit('new-search-popup-links', [{
	links: sandbox.data().citiesList.find('a.search-popup')
}]);
//...
```

Check tests and source for more