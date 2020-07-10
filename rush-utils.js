const path = require('path')
const hjson = require('hjson')
const fs = require('fs')
const findUp = require('find-up')

let rushJsonRelativePath = findUp.sync('rush.json')

if (rushJsonRelativePath === null) {
  throw new Error(
    'Could not find a rush.json file inside or anywhere above the current working directory'
  )
}

let rushRootDir = path.dirname(rushJsonRelativePath)
let rushJsonPath = path.resolve(rushJsonRelativePath)

let rushConfig = hjson.parse(fs.readFileSync(rushJsonPath).toString())
let { projects } = rushConfig

module.exports = {
  getProjectsAndRespectivePackageJson: () =>
    projects
      .map((project) => {
        project.packageJson = require(path.resolve(
          rushRootDir,
          project.projectFolder,
          'package.json'
        ))

        if (!project.reviewCategory) {
          project.reviewCategory = '[no category in rush.json]'
        }

        return project
      })
      .sort((a, b) => {
        if (a.reviewCategory < b.reviewCategory) {
          return -1
        }
        if (a.reviewCategory > b.reviewCategory) {
          return 1
        }

        // category is same, sort by package name instead
        if (a.packageName < b.packageName) {
          return -1
        }
        if (a.packageName > b.packageName) {
          return 1
        }
        return 0
      }),
  getRushRootDir: () => rushRootDir
}
