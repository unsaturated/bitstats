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
const _ = require('lodash');
const Table = require('cli-table');

module.exports = {

  /**
   * Clears (deletes) all PR information serialized to disk.
   * @param {string} repoSlug name of the repo
   */
  clear: function(repoSlug) {
    if(!repoSlug || !repoSlug.length) {
      logger.log('error', 'You must specifiy a repository to clear.');
      process.exit(1);
    }

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

  const filePath = path.join(repos.directory, repoSlug, repos.fileNameReposIndex.replace('#', prNum));
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
    fs.mkdirSync(dir);
  }
};

/**
 * Checks for clean answer.
 * @param {string} value input from STDIN
 * @return {boolean} true if answer is y|yes
 */
const isCleanYes = (value) => {
  const valueRegex = /^[y|yes]$/i;
  if(valueRegex.test(value.toString())){
    return true;
  }
  return false;
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
