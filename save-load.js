const path = require('path')
const fs = require('fs')

const answersFilePath = path.resolve(__dirname, '.previous-answers.json')
const answersDefaultsFilePath = path.resolve(
  __dirname,
  '.previous-answers.defaults.json'
)

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
    let previousAnswers = []

    try {
      previousAnswers = JSON.parse(fs.readFileSync(answersFilePath))
    } catch (e) {
      if (e.code === 'ENOENT') {
        // file doesn't exist (aka no old answers exist), create it from the defaults
        previousAnswers = JSON.parse(fs.readFileSync(answersDefaultsFilePath))
      } else {
        // other unknown error, throw it
        throw e
      }
    }

    return previousAnswers
  }
}
