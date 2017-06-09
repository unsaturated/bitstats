/**
 * Entry point for the bitstats 'pr' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');

program
  .description('Gets peer review information from a specific repository.')
  .command('index', 'creates or removes the PR index')
  .usage('[options] [repository-slug]')
  .parse(process.argv);
