const path = require('path')
const fs = require('fs')

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

module.exports = {
  save: (rushRootDir, projectsToRun) => {
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
    const projectsToRunByNameJsonFriendly = []
    projectsToRun.forEach((project) => {
      const jsonFriendly = { ...project }
      delete jsonFriendly.project

      projectsToRunByNameJsonFriendly.push(jsonFriendly)
    })

    // add to existing results, if any
    preExistingData[rushRootDir] = projectsToRunByNameJsonFriendly

    fs.writeFileSync(answersFilePath, JSON.stringify(preExistingData, undefined, 4), (e) => {
      if (e) {
        throw e
      }
    })
  },
  load: (rushRootDir) => {
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

    return cachedAnswers[rushRootDir] || []
  }
}
