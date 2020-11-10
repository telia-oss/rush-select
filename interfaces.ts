export interface KeyPressEvent {
  action?: string
  name: string
  ctrl: boolean
  meta: boolean
  shift: boolean
  option: boolean
  sequence: string
  raw: string
}

export interface CreatedChoicesAndScriptNames {
  choices: Array<Choice>
  allScriptNames: Array<string>
}

export interface Argv {
  i?: string | null | Array<string | null>
  include?: string | null | Array<string | null>
  e?: string | null | Array<string | null>
  exclude?: string | null | Array<string | null>
}

export interface ExecutionGroup {
  category: string
  name: string
  initial: number
  scriptNames: Array<string>
  allowMultipleScripts: boolean
  scriptExecutable: string
  customSortText: string
  scriptCommand: Array<string> | undefined
}

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
  scriptExecutable: string
  scriptCommand: Array<string>
  initial?: string | number
}

export interface ScaleWithIndex {
  index: number
}

export interface ScaleWithName {
  name: string
  executionGroupIndex?: number
  message?: string
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
  scale: ScaleWithIndex[]
  customSortText?: string
}

export interface Project {
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

export interface SubmittedChoice {
  packageName: string
  script: string
  scriptExecutable: string | undefined
  scriptCommand: Array<string> | undefined
  project: undefined | Project
}
