
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Users,
  UserPlus,
  RefreshCw,
  Wallet,
  Receipt,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Customer = {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type DebtSale = {
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

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  sale_id: string;
};

type PaymentMethod = "cash" | "mpesa" | "bank" | "card";

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);

export default function CustomersPage() {
  const [businessId, setBusinessId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<DebtSale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [selectedSale, setSelectedSale] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: businesses, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .limit(1);

    if (businessError) {
      setError(businessError.message);
      setLoading(false);
      return;
    }

    if (!businesses || businesses.length === 0) {
      setError("Please set up your business first.");
      setLoading(false);
      return;
    }

    const id = businesses[0].id;
    setBusinessId(id);

    const [customerResult, debtResult, paymentResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("business_id", id)
          .order("customer_name"),

        supabase
          .from("sales")
          .select("*")
          .eq("business_id", id)
          .gt("balance", 0)
          .not("customer_name", "is", null)
          .order("created_at", { ascending: false }),

        supabase
          .from("customer_payments")
          .select("*")
          .eq("business_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      ]);

    if (customerResult.error) {
      setError(customerResult.error.message);
    } else {
      setCustomers((customerResult.data || []) as Customer[]);
    }

    if (debtResult.error) {
      setError(debtResult.error.message);
    } else {
      setDebts((debtResult.data || []) as DebtSale[]);
    }

    if (paymentResult.error) {
      setError(paymentResult.error.message);
    } else {
      setPayments((paymentResult.data || []) as Payment[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!customerName.trim()) {
      setError("Enter the customer's name.");
      return;
    }

    if (!businessId) {
      setError("Business profile not found.");
      return;
    }

    setSavingCustomer(true);

    const { error: insertError } = await supabase
      .from("customers")
      .insert({
        business_id: businessId,
        customer_name: customerName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: customerNotes.trim() || null
      });

    if (insertError) {
      setError(insertError.message);
      setSavingCustomer(false);
      return;
    }

    setSuccess("Customer registered successfully!");

    setCustomerName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCustomerNotes("");

    await loadData();
    setSavingCustomer(false);
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedSale) {
      setError("Select an outstanding sale.");
      return;
    }

    const amount = Number(paymentAmount);
    const sale = debts.find((item) => item.id === selectedSale);

    if (!sale) {
      setError("Selected sale could not be found.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amount > Number(sale.balance)) {
      setError(
        `Payment cannot exceed the outstanding balance of ${money(Number(sale.balance))}.`
      );
      return;
    }

    setSavingPayment(true);

    const { error: paymentError } = await supabase.rpc(
      "record_customer_payment",
      {
        p_sale_id: selectedSale,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_reference: reference.trim() || null,
        p_notes: paymentNotes.trim() || null
      }
    );

    if (paymentError) {
      setError(paymentError.message);
      setSavingPayment(false);
      return;
    }

    setSuccess("Customer repayment recorded successfully!");

    setSelectedSale("");
    setPaymentAmount("");
    setPaymentMethod("cash");
    setReference("");
    setPaymentNotes("");

    await loadData();
    setSavingPayment(false);
  }

  const totalDebt = debts.reduce(
    (sum, sale) => sum + Number(sale.balance),
    0
  );

  const activeCustomers = customers.filter(
    (customer) => customer.is_active
  ).length;

  const selectedDebt = debts.find(
    (sale) => sale.id === selectedSale
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-600">Loading customers...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-700">
              MALIKEEP BUSINESS MANAGEMENT
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Customers & Debts
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage customer records, outstanding balances and repayments.
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

        {/* ALERTS */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} />
            {success}
          </div>
        )}

        {/* SUMMARY CARDS */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Registered Customers</p>
              <Users className="text-green-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {activeCustomers}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Outstanding Debt</p>
              <Wallet className="text-red-600" size={22} />
            </div>
            <p className="mt-3 text-2xl font-bold text-red-700">
              {money(totalDebt)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Unpaid Sales</p>
              <Receipt className="text-orange-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {debts.length}
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* REGISTER CUSTOMER */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-3 text-green-700">
                <UserPlus size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Register Customer
                </h2>
                <p className="text-sm text-gray-500">
                  Add a new customer to your business records.
                </p>
              </div>
            </div>

            <form onSubmit={addCustomer} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name *
                </label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 07XXXXXXXX"
                  className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Customer email"
                  className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Address / Location
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Customer location"
                  className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Additional information"
                  className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                />
              </div>

              <button
                type="submit"
                disabled={savingCustomer}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                <UserPlus size={18} />
                {savingCustomer ? "Saving Customer..." : "Save Customer"}
              </button>
            </form>
          </section>

          {/* RECORD REPAYMENT */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
                <Wallet size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Record Debt Repayment
                </h2>
                <p className="text-sm text-gray-500">
                  Record money received against an outstanding sale.
                </p>
              </div>
            </div>

            {debts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 text-green-600" size={32} />
                <p className="font-medium text-gray-700">
                  No outstanding customer sales
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Credit sales with a customer name will appear here.
                </p>
              </div>
            ) : (
              <form onSubmit={recordPayment} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Select Outstanding Sale
                  </label>
                  <select
                    required
                    value={selectedSale}
                    onChange={(e) => setSelectedSale(e.target.value)}
                    className="w-full rounded-lg border bg-white p-3 text-sm outline-none focus:border-green-600"
                  >
                    <option value="">Choose a sale</option>
                    {debts.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        {sale.customer_name} — {sale.sale_number} — Balance: {money(Number(sale.balance))}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDebt && (
                  <div className="rounded-lg bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-800">
                      Outstanding balance
                    </p>
                    <p className="mt-1 text-2xl font-bold text-yellow-900">
                      {money(Number(selectedDebt.balance))}
                    </p>
                    <p className="mt-1 text-xs text-yellow-800">
                      Original sale: {money(Number(selectedDebt.total_amount))}
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Amount Received (KES)
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={selectedDebt ? Number(selectedDebt.balance) : undefined}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter repayment amount"
                    className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
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
                    className="w-full rounded-lg border bg-white p-3 text-sm outline-none focus:border-green-600"
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Payment Reference
                  </label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="M-Pesa transaction code (optional)"
                    className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Additional payment details"
                    className="w-full rounded-lg border p-3 text-sm outline-none focus:border-green-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPayment}
                  className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingPayment ? "Recording Payment..." : "Record Repayment"}
                </button>
              </form>
            )}
          </section>
        </div>

        {/* CUSTOMER REGISTER */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Customer Register
          </h2>

          {customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No customers registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="py-4 pr-4 font-medium text-gray-900">
                        {customer.customer_name}
                      </td>
                      <td className="px-4 py-4">
                        {customer.phone || "—"}
                      </td>
                      <td className="px-4 py-4">
                        {customer.email || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          {customer.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* OUTSTANDING DEBTS */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Outstanding Customer Sales
          </h2>

          {debts.length === 0 ? (
            <p className="py-5 text-center text-sm text-gray-500">
              No outstanding customer balances.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-3">Customer</th>
                    <th className="px-3 py-3">Sale Number</th>
                    <th className="px-3 py-3">Sale Total</th>
                    <th className="px-3 py-3">Paid</th>
                    <th className="px-3 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-4 pr-3 font-medium">
                        {sale.customer_name}
                      </td>
                      <td className="px-3 py-4">{sale.sale_number}</td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {money(Number(sale.total_amount))}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {money(Number(sale.amount_paid))}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-red-700 whitespace-nowrap">
                        {money(Number(sale.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PAYMENT HISTORY */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Recent Customer Repayments
          </h2>

          {payments.length === 0 ? (
            <p className="py-5 text-center text-sm text-gray-500">
              No customer repayments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-3">Date</th>
                    <th className="px-3 py-3">Sale ID</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="py-4 pr-3 whitespace-nowrap">
                        {new Date(payment.created_at).toLocaleDateString("en-KE")}
                      </td>
                      <td className="px-3 py-4">
                        {payment.sale_id.slice(0, 8)}...
                      </td>
                      <td className="px-3 py-4">
                        {payment.payment_method.toUpperCase()}
                      </td>
                      <td className="px-3 py-4">
                        {payment.reference || "—"}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-green-700 whitespace-nowrap">
                        {money(Number(payment.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
