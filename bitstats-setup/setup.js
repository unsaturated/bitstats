/**
 * Created by mcrumley on 6/2/17.
 */
const logger = require('../config').logger;
const creds = require('../config').credentials;
const bitbucket = require('../config').bitbucket;
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const request = require('request-promise');

module.exports = {

  /**
   * Clears (deletes) all credential information serialized to disk.
   */
  clear: function() {
    const filesToDelete = [
      path.join(creds.directory, creds.fileNameAuth),
      path.join(creds.directory, creds.fileNameToken),
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
   * Serializes to a file credential information used to fetch an OAuth access
   * token. It overwrites previous credential information stored in the file.
   * It also requests the repositories home URL.
   */
  setCredentials: function() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompts = [
      {
        question: 'Enter your OAuth consumer key: ',
        answer: null,
        validates: isCleanOauthValue,
        error: 'Consumer key does not match known format',
      },
      {
        question: 'Enter your OAuth secret: ',
        answer: null,
        validates: isCleanOauthValue,
        error: 'Secret does not match known format',
      },
      {
        question: 'Enter your home URL of your repositories: ',
        answer: null,
        validates: isCleanUrlValue,
        error: 'Repositories home URL is not a valid URL',
      },
    ];

    /**
     * Prompts user with questions and awaits value from STDIN.
     * @param {Number} promptIndex starting index for prompts/questions
     * @param {Function} doneCallback callback on question complete (no error)
     */
    const getResponses = (promptIndex = 0, doneCallback) => {
      rl.question(prompts[promptIndex].question, (a) => {
        if (!prompts[promptIndex].validates(a)) {
          logger.log('error', prompts[promptIndex].error);
          rl.close();
          process.exit(1);
        } else {
          prompts[promptIndex].answer = a;
          if (promptIndex + 1 < prompts.length) {
            // Go to the next prompt
            return getResponses(promptIndex + 1, doneCallback);
          }
        }
        rl.close();
        return doneCallback();
      });
    };

    const writeResponses = () => {
      createDir(creds.directory);

      const data = (prompts.map((q) => {
        return q.answer;
      })).join(os.EOL);

      const filePath = path.join(creds.directory, creds.fileNameAuth);

      fs.writeFile(filePath, data, (err) => {
        if (err) {
          let msg = `Could not write setup data to file '${filePath}'`;
          logger.log('error', msg);
        }
      });
    };

    getResponses(0, writeResponses);
  },

  /**
   * Gets the credential information used to fetch an OAuth access token.
   * @return {Object|Null} Key/secret object, null if not found
   */
  getCredentials: function() {
    const filePath = path.join(creds.directory, creds.fileNameAuth);
    let result = null;

    if (fs.existsSync(filePath)) {
      let data = fs.readFileSync(filePath);

      let dataSplit = data.toString().split(os.EOL);

      if (dataSplit.length === 3) {
        if (isCleanOauthValue(dataSplit[0]) && isCleanOauthValue(dataSplit[1]) && isCleanUrlValue(dataSplit[2])) {
          result = {
            'key': dataSplit[0],
            'secret': dataSplit[1],
            'repositories': dataSplit[2],
          };
        } else {
          logger.log('error', dataSplit);
        }
      }
    }
    return result;
  },

  /**
   * Fetches and serializes a new OAuth access token.
   */
  setToken: function() {
    const credValues = this.getCredentials();
    if (credValues === null) {
      logger.log('error', `Credential file was not found. Run the 'setup' command to create one.`);
      process.exit(1);
    }

    const oauthOptions = {
      method: 'POST',
      url: bitbucket.oauth.accessTokenUrl,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      auth: {
        user: credValues.key,
        pass: credValues.secret,
        sendImmediately: true,
      },
      body: 'grant_type=client_credentials',
      rejectUnauthorized: false,
    };

    const writeToken = (data) => {
      createDir(creds.directory);

      const filePath = path.join(creds.directory, creds.fileNameToken);

      fs.writeFile(filePath, data, (err) => {
        if (err) {
          let msg = `Could not write access token to file '${filePath}'`;
          logger.log('error', msg);
        }
      });
    };

    request(oauthOptions)
      .then((body) => {
        writeToken(body);
        logger.log('debug', 'Token saved.');
      })
      .catch((ex) => {
        if(ex && ex.error && ex.error) {
          const errObj = JSON.parse(ex.error);
          logger.log('error', errObj.error_description);
        } else {
          logger.log('error', ex);
        }
      });
  },

  /**
   * Refreshes the access token using the refresh token.
   * @return {object} promise
   */
  refreshToken: function() {
    return new Promise( (resolve, reject) => {
      const token = this.getToken();
      if (token === null) {
        logger.log('error', `Token file was not found. Run the 'setup -t' command to create one.`);
        process.exit(1);
      }

      const credValues = this.getCredentials();
      if (credValues === null) {
        logger.log('error', `Credential file was not found. Run the 'setup' command to create one.`);
        process.exit(1);
      }

      let data = `grant_type=refresh_token&refresh_token=${token.refresh_token}`;

      const oauthOptions = {
        method: 'POST',
        url: bitbucket.oauth.accessTokenUrl,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        auth: {
          user: credValues.key,
          pass: credValues.secret,
          sendImmediately: true,
        },
        body: data,
        json: true,
        rejectUnauthorized: false,
      };

      const writeToken = (data) => {
        createDir(creds.directory);

        const filePath = path.join(creds.directory, creds.fileNameToken);

        fs.writeFile(filePath, JSON.stringify(data), (err) => {
          if (err) {
            let msg = `Could not write access token to file '${filePath}'`;
            logger.log('error', msg);
            reject(err);
          }
          logger.log('debug', 'Token refreshed and saved.');
          resolve(data);
        });
      };

      request(oauthOptions)
        .then((body) => {
          writeToken(body);
        })
        .catch((ex) => {
          let errMessage = null;
          if(ex && ex.error && (typeof ex.error === 'string')) {
              logger.log('error', 'got here 1');
              ex = JSON.parse(ex.error);
          }
          if(ex && ex.error && ex.error_description) {
            errMessage = ex.error_description;
          } else {
            errMessage = 'Auth request failure. Try running \'setup token\' or verify OAuth consumer settings.';
          }
          reject(new Error(errMessage));
        });
    });
  },

  /**
   * Gets the OAuth access token response cached locally.
   * @return {Object|Null} OAuth object, null if not found
   */
  getToken: function() {
    const filePath = path.join(creds.directory, creds.fileNameToken);
    let result = null;

    if (fs.existsSync(filePath)) {
      let data = fs.readFileSync(filePath);

      try {
        if(data.length > 0) {
          result = JSON.parse(data);
        }
      } catch(err) {
       logger.log('error', `Unparseable auth data in file '${filePath}'. Run 'setup -t' again.`);
      }
    }
    return result;
  },
};


/**
 * Checks for clean input values related to OAuth.
 * @param {string} value input from STDIN
 * @return {Array|{index: number, input: string}}
 */
const isCleanOauthValue = (value) => {
  const valueRegex = /^[a-zA-Z0-9]{1,50}$/;
  return value.toString().match(valueRegex);
};

/**
 * Checks for clean input values.
 * @param {string} value input from STDIN
 * @return {Array|{index: number, input: string}}
 */
const isCleanUrlValue = (value) => {
  try {
    new URL(value);
    return true;
  } catch(e) {
    // URL will throw on failed parse - not super robust, just reasonable
    return false;
  }
};

/**
 * Creates the user's data directory if it does not exist.
 * @param {string} dir directory to create
 */
const createDir = (dir) => {
  // Create directory if not exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
};
