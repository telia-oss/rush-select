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

  const scripts = {
    pre: [],
    main: []
  }

  scriptsToRun
    .filter(({ script }) => script !== undefined)
    .forEach((item) => {
      if (item === null) {
        return
      }

      if (item.packageName === 'rush') {
        scripts.pre.push(item)
        return
      }

      // add project reference
      const package = projects.find((p) => p.packageName === item.packageName)
      if (package) {
        scripts.main.push({
          ...item,
          package
        })
      }
    })

  save(rushRootDir, scripts.main)

  return scripts
}

const runScripts = (scriptsToRun) => {
  const getPrefix = (packageName, script) => packageName + ' > ' + script + ' '
  const longestSequence = scriptsToRun.reduce((val, curr) => {
    const result = getPrefix(curr.packageName, curr.script).length

    return result > val ? result : val
  }, 0)

  return scriptsToRun.map(
    ({ packageName, script, package, scriptExecutable = 'npm', scriptCommand = ['run'] }) =>
      spawnStreaming(
        scriptExecutable,
        scriptCommand.concat(script),
        { cwd: package ? path.resolve(rushRootDir, package.projectFolder) : rushRootDir },
        getPrefix(packageName, script).padEnd(longestSequence, ' ')
      )
  )
}

// makes user able to CTRL + C during execution
const awaitProcesses = async (processes) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.on('SIGINT', () => {
    processes.forEach((p) => p.kill('SIGINT'))
    return { aborted: true, error: false }
  })

  let error = false

  await Promise.all(
    processes.map(
      (p) =>
        new Promise((resolve) => {
          p.once('exit', (exitCode) => {
            if (exitCode !== 0) {
              error = true
            }
            resolve(exitCode)
          })
        })
    )
  )

  rl.close()

  return { aborted: false, error }
}

async function main() {
  const projects = getProjectsAndRespectivePackageJson()

  do {
    const { choices, allScriptNames } = createChoices(projects, isScriptNameAllowed)
    const savedProjectScripts = load(rushRootDir)
    setInitialValuesOnChoices(choices, savedProjectScripts, isScriptNameAllowed)

    let scripts
    try {
      scripts = await createRushPrompt(choices, allScriptNames, projects)
    } catch (e) {
      if (e === '') {
        // prompt was aborted by user
        console.log('Exiting')
        return
      }
      throw e
    }

    console.log('Starting prescripts')

    let anyAborted
    let anyError

    // run through the prescripts sequentially
    for (let preScript of scripts.pre) {
      let { aborted, error } = await awaitProcesses(runScripts([preScript]), true)

      anyAborted = anyAborted || aborted
      anyError = anyError || error
    }

    if (!anyAborted && !anyError) {
      console.log('Starting main scripts')

      await awaitProcesses(runScripts(scripts.main))
    }

    // eslint-disable-next-line
  } while (true)
}

main()
