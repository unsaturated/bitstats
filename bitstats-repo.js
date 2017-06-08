/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .command('list', 'lists repositories')
  .option('-c, --clear', 'removes repository index')
  .option('-g, --get', 'gets repository index')
  .option('-r, --refresh', 'refreshes local index file')
  .parse(process.argv);

if(program.clear) {
  repo.clear();
}

if(program.get) {
  repo.getRepos();
}

if(program.refresh) {
  repo.refresh();
}

// TODO
// https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories
// Endpoints of interest
// - {username}  <- Must request all repos in list since they're paginated
// - {repo_slug} <- Specify the exact repository to inspect
// -  /commits
// -  /default-reviewers
// -  /pullrequests
