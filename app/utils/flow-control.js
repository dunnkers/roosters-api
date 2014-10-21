var RSVP = require('rsvp'),
	async = require('async'),
	log4js = require('log4js'),
	log = log4js.getLogger('flow');

log4js.configure({
	appenders: [ { type: "console", layout: { type: "basic" } } ], replaceConsole: true
});

/**
 * Promised async mapping. Supports limited parallel and
 * serial when no limit is given.
 * @param  {Array} arr     Array to map.
 * @param  {Promise} promise Promise to invoke with every item.
 * @param  {Number} limit   Limit of parallel executions. If not given serial.
 * @return {Promise}         Promise resolving when all items are done.
 */
exports.asyncMap = function (arr, promise, limit) {
	return new RSVP.Promise(function (resolve, reject) {
		async.mapLimit(arr, limit || 1, function (item, callback) {
			promise(item).then(function (res) {
				callback(null, res);
			}, function (err) {
				callback(err);
			});
		}, function (err, results) {
			if (err) reject(err);

			resolve(results);
		});
	});
}

/**
 * Waits for the queue to drain if it hasn't finished yet,
 * using a promise.
 * @param  {Queue} queue An async queue object
 * @return {Promise}  A promise, fullfilling when the queue is finished.
 */
exports.drain = function (queue) {
	return new RSVP.Promise(function (resolve, reject) {
		if (queue.running() || !queue.idle()) {
			log.trace('Processing %d tasks in queue...', queue.length());
			queue.drain = function () {
				log.trace('All tasks finished!');
				resolve();
			};
		}else {
			resolve();
		}
	});
}