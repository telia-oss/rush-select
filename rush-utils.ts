import path from "path";
import fs from "fs";
const hjson = require('hjson')
const findUp = require('find-up')

const rushJsonRelativePath = findUp.sync('rush.json')

if (rushJsonRelativePath === null) {
  throw new Error(
    'Could not find a rush.json file inside or anywhere above the current working directory'
  )
}

const theRushRootDir = path.dirname(rushJsonRelativePath)
const rushJsonPath = path.resolve(rushJsonRelativePath)

const rushConfig = hjson.parse(fs.readFileSync(rushJsonPath).toString())
const { projects } = rushConfig

module.exports = {
  getProjectsAndRespectivePackageJson: () =>
    projects
      .map((project: any) => {
        project.packageJson = require(path.resolve(
          theRushRootDir,
          project.projectFolder,
          'package.json'
        ))

        return project
      })
      .sort((a: any, b: any) => {
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
  getRushRootDir: () => theRushRootDir
}
