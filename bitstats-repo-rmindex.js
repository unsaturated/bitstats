/**
 * Entry point for the bitstats 'repo rmindex' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Removes the repository index file.')
  .parse(process.argv);

repo.clear();
