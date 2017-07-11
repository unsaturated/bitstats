/**
 * Entry point for the bitstats 'pr index' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Creates or updates the pull request cache indexes.')
  .usage('[options] <repo or project>')
  .option('-m, --comments', 'fetches comments/messages for all PRs')
  .option('-c, --commits', 'fetches abbreviated git commits for all PRs')
  .option('-a, --approvals', 'fetches approvals/activity for all PRs')
  .option('-p, --project', 'match the project name and fetch all its repos PRs')
  .parse(process.argv);


if(program.project) {
  pr.refreshProject(program.args, program.comments, program.commits, program.approvals);
} else {
  pr.refresh(program.args, () => {
    if(program.comments) {
      pr.refreshComments(program.args);
    }
    if(program.commits) {
      pr.refreshCommits(program.args);
    }
    if(program.approvals) {
      pr.refreshApprovals(program.args);
    }
  });
}
