let { render } = require("mustache")
let { resolve: resolvePath } = require('node:path')
let { readFileSync, writeFileSync } = require("node:fs")


const root = resolvePath(__dirname, '..')

const pathToTemplates = resolvePath(root, '_templates')

function loadTemplate(template) {
    const _template = readFileSync(resolvePath(pathToTemplates, template))
        .toString()

    return _template
}

function loadManifest(pathToManifest) {
    const _manifest = readFileSync(resolvePath(root, pathToManifest))
        .toString()

    return JSON.parse(_manifest)
}

const templates = {
    main: loadTemplate('overview.mustache')
}

const extension = loadManifest('vss-extension.json')

const tasks = extension.contributions.filter(({ type }) => type === 'ms.vss-distributed-task.task')
.map(contribution => {
    const { name } = contribution.properties
    const task = loadManifest(resolvePath(name, 'task.json'))
    const { Major: major, Minor: minor, Patch: patch } = task.version

    return {
        name: task.name,
        version: `${major}.${minor}.${patch}`,
        friendlyName: task.friendlyName,
        readme_alias: `readme-${task.name.toLowerCase()}`,
        readme_url: (new URL(`?path=/${name}/README.md&_a=preview`, extension.repository.uri)).toString()
    }
}).sort((a, b) => {
    if (a.name < b.name) {
        return -1
    }
})

writeFileSync(
    resolvePath(root, 'overview.md'),
    render(templates.main, { tasks })
)
