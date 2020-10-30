module.exports = {
  createChoices: (projects: any, scriptFilterFn = (_: any) => true) => {
    const tempSet = new Set<string>([])

    const choices = projects
      // some projects may not have a single script that is allowed to run, so filter them out
      .filter((project: any) =>
        Object.keys(project.packageJson.scripts).some((scriptName) => scriptFilterFn(scriptName))
      )
      .reduce((total: Array<any>, project: any) => {
        // keep track of the scripts that were found
        if (project.packageJson.scripts) {
          Object.keys(project.packageJson.scripts).forEach((s) => tempSet.add(s))
        }

        const availableScripts = Object.keys(project.packageJson.scripts || [])
          .sort()
          .filter(scriptFilterFn)

        // insert a project
        total.push({
          name: project.packageName,
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
  setInitialValuesOnChoices: (
    choices: any,
    savedProjectScripts: any,
    scriptFilterFn = (_: any) => true
  ) => {
    // set the initial values, if possible
    const usedChoices: Array<any> = []
    savedProjectScripts.forEach((savedProjectScript: any) => {
      let foundChoiceIndex = choices.findIndex(
        (unusedChoice: any) => unusedChoice.name === savedProjectScript.packageName
      )

      if (foundChoiceIndex !== -1) {
        const choiceInUse = usedChoices.some(
          (usedChoice) => usedChoice.initial === choices[foundChoiceIndex].initial
        )

        if (choiceInUse) {
          // add another choice with the same project source, but different script
          choices.splice(foundChoiceIndex, 0, {
            ...choices[foundChoiceIndex]
          })
          foundChoiceIndex++
        }

        if (scriptFilterFn(savedProjectScript.script)) {
          choices[foundChoiceIndex].initial = savedProjectScript.script
          // choices[foundChoiceIndex].initial = choices[foundChoiceIndex].availableScripts.indexOf(
          //   savedProjectScript.script
          // )
        }

        // mark as used
        usedChoices.push(choices[foundChoiceIndex])
      }
    })
  }
}
