#!/usr/bin/env node
const path = require('path')

const { argv } = require('yargs')
  .usage('$0 --include start --include build:watch -d lint')
  .options({
    include: {
      alias: 'i',
      demandOption: false,
      describe:
        'Set this parameter one or multiple times to specify scripts that should be available in the prompt.',
      type: 'string'
    },
    exclude: {
      alias: 'e',
      demandOption: false,
      describe:
        'Set this parameter one or multiple times to specify some scripts that should be filtered out in the prompt.',
      type: 'string'
    },
    limit: {
      alias: 'l',
      demandOption: false,
      describe:
        'If no includes are defined, this value will default to 8 to avoid terminal spam.',
      type: 'number'
    }
  })

if (!argv.include && !argv.limit) {
  global.extraWarn =
    'Limiting maximum scripts shown to 8. See --help for how to fix.'
  argv.limit = 8
}

const { spawnStreaming } = require('@lerna/child-process')
const createPrompt = require('./create-prompt.js')
const { save, load } = require('./save-load.js')
const {
  getProjectsAndRespectivePackageJson,
  getRushRootDir
} = require('./rush-utils')

const previousAnswers = load()

// scripts that should be executed with this prompt. Can be edited, shouldn't break anything
// the order of the strings will be preserved in the prompt
// const argv.include = ['ignore', 'build-watch', 'build-dev'];
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

const scriptNameIsAllowed = (scriptName) =>
  (argv.include === null || argv.include.includes(scriptName)) &&
  (argv.exclude === null || !argv.exclude.includes(scriptName))

let tempSet = new Set([])
const projects = getProjectsAndRespectivePackageJson()
let choices = projects
  // some projects may not have a single script that is allowed to run, so filter them out
  .filter((project) =>
    Object.keys(project.packageJson.scripts).some((scriptName) =>
      scriptNameIsAllowed(scriptName)
    )
  )
  .reduce((total = [], project) => {
    // if (
    //   total.length === 0 ||
    //   (total[total.length - 1] &&
    //     total[total.length - 1]._reviewCategory !== project.reviewCategory)
    // ) {
    //   // insert a fake separator to serve as a category for all the projects
    //   total.push({
    //     name: '# ' + project.reviewCategory.toUpperCase(),
    //     _reviewCategory: project.reviewCategory,
    //     disabled: true
    //   })
    // }
    // keep track of the scripts that were found
    if (project.packageJson.scripts) {
      Object.keys(project.packageJson.scripts).forEach((s) => tempSet.add(s))
    }

    let availableScripts = ['ignore'].concat(
      Object.keys(project.packageJson.scripts || []).filter(scriptNameIsAllowed)
    )

    // insert a project
    total.push({
      name: '-   ' + project.packageName,
      _reviewCategory: project.reviewCategory,
      category: project.reviewCategory,
      availableScripts,
      initial:
        previousAnswers &&
        previousAnswers[project.packageName] &&
        scriptNameIsAllowed(previousAnswers[project.packageName])
          ? previousAnswers[project.packageName]
          : 0
    })
    return total
  }, [])

let scriptsList = argv.include
  ? argv.include.filter((a) => tempSet.has(a))
  : Array.from(tempSet)
scriptsList.unshift('ignore')

choices.forEach((choice) => {
  if (choice.initial !== undefined && choice.initial !== 0) {
    choice.initial = scriptsList.indexOf(choice.initial)
  }
})

if (argv.limit) {
  scriptsList = scriptsList.slice(0, argv.limit)
}

const packageScripts = scriptsList.map((scriptName) => ({
  name: scriptName,
  description: ''
}))

scriptsList.forEach((scriptName, index) => {
  packageScripts[index] = scriptName
})

module.exports = createPrompt(choices, scriptsList)
  .run()
  .then((answers) => {
    let projectsToRun = Object.keys(answers)
      .map((projectOrCategoryName) => {
        let script = scriptsList[answers[projectOrCategoryName]]
        if (script === 'ignore' || script === undefined) {
          // user specified ignore, or did not set anything at all
          return null
        }

        let packageName = projectOrCategoryName.replace(/-\s*/, '')
        let pkg = projects.find((p) => p.packageName === packageName)

        if (pkg) {
          if (
            !pkg.packageJson.scripts ||
            pkg.packageJson.scripts[script] === undefined
          ) {
            // it was an "n/a" thing in the menu
            return null
          }

          return {
            package: pkg,
            packageName,
            script
          }
        }
        return null
      })
      .filter((project) => project !== null)

    let projectsToRunByName = {}
    projectsToRun.forEach(({ packageName, script }) => {
      projectsToRunByName[packageName] = script
    })

    save(JSON.stringify(projectsToRunByName, undefined, 4))

    projectsToRun.map((project) => {
      let p = spawnStreaming(
        'npm',
        ['run', project.script],
        { cwd: path.resolve(getRushRootDir(), project.package.projectFolder) },
        (project.packageName + '->' + project.script)
          .substr(0, 50)
          .padEnd(50, ' ')
      )

      return p
    })
  })
  .catch(console.error)
