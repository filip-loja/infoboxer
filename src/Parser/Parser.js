
const fs = require('fs');
const lineReader = require('line-reader');
const removeAccents = require('remove-accents');
const CountryChecker = require('../CountryChecker/CountryChecker.js');
const converter = require('../unit-converter');
const config = require('../../config');
const path = require('path');

class Parser {

  constructor(filePath, fileNum) {
    this.processStart = process.hrtime()
    this.countryChecker = new CountryChecker()
    this.outputPath = path.join(config.PROJECT_DIR, 'data', 'parsed', `parsed_infobox_${fileNum}.json`)

    this.filePath = filePath
    this.line = ''

    this.data = {}
    this.activeId = null

    console.log('\nParsing started. Please wait.')
    console.log('  ->  file: ', filePath)
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
    this.parseLeaderName()

    this.parseNumberLine('population', 'population_total')
    this.parseNumberLine('area', 'area_total_km2')
    this.parseNumberLine('elevation', 'elevation_m')
    this.parseNumberLine('density', 'population_density_km2')

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
      'leader',
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

    // COUNTRY

    this.data[this.activeId].country = this.countryChecker.validateCountry(this.data[this.activeId].subdivision_name, this.activeId)

    if (!this.data[this.activeId].country && this.data[this.activeId].subdivision_name) {
      this.data[this.activeId].country = this.data[this.activeId].subdivision_name
      this.pushError('unrecognized country')
    }

    delete this.data[this.activeId].subdivision_name

    // NAME
    this.normalizeName()
    if (!this.data[this.activeId].name) {
      this.pushError('name')
    }

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

    // POPULATION_DENSITY
    this.normalizePopulationDensity()
    if (!this.data[this.activeId].population_density) {
      this.pushError('population_density')
    }

    // LEADER NAME
    this.normalizeLeaderName()
    if (!this.data[this.activeId].leader) {
      this.pushError('leader')
    }

  }

  normalizeName() {
    if (!this.data[this.activeId].name && this.data[this.activeId].official_name) {
      this.data[this.activeId].name = this.data[this.activeId].official_name
    }
    delete this.data[this.activeId].official_name
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

  normalizePopulationDensity() {
    const keys = [
      'population_density_blank2_km2',
      'population_density_blank1_km2',
      'population_density_urban_km2',
      'population_density_km2',
    ]

    for (const key of keys) {
      const value = this.data[this.activeId][key]
      if (value) {
        this.data[this.activeId].population_density = value
      }
    }

    if (!this.data[this.activeId].population_density && this.data[this.activeId].population && this.data[this.activeId].area_km2) {
      const typePopulation = this.data[this.activeId].population_type
      const typeArea = this.data[this.activeId].area_type
      if (typePopulation === typeArea) {
        this.data[this.activeId].population_density = Number((this.data[this.activeId].population / this.data[this.activeId].area_km2).toFixed(2))
      }
    }

    for (const key of keys) {
      delete this.data[this.activeId][key]
    }
  }

  normalizeLeaderName() {
    const keys = ['leader_name4', 'leader_name3', 'leader_name2', 'leader_name1', 'leader_name']
    for (const key of keys) {
      if (this.data[this.activeId][key] && !this.data[this.activeId][key].includes('mayor')) {
        this.data[this.activeId].leader = this.data[this.activeId][key]
      }

      delete this.data[this.activeId][key]
    }
  }

  parseName() {
    if (!this.infoboxActive() || this.data[this.activeId].name) return
    const regex = /\|\s*((?:official_)?name)\s*=\s*(.*)/i
    const result = this.line.match(regex) || []
    const key = result[1]
    const nameRaw = (result[2] && removeAccents(result[2]).trim()) || null
    if (key && nameRaw) {
      let name = null
      if (/^{{/.test(nameRaw)) {
        /** {{raise|0.2em|Guangzhou}} */
        name = (nameRaw.match(/\|([-.'\w\s]+)}}/i) || [])[1]
      } else {
        name = (nameRaw.match(/^[-.'\w\s]+/i) || [])[0]
      }
      this.data[this.activeId][key] = (name || nameRaw).trim().toLowerCase()
    }
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

  // niektore infoboxy nemali data ale len odkazy z ktorych sa udaje nedali vyparsovat
  parseNumberLine(lineType, stopKey) {
    const regexps = {
      population:   /\|\s*(population_(?:total|urban|blank[12]?))\s*=\s*(.*)/i,
      area:         /\|\s*(area_(?:total|urban|blank[12])_(?:km2|ha|sq_mi|acre))\s*=\s*(.*)/i,
      elevation:    /\|\s*(elevation(?:_max|_min)?_(?:m|ft))\s*=\s*(.*)/i,
      density:      /\|\s*(population_density(?:_urban|_blank[12]?)?_km2)\s*=\s*(.*)/i
    }

    if (!this.infoboxActive() || this.data[this.activeId][stopKey] || !regexps[lineType]) {
      return
    }

    const regex = regexps[lineType]
    const result = this.line.match(regex) || []
    const key = result[1]
    const numRaw = result[2]
    if (key && numRaw) {
      let num = numRaw.replace(/,/g, '')
      num = num.match(/(?:^|\s+)(?:[1-9]\d*(?:\.\d+)?|0\.\d+)/) || []
      this.data[this.activeId][key] = num[0] && Number(num[0])
    }
  }

  parseLeaderName() {
    if (!this.infoboxActive() || this.data[this.activeId].leader_name) return
    const regex = /\|\s*(leader_name[1-4]?)\s*=\s*(.*)/i
    const result = (this.line.match(regex) || [])
    const key = result[1]
    const value = result[2]

    if (key && value) {
      let final = undefined
      // TODO nejak ten apostrof nahradit
      // TODO uoznit aby to bralo aj ludi co maju v mene Filip (F) Loja
      // TODO Usama al-Barr
      // TODO Ilie-Gavril Bolojan
      // [[File:Morena logo (Mexico).svg|MORENA|link=National Regeneration Movement|25px]] [[Claudia Sheinbaum]]
      let name = removeAccents(value).replace(/["’]/gi, '')
      // if (this.activeId === 6710) {
      //   console.log(name)
      //   console.log('_'.repeat(30))
      // }
      // ((?:\w[\w.']*)(?:\s+\w[\w.']*)*) -> format mena, pismena, bodka, apostrof a slova oddelene medzerou
      name = name.match(/(\[\[.+?]])|^((?:\w[\w.']*)(?:\s+\w[\w.']*)*)/i) || []

      if (name[1]) {
        let match = name[1].match(/\[\[.+?\|((?:\w[\w.']*)(?:\s+\w[\w.']*)*)]]/i)
        if (!match) {
          match = name[1].match(/\[\[((?:\w[\w.']*)(?:\s+\w[\w.']*)*)]]/i) || []
        }
        final = match[1]
      }
      if (!final) {
        final = name[2]
      }

      this.data[this.activeId][key] = final && final.toLowerCase()
    }
  }

  // TODO treba refactorovat, chyby odhalit uz pri normalizacii
  analyze() {
    let noErrors = true
    for (const key in this.data) {
      const errors = []

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
    console.log('Parsing finished.')
    fs.writeFileSync(this.outputPath, JSON.stringify(this.data, null, 2), 'utf-8')
    console.log('  ->  file saved: ', this.outputPath)

    console.log('  ->  error log:')
    // this.analyze()

    // for (const key in this.data) {
    //   if (this.data[key].leader) {
    //     console.log(key, this.data[key].leader)
    //   }
    // }

    const processEnd = process.hrtime(this.processStart)
    console.info('  ->  execution time:  %ds %dms.\n', processEnd[0], processEnd[1] / 1000000)
  }

}

module.exports = Parser
