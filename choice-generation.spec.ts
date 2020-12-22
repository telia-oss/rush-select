import { applySelectedScriptsOnChoicesFromCache, createChoices } from './choice-generation'
import { Project } from './interfaces'

const createMockProjects = (): Array<Project> => [
  {
    projectFolder: 'projectFolder',
    packageName: 'packageName',
    shouldPublish: false,
    reviewCategory: 'reviewCategory',
    packageJson: {
      name: 'string',
      version: 'string',
      main: 'string',
      description: 'string',
      author: 'string',
      devDependencies: {},
      scripts: { build: 'echo building' }
    }
  }
]

describe('choice-generation', () => {
  test('should convert a project into a choice', async () => {
    const { choices, allScriptNames } = createChoices(createMockProjects())

    expect(choices).toHaveLength(1)
    expect(allScriptNames).toHaveLength(1)
    expect(allScriptNames).toEqual(['build'])
  })

  test('should populate initial scripts on choices', async () => {
    const { choices } = createChoices(createMockProjects())
    applySelectedScriptsOnChoicesFromCache(
      choices,
      {
        packages: [
          {
            packageName: 'packageName',
            script: 'build',
            scriptExecutable: 'npm',
            scriptCommand: ['run']
          }
        ],
        cliVersion: '0.11.0'
      },
      () => true
    )

    expect(choices[0].initial).toBeDefined()
    expect(choices[0].initial).toEqual(['build'])
  })
})
