
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PLAN_PRICES = {
  pro: 199,
  business: 499,
} as const;

type PaidPlan = keyof typeof PLAN_PRICES;

function normalizePhone(value: string) {
  let phone = value.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  } else if (phone.startsWith("7") || phone.startsWith("1")) {
    phone = "254" + phone;
  }

  if (!/^254[17]\d{8}$/.test(phone)) {
    throw new Error(
      "Enter a valid Kenyan M-Pesa number, e.g. 0712345678."
    );
  }

  return phone;
}

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

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in before making a payment." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const plan = body.plan as PaidPlan;

    if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)) {
      return NextResponse.json(
        { error: "Choose a valid paid plan." },
        { status: 400 }
      );
    }

    const phone = normalizePhone(
      String(body.phoneNumber ?? "")
    );

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) throw businessError;

    if (!business) {
      return NextResponse.json(
        { error: "Your business profile was not found." },
        { status: 404 }
      );
    }

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabase
      .from("business_subscriptions")
      .select("plan, status, current_period_end")
      .eq("business_id", business.id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    if (!subscription) {
      return NextResponse.json(
        { error: "Your subscription record was not found." },
        { status: 404 }
      );
    }

    const subscriptionStillActive =
      subscription.status === "active" &&
      (
        !subscription.current_period_end ||
        new Date(subscription.current_period_end) > new Date()
      );

    if (
      subscriptionStillActive &&
      (
        subscription.plan === "business" ||
        subscription.plan === plan
      )
    ) {
      return NextResponse.json(
        {
          error: `Your ${subscription.plan} plan is already active.`,
        },
        { status: 409 }
      );
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const environment = process.env.MPESA_ENVIRONMENT;

    if (
      !consumerKey ||
      !consumerSecret ||
      !shortcode ||
      !passkey ||
      !callbackUrl
    ) {
      throw new Error(
        "M-Pesa server configuration is incomplete."
      );
    }

    if (
      environment !== "sandbox" &&
      environment !== "production"
    ) {
      throw new Error(
        "Invalid M-Pesa environment configuration."
      );
    }

    if (!callbackUrl.startsWith("https://")) {
      throw new Error(
        "The M-Pesa callback must use HTTPS."
      );
    }

    const baseUrl =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const timestamp = getNairobiTimestamp();

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    const basicAuth = Buffer.from(
      consumerKey + ":" + consumerSecret
    ).toString("base64");

    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
        cache: "no-store",
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error(
        "Daraja token request failed:",
        tokenData
      );

      return NextResponse.json(
        {
          error: "Unable to authenticate with M-Pesa.",
        },
        { status: 502 }
      );
    }

    const amount = PLAN_PRICES[plan];

    const {
      data: payment,
      error: paymentError,
    } = await supabaseAdmin
      .from("subscription_payments")
      .insert({
        business_id: business.id,
        owner_id: user.id,
        plan,
        amount,
        currency: "KES",
        phone_number: phone,
        status: "pending",
      })
      .select("id")
      .single();

    if (paymentError) throw paymentError;

    const stkResponse = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: amount,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: "MALIKEEP",
          TransactionDesc:
            plan === "pro"
              ? "MALIKEEP PRO"
              : "MALIKEEP BIZ",
        }),
        cache: "no-store",
      }
    );

    const stkData = await stkResponse.json();

    if (
      !stkResponse.ok ||
      stkData.ResponseCode !== "0" ||
      !stkData.CheckoutRequestID
    ) {
      await supabaseAdmin
        .from("subscription_payments")
        .update({
          status: "failed",
          result_description:
            stkData.errorMessage ||
            stkData.ResponseDescription ||
            "M-Pesa request failed.",
        })
        .eq("id", payment.id);

      console.error(
        "STK Push request failed:",
        stkData
      );

      return NextResponse.json(
        {
          error:
            stkData.errorMessage ||
            stkData.ResponseDescription ||
            "M-Pesa could not initiate the payment.",
        },
        { status: 502 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscription_payments")
      .update({
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id:
          stkData.MerchantRequestID ?? null,
      })
      .eq("id", payment.id);

    if (updateError) {
      console.error(
        "Unable to save STK request IDs:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Payment request was sent but could not be fully recorded. Contact support before retrying.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      message:
        stkData.CustomerMessage ||
        "Payment request sent. Check your phone.",
    });
  } catch (error) {
    console.error("M-Pesa STK Push error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initiate M-Pesa payment.",
      },
      { status: 500 }
    );
  }
}
