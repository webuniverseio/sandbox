// Karma configuration
// Generated on Fri Apr 11 2014 22:20:12 GMT-0400 (Eastern Daylight Time)
//jshint strict: false
//noinspection GjsLint
module.exports = function karmaExports(config) {
	config.set({

		// base path that will be used to resolve all patterns (eg. files, exclude)
		basePath: './',


		// frameworks to use
		// available frameworks: https://npmjs.org/browse/keyword/karma-adapter
		frameworks: ['jasmine', 'requirejs'],


		// list of files / patterns to load in the browser
		files: [
			'test/test-main.js',
			{pattern: 'lib/**/*.js', included: false},
			{pattern: 'vendor/**/!(*Test).js', included: false},
			{pattern: 'test/**/*Test.js', included: false}
		],


		// list of files to exclude
		exclude: [
		],


		// preprocess matching files before serving them to the browser
		// available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
		preprocessors: {
			'!(vendor)/*.js': ['coverage']
		},


		// test results reporter to use
		// possible values: 'dots', 'progress'
		// available reporters: https://npmjs.org/browse/keyword/karma-reporter
		reporters: ['progress', 'coverage'],

		//coverage reporter
		coverageReporter: { type : 'html', dir : 'coverage/' },

		// web server port
		port: 9876,


		// enable / disable colors in the output (reporters and logs)
		colors: true,


		// level of logging
		// possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN ||
		// config.LOG_INFO || config.LOG_DEBUG
		logLevel: config.LOG_INFO,


		// enable / disable watching file and executing tests whenever any file changes
		autoWatch: true,


		// start these browsers
		// available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
		browsers: ['ChromeCanary', 'Chrome', 'Firefox', 'IE'],


		// Continuous Integration mode
		// if true, Karma captures browsers, runs the tests and exits
		singleRun: false
	});
};
