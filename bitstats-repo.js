/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');
const repo = require('./repo/repo');

program
  .option('-a, --all', 'all PRs')
  .option('-c, --clear', 'removes repository index')
  .option('-r, --repos', 'gets repository index')
  .option('-l, --list', 'list repository index')
  .option('--refresh', 'refreshes local index file')
  .parse(process.argv);

if(program.clear) {
  repo.clear();
}

if(program.repos) {
  repo.getRepos();
}

if(program.refresh) {
  repo.refresh();
}

if(program.list) {
  repo.listRepos();
}

// TODO
// https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories
// Endpoints of interest
// - {username}  <- Must request all repos in list since they're paginated
// - {repo_slug} <- Specify the exact repository to inspect
// -  /commits
// -  /default-reviewers
// -  /pullrequests
