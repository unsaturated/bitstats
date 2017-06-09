/**
 * Created by mcrumley on 6/9/17.
 */
const logger = require('../config').logger;
const bitbucket = require('../config').bitbucket;
const prConfig = require('../config').pr;
const setup = require('../bitstats-setup/setup');
const fs = require('fs-extra');
const path = require('path');
const request = require('request-promise');
const readline = require('readline');
// const _ = require('lodash');
// const Table = require('cli-table');
const {URL, URLSearchParams} = require('url');

module.exports = {

  /**
   * Clears (deletes) all PR information serialized to disk.
   * @param {string} repoSlug name of the repo
   */
  clear: function(repoSlug) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    const dirToDelete = path.join(prConfig.directory, repoSlugCleaned);

    if (fs.existsSync(dirToDelete)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`Delete cached PR files for '${repoSlug}' (n/Y)? : `, (a) => {
        if (isCleanYes(a)) {
          fs.removeSync(dirToDelete);
          logger.log('info', `Deleted PR files for that repository.`);
        }
        rl.close();
      });
    } else {
      logger.log('info', `No PR data was found.`);
    }
  },

  /**
   * Fetches pull request data from Bitbucket and serializes to disk.
   *
   * Only MERGED PRs are serialized as all others are assumed to be in flux.
   * Future development will open up analysis to the
   * from the Bitbucket API.
   * @param {string} repoSlug repository to fetch PRs for
   */
  refresh: function(repoSlug) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    let token = setup.getToken();

    if(token === null) {
      logger.log('error', `PR fetch requires an OAuth access token. Run command 'setup -t'.`);
      process.exit(1);
    }

    // Construct the URL - currently only supports MERGED PRs
    const prUrl = new URL(bitbucket.api.pullrequests.replace('{repo_slug}', repoSlugCleaned));
    prUrl.searchParams.append('state', 'MERGED');

    const options = {
      method: 'GET',
      url: prUrl.href,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
      gzip: true,
      json: true,
    };

    const cloneOptionsWithToken = (opt, updatedToken) => {
      let clonedOpt = Object.assign({}, opt);
      clonedOpt.headers.Authorization = `Bearer ${updatedToken.access_token}`;
      return clonedOpt;
    };

    /**
     * Uses request to fetch a page of data.
     * @param {object} req request instance
     * @param {object} options request options (verb, headers, etc)
     */
    const requestPrs = (req, options) => {
      const originalOptions = Object.assign({}, options);

      const requestPage = (options) => {
        logger.log('debug', `Fetching ${options.url} ...`);
        return req(options)
          .then((body) => {
            let nextUrl = getNextPageUrl(body);

            // Extract each PR and write to separate file
            for(let singlePr of body.values) {
              writeResponses(repoSlugCleaned, singlePr);
            }

            if(nextUrl !== null) {
              options.url = nextUrl;
              requestPage(options);
            }
          });
      };

      requestPage(options)
        .then(() => {
          // TODO : What should this function return?
          // return prIndexObj;
        })
        .catch((err) => {
          if (err.statusCode === 401) {
            logger.log('debug', 'Access token rejected. Refreshing it now.');
            setup.refreshToken()
              .then((refreshedToken) => {
                let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                logger.log('debug', 'New access token received. Retrying PR request.');
                // Use original options but with new token
                requestPage(updatedOptionsWithToken);
              });
          } if (err.statusCode === 404) {
            logger.log('error', 'That repository no longer exists or has moved.');
          } else {
            logger.log('error', err);
          }
        });
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
     * Writes data to the PR index file.
     * @param {string} repoSlug repository slug to use for subdirectory
     * @param {object} data JSON to serialize for a single PR
     */
    const writeResponses = (repoSlug, data) => {
      const dir = prConfig.directory.replace('repo_slug', repoSlug);

      createDirSync(dir);

      const prNum = data.id;

      const filePath = path.join(dir, prConfig.fileNamePatternPrIndex.replace('{#}', prNum));

      fs.writeFile(filePath, JSON.stringify(data), (err) => {
        if (err) {
          let msg = `Could not write PR index to file '${filePath}'`;
          logger.log('error', msg);
        }
      });
    };

    requestPrs(request, options);

    // TODO : Return the
    // // Make the request for data if not available locally
    // let index = getIndexFromDisk();
    // if(index === null) {
    //   index = requestPrs(request, options);
    // }
    //
    // return index;
  },
};

/**
 * Gets the repository index file data.
 * @param {string} repoSlug repository slug
 * @param {number} prNum PR number
 * @return {Object|Null} PR index object, null if not found
 */
const getIndexFromDisk = (repoSlug, prNum) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  if(!Number.isInteger(prNum)) {
    logger.log('error', 'PR index is not a valid integer.');
    process.exit(1);
  }

  const filePath = path.join(prConfig.directory, repoSlug, prConfig.fileNamePatternPrIndex.replace('#', prNum));
  let result = null;

  if (fs.existsSync(filePath)) {
    let data = fs.readFileSync(filePath);

    try {
      if(data.length > 0) {
        result = JSON.parse(data);
      }
    } catch(err) {
      result = null;
      logger.log('error', `Unparseable PR data in file '${filePath}'. Run 'pr -c' then 'pr index' to reset.`);
    }
  }
  return result;
};

/**
 * Creates the directory if it does not exist.
 * @param {string} dir directory to create
 */
const createDirSync = (dir) => {
  // Create directory if not exists
  if (!fs.existsSync(dir)) {
    fs.ensureDirSync(dir);
  }
};

/**
 * Checks for clean answer.
 * @param {string} value input from STDIN
 * @return {boolean} true if answer is y|yes
 */
const isCleanYes = (value) => {
  const valueRegex = /^[y|yes]$/i;
  return valueRegex.test(value.toString());
};

/**
 * Inspects an object to test if array then returns the head, or
 * simply returns the string.
 *
 * @param {array|string} input object to inspect
 * @return {string|null} contents at array index 0 or null if not a valid array
 */
const arrayHeadOrValue = (input) => {
  if(typeof input != 'undefined' && input != null && input.length > 0) {
    return input[0];
  } else {
    return input.toString().trim();
  }
};

/**
 * Checks the repository slug to ensure it's a valid string and exist if not.
 * @param {string} repoSlug repository slug
 */
const exitOnInvalidRepoSlug = (repoSlug) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'You must specifiy a repository.');
    process.exit(1);
  }
};
