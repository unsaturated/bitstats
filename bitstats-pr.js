/**
 * Entry point for the bitstats 'pr' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');
const logger = require('./config').logger;

program
  .description('Gets peer review information from a specific repository')
  .usage('[options] [repository-slug]')
  .option('-u, --unset', 'removes local PR cache for a repository')
  .option('-g, --get', 'gets PR information')
  .parse(process.argv);
