#!/usr/bin/env node

'use strict'

const CONFIG_FILE = '.happyhour'
const GITIGNORE_FILE = '.gitignore'
const HOST = 'https://happyhour.rvapps.io'
const API_URL = `${HOST}/api/v1/work_stream_entries`
const THROTTLE_SECONDS = 10

const axios = require('axios')
const { exec } = require('child_process')
const chokidar = require('chokidar')
const fs = require('fs')
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
})
const throttle = require('lodash.throttle')
const { version } = require('./package.json')
const yargs = require('yargs')
const YAML = require('yaml')
const findConfig = require('find-config')

const CHOKIDAR_CONFIG = {
  binaryInterval: 300,
  followSymlinks: false,
  ignoreInitial: true,
  interval: 100,
  usePolling: false,
  ignored: ['**/node_modules/**', '**/.git/**'],
}

const VERSION = `happyhour-cli: ${version}`

const { argv } = yargs
  .usage('happyhour init')
  .usage('happyhour watch')
  .demand(1)
  .option('u', {
    alias: 'url',
    default: API_URL,
    describe: 'For overriding the API URL (e.g. for testing)',
    type: 'string',
  })
  .option('d', {
    alias: 'debug',
    describe: 'Output tracking to console rather than POSTing to server',
    type: 'boolean',
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
  } catch (e) {}

  if (yamlData.api_token) {
    const newAPIToken = await promptUser(`Your API token [${yamlData.api_token}]: `)
    if (newAPIToken) yamlData.api_token = newAPIToken
  } else {
    while (!yamlData.api_token) {
      const prompt = `Your API token (from ${HOST}): `
      yamlData.api_token = (await promptUser(prompt)).trim()
    }
  }

  if (yamlData.extensions) {
    const newExtensions = await promptUser(`File extensions to watch  [${yamlData.extensions}]: `)
    if (newExtensions) yamlData.extensions = newExtensions
  } else {
    const defaultFileExtensions = 'go ts js scss css html edge jsx tsx'
    const prompt = `File extensions to watch (e.g.: ${defaultFileExtensions}): `
    yamlData.extensions = (await promptUser(prompt)).trim() || defaultFileExtensions
  }

  readline.close()

  await writeConfig(YAML.stringify(yamlData))

  addHappyhourConfigToGitignore()

  console.log(
    `

Keep HappyHour running from the root of your work directory:

  % happyhour watch

Follow the JIRA-ticket/feature-description branching convention:

  % git checkout HLPJ-321/my-new-feature

NOTE: the first time happyhour indexes a new directory,
it may spike your CPU usage very high for an hour or so

`
  )
}

async function watch() {
  const extensions = (await readExtensions()).split(' ')
  const patterns = extensions.map(extension => `**/*.${extension}`)
  const watcher = chokidar.watch(patterns, CHOKIDAR_CONFIG)
  const throttledTrack = throttle(track, THROTTLE_SECONDS * 1000)

  watcher.on('all', throttledTrack)

  watcher.on('error', error => {
    console.error('Error:', error)
    console.error(error.stack)
  })

  watcher.once('ready', () => console.log(`happyhour watching: ${patterns.join(' ')}`))
}

async function track(_event, modifiedFilePath) {
  const url = argv.url || API_URL
  const debug = argv.debug
  const yamlData = await readConfig()
  const branch = await gitBranch(modifiedFilePath)
  if (!branch) return
  const headers = { Authorization: `Bearer ${yamlData.api_token}` }
  const data = { branch: branch }

  if (debug) {
    console.log(`happyhour: ${data.branch} -> ${headers['Authorization']}`)
  } else {
    console.log(`happyhour: ${branch}`)
    axios
      .post(url, data, { headers: headers })
      .then(response => {})
      .catch(error => {
        if (error.response) {
          if (error.response.status === 401)
            console.error(
              '\x1b[31m%s\x1b[0m',
              `\nInvalid happyhour API token.\nVisit ${HOST}/api_tokens for a new token,\nthen run \`happyhour init\`.\n`
            )
          else
            console.error(
              '\x1b[31m%s\x1b[0m',
              `\nHappyhour error: status ${error.response.status}\n`
            )
        } else {
          console.error(
            '\x1b[31m%s\x1b[0m',
            `\nHappyhour error. Are you able to reach ${HOST} in a browser?\n`
          )
        }
      })
  }
}

async function gitBranch(modifiedFilePath) {
  const path = findGitRoot(modifiedFilePath)
  if (!path) return

  return await new Promise((resolve, reject) => {
    exec(`git -C ${path} rev-parse --abbrev-ref HEAD`, (error, stdout, stderr) => {
      if (error) {
        reject(error.message)
        return
      }
      if (stderr) {
        reject(stderr)
        return
      }

      resolve(stdout.trim())
    })
  })
}

function findGitRoot(file) {
  const gitPath = findConfig('.git', { cwd: file, home: false })
  if (!gitPath) return console.log(`Couldn't find .git for ${file}`)
  return gitPath.replace('.git', '')
}

async function readExtensions() {
  return (await readConfig()).extensions
}

// async functions:

async function promptUser(prompt) {
  return await new Promise(resolve => readline.question(prompt, response => resolve(response)))
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
  })
}

async function writeConfig(string) {
  return await new Promise((resolve, reject) => {
    fs.writeFile(CONFIG_FILE, string, err => {
      if (err) {
        reject()
        return
      }
      resolve()
    })
  })
}

async function addHappyhourConfigToGitignore() {
  try {
    const gitignoreFile = await readGitignore()
    if (gitignoreFile.includes(CONFIG_FILE)) return
    await writeGitignore(gitignoreFile + '\n' + CONFIG_FILE + '\n')
  } catch {}
}

async function readGitignore() {
  return await new Promise((resolve, reject) => {
    fs.readFile(GITIGNORE_FILE, 'utf8', (err, data) => {
      if (err) {
        reject()
        return
      }
      resolve(data)
    })
  })
}

async function writeGitignore(string) {
  return await new Promise((resolve, reject) => {
    fs.writeFile(GITIGNORE_FILE, string, err => {
      if (err) {
        reject()
        return
      }
      resolve()
    })
  })
}

main()
