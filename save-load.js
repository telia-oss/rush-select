const path = require('path')
const fs = require('fs')

const answersFilePath = path.resolve(__dirname, '.cached-answers.json')

module.exports = {
  save: (projectsToRun) => {
    let projectsToRunByNameJsonFriendly = []

    projectsToRun.forEach((project) => {
      let jsonFriendly = { ...project }
      delete jsonFriendly.package

      projectsToRunByNameJsonFriendly.push(jsonFriendly)
    })

    fs.writeFileSync(
      answersFilePath,
      JSON.stringify(projectsToRunByNameJsonFriendly, undefined, 4),
      (e) => {
        if (e) {
          throw e
        }
      }
    )
  },
  load: () => {
    let cachedAnswers = []

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

    return cachedAnswers
  }
}
