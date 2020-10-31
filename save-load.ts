import path from 'path'
import fs from 'fs'

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

export const save = (rushRootDir: any, projectsToRun: any) => {
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
  const projectsToRunByNameJsonFriendly: any = []
  projectsToRun.forEach((project: any) => {
    const jsonFriendly = { ...project }
    delete jsonFriendly.project

    projectsToRunByNameJsonFriendly.push(jsonFriendly)
  })

  // add to existing results, if any
  preExistingData[rushRootDir] = projectsToRunByNameJsonFriendly

  fs.writeFileSync(answersFilePath, JSON.stringify(preExistingData, undefined, 4))
}

export const load = (rushRootDir: any) => {
  let cachedAnswers = {}

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

  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return cachedAnswers[rushRootDir] || []
}
