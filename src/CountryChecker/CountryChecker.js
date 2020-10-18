
const fs = require('fs')
const path = require('path')

/** https://countrycode.org/ */
class CountryChecker {

  constructor() {
    this.countryListArr = JSON.parse(fs.readFileSync(path.join(__dirname, 'country_list.json'), 'utf-8'))
    this.countryListSet = new Set(this.countryListArr)

    const tmpCodeMap2 = JSON.parse(fs.readFileSync(path.join(__dirname,'country_codes1.json'), 'utf-8'))
    const tmpCodeMap3 = JSON.parse(fs.readFileSync(path.join(__dirname,'country_codes2.json'), 'utf-8'))
    const tmpCodeMapReversed = JSON.parse(fs.readFileSync(path.join(__dirname,'country_codes_reversed.json'), 'utf-8'))

    this.codeMap2 = new Map(Object.entries(tmpCodeMap2))
    this.codeMap3 = new Map(Object.entries(tmpCodeMap3))
    this.codeMapReversed = new Map(Object.entries(tmpCodeMapReversed))
  }

  formatResult(countryName) {
    const codes = this.codeMapReversed.get(countryName)
    return [countryName, ...codes].join('; ')
  }

  countryFromCode(code) {
    if (!code || typeof code !== 'string') return null
    const transformedCode = code.trim().toLowerCase()

    if (transformedCode.length === 2 && this.codeMap2.has(transformedCode)) {
      const country = this.codeMap2.get(transformedCode)
      return this.formatResult(country)
    }

    if (transformedCode.length === 3 && this.codeMap3.has(transformedCode)) {
      const country = this.codeMap3.get(transformedCode)
      return this.formatResult(country)
    }

    return null
  }

  searchCountry(countryTerm, activeId = null) {
    for (const countryName of this.countryListArr) {
      if (countryName.includes(countryTerm) || countryTerm.includes(countryName)) {
        // console.log('brute force search (S)', countryTerm, activeId)
        return this.formatResult(countryName)
      }
    }

    // console.log('brute force search (F)', countryTerm, activeId)
    return null
  }

  validateCountry(countryTermRaw, activeId = null) {
    if (!countryTermRaw || typeof countryTermRaw !== 'string') return null
    const countryTerm = countryTermRaw.trim().toLowerCase()

    if (countryTerm.length <= 3) {
      return this.countryFromCode(countryTerm)
    }

    if (this.countryListSet.has(countryTerm)) {
      return this.formatResult(countryTerm)
    }

    return this.searchCountry(countryTerm, activeId)
  }

}

module.exports = CountryChecker
