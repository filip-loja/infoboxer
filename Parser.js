
const fs = require('fs');
const lineReader = require('line-reader');
const CountryChecker = require('./CountryChecker/CountryChecker.js')
const converter = require('./unit-converter')

class Parser {

  constructor(filePath, fileNum) {
    this.processStart = process.hrtime()
    this.countryChecker = new CountryChecker()

    this.filePath = filePath
    this.fileNum = fileNum
    this.line = ''

    this.data = {}
    this.activeId = null

    console.log('\nParsing started. Please wait.')
    lineReader.eachLine(this.filePath, this.processLine.bind(this))
  }

  processLine(rawLine, isLast) {
    this.line = rawLine

    this.closeInfobox()
    this.loadInfobox()
    this.parseName()
    this.parseSettlementType()
    this.parseSubdivisionType()
    this.parseSubdivisionName()
    this.parsePopulation()
    this.parsePopulationDensity()
    this.parseArea()
    this.parseElevation()

    if (isLast) {
      this.finish()
    }
  }

  infoboxActive() {
    return this.activeId !== null && this.activeId >= 0
  }

  loadInfobox() {
    if (this.infoboxActive()) return
    const regex = /^====\[START]====\s\((\d+)\)$/
    const result = this.line.match(regex) || []
    const id = Number(result[1])
    if (id >= 0) {
      this.activeId = id
      this.data[id] = {}
    }

  }

  closeInfobox() {
    if (!this.infoboxActive()) return
    const regex = /^====\[END]====$/
    if (regex.test(this.line)) {
      this.normalizeActiveInfobox()
      this.sortInfoboxKeys()
      this.activeId = null
    }
  }

  pushError(errorMessage) {
    if (!this.data[this.activeId].errors) {
      this.data[this.activeId].errors = []
    }

    this.data[this.activeId].errors.push(errorMessage)
  }

  sortInfoboxKeys() {
    const keys = [
      'name',
      'type',
      'subdivision_type',
      'country',
      'population',
      'population_type',
      'population_density',
      'area_km2',
      'area_type',
      'elevation_m',
      'errors',
    ]

    const obj = {}
    for (const key of keys) {
      if (key in this.data[this.activeId]) {
        obj[key] = this.data[this.activeId][key]
      }
    }
    this.data[this.activeId] = obj
  }

  normalizeActiveInfobox() {
    if (!this.infoboxActive()) return
    if (!this.data[this.activeId].name && this.data[this.activeId].official_name) {
      this.data[this.activeId].name = this.data[this.activeId].official_name
    }

    this.data[this.activeId].country = this.countryChecker.validateCountry(this.data[this.activeId].subdivision_name, this.activeId)

    if (!this.data[this.activeId].country && this.data[this.activeId].subdivision_name) {
      this.data[this.activeId].country = this.data[this.activeId].subdivision_name
      this.pushError('unrecognized country')
    }

    delete this.data[this.activeId].official_name
    delete this.data[this.activeId].subdivision_name


    // POPULATION

    // this.data[this.activeId].population = this.data[this.activeId].population_total ||
    //   this.data[this.activeId].population_urban ||
    //   this.data[this.activeId].population_blank1 ||
    //   this.data[this.activeId].population_blank2
    //
    // if (!this.data[this.activeId].population) {
    //   this.pushError('population')
    // }
    //
    // delete this.data[this.activeId].population_total
    // delete this.data[this.activeId].population_urban
    // delete this.data[this.activeId].population_blank1
    // delete this.data[this.activeId].population_blank2


    // POPULATION_DENSITY

    this.data[this.activeId].population_density = this.data[this.activeId].population_density_km2 ||
      this.data[this.activeId].population_density_urban_km2 ||
      this.data[this.activeId].population_density_blank1_km2 ||
      this.data[this.activeId].population_density_blank2_km2

    if (!this.data[this.activeId].population_density) {
      this.pushError('population_density')
    }

    delete this.data[this.activeId].population_density_km2
    delete this.data[this.activeId].population_density_urban_km2
    delete this.data[this.activeId].population_density_blank1_km2
    delete this.data[this.activeId].population_density_blank2_km2

    // POPULATION
    this.normalizePopulation()
    if (!this.data[this.activeId].population) {
      this.pushError('population')
    }

    // AREA
    this.normalizeArea()
    if (!this.data[this.activeId].area_km2) {
      this.pushError('area_km2')
    }

    // ELEVATION
    this.normalizeElevation()
    if (!this.data[this.activeId].elevation_m) {
      this.pushError('elevation_m')
    }

  }

  normalizePopulation() {
    const keys = [
      'population_total',
      'population_urban',
      'population_blank1',
      'population_blank2'
    ]

    for (const key of keys) {
      if (!this.data[this.activeId].population) {
        const [, type] = key.split('_')
        const value = this.data[this.activeId][key]
        if (value) {
          this.data[this.activeId].population = value
          this.data[this.activeId].population_type = type
        }
      }

      delete this.data[this.activeId][key]
    }
  }

  normalizeArea() {
    const keys = [
      'area_total_km2',
      'area_total_sq_mi',
      'area_total_ha',
      'area_total_acre',
      'area_urban_km2',
      'area_urban_sq_mi',
      'area_urban_ha',
      'area_urban_acre',
      'area_blank1_km2',
      'area_blank1_sq_mi',
      'area_blank1_ha',
      'area_blank1_acre',
      'area_blank2_km2',
      'area_blank2_sq_mi',
      'area_blank2_ha',
      'area_blank2_acre'
    ]

    for (const key of keys) {
      if (!this.data[this.activeId].area_km2) {
        const [, type, unit] = key.replace('sq_mi', 'sq-mi').split('_')
        const value = this.data[this.activeId][key]
        if (value) {
          this.data[this.activeId].area_km2 = unit === 'km2' ? value : converter.convertToKm2(unit, value)
          this.data[this.activeId].area_type = type
        }
      }

      delete this.data[this.activeId][key]
    }
  }

  normalizeElevation() {
    const keys = [
      'elevation_ft',
      'elevation_max_m',
      'elevation_max_ft',
      'elevation_min_m',
      'elevation_min_ft',
    ]

    if (!('elevation_m' in this.data[this.activeId])) {
      if ('elevation_ft' in this.data[this.activeId]) {
        this.data[this.activeId].elevation_m = converter.convertToM('ft', this.data[this.activeId].elevation_ft)
      } else {
        let maxM = this.data[this.activeId].elevation_max_m || 0
        let minM = this.data[this.activeId].elevation_min_m || 0
        maxM = maxM === 0 ? minM : maxM
        minM = minM === 0 ? maxM : minM
        const avgM = (maxM + minM) / 2

        let maxFt = this.data[this.activeId].elevation_max_ft || 0
        let minFt = this.data[this.activeId].elevation_min_ft || 0
        maxFt = maxFt === 0 ? minFt : maxFt
        minFt = minFt === 0 ? maxFt : minFt
        const avgFt = (maxFt + minFt) / 2

        if (avgM > 0) {
          this.data[this.activeId].elevation_m = Number(avgM.toFixed(2))
        } else if (avgFt) {
          this.data[this.activeId].elevation_m = converter.convertToM('ft', avgFt)
        }
      }
    }

    for (const key of keys) {
      delete this.data[this.activeId][key]
    }
  }

  parseName() {
    if (!this.infoboxActive()) return
    if (this.data[this.activeId].name) return
    const regex = /\|\s*name\s*=\s*(.*)/i
    const result = this.line.match(regex)
    if (result && result[1].trim()) {
      this.processParsedName(result)
    } else if (!this.data[this.activeId].name && !this.data[this.activeId].official_name) {
      const regexFallback = /\|\s*official_name\s*=\s*(.*)/i
      const resultFallback = this.line.match(regexFallback)
      if (resultFallback && resultFallback[1].trim()) {
        this.processParsedName(resultFallback, true)
      }
    }
  }

  processParsedName(regexResult, fallback = false) {
    let name = regexResult[1]
    if (name.startsWith('{{')) {
      name = (name.match(/\|([-.'\w\s]+)}}/i) || [])[1] || regexResult[1]
    } else {
      name = (name.match(/^[-.'\w\s]+/i) || [])[0] || regexResult[1]
    }
    if (fallback) {
      this.data[this.activeId].official_name = name.trim()
    } else {
      this.data[this.activeId].name = name.trim()
    }
    // this.data[this.activeId].lines.name = regexResult[1]
  }

  parseSettlementType() {
    if (!this.infoboxActive() || this.data[this.activeId].type) return
    const regex = /\|\s*settlement_type\s*=.*(capital(?:\scity)?|city|town|metropolis)/i
    const result = (this.line.match(regex) || [])[1]
    if (result) {
      this.data[this.activeId].type = result.toLowerCase()
    }
  }

  parseSubdivisionType() {
    if (!this.infoboxActive() || this.data[this.activeId].subdivision_type) return
    const regex = /\|\s*subdivision_type\s*=\s*(.*)/i
    const result = (this.line.match(regex) || [])[1]
    if (result) {

      // [[List of sovereign states|Country]]
      // [[List of sovereign states|Sovereign state]]
      const countryRegex1 = /(?<=\[\[.*\|)(?:(\w+(?:\s\w+)*)]])/i

      // Country
      // [[Country]]
      // Sovereign state
      const countryRegex2 = /(\w+(?:\s\w+)*)/i

      let parsedResult = (result.match(countryRegex1) || [])[1]

      if (!parsedResult) {
        parsedResult = (result.match(countryRegex2) || [])[1]
      }

      if (!parsedResult) {
        parsedResult = result
        // TODO spravit logovaci mechanizmus
        // console.log(' -- country parsing failed', this.activeId)
      }

      this.data[this.activeId].subdivision_type = parsedResult.toLowerCase()
    }
  }

  transformSubdivisionName(term, regexNum) {
    const regexList = [
      /{{flag\|([-.'\w\s]+)}}/i,      // {{flag|United States}}
      /\[\[([-.'\w\s]+)]]/i,          // [[United States]]
      /{{(\w{2,3})}}/i,               // {{USA}}
      /{{.*\|([-.'\w\s]+)}}/i,        // {{flagicon|USA}}United States
      /{{.*\|([-.'\w\s]+)\|.*}}/i,    // {{Flagu|United States|size=23px}}
      /([-.'\w\s]+)/i,                // United Kingdom<!--the name of the country-->
      null,                           // <extra condition>
    ]

    if (regexNum >= regexList.length) {
      return null
    }

    if (regexNum === regexList.length - 1) {

      // [[china|people's republic of china]]
      // [[republic of ireland|ireland]]
      // the shorter group is preferred
      let parsed = term.match(/\[\[([-.'\w\s]+)\|([-.'\w\s]+)]]/i)
      if (parsed && parsed[1] && parsed[2]) {
        return parsed[1].length <= parsed[2].length ? parsed[1] : parsed[2]
      }

    } else {

      let parsed = term.match(regexList[regexNum])
      if (parsed && parsed[1]) {
        // console.log('transformation', regexNum, '|', term, '|', parsed[1], this.activeId)
        return parsed[1]
      }

    }

    return null
  }

  parseSubdivisionName() {
    if (!this.infoboxActive() || this.data[this.activeId].subdivision_name) return
    const regex = /\|\s*subdivision_name\s*=\s*(.*)/i
    const result = (this.line.match(regex) || [])[1]
    if (result) {
      let finalResult = result

      for (let i = 0; i < 6; i++) {
        const parsed = this.transformSubdivisionName(result, i)
        if (parsed) {
          finalResult = parsed
          break
        }
      }

      this.data[this.activeId].subdivision_name = finalResult
    }
  }

  // niektore infoboxy nemali data ale len odkazy z ktorych sa udaje neali vyparsovat
  parsePopulation() {
    if (!this.infoboxActive() || this.data[this.activeId].population_total) return
    const regex = /\|\s*(population_(?:total|urban|blank[12]?))\s*=\s*(.*)/i
    const result = this.line.match(regex) || []
    const key = result[1]
    const populationRaw = result[2]
    if (key && populationRaw) {
      let population = populationRaw.replace(/,/g, '')
      population = population.match(/(?:^|\s+)(?:[1-9]\d*(?:\.\d+)?|0\.\d+)/) || []
      this.data[this.activeId][key] = population[0] && Number(population[0])
    }
  }

  parsePopulationDensity() {
    if (!this.infoboxActive() || this.data[this.activeId].population_density_km2) return
    const regex = /\|\s*population_density(_urban|_blank[12]?)?_km2\s*=\s*(.*)/i
    const result = this.line.match(regex) || []
    if (result[2]) {
      const key = 'population_density' + (result[1] || '') + '_km2'
      let populationDensity = result[2].replace(/,/g, '')
      populationDensity = populationDensity.match(/(?:^|\s+)[1-9]\d*(?:\.\d+)?/)
      if (populationDensity) {
        this.data[this.activeId][key] = populationDensity[0] && Number(populationDensity[0])
      } else {
        populationDensity = result[2].match(/\bauto\b/i) || []
        this.data[this.activeId][key] = populationDensity[0]
      }
    }
  }

  parseArea() {
    if (!this.infoboxActive() || this.data[this.activeId].area_total_km2) return
    const regex = /\|\s*(area_(?:total|urban|blank[12])_(?:km2|ha|sq_mi|acre))\s*=\s*(.*)/i
    const result = this.line.match(regex) || []
    const key = result[1]
    const areaRaw = result[2]
    if (key && areaRaw) {
      let area = areaRaw.replace(/,/g, '')
      area = area.match(/(?:^|\s+)(?:[1-9]\d*(?:\.\d+)?|0\.\d+)/) || []
      this.data[this.activeId][key] = area[0] && Number(area[0])
    }
  }

  parseElevation() {
    if (!this.infoboxActive() || this.data[this.activeId].elevation_m) return
    const regex = /\|\s*(elevation(?:_max|_min)?_(?:m|ft))\s*=\s*(.*)/i
    const result = this.line.match(regex) || []
    const key = result[1]
    const elevationRaw = result[2]
    if (key && elevationRaw) {
      let elevation = elevationRaw.replace(/,/g, '')
      elevation = elevation.match(/(?:^|\s+)(?:[1-9]\d*(?:\.\d+)?|0\.\d+)/) || []
      this.data[this.activeId][key] = elevation[0] && Number(elevation[0])
    }
  }

  analyze() {
    let noErrors = true
    for (const key in this.data) {
      const errors = []

      if (!this.data[key].name) errors.push('missing name')
      if (!this.data[key].country) errors.push('missing country')

      if (this.data[key].errors && this.data[key].errors.length) {
        errors.push(...this.data[key].errors)
      }

      if (errors.length) {
        noErrors = false
        console.log(`     --  [${key}]: ${errors.join(', ')}`)
      }
    }

    if (noErrors) {
      console.log('    -- no errors found.')
    }
  }

  finish() {
    fs.writeFileSync('out.json', JSON.stringify(this.data, null, 2), 'utf-8')
    // fs.writeFileSync(`../_data/infoboxes_raw/infobox_${this.fileNum}_${this.includedCount}.txt`, this.dataIncluded, 'utf-8')
    // fs.writeFileSync(`../_data/infoboxes_raw/infobox_${this.fileNum}_excluded_${this.excludedCount}.txt`, this.dataExcluded, 'utf-8')
    console.log('Parsing finished.')
    console.log('  ->  error log:')
    this.analyze()

    const processEnd = process.hrtime(this.processStart)
    console.info('  ->  execution time:  %ds %dms.\n', processEnd[0], processEnd[1] / 1000000)
  }

}

module.exports = Parser
