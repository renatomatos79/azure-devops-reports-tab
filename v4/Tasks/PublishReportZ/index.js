const tl = require('azure-pipelines-task-lib');
const { resolve, basename, join, extname } = require('path');
const dashify = require('dashify')
const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs')
const { load } = require('cheerio');

// this type is used to attach the summary file to the build 
// tabContent uses this type to display the summary file
const ATTACHMENT_TYPE_REPORT = "report-html";
const ATTACHMENT_TYPE_SETTINGS = "report-settings";
const ATTACHMENT_TYPE_PROP = "task-prop";
const OUTPUT_REPORT_NAME = 'report-settings.json';
const BUILD_PARAMS = 'build-params.json';


function run () {
    const inputReportPath = String(resolve(tl.getPathInput('reportDir', true, true)));    
    const outputReportFile = resolve(join(inputReportPath, OUTPUT_REPORT_NAME));
    const buildParamsFile = resolve(join(inputReportPath, BUILD_PARAMS));
    
    console.log(`debug::reportDir: `, {
        inputReportPath, 
        outputReportFile,
        buildParamsFile
        
    });

    
    const fileProperties = [];
    const buildParamsProperties = [];

    // create a build-params.json file using input values
    ['storageUrl', 'storageToken', 'reportDir'].forEach(key => {
        buildParamsProperties.push({
            name: key,
            type: ATTACHMENT_TYPE_PROP,
            value: tl.getInput(key, false, false)
        });
    })

    
    writeFileSync(buildParamsFile, JSON.stringify(buildParamsProperties));
    const attachmentProperties = {
        name: generateName(basename(BUILD_PARAMS)),
        type: ATTACHMENT_TYPE_SETTINGS,
        path: buildParamsFile
    };
    fileProperties.push(attachmentProperties);
    tl.command('task.addattachment', attachmentProperties, buildParamsFile);

    // extract html files from the report directory
    const onlyHtmlFiles = getFiles(inputReportPath, '.html');
    console.log('debug::printing all files:  ', onlyHtmlFiles);
    
    onlyHtmlFiles.forEach(file => {
      console.log(`debug::Reading report file: ${file}`);
      const fileContent = readFileSync(file, 'utf8');
      
      const document = load(fileContent);
      writeFileSync(file, document.html());

      const attachmentProperties = {
          name: generateName(basename(file)),
          type: ATTACHMENT_TYPE_REPORT,
          path: file
      };

      fileProperties.push(attachmentProperties);
      tl.command('task.addattachment', attachmentProperties, file);
    });
    
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'

    writeFileSync(outputReportFile, JSON.stringify(fileProperties))
    console.log('debug::summaryContent: ', JSON.stringify(fileProperties))
    console.log('debug::summaryPath: ', outputReportFile)

    tl.addAttachment(ATTACHMENT_TYPE_REPORT, `${tabName}.${jobName}.${stageName}.${stageAttempt}`, outputReportFile)
    console.log('debug::status: completed')
}

function generateName (fileName) {
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Html-Report'

    return `${tabName}.${jobName}.${stageName}.${stageAttempt}.${fileName}`
}

function getFiles(directory, extension) {
    // Read all files in the directory
    const files = readdirSync(directory);

    // Filter only HTML files
    const htmlFiles = files.filter((file) => {
        const fullPath = join(directory, file);
        return statSync(fullPath).isFile() && extname(file) === extension;
    });

    return htmlFiles.map((file) => join(directory, file));
}

run();