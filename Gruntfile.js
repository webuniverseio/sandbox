/*global module:false*/
//noinspection GjsLint
module.exports = function initGrunt(grunt) {
	'use strict';

	// Project configuration.
	grunt.initConfig({
		// Metadata.
		pkg: grunt.file.readJSON('package.json'),
		banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
			'<%= grunt.template.today("yyyy-mm-dd") %>\n' +
			'<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
			' Licensed <%= pkg.license %>\n' +
			'* Description <%= pkg.description %>\n' +
			'* Author <%= pkg.author.name %>, <%= pkg.author.homepage %>\n' +
			'*/\n\n',
		// Task configuration.
		concat: {
			options: {
				banner: '<%= banner %>',
				stripBanners: true
			},
			dist: {
				src: ['lib/sandbox.js'],
				dest: 'dist/sandbox.js'
			}
		},
		uglify: {
			options: {
				banner: '<%= banner %>'/*,
				compress: {
					'pure_funcs': ['validateTypesInPrivateCode']
				}*/
			},
			dist: {
				src: '<%= concat.dist.dest %>',
				dest: 'dist/sandbox.min.js'
			}
		},
		jshint: {
			options: {
				jshintrc: true
			},
			gruntfile: {
				src: 'Gruntfile.js'
			},
			'lib_test': {
				src: ['lib/**/*.js', 'test/**/*.js']
			}
		},
		karma: {
			unit: {
				configFile: 'karma.conf.js',
				singleRun: true
			}
		},
		watch: {
			gruntfile: {
				files: '<%= jshint.gruntfile.src %>',
				tasks: ['jshint:gruntfile']
			},
			'lib_test': {
				files: '<%= jshint.lib_test.src %>',
				tasks: ['jshint:lib_test', 'karma:unit']
			}
		},
		githooks: {
			all: {
				// Will run the jshint and test:unit tasks at every commit
				'pre-commit': 'default'
			}
		}
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-githooks');

	// Default task.
	grunt.registerTask('default', [/*'jshint', 'karma', 'test-node', */'concat', 'uglify']);

	grunt.registerTask('test-node', function () {
		var shelljs = require('shelljs');
		shelljs.exec('npm run test-node');
		/* istanbul ignore if  */
		if (shelljs.error()) {
			//noinspection ExceptionCaughtLocallyJS
			throw new Error('test contains errors');
		}
	});
};
