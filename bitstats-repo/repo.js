/**
 * Created by mcrumley on 6/7/17.
 */
const logger = require('../config').logger;
const bitbucket = require('../config').bitbucket;
const repos = require('../config').repositories;
const setup = require('../bitstats-setup/setup');
const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const _ = require('lodash');
const Table = require('cli-table');

module.exports = {

  /**
   * Clears (deletes) all repository index information serialized to disk.
   */
  clear: function() {
    const filesToDelete = [
      path.join(repos.directory, repos.fileNameReposIndex),
    ];

    for(let f of filesToDelete) {
      if (fs.existsSync(f)) {
        fs.unlink(f, (err) => {
          if (err) {
            let msg = `Could not delete file '${f}'`;
            logger.log('error', msg);
            process.exit(1);
          } else {
            logger.log('debug', `Deleted file '${f}'`);
          }
        });
      } else {
        logger.log('debug', `File did not exist: '${f}`);
      }
    }
  },

  /**
   * Gets the repository index from disk or (if not found) fetches it
   * from the Bitbucket API.
   * @return {object} repository index object
   */
  getRepos: function() {
    let token = setup.getToken();

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
      gzip: true,
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
    const requestRepos = (req, options) => {
      let repoIndexObj = {
        repos: [],
      };
      const originalOptions = Object.assign({}, options);

      const requestPage = (options) => {
        logger.log('debug', `Fetching ${options.url} ...`);
        return req(options)
          .then((body) => {
            const info = JSON.parse(body);
            let nextUrl = getNextPageUrl(info);
            repoIndexObj.repos = [...repoIndexObj.repos, ...info.values];
            if(nextUrl !== null) {
              options.url = nextUrl;
              requestPage(options);
            } else {
              writeResponses(JSON.stringify(repoIndexObj));
            }
          });
      };

      requestPage(options)
        .then(() => {
        return repoIndexObj;
      })
        .catch((err) => {
          if (err.statusCode === 401) {
            // Reset already accumlated repos
            repoIndexObj.repos = [];
            logger.log('debug', 'Access token rejected. Refreshing it now.');
            setup.refreshToken()
              .then((refreshedToken) => {
                let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                logger.log('debug', 'New access token received. Retrying repo request.');
                // Use original options but with new token
                requestPage(updatedOptionsWithToken);
              });
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
     * Writes data to the repository index file.
     * @param {object} data JSON to serialize
     */
    const writeResponses = (data) => {
      createDir(repos.directory);

      const filePath = path.join(repos.directory, repos.fileNameReposIndex);

      fs.writeFile(filePath, data, (err) => {
        if (err) {
          let msg = `Could not write repo index to file '${filePath}'`;
          logger.log('error', msg);
        }
      });
    };

    // Make the request for data if not available locally
    let index = getIndexFromDisk();
    if(index === null) {
      index = requestRepos(request, options);
    }

    return index;
  },

  /**
   * Clears (deletes) all repository index information and fetches it again.
   */
  refresh: function() {
    this.clear();
    this.getRepos();
  },

  /**
   * Displays a list of repositories found in the Bitbucket account.
   * @param {Array} projects filter and display only repositories matching these projects (case insensitive)
   */
  listRepos: function(projects) {
    let index = getIndexFromDisk();
    if(index === null) {
      logger.log('error', `Listing requires a repo index file. Run command 'repo --refresh'.`);
    }

    let table = new Table({
      head: ['Repository Slug', 'Project', 'Description'],
      colWidths: [35, 20, 60],
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '-', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' ',
      },
      style: {'head': ['green'], 'padding-left': 0, 'padding-right': 0},
    });

    // Filter out repositories not matching one of the projects specified
    let regexCondition = null;
    let filtered = index.repos;
    if(projects && projects.length) {
      regexCondition = new RegExp(projects.join('|'), 'i');
      filtered = _.filter(index.repos, (o) => {
        if(regexCondition) {
          return regexCondition.test(o.project.key);
        }
        return true;
      });
    }

    // Only return the data that matters
    filtered.map((r) => {
      let o = [
        r.slug,
        r.project.key,
        r.description,
      ];
      table.push(o);
    });

    console.log(table.toString());
  },
};

/**
 * Gets the repository index file data.
 * @return {Object|Null} Index object, null if not found
 */
const getIndexFromDisk = () => {
  const filePath = path.join(repos.directory, repos.fileNameReposIndex);
  let result = null;

  if (fs.existsSync(filePath)) {
    let data = fs.readFileSync(filePath);

    try {
      if(data.length > 0) {
        result = JSON.parse(data);
      }
    } catch(err) {
      logger.log('error', `Unparseable repo data in file '${filePath}'. Run 'repo -c' then 'repo -r' to reset.`);
    }
  }
  return result;
};

/**
 * Creates the user's repository directory if it does not exist.
 * @param {string} dir directory to create
 */
const createDir = (dir) => {
  // Create directory if not exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};
