/**
 * Entry point for the bitstats 'repo' command.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .command('list', 'lists repositories', {isDefault: true})
  .option('-c, --clear', 'removes repository index')
  .option('-g, --get', 'gets repository index')
  .option('-r, --refresh', 'refreshes local index file')
  .parse(process.argv);

if(program.clear) {
  repo.clear();
}

if(program.get) {
  repo.getRepos();
}

if(program.refresh) {
  repo.refresh();
}
