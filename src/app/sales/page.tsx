
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Receipt,
  RefreshCw,
  Wallet,
  Package,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Product = {
  id: string;
  product_name: string;
  unit: string;
  selling_price: number;
  buying_price: number;
  quantity: number;
};

type CartItem = {
  product_id: string;
  quantity: number;
};

type Sale = {
  id: string;
  sale_number: string;
  customer_name: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
};

type PaymentMethod = "cash" | "mpesa" | "bank" | "card" | "credit";

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);

export default function SalesPage() {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: businessRows, error: businessError } =
      await supabase
        .from("businesses")
        .select("id, business_name")
        .limit(1);

    if (businessError) {
      setError(businessError.message);
      setLoading(false);
      return;
    }

    if (!businessRows || businessRows.length === 0) {
      setError("No business profile found. Please set up your business first.");
      setLoading(false);
      return;
    }

    const business = businessRows[0];

    setBusinessId(business.id);
    setBusinessName(business.business_name);

    const [productResult, salesResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, product_name, unit, selling_price, buying_price, quantity")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("product_name"),

      supabase
        .from("sales")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    if (productResult.error) {
      setError(productResult.error.message);
    } else {
      setProducts((productResult.data || []) as Product[]);
    }

    if (salesResult.error) {
      setError(salesResult.error.message);
    } else {
      setSales((salesResult.data || []) as Sale[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const cartDetails = useMemo(() => {
    return cart.map((item) => {
      const product = products.find(
        (p) => p.id === item.product_id
      );

      return {
        ...item,
        product,
        lineTotal: product
          ? Number(product.selling_price) * item.quantity
          : 0
      };
    }).filter((item) => item.product);
  }, [cart, products]);

  const total = cartDetails.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );

  const paid = paymentMethod === "credit"
    ? 0
    : Number(amountPaid || 0);

  const balance = total - paid;

  function addProduct() {
    setError("");
    setSuccess("");

    const product = products.find(
      (p) => p.id === selectedProduct
    );

    const requestedQuantity = Number(quantity);

    if (!product) {
      setError("Please select a product.");
      return;
    }

    if (
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      setError("Enter a valid quantity greater than zero.");
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.id
    );

    const alreadyAdded = existing?.quantity || 0;

    if (alreadyAdded + requestedQuantity > Number(product.quantity)) {
      setError(
        `Only ${product.quantity} ${product.unit} available for ${product.product_name}.`
      );
      return;
    }

    setCart((current) => {
      const found = current.find(
        (item) => item.product_id === product.id
      );

      if (found) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + requestedQuantity
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          quantity: requestedQuantity
        }
      ];
    });

    setQuantity("1");
  }

  function updateQuantity(productId: string, newQuantity: number) {
    const product = products.find((p) => p.id === productId);

    if (!product || newQuantity <= 0) return;

    if (newQuantity > Number(product.quantity)) {
      setError(
        `Only ${product.quantity} ${product.unit} available.`
      );
      return;
    }

    setError("");

    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }

  function removeItem(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product_id !== productId)
    );
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!businessId) {
      setError("Business profile not found.");
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one product to the sale.");
      return;
    }

    if (paymentMethod !== "credit") {
      if (!Number.isFinite(paid) || paid < 0) {
        setError("Enter a valid payment amount.");
        return;
      }

      if (paid <= 0) {
        setError("Enter the amount received, or select Credit.");
        return;
      }

      if (paid > total) {
        setError("Payment cannot exceed the sale total.");
        return;
      }
    }

    setSaving(true);

    const { data, error: saleError } = await supabase.rpc(
      "record_sale",
      {
        p_business_id: businessId,
        p_items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        p_payment_method: paymentMethod,
        p_amount_paid: paid,
        p_customer_name: customerName.trim() || null,
        p_notes: notes.trim() || null
      }
    );

    if (saleError) {
      setError(saleError.message);
      setSaving(false);
      return;
    }

    setSuccess(
      `Sale recorded successfully! Sale reference: ${String(data)}`
    );

    setCart([]);
    setCustomerName("");
    setAmountPaid("");
    setNotes("");
    setPaymentMethod("cash");

    await loadData();

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-600">Loading MALIKEEP Sales...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-700">
              {businessName}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Sales & Payments
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Record sales, receive payments and track your transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={20} className="shrink-0" />
            <span className="break-all">{success}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">

          {/* SALE FORM */}
          <section className="space-y-6 lg:col-span-2">

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-3 text-green-700">
                  <Package size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Add Products
                  </h2>
                  <p className="text-sm text-gray-500">
                    Select products and quantities for this sale.
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <p className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                  No active products found. Add products before recording a sale.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Select Product
                    </label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-green-600"
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={Number(product.quantity) <= 0}
                        >
                          {product.product_name} — Stock: {product.quantity} {product.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-green-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addProduct}
                    className="flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 sm:col-span-3"
                  >
                    <Plus size={18} />
                    Add to Sale
                  </button>
                </div>
              )}
            </div>

            {/* CART */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <ShoppingCart className="text-green-700" size={22} />
                <h2 className="text-lg font-bold text-gray-900">
                  Current Sale
                </h2>
              </div>

              {cartDetails.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <ShoppingCart className="mx-auto mb-3 text-gray-400" size={32} />
                  <p className="font-medium text-gray-700">
                    Your sale is empty
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Add products above to get started.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-3 pr-3">Product</th>
                        <th className="px-2 py-3">Price</th>
                        <th className="px-2 py-3">Quantity</th>
                        <th className="px-2 py-3 text-right">Total</th>
                        <th className="py-3 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartDetails.map((item) => (
                        <tr
                          key={item.product_id}
                          className="border-b last:border-0"
                        >
                          <td className="py-4 pr-3 font-medium text-gray-900">
                            {item.product?.product_name}
                            <p className="text-xs text-gray-500">
                              Per {item.product?.unit}
                            </p>
                          </td>

                          <td className="px-2 py-4 whitespace-nowrap">
                            {money(Number(item.product?.selling_price || 0))}
                          </td>

                          <td className="px-2 py-4">
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  item.product_id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-20 rounded-md border p-2"
                            />
                          </td>

                          <td className="px-2 py-4 text-right font-semibold whitespace-nowrap">
                            {money(item.lineTotal)}
                          </td>

                          <td className="py-4 pl-2">
                            <button
                              type="button"
                              onClick={() => removeItem(item.product_id)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                              aria-label="Remove product"
                            >
                              <Trash2 size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="font-semibold text-gray-700">
                  Sale Total
                </span>
                <span className="text-2xl font-bold text-green-800">
                  {money(total)}
                </span>
              </div>
            </div>

            {/* PAYMENT DETAILS */}
            <form
              onSubmit={submitSale}
              className="space-y-5 rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Wallet className="text-green-700" size={22} />
                <h2 className="text-lg font-bold text-gray-900">
                  Payment Details
                </h2>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-green-600"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit / Pay Later</option>
                </select>
              </div>

              {paymentMethod !== "credit" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Amount Received (KES)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={total}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Enter amount received"
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-green-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    For a partial payment, enter the amount actually received.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional sale information"
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sale Total</span>
                  <span className="font-semibold">{money(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount Received</span>
                  <span className="font-semibold">{money(paid)}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="font-semibold text-gray-800">
                    Outstanding Balance
                  </span>
                  <span className="text-lg font-bold text-red-700">
                    {money(Math.max(0, balance))}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || cart.length === 0 || total <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-4 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Receipt size={19} />
                {saving ? "Recording Sale..." : "Complete Sale"}
              </button>
            </form>
          </section>

          {/* RECENT SALES */}
          <aside className="space-y-5">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                Recent Sales
              </h2>

              {sales.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No sales recorded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="break-all text-sm font-semibold text-gray-900">
                            {sale.sale_number}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {sale.customer_name || "Walk-in customer"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            sale.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : sale.payment_status === "partial"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {sale.payment_status}
                        </span>
                      </div>

                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold">
                          {money(Number(sale.total_amount))}
                        </span>
                      </div>

                      <div className="mt-1 flex justify-between text-xs text-gray-500">
                        <span>{sale.payment_method.toUpperCase()}</span>
                        <span>
                          {new Date(sale.created_at).toLocaleString("en-KE")}
                        </span>
                      </div>

                      {Number(sale.balance) > 0 && (
                        <p className="mt-2 text-xs font-medium text-red-700">
                          Balance: {money(Number(sale.balance))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="mb-2 flex items-center gap-2 text-green-800">
                <CheckCircle2 size={20} />
                <h3 className="font-bold">Automatic Stock Control</h3>
              </div>
              <p className="text-sm leading-6 text-green-900">
                When a sale is completed, MALIKEEP checks available stock,
                records the sale and deducts the sold quantities automatically.
                Insufficient stock prevents the sale from being recorded.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
