//noinspection GjsLint
module.exports = function spyOnKarma($) {
	'use strict';

	$.mapper = function mapUrlToConfig(url) {
		if (!/(test|lib)\/sandbox/.test(url)) {
			return {
				instrument: false
			};
		}

		return {
			instrument: {
				prettify: false,
				objectDump: {
					depth: 100,
					propertyNumber: 100
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