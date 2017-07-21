/**
 * Module to process all pull request data.
 */

const logger = require('../config').logger;
const prConfig = require('../config').pr;
const jiraConfig = require('../config').jira;
const setup = require('../bitstats-setup/setup');
const repo = require('../bitstats-repo/repo');
const fs = require('fs-extra');
const path = require('path');
const request = require('request-promise');
const readline = require('readline');
const {URL} = require('url');
const _ = require('lodash');
const json2csv = require('json2csv');
const async = require('async');

module.exports = {

  /**
   * Exports global PR, comment, commit, and approval data to CSV files.
   * @param {bool} comments whether to include comments
   * @param {bool} commits whether to include commits
   * @param {bool} approvals whether to include approvals
   * @param {function} [exportDone] export operation is done
   */
  exportGlobal: function(comments, commits, approvals, exportDone) {
    this.exportProject('global', comments, commits, approvals, exportDone);
  },

  /**
   * Exports a project's PR, comment, commit, and approval data to CSV files.
   * @param {String} projectSlug project slug or 'global' for all repositories
   * @param {bool} comments whether to include comments
   * @param {bool} commits whether to include commits
   * @param {bool} approvals whether to include approvals
   * @param {function} [exportDone] export operation is done
   */
  exportProject: function(projectSlug, comments, commits, approvals, exportDone) {
    exitOnInvalidProjectSlug(projectSlug);
    const repoList = repo.reposForProjects(projectSlug);

    if(!repoList.length) {
      logger.log('error', `No repositories found for that project name. Run command 'repo list' to view.`);
      process.exit(1);
    }

    /**
     * Creates the CSV object and serializes to a file.
     * @param {string} slug repository or project slug
     * @param {array} arrData array of data
     * @param {string} exportType type such as 'comments' or 'approvals'
     * @param {string} fileName file name to write
     * @param {Function} exportDone callback when file is written
     */
    const writeCsvForArray = (slug, arrData, exportType, fileName=`${slug}-project-${exportType}.csv`, exportDone) => {
      if(arrData.length) {
        // Use the first array object to extract its keys (to serve as header row for CSV)
        let dataForSerialization = json2csv({
          data: arrData,
          fields: Object.keys(_.head(arrData)),
        });
        fs.writeFile(fileName, dataForSerialization, (err) => {
          if(err) {
            logger.log('error', `Could not serialize data to file '${fileName}'.`);
          } else {
            logger.log('info', `Data exported to '${fileName}'.`);
          }
          if(exportDone && typeof exportDone === 'function') {
            exportDone();
          }
        });
      } else {
        logger.log('info', `No ${exportType} data to export for slug '${slug}'.`);
      }
    };

    let projectPrArray = [];
    let projectCommentsArray = [];
    let projectCommitsArray = [];
    let projectApprovalsArray = [];

    for (const repoToExport of repoList) {
      logger.log('debug', `Exporting repo '${repoToExport.slug}'...`);

      let exportPrArray = getArrayDataForPr(repoToExport.slug);
      projectPrArray.push(...exportPrArray);

      let exportCommentsArray = comments ? getArrayDataForComments(repoToExport.slug) : [];
      projectCommentsArray.push(...exportCommentsArray);

      let exportCommitsArray = commits ? getArrayDataForCommits(repoToExport.slug) : [];
      projectCommitsArray.push(...exportCommitsArray);

      let exportApprovalsArray = approvals ? getArrayDataForApprovals(repoToExport.slug) : [];
      projectApprovalsArray.push(...exportApprovalsArray);
    }

    async.series([
          function(cb) {
              writeCsvForArray(projectSlug, projectPrArray, 'prs', undefined, cb);
          },
          function(cb) {
            writeCsvForArray(projectSlug, projectCommentsArray, 'comments', undefined, cb);
          },
          function(cb) {
            writeCsvForArray(projectSlug, projectCommitsArray, 'commits', undefined, cb);
          },
          function(cb) {
            writeCsvForArray(projectSlug, projectApprovalsArray, 'approvals', undefined, cb);
          },
        ],
        function(err, data) {
          if (exportDone && typeof exportDone === 'function') {
            logger.log('info', `Done exporting project '${projectSlug}'.`);
            exportDone();
          }
        });
  },

  /**
   * Exports the PR data for a repository to a CSV file.
   *
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-pr.csv] file name to write
   * @param {Function} [exportDone] export operation is done
   */
  export: function(repoSlug, fileName=`${repoSlug}-prs.csv`, exportDone) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let exportArray = getArrayDataForPr(repoSlugCleaned);

    if(exportArray.length) {
      // Use the first array object to extract its keys (to serve as header row for CSV)
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
        if(exportDone && typeof exportDone === 'function') {
          exportDone();
        }
      });
    } else {
      logger.log('info', `No PR data to export for repo slug '${repoSlugCleaned}'.`);
    }
  },

  /**
   * Exports comment data for a specific repository to a CSV file.
   *
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-comment.csv] file name to write
   * @param {Function} [exportDone] export operation is done
   */
  exportComments: function(repoSlug, fileName=`${repoSlug}-comment.csv`, exportDone) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let exportArray = getArrayDataForComments(repoSlugCleaned);

    if(exportArray.length) {
      // Use the first array object to extract its keys (to serve as header row for CSV)
      let dataForSerialization = json2csv({
        data: exportArray,
        fields: Object.keys(_.head(exportArray)),
      });
      fs.writeFile(fileName, dataForSerialization, (err) => {
        if(err) {
          logger.log('error', `Could not serialize comment data to file '${fileName}'.`);
        } else {
          logger.log('info', `PR comments exported to '${fileName}'.`);
        }
        if(exportDone && typeof exportDone === 'function') {
          exportDone();
        }
      });
    } else {
      logger.log('info', `No comment data to export for repo slug '${repoSlugCleaned}'.`);
    }
  },

  /**
   * Exports commit data for a specific repository to a CSV file.
   *
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-commit.csv] file name to write
   * @param {Function} [exportDone] export operation is done
   */
  exportCommits: function(repoSlug, fileName=`${repoSlug}-commit.csv`, exportDone) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let exportArray = getArrayDataForCommits(repoSlugCleaned);

    if(exportArray.length) {
      let dataForSerialization = json2csv({
        data: exportArray,
        fields: Object.keys(_.head(exportArray)),
      });
      fs.writeFile(fileName, dataForSerialization, (err) => {
        if(err) {
          logger.log('error', `Could not serialize commit data to file '${fileName}'.`);
        } else {
          logger.log('info', `PR commits exported to '${fileName}'.`);
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
   * Exports approval data for a specific repository to a CSV file.
   *
   * @param {String} repoSlug repository slug
   * @param {String} [fileName=reposlug-approval.csv] file name to write
   * @param {Function} [exportDone] export operation is done
   */
  exportApprovals: function(repoSlug, fileName=`${repoSlug}-approval.csv`, exportDone) {
    exitOnInvalidRepoSlug(repoSlug);
    let repoSlugCleaned = arrayHeadOrValue(repoSlug);
    let exportArray = getArrayDataForApprovals(repoSlugCleaned);

    if(exportArray.length) {
      let dataForSerialization = json2csv({
        data: exportArray,
        fields: Object.keys(_.head(exportArray)),
      });
      fs.writeFile(fileName, dataForSerialization, (err) => {
        if(err) {
          logger.log('error', `Could not serialize approval data to file '${fileName}'.`);
        } else {
          logger.log('info', `PR approvals exported to '${fileName}'.`);
        }
        if(exportDone && typeof exportDone === 'function') {
          exportDone();
        }
      });
    } else {
      logger.log('info', `No approval data to export for repo slug '${repoSlugCleaned}'.`);
    }
  },

  /**
   * Clears (deletes) all PR information serialized to disk for all repositories.
   * @param {bool} force if deletion should be forced or prompt for each repo
   */
  clearGlobal: function(force) {
    this.clearProject('global', force);
  },

  /**
   * Clears (deletes) all PR information serialized to disk for a project's repositories.
   * @param {string} projectName name of the project
   * @param {bool} force if deletion should be forced or prompt for each repo
   */
  clearProject: function(projectName, force) {
    exitOnInvalidProjectSlug(projectName);

    const repoList = repo.reposForProjects(projectName);

    if(!repoList.length) {
      logger.log('error', `No repositories found for that project name. Run command 'repo list' to view.`);
      process.exit(1);
    }

    for(const repo of repoList) {
      this.clear(repo.slug, force);
    }
  },

  /**
   * Clears (deletes) all PR information serialized to disk.
   * @param {string} repoSlug name of the repo
   * @param {bool} force if deletion should be forced or prompt for each repo
   */
  clear: function(repoSlug, force) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    const dirToDelete = path.join(prConfig.directory.replace('{repo_slug}', repoSlugCleaned));

    if (fs.existsSync(dirToDelete)) {
      if(force) {
        fs.removeSync(dirToDelete);
      } else {
        // Create an 'are you sure?' prompt
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question(`Delete cached PR files for '${repoSlug}' (n/Y)? : `,
            (a) => {
              if (isCleanYes(a)) {
                fs.removeSync(dirToDelete);
                logger.log('info', `Deleted PR files for that repository.`);
              }
              rl.close();
            });
      }
    } else {
      if(!force) {
        // Don't nag about non-existent repos if delete is forced
        logger.log('info', `No PR data was found for '${repoSlugCleaned}.`);
      }
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
   * Fetches pull request data from Bitbucket for all repositories.
   *
   * @param {bool} comments whether to fetch comments
   * @param {bool} commits whether to fetch commits
   * @param {bool} approvals whether to fetch approvals
   * @param {Function} [refreshGlobalDone] function called when refresh is complete
   */
  refreshGlobal: function(comments, commits, approvals, refreshGlobalDone) {
    this.refreshProject('global', comments, commits, approvals, refreshGlobalDone);
  },

  /**
   * Fetches pull request data from Bitbucket for all repositories
   * matching the project specified.
   *
   * @param {Array} projects list of projects of interest
   * @param {bool} comments whether to fetch comments
   * @param {bool} commits whether to fetch commits
   * @param {bool} approvals whether to fetch approvals
   * @param {Function} [refreshProjectDone] function called when refresh is complete
   */
  refreshProject: function(projects, comments, commits, approvals, refreshProjectDone) {
    exitOnInvalidProjectSlug(projects);

    const repoList = repo.reposForProjects(projects);

    if(!repoList.length) {
      logger.log('error', `No repositories found for that project name. Run command 'repo list' to view.`);
      process.exit(1);
    }

    let repoCount = repoList.length;
    let reposDone = 0;
    let _this = this;

    async.whilst(
        function() {
          return reposDone < repoCount;
        },
        function(whilstCallback) {
          let repoToIndex = repoList.pop();
          logger.log('info', `Indexing repo '${repoToIndex.slug}'...`);
          _this.refresh(repoToIndex.slug, () => {
            async.series([
                function(cb) {
                  if(comments) {
                    _this.refreshComments(repoToIndex.slug, cb);
                  } else {
                    cb();
                  }
                },
                function(cb) {
                  if(commits) {
                    _this.refreshCommits(repoToIndex.slug, cb);
                  } else {
                    cb();
                  }
                },
                function(cb) {
                  if(approvals) {
                    _this.refreshApprovals(repoToIndex.slug, cb);
                  } else {
                    cb();
                  }
                },
            ],
            function(err, results) {
              reposDone++;
              whilstCallback();
            });
          });
        },
        function(err, data) {
          if (refreshProjectDone && typeof refreshProjectDone === 'function') {
            logger.log('info', `Done indexing for project '${_.head(projects)}'.`);
            refreshProjectDone();
          }
        });
  },

  /**
   * Fetches pull request data from Bitbucket and serializes to disk.
   *
   * This function will only fetch newer PRs from Bitbucket. It will not
   * update existing PRs. To fully update the index, the only way is to
   * dump the PR index and refresh.
   *
   * @param {string} repoSlug repository to fetch PRs for
   * @param {Function} [refreshDone] function called when refresh is complete
   */
  refresh: function(repoSlug, refreshDone) {
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
      rejectUnauthorized: false,
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
            // No need to preserve "body" so we'll pop the array

            async.whilst(
              function() {
                return body.values.length > 0;
              },
              function(whilstCallback) {
                let singlePr = body.values.pop();

                // Only write outside the bounds of current ids on disk
                if(minMaxIds !== null) {
                  if(singlePr.id < minMaxIds.min || singlePr.id > minMaxIds.max) {
                    writeResponse(repoSlugCleaned, singlePr, whilstCallback);
                  }
                } else {
                  writeResponse(repoSlugCleaned, singlePr, whilstCallback);
                }
              },
              function(err, data) {
                if(nextUrl !== null) {
                  options.url = nextUrl;
                  requestPage(options);
                } else {
                  if (refreshDone && typeof refreshDone === 'function') {
                    refreshDone();
                  }
                }
              });
          });
      };

      requestPage(options)
        .then(() => {
          // TODO : What should this function return?
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
     * Writes data to the PR index file.
     * @param {string} repoSlug repository slug to use for subdirectory
     * @param {object} data JSON to serialize for a single PR
     * @param {Function} [writeDone] function called when write is complete
     */
    const writeResponse = (repoSlug, data, writeDone) => {
      const dir = prConfig.directory.replace('{repo_slug}', repoSlug);

      createDirSync(dir);

      const prNum = data.id;

      const filePath = path.join(dir, prConfig.fileNamePatternPrIndex.replace('{#}', prNum));

      fs.writeFile(filePath, JSON.stringify(data), (err) => {
        if (err) {
          let msg = `Could not write PR index to file '${filePath}'`;
          logger.log('error', msg);
        }
        if(writeDone && typeof writeDone === 'function') {
          writeDone();
        }
      });
    };

    requestPrs(request, options);
  },

  /**
   * Fetches comment data from Bitbucket and serializes to disk. This
   * function has a dependency on existing PR data.
   *
   * This function will only fetch newer PR comments from Bitbucket.
   * It will not update existing PRs or comments. To fully update
   * the index, the only way is to dump the PR index and refresh.
   *
   * @param {string} repoSlug repository to fetch PRs for
   * @param {Function} [refreshDone] function called when refresh is complete
   */
  refreshComments: function(repoSlug, refreshDone) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    let token = setup.getToken();

    if(token === null) {
      logger.log('error', `PR fetch requires an OAuth access token. Run command 'setup token'.`);
      process.exit(1);
    }

    // What PRs do we have?
    const minMaxPr = getHighestPullRequestIdFromDisk(repoSlugCleaned);

    if(minMaxPr === null) {
      logger.log('info', `No PR comments are available for repo '${repoSlugCleaned}'.`);
      return refreshDone();
    }

    // What PRs do we have for comments?
    const minMaxPrForComment = getHighestPullRequestIdFromDisk(repoSlugCleaned, 'comments');

    let commentRangeToFetch = null;

    // No min/max for the comments means we have to fetch all comments according to available PRs
    if(minMaxPrForComment === null) {
      commentRangeToFetch = {
        min: minMaxPr.min,
        max: minMaxPr.max,
      };
    } else {
      // What PR comments do we need to fetch?
      // Minimum is the difference; maximum can be no higher than the PR itself
      commentRangeToFetch = {
        min: Math.min(minMaxPr.max, minMaxPrForComment.max),
        max: minMaxPr.max,
      };
    }

    // Must we fetch any data? If the difference between the min and max is zero, then we do not.
    if( (commentRangeToFetch.max - commentRangeToFetch.min) > 0) {
      // Get the PR id so we can fetch the comments for each

      let prId = commentRangeToFetch.min;

      async.whilst(
        function() {
          return prId <= commentRangeToFetch.max;
        },
        function(whilstCallback) {
          let prData = getIndexFromDisk(repoSlugCleaned, prId);

          const options = {
            method: 'GET',
            url: encodeURI(prData.links.comments.href),
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
            },
            gzip: true,
            json: true,
            rejectUnauthorized: false,
          };

          /**
           * Uses request to fetch a page of data.
           * @param {object} req request instance
           * @param {object} options request options (verb, headers, etc)
           */
          const requestPrComments = (req, options) => {
            const originalOptions = Object.assign({}, options);

            const requestPage = (options) => {
              logger.log('debug', `Fetching ${options.url} ...`);
              return req(options)
                .then((body) => {
                  let nextUrl = getNextPageUrl(body);

                  // Extract each PR and write to separate file
                  // No need to preserve "body" so we'll pop the array

                  async.whilst(
                    function() {
                      return body.values.length > 0;
                    },
                    function(whilstWriteCallback) {
                      let singlePrComment = body.values.pop();

                      // Extract each PR comment and write to separate file
                      writeCommentResponse(repoSlugCleaned, prId, singlePrComment, whilstWriteCallback);
                    },
                    function(err, data) {
                      if (nextUrl !== null) {
                        options.url = nextUrl;
                        requestPage(options);
                      } else {
                        prId++;
                        whilstCallback();
                      }
                    });
                });
            };

            requestPage(options)
              .then(() => {
                // TODO : Oh no? What should we do with this?
              })
              .catch((err) => {
                if (err.statusCode === 401) {
                  logger.log('debug', 'Access token rejected. Refreshing it now.');
                  setup.refreshToken()
                    .then((refreshedToken) => {
                      let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                      token = refreshedToken;
                      logger.log('debug', 'New access token received. Retrying PR request.');
                      // Use original options but with new token
                      requestPage(updatedOptionsWithToken);
                    });
                }
                if (err.statusCode === 404) {
                  logger.log('error', 'That repository no longer exists or has moved.');
                } else {
                  logger.log('error', err.message);
                }
              });
          };

          /**
           * Writes data to the PR comment index file.
           * @param {string} repoSlug repository slug to use for subdirectory
           * @param {number} prNum pull request number/id
           * @param {object} data JSON to serialize for a single PR
           * @param {Function} [writeDone] function called when write is complete
           */
          const writeCommentResponse = (repoSlug, prNum, data, writeDone) => {
            const dir = prConfig.commentsDirectory.replace('{repo_slug}', repoSlug);

            createDirSync(dir);

            const comNum = data.id;

            // Amend the serialized data
            // This is the fastest way to trace a commenter back to who created the PR
            data.is_pr_author = (prData.author.display_name === data.user.display_name);

            const filePath = path.join(dir,
              prConfig.fileNamePatternPrCommentIndex
                .replace('{pr#}', prNum)
                .replace('{com#}', comNum));

            fs.writeFile(filePath, JSON.stringify(data), (err) => {
              if (err) {
                let msg = `Could not write PR comment index to file '${filePath}'`;
                logger.log('error', msg);
              }
              if(writeDone && typeof writeDone === 'function') {
                writeDone();
              }
            });
          };

          requestPrComments(request, options);
        },
        function(err, data) {
          if (refreshDone && typeof refreshDone === 'function') {
            refreshDone();
          }
        });
    } else {
      logger.log('info', 'No PR comments to fetch.');
      if (refreshDone && typeof refreshDone === 'function') {
        return refreshDone();
      }
    }
  },

  /**
   * Fetches commit data from Bitbucket and serializes to disk. This
   * function has a dependency on existing PR data.
   *
   * This function will only fetch new commits from Bitbucket. It will not
   * update existing commits (how would those change anyway?). To fully
   * update the index, the only way is to dump the PR index and refresh.
   *
   * @param {string} repoSlug repository to fetch commits for
   * @param {Function} [refreshDone] function called when refresh is complete
   */
  refreshCommits: function(repoSlug, refreshDone) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    let token = setup.getToken();

    if(token === null) {
      logger.log('error', `Commit fetch requires an OAuth access token. Run command 'setup token'.`);
      process.exit(1);
    }

    // What PRs do we have?
    const minMaxPr = getHighestPullRequestIdFromDisk(repoSlugCleaned);

    if(minMaxPr === null) {
      logger.log('info', `No PR commits are available for repo '${repoSlugCleaned}'.`);
      return refreshDone();
    }

    // What PRs do we have for commits?
    const minMaxPrForComment = getHighestPullRequestIdFromDisk(repoSlugCleaned, 'commits');

    let commitRangeToFetch = null;

    // No min/max for the commits means we have to fetch all commits according to available PRs
    if(minMaxPrForComment === null) {
      commitRangeToFetch = {
        min: minMaxPr.min,
        max: minMaxPr.max,
      };
    } else {
      // What PR commits do we need to fetch?
      // Minimum is the difference; maximum can be no higher than the PR itself
      commitRangeToFetch = {
        min: Math.min(minMaxPr.max, minMaxPrForComment.max),
        max: minMaxPr.max,
      };
    }

    // Must we fetch any data? If the difference between the min and max is zero, then we do not.
    if( (commitRangeToFetch.max - commitRangeToFetch.min) > 0) {
      // Get the PR id so we can fetch the commits for each

      let prId = commitRangeToFetch.min;

      async.whilst(
        function() {
          return prId <= commitRangeToFetch.max;
        },
        function(whilstCallback) {
          let prData = getIndexFromDisk(repoSlugCleaned, prId);

          const options = {
            method: 'GET',
            url: encodeURI(prData.links.commits.href),
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
            },
            gzip: true,
            json: true,
            rejectUnauthorized: false,
          };

          /**
           * Uses request to fetch a page of data.
           * @param {object} req request instance
           * @param {object} options request options (verb, headers, etc)
           */
          const requestPrCommits = (req, options) => {
            const originalOptions = Object.assign({}, options);
            let commitIndexObj = {
              commits: [],
            };

            const requestPage = (options) => {
              logger.log('debug', `Fetching ${options.url} ...`);
              return req(options)
                .then((body) => {
                  let nextUrl = getNextPageUrl(body);

                  // Amend the serialized data
                  // This is the fastest way to trace a commiter back to who created the PR
                  for(let commit of body.values) {
                    commit.pullrequest = {
                      id: prId,
                    };
                    commit.is_pr_author = (prData.author.display_name === commit.author.user.display_name);
                  }

                  commitIndexObj.commits = [...commitIndexObj.commits, ...body.values];
                  if (nextUrl !== null) {
                    options.url = nextUrl;
                    requestPage(options);
                  } else {
                    prId++;
                    writeCommitResponse(repoSlugCleaned, prData.id, commitIndexObj, whilstCallback);
                  }
                })
                .catch((err) => {
                    if (err.statusCode === 404) {
                      logger.log('info', `Commits for PR #${prId} no longer exist; the branch was merged or deleted.`);
                    }
                    prId++;
                    whilstCallback();
                });
            };

            requestPage(options)
              .then(() => {
                // TODO : Oh no? What should we do with this?
              })
              .catch((err) => {
                if (err.statusCode === 401) {
                  logger.log('debug', 'Access token rejected. Refreshing it now.');
                  setup.refreshToken()
                    .then((refreshedToken) => {
                      let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                      token = refreshedToken;
                      logger.log('debug', 'New access token received. Retrying PR request.');
                      // Use original options but with new token
                      requestPage(updatedOptionsWithToken);
                    });
                } else {
                  logger.log('error', err.message);
                }
              });
          };

          /**
           * Writes aggregated commit data for a single PR to an index file.
           * @param {string} repoSlug repository slug to use for subdirectory
           * @param {number} prNum pull request number/id
           * @param {object} data JSON to serialize for a single commit
           * @param {Function} [writeDone] function called when write is complete
           */
          const writeCommitResponse = (repoSlug, prNum, data, writeDone) => {
            const dir = prConfig.commitsDirectory.replace('{repo_slug}', repoSlug);

            createDirSync(dir);

            const filePath = path.join(dir,
              prConfig.fileNamePatternPrCommitIndex
                .replace('{pr#}', prNum));

            fs.writeFile(filePath, JSON.stringify(data), (err) => {
              if (err) {
                let msg = `Could not write PR commit index to file '${filePath}'`;
                logger.log('error', msg);
              }
              if(writeDone && typeof writeDone === 'function') {
                writeDone();
              }
            });
          };

          requestPrCommits(request, options);
        },
        function(err, data) {
          if (refreshDone && typeof refreshDone === 'function') {
            refreshDone();
          }
        });
    } else {
      logger.log('info', 'No PR commits to fetch.');
      if (refreshDone && typeof refreshDone === 'function') {
        return refreshDone();
      }
    }
  },

  /**
   * Fetches approval activities from Bitbucket and serializes to disk. This
   * function has a dependency on existing PR data.
   *
   * This function will only fetch new approvals from Bitbucket. To fully
   * update the index, the only way is to dump the PR index and refresh.
   *
   * @param {string} repoSlug repository to fetch approval activity for
   * @param {Function} [refreshDone] function called when refresh is complete
   */
  refreshApprovals: function(repoSlug, refreshDone) {
    exitOnInvalidRepoSlug(repoSlug);

    let repoSlugCleaned = arrayHeadOrValue(repoSlug);

    let token = setup.getToken();

    if(token === null) {
      logger.log('error', `Approval fetch requires an OAuth access token. Run command 'setup token'.`);
      process.exit(1);
    }

    // What PRs do we have?
    const minMaxPr = getHighestPullRequestIdFromDisk(repoSlugCleaned);

    if(minMaxPr === null) {
      logger.log('info', `No PR approvals are available for repo '${repoSlugCleaned}'.`);
      return refreshDone();
    }

    // What PRs do we have for approvals?
    const minMaxPrForComment = getHighestPullRequestIdFromDisk(repoSlugCleaned, 'approvals');

    let approvalRangeToFetch = null;

    // No min/max for the commits means we have to fetch all approvals according to available PRs
    if(minMaxPrForComment === null) {
      approvalRangeToFetch = {
        min: minMaxPr.min,
        max: minMaxPr.max,
      };
    } else {
      // What PR approvals do we need to fetch?
      // Minimum is the difference; maximum can be no higher than the PR itself
      approvalRangeToFetch = {
        min: Math.min(minMaxPr.max, minMaxPrForComment.max),
        max: minMaxPr.max,
      };
    }

    // Must we fetch any data? If the difference between the min and max is zero, then we do not.
    if( (approvalRangeToFetch.max - approvalRangeToFetch.min) > 0) {
      // Get the PR id so we can fetch the commits for each

      let prId = approvalRangeToFetch.min;

      async.whilst(
        function() {
          return prId <= approvalRangeToFetch.max;
        },
        function(whilstCallback) {
          let prData = getIndexFromDisk(repoSlugCleaned, prId);

          const options = {
            method: 'GET',
            url: encodeURI(prData.links.activity.href),
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
            },
            gzip: true,
            json: true,
            rejectUnauthorized: false,
          };

          /**
           * Uses request to fetch a page of data.
           * @param {object} req request instance
           * @param {object} options request options (verb, headers, etc)
           */
          const requestPrApprovals = (req, options) => {
            const originalOptions = Object.assign({}, options);
            let approvalIndexObj = {
              approvals: [],
            };

            const requestPage = (options) => {
              logger.log('debug', `Fetching ${options.url} ...`);
              return req(options)
                .then((body) => {
                  let nextUrl = getNextPageUrl(body);

                  // We only care about the "update" and "approval" key from the returned values
                  // - The update can be to merge or decline the PR.
                  // - The approval is just that. Note: there appears to be no "unapprove" in the activity.
                  // This is also a vastly simplified object compared to the one returned from Bitbucket.

                  let activities = [];
                  for (let value of body.values) {
                    if (value.hasOwnProperty('update') || value.hasOwnProperty('approval')) {
                      let activity = {};
                      if (value.hasOwnProperty('approval')) {
                        activity.is_pr_author = (prData.author.display_name === value.approval.user.display_name);
                        activity.display_name = value.approval.user.display_name;
                        activity.date = value.approval.date;
                        activity.state = null;
                        activity.reason = null;
                        activity.is_approval = true;
                        activity.is_declined = false;
                        activity.is_update = false;
                      } else if (value.hasOwnProperty('update')) {
                        activity.is_pr_author = (prData.author.display_name === value.update.author.display_name);
                        activity.display_name = value.update.author.display_name;
                        activity.date = value.update.date;
                        activity.state = value.update.state;
                        activity.reason = value.update.reason;
                        activity.is_approval = (activity.state.toLowerCase() === 'merged');
                        activity.is_declined = (activity.state.toLowerCase() === 'declined');
                        activity.is_update = true;
                      }

                      activities.push(activity);
                    }
                  }

                  approvalIndexObj.approvals = [...approvalIndexObj.approvals, ...activities];
                  if (nextUrl !== null) {
                    options.url = nextUrl;
                    requestPage(options);
                  } else {
                    prId++;
                    writeApprovalResponse(repoSlugCleaned, prData.id, approvalIndexObj, whilstCallback);
                  }
                })
                .catch((err) => {
                  if (err.statusCode === 404) {
                    logger.log('info', `Approvals for PR #${prId} no longer exist; the PR was merged or deleted.`);
                  }
                  prId++;
                  whilstCallback();
                });
            };

            requestPage(options)
              .then(() => {
                // TODO : Oh no? What should we do with this?
              })
              .catch((err) => {
                if (err.statusCode === 401) {
                  logger.log('debug', 'Access token rejected. Refreshing it now.');
                  setup.refreshToken()
                    .then((refreshedToken) => {
                      let updatedOptionsWithToken = cloneOptionsWithToken(originalOptions, refreshedToken);
                      token = refreshedToken;
                      logger.log('debug', 'New access token received. Retrying PR request.');
                      // Use original options but with new token
                      requestPage(updatedOptionsWithToken);
                    });
                } else {
                  logger.log('error', err.message);
                }
              });
          };

          /**
           * Writes aggregated commit data for a single PR to an index file.
           * @param {string} repoSlug repository slug to use for subdirectory
           * @param {number} prNum pull request number/id
           * @param {object} data JSON to serialize for a single commit
           * @param {Function} [writeDone] function called when write is complete
           */
          const writeApprovalResponse = (repoSlug, prNum, data, writeDone) => {
            const dir = prConfig.approvalsDirectory.replace('{repo_slug}', repoSlug);

            createDirSync(dir);

            const filePath = path.join(dir,
              prConfig.fileNamePatternPrApprovalIndex
                .replace('{pr#}', prNum));

            fs.writeFile(filePath, JSON.stringify(data), (err) => {
              if (err) {
                let msg = `Could not write PR approval index to file '${filePath}'`;
                logger.log('error', msg);
              }
              if(writeDone && typeof writeDone === 'function') {
                writeDone();
              }
            });
          };

          requestPrApprovals(request, options);
        },
        function(err, data) {
          if (refreshDone && typeof refreshDone === 'function') {
            refreshDone();
          }
        });
    } else {
      logger.log('info', 'No PR approvals/activity to fetch.');
      if (refreshDone && typeof refreshDone === 'function') {
        return refreshDone();
      }
    }
  },
};

/**
 * Gets array of data for all PRs of a particular repository.
 *
 * This is data that can be aggregated at a higher level to create a
 * union of various repositories.
 *
 * @param {string} repoSlug repository slug
 * @return {Array} array of objects each corresponding to a single PR
 */
const getArrayDataForPr = (repoSlug) => {
  let result = getFileListOfAllPullRequests(repoSlug);
  let exportArray = [];

  if(result !== null) {
    const projectKey = repo.getRepoByName(repoSlug).project.key;
    for(let fObj of result) {
      let fileData = JSON.parse(fs.readFileSync(fObj.path));

      // Get Jira ticket information (if any is available)
      let title = _.has(fileData, 'title') ? fileData.title : null;
      let description = _.has(fileData, 'description') ? fileData.description : null;
      let titleAndDescription = (title || '') + (description || '');
      let tickets = _.uniq(titleAndDescription.match(jiraConfig.ticketRegExp)).join(',');

      exportArray.push({
        id: _.has(fileData, 'id') ? fileData.id : null,
        repo: repoSlug,
        project: projectKey,
        author_display_name: _.has(fileData, 'author.display_name') ? fileData.author.display_name : null,
        closed_by_display_name: _.has(fileData, 'closed_by.display_name') ? fileData.closed_by.display_name : null,
        comment_count: _.has(fileData, 'comment_count') ? fileData.comment_count : 0,
        created_on: _.has(fileData, 'created_on') ? fileData.created_on : null,
        destination_branch_name: _.has(fileData, 'destination.branch.name') ? fileData.destination.branch.name : null,
        source_branch_name: _.has(fileData, 'source.branch.name') ? fileData.source.branch.name : null,
        state: _.has(fileData, 'state') ? fileData.state : null,
        updated_on: _.has(fileData, 'updated_on') ? fileData.updated_on : null,
        word_count: titleAndDescription.match(/\S+/g).length,
        tickets: tickets.length ? tickets : null,
      });
    }
  }
  return exportArray;
};

/**
 * Gets array of data for all PR comments of a particular repository.
 *
 * This is data that can be aggregated at a higher level to create a
 * union of various repositories.
 *
 * @param {string} repoSlug repository slug
 * @return {Array} array of objects each corresponding to a single comment
 */
const getArrayDataForComments = (repoSlug) => {
  let result = getFileListOfAllPullRequests(repoSlug, 'comments');
  let exportArray = [];

  if(result !== null) {
    const projectKey = repo.getRepoByName(repoSlug).project.key;
    for(let fObj of result) {
      let fileData = JSON.parse(fs.readFileSync(fObj.path));
      exportArray.push({
        id: _.has(fileData, 'pullrequest.id') ? fileData.pullrequest.id : null,
        repo: repoSlug,
        project: projectKey,
        author_display_name: _.has(fileData, 'user.display_name') ? fileData.user.display_name : null,
        is_reply: _.has(fileData, 'parent.id'),
        is_pr_author: _.has(fileData, 'is_pr_author') ? fileData.is_pr_author : null,
        is_inline: _.has(fileData, 'inline'),
        created_on: _.has(fileData, 'created_on') ? fileData.created_on : null,
        word_count: _.has(fileData, 'content.raw') ? fileData.content.raw.match(/\S+/g).length : 0,
      });
    }
  }

  return exportArray;
};

/**
 * Gets array of data for all PR commits of a particular repository.
 *
 * This is data that can be aggregated at a higher level to create a
 * union of various repositories.
 *
 * @param {string} repoSlug repository slug
 * @return {Array} array of objects each corresponding to a single commit
 */
const getArrayDataForCommits = (repoSlug) => {
  let result = getFileListOfAllPullRequests(repoSlug, 'commits');
  let exportArray = [];

  if(result !== null) {
    const projectKey = repo.getRepoByName(repoSlug).project.key;
    for(let fObj of result) {
      let fileData = JSON.parse(fs.readFileSync(fObj.path));

      for(let commit of fileData.commits) {
        // Get Jira ticket information (if any is available)
        let message = _.has(commit, 'message') ? commit.message : null;
        let tickets = _.uniq(message.match(jiraConfig.ticketRegExp)).join(',');

        exportArray.push({
          id: fObj.index,
          repo: repoSlug,
          project: projectKey,
          author_display_name: _.has(commit, 'author.user.display_name') ? commit.author.user.display_name : null,
          hash: _.has(commit, 'hash') ? commit.hash : null,
          is_pr_author: _.has(commit, 'is_pr_author') ? commit.is_pr_author : null,
          date: _.has(commit, 'date') ? commit.date : null,
          word_count: _.has(commit, 'message') ? commit.message.match(/\S+/g).length : 0,
          is_merge: _.has(commit, 'parents') ? (commit.parents.length > 1) : false,
          tickets: tickets.length ? tickets : null,
        });
      }
    }
  }

  return exportArray;
};

/**
 * Gets array of data for all PR approvals of a particular repository.
 *
 * This is data that can be aggregated at a higher level to create a
 * union of various repositories.
 *
 * @param {string} repoSlug repository slug
 * @return {Array} array of objects each corresponding to a single approval
 */
const getArrayDataForApprovals = (repoSlug) => {
  let result = getFileListOfAllPullRequests(repoSlug, 'approvals');
  let exportArray = [];

  if(result !== null) {
    const projectKey = repo.getRepoByName(repoSlug).project.key;
    for(let fObj of result) {
      let fileData = JSON.parse(fs.readFileSync(fObj.path));

      for(let approvalData of fileData.approvals) {
        exportArray.push({
          id: fObj.index,
          repo: repoSlug,
          project: projectKey,
          author_display_name: _.has(approvalData, 'display_name') ? approvalData.display_name : null,
          is_pr_author: _.has(approvalData, 'is_pr_author') ? approvalData.is_pr_author : null,
          date: _.has(approvalData, 'date') ? approvalData.date : null,
          state: _.has(approvalData, 'state') ? approvalData.state : null,
          is_approval: _.has(approvalData, 'is_approval') ? approvalData.is_approval : false,
          is_declined: _.has(approvalData, 'is_declined') ? approvalData.is_declined : false,
          is_update: _.has(approvalData, 'is_update') ? approvalData.is_update : false,
        });
      }
    }
  }

  return exportArray;
};

/**
 * Creates a clone of a request options object and modifies its Authorization header.
 * @param {Object} opt options object
 * @param {Object} updatedToken token object
 * @return {Object} new object instance
 */
const cloneOptionsWithToken = (opt, updatedToken) => {
  let clonedOpt = Object.assign({}, opt);
  clonedOpt.headers.Authorization = `Bearer ${updatedToken.access_token}`;
  return clonedOpt;
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
 * Gets the highest and lowest pull request ID from the disk.
 *
 * It's possible a PR is indexed without comments, or that a refresh only needs
 * to fetch comments for the newest PRs. For that situation, this function
 * can optionally search for existing PR comments indexed to disk.
 *
 * For example, the PRs for ID 1,2,3,4,5 may be indexed. However, the comments
 * only for PRs 1,2,3 may exist. Omitting `searchType` will return min/max of 1,5.
 * Setting `searchType` will return min/max of 1,3.
 *
 * @param {string} repoSlug repository slug
 * @param {string} [searchType=""] set to "comments" or "commits" if the search is specific
 * @return {Object|Null} PR index object, null if not found
 */
const getHighestPullRequestIdFromDisk = (repoSlug, searchType) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  const fP = getFileAndPathRegex(repoSlug, searchType);
  const filePath = fP.filePath;
  const reg = fP.reg;

  if (fs.existsSync(filePath)) {
    let ids = [];
    const fileList = fs.readdirSync(filePath);
    fileList.forEach((f) => {
      let regResult = reg.exec(f);
      if (regResult != null) {
        ids.push(Number.parseInt(regResult[1], 10));
      }
    });
    if (ids.length) {
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
 * @param {string} [searchType=""] set to "comments" or "commits" if the search is specific
 * @return {Array|Null} Full file list or null if none found
 */
const getFileListOfAllPullRequests = (repoSlug, searchType) => {
  if(!repoSlug || !repoSlug.length) {
    logger.log('error', 'Repository slug is invalid.');
    process.exit(1);
  }

  const fP = getFileAndPathRegex(repoSlug, searchType);
  const filePath = fP.filePath;
  const reg = fP.reg;

  if (fs.existsSync(filePath)) {
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
 * Gets an object for a file path and regular expression for a repository
 * and its data subdirectory.
 *
 * @param {string} repoSlug repository slug
 * @param {string} [searchType=""] set to "comments", "commits" or "approvals" if the search is specific
 * @return {{filePath: *, reg: *}}
 */
const getFileAndPathRegex = (repoSlug, searchType='') => {
  let filePath = null;
  let reg = null;

  switch(searchType) {
    case '':
      filePath = path.join(prConfig.directory.replace('{repo_slug}', repoSlug));
      reg = prConfig.fileNamePatternPrRegex;
      break;
    case 'comments':
      filePath = path.join(prConfig.commentsDirectory.replace('{repo_slug}', repoSlug));
      reg = prConfig.fileNamePatternPrCommentRegex;
      break;
    case 'commits':
      filePath = path.join(prConfig.commitsDirectory.replace('{repo_slug}', repoSlug));
      reg = prConfig.fileNamePatternPrCommitRegex;
      break;
    case 'approvals':
      filePath = path.join(prConfig.approvalsDirectory.replace('{repo_slug}', repoSlug));
      reg = prConfig.fileNamePatternPrApprovalRegex;
      break;
  }

  return {
    filePath,
    reg,
  };
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
  if(typeof input != 'undefined' && input != null && (typeof input === 'array') && input.length > 0) {
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

/**
 * Checks the project slug to ensure it's a valid string and exist if not.
 * @param {string} projSlug project slug or 'global'
 */
const exitOnInvalidProjectSlug = (projSlug) => {
  if(!projSlug || !projSlug.length) {
    logger.log('error', `You must specifiy a project or 'global' for all projects.`);
    process.exit(1);
  }
};
