/**
 * Entry point for the bitstats 'pr' command.
 */
const program = require('commander');

program
  .description('Gets pull request information from a specific repository.')
  .command('index', 'creates or refreshes a PR index')
  .command('rmindex', 'removes a PR index')
  .command('summarize', 'query PR efforts for a bug or time span')
  .usage('[options] [repository-slug]')
  .parse(process.argv);
