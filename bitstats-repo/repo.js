/**
 * Created by mcrumley on 6/7/17.
 */
const logger = require('../config').logger;
const bitbucket = require('../config').bitbucket;
const repos = require('../config').repositories;
const commitConfig = require('../config').commits;
const jiraConfig = require('../config').jira;
const setup = require('../bitstats-setup/setup');
const fs = require('fs-extra');
const path = require('path');
const request = require('request-promise');
const {URL} = require('url');
const _ = require('lodash');
const json2csv = require('json2csv');
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
   * Gets the summary doc for a specific repository.
   *
   * This will trigger an index fetch if none exists.
   *
   * @param {String} slug slug of the repository
   * @return {Object} repository summary
   */
  getRepoByName: function(slug) {
    let index = this.getRepos();
    if(index === null) {
      logger.log('error', 'No repository index was found.');
    }
    let repo = _.find(index.repos, {slug: slug});
    if(!repo) {
      logger.log('error', `No repository with slug '${slug}' was found.`);
      process.exit(1);
    } else {
      return repo;
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
      json: true,
      rejectUnauthorized: false,
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
            let nextUrl = getNextPageUrl(body);
            repoIndexObj.repos = [...repoIndexObj.repos, ...body.values];
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
   * Gets the repository commits from the Bitbucket API.
   *
   * @param {string} repoSlug slug of the repository
   * @param {function} commitsDone called when all commits are fetched
   */
  getCommits: function(repoSlug, commitsDone) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    let token = setup.getToken();

    if(token === null) {
      logger.log('error', `Repo commit fetch requires an OAuth access token. Run command 'setup -t'.`);
      process.exit(1);
    }

    // Construct the URL - currently only supports MERGED PRs
    const repoObj = this.getRepoByName(repoSlugCleaned);
    const commitUrl = new URL(repoObj.links.commits.href);
    let url = commitUrl.href;

    const options = {
      method: 'GET',
      url: url,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
      gzip: true,
      json: true,
      rejectUnauthorized: false,
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
    const requestCommits = (req, options) => {
      const originalOptions = Object.assign({}, options);

      const requestPage = (options) => {
        logger.log('debug', `Fetching ${options.url} ...`);
        return req(options)
          .then((body) => {
            let nextUrl = getNextPageUrl(body);

            // Write the commits to file
            writeResponse(repoSlugCleaned, body);

            if(nextUrl !== null) {
              options.url = nextUrl;
              requestPage(options);
            }
          });
      };

      requestPage(options)
        .then(() => {
      })
        .catch((err) => {
          if (err.statusCode === 401) {
            logger.log('debug', 'Access token rejected. Refreshing it now.');
            setup.refreshToken()
              .then((refreshedToken) => {
                let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                logger.log('debug', 'New access token received. Retrying commit request.');
                // Use original options but with new token
                requestPage(updatedOptionsWithToken);
              });
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
     * Writes data to the commit file.
     * @param {string} repoSlug repository slug to use for subdirectory
     * @param {object} data JSON to serialize for a single commit
     */
    const writeResponse = (repoSlug, data) => {
      const dir = commitConfig.directory.replace('{repo_slug}', repoSlug);

      createDirSync(dir);

      data.values.forEach(function(d) {
        const dataExtracted = Object.assign({},
          {hash: d.hash},
          {date: d.date},
          {message: d.message},
          {author: {
            user: {
              username: (d.author.user && d.author.user.username) ? d.author.user.username : 'Unknown',
              display_name: (d.author.user && d.author.user.display_name) ? d.author.user.display_name : 'Unknown',
          }}});

        const filePath = path.join(dir, commitConfig.fileNamePatternSingleCommit.replace('{com#}', d.hash));
        fs.writeFileSync(filePath, JSON.stringify(dataExtracted));
      });
    };

    requestCommits(request, options);
  },

  /**
   * Exports commit data for a specific repository to a CSV file.
   *
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-commits.csv] file name to write
   * @param {Function} [exportDone] export operation is done
   */
  exportCommits: function(repoSlug, fileName=`${repoSlug}-commits.csv`, exportDone) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let exportArray = this.getArrayDataForCommits(repoSlugCleaned);

    if(exportArray.length) {
      let dataForSerialization = json2csv({
        data: exportArray,
        fields: Object.keys(_.head(exportArray)),
      });
      fs.writeFile(fileName, dataForSerialization, (err) => {
        if(err) {
          logger.log('error', `Could not serialize commit data to file '${fileName}'.`);
        } else {
          logger.log('info', `Repository commits exported to '${fileName}'.`);
        }
        if(exportDone && typeof exportDone === 'function') {
          exportDone();
        }
      });
    } else {
      logger.log('info', `No commit data to export for repo slug '${repoSlugCleaned}'.`);
    }
  },

  /**
   * Clears (deletes) all repository index information and fetches it again.
   */
  refresh: function() {
    this.clear();
    this.getRepos();
  },

  /**
   * Gets an array of repo objects matching the project names.
   * @param {Array} projects list of projects of interest
   * @return {Array} matching repositories
   */
  reposForProjects: function(projects) {
    let index = getIndexFromDisk();
    if(index === null || !index.repos) {
      logger.log('error', `Getting repos requires a repo index file. Run command 'repo index'.`);
      process.exit(1);
    }

    // Filter out repositories not matching one of the projects specified
    let regexCondition = null;
    let filtered = index.repos;
    if(projects && projects.length && projects !== 'global') {
      projects = projects.map((p) => {
        return `^${p}$`;
      });
      regexCondition = new RegExp(projects.join('|'), 'i');
      filtered = _.filter(index.repos, (o) => {
        if(regexCondition) {
          return regexCondition.test(o.project.key) || regexCondition.test(o.project.name);
        }
        return true;
      });
    }

    // Alpha sort
    filtered = _.sortBy(filtered, (o) => {
      return o.slug;
    });

    return filtered;
  },

  /**
   * Displays a list of repositories found in the Bitbucket account.
   * @param {Array} projects filter and display only repositories matching these projects (case insensitive)
   * @param {boolean} grepable whether the printed list should be easily grep-able
   */
  listRepos: function(projects, grepable) {
    let filtered = this.reposForProjects(projects);
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

    // Only return the data that matters
    filtered.map((r) => {
      if(grepable) {
        console.log(`${r.slug}|${r.project.key}|${r.description}`);
      } else {
        const o = [
          r.slug,
          r.project.key,
          r.description,
        ];
        table.push(o);
      }
    });

    if(!grepable) {
      console.log(table.toString());
    }
  },

  /**
   * Displays a list of projects found in the Bitbucket account.
   * @param {Array} projects filter and display only repositories matching these projects (case insensitive)
   * @param {boolean} grepable whether the printed list should be easily grep-able
   */
  listProjects: function(projects, grepable) {
    let filtered = this.reposForProjects(projects);
    let table = new Table({
      head: ['Project', 'Repo Samples'],
      colWidths: [35, 80],
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '-', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' ',
      },
      style: {'head': ['green'], 'padding-left': 0, 'padding-right': 0},
    });

    let dict = {};

    filtered.map((repo) => {
      if(!dict[repo.project.key]) {
        dict[repo.project.key] = [];
      }
      dict[repo.project.key].push(repo.slug);
    });

    for(const key in dict) {
      if ({}.hasOwnProperty.call(dict, key)) {
        // Take the first N repositories and stringify them as samples
        dict[key] = _.take(_.uniq(dict[key]), 3).join(', ');
        if(!grepable) {
          table.push([key, dict[key]]);
        } else {
          console.log(`${key}|${dict[key]}`);
        }
      }
    }

    if(!grepable) {
      console.log(table.toString());
    }
  },

  /**
   * Gets array of data for all commits of a particular repository.
   *
   * @param {string} repoSlug repository slug
   * @return {Array} array of objects each corresponding to a single commit
   */
  getArrayDataForCommits: function(repoSlug) {
    let result = getFileListOfAllCommits(repoSlug);
    let exportArray = [];

    if(result !== null) {
      const projectKey = this.getRepoByName(repoSlug).project.key;
      for(let fObj of result) {
        let commit = JSON.parse(fs.readFileSync(fObj.path));

        // Get Jira ticket information (if any is available)
        let message = _.has(commit, 'message') ? commit.message : null;
        let tickets = _.uniq(message.match(jiraConfig.ticketRegExp)).join(',');

        exportArray.push({
          repo: repoSlug,
          project: projectKey,
          author_display_name: _.has(commit, 'author.user.display_name') ? commit.author.user.display_name : commit.author.user.username,
          hash: _.has(commit, 'hash') ? commit.hash : null,
          date: _.has(commit, 'date') ? commit.date : null,
          message: _.has(commit, 'message') ? commit.message : null,
          message_word_count: _.has(commit, 'message') ? (commit.message.match(/\S+/g) ? commit.message.match(/\S+/g).length : 0) : 0,
          tickets: tickets.length ? tickets : null,
        });
      }
    }

    return exportArray;
  },

};

/**
 * Gets the file listing for all PRs on disk for a given repository.
 *
 * This performs a regular expression check on each file to ensure only
 * expected files are included in the listing (i.e. no README or dot files).
 *
 * @param {string} repoSlug repository slug
 * @return {Array|Null} Full file list or null if none found
 */
const getFileListOfAllCommits = (repoSlug) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  const filePath = path.join(commitConfig.directory.replace('{repo_slug}', repoSlug));
  const reg = commitConfig.fileNamePatternSingleCommitRegex;

  if (fs.existsSync(filePath)) {
    let files = [];
    const fileList = fs.readdirSync(filePath);
    fileList.forEach((f) => {
      let regResult = reg.exec(f);
      if(regResult != null) {
        let o = {
          hash: regResult[1],
          path: path.join(filePath, f),
        };
        files.push(o);
      }
    });

    return files;
  }
  return null;
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
      result = null;
      logger.log('error', `Unparseable repo data in file '${filePath}'. Run 'repo -c' then 'repo -r' to reset.`);
    }
  }
  return result;
};

/**
 * Gets the index file for a repository's commits.
 * @param {string} repoSlug repository slug
 * @param {string} hash commit hash
 * @return {number|null} pages cached ("len") or null if no index found
 */
const hasCommitOnDisk = (repoSlug, hash) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  if(!hash || !hash.length) {
    logger.log('error', 'Repository hash is invalid.');
    process.exit(1);
  }

  const filePath = path.join(
    commitConfig.directory.replace('{repo_slug}', repoSlug),
    commitConfig.fileNamePatternSingleCommit.replace('{com#}', hash));

  return fs.existsSync(filePath);
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
 * Checks the repository slug to ensure it's a valid string and exist if not.
 * @param {string} repoSlug repository slug
 */
const exitOnInvalidRepoSlug = (repoSlug) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'You must specifiy a repository.');
    process.exit(1);
  }
};

/**
 * Inspects an object to test if array then returns the head, or
 * simply returns the string.
 *
 * @param {array|string} input object to inspect
 * @return {string|null} contents at array index 0 or null if not a valid array
 */
const arrayHeadOrValue = (input) => {
  if(typeof input != 'undefined' && input != null && (typeof input === 'array') && input.length > 0) {
    return input[0];
  } else {
    return input.toString().trim();
  }
};
