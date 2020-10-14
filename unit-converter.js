
const converter = function () {

  const toKm2 = {
    'sq-mi': 2.58998811,
    'ha': 0.01,
    'acre': 0.00404685642
  }

  const toM = {
    'ft': 0.3048
  }

  return {
    convertToKm2: (unit, num) => {
      if (!(unit in toKm2) || !num) return -1
      const conversion = (num * toKm2[unit]).toFixed(2)
      return Number(conversion)
    },

    convertToM: (unit, num) => {
      if (!(unit in toM) || !num) return -1
      const conversion = (num * toM[unit]).toFixed(2)
      return Number(conversion)
    }
  }

}

module.exports = converter()
