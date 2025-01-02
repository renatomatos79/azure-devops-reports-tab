const tl = require('azure-pipelines-task-lib');
const { resolve, basename, dirname } = require('path');
const dashify = require('dashify')
const globby = require('globby')
const { readFileSync, writeFileSync } = require('fs')
// const { load } = require('cheerio');

// this type is used to attach the summary file to the build 
// tabContent uses this type to display the summary file
const ATTACHMENT_TYPE = "report-html";

function run () {
    const inputReportPath = tl.getPathInput('reportDir', true, false);
    const outputReportFile = inputReportPath.replace(/\\/g, '/')
    const sourceDir = dirname(outputReportFile);
    
    console.log(`debug::reportDir: `, {
        inputPath: inputReportPath, 
        outputReport: outputReportFile, 
        sourceDir
    });

    const onlyHtmlFiles = globby.sync([sourceDir], {expandDirectories : {files: ['*'], extensions: ['html']}});
    const fileProperties = [];

    console.log(`debug::printing all files ${JSON.stringify(onlyHtmlFiles)}`);

    onlyHtmlFiles.forEach(file => {
      console.log(`debug::Reading report file: ${file}`);
      const fileContent = readFileSync(file, 'utf8');
      //const document = load(fileContent);
      //writeFileSync(file, document.html());
      writeFileSync(file, fileContent);

      const attachmentProperties = {
          name: generateName(basename(file)),
          type: 'report-html',
          path: file
      };

      console.log('debug::addattachment: ', attachmentProperties)
      fileProperties.push(attachmentProperties);
      tl.command('task.addattachment', attachmentProperties, file);
    });
    
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'
    const summaryPath = resolve(outputReportFile)
    const summaryContent = JSON.stringify(fileProperties)
    console.log('debug::summaryContent: ', summaryContent)

    writeFileSync(summaryPath, summaryContent)
    console.log('debug::summaryPath: ', summaryPath)

    tl.addAttachment(ATTACHMENT_TYPE, `${tabName}.${jobName}.${stageName}.${stageAttempt}`, summaryPath)
    console.log('debug::status: completed')
}

function generateName (fileName) {
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'

    return `${tabName}.${jobName}.${stageName}.${stageAttempt}.${fileName}`
}

run();