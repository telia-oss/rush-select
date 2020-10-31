import path from 'path'
import fs from 'fs'
import { Project, Package, SavedEntries } from './interfaces'

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

export const save = (rushRootDir: string, projectsToRun: Array<Project>): void => {
  let preExistingData
  try {
    preExistingData = JSON.parse(fs.readFileSync(answersFilePath).toString())
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no cached answers, that's ok.
      preExistingData = {}
    } else {
      // other unknown error, throw it
      throw e
    }
  }

  // json-ify
  const projectsToRunByNameJsonFriendly: Array<Project> = []
  projectsToRun.forEach((project: Project) => {
    const jsonFriendly: Project = { ...project }
    jsonFriendly.project = undefined

    projectsToRunByNameJsonFriendly.push(jsonFriendly)
  })

  // add to existing results, if any
  preExistingData[rushRootDir] = projectsToRunByNameJsonFriendly

  fs.writeFileSync(answersFilePath, JSON.stringify(preExistingData, undefined, 4))
}

export const load = (rushRootDir: string): Array<Package> => {
  let cachedAnswers: SavedEntries = {}

  try {
    cachedAnswers = JSON.parse(fs.readFileSync(answersFilePath).toString())
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no cached answers, that's ok.
    } else {
      // other unknown error, throw it
      throw e
    }
  }

  return cachedAnswers[rushRootDir] || []
}
