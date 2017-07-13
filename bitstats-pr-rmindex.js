/**
 * Entry point for the bitstats 'pr rmindex' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Removes the pull request cache indexes, including comments.')
  .usage('<repo or project>')
  .option('-p, --project', 'clear all repos for the owning project')
  .option('-g, --global', 'clear all repos globally')
  .option('-f, --force', 'no prompts to confirm deletion')
  .parse(process.argv);

if(program.global) {
  pr.clearGlobal(program.force);
} else if(program.project) {
  pr.clearProject(program.args, program.force);
} else {
  pr.clear(program.args, program.force);
}
