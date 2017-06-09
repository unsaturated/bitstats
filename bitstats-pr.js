/**
 * Entry point for the bitstats 'pr' command.
 */
const program = require('commander');

program
  .description('Gets pull request information from a specific repository.')
  .command('index', 'creates or removes the PR index')
  .usage('[options] [repository-slug]')
  .parse(process.argv);
