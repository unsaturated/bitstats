/**
 * Entry point for the bitstats 'setup token' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');

program
  .description('Retrieves/refreshes OAuth access token used for API calls.')
  .parse(process.argv);

setup.setToken();
