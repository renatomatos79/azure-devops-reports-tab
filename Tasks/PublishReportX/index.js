const tl = require('azure-pipelines-task-lib');
const { resolve, basename, dirname} = require('path');
const dashify = require('dashify')
const globby = require('globby')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { load } = require('cheerio');

// attachment used to share content between this task and TabContent component
const ATTACHMENT_TYPE = "report-html";

function log(group, payload) {
    console.log(`debug::${group}: `, payload ?? '');
    tl.debug(`debug::${group}: ${payload ?? ''}`);
}

function run () {
    let reportDir = tl.getPathInput('reportDir', true, false);
    log('reportDir', reportDir);

    const parsedFile = reportDir.replace(/\\/g, '/')

    log('extracting dir ', parsedFile);
    const extractedDir = dirname(parsedFile)

    const files = globby.sync([extractedDir], {expandDirectories : {files: ['*'], extensions: ['html']}});
    const fileProperties = [];

    // create file if not exists
    // if (!existsSync(parsedFile)) {
    //     log('file not found', parsedFile);
    //     writeFileSync(parsedFile, '');
    // }

    log('printing all files', JSON.stringify(files));

    files.forEach(file => {
      log('file', file)
      const fileContent = readFileSync(file, 'utf8');
      const document = load(fileContent);
      writeFileSync(file, document.html());

      const attachmentProperties = {
          name: generateName(basename(file)),
          type: 'report-html',
          path: file
      };

      log('addattachment', JSON.stringify(attachmentProperties))
      fileProperties.push(attachmentProperties);
      tl.command('task.addattachment', attachmentProperties, file);
  });
    
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'
    const summaryPath = resolve(parsedFile)
    writeFileSync(summaryPath, JSON.stringify(fileProperties))
    console.log('summaryPath', summaryPath)

    tl.addAttachment(ATTACHMENT_TYPE, `${tabName}.${jobName}.${stageName}.${stageAttempt}`, summaryPath)
}

function generateName (fileName) {
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'

    return `${tabName}.${jobName}.${stageName}.${stageAttempt}.${fileName}`
}

run();