#! /usr/bin/env node

const program = require('commander');
const request = require('request-promise');
const logger = require('./config').logger;

program
.option('-a, --all', 'all PRs')
.parse(process.argv);

const repos = program.args;

// Validate repository input
if(!repos.length){
  logger.log('error', 'No repository specified');
  process.exit(1);
}

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

const req = request(options)
  .then(body => {
    const info = JSON.parse(body);
    console.log(info);
  })
  .catch(err => {
    console.err('ERROR' + err);
  });


// repos.forEach(function(pkg){
//   console.log('  install : %s', pkg);
// });
console.log();
