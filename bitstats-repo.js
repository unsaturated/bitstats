#! /usr/bin/env node

const program = require('commander');
const request = require('request-promise');
const logger = require('./config').logger;
const setup = require('./setup/setup');

program
.option('-a, --all', 'all PRs')
.parse(process.argv);

const repos = program.args;

// Validate repository input
// if(!repos.length) {
//   logger.log('error', 'No repository specified');
//   process.exit(1);
// }

// TODO
// https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories
// Endpoints of interest
// - {username}  <- Must request all repos in list since they're paginated
// - {repo_slug} <- Specify the exact repository to inspect
// -  /commits
// -  /default-reviewers
// -  /pullrequests
//

const username = 'mcrumley@madmobile.com';
const password = '';
const auth = 'Basic ' +
  new Buffer(username + ':' + password).toString('base64');


const options = {
  method: 'GET',
  url: 'https://api.bitbucket.org/2.0/repositories/madmobile',
  headers: {
    'Authorization': auth,
  },
};

const credValues = setup.getCredentials();
if(credValues === null) {
  logger.log('error', 'Repo command requires setup file');
  process.exit(1);
}

logger.log('info', 'Using credentials %s / %s ', credValues.key, credValues.secret);

const oauthOptions = {
  method: 'POST',
  url: 'https://bitbucket.org/site/oauth2/access_token',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  },
  auth: {
    user: credValues.key,
    pass: credValues.secret,
    sendImmediately: true,
  },
  body: 'grant_type=client_credentials',
};

request(oauthOptions)
  .then((body) => {
    const info = JSON.parse(body);
    logger.log('error', info);
  })
  .catch((err) => {
    logger.log('error', err);
  });
