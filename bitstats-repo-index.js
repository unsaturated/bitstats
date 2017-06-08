/**
 * Created by mcrumley on 6/8/17.
 */
const program = require('commander');
const repo = require('./bitstats-repo/repo');

program
  .description('Creates, updates, or removes the repository index file.')
  .option('-c, --clear', 'removes repository index')
  .option('-r, --refresh', 'refreshes local index file')
  .parse(process.argv);

if(program.clear) {
  repo.clear();
}

if(program.refresh) {
  repo.refresh();
}
