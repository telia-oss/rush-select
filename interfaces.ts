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

export interface Scale {
  index: number
}

export interface ChoiceInPrompt {
  allowMultipleScripts: boolean
  ansiLessName?: string
  scaleIndex: number
  hint?: string
  name: string
  category: string
  availableScripts: string[]
  executionGroupIndex?: number
  initial: number
  normalized: boolean
  message: string
  value: string
  input: string
  index: number
  cursor: number
  level: number
  indent: string
  path: string
  enabled: boolean
  scale: Scale[]
  customSortText?: string
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
