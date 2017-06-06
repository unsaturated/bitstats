/**
 * Entry point for the bitstats 'setup' command.
 */
const program = require('commander');
const setup = require('./setup/setup');

program
  .description('Sets, clears, or displays the OAuth values ' +
    'used for authentication')
  .option('-c, --clear', 'removes all settings')
  .option('-s, --set', 'sets or overwrites credentails')
  .option('-g, --get', 'gets the current credentials')
  .option('-t, --token', 'retrieves/refreshes OAuth access token')
  .parse(process.argv);

if (program.clear) {
  setup.clear();
}

if (program.set) {
    setup.setCredentials();
}

if (program.get) {
    let creds = setup.getCredentials();
    if(creds) {
        logger.log('info', creds);
    }
}

if(program.token) {
    setup.token();
}
