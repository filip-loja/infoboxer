
const config = require('../../config');
const PreProcessor = require('./PreProcessor');
const fs = require('fs');
const path = require('path');

const dirPath = path.join(config.PROJECT_DIR, 'data', 'raw')
const fileList = fs.readdirSync(dirPath).map(fileName => path.join(dirPath, fileName))

const fileNum = Number(process.argv[2] || Infinity)
if (fileNum > fileList.length || !fs.existsSync(fileList[fileNum - 1])) {
  throw new Error('FILE NOT FOUND\n\n')
}

new PreProcessor(fileList[fileNum - 1], fileNum)
