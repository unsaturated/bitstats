/**
 * Entry point for the bitstats 'setup' command.
 */
const program = require('commander');
const setup = require('./setup/setup');

program
  .description('Sets, clears, or displays the OAuth values ' +
    'used for authentication')
  .option('-c, --clear', 'removes all settings')
  .option('-s, --set', 'sets or overwrites credentails')
  .parse(process.argv);

setup.run(program);
