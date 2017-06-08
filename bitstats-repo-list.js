/**
 * Created by mcrumley on 6/8/17.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Lists all repositories in Bitbucket, or those for specific project.')
  .usage('[options] <project ...>')
  .parse(process.argv);

repo.listRepos(program.args);
