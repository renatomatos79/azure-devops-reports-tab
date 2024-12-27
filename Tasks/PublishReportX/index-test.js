const { resolve, basename, dirname } = require('path');
const dashify = require('dashify')
const globby = require('globby')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { load } = require('cheerio');

function run () {
    let reportDir = './playwright-report/junit222.xml';
    console.log(`debug::reportDir: `, reportDir);
    const parsedFile = reportDir.replace(/\\/g, '/')
    const extractDir = dirname(parsedFile)
    const files = globby.sync([extractDir], {expandDirectories : {files: ['*'], extensions: ['html']}});
    const fileProperties = [];

    // create file if not exists
    if (!existsSync(parsedFile)) {
        writeFileSync(parsedFile, '');
    }


    console.log(`debug::printing all files ${JSON.stringify(files)}`);

    files.forEach(file => {
      console.log('debug::file: ', file)
      console.log(`Reading report ${file}`);
      const fileContent = readFileSync(file, 'utf8');
      const document = load(fileContent);
      writeFileSync(file, document.html());

      const attachmentProperties = {
          name: generateName(basename(file)),
          type: 'report-html',
          path: file
      };

      console.log('debug::addattachment: ', attachmentProperties)
      fileProperties.push(attachmentProperties);
      // tl.command('task.addattachment', attachmentProperties, file);
  });
    
    const jobName = dashify('Agent JobName')
    const stageName = dashify('System StageDisplayName')
    const stageAttempt = dashify('System StageAttempt')
    const tabName = 'Html-Report'
    const summaryPath = resolve(parsedFile)
    writeFileSync(summaryPath, JSON.stringify(fileProperties))
    console.log("36")
    console.log('debug::summaryPath: ', summaryPath)

    // tl.addAttachment('report-html', `${tabName}.${jobName}.${stageName}.${stageAttempt}`, summaryPath)
}

function generateName (fileName) {
    const jobName = dashify('Agent.JobName')
    const stageName = dashify('System.StageDisplayName')
    const stageAttempt = dashify('System StageAttempt')
    const tabName = 'Html-Report'

    return `${tabName}.${jobName}.${stageName}.${stageAttempt}.${fileName}`
}

run();