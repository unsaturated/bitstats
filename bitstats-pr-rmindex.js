/**
 * Entry point for the bitstats 'pr rmindex' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Removes the pull request cache indexes.')
  .usage('<repo>')
  .parse(process.argv);

// Pass in all arguments but `clear` currently only handles one repo index
pr.clear(program.args);
