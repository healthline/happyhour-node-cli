#!/usr/bin/env node

'use strict'

const CONFIG_FILE = '.happyhour'
const API_URL = 'https://happyhour.platejoy.com'

const axios = require('axios')
const yargs = require('yargs')
const { version } = require('./package.json')
const fs = require('fs')
const YAML = require('yaml')
const { exec } = require("child_process")
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

const defaultOpts = {
}

const VERSION = `happyhour-cli: ${version}`

const {argv} = yargs
    .usage(
        'First: happyhour init\n' +
        'Then: happyhour track'
    )
    .demand(1)
    .option('u', {
        alias: 'url',
        default: API_URL,
        describe: 'For overriding the API URL (e.g. for testing)',
        type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .version(VERSION);

function main() {
    const command = argv._[0];
    console.log(argv)

    switch (command) {
      case 'init':
        init();
        break;

      case 'track':
        track(argv.url || API_URL);
        break;
    }
}

async function init() {
  console.log('called init')
  let yamlData = {}
  try {
    yamlData = YAML.parse(await readConfig())
  } catch(e) {
  }

  if (yamlData.project_token) {
    const newProjectToken = await promptUser(`Your project token [${yamlData.project_token}]: `)
    if (newProjectToken)
      yamlData.project_token = newProjectToken
  } else {
    yamlData.project_token = await promptUser('Your project token [from RV HappyHour]: ')
  }

  if (yamlData.patterns) {
    const newPatterns = await promptUser(`Watch patterns [${yamlData.patterns}]: `)
    if (newPatterns)
      yamlData.patterns = newPatterns
  } else {
    yamlData.patterns = await promptUser('Watch patterns [e.g.: **/*.rb app/javascript/**/*.js]: ')
  }

  readline.close()

  writeConfig(YAML.stringify(yamlData))
}

async function track(url) {
  const yamlString = await readConfig()
  const yamlData = YAML.parse(yamlString)
  const branch = await gitBranch()

  axios.post(url, {
    token: yamlData.project_token,
    branch: branch
  })
}

function gitBranch() {
  return new Promise((resolve, reject) => {
    exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
      if (error) {
          reject(error.message)
          return;
      }
      if (stderr) {
          reject(stderr)
          return;
      }

      resolve(stdout)
    })
  })
}

function readConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
      if (err) {
        reject()
        return
      }
      resolve(data)
    })
  });
}

function writeConfig(string) {
  return new Promise((resolve, reject) => {
    fs.writeFile(CONFIG_FILE, string, err => {
      if (err) {
        reject()
        return
      }
      resolve()
    })
  });
}

function promptUser(prompt) {
  return new Promise(resolve =>
    readline.question(prompt, response => resolve(response))
  )
}

main();
