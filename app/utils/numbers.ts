import BigNumber from 'bignumber.js'

export * from './randomizers'

const notEmpty = <T extends string | number | bigint | null | undefined>(
  value: T
): value is Exclude<T, undefined | null | ''> =>
  value !== undefined && value !== null && value.toString().trim() !== ''

/**
 * This function formats a numberic value as a currency using the Internationalization API
 * @param value - The value to format
 * @param currency - The currency to use
 * @returns The formatted currency value
 */
export function formatCurrency(value?: number | string, currency: string = 'USD') {
  return notEmpty(value)
    ? formatNumber(value, { style: 'currency', currency })
    : undefined
}

/**
 * This function formats a numberic value as a percentage using the Internationalization API
 * @param value - The value to format
 * @param maximumFractionDigits - The maximum amount of decimal places to render
 * @returns The formatted percentage value
 */
export function formatPercentage(value?: number | string, maximumFractionDigits = 2) {
  return notEmpty(value)
    ? formatNumber(value, { style: 'percent', maximumFractionDigits })
    : undefined
}

function parseNumber(number: number | string | bigint) {
  return typeof number === 'string'
    ? number.includes('.')
      ? parseFloat(number)
      : parseInt(number, 10)
    : typeof number === 'bigint'
      ? Number(number)
      : number
}

export function formatNumber(
  number: number | string | bigint,
  props?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat('en-US', props).format(parseNumber(number))
}

/**
 *
 * Only works on web currently but flexibly shortens any kind of number (integer or decimal)
 */
export function shortenNumber(number: number | string | bigint) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' })
    .format(parseNumber(number))
    .toLowerCase()
}

/**
 * For React Native/non-web environments only
 *
 * Ideally we'd use `Intl.NumberFormat` to format numbers with compact display
 * but it's not supported in Hermes for React Native and the polyfill has
 * really slow performance so just reimplemented instead
 */
export function shortenInteger(number: number | string) {
  const parsedNumber = parseNumber(number)
  if (parsedNumber < 1e3) {
    return parsedNumber.toString()
  } else if (parsedNumber < 1e6) {
    return Math.floor(parsedNumber / 1e2) / 10 + 'k' // Formats thousands
  } else if (parsedNumber < 1e9) {
    return Math.floor(parsedNumber / 1e5) / 10 + 'm' // Formats millions
  } else {
    return Math.floor(parsedNumber / 1e8) / 10 + 'b' // Formats billions
  }
}

/**
 * The default maximum precision for formatting decimal numbers. The value is derived from web.
 */
const MAX_PRECISION = 6

/**
 * Format a number with a limited amount of decimals places
 *
 * @remarks
 * Rounds the last decimal place and removes any trailing zeros.
 * The amount of decimal places is called `precision` to avoid confusion
 * with the `decimals` property of token denominations.
 * NOTE: This method does not handle converting token (wei) amounts into
 * decimal representations - use `formatUnits` for this.
 *
 * @param value - the number to format
 * @param precision - the maximum amount of decimal places
 * @returns The formatted number as a string
 */
export const roundDecimal = (value: string | number, precision = MAX_PRECISION) => {
  return parseNumber(value)
    .toFixed(precision)
    .replace(/\.?0+$/, '')
}

const ONE_QUADRILLION = new BigNumber(1000000000000000)
const ONE_TRILLION = new BigNumber(1000000000000)
const ONE_BILLION = new BigNumber(1000000000)
const ONE_MILLION = new BigNumber(1000000)
const ONE_HUNDRED_THOUSAND = new BigNumber(100000)
const TEN_THOUSAND = new BigNumber(10000)
const ONE_THOUSAND = new BigNumber(1000)
const ONE_HUNDRED = new BigNumber(100)
const TEN = new BigNumber(10)
const ONE = new BigNumber(1)
const ONE_MILLIONTH = new BigNumber(0.000001)

function formatCryptoValUnder100K(amount: BigNumber) {
  const formattedVal = amount.isInteger()
    ? amount.toFormat(0)
    : amount.isGreaterThan(TEN_THOUSAND)
      ? amount.precision(7).decimalPlaces(2).toFormat()
      : amount.isGreaterThan(ONE_THOUSAND)
        ? amount.precision(6).decimalPlaces(2)
        : amount.isGreaterThan(ONE_HUNDRED)
          ? amount.precision(6).decimalPlaces(3)
          : amount.isGreaterThan(TEN)
            ? amount.precision(6).decimalPlaces(4)
            : amount.isGreaterThan(ONE)
              ? amount.precision(6).decimalPlaces(5)
              : amount.isGreaterThanOrEqualTo(ONE_MILLIONTH)
                ? amount.precision(6).decimalPlaces(6)
                : `<${ONE_MILLIONTH}` // otherwise we'll get output like '1e-18'
  return formattedVal.toString()
}

function formatCryptoValFrom100Kto1Quadrillion(amount: BigNumber) {
  return amount.isGreaterThan(ONE_TRILLION)
    ? `${amount.dividedBy(ONE_TRILLION).decimalPlaces(2).toString()}T`
    : amount.isGreaterThan(ONE_BILLION)
      ? `${amount.dividedBy(ONE_BILLION).decimalPlaces(2).toString()}B`
      : amount.isGreaterThan(ONE_MILLION)
        ? `${amount.dividedBy(ONE_MILLION).decimalPlaces(2).toString()}M`
        : `${amount.dividedBy(ONE_THOUSAND).decimalPlaces(2).toString()}k`
}

/**
 *  Formats a value for pretty display
 * @param cryptoVal Raw, unformatted value, a wei bigint
 * @param decimals number, representing decimals of token
 * @returns Formatted string showing the ETH value
 */
export function formatCryptoVal(cryptoVal: bigint, decimals: number = 18) {
  const parsedamount = new BigNumber(cryptoVal.toString()).shiftedBy(-decimals)
  return parsedamount.isGreaterThan(ONE_QUADRILLION)
    ? parsedamount.toExponential(2).toString().replace('e+', 'ᴇ')
    : parsedamount.isGreaterThanOrEqualTo(ONE_HUNDRED_THOUSAND)
      ? formatCryptoValFrom100Kto1Quadrillion(parsedamount)
      : formatCryptoValUnder100K(parsedamount)
}

export function safeBigInt(
  value: string | number | bigint | null | undefined,
  defaultValue: bigint
): bigint {
  if (value == null) return defaultValue
  try {
    return BigInt(value)
  } catch {
    return defaultValue
  }
}
