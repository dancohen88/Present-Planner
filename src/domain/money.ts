// Money is stored as an integer number of pence, never as fractional pounds.
// Floats can't represent most decimals exactly (0.1 + 0.2 !== 0.3), so sums of
// prices drift. Integers in the smallest unit don't.

const POUNDS_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/

/** Parses user input like "12", "12.5", "£1,200.99" into pence. Returns null if it isn't a valid amount. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '')
  const match = POUNDS_PATTERN.exec(cleaned)
  if (!match) return null
  const pounds = Number(match[1])
  const pence = Number((match[2] ?? '').padEnd(2, '0'))
  return pounds * 100 + pence
}

const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

export function formatPence(pence: number): string {
  return formatter.format(pence / 100)
}
