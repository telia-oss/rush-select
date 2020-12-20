import path from 'path'
import fs from 'fs'
import { version } from './package.json'
import { SubmittedChoice, SavedEntries, SavedEntry } from './interfaces'

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

export const save = (rushRootDir: string, projectsToRun: Array<SubmittedChoice>): void => {
  let fileContents
  try {
    fileContents = JSON.parse(fs.readFileSync(answersFilePath).toString())
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no cached answers, that's ok.
      fileContents = {}
    } else {
      // other unknown error, throw it
      throw e
    }
  }

  // json-ify
  const projectsToRunByNameJsonFriendly: Array<SubmittedChoice> = []
  projectsToRun.forEach((project: SubmittedChoice) => {
    const jsonFriendly: SubmittedChoice = { ...project }
    jsonFriendly.project = undefined

    projectsToRunByNameJsonFriendly.push(jsonFriendly)
  })

  // add to existing results, if any
  fileContents[rushRootDir] = {};
  fileContents[rushRootDir].packages = projectsToRunByNameJsonFriendly
  fileContents[rushRootDir].cliVersion = version

  fs.writeFileSync(answersFilePath, JSON.stringify(fileContents, undefined, 4))
}

export const load = (rushRootDir: string): SavedEntry => {
  let cachedAnswers: SavedEntries = {}

  try {
    cachedAnswers = JSON.parse(fs.readFileSync(answersFilePath).toString())

    if (cachedAnswers[rushRootDir] && cachedAnswers[rushRootDir].cliVersion !== version) {
      // can't use this data because it's from a different version

      cachedAnswers = {}
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      // no cached answers, that's ok.
    } else {
      // other unknown error, throw it
      throw e
    }
  }

  return cachedAnswers[rushRootDir] || {
    packages: [],
    cliVersion: version,
  }
}
