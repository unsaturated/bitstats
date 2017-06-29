/**
 * Entry point for the bitstats 'pr export' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Exports PR data for a repository.')
  .usage('<repo>')
  .option('-m, --comments', 'include comment data')
  .option('-c, --commits', 'include commit data')
  .option('-p, --approvals', 'include approval data')
  .parse(process.argv);

// Pass in all arguments but `export` currently only handles one repo index
pr.export(program.args, undefined, () => {
  if(program.comments) {
    pr.exportComments(program.args);
  }
  if(program.commits) {
    pr.exportCommits(program.args);
  }
  if(program.approvals) {
    pr.exportApprovals(program.args);
  }
});
