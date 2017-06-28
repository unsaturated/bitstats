/**
 * Entry point for the bitstats 'pr index' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Creates or updates the pull request cache indexes.')
  .usage('[options] <repo>')
  .option('-m, --comments', 'fetches comments/messages for all PRs')
  .option('-c, --commits', 'fetches abbreviated git commits for all PRs')
  .parse(process.argv);

// Pass in all arguments but `refresh` currently only handles one repo index
pr.refresh(program.args, () => {
  if(program.messages) {
    pr.refreshComments(program.args);
  }
  if(program.commits) {
    pr.refreshCommits(program.args);
  }
});
