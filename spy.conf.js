//noinspection GjsLint
module.exports = function spyOnKarma($) {
	'use strict';

	$.mapper = function (url) {
		if (~url.indexOf('lodash')) {
			return {
				instrument: false
			};
		}

		return {
			instrument: {
				prettify: false,
				objectDump: {
					depth: 20,
					propertyNumber: 10
				}
			}
		};
	};

	/*$.eventFilter = {
		globalScope: true,
		timeout: false,
		interval: true,
		noEvents: ['DOMContentLoaded', 'keyup']
	};*/
};