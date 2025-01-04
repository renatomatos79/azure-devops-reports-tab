const _manifest = require('./vss-extension.json')
const { resolve: resolvePath } = require('node:path')
const { readFileSync, writeFileSync } = require('node:fs')
const guidGenerator = require('aguid')

module.exports = (env) => {
  const buildVersion = env?.semver
  const regexp = /(?<semver>[\d\.]+)-pullrequest(?<pr>[\d]+)\.(?<iteration>[\d]+)$/gm
  const matches = regexp.exec(buildVersion);

  const {
    mode = 'production',
    version = matches && matches.groups.semver || _manifest.version,
    iteration = matches && matches.groups.iteration || 1,
    pullRequestId = matches && matches.groups.pr || 0
  } = env

  if ('dev' === mode) {
    _manifest.id = `${_manifest.id}-dev-${pullRequestId}`
    _manifest.name = `${_manifest.name} [DEV-${pullRequestId}]`
    _manifest.version = `${version}.${iteration}`

    // Change the task manifests
    _manifest.contributions.forEach(contribution => {
      const type = contribution.type.split('.').at(-1)

      switch (type) {
        case 'task':
          const _taskManifest = readTaskManifest(resolvePath(__dirname, contribution.properties.name))

          _taskManifest.name = `${_taskManifest.name}${pullRequestId}`
          _taskManifest.friendlyName = `${_taskManifest.friendlyName} [DEV-${pullRequestId}]`
         
          updateTaskManifest(resolvePath(__dirname, contribution.properties.name), _taskManifest)
          break
        case 'build-results-tab':
          contribution.properties.name = `${contribution.properties.name} [DEV-${pullRequestId}]`
          break
      }
    })
  }

  return _manifest
}

function readTaskManifest (dir) {
  return JSON.parse(
    readFileSync(resolvePath(dir, 'task.json'), { encoding: 'utf8' }),
  )
}

function updateTaskManifest (dir, manifest) {
  writeFileSync(
    resolvePath(dir, 'task.json'),
    JSON.stringify(manifest, undefined, 4)
  )
}