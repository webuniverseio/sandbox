/*global requirejs, __karma__*/
/**
 * @typedef {Object} __karma__
 * @property {Object} files
 */
/**
 * @typedef {Object} requirejs
 * @property {Function} config
 */
var dependencies = [];
for (var file in window.__karma__.files) {
	if (window.__karma__.files.hasOwnProperty(file)) {
		if (/(Test)\.js$/.test(file)) {
			dependencies.push(file);
		}
	}
}

requirejs.config({
	// Karma serves files from '/base'
	baseUrl: '/base/sandbox/',

	paths: {
		'_': '../vendor/lodash/dist/lodash.compat'
	},

	// ask Require.js to load these files (all our tests)
	deps: dependencies,

	// start test run, once Require.js is done
	callback: window.__karma__.start
});