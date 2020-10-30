// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'fs'.
const fs = require('fs')

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

module.exports = {
  save: (rushRootDir: any, projectsToRun: any) => {
    let preExistingData
    try {
      preExistingData = JSON.parse(fs.readFileSync(answersFilePath))
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

    fs.writeFileSync(answersFilePath, JSON.stringify(preExistingData, undefined, 4), (e: any) => {
      if (e) {
        throw e
      }
    })
  },
  load: (rushRootDir: any) => {
    let cachedAnswers = {}

    try {
      cachedAnswers = JSON.parse(fs.readFileSync(answersFilePath))
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
}
