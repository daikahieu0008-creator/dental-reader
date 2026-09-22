/**
 * Quality Verification Checker for DentalAI Reader
 * 
 * Verifies that all numbers with units in the AI summary actually exist
 * in the original source article to prevent clinical hallucinations.
 */

export interface NumberUnitMatch {
  raw: string
  number: string
  unit: string
  indexInSummary: number
  matchedInSource: boolean
}

export interface VerificationResult {
  isConsistent: boolean
  totalChecked: number
  mismatches: NumberUnitMatch[]
  matches: NumberUnitMatch[]
  warningMessage?: string
}

// Regex to capture numbers with dental and general clinical units
// Examples: 5.25%, 2.5 mm, 30G, 17%, 3 tháng, 20 giây, 300 rpm, 37°C, 35 Ncm
const NUMBER_UNIT_REGEX =
  /\b(\d+(?:[.,]\d+)?)\s*(%|‰|mm|cm|m|µm|micromet|ml|l|mg|g|µg|kg|giây|s|phút|min|h|giờ|ngày|tuần|tháng|năm|°c|độ c|độ|mpa|kpa|bar|psi|ncm|n|rpm|vòng\/phút|gauge|g)(?!\w)/gi

/**
 * Normalizes text for comparison (replaces commas in decimals with dots, removes extra spaces)
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d+),(\d+)/g, "$1.$2") // "5,25" -> "5.25"
    .replace(/\s+/g, " ")
}

export function verifySummaryNumbers(
  summaryText: string,
  sourceArticleText: string,
): VerificationResult {
  if (!summaryText || !sourceArticleText) {
    return {
      isConsistent: true,
      totalChecked: 0,
      mismatches: [],
      matches: [],
    }
  }

  const normalizedSource = normalizeForSearch(sourceArticleText)
  const matches: NumberUnitMatch[] = []
  const mismatches: NumberUnitMatch[] = []

  let regexMatch: RegExpExecArray | null

  // Reset regex state
  NUMBER_UNIT_REGEX.lastIndex = 0

  while ((regexMatch = NUMBER_UNIT_REGEX.exec(summaryText)) !== null) {
    const raw = regexMatch[0]
    const num = regexMatch[1].replace(",", ".")
    const unit = regexMatch[2].toLowerCase()

    const normalizedTerm = `${num} ${unit}`
    const tightTerm = `${num}${unit}`

    // Check if the exact term or the number is found in the source article
    const inSourceExact =
      normalizedSource.includes(normalizedTerm) ||
      normalizedSource.includes(tightTerm) ||
      normalizedSource.includes(`${regexMatch[1]} ${unit}`) ||
      normalizedSource.includes(`${regexMatch[1]}${unit}`)

    // Check if at least the exact number appears anywhere in the source
    const numberOnlyRegex = new RegExp(`\\b${num.replace(".", "\\.")}\\b`, "i")
    const numberInSource = numberOnlyRegex.test(normalizedSource)

    const isMatch = inSourceExact || numberInSource

    const item: NumberUnitMatch = {
      raw,
      number: num,
      unit,
      indexInSummary: regexMatch.index,
      matchedInSource: isMatch,
    }

    if (isMatch) {
      matches.push(item)
    } else {
      mismatches.push(item)
    }
  }

  const isConsistent = mismatches.length === 0
  const warningMessage = !isConsistent
    ? `Phát hiện ${mismatches.length} thông số (${mismatches.map((m) => m.raw).join(", ")}) chưa đối chiếu được trong bài gốc. Bác sĩ vui lòng kiểm tra lại.`
    : undefined

  return {
    isConsistent,
    totalChecked: matches.length + mismatches.length,
    mismatches,
    matches,
    warningMessage,
  }
}
