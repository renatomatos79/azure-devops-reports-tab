let { render } = require("mustache")
let { resolve: resolvePath } = require('node:path')
let { readFileSync, writeFileSync, readdirSync, existsSync } = require("node:fs")

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
    main: loadTemplate('README.mustache')
}

const extension = loadManifest('vss-extension.json')

extension.contributions.filter(({ type }) => type === "ms.vss-distributed-task.task")
.forEach(contribution => {
    const { name } = contribution.properties

    const task = loadManifest(resolvePath(name, 'task.json'))

    task?.inputs.forEach(input => {
        if ('aliases' in input) {
            if (input.aliases.length >= 1) {
                input.hasAliases = true
                input.aliases_condensed = input.aliases.join(', ')
                input.aliases_expanded = input.aliases.map(alias => `\`${alias}\``).join(', ')
            }
        }

        if (input.type === "multiLine") {
            input.type = "string"
        }
    })

    const DocsPath = resolvePath(name, 'Docs')
    let partials = {}
    if (existsSync(DocsPath)) {
        const _partials = readdirSync(DocsPath)

        partials = Object.fromEntries(_partials.map(partial => {
            const template = loadTemplate(resolvePath(DocsPath, partial))
            const key = partial.split('.').at(0)

            return [ key, template ]
        }))
    }

    Object.keys(partials).forEach(partial => {
        const key = partial.at(0).toUpperCase() + partial.substring(1)

        task[`has${key}Partial`] = true
    }) 

    writeFileSync(
        resolvePath(root, name, 'README.md'),
        render(templates.main, task, partials)
    )
})
