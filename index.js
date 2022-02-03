#!/usr/bin/env node

'use strict'

const CONFIG_FILE = '.happyhour'
const API_URL = 'https://happyhour.platejoy.com/api/v1/work_stream_entries'

const axios = require('axios')
const { exec } = require('child_process')
const chokidar = require('chokidar')
const fs = require('fs')
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})
const throttle = require('lodash.throttle')
const { version } = require('./package.json')
const yargs = require('yargs')
const YAML = require('yaml')

const CHOKIDAR_CONFIG = {
  binaryInterval: 300,
  followSymlinks: false,
  ignoreInitial: true,
  interval: 100,
  usePolling: false,
}

const VERSION = `happyhour-cli: ${version}`

const {argv} = yargs
  .usage(
    'happyhour init'
  )
  .demand(1)
  .option('u', {
      alias: 'url',
      default: API_URL,
      describe: 'For overriding the API URL (e.g. for testing)',
      type: 'string'
  })
  .option('d', {
      alias: 'debug',
      describe: 'Output tracking to console rather than POSTing to server',
      type: 'boolean'
  })
  .help('h')
  .alias('h', 'help')
  .alias('v', 'version')
  .version(VERSION)

function main() {
  const command = argv._[0]

  switch (command) {
    case 'init':
      init()
      break

    case 'watch':
      watch()
      break
  }
}

async function init() {
  let yamlData = {}
  try {
    yamlData = await readConfig()
  } catch(e) {
  }

  if (yamlData.project_token) {
    const newProjectToken = await promptUser(`Your project token [${yamlData.project_token}]: `)
    if (newProjectToken)
      yamlData.project_token = newProjectToken
  } else {
    yamlData.project_token = await promptUser('Your project token [from happyhour.platejoy.com]: ')
  }

  if (yamlData.patterns) {
    const newPatterns = await promptUser(`Watch patterns [${yamlData.patterns}]: `)
    if (newPatterns)
      yamlData.patterns = newPatterns
  } else {
    yamlData.patterns = await promptUser('Watch patterns [e.g.: **/*.rb app/javascript/**/*.js]: ')
  }

  readline.close()

  await writeConfig(YAML.stringify(yamlData))

  console.log(
`

Ready! Next steps:

1. If you use a Procfile:

  Add the following line to your Procfile.dev:
    happyhour: node_modules/.bin/happyhour watch


2. If you use Yarn or NMP to run scripts:

  Add the following line to your package.json scripts:
    "happyhour-watch": "node_modules/.bin/happyhour watch"
  Then:
    % yarn run happyhour-watch
  OR:
    % npm run happyhour-watch

`
  )
}

async function watch() {
  const patterns = (await readPatterns()).split(' ')
  const watcher = chokidar.watch(patterns, CHOKIDAR_CONFIG)
  const throttledTrack = throttle(track, 1000)

  watcher.on('all', throttledTrack)

  watcher.on('error', error => {
    console.error('Error:', error)
    console.error(error.stack)
  });

  watcher.once('ready', () => console.log(`happyhour watching: ${patterns}`))
}

async function track() {
  const url = argv.url || API_URL
  const debug = argv.debug
  const yamlData = await readConfig()
  const branch = await gitBranch()

  if (debug) {
    console.log(`happyhour: ${branch} -> ${yamlData.project_token}`)
  } else {
    console.log(`happyhour: ${branch}`)
    axios.post(url, {
      token: yamlData.project_token,
      branch: branch
    })
  }
}

async function gitBranch() {
  return await new Promise((resolve, reject) => {
    exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
      if (error) {
          reject(error.message)
          return;
      }
      if (stderr) {
          reject(stderr)
          return;
      }

      resolve(stdout.trim())
    })
  })
}

async function readPatterns() {
  return (await readConfig()).patterns
}

// async functions:

async function writeConfig(string) {
  return await new Promise((resolve, reject) => {
    fs.writeFile(CONFIG_FILE, string, err => {
      if (err) {
        reject()
        return
      }
      resolve()
    })
  });
}

async function promptUser(prompt) {
  return await new Promise(resolve =>
    readline.question(prompt, response => resolve(response))
  )
}

async function readConfig() {
  return await new Promise((resolve, reject) => {
    fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
      if (err) {
        reject()
        return
      }
      resolve(YAML.parse(data))
    })
  });
}

main()
