/**
 * Entry point for the bitstats 'setup clear' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');

program
  .description('Clears all tokens and credentials used for authentication.')
  .parse(process.argv);

setup.clear();
