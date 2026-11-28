
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Business = {
  id: string;
  business_name: string;
};

type Product = {
  id: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  buying_price: number | string;
  selling_price: number | string;
  quantity: number | string;
  low_stock_threshold: number | string;
};

type Plan = "free" | "pro" | "business";

type Subscription = {
  plan: Plan;
  status: string;
  current_period_end: string | null;
};

export default function ProductsPage() {
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [plan, setPlan] = useState<Plan>("free");

  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [limitError, setLimitError] = useState(false);

  const [form, setForm] = useState({
    product_name: "",
    sku: "",
    category: "",
    unit: "pcs",
    buying_price: "",
    selling_price: "",
    quantity: "0",
    low_stock_threshold: "5"
  });

  const productLimit =
    plan === "free" ? 50 :
    plan === "pro" ? 500 :
    null;

  const isAtLimit =
    productLimit !== null && products.length >= productLimit;

  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: businessError } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (businessError) {
        setError(businessError.message);
        setLoading(false);
        return;
      }

      const businessList = (data || []) as Business[];
      setBusinesses(businessList);

      if (businessList.length > 0) {
        setBusinessId(businessList[0].id);
      } else {
        setError("No business found. Please complete Business Setup first.");
      }

      setLoading(false);
    }

    loadBusinesses();
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadProductsAndPlan() {
      if (!businessId) {
        setProducts([]);
        setPlan("free");
        return;
      }

      setProductsLoading(true);
      setError("");
      setMessage("");
      setLimitError(false);

      const [productResult, subscriptionResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .order("product_name", { ascending: true }),

        supabase
          .from("business_subscriptions")
          .select("plan, status, current_period_end")
          .eq("business_id", businessId)
          .maybeSingle()
      ]);

      if (cancelled) return;

      if (productResult.error) {
        setError(productResult.error.message);
        setProductsLoading(false);
        return;
      }

      setProducts((productResult.data || []) as Product[]);

      if (subscriptionResult.error) {
        setError(
          "Unable to load your subscription details. Your database limits remain protected."
        );
        setPlan("free");
      } else {
        const subscription =
          subscriptionResult.data as Subscription | null;

        const subscriptionIsValid =
          subscription?.status === "active" &&
          (
            !subscription.current_period_end ||
            new Date(subscription.current_period_end).getTime() > Date.now()
          );

        const currentPlan: Plan =
          subscriptionIsValid &&
          (
            subscription.plan === "pro" ||
            subscription.plan === "business"
          )
            ? subscription.plan
            : "free";

        setPlan(currentPlan);
      }

      setProductsLoading(false);
    }

    loadProductsAndPlan();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLimitError(false);

    if (!businessId) {
      setError("Please select a business first.");
      return;
    }

    if (productLimit !== null && products.length >= productLimit) {
      setLimitError(true);
      setError(
        `You've reached the ${productLimit}-product limit on the ${plan.toUpperCase()} plan.`
      );
      return;
    }

    const buyingPrice = Number(form.buying_price);
    const sellingPrice = Number(form.selling_price);
    const quantity = Number(form.quantity);
    const threshold = Number(form.low_stock_threshold);

    if (
      !form.product_name.trim() ||
      form.buying_price === "" ||
      form.selling_price === "" ||
      !Number.isFinite(buyingPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(threshold) ||
      buyingPrice < 0 ||
      sellingPrice < 0 ||
      quantity < 0 ||
      threshold < 0
    ) {
      setError("Please enter valid product details and amounts.");
      return;
    }

    setSaving(true);

    const { error: saveError } = await supabase
      .from("products")
      .insert({
        business_id: businessId,
        product_name: form.product_name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        unit: form.unit,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        quantity,
        low_stock_threshold: threshold
      });

    if (saveError) {
      const limitMatch = saveError.message.match(
        /Your\s+(free|pro)\s+plan allows a maximum of\s+(\d+)\s+products/i
      );

      if (limitMatch) {
        const rejectedPlan = limitMatch[1].toUpperCase();
        const rejectedLimit = limitMatch[2];

        setLimitError(true);
        setError(
          `You've reached the ${rejectedLimit}-product limit on the ${rejectedPlan} plan. Upgrade your plan to add more products.`
        );
      } else {
        setError(saveError.message);
      }

      setSaving(false);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .order("product_name", { ascending: true });

    if (refreshError) {
      setError(
        "Product was saved, but the inventory list could not refresh. Please reload the page."
      );
    } else {
      setProducts((data || []) as Product[]);
      setMessage("Product saved successfully!");

      setForm({
        product_name: "",
        sku: "",
        category: "",
        unit: "pcs",
        buying_price: "",
        selling_price: "",
        quantity: "0",
        low_stock_threshold: "5"
      });
    }

    setSaving(false);
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #d5ded7",
    borderRadius: "8px",
    fontSize: "14px",
    marginTop: "6px",
    boxSizing: "border-box" as const,
    background: "#ffffff",
    color: "#173b29"
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#294333",
    marginBottom: "15px"
  };

  const lowStockCount = products.filter(
    (product) =>
      Number(product.quantity) <= Number(product.low_stock_threshold)
  ).length;

  if (loading) {
    return (
      <main style={{
        padding: "40px",
        fontFamily: "Arial, sans-serif",
        color: "#164a32"
      }}>
        Loading your products...
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f3f7f3",
      padding: "25px 16px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: "1050px", margin: "0 auto" }}>

        <header style={{
          background: "#164a32",
          color: "white",
          padding: "22px",
          borderRadius: "13px",
          marginBottom: "24px"
        }}>
          <h1 style={{ margin: 0, fontSize: "26px" }}>
            MALIKEEP
          </h1>
          <p style={{ marginBottom: 0, color: "#dceade" }}>
            Products & Inventory Management
          </p>
        </header>

        <section style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "22px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Your Business
          </h2>

          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            style={inputStyle}
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.business_name}
              </option>
            ))}
          </select>
        </section>

        <section style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "22px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Subscription Usage
          </h2>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <p style={{ color: "#718078", margin: 0 }}>
                Current Plan
              </p>
              <strong style={{
                color: "#164a32",
                fontSize: "20px",
                textTransform: "capitalize"
              }}>
                {plan}
              </strong>
            </div>

            <div>
              <p style={{ color: "#718078", margin: 0 }}>
                Products Added
              </p>
              <strong style={{ color: "#164a32", fontSize: "20px" }}>
                {productsLoading
                  ? "Loading..."
                  : `${products.length} / ${productLimit ?? "Unlimited"}`}
              </strong>
            </div>
          </div>

          {productLimit !== null && (
            <div style={{
              background: "#e8f1ea",
              height: "9px",
              borderRadius: "20px",
              overflow: "hidden",
              marginTop: "16px"
            }}>
              <div style={{
                width: `${Math.min((products.length / productLimit) * 100, 100)}%`,
                height: "100%",
                background: isAtLimit ? "#b45309" : "#167044",
                borderRadius: "20px"
              }} />
            </div>
          )}

          {isAtLimit && (
            <p style={{ color: "#b45309", fontSize: "14px", marginBottom: 0 }}>
              You have reached your product limit.{" "}
              <Link
                href="/subscription"
                style={{ color: "#164a32", fontWeight: 700 }}
              >
                View upgrade plans
              </Link>
            </p>
          )}
        </section>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "15px",
          marginBottom: "22px"
        }}>
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px"
          }}>
            <p style={{ color: "#718078", margin: 0 }}>Total Products</p>
            <h2 style={{ color: "#164a32", marginBottom: 0 }}>
              {products.length}
            </h2>
          </div>

          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px"
          }}>
            <p style={{ color: "#718078", margin: 0 }}>Low Stock Items</p>
            <h2 style={{ color: "#b45309", marginBottom: 0 }}>
              {lowStockCount}
            </h2>
          </div>
        </div>

        <section style={{
          background: "white",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Add New Product
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px"
            }}>
              <label style={labelStyle}>
                Product Name *
                <input
                  style={inputStyle}
                  value={form.product_name}
                  onChange={(e) => setForm({
                    ...form, product_name: e.target.value
                  })}
                  placeholder="e.g. Sugar 1kg"
                  required
                />
              </label>

              <label style={labelStyle}>
                Product Code / SKU
                <input
                  style={inputStyle}
                  value={form.sku}
                  onChange={(e) => setForm({
                    ...form, sku: e.target.value
                  })}
                  placeholder="Optional product code"
                />
              </label>

              <label style={labelStyle}>
                Category
                <input
                  style={inputStyle}
                  value={form.category}
                  onChange={(e) => setForm({
                    ...form, category: e.target.value
                  })}
                  placeholder="e.g. Food"
                />
              </label>

              <label style={labelStyle}>
                Unit
                <select
                  style={inputStyle}
                  value={form.unit}
                  onChange={(e) => setForm({
                    ...form, unit: e.target.value
                  })}
                >
                  <option value="pcs">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="g">Grams</option>
                  <option value="litre">Litres</option>
                  <option value="ml">Millilitres</option>
                  <option value="packet">Packets</option>
                  <option value="box">Boxes</option>
                  <option value="bottle">Bottles</option>
                  <option value="carton">Cartons</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={labelStyle}>
                Buying Price (KES) *
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.buying_price}
                  onChange={(e) => setForm({
                    ...form, buying_price: e.target.value
                  })}
                  placeholder="0.00"
                  required
                />
              </label>

              <label style={labelStyle}>
                Selling Price (KES) *
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm({
                    ...form, selling_price: e.target.value
                  })}
                  placeholder="0.00"
                  required
                />
              </label>

              <label style={labelStyle}>
                Opening Stock *
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={(e) => setForm({
                    ...form, quantity: e.target.value
                  })}
                  required
                />
              </label>

              <label style={labelStyle}>
                Low Stock Warning Level
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm({
                    ...form, low_stock_threshold: e.target.value
                  })}
                />
              </label>
            </div>

            {error && (
              <div style={{
                background: limitError ? "#fff7ed" : "#fef2f2",
                border: `1px solid ${limitError ? "#fed7aa" : "#fecaca"}`,
                borderRadius: "8px",
                padding: "12px",
                marginTop: "12px"
              }}>
                <p style={{
                  color: limitError ? "#9a3412" : "#b42318",
                  fontSize: "14px",
                  margin: 0
                }}>
                  {error}
                </p>

                {limitError && (
                  <Link
                    href="/subscription"
                    style={{
                      display: "inline-block",
                      marginTop: "9px",
                      color: "#164a32",
                      fontWeight: 700,
                      fontSize: "14px"
                    }}
                  >
                    View subscription plans →
                  </Link>
                )}
              </div>
            )}

            {message && (
              <p style={{ color: "#167044", fontSize: "14px" }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                productsLoading ||
                businesses.length === 0 ||
                isAtLimit
              }
              style={{
                width: "100%",
                padding: "14px",
                background: isAtLimit ? "#9ca3af" : "#164a32",
                color: "white",
                border: "none",
                borderRadius: "9px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: (
                  saving ||
                  productsLoading ||
                  isAtLimit
                ) ? "not-allowed" : "pointer",
                marginTop: "5px"
              }}
            >
              {saving
                ? "Saving Product..."
                : isAtLimit
                  ? "Product Limit Reached"
                  : "Save Product"}
            </button>
          </form>
        </section>

        <section style={{
          background: "white",
          padding: "24px",
          borderRadius: "12px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Product Inventory
          </h2>

          {productsLoading ? (
            <p style={{ color: "#718078" }}>
              Loading products...
            </p>
          ) : products.length === 0 ? (
            <p style={{ color: "#718078" }}>
              No products added yet. Use the form above to add your first product.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                minWidth: "650px"
              }}>
                <thead>
                  <tr style={{
                    background: "#e8f1ea",
                    color: "#164a32",
                    textAlign: "left"
                  }}>
                    <th style={{ padding: "12px" }}>Product</th>
                    <th style={{ padding: "12px" }}>Buying</th>
                    <th style={{ padding: "12px" }}>Selling</th>
                    <th style={{ padding: "12px" }}>Stock</th>
                    <th style={{ padding: "12px" }}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const isLow =
                      Number(product.quantity) <=
                      Number(product.low_stock_threshold);

                    return (
                      <tr key={product.id} style={{
                        borderBottom: "1px solid #e5ebe6"
                      }}>
                        <td style={{ padding: "13px" }}>
                          <strong>{product.product_name}</strong>
                          <br />
                          <span style={{ color: "#718078" }}>
                            {product.category || product.unit}
                          </span>
                        </td>

                        <td style={{ padding: "13px" }}>
                          KES {Number(product.buying_price).toFixed(2)}
                        </td>

                        <td style={{ padding: "13px" }}>
                          KES {Number(product.selling_price).toFixed(2)}
                        </td>

                        <td style={{ padding: "13px" }}>
                          {Number(product.quantity)} {product.unit}
                        </td>

                        <td style={{ padding: "13px" }}>
                          <span style={{
                            color: isLow ? "#b45309" : "#167044",
                            fontWeight: 700
                          }}>
                            {isLow ? "Low Stock" : "In Stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p style={{
          textAlign: "center",
          color: "#718078",
          fontSize: "12px",
          marginTop: "25px"
        }}>
          MALIKEEP · Business Management Made Easier
        </p>
      </div>
    </main>
  );
}
