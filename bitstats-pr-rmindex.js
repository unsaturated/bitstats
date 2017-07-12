/**
 * Entry point for the bitstats 'pr rmindex' command.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Removes the pull request cache indexes, including comments.')
  .usage('<repo or project>')
  .option('-p, --project', 'clear all repos for the owning project')
  .option('-f, --force', 'no prompts to confirm deletion')
  .parse(process.argv);

if(program.project) {
  pr.clearProject(program.args, program.force);
} else {
  pr.clear(program.args, program.force);
}
