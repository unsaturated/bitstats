/**
 * Entry point for the bitstats 'setup creds' command.
 */
const program = require('commander');
const setup = require('./bitstats-setup/setup');
const logger = require('./config').logger;

program
  .description('Sets or gets the OAuth values used for authentication.')
  .option('-s, --set', 'sets the credentials')
  .parse(process.argv);

if (program.set) {
  setup.setCredentials();
} else {
  let creds = setup.getCredentials();
  if(creds) {
    logger.log('info', 'KEY=%s SECRET=%s URL=%s', creds.key, creds.secret, creds.repositories);
  } else {
    logger.log('info', 'No credentials found.');
  }
}
