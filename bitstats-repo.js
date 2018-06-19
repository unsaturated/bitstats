/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');

program
  .description('Lists repositories and top-level data.')
  .command('list', 'lists repositories')
  .command('index', 'creates or refreshes the repository index')
  .command('commits', 'gets commits for the repository')
  .command('rmindex', 'removes the repository index')
  .parse(process.argv);
