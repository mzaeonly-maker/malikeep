
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ShoppingCart, Plus, Trash2, Receipt, RefreshCw,
  Wallet, Package, CheckCircle2, Users, CreditCard,
  Banknote, Smartphone
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

type Customer = {
  id: string;
  customer_name: string;
  phone: string | null;
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

type CustomerPayment = {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentEvent = {
  id: string;
  sale_id: string;
  sale_number: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  created_at: string;
  type: "initial" | "repayment";
};

type PaymentCategory = {
  method: string;
  label: string;
  amount: number;
};

type PaymentMethod = "cash" | "mpesa" | "bank" | "card" | "credit";

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);

const paymentLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    mpesa: "M-Pesa",
    bank: "Bank Transfer",
    card: "Card",
    credit: "Credit"
  };

  return labels[method.toLowerCase()] || "Other";
};

const inputClass =
  "block box-border w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

const labelClass =
  "mb-2 block text-sm font-semibold text-gray-700";

export default function SalesPage() {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [recentPayments, setRecentPayments] = useState<PaymentEvent[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedCustomer, setSelectedCustomer] = useState("");
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

    const [
      productResult,
      salesResult,
      customerResult,
      paymentSalesResult,
      customerPaymentsResult
    ] = await Promise.all([
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
        .limit(10),

      supabase
        .from("customers")
        .select("id, customer_name, phone")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("customer_name"),

      supabase
        .from("sales")
        .select("id, sale_number, customer_name, amount_paid, payment_method, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("customer_payments")
        .select("id, sale_id, amount, payment_method, reference, notes, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
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

    if (customerResult.error) {
      setError(customerResult.error.message);
    } else {
      setCustomers((customerResult.data || []) as Customer[]);
    }

    if (paymentSalesResult.error) {
      setRecentPayments([]);
      setPaymentCategories([]);
      setError(`Could not load payment history: ${paymentSalesResult.error.message}`);
      setLoading(false);
      return;
    }

    if (customerPaymentsResult.error) {
      setRecentPayments([]);
      setPaymentCategories([]);
      setError(`Could not load customer repayments: ${customerPaymentsResult.error.message}`);
      setLoading(false);
      return;
    }

    const paymentSales = paymentSalesResult.data || [];
    const customerPayments =
      (customerPaymentsResult.data || []) as CustomerPayment[];

    // Customer payment records are later repayments.
    // Subtract them from cumulative amount_paid to isolate
    // the amount received when the original sale was recorded.
    const repaymentTotals = new Map<string, number>();

    customerPayments.forEach((payment) => {
      repaymentTotals.set(
        payment.sale_id,
        (repaymentTotals.get(payment.sale_id) || 0) +
          Number(payment.amount || 0)
      );
    });

const salesById = new Map(
  paymentSales.map((sale) => [sale.id, sale] as const)
);

    const events: PaymentEvent[] = [];

    paymentSales.forEach((sale) => {
      const initialPayment = Math.max(
        0,
        Number(sale.amount_paid || 0) -
          (repaymentTotals.get(sale.id) || 0)
      );

      if (initialPayment > 0) {
        events.push({
          id: `initial-${sale.id}`,
          sale_id: sale.id,
          sale_number: sale.sale_number || "Sale",
          customer_name: sale.customer_name || "Walk-in customer",
          amount: initialPayment,
          payment_method: sale.payment_method || "other",
          created_at: sale.created_at,
          type: "initial"
        });
      }
    });

    customerPayments.forEach((payment) => {
      const sale = salesById.get(payment.sale_id);

      events.push({
        id: `repayment-${payment.id}`,
        sale_id: payment.sale_id,
        sale_number: sale?.sale_number || "Sale",
        customer_name: sale?.customer_name || "Customer",
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method || "other",
        created_at: payment.created_at,
        type: "repayment"
      });
    });

    events.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    setRecentPayments(events.slice(0, 10));

    const methods = ["cash", "mpesa", "bank", "card"];

    setPaymentCategories(
      methods.map((method) => ({
        method,
        label: paymentLabel(method),
        amount: events
          .filter(
            (event) =>
              event.payment_method.toLowerCase() === method
          )
          .reduce((sum, event) => sum + event.amount, 0)
      }))
    );

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

  const totalReceived = paymentCategories.reduce(
    (sum, category) => sum + category.amount,
    0
  );

  function handleCustomerChange(customerId: string) {
    setSelectedCustomer(customerId);

    if (customerId) {
      const customer = customers.find(
        (item) => item.id === customerId
      );
      setCustomerName(customer?.customer_name || "");
    } else {
      setCustomerName("");
    }
  }

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
    setSelectedProduct("");
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

    if (selectedCustomer && !customers.some(
      (customer) => customer.id === selectedCustomer
    )) {
      setError("Please select a valid registered customer.");
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
        p_customer_id: selectedCustomer || null,
        p_amount_paid: paid,
        p_customer_name: selectedCustomer
          ? null
          : customerName.trim() || null,
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
    setSelectedProduct("");
    setSelectedCustomer("");
    setCustomerName("");
    setAmountPaid("");
    setNotes("");
    setPaymentMethod("cash");

    await loadData();

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="box-border min-h-screen w-full min-w-0 max-w-full flex-1 bg-gray-50 p-5 sm:p-8">
        <p className="text-sm text-gray-600">
          Loading MALIKEEP Sales...
        </p>
      </main>
    );
  }

  return (
    <main className="relative left-0 box-border min-h-screen w-full min-w-0 max-w-full flex-1 overflow-x-clip bg-gray-50 px-3 py-4 sm:px-5 sm:py-6 md:p-8">
      <div className="mx-0 w-full min-w-0 max-w-7xl space-y-5 sm:space-y-6">

        {/* PAGE HEADER */}
        <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-green-700">
              {businessName}
            </p>

            <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              Sales & Payments
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              Record sales, receive payments and track your transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 sm:w-auto"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {/* MESSAGES */}
        {error && (
          <div className="w-full min-w-0 break-words rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex min-w-0 items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-all">{success}</span>
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div className="grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-3">

          <section className="w-full min-w-0 space-y-5 xl:col-span-2">

            {/* ADD PRODUCTS */}
            <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-lg bg-green-100 p-3 text-green-700">
                  <Package size={22} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">
                    Add Products
                  </h2>
                  <p className="text-sm leading-5 text-gray-500">
                    Select products and quantities for this sale.
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <p className="rounded-lg bg-yellow-50 p-4 text-sm leading-6 text-yellow-800">
                  No active products found. Add products before recording a sale.
                </p>
              ) : (
                <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="min-w-0 sm:col-span-2">
                    <label className={labelClass}>
                      Select Product
                    </label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className={inputClass}
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

                  <div className="min-w-0">
                    <label className={labelClass}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addProduct}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 sm:col-span-3"
                  >
                    <Plus size={18} />
                    Add to Sale
                  </button>
                </div>
              )}
            </div>

            {/* CURRENT SALE */}
            <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <ShoppingCart className="shrink-0 text-green-700" size={22} />
                <h2 className="text-lg font-bold text-gray-900">
                  Current Sale
                </h2>
              </div>

              {cartDetails.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center sm:p-8">
                  <ShoppingCart className="mx-auto mb-3 text-gray-400" size={32} />
                  <p className="font-medium text-gray-700">
                    Your sale is empty
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Add products above to get started.
                  </p>
                </div>
              ) : (
                <>
                  {/* MOBILE CART CARDS */}
                  <div className="space-y-3 md:hidden">
                    {cartDetails.map((item) => (
                      <div
                        key={item.product_id}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-gray-900">
                              {item.product?.product_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Per {item.product?.unit}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.product_id)}
                            className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
                            aria-label="Remove product"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="min-w-0">
                            <p className="mb-1 text-xs text-gray-500">
                              Unit price
                            </p>
                            <p className="break-words text-sm font-semibold text-gray-800">
                              {money(Number(item.product?.selling_price || 0))}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <label className="mb-1 block text-xs text-gray-500">
                              Quantity
                            </label>
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
                              className="box-border w-full min-w-0 rounded-md border border-gray-300 bg-white p-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-200 pt-3">
                          <span className="text-sm text-gray-600">
                            Line total
                          </span>
                          <span className="break-words text-sm font-bold text-green-800">
                            {money(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP CART TABLE */}
                  <div className="hidden max-w-full overflow-x-auto md:block">
                    <table className="w-full min-w-[600px] text-left text-sm">
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
                            <td className="max-w-[200px] break-words py-4 pr-3 font-medium text-gray-900">
                              {item.product?.product_name}
                              <p className="text-xs text-gray-500">
                                Per {item.product?.unit}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-2 py-4">
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

                            <td className="whitespace-nowrap px-2 py-4 text-right font-semibold">
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
                </>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <span className="font-semibold text-gray-700">
                  Sale Total
                </span>
                <span className="break-words text-xl font-bold text-green-800 sm:text-2xl">
                  {money(total)}
                </span>
              </div>
            </div>

            {/* PAYMENT FORM */}
            <form
              onSubmit={submitSale}
              className="w-full min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center gap-3">
                <Wallet className="shrink-0 text-green-700" size={22} />
                <h2 className="text-lg font-bold text-gray-900">
                  Payment Details
                </h2>
              </div>

              <div className="min-w-0">
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <Users size={16} />
                    Select Registered Customer
                  </span>
                </label>

                <select
                  value={selectedCustomer}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Walk-in / Unregistered Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_name}
                      {customer.phone ? ` — ${customer.phone}` : ""}
                    </option>
                  ))}
                </select>

                {customers.length === 0 && (
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    No registered customers yet. You can still record a walk-in sale.
                  </p>
                )}

                {selectedCustomer && (
                  <p className="mt-2 break-words text-sm font-medium text-green-700">
                    Registered customer: {customerName}
                  </p>
                )}
              </div>

              {!selectedCustomer && (
                <div className="min-w-0">
                  <label className={labelClass}>
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="min-w-0">
                <label className={labelClass}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className={inputClass}
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit / Pay Later</option>
                </select>
              </div>

              {paymentMethod !== "credit" && (
                <div className="min-w-0">
                  <label className={labelClass}>
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
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    For a partial payment, enter the amount actually received.
                  </p>
                </div>
              )}

              <div className="min-w-0">
                <label className={labelClass}>
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional sale information"
                  className={inputClass}
                />
              </div>

              {/* PAYMENT SUMMARY */}
              <div className="w-full min-w-0 space-y-3 rounded-lg bg-gray-50 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-gray-600">Sale Total</span>
                  <span className="font-semibold">{money(total)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-gray-600">Amount Received</span>
                  <span className="font-semibold">{money(paid)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
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
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-4 text-center font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Receipt size={19} />
                {saving ? "Recording Sale..." : "Complete Sale"}
              </button>
            </form>
          </section>

          {/* RIGHT COLUMN */}
          <aside className="w-full min-w-0 space-y-5">

            {/* RECENT SALES */}
            <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                Recent Sales
              </h2>

              {sales.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No sales recorded yet.
                </p>
              ) : (
                <div className="w-full min-w-0 space-y-4">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="w-full min-w-0 border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold text-gray-900">
                            {sale.sale_number}
                          </p>
                          <p className="mt-1 break-words text-xs text-gray-500">
                            {sale.customer_name || "Walk-in customer"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
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

                      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold">
                          {money(Number(sale.total_amount))}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
                        <span>{sale.payment_method.toUpperCase()}</span>
                        <span className="break-words">
                          {new Date(sale.created_at).toLocaleString("en-KE")}
                        </span>
                      </div>

                      {Number(sale.balance) > 0 && (
                        <p className="mt-2 break-words text-xs font-semibold text-red-700">
                          Balance: {money(Number(sale.balance))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RECENT PAYMENTS */}
            <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Receipt size={20} className="shrink-0 text-green-700" />
                  <h2 className="text-lg font-bold text-gray-900">
                    Recent Payments
                  </h2>
                </div>
                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                  Latest 10
                </span>
              </div>

              {recentPayments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No payment records found.
                </p>
              ) : (
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-gray-900">
                            {payment.customer_name}
                          </p>
                          <p className="mt-1 break-all text-xs text-gray-500">
                            {payment.sale_number}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-green-800">
                          {money(payment.amount)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            {paymentLabel(payment.payment_method)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              payment.type === "repayment"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {payment.type === "repayment"
                              ? "Debt repayment"
                              : "Sale payment"}
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleString("en-KE")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAYMENT CATEGORIES */}
            <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard size={20} className="shrink-0 text-green-700" />
                <h2 className="text-lg font-bold text-gray-900">
                  Payment Categories
                </h2>
              </div>

              <div className="mb-4 rounded-lg bg-green-50 p-3">
                <p className="text-xs font-medium text-green-700">
                  Total Payments Received
                </p>
                <p className="mt-1 text-2xl font-bold text-green-900">
                  {money(totalReceived)}
                </p>
              </div>

              <div className="space-y-4">
                {paymentCategories.map((category) => {
                  const percentage = totalReceived > 0
                    ? (category.amount / totalReceived) * 100
                    : 0;

                  const CategoryIcon =
                    category.method === "cash"
                      ? Banknote
                      : category.method === "mpesa"
                      ? Smartphone
                      : CreditCard;

                  return (
                    <div key={category.method}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <CategoryIcon
                            size={17}
                            className="shrink-0 text-gray-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {category.label}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-gray-900">
                          {money(category.amount)}
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Credit sales are not counted as money received. They appear
                here only when an actual payment is recorded.
              </p>
            </div>

            {/* STOCK INFORMATION */}
            <div className="w-full min-w-0 rounded-xl border border-green-200 bg-green-50 p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-green-800">
                <CheckCircle2 size={20} className="shrink-0" />
                <h3 className="font-bold">
                  Automatic Stock Control
                </h3>
              </div>

              <p className="break-words text-sm leading-6 text-green-900">
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
