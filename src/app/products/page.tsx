
"use client";

import { useEffect, useState, type FormEvent } from "react";
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

export default function ProductsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    async function loadBusinesses() {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        setError("Please log in to manage your products.");
        setLoading(false);
        return;
      }

      const { data, error: businessError } = await supabase
        .from("businesses")
        .select("id, business_name")
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
  }, []);

  useEffect(() => {
    async function loadProducts() {
      if (!businessId) {
        setProducts([]);
        return;
      }

      const { data, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .order("product_name", { ascending: true });

      if (productError) {
        setError(productError.message);
        return;
      }

      setProducts((data || []) as Product[]);
    }

    loadProducts();
  }, [businessId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!businessId) {
      setError("Please select a business first.");
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
      setError(saveError.message);
      setSaving(false);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .order("product_name", { ascending: true });

    if (refreshError) {
      setError(refreshError.message);
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
              <p style={{ color: "#b42318", fontSize: "14px" }}>
                {error}
              </p>
            )}

            {message && (
              <p style={{ color: "#167044", fontSize: "14px" }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || businesses.length === 0}
              style={{
                width: "100%",
                padding: "14px",
                background: "#164a32",
                color: "white",
                border: "none",
                borderRadius: "9px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                marginTop: "5px"
              }}
            >
              {saving ? "Saving Product..." : "Save Product"}
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

          {products.length === 0 ? (
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
