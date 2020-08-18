#!/usr/bin/env node
const path = require('path')

const colors = require('ansi-colors')
const { spawnStreaming } = require('@lerna/child-process')
const RushSelect = require('./prompt')
const { createChoices, setInitialValuesOnChoices } = require('./choice-generation.js')
const { save, load } = require('./save-load.js')
const { getProjectsAndRespectivePackageJson, getRushRootDir } = require('./rush-utils')

const { getArgs } = require('./yargs.js')
const { argv } = getArgs()

if (!argv.include && !argv.limit) {
  global.extraWarn = 'Limiting maximum scripts shown to 8. See --help for how to fix.'
  argv.limit = 8
}

// scripts that should be executed with this prompt. Can be edited, shouldn't break anything
// the order of the strings will be preserved in the prompt
if (argv.include === undefined) {
  argv.include = null
} else if (!Array.isArray(argv.include)) {
  argv.include = [argv.include]
}

if (argv.exclude === undefined) {
  argv.exclude = null
} else if (!Array.isArray(argv.exclude)) {
  argv.exclude = [argv.exclude]
}

const isScriptNameAllowed = (scriptName) =>
  (argv.include === null || argv.include.includes(scriptName)) &&
  (argv.exclude === null || !argv.exclude.includes(scriptName))

const projects = getProjectsAndRespectivePackageJson()

let { choices, allScriptNames } = createChoices(projects, isScriptNameAllowed)

const savedProjectScripts = load()

setInitialValuesOnChoices(choices, savedProjectScripts, isScriptNameAllowed)

// crude method of saving screen space
if (argv.limit) {
  allScriptNames = allScriptNames.slice(0, argv.limit)
}

module.exports = new RushSelect({
  name: 'rush-select',
  message:
    (global.extraWarn ? global.extraWarn + '\n\n' : '') +
    'Select what to run. Use left/right arrows to change options, Enter key starts execution.',
  messageWidth: 150,
  styles: { primary: colors.grey },
  choices,
  edgeLength: 2,
  // the description above the items
  scale: allScriptNames.sort().map((name) => ({
    name
  }))
})
  .run()
  .then((scriptsToRun) => {
    if (scriptsToRun.length === 0) {
      console.log('No scripts specified to run, exiting.')

      return
    }

    scriptsToRun = scriptsToRun
      .filter(({ script }) => script !== undefined)
      .filter(({ packageName }) => projects.some((p) => p.packageName === packageName))
      // add in the rush package reference
      .map(({ packageName, script }) => {
        let package = projects.find((p) => p.packageName === packageName)

        if (!package.packageJson.scripts || package.packageJson.scripts[script] === undefined) {
          // it was an "n/a" thing in the menu which got selected, ignore it
          return null
        }

        return {
          package,
          packageName,
          script: script
        }
      })
      .filter((project) => project !== null)

    save(scriptsToRun)

    scriptsToRun.map(({ packageName, script, package }) => {
      let p = spawnStreaming(
        'npm',
        ['run', script],
        { cwd: path.resolve(getRushRootDir(), package.projectFolder) },
        (packageName + ' > ' + script).substr(0, 50).padEnd(50, ' ')
      )

      return p
    })
  })
  .catch(console.error)
