export interface Package {
  packageName: string
  script: string
}

export interface SavedEntries {
  [keys: string]: Array<Package>
}

export interface Choice {
  name: string
  category: string
  availableScripts: string[]
  initial?: string
}

export interface ChoiceInPrompt extends Choice {
  allowMultipleScripts: boolean
}

export interface Project {
  packageName: string
  script: string
  scriptExecutable: string | undefined
  scriptCommand: Array<string> | undefined
  reviewCategory: string
  packageJson: any | undefined
  projectFolder: string | undefined
  project:
    | undefined
    | {
        packageName: string
        projectFolder: string
        reviewCategory: string
        shouldPublish: boolean
        packageJson: {
          name: string
          version: string
          main: string
          description: string
          author: string
          scripts: {
            [keys: string]: string
          }
          devDependencies: {
            [keys: string]: string
          }
        }
      }
}
