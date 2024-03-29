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
  },
  oauth: {
    baseUrl: 'https://bitbucket.org/site/oauth2',
    accessTokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
  },
};

const jira = {
  ticketRegExp: /[A-Z0-9]{1,10}\-\d{1,5}/g,
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
  fileNamePatternPrRegex: /bitstats\-pr\-(\d+)\.json/i,

  fileNamePatternPrCommentIndex: 'bitstats-pr-{pr#}-comment-{com#}.json',
  fileNamePatternPrCommentRegex: /bitstats\-pr\-(\d+)\-comment\-(\d+)\.json/i,

  fileNamePatternPrCommitIndex: 'bitstats-pr-{pr#}-commits.json',
  fileNamePatternPrCommitRegex: /bitstats\-pr\-(\d+)\-commits\.json/i,

  fileNamePatternPrApprovalIndex: 'bitstats-pr-{pr#}-approvals.json',
  fileNamePatternPrApprovalRegex: /bitstats\-pr\-(\d+)\-approvals\.json/i,

  directory: path.join(os.homedir(), '.bitstats', 'data', 'pr', '{repo_slug}'),
  commentsDirectory: path.join(os.homedir(), '.bitstats', 'data', 'pr', '{repo_slug}', 'comments'),
  commitsDirectory: path.join(os.homedir(), '.bitstats', 'data', 'pr', '{repo_slug}', 'commits'),
  approvalsDirectory: path.join(os.homedir(), '.bitstats', 'data', 'pr', '{repo_slug}', 'approvals'),
};

const commits = {
  fileNamePatternSingleCommit: 'bitstats-commit-{com#}.json',
  fileNamePatternSingleCommitRegex: /bitstats\-commit\-(\w+)\.json/i,

  directory: path.join(os.homedir(), '.bitstats', 'data', 'commits', '{repo_slug}'),
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
 * Commits per user organized by the repository slug then user ID.
 */
module.exports.commits = commits;

/**
 * Bitbucket configuration.
 * @type {{api: {baseUrl: string}, oauth: {baseUrl: string, accessTokenUrl: string}}}
 */
module.exports.bitbucket = bitbucket;

/**
 * Jira configuration and options.
 * @type {{ticketRegExp: RegExp}}
 */
module.exports.jira = jira;
