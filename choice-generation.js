module.exports = {
  createChoices: (projects, scriptFilterFn = () => true) => {
    let tempSet = new Set([])

    let choices = projects
      // some projects may not have a single script that is allowed to run, so filter them out
      .filter((project) =>
        Object.keys(project.packageJson.scripts).some((scriptName) => scriptFilterFn(scriptName))
      )
      .reduce((total = [], project) => {
        // keep track of the scripts that were found
        if (project.packageJson.scripts) {
          Object.keys(project.packageJson.scripts).forEach((s) => tempSet.add(s))
        }

        let availableScripts = Object.keys(project.packageJson.scripts || []).filter(scriptFilterFn)

        // insert a project
        total.push({
          name: project.packageName,
          _reviewCategory: project.reviewCategory,
          category: project.reviewCategory,
          availableScripts
        })
        return total
      }, [])

    return {
      choices,
      allScriptNames: Array.from(tempSet)
    }
  },
  setInitialValuesOnChoices: (choices, savedProjectScripts, scriptFilterFn = () => true) => {
    // set the initial values, if possible
    let usedChoices = []
    savedProjectScripts.forEach((savedProjectScript) => {
      let foundChoiceIndex = choices.findIndex(
        (unusedChoice) => unusedChoice.name === savedProjectScript.packageName
      )

      if (foundChoiceIndex !== -1) {
        let choiceInUse = usedChoices.some((usedChoice) => usedChoice === choices[foundChoiceIndex])

        if (choiceInUse) {
          // add another choice with the same project source, but different script
          choices.splice(foundChoiceIndex, 0, {
            ...choices[foundChoiceIndex]
          })
          foundChoiceIndex++
        }

        choices[foundChoiceIndex].initial = scriptFilterFn(savedProjectScript.script)
          ? choices[foundChoiceIndex].availableScripts.indexOf(savedProjectScript.script) + 1
          : 0

        // mark as used
        usedChoices.push(choices[foundChoiceIndex])
      }
    })
  }
}
