/**
 * Entry point for the bitstats 'repo export' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Exports data for a repository.')
  .usage('<repo>')
  .option('-c, --commits', 'include commit data')
  .parse(process.argv);

repo.exportCommits(program.args, undefined, () => {
    // Do something when complete?
});
