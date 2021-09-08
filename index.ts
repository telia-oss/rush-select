#!/usr/bin/env node
import path from 'path'

import { Choice, SubmittedChoice } from './interfaces'
import { spawnStreaming } from '@lerna/child-process'
import readline from 'readline'
import child_process from 'child_process'
import colors from 'ansi-colors'
import RushSelect from './prompt'
import { createChoices, applySelectedScriptsOnChoicesFromCache } from './choice-generation'
import { save, load } from './save-load'
import { getProjectsAndRespectivePackageJson, getRushRootDir } from './rush-utils'

import { getArgs } from './yargs'
const argv = getArgs()

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

const isScriptNameAllowed = (scriptName: string): boolean =>
  !!(argv.include === null || (argv.include && argv.include.includes(scriptName))) &&
  !!(argv.exclude === null || (argv.exclude && !argv.exclude.includes(scriptName)))

const createRushPrompt = async (
  choices: Array<Choice>,
  allScriptNames: Array<string>,
  projects: Array<SubmittedChoice>
) => {
  const rushSelect = new RushSelect({
    name: 'rush-select',
    message:
      'Select what to run. Use left/right arrows to change options, Enter key starts execution.',
    messageWidth: 150,
    margin: [0, 1, 0, 0],
    styles: { primary: colors.grey },
    choices,
    executionGroups: [
      {
        category: 'pre-scripts (executes from top to bottom)',
        name: 'rush',
        scriptNames: ['ignore', 'install', 'update'],
        scriptExecutable: 'rush',
        customSortText: '_',
        scriptCommand: []
      },
      {
        category: 'how to build the packages prior to running the scripts',
        name: 'rush build',
        initial: 'smart',
        allowMultipleScripts: false,
        scriptNames: ['ignore', 'smart', 'regular', 'rebuild'],
        scriptExecutable: 'rush',
        customSortText: '__',
        scriptCommand: []
      }
    ],
    edgeLength: 2,
    // the description above the items
    scale: allScriptNames.sort().map((name: string) => ({
      name
    }))
  })

  const scriptsToRun: Array<SubmittedChoice> = await rushSelect.run()

  if (scriptsToRun.length === 0) {
    return null
  }

  interface Scripts {
    pre: Array<SubmittedChoice>
    rushBuild: undefined | SubmittedChoice
    main: Array<SubmittedChoice>
  }

  const scripts: Scripts = {
    pre: [],
    rushBuild: undefined,
    main: []
  }

  scriptsToRun
    .filter((item: SubmittedChoice) => item.script !== undefined)
    .forEach((item: SubmittedChoice) => {
      if (item === null) {
        return
      }

      if (item.packageName === 'rush') {
        scripts.pre.push(item)
        return
      }

      if (item.packageName === 'rush build') {
        scripts.rushBuild = item
        return
      }

      // add project reference
      const project = projects.find((p: SubmittedChoice) => p.packageName === item.packageName)
      if (project) {
        scripts.main.push({
          ...item,
          // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
          project
        })
      }
    })

  save(getRushRootDir(), scripts.main)

  return scripts
}

const runScripts = (submittedChoices: Array<SubmittedChoice>) => {
  const getPrefix = (packageName: string, script: string) => packageName + ' > ' + script + ' '
  const longestSequence = submittedChoices.reduce((val: number, curr: SubmittedChoice) => {
    const result = getPrefix(curr.packageName, curr.script).length

    return result > val ? result : val
  }, 0)

  return submittedChoices
    .filter((submittedChoice) => !!submittedChoice.project)
    .map((submittedChoice: SubmittedChoice) =>
      spawnStreaming(
        submittedChoice.scriptExecutable,
        (submittedChoice.scriptCommand || []).concat(submittedChoice.script),
        {
          cwd: submittedChoice
            ? path.resolve(
                getRushRootDir(),
                // @ts-expect-error project is not undefined, because we do filtering.
                submittedChoice.project.projectFolder
              )
            : getRushRootDir(),
          env: { FORCE_COLOR: true }
        },
        getPrefix(submittedChoice.packageName, submittedChoice.script).padEnd(longestSequence, ' ')
      )
    )
}

// makes user able to CTRL + C during execution
const awaitProcesses = async (processes: Array<child_process.ChildProcess>) => {
  let error = false

  for (const process of processes) {
    await new Promise((resolve) => {
      let resolved = false
      process.once('exit', (exitCode: number) => {
        if (exitCode !== 0) {
          error = true
        }
        if (!resolved) {
          resolved = true
          resolve(exitCode)
        }
      })

      process.once('close', (exitCode: number) => {
        if (exitCode !== 0) {
          error = true

          if (exitCode === -2) {
            console.warn(
              'There was an error. Double-check that you have installed rush via "npm install -g @microsoft/rush'
            )
          }
        }
        if (!resolved) {
          resolved = true
          resolve(exitCode)
        }
      })
    })
  }

  return { error }
}

async function main() {
  const projects = getProjectsAndRespectivePackageJson()

  do {
    const { choices, allScriptNames } = createChoices(projects, isScriptNameAllowed)
    const savedProjectScripts = load(getRushRootDir())
    applySelectedScriptsOnChoicesFromCache(choices, savedProjectScripts, isScriptNameAllowed)

    let scripts = null

    try {
      scripts = await createRushPrompt(choices, allScriptNames, projects)
    } catch (e) {
      if (e === '') {
        // user aborted prompt
        return
      }
      throw e
    }

    if (scripts === null) {
      return
    }

    console.log('Starting pre-scripts')

    let nonZeroExit

    // run through the prescripts sequentially
    for (const preScript of scripts.pre) {
      const { error } = await awaitProcesses(runScripts([preScript]))

      nonZeroExit = nonZeroExit || error
    }

    if (!nonZeroExit) {
      let rushBuildProcess

      // get unique package names that are set to run scripts
      const packagesThatWillRunScripts = Array.from(
        scripts.main.reduce((set, item) => {
          set.add(item.packageName)
          return set
        }, new Set())
      )

      if (scripts.rushBuild) {
        if (scripts.rushBuild.script === 'smart' && packagesThatWillRunScripts.length > 0) {
          const executable = 'rush'
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'flat' does not exist on type 'unknown[][... Remove this comment to see the full error message
          const args = ['build'].concat(packagesThatWillRunScripts.map((p) => ['--to', p]).flat())

          console.log('Starting smart rush build step: ' + executable + ' ' + args.join(' '))

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir(), stdio: 'inherit' },
            'smart rush build'
          )
        } else if (scripts.rushBuild.script === 'regular') {
          const executable = 'rush'
          const args = ['build']

          console.log('Starting regular rush build step: ' + executable + ' ' + args.join(' '))

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir() },
            'incremental rush build'
          )
        } else if (scripts.rushBuild.script === 'rebuild') {
          const executable = 'rush'
          const args = ['rebuild']

          console.log(
            'Starting rush rebuild step, building everything. Grab coffee.. ' +
              executable +
              ' ' +
              args.join(' ')
          )

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir() },
            'rush rebuild'
          )
        }

        if (rushBuildProcess) {
          const { error } = await awaitProcesses([rushBuildProcess])

          // weirdly, rush doesn't seem to exit with non-zero when builds fail..
          nonZeroExit = nonZeroExit || error
        }
      }
    }

    if (nonZeroExit) {
      const rl = readline.createInterface(process.stdin, process.stdout)

      const continueDespiteErrors = await new Promise((resolve) => {
        rl.question('There were warnings or errors during build, continue? [Y/n]: ', (answer) =>
          resolve(/[Yy\s]/.test(answer))
        )
      })

      if (!continueDespiteErrors) {
        throw new Error('Exiting.')
      }
    }

    console.log('Starting main scripts')
    await awaitProcesses(runScripts(scripts.main))

    // eslint-disable-next-line
  } while (true)
}

module.exports = main()
