var log4js = require('log4js'),
  config = require('../../config/config');

module.exports = function (name) {
  var logger = log4js.getLogger(name);

  logger.setLevel(config.production ? 'INFO' : 'ALL');

  return logger;
};
