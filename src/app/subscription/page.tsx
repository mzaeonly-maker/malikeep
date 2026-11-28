
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

type Usage = {
  products: number;
  customers: number;
  sales: number;
};

const plans = [
  {
    id: "free" as Plan,
    name: "Free",
    price: 0,
    description: "Essential tools to get your business started.",
    features: [
      "1 business account",
      "Up to 50 products",
      "Up to 100 sales per month",
      "Up to 50 customers",
      "Business dashboard",
      "Basic reports",
      "Sales and expense tracking",
    ],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: 199,
    description: "More control and insight as your business grows.",
    features: [
      "Everything in Free",
      "Up to 500 products",
      "Up to 1,000 sales per month",
      "Up to 500 customers",
      "Inventory management",
      "Stock movement history",
      "Customer debts and payments",
      "Advanced reports",
    ],
  },
  {
    id: "business" as Plan,
    name: "Business",
    price: 499,
    description: "For established and expanding businesses.",
    features: [
      "Everything in Pro",
      "Unlimited products",
      "Unlimited sales",
      "Unlimited customers",
      "Advanced business insights",
      "Expanded reporting",
      "Priority support",
    ],
  },
];

const limits: Record<Plan, Usage> = {
  free: {
    products: 50,
    customers: 50,
    sales: 100,
  },
  pro: {
    products: 500,
    customers: 500,
    sales: 1000,
  },
  business: {
    products: Infinity,
    customers: Infinity,
    sales: Infinity,
  },
};

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e1e9e3",
  borderRadius: 13,
  padding: 21,
  marginBottom: 20,
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [usage, setUsage] = useState<Usage>({
    products: 0,
    customers: 0,
    sales: 0,
  });

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

        const now = new Date();
        const monthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );
        const nextMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          1
        );

        const [
          productsResult,
          customersResult,
          salesResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("business_id", business.id),

          supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("business_id", business.id),

          supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .eq("business_id", business.id)
            .gte("created_at", monthStart.toISOString())
            .lt("created_at", nextMonth.toISOString()),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (customersResult.error) throw customersResult.error;
        if (salesResult.error) throw salesResult.error;

        if (active) {
          setBusinessName(business.business_name);

          setSubscription(
            currentSubscription as Subscription
          );

          setUsage({
            products: productsResult.count ?? 0,
            customers: customersResult.count ?? 0,
            sales: salesResult.count ?? 0,
          });
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

  const now = new Date();

  const subscriptionIsValid =
    subscription?.status === "active" &&
    (
      !subscription.current_period_end ||
      new Date(subscription.current_period_end) > now
    );

  const currentPlan: Plan =
    subscriptionIsValid &&
    ["free", "pro", "business"].includes(subscription?.plan ?? "")
      ? subscription!.plan
      : "free";

  const currentLimits = limits[currentPlan];

  const usageItems = [
    {
      name: "Products",
      value: usage.products,
      limit: currentLimits.products,
    },
    {
      name: "Customers",
      value: usage.customers,
      limit: currentLimits.customers,
    },
    {
      name: "Sales this month",
      value: usage.sales,
      limit: currentLimits.sales,
    },
  ];

  function usagePercentage(value: number, limit: number) {
    if (!Number.isFinite(limit)) return 0;
    if (limit === 0) return 0;

    return Math.min((value / limit) * 100, 100);
  }

  function usageLabel(value: number, limit: number) {
    return Number.isFinite(limit)
      ? `${value.toLocaleString("en-KE")} / ${limit.toLocaleString("en-KE")}`
      : `${value.toLocaleString("en-KE")} / Unlimited`;
  }

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
            padding: 22,
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
            Manage your MALIKEEP membership and monitor your usage.
          </p>
        </div>

        {loading ? (
          <div style={panelStyle}>
            Loading your subscription and usage...
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
                  gap: 15,
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

                  <strong
                    style={{
                      color: subscriptionIsValid ? "#23834d" : "#a12d2d",
                    }}
                  >
                    {subscriptionIsValid ? "ACTIVE" : "EXPIRED / INACTIVE"}
                  </strong>
                </div>
              </div>

              {subscription?.current_period_end && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#718078",
                    marginTop: 14,
                  }}
                >
                  Current period ends:{" "}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString("en-KE")}
                </p>
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={{ fontSize: 21, marginBottom: 7 }}>
                Your Business Usage
              </h2>

              <p
                style={{
                  color: "#718078",
                  fontSize: 13,
                  marginBottom: 22,
                }}
              >
                Your usage compared with your current plan limits.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: 20,
                }}
              >
                {usageItems.map((item) => {
                  const percentage = usagePercentage(
                    item.value,
                    item.limit
                  );

                  const reached =
                    Number.isFinite(item.limit) &&
                    item.value >= item.limit;

                  return (
                    <div
                      key={item.name}
                      style={{
                        background: "#f7faf7",
                        border: "1px solid #e5ede6",
                        borderRadius: 11,
                        padding: 16,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          color: "#718078",
                          marginBottom: 9,
                        }}
                      >
                        {item.name}
                      </p>

                      <strong
                        style={{
                          fontSize: 22,
                          color: reached ? "#b33b32" : "#183b29",
                        }}
                      >
                        {usageLabel(item.value, item.limit)}
                      </strong>

                      <div
                        style={{
                          height: 9,
                          background: "#e5ece6",
                          borderRadius: 20,
                          overflow: "hidden",
                          marginTop: 13,
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background: reached ? "#c94b42" : "#31945a",
                            borderRadius: 20,
                          }}
                        />
                      </div>

                      <p
                        style={{
                          fontSize: 11,
                          color: reached ? "#b33b32" : "#718078",
                          marginTop: 9,
                        }}
                      >
                        {!Number.isFinite(item.limit)
                          ? "No usage limit"
                          : reached
                            ? "Plan limit reached"
                            : `${Math.max(
                                item.limit - item.value,
                                0
                              ).toLocaleString("en-KE")} remaining`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {usageItems.some(
                (item) =>
                  Number.isFinite(item.limit) &&
                  item.value >= item.limit
              ) && (
                <div
                  style={{
                    background: "#fff5e9",
                    color: "#87531d",
                    padding: 14,
                    borderRadius: 9,
                    marginTop: 20,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  <strong>You've reached a plan limit.</strong>
                  <p>
                    Upgrade your subscription to increase your available
                    business capacity.
                  </p>
                </div>
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
                Paid plan upgrades will become available after the secure
                M-Pesa payment system is connected and payment confirmation
                is verified.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
