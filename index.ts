#!/usr/bin/env node
import path from 'path'

import { Choice, Project } from './interfaces'
import { spawnStreaming } from '@lerna/child-process'
import child_process from 'child_process'
import colors from 'ansi-colors'
import RushSelect from './prompt'
import { createChoices, setInitialValuesOnChoices } from './choice-generation'
import { save, load } from './save-load'
import { getProjectsAndRespectivePackageJson, getRushRootDir } from './rush-utils'

import { getArgs } from './yargs'
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

const isScriptNameAllowed = (scriptName: string) =>
  (argv.include === null || argv.include.includes(scriptName)) &&
  (argv.exclude === null || !argv.exclude.includes(scriptName))

const createRushPrompt = async (
  choices: Array<Choice>,
  allScriptNames: Array<string>,
  projects: Array<Project>
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
        initial: 0,
        scriptNames: ['ignore', 'install', 'update'],
        scriptExecutable: 'rush',
        customSortText: '_',
        scriptCommand: []
      },
      {
        category: 'rush build (recommended: smart)',
        name: 'rush build',
        initial: 1,
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

  const scriptsToRun: Array<Project> = await rushSelect.run()

  if (scriptsToRun.length === 0) {
    return null
  }

  interface Scripts {
    pre: Array<Project>
    rushBuild: undefined | Project
    main: Array<Project>
  }

  const scripts: Scripts = {
    pre: [],
    rushBuild: undefined,
    main: []
  }

  scriptsToRun
    .filter((item: Project) => item.script !== undefined)
    .forEach((item: Project) => {
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
      const project = projects.find((p: Project) => p.packageName === item.packageName)
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

const runScripts = (scriptsToRun: Array<Project>) => {
  const getPrefix = (packageName: string, script: string) => packageName + ' > ' + script + ' '
  const longestSequence = scriptsToRun.reduce((val: number, curr: Project) => {
    const result = getPrefix(curr.packageName, curr.script).length

    return result > val ? result : val
  }, 0)

  return scriptsToRun.map((project: Project) =>
    spawnStreaming(
      project.scriptExecutable,
      (project.scriptCommand || []).concat(project.script),
      {
        cwd: project
          ? path.resolve(getRushRootDir(), project.projectFolder || '')
          : getRushRootDir()
      },
      getPrefix(project.packageName, project.script).padEnd(longestSequence, ' ')
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
    setInitialValuesOnChoices(choices, savedProjectScripts, isScriptNameAllowed)

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

    let anyError

    // run through the prescripts sequentially
    for (const preScript of scripts.pre) {
      const { error } = await awaitProcesses(runScripts([preScript]))

      anyError = anyError || error
    }

    if (!anyError) {
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
          anyError = anyError || error
        }
      }
    }

    if (!anyError) {
      console.log('Starting main scripts')

      await awaitProcesses(runScripts(scripts.main))
    } else {
      throw new Error('there was an error')
    }

    // eslint-disable-next-line
  } while (true)
}

module.exports = main()
