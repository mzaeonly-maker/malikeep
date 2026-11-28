
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getNairobiTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return (
    part("year") +
    part("month") +
    part("day") +
    part("hour") +
    part("minute") +
    part("second")
  );
}

async function getMpesaAccessToken(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
) {
  const credentials = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString("base64");

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error("Unable to authenticate with M-Pesa.");
  }

  return data.access_token as string;
}

function getMetadataValue(
  items: Array<{ Name?: string; Value?: unknown }>,
  name: string
) {
  const item = items.find(
    (entry) => entry.Name === name
  );

  return item?.Value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Invalid callback payload." },
        { status: 400 }
      );
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;
    const callbackResultCode = Number(callback.ResultCode);
    const callbackDescription =
      String(callback.ResultDesc ?? "M-Pesa payment result.");

    if (
      !checkoutRequestId ||
      !merchantRequestId ||
      !Number.isInteger(callbackResultCode)
    ) {
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Missing transaction details." },
        { status: 400 }
      );
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const environment = process.env.MPESA_ENVIRONMENT;

    if (
      !consumerKey ||
      !consumerSecret ||
      !shortcode ||
      !passkey
    ) {
      throw new Error("M-Pesa configuration is incomplete.");
    }

    if (
      environment !== "sandbox" &&
      environment !== "production"
    ) {
      throw new Error("Invalid M-Pesa environment.");
    }

    const baseUrl =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const timestamp = getNairobiTimestamp();

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    const accessToken = await getMpesaAccessToken(
      baseUrl,
      consumerKey,
      consumerSecret
    );

    // Verify the transaction directly with Safaricom.
    const queryResponse = await fetch(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
        cache: "no-store",
      }
    );

    const queryData = await queryResponse.json();

    if (
      !queryResponse.ok ||
      queryData.CheckoutRequestID !== checkoutRequestId ||
      queryData.MerchantRequestID !== merchantRequestId ||
      Number(queryData.ResultCode) !== callbackResultCode
    ) {
      console.error(
        "M-Pesa transaction verification failed:",
        queryData
      );

      // Leave the payment pending. Never activate an
      // unverified transaction.
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: "Callback received. Transaction verification is pending.",
      });
    }

    let amount: number | null = null;
    let phoneNumber: string | null = null;
    let receiptNumber: string | null = null;

    if (callbackResultCode === 0) {
      const metadata =
        callback.CallbackMetadata?.Item;

      if (!Array.isArray(metadata)) {
        throw new Error("Successful payment has no callback metadata.");
      }

      const amountValue = getMetadataValue(metadata, "Amount");
      const phoneValue = getMetadataValue(metadata, "PhoneNumber");
      const receiptValue = getMetadataValue(
        metadata,
        "MpesaReceiptNumber"
      );

      amount = Number(amountValue);
      phoneNumber =
        phoneValue === undefined ? null : String(phoneValue);
      receiptNumber =
        receiptValue === undefined ? null : String(receiptValue);

      if (
        !Number.isFinite(amount) ||
        !phoneNumber ||
        !receiptNumber
      ) {
        throw new Error("Payment metadata is incomplete.");
      }

      phoneNumber = phoneNumber.replace(/\D/g, "");
    }

    // This database function checks the pending payment,
    // matches the transaction details and activates the plan.
    const { data: activated, error: activationError } =
      await supabaseAdmin.rpc(
        "activate_mpesa_subscription",
        {
          p_checkout_request_id: checkoutRequestId,
          p_merchant_request_id: merchantRequestId,
          p_result_code: callbackResultCode,
          p_result_description:
            String(queryData.ResultDesc ?? callbackDescription),
          p_amount: amount,
          p_phone_number: phoneNumber,
          p_receipt_number: receiptNumber,
        }
      );

    if (activationError) {
      console.error(
        "Subscription activation error:",
        activationError
      );

      throw activationError;
    }

    if (!activated) {
      console.error(
        "Payment did not match a pending subscription:",
        checkoutRequestId
      );
    }

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: activated
        ? "Payment result processed."
        : "Callback received. Payment could not be matched.",
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });
  }
}
