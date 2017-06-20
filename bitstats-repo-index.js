/**
 * Entry point for the bitstats 'repo index' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Creates or updates the repository index file.')
  .parse(process.argv);

repo.refresh();
