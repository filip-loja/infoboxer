
const config = require('../../config');
const fs = require('fs');
const path = require('path');
const lineReader = require('line-reader');
const Entities = require('html-entities').AllHtmlEntities;

const separatorStart = '====[START]==== (XYZ)\n'
const separatorEnd = '====[END]====\n'

class PreProcessor {

  constructor(filePath, fileNum) {
    this.processStart = process.hrtime()

    this.filePath = filePath
    this.fileNum = fileNum
    this.entities = new Entities()
    this.line = ''

    this.infoBoxActive = false
    this.openBracesCount = 0
    this.closeBracesCount = 0

    this.activeInfoboxLines = ''
    this.includeInfobox = false

    this.dataIncluded = ''
    this.dataExcluded = ''
    this.includedCount = 0
    this.excludedCount = 0

    this.includedAutoClosed = []
    this.excludedAutoClosed = []

    this.outputPathIncluded = path.join(config.PROJECT_DIR, 'data', 'pre_processed', 'included')
    this.outputPathExcluded = path.join(config.PROJECT_DIR, 'data', 'pre_processed', 'excluded')

    console.log('\nPre-processing started. Please wait.')
    lineReader.eachLine(this.filePath, this.processLine.bind(this))
  }

  processLine(rawLine, isLast) {
    this.line = this.entities.decode(rawLine)

    if (this.isInfoboxOpening()) {
      this.infoBoxActive = true
      this.openBracesCount = 0
      this.closeBracesCount = 0
      this.activeInfoboxLines = ''
      this.includeInfobox = false
    }

    if (this.infoBoxActive) {
      this.calcCurlyBraces()
      this.checkForSettlementType()
      this.activeInfoboxLines = this.activeInfoboxLines + this.line + '\n'

      if (this.isInfoboxClosing()) {
        if (this.includeInfobox) {
          this.dataIncluded = this.dataIncluded +
            separatorStart.replace('XYZ', String(this.includedCount)) +
            this.activeInfoboxLines +
            separatorEnd
          this.includedCount++

        } else {
          this.dataExcluded = this.dataExcluded +
            separatorStart.replace('XYZ', String(this.excludedCount)) +
            this.activeInfoboxLines +
            separatorEnd
          this.excludedCount++
        }

        this.infoBoxActive = false
      }
    }

    if (isLast) {
      this.finish()
    }
  }

  isInfoboxOpening() {
    const regex = /^{{Infobox\s*settlement.*/i
    return regex.test(this.line)
  }

  isInfoboxClosing() {
    const basicCheck = this.openBracesCount === this.closeBracesCount
    let abruptCheck = false
    if (!basicCheck && (this.openBracesCount - this.closeBracesCount === 1 && this.line.startsWith('\'\'\''))) {
      abruptCheck = true
      this.activeInfoboxLines = this.activeInfoboxLines.slice(0, -1 * (this.line.length + 1)) + '}}\n'
      if (this.includeInfobox) {
        this.includedAutoClosed.push(this.includedCount)
      } else {
        this.excludedAutoClosed.push(this.excludedCount)
      }
    }
    return basicCheck || abruptCheck
  }

  isSettlementTypeLine() {
    const regex = /\|\s*settlement_type\s*=/i
    return regex.test(this.line)
  }

  calcCurlyBraces() {
    this.openBracesCount += (this.line.match(/{{/g) || []).length
    this.closeBracesCount += (this.line.match(/}}/g) || []).length
  }

  checkForSettlementType () {
    if (this.isSettlementTypeLine()) {
      const regex = /capital(\scity)?|city|town|metropolis/i
      this.includeInfobox = regex.test(this.line)
    }
  }

  finish() {
    const outputIncluded = path.join(this.outputPathIncluded, `infobox_${this.fileNum}_${this.includedCount}.txt`)
    const outputExcluded = path.join(this.outputPathExcluded, `infobox_${this.fileNum}_excluded_${this.excludedCount}.txt`)
    fs.writeFileSync(outputIncluded, this.dataIncluded, 'utf-8')
    fs.writeFileSync(outputExcluded, this.dataExcluded, 'utf-8')

    console.log('Pre-processing finished.')
    console.log(`  ->  ${this.includedCount + this.excludedCount} infoboxes of type "settlement" found.`)
    console.log(`  ->  ${this.includedCount} infoboxes included.`)
    console.log(`  ->  ${this.excludedCount} infoboxes excluded.`)
    if (this.includedAutoClosed.length) {
      console.log(`  ->  ${this.includedAutoClosed.length} of the included infoboxes were closed automatically: ${this.includedAutoClosed.join(', ')}`)
    }
    if (this.excludedAutoClosed.length) {
      console.log(`  ->  ${this.excludedAutoClosed.length} of the excluded infoboxes needed to be closed automatically: ${this.excludedAutoClosed.join(', ')}`)
    }

    const processEnd = process.hrtime(this.processStart)
    console.info('  ->  execution time:  %ds %dms.\n', processEnd[0], processEnd[1] / 1000000)
  }

}

module.exports = PreProcessor
