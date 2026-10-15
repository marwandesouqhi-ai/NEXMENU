import { describe, expect, it } from "vitest"

import { assessPaymentReceipt } from "./payment-receipt-ocr"

describe("payment receipt OCR checks", () => {
  it("matches the saved transfer number and plan amount", () => {
    expect(
      assessPaymentReceipt(
        "Transfer to 010 6072 3106. Amount EGP 3,000.00",

        "01060723106",

        3000,
      ),
    ).toEqual({
      recipientFound: true,

      amountFound: true,

      looksConsistent: true,
    })
  })

  it("recognizes Arabic-Indic digits and an international phone format", () => {
    expect(
      assessPaymentReceipt(
        "تم التحويل إلى +٢٠ ١٠٦٠٧٢٣١٠٦ بمبلغ ١٬٥٠٠ جنيه",

        "01060723106",

        1500,
      ),
    ).toEqual({
      recipientFound: true,

      amountFound: true,

      looksConsistent: true,
    })
  })

  it("does not treat an amount embedded in a reference as a match", () => {
    expect(
      assessPaymentReceipt(
        "Reference TXN30001234 to TXN01060723106X",
        "01060723106",
        3000,
      ),
    ).toEqual({
      recipientFound: false,
      amountFound: false,

      looksConsistent: false,
    })
  })

  it("requires both details before reporting a likely match", () => {
    expect(
      assessPaymentReceipt(
        "Transferred to 01060723106, amount 1500 EGP",
        "01060723106",
        3000,
      ),
    ).toEqual({
      recipientFound: true,

      amountFound: false,

      looksConsistent: false,
    })
  })
})
