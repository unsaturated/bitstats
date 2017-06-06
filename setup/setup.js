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
   */
  setCredentials: function() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let prompts = [
      {
        question: 'Enter your OAuth consumer key: ',
        answer: null,
        error: 'Consumer key does not match known format',
      },
      {
        question: 'Enter your OAuth secret: ',
        answer: null,
        error: 'Secret does not match known format',
      },
    ];

    /**
     * Prompts user with questions and awaits value from STDIN.
     * @param {Number} promptIndex starting index for prompts/questions
     * @param {Function} doneCallback callback on question complete (no error)
     */
    const getResponses = (promptIndex = 0, doneCallback) => {
      rl.question(prompts[promptIndex].question, (a) => {
        if (!isCleanValue(a)) {
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
      createDataDir();

      const data = (prompts.map((q) => {
        return q.answer;
      })).join(os.EOL);

      const filePath = path.join(creds.directory, creds.fileNameAuth);

      fs.writeFile(filePath, data, (err) => {
        if (err) {
          let msg = `Could not write credentials to file '${filePath}'`;
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

      if (dataSplit.length === 2) {
        if (isCleanValue(dataSplit[0]) && isCleanValue(dataSplit[1])) {
          result = {
            'key': dataSplit[0],
            'secret': dataSplit[1],
          };
        } else {
          logger.log('error', dataSplit);
        }
      }
    }
    return result;
  },

  /**
   * Fetches and serializes a new or refreshed OAuth access token.
   */
  setToken: function() {
    // const options = {
    //   method: 'GET',
    //   url: 'https://api.bitbucket.org/2.0/repositories/madmobile',
    //   headers: {
    //     'Authorization': auth,
    //   },
    // };

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
    };

    const writeToken = (data) => {
      createDataDir();

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
      .catch((err) => {
        logger.log('error', err);
      });
  },

  /**
   * Gets the OAuth access token response cached locally.
   * @return {Object|Null} OAuth object, null if not found
   */
  getToken: function() {
    const filePath = path.join(creds.directory, creds.fileNameAuth);
    let result = null;

    if (fs.existsSync(filePath)) {
      let data = fs.readFileSync(filePath);

      try {
        result = JSON.parse(data);
      } catch(err) {
       logger.log('error', `Unparseable auth data in file '${filePath}'. Run 'setup -t' again.`);
      }
    }
    return result;
  },
};


/**
 * Checks for clean input values.
 * @param {string} value input from STDIN
 * @return {Array|{index: number, input: string}}
 */
const isCleanValue = (value) => {
  const valueRegex = /^[a-zA-Z0-9]{1,50}$/;
  return value.toString().match(valueRegex);
};

/**
 * Creates the user's data directory if it does not exist.
 */
const createDataDir = () => {
  // Create directory if not exists
  if (!fs.existsSync(creds.directory)) {
    fs.mkdirSync(creds.directory);
  }
};
