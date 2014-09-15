//noinspection GjsLint
module.exports = function spyOnKarma($) {
	'use strict';

	$.mapper = function mapUrlToConfig(url) {
		if (~url.indexOf('lodash')) {
			return {
				instrument: false
			};
		}

		return {
			instrument: {
				prettify: false,
				objectDump: {
					depth: 10000,
					propertyNumber: 10000
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