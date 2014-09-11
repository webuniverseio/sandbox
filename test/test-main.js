/*global requirejs*/

/**
 * @typedef {Object} __karma__
 * @property {Object} files
 */

/**
 * @typedef {Object} requirejs
 * @property {Function} config
 */

var dependencies = [];
var files = window.__karma__.files;
for (var file in files) {
	if (files.hasOwnProperty(file)) {
		files[file] += (new Date()).getTime();
		if (/(Test)\.js$/.test(file)) {
			dependencies.push(file);
		}
	}
}



requirejs.config(
	{
		// Karma serves files from '/base'
		baseUrl: '/base/lib/',

		paths: {
			'_': '../vendor/lodash/dist/lodash.compat',
			'simple-permissions': '../vendor/simple-permissions/lib/simple-permissions'
		},

		// ask Require.js to load these files (all our tests)
		deps: dependencies,

		// start test run, once Require.js is done
		callback: window.__karma__.start
	}
);