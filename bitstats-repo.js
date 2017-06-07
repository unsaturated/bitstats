/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');
const request = require('request-promise');
const logger = require('./config').logger;
const repos = require('./config').repositories;
const bitbucket = require('./config').bitbucket;
const setup = require('./setup/setup');
const path = require('path');
const fs = require('fs');

program
  .option('-a, --all', 'all PRs')
  .option('-r, --repos', 'gets repository index')
  .parse(process.argv);

// Validate repository input
if(!program.repo) {
  logger.log('error', 'No repository specified');
  process.exit(1);
}

// TODO
// https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories
// Endpoints of interest
// - {username}  <- Must request all repos in list since they're paginated
// - {repo_slug} <- Specify the exact repository to inspect
// -  /commits
// -  /default-reviewers
// -  /pullrequests
//

const token = setup.getToken();
if(token === null) {
  logger.log('error', `Repo requires an OAuth access token. Run command 'setup -t'.`);
  process.exit(1);
}

const options = {
  method: 'GET',
  url: bitbucket.api.repositories,
  headers: {
    'Authorization': `Bearer ${token.access_token}`,
  },
};

/**
 * Uses request to fetch a page of data.
 * @param {object} req request instance
 * @param {object} options request options (verb, headers, etc)
 */
const requestRepos = (req, options) => {
  let repoIndexObj = {
    repos: [],
  };

  const requestPage = (options) => {
    logger.log('debug', `Fetching ${options.url} ...`);
    req(options)
      .then((body) => {
        const info = JSON.parse(body);
        let nextUrl = getNextPageUrl(info);
        repoIndexObj.repos = [...repoIndexObj.repos, ...info.values];
        if(nextUrl !== null) {
          options.url = nextUrl;
          requestPage(options);
        }
        writeResponses(JSON.stringify(repoIndexObj));
      })
      .catch((err) => {
        logger.log('error', err);
      });
  };

  requestPage(options);
};

/**
 * Gets next page URL from response.
 * @param {Object} data /repositories response.
 * @return {String|Null} Url of next page or null
 */
const getNextPageUrl = (data) => {
  let result = null;
  if(data && data.pagelen > 1 && data.next) {
    result = data.next;
  }
  return result;
};

/**
 * Writes data to the repository index file.
 * @param {object} data JSON to serialize
 */
const writeResponses = (data) => {
  createRepoIndexDir();

  const filePath = path.join(repos.directory, repos.fileNameReposIndex);

  fs.writeFile(filePath, data, (err) => {
    if (err) {
      let msg = `Could not write repo index to file '${filePath}'`;
      logger.log('error', msg);
    }
  });
};

/**
 * Creates the user's repository directory if it does not exist.
 */
const createRepoIndexDir = () => {
  // Create directory if not exists
  if (!fs.existsSync(repos.directory)) {
    fs.mkdirSync(repos.directory);
  }
};


requestRepos(request, options);
