/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');

program
  .command('list', 'lists repositories')
  .command('index', 'creates or removes the repository index')
  .parse(process.argv);
