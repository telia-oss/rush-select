import path from 'path'
import fs from 'fs'
import hjson from 'hjson'
import findUp from 'find-up'

let _rushJsonRelativePath: string | null = null

const findRushRootPath = (): string => {
  if (_rushJsonRelativePath !== null) {
    return _rushJsonRelativePath
  }

  _rushJsonRelativePath = findUp.sync('rush.json')

  if (_rushJsonRelativePath === null) {
    throw new Error(
      'Could not find a rush.json file inside or anywhere above the current working directory'
    )
  }

  return _rushJsonRelativePath
}

const getProjects = (): any => {
  const rushJsonPath = path.resolve(findRushRootPath())

  const rushConfig = hjson.parse(fs.readFileSync(rushJsonPath).toString())
  return rushConfig.projects
}

export const getProjectsAndRespectivePackageJson = (): any =>
  getProjects()
    .map((project: any) => {
      project.packageJson = require(path.resolve(
        path.dirname(findRushRootPath()),
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
    })

export const getRushRootDir = (): string => path.dirname(findRushRootPath())
