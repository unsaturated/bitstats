/**
 * Created by mcrumley on 6/1/17.
 */
const winston = require('winston');
const os = require('os');

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      colors: {
        trace: 'magenta',
        input: 'grey',
        verbose: 'cyan',
        prompt: 'grey',
        debug: 'blue',
        info: 'green',
        data: 'grey',
        help: 'cyan',
        warn: 'yellow',
        error: 'red',
      },
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: false,
    }),
  ],
});

logger.level = 'debug';

const creds = {
  fileName: 'bitstats-auth',
  directory: os.homedir(),
};

/**
 * Common application logger.
 */
module.exports.logger = logger;

/**
 * Common credentials settings.
 * @type {{fileName: string, directory: *}}
 */
module.exports.credentials = creds;
