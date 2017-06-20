/**
 * Entry point for the bitstats 'pr index' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Creates or updates the pull request cache indexes.')
  .usage('<repo>')
  .parse(process.argv);

// Pass in all arguments but `refresh` currently only handles one repo index
pr.refresh(program.args);
