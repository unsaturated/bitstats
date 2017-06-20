/**
 * Entry point for the bitstats 'pr export' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Exports PR data for a repository.')
  .usage('<repo>')
  .option('-f, --file', 'filename to write with data')
  .parse(process.argv);

// Pass in all arguments but `export` currently only handles one repo index
pr.export(program.args, program.file);
