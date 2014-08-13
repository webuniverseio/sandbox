/*global module:false*/
module.exports = function (grunt) {
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
				src: ['lib/<%= pkg.name %>.js'],
				dest: 'dist/<%= pkg.name %>.js'
			}
		},
		uglify: {
			options: {
				banner: '<%= banner %>'
			},
			dist: {
				src: '<%= concat.dist.dest %>',
				dest: 'dist/<%= pkg.name %>.min.js'
			}
		},
		jshint: {
			options: {
				nonew: true,
				curly: true,
				latedef: 'nofunc',
				noarg: true,
				esnext: true,
				trailing: true,
				forin: true,
				white: true,
				noempty: true,
				quotmark: true,
				smarttabs: true,
				node: true,
				strict: true,
				undef: true,
				sub: true,
				expr: true,
				debug: true,
				newcap: true,
				immed: true,
				browser: true,
				es3: true,
				devel: true,
				camelcase: true,
				multistr: true,
				globals: {
					describe: false,
					it: false,
					expect: false,
					define: false
				}
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
		}
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Default task.
	grunt.registerTask('default', ['jshint', 'karma', 'concat', 'uglify']);

};
