
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Plan = "free" | "pro" | "business";

type Subscription = {
  plan: Plan;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
};

const plans = [
  {
    id: "free" as Plan,
    name: "Free",
    price: 0,
    description: "Essential tools to get your business started.",
    features: [
      "Business dashboard",
      "Sales recording",
      "Product management",
      "Customer records",
      "Expense tracking",
      "Basic reports",
    ],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: 199,
    description: "More control and insight as your business grows.",
    features: [
      "Everything in Free",
      "Advanced business reports",
      "Inventory management",
      "Customer debt tracking",
      "Payment history",
      "Priority support",
    ],
  },
  {
    id: "business" as Plan,
    name: "Business",
    price: 499,
    description: "More tools for growing and managing your business.",
    features: [
      "Everything in Pro",
      "Advanced business insights",
      "Expanded business management tools",
      "Enhanced reporting",
      "Business growth tools",
      "Priority business support",
    ],
  },
];

export default function SubscriptionPage() {
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Please log in to view your subscription.");
        }

        const { data: business, error: businessError } =
          await supabase
            .from("businesses")
            .select("id, business_name")
            .eq("owner_id", user.id)
            .maybeSingle();

        if (businessError) throw businessError;

        if (!business) {
          throw new Error(
            "No business profile found. Please complete your business setup."
          );
        }

        const { data: currentSubscription, error: subError } =
          await supabase
            .from("business_subscriptions")
            .select(
              "plan, status, current_period_start, current_period_end"
            )
            .eq("business_id", business.id)
            .maybeSingle();

        if (subError) throw subError;

        if (!currentSubscription) {
          throw new Error(
            "Your subscription record was not found. Please contact support."
          );
        }

        if (active) {
          setBusinessName(business.business_name);
          setSubscription(currentSubscription as Subscription);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your subscription."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSubscription();

    return () => {
      active = false;
    };
  }, []);

  const currentPlan = subscription?.plan ?? "free";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7f5",
        padding: "30px 16px 50px",
        color: "#183b29",
      }}
    >
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <header
          style={{
            background: "#103522",
            color: "white",
            padding: "22px",
            borderRadius: 14,
            marginBottom: 28,
          }}
        >
          <h1 style={{ fontSize: 25, fontWeight: 800 }}>
            MALI<span style={{ color: "#9bc9a8" }}>KEEP</span>
          </h1>
          <p style={{ color: "#d0e0d5", fontSize: 13 }}>
            Know Your Business. Grow Your Business.
          </p>
        </header>

        <div style={{ marginBottom: 25 }}>
          <Link
            href="/"
            style={{
              color: "#286b47",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Back to Dashboard
          </Link>

          <h2 style={{ fontSize: 27, marginTop: 20 }}>
            Subscription & Plans
          </h2>

          <p style={{ color: "#718078", marginTop: 7 }}>
            Manage your MALIKEEP membership and explore available plans.
          </p>
        </div>

        {loading ? (
          <div style={panelStyle}>
            Loading your subscription...
          </div>
        ) : error ? (
          <div
            style={{
              ...panelStyle,
              color: "#a12d2d",
              background: "#fff1f1",
            }}
          >
            {error}
          </div>
        ) : (
          <>
            <section style={panelStyle}>
              <p style={{ color: "#718078", fontSize: 13 }}>
                BUSINESS ACCOUNT
              </p>

              <h3 style={{ fontSize: 21, margin: "7px 0 15px" }}>
                {businessName}
              </h3>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ color: "#718078", fontSize: 12 }}>
                    CURRENT PLAN
                  </p>
                  <strong style={{ fontSize: 20 }}>
                    {plans.find((p) => p.id === currentPlan)?.name}
                  </strong>
                </div>

                <div>
                  <p style={{ color: "#718078", fontSize: 12 }}>
                    SUBSCRIPTION STATUS
                  </p>
                  <strong style={{ color: "#23834d" }}>
                    {subscription?.status.toUpperCase()}
                  </strong>
                </div>
              </div>

              {subscription?.current_period_end && (
                <p style={{ fontSize: 12, color: "#718078", marginTop: 14 }}>
                  Current period ends:{" "}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString()}
                </p>
              )}
            </section>

            <h2 style={{ fontSize: 21, margin: "30px 0 17px" }}>
              Choose Your Plan
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 17,
              }}
            >
              {plans.map((plan) => {
                const isCurrent = currentPlan === plan.id;

                return (
                  <article
                    key={plan.id}
                    style={{
                      background: "white",
                      border: isCurrent
                        ? "2px solid #286b47"
                        : "1px solid #e1e9e3",
                      borderRadius: 14,
                      padding: 21,
                      boxShadow: "0 4px 15px rgba(20,60,35,0.04)",
                    }}
                  >
                    {isCurrent && (
                      <span
                        style={{
                          display: "inline-block",
                          background: "#e5f3e9",
                          color: "#286b47",
                          padding: "5px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 800,
                          marginBottom: 12,
                        }}
                      >
                        YOUR CURRENT PLAN
                      </span>
                    )}

                    <h3 style={{ fontSize: 23, fontWeight: 800 }}>
                      {plan.name}
                    </h3>

                    <div style={{ margin: "15px 0" }}>
                      <strong style={{ fontSize: 29 }}>
                        KES {plan.price.toLocaleString("en-KE")}
                      </strong>
                      <span style={{ color: "#718078", fontSize: 12 }}>
                        {" "}/ month
                      </span>
                    </div>

                    <p
                      style={{
                        color: "#718078",
                        fontSize: 13,
                        minHeight: 42,
                      }}
                    >
                      {plan.description}
                    </p>

                    <div
                      style={{
                        borderTop: "1px solid #e8eee9",
                        marginTop: 17,
                        paddingTop: 16,
                      }}
                    >
                      <strong style={{ fontSize: 13 }}>
                        Plan features
                      </strong>

                      <ul
                        style={{
                          paddingLeft: 19,
                          marginTop: 12,
                          lineHeight: 2,
                          fontSize: 13,
                          color: "#53665a",
                        }}
                      >
                        {plan.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      disabled
                      style={{
                        width: "100%",
                        padding: 12,
                        marginTop: 18,
                        border: "none",
                        borderRadius: 8,
                        background: isCurrent ? "#e5f3e9" : "#e9eeea",
                        color: isCurrent ? "#286b47" : "#66736a",
                        fontWeight: 800,
                        cursor: "not-allowed",
                      }}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : "M-Pesa Upgrade Coming Soon"}
                    </button>
                  </article>
                );
              })}
            </div>

            <section
              style={{
                ...panelStyle,
                marginTop: 25,
                fontSize: 13,
                color: "#718078",
                lineHeight: 1.8,
              }}
            >
              <strong style={{ color: "#183b29" }}>
                Secure M-Pesa payments
              </strong>
              <p>
                Paid plan upgrades will become available after the
                secure M-Pesa payment system is connected and payment
                confirmation is verified.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const panelStyle = {
  background: "white",
  border: "1px solid #e1e9e3",
  borderRadius: 13,
  padding: 21,
  marginBottom: 20,
};
