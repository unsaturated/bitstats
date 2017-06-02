/**
 * Created by mcrumley on 6/1/17.
 */
const program = require('commander');
const logger = require('./config').logger;
const creds = require('./config').credentials;
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

program
  .description('Sets, clears, or displays the OAuth values ' +
    'used for authentication')
  .option('-c, --clear', 'removes all settings')
  .option('-s, --set', 'sets or overwrites credentails')
  .parse(process.argv);

if(program.clear) {
  logger.log('info', 'Cleared');
}

if(program.set) {
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
   * Checks for clean input values.
   * @param {string} value input from STDIN
   * @return {Array|{index: number, input: string}}
   */
  const isCleanValue = (value) => {
    const valueRegex = /^[a-zA-Z0-9]{1,50}$/;
    return value.toString().match(valueRegex);
  };

  /**
   * Prompts user with questions and awaits value from STDIN.
   * @param {Number} promptIndex starting index for prompts/questions
   * @param {Function} doneCallback callback on question complete (no error)
   */
  const getResponses = (promptIndex = 0, doneCallback) => {
    rl.question(prompts[promptIndex].question, (a) => {
      if(!isCleanValue(a)) {
        logger.log('error', prompts[promptIndex].error);
        rl.close();
        process.exit(1);
      } else{
        prompts[promptIndex].answer = a;
        if(promptIndex + 1 < prompts.length) {
          // Go to the next prompt
          return getResponses(promptIndex + 1, doneCallback);
        }
      }
      rl.close();
      return doneCallback();
    });
  };

  const writeResponses = () => {
    // Create directory if not exists
    if(!fs.existsSync(creds.directory)) {
      fs.mkdirSync(creds.directory);
    }

    const data = (prompts.map((q) => {
      return q.answer;
    })).join(os.EOL);

    const filePath = path.join(creds.directory, creds.fileName);

    fs.writeFile(filePath, data, (err) => {
      if(err) {
        let msg = `Could not write credentials to file '${filePath}'`;
        logger.log('error', msg);
      }
    });
  };

  getResponses(0, writeResponses);
}
