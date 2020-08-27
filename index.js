#!/usr/bin/env node
const path = require('path')

const readline = require('readline')

const { spawnStreaming } = require('@lerna/child-process')
const colors = require('ansi-colors')
const RushSelect = require('./prompt')
const { createChoices, setInitialValuesOnChoices } = require('./choice-generation.js')
const { save, load } = require('./save-load.js')
const { getProjectsAndRespectivePackageJson, getRushRootDir } = require('./rush-utils')

const { getArgs } = require('./yargs.js')
const { argv } = getArgs()

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

const rushRootDir = getRushRootDir()

const createRushPrompt = async (choices, allScriptNames, projects) => {
  let scriptsToRun = await new RushSelect({
    name: 'rush-select',
    message:
      (global.extraWarn ? global.extraWarn + '\n\n' : '') +
      'Select what to run. Use left/right arrows to change options, Enter key starts execution.',
    messageWidth: 150,
    margin: [0, 1, 0, 0],
    styles: { primary: colors.grey },
    choices,
    edgeLength: 2,
    // the description above the items
    scale: allScriptNames.sort().map((name) => ({
      name
    }))
  }).run()

  if (scriptsToRun.length === 0) {
    console.log('No scripts specified to run, exiting.')

    return
  }

  scriptsToRun = scriptsToRun
    .filter(({ script }) => script !== undefined)
    .filter(({ packageName }) => projects.some((p) => p.packageName === packageName))
    // add in the rush package reference
    .map(({ packageName, script }) => {
      const package = projects.find((p) => p.packageName === packageName)

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

  save(rushRootDir, scriptsToRun)

  const getPrefix = (packageName, script) => packageName + ' > ' + script + ' '
  const longestSequence = scriptsToRun.reduce((val, curr) => {
    const result = getPrefix(curr.packageName, curr.script).length

    return result > val ? result : val
  }, 0)

  return scriptsToRun.map(({ packageName, script, package }) =>
    spawnStreaming(
      'npm',
      ['run', script],
      { cwd: path.resolve(rushRootDir, package.projectFolder) },
      getPrefix(packageName, script).padEnd(longestSequence, ' ')
    )
  )
}

async function main() {
  const projects = getProjectsAndRespectivePackageJson()

  do {
    const { choices, allScriptNames } = createChoices(projects, isScriptNameAllowed)
    const savedProjectScripts = load(rushRootDir)
    setInitialValuesOnChoices(choices, savedProjectScripts, isScriptNameAllowed)

    let processes
    try {
      processes = await createRushPrompt(choices, allScriptNames, projects)
    } catch (e) {
      if (e === '') {
        // prompt was aborted by user
        console.log('Exiting')
        return
      }
      throw e
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.on('SIGINT', () => {
      processes.forEach((p) => p.kill('SIGINT'))
    })

    await Promise.all(
      processes.map(
        (p) =>
          new Promise((resolve) => {
            p.once('exit', resolve)
            p.once('error', resolve)
          })
      )
    )

    rl.close()

    // eslint-disable-next-line
  } while (true)
}

main()
