
const Parser = require('./Parser.js')

const path = '../_data/infoboxes_raw/'
const files = [
  'test.txt',
  'infobox_1_161.txt',
  'infobox_2_7691.txt',
  'infobox_3_905.txt'
]

const fileNum = Number(process.argv[2] || Infinity)
if (fileNum >= files.length) {
  throw new Error('Unknown file')
}

new Parser(path + files[fileNum], fileNum)
