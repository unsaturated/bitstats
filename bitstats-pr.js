/**
 * Entry point for the bitstats 'pr' command.
 */
const program = require('commander');

program
  .description('Gets pull request information from a specific repository.')
  .command('index', 'creates or refreshes a PR index')
  .command('rmindex', 'removes a PR index')
  .command('export', 'exports PR efforts for a repository')
  .usage('[options] [repository-slug]')
  .parse(process.argv);
