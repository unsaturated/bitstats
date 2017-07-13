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
  .option('-a, --approvals', 'include approval data')
  .option('-p, --project', 'export at project-level')
  .option('-g, --global', 'export at global level')
  .parse(process.argv);

if(program.global) {
  pr.exportGlobal(program.comments, program.commits, program.approvals);
} else if (program.project) {
  pr.exportProject(program.args, program.comments, program.commits, program.approvals);
} else {
  pr.export(program.args, undefined, () => {
    if (program.comments) {
      pr.exportComments(program.args);
    }
    if (program.commits) {
      pr.exportCommits(program.args);
    }
    if (program.approvals) {
      pr.exportApprovals(program.args);
    }
  });
}
