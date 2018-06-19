/**
 * Entry point for the bitstats 'repo commits' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Fetches commits for the specified repository.')
  .usage('[options] <repo>')
  .parse(process.argv);

repo.getCommits(program.args, function() {
    console.log('done with commits');
});
