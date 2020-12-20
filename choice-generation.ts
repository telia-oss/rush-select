import { Choice, Project, Package, CreatedChoicesAndScriptNames, SavedEntry } from './interfaces'

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
    .filter(
      (project: Project) =>
        project.packageJson &&
        project.packageJson.scripts &&
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

export const applySelectedScriptsOnChoicesFromCache = (
  choices: Array<Choice>,
  savedProjectScripts: SavedEntry,
  scriptFilterFn: (param: string) => boolean
): void => {
  // set the initial values, if possible
  savedProjectScripts.packages.forEach((savedProjectScript: Package) => {
    const foundChoice = choices.find(
      (unusedChoice: Choice) => unusedChoice.name === savedProjectScript.packageName
    )

    if (foundChoice) {
      if (!scriptFilterFn || scriptFilterFn(savedProjectScript.script)) {
        if (!Array.isArray(foundChoice.initial)) {
          foundChoice.initial = []
        }
        foundChoice.initial.push(savedProjectScript.script)
      }
    }
  })
}
