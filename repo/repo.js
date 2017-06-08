/**
 * Created by mcrumley on 6/7/17.
 */
const logger = require('../config').logger;
const bitbucket = require('../config').bitbucket;
const repos = require('../config').repositories;
const setup = require('../setup/setup');
const fs = require('fs');
const path = require('path');
const request = require('request-promise');

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

    /**
     * Uses request to fetch a page of data.
     * @param {object} req request instance
     * @param {object} options request options (verb, headers, etc)
     * @return {object} repository index object
     */
    const requestRepos = (req, options) => {
      let repoIndexObj = {
        repos: [],
      };
      const originalOptions = Object.assign({}, options);

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
            return repoIndexObj;
          })
          .catch((err) => {
            if (err.statusCode === 401) {
              // Likely an old access token; throw it and let the containing function figure it out
              throw err;
            } else {
              logger.log('error', err);
            }
          });
      };

      let result = null;
      try {
        result = requestPage(options);
      } catch(err) {
        // Reset already accumlated repos
        repoIndexObj.repos = [];
        logger.log('debug', 'Access token rejected. Refreshing it now.');
        setup.refreshToken()
          .then((refreshedToken) => {
            token = setup.getToken();
            logger.log('debug', 'New access token received. Retrying repo request.');
            // Use original options
            result = requestPage(originalOptions);
          });
      }
      finally {
        return result;
      }
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
