/**
 * Entry point for the bitstats 'setup' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');
const logger = require('./config').logger;

program
  .description('Sets, clears, or displays the OAuth values used for authentication.')
  .command('clear', 'removes all credentials and tokens')
  .command('creds', 'gets or sets the current credentials')
  .command('token', 'retrieves/refreshes OAuth access token')
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
    setup.setToken();
}
