/**
 * Entry point for the bitstats 'repo list' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Lists all repositories or those for specific project.')
  .usage('[options] <project ...>')
  .parse(process.argv);

repo.listRepos(program.args);
