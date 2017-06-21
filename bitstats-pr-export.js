/**
 * Entry point for the bitstats 'pr export' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Exports PR data for a repository.')
  .usage('<repo>')
  .option('-p, --prfile', 'filename to write with PR data')
  .option('-c, --commentfile', 'filename to write with comment data')
  .option('-i, --comments', 'exports comment data if available')
  .parse(process.argv);

// Pass in all arguments but `export` currently only handles one repo index
pr.export(program.args, program.prfile, () => {
  if(program.comments) {
    pr.exportComments(program.args, program.commentfile);
  }
});
