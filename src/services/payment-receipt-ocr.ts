import { createWorker } from "tesseract.js"

let workerPromise: ReturnType<typeof createWorker> | null = null

export interface PaymentReceiptText {
  text: string

  confidence: number
}

export interface PaymentReceiptAssessment {
  recipientFound: boolean

  amountFound: boolean

  looksConsistent: boolean
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(["eng", "ara"]).catch((error: unknown) => {
      workerPromise = null

      throw error
    })
  }

  return workerPromise
}

export async function readPaymentReceipt(
  image: Blob,
): Promise<PaymentReceiptText> {
  const worker = await getWorker()

  const result = await worker.recognize(image)

  return { text: result.data.text, confidence: result.data.confidence }
}

export async function readPaymentReceiptUrl(
  url: string,
): Promise<PaymentReceiptText> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Could not load payment receipt (HTTP ${response.status}).`)
  }

  return readPaymentReceipt(await response.blob())
}

function normalizeDigits(value: string) {
  return value

    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))

    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function recipientAppearsInText(text: string, recipientNumber: string) {
  const normalizedText = normalizeDigits(text)

  const digits = normalizeDigits(recipientNumber).replace(/\D/g, "")

  if (!digits) return false

  const variants = new Set([digits])

  if (digits.startsWith("0")) variants.add(`20${digits.slice(1)}`)

  if (digits.startsWith("20")) variants.add(`0${digits.slice(2)}`)

  return [...variants].some((variant) => {
    const pattern = [...variant].map(escapeRegExp).join("[\\s().+/-]*")
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`,
      "u",
    ).test(normalizedText)
  })
}

function parseAmountToken(token: string) {
  const normalized = normalizeDigits(token)

    .replace(/[٬,]/g, ",")

    .replace(/[٫]/g, ".")

    .replace(/\s/g, "")

  const lastSeparator = Math.max(
    normalized.lastIndexOf(","),
    normalized.lastIndexOf("."),
  )

  const trailingDigits =
    lastSeparator === -1 ? 0 : normalized.length - lastSeparator - 1

  if (trailingDigits > 0 && trailingDigits <= 2) {
    const integer = normalized.slice(0, lastSeparator).replace(/[,.]/g, "")

    const fraction = normalized.slice(lastSeparator + 1)

    return Number(`${integer}.${fraction}`)
  }

  return Number(normalized.replace(/[,.]/g, ""))
}

function amountAppearsInText(text: string, expectedAmount: number) {
  const normalizedText = normalizeDigits(text)

  const tokens =
    normalizedText.match(
      /(?<![\p{L}\p{N}])\d{1,3}(?:[,.٬ ]\d{3})+(?:[.,٫]\d{1,2})?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\d+(?:[.,٫]\d{1,2})?(?![\p{L}\p{N}])/gu,
    ) ?? []

  return tokens.some((token) => {
    const amount = parseAmountToken(token)

    return Number.isFinite(amount) && Math.abs(amount - expectedAmount) < 0.005
  })
}

export function assessPaymentReceipt(
  text: string,

  recipientNumber: string,

  expectedAmount: number,
): PaymentReceiptAssessment {
  const recipientFound = recipientAppearsInText(text, recipientNumber)

  const amountFound = amountAppearsInText(text, expectedAmount)

  return {
    recipientFound,

    amountFound,

    looksConsistent: recipientFound && amountFound,
  }
}
