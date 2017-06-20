/**
 * Module to process all pull request data.
 */

const logger = require('../config').logger;
const prConfig = require('../config').pr;
const setup = require('../bitstats-setup/setup');
const repo = require('../bitstats-repo/repo');
const fs = require('fs-extra');
const path = require('path');
const request = require('request-promise');
const readline = require('readline');
const {URL} = require('url');
const _ = require('lodash');
const json2csv = require('json2csv');

module.exports = {

  /**
   * Exports the PR data for a repository to a CSV file.
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-pr.csv] file name to write
   */
  export: function(repoSlug, fileName=`${repoSlug}-pr.csv`) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let result = getFileListOfAllPullRequests(repoSlugCleaned);
    if(result !== null) {
      let exportArray = [];
      for(let fObj of result) {
        let fileData = JSON.parse(fs.readFileSync(fObj.path));
        exportArray.push({
          id: _.has(fileData, 'id') ? fileData.id : null,
          author_display_name: _.has(fileData, 'author.display_name') ? fileData.author.display_name : null,
          closed_by_display_name: _.has(fileData, 'closed_by.display_name') ? fileData.closed_by.display_name : null,
          comment_count: _.has(fileData, 'comment_count') ? fileData.comment_count : 0,
          created_on: _.has(fileData, 'created_on') ? fileData.created_on : null,
          destination_branch_name: _.has(fileData, 'destination.branch.name') ? fileData.destination.branch.name : null,
          source_branch_name: _.has(fileData, 'source.branch.name') ? fileData.source.branch.name : null,
          state: _.has(fileData, 'state') ? fileData.state : null,
          title: _.has(fileData, 'title') ? fileData.title : null,
          updated_on: _.has(fileData, 'updated_on') ? fileData.updated_on : null,
        });
      }
      let dataForSerialization = json2csv({
        data: exportArray,
        fields: Object.keys(_.head(exportArray)),
      });
      fs.writeFile(fileName, dataForSerialization, (err) => {
        if(err) {
          logger.log('error', `Could not serialize PR data to file '${fileName}'.`);
        } else {
          logger.log('info', `PR data exported to '${fileName}'.`);
        }
      });
    } else {
      logger.log('info', 'No PRs data to export.');
    }
  },

  /**
   * Clears (deletes) all PR information serialized to disk.
   * @param {string} repoSlug name of the repo
   */
  clear: function(repoSlug) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    const dirToDelete = path.join(prConfig.directory.replace('{repo_slug}', repoSlugCleaned));

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
   * Determines if PR data is indexed for the specified repository.
   * @param {String} repoSlug repository to query
   * @return {Boolean} true if PR directory exists
   */
  hasPrData: function(repoSlug) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    const filePath = path.join(prConfig.directory.replace('{repo_slug}', repoSlugCleaned));

    return fs.existsSync(filePath);
  },

  /**
   * Fetches pull request data from Bitbucket and serializes to disk.
   *
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
    const repoObj = repo.getRepoByName(repoSlugCleaned);
    const prUrl = new URL(repoObj.links.pullrequests.href);
    // TODO : Remove old way of getting hrefs (stuffing the config full)
    // const prUrl = new URL(bitbucket.api.pullrequests.replace('{repo_slug}', repoSlugCleaned));
    let url = prUrl.href;

    // Append the weird Atlassian way
    url += '?q=(state="MERGED" OR state="OPEN" OR state="DECLINED")';

    // Fetch only the new PRs, not ones already cached
    const minMaxIds = getHighestPullRequestIdFromDisk(repoSlugCleaned);
    if(minMaxIds !== null) {
      // No way to '.append' with operators other than '='
      url += ` AND id>${minMaxIds.max}`;
    }

    const options = {
      method: 'GET',
      url: encodeURI(url),
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
              // Only write outside the bounds of current ids on disk
              if(minMaxIds !== null) {
                if(singlePr.id < minMaxIds.min || singlePr.id > minMaxIds.max) {
                  writeResponse(repoSlugCleaned, singlePr);
                }
              } else {
                writeResponse(repoSlugCleaned, singlePr);
              }
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
            logger.log('error', err.message);
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
    const writeResponse = (repoSlug, data) => {
      const dir = prConfig.directory.replace('{repo_slug}', repoSlug);

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
  },
};

/**
 * Gets the highest and lowest pull request ID from the disk.
 *
 * @param {string} repoSlug repository slug
 * @return {Object|Null} PR index object, null if not found
 */
const getHighestPullRequestIdFromDisk = (repoSlug) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  const filePath = path.join(prConfig.directory.replace('{repo_slug}', repoSlug));

  if (fs.existsSync(filePath)) {
    let reg = prConfig.fileNamePatternPrRegex;
    let ids = [];
    const fileList = fs.readdirSync(filePath);
    fileList.forEach((f) => {
      let regResult = reg.exec(f);
      if(regResult != null) {
        ids.push(Number.parseInt(regResult[1], 10));
      }
    });
    if(ids.length) {
      return {
        min: Math.min(...ids),
        max: Math.max(...ids),
      };
    }
  }
  return null;
};

/**
 * Gets the file listing for all PRs on disk for a given repository.
 *
 * This performs a regular expression check on each file to ensure only
 * expected files are included in the listing (i.e. no README or dot files).
 * They files are returned sorted by PR id number in an object with
 * properties `index` and `path`.
 *
 * @param {string} repoSlug repository slug
 * @return {Array|Null} Full file list or null if none found
 */
const getFileListOfAllPullRequests = (repoSlug) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  const filePath = path.join(prConfig.directory.replace('{repo_slug}', repoSlug));

  if (fs.existsSync(filePath)) {
    let reg = prConfig.fileNamePatternPrRegex;
    let files = [];
    const fileList = fs.readdirSync(filePath);
    fileList.forEach((f) => {
      let regResult = reg.exec(f);
      if(regResult != null) {
        let o = {
          index: Number.parseInt(regResult[1], 10),
          path: path.join(filePath, f),
        };
        files.push(o);
      }
    });
    if(files.length) {
      return _.sortBy(files, 'index');
    }
  }
  return null;
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

  const filePath = path.join(
    prConfig.directory.replace('{repo_slug}', repoSlug),
    prConfig.fileNamePatternPrIndex.replace('{#}', prNum));
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
