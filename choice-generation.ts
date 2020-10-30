module.exports = {
  createChoices: (projects: any, scriptFilterFn = () => true) => {
    const tempSet = new Set([])

    const choices = projects
      // some projects may not have a single script that is allowed to run, so filter them out
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 0 arguments, but got 1.
      .filter((project: any) => Object.keys(project.packageJson.scripts).some((scriptName) => scriptFilterFn(scriptName))
      )
      .reduce((total = [], project: any) => {
        // keep track of the scripts that were found
        if (project.packageJson.scripts) {
          // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
          Object.keys(project.packageJson.scripts).forEach((s) => tempSet.add(s))
        }

        const availableScripts = Object.keys(project.packageJson.scripts || [])
          .sort()
          .filter(scriptFilterFn)

        // insert a project
        total.push({
          // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
          name: project.packageName,
          // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
          category: project.reviewCategory,
          // @ts-expect-error ts-migrate(2322) FIXME: Type 'string[]' is not assignable to type 'never'.
          availableScripts
        })
        return total
      }, [])

    return {
      choices,
      allScriptNames: Array.from(tempSet)
    }
  },
  setInitialValuesOnChoices: (choices: any, savedProjectScripts: any, scriptFilterFn = () => true) => {
    // set the initial values, if possible
    const usedChoices: any = []
    savedProjectScripts.forEach((savedProjectScript: any) => {
      let foundChoiceIndex = choices.findIndex(
        (unusedChoice: any) => unusedChoice.name === savedProjectScript.packageName
      )

      if (foundChoiceIndex !== -1) {
        const choiceInUse = usedChoices.some(
          // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'usedChoice' implicitly has an 'any' typ... Remove this comment to see the full error message
          (usedChoice) => usedChoice.initial === choices[foundChoiceIndex].initial
        )

        if (choiceInUse) {
          // add another choice with the same project source, but different script
          choices.splice(foundChoiceIndex, 0, {
            ...choices[foundChoiceIndex]
          })
          foundChoiceIndex++
        }

        // @ts-expect-error ts-migrate(2554) FIXME: Expected 0 arguments, but got 1.
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
