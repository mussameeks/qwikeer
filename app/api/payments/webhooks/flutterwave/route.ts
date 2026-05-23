import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    console.log("Flutterwave webhook received:", payload)

    return NextResponse.json(
      {
        ok: true,
        message: "Webhook received",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Flutterwave webhook error:", error)

    return NextResponse.json(
      {
        ok: false,
        message: "Invalid webhook payload",
      },
      { status: 400 }
    )
  }
}
