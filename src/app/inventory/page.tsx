
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

type Business = {
  id: string;
  business_name: string;
};

type Product = {
  id: string;
  product_name: string;
  quantity: number | string;
  unit: string;
  low_stock_threshold: number | string;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number | string;
  notes: string | null;
  created_at: string;
};

const movementLabels: Record<string, string> = {
  restock: "Stock Received",
  damage: "Damaged Stock",
  adjustment_increase: "Stock Increase",
  adjustment_decrease: "Stock Decrease"
};

export default function InventoryPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState("restock");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInventory = useCallback(async (businessId: string) => {
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, product_name, quantity, unit, low_stock_threshold")
      .eq("business_id", businessId)
      .order("product_name");

    if (productError) {
      setError(productError.message);
      return;
    }

    const productList = (productData || []) as Product[];
    setProducts(productList);

    if (
      productList.length > 0 &&
      !productList.some((p) => p.id === productId)
    ) {
      setProductId(productList[0].id);
    }

    const { data: movementData, error: movementError } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (movementError) {
      setError(movementError.message);
      return;
    }

    setMovements((movementData || []) as Movement[]);
  }, [productId]);

  useEffect(() => {
    async function initialize() {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        setError("Please log in to manage your inventory.");
        setLoading(false);
        return;
      }

      const { data, error: businessError } = await supabase
        .from("businesses")
        .select("id, business_name")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (businessError || !data) {
        setError(
          businessError?.message ||
          "No business found. Please complete Business Setup first."
        );
        setLoading(false);
        return;
      }

      setBusiness(data as Business);
      await loadInventory(data.id);
      setLoading(false);
    }

    initialize();
  }, [loadInventory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!productId || !business) {
      setError("Please add a product before adjusting stock.");
      return;
    }

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid quantity greater than zero.");
      return;
    }

    setSaving(true);

    const { data, error: saveError } = await supabase.rpc(
      "adjust_product_stock",
      {
        p_product_id: productId,
        p_movement_type: movementType,
        p_quantity: amount,
        p_notes: notes.trim() || null
      }
    );

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    await loadInventory(business.id);

    setMessage(
      `Stock updated successfully. New quantity: ${Number(data)}`
    );

    setQuantity("");
    setNotes("");
    setSaving(false);
  }

  const lowStockCount = products.filter(
    (product) =>
      Number(product.quantity) <= Number(product.low_stock_threshold)
  ).length;

  const selectedProduct = products.find((p) => p.id === productId);

  if (loading) {
    return (
      <main style={{ padding: 35, color: "#164a32" }}>
        Loading inventory...
      </main>
    );
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #d5ded7",
    borderRadius: "8px",
    fontSize: "14px",
    marginTop: "7px",
    boxSizing: "border-box" as const,
    background: "#ffffff",
    color: "#173b29"
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#294333",
    marginBottom: "16px"
  };

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
          padding: "23px",
          borderRadius: "13px",
          marginBottom: "23px"
        }}>
          <h1 style={{ margin: 0, fontSize: "27px" }}>
            MALIKEEP
          </h1>
          <p style={{ marginBottom: 0, color: "#dceade" }}>
            Stock Management
          </p>
        </header>

        {business && (
          <section style={{
            background: "white",
            padding: "18px",
            borderRadius: "12px",
            marginBottom: "20px"
          }}>
            <span style={{ color: "#718078", fontSize: "13px" }}>
              MANAGING INVENTORY FOR
            </span>
            <h2 style={{ color: "#164a32", margin: "6px 0 0" }}>
              {business.business_name}
            </h2>
          </section>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "14px",
          marginBottom: "22px"
        }}>
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px"
          }}>
            <p style={{ margin: 0, color: "#718078" }}>
              Total Products
            </p>
            <h2 style={{ color: "#164a32", marginBottom: 0 }}>
              {products.length}
            </h2>
          </div>

          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px"
          }}>
            <p style={{ margin: 0, color: "#718078" }}>
              Low Stock Items
            </p>
            <h2 style={{ color: "#b45309", marginBottom: 0 }}>
              {lowStockCount}
            </h2>
          </div>
        </div>

        <section style={{
          background: "white",
          padding: "23px",
          borderRadius: "12px",
          marginBottom: "23px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Update Stock
          </h2>

          {products.length === 0 ? (
            <p>
              No products found. Add products before managing stock.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <label style={labelStyle}>
                  Select Product
                  <select
                    style={inputStyle}
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedProduct && (
                  <p style={{
                    background: "#e8f1ea",
                    color: "#164a32",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}>
                    Current stock: <strong>
                      {Number(selectedProduct.quantity)} {selectedProduct.unit}
                    </strong>
                  </p>
                )}

                <label style={labelStyle}>
                  Movement Type
                  <select
                    style={inputStyle}
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value)}
                  >
                    <option value="restock">Stock Received / Restock</option>
                    <option value="damage">Damaged Stock</option>
                    <option value="adjustment_increase">Stock Increase</option>
                    <option value="adjustment_decrease">Stock Decrease</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Quantity
                  <input
                    style={inputStyle}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    required
                  />
                </label>

                <label style={labelStyle}>
                  Reason / Notes
                  <textarea
                    style={{ ...inputStyle, minHeight: "85px" }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Received 5 new reams from supplier"
                  />
                </label>

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
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#164a32",
                    color: "white",
                    border: "none",
                    borderRadius: "9px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {saving ? "Updating Stock..." : "Save Stock Movement"}
                </button>
              </form>
            </>
          )}
        </section>

        <section style={{
          background: "white",
          padding: "23px",
          borderRadius: "12px",
          marginBottom: "23px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Current Inventory
          </h2>

          {products.length === 0 ? (
            <p>No products available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "500px",
                fontSize: "13px"
              }}>
                <thead>
                  <tr style={{
                    background: "#e8f1ea",
                    color: "#164a32",
                    textAlign: "left"
                  }}>
                    <th style={{ padding: "12px" }}>Product</th>
                    <th style={{ padding: "12px" }}>Quantity</th>
                    <th style={{ padding: "12px" }}>Warning Level</th>
                    <th style={{ padding: "12px" }}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const low =
                      Number(product.quantity) <=
                      Number(product.low_stock_threshold);

                    return (
                      <tr key={product.id} style={{
                        borderBottom: "1px solid #e5ebe6"
                      }}>
                        <td style={{ padding: "12px" }}>
                          {product.product_name}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {Number(product.quantity)} {product.unit}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {Number(product.low_stock_threshold)}
                        </td>
                        <td style={{
                          padding: "12px",
                          fontWeight: 700,
                          color: low ? "#b45309" : "#167044"
                        }}>
                          {low ? "Low Stock" : "In Stock"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{
          background: "white",
          padding: "23px",
          borderRadius: "12px"
        }}>
          <h2 style={{ color: "#164a32", marginTop: 0 }}>
            Stock Movement History
          </h2>

          {movements.length === 0 ? (
            <p style={{ color: "#718078" }}>
              No stock movements recorded yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "600px",
                fontSize: "13px"
              }}>
                <thead>
                  <tr style={{
                    background: "#e8f1ea",
                    color: "#164a32",
                    textAlign: "left"
                  }}>
                    <th style={{ padding: "12px" }}>Date</th>
                    <th style={{ padding: "12px" }}>Product</th>
                    <th style={{ padding: "12px" }}>Movement</th>
                    <th style={{ padding: "12px" }}>Quantity</th>
                    <th style={{ padding: "12px" }}>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => {
                    const product = products.find(
                      (p) => p.id === movement.product_id
                    );

                    return (
                      <tr key={movement.id} style={{
                        borderBottom: "1px solid #e5ebe6"
                      }}>
                        <td style={{ padding: "12px" }}>
                          {new Date(movement.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {product?.product_name || "Product"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {movementLabels[movement.movement_type] ||
                            movement.movement_type}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {Number(movement.quantity)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {movement.notes || "—"}
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
          MALIKEEP · Stock Management
        </p>
      </div>
    </main>
  );
}
