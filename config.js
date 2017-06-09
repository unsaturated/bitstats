/**
 * Created by mcrumley on 6/1/17.
 */
const winston = require('winston');
const os = require('os');
const path = require('path');

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

const bitbucket = {
  api: {
    baseUrl: 'https://api.bitbucket.org/2.0',
    repositories: 'https://api.bitbucket.org/2.0/repositories/madmobile',
    pullrequests: 'https://api.bitbucket.org/2.0/repositories/madmobile/{repo_slug}/pullrequests',
  },
  oauth: {
    baseUrl: 'https://bitbucket.org/site/oauth2',
    accessTokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
  },
};

const creds = {
  fileNameAuth: 'bitstats-oauth',
  fileNameToken: 'bitstats-token',
  directory: path.join(os.homedir(), '.bitstats', 'creds'),
};

const repo = {
  fileNameReposIndex: 'bitstats-repos',
  directory: path.join(os.homedir(), '.bitstats', 'data'),
};

const pr = {
  fileNamePatternPrIndex: 'bitstats-pr-{#}.json',
  directory: path.join(os.homedir(), '.bitstats', 'data', 'pr', 'repo_slug'),
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

/**
 * Repository settings.
 * @type {{fileNameRepos: string, directory: *}}
 */
module.exports.repositories = repo;

/**
 * Peer review settings.
 * @type {{fileNamePatternPrIndex: string, directory: *}}
 */
module.exports.pr = pr;

/**
 * Bitbucket configuration.
 * @type {{api: {baseUrl: string}, oauth: {baseUrl: string, accessTokenUrl: string}}}
 */
module.exports.bitbucket = bitbucket;
