/*global requirejs, __karma__*/
//jshint node:true
/**
 * @typedef {Object} __karma__
 * @property {Object} files
 */

/**
 * @typedef {Object} requirejs
 * @property {Function} config
 */

var environment = typeof window === 'object' ? 'browser' : 'node',
	projectMainFolder = 'lib/',
	paths = {
		'simple-permissions': '../bower_components/simple-permissions/lib/simple-permissions'
	},
	dependencies = [];
if (environment === 'browser') {
	var files = window.__karma__.files;
	for (var file in files) {
		if (files.hasOwnProperty(file)) {
			files[file] += (new Date()).getTime();
			if (/(Test)\.js$/.test(file)) {
				dependencies.push(file);
			}
		}
	}


	paths._ = '../bower_components/lodash/lodash';


	requirejs.config({
		// Karma serves files from '/base'
		baseUrl: '/base/' + projectMainFolder,

		paths: paths,

		// ask Require.js to load these files (all our tests)
		deps: dependencies,

		// start test run, once Require.js is done
		callback: window.__karma__.start
	});
} else {
	paths._ = 'lodash';
	module.exports = {
		projectMainFolder: projectMainFolder,
		paths: paths
	};
}