module.exports = {
  getArgs: () =>
    require('yargs')
      .usage('$0 --include start --include build:watch -d lint')
      .options({
        include: {
          alias: 'i',
          demandOption: false,
          describe:
            'Set this parameter one or multiple times to specify scripts that should be available in the prompt.',
          type: 'string'
        },
        exclude: {
          alias: 'e',
          demandOption: false,
          describe:
            'Set this parameter one or multiple times to specify some scripts that should be filtered out in the prompt.',
          type: 'string'
        },
        limit: {
          alias: 'l',
          demandOption: false,
          describe:
            'If no includes are defined, this value will default to 8 to avoid terminal spam.',
          type: 'number'
        }
      })
}
