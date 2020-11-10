import { Choice, Project, Package, CreatedChoicesAndScriptNames } from './interfaces'

export const createChoices = (
  projects: Array<Project>,
  scriptFilterFn: (_: string) => boolean = () => true
): CreatedChoicesAndScriptNames => {
  const tempSet = new Set<string>([])

  if (!scriptFilterFn) {
    scriptFilterFn = () => {
      return true
    }
  }

  const choices = projects
    // some projects may not have a single script that is allowed to run, so filter them out
    .filter((project: Project) =>
      Object.keys(project.packageJson.scripts).some((scriptName) => scriptFilterFn(scriptName))
    )
    .reduce((total: Array<Choice>, project: Project) => {
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
        scriptExecutable: 'npm',
        scriptCommand: ['run'],
        availableScripts
      })
      return total
    }, [])

  return {
    choices,
    allScriptNames: Array.from(tempSet)
  }
}

export const setInitialValuesOnChoices = (
  choices: Array<Choice>,
  savedProjectScripts: Array<Package>,
  scriptFilterFn: (param: string) => boolean
): void => {
  // set the initial values, if possible
  const usedChoices: Array<Choice> = []
  savedProjectScripts.forEach((savedProjectScript: Package) => {
    let foundChoiceIndex = choices.findIndex(
      (unusedChoice: Choice) => unusedChoice.name === savedProjectScript.packageName
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

      if (!scriptFilterFn || scriptFilterFn(savedProjectScript.script)) {
        choices[foundChoiceIndex].initial = savedProjectScript.script
      }

      // mark as used
      usedChoices.push(choices[foundChoiceIndex])
    }
  })
}
