#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const { version } = require('./package.json');
const utils = require('./utils');
const fs = require('fs')
const YAML = require('yaml')

const defaultOpts = {
};

const VERSION = `happyhour-cli: ${version}`;

const {argv} = yargs
    .usage(
        'First: happyhour init\n' +
        'Then: happyhour track'
    )
    .demand(1)
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .version(VERSION);

function main() {
    const command = argv._[0];

    switch (command) {
      case 'init':
        init();
        break;

      case 'track':
        track();
        break;
    }
}

function init() {
  console.log('called init')
}

function track() {
  console.log('called track')
  run('git rev-parse --abbrev-ref HEAD').then(function(branch) {
    console.log(branch)
  })
}

function run(cmd) {
  return utils.run(cmd)
}

main();
