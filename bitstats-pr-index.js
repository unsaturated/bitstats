/**
 * Created by mcrumley on 6/9/17.
 */
const program = require('commander');
const pr = require('./bitstats-pr/pr');

program
  .description('Creates, updates, or removes the peer review cache indexes.')
  .option('-c, --clear', 'removes local PR cache for a repository')
  .option('-g, --get', 'gets PR information')
  .parse(process.argv);

if(program.clear) {
  pr.clear(program.args);
}
