/**
 * Entry point for the bitstats 'repo list' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Lists all repositories or those for specific project.')
  .usage('[options] <project ...>')
  .option('-p, --project', 'List projects only with sample of repos')
  .parse(process.argv);

if(program.project) {
  repo.listProjects(program.args);
} else {
  repo.listRepos(program.args);
}
