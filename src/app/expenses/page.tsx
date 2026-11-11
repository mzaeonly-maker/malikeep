
"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Wallet, Plus, Trash2, RefreshCw, Receipt,
  TrendingDown, CheckCircle2, Pencil
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string;
  expense_date: string;
  created_at: string;
};

const categories = [
  "Rent",
  "Transport",
  "Electricity",
  "Water",
  "Salaries",
  "Stock Purchase",
  "Internet",
  "Repairs and Maintenance",
  "Marketing",
  "Licenses and Permits",
  "Other"
];

const methods = ["Cash", "M-Pesa", "Bank Transfer", "Card"];

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);

const inputClass =
  "block w-full min-w-0 rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

export default function ExpensesPage() {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError || !user) {
      setError("Please log in again to access expenses.");
      setLoading(false);
      return;
    }

    const { data: business, error: businessError } =
      await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

    if (businessError || !business) {
      setError(
        businessError?.message ||
        "No business profile found. Please set up your business first."
      );
      setLoading(false);
      return;
    }

    setBusinessId(business.id);
    setBusinessName(business.business_name);

    const { data, error: expenseError } = await supabase
      .from("expenses")
      .select("*")
      .eq("business_id", business.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (expenseError) {
      setError(expenseError.message);
    } else {
      setExpenses((data || []) as Expense[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount), 0
  );

  const today = new Date().toLocaleDateString("en-CA");

  const todayExpenses = expenses
    .filter(item => item.expense_date === today)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const monthExpenses = expenses
    .filter(item => item.expense_date.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, item) => sum + Number(item.amount), 0);

  function resetForm() {
    setCategory("Other");
    setDescription("");
    setAmount("");
    setPaymentMethod("Cash");
    setExpenseDate(today);
    setEditingId("");
  }

  function startEdit(item: Expense) {
    setEditingId(item.id);
    setCategory(item.category);
    setDescription(item.description || "");
    setAmount(String(item.amount));
    setPaymentMethod(item.payment_method);
    setExpenseDate(item.expense_date);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const numericAmount = Number(amount);

    if (!businessId) {
      setError("Business profile not found.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid expense amount greater than zero.");
      return;
    }

    if (!expenseDate) {
      setError("Please select the expense date.");
      return;
    }

    setSaving(true);

    const expenseData = {
      category,
      description: description.trim() || null,
      amount: numericAmount,
      payment_method: paymentMethod,
      expense_date: expenseDate
    };

    const result = editingId
      ? await supabase
          .from("expenses")
          .update({
            ...expenseData,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingId)
          .eq("business_id", businessId)
      : await supabase
          .from("expenses")
          .insert({
            ...expenseData,
            business_id: businessId
          });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSuccess(
      editingId
        ? "Expense updated successfully!"
        : "Expense recorded successfully!"
    );

    resetForm();
    await loadData();
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Expense deleted successfully!");
    if (editingId === id) resetForm();
    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex-1 bg-gray-50 p-6">
        <p className="text-sm text-gray-600">
          Loading MALIKEEP Expenses...
        </p>
      </main>
    );
  }

  return (
    <main className="relative left-0 box-border min-h-screen w-full min-w-0 max-w-full flex-1 overflow-x-clip bg-gray-50 px-3 py-4 sm:px-5 sm:py-6 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">

        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">
              {businessName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              Expenses
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Record business expenses and monitor where your money goes.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 sm:w-auto"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="break-words rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} />
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
             <p className="text-sm text-gray-500">Today&apos;s Expenses</p>
              <Wallet className="text-orange-600" size={22} />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {money(todayExpenses)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">This Month</p>
              <TrendingDown className="text-red-600" size={22} />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {money(monthExpenses)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">All Recorded Expenses</p>
              <Receipt className="text-green-700" size={22} />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {money(totalExpenses)}
            </p>
          </div>
        </section>

        <form
          onSubmit={saveExpense}
          className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3 text-green-700">
              {editingId ? <Pencil size={22} /> : <Plus size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Edit Expense" : "Record New Expense"}
              </h2>
              <p className="text-sm text-gray-500">
                Enter the details of your business expenditure.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Expense Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
                required
              >
                {categories.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Amount (KES)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className={inputClass}
                required
              >
                {methods.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description / Notes (Optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="What was this expense for?"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              <Plus size={18} />
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Expense"
                  : "Save Expense"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Receipt className="text-green-700" size={23} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Expense History
              </h2>
              <p className="text-sm text-gray-500">
                View, edit and manage recorded expenses.
              </p>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Wallet className="mx-auto mb-3 text-gray-400" size={34} />
              <p className="font-semibold text-gray-700">
                No expenses recorded yet.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Your recorded expenses will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {expenses.map(item => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">
                          {item.category}
                        </p>
                        <p className="mt-1 break-words text-sm text-gray-500">
                          {item.description || "No description"}
                        </p>
                      </div>
                      <p className="shrink-0 font-bold text-red-700">
                        {money(Number(item.amount))}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-gray-500">
                      <span>{item.expense_date}</span>
                      <span>{item.payment_method}</span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExpense(item.id)}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-3 pr-3">Date</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3">Payment</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="py-3 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap py-4 pr-3">
                          {item.expense_date}
                        </td>
                        <td className="px-3 py-4 font-medium">
                          {item.category}
                        </td>
                        <td className="max-w-[180px] break-words px-3 py-4 text-gray-600">
                          {item.description || "—"}
                        </td>
                        <td className="px-3 py-4">{item.payment_method}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-red-700">
                          {money(Number(item.amount))}
                        </td>
                        <td className="py-4 pl-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-lg bg-blue-50 p-2 text-blue-700"
                              aria-label="Edit expense"
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExpense(item.id)}
                              className="rounded-lg bg-red-50 p-2 text-red-700"
                              aria-label="Delete expense"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={4} className="py-4 font-bold">
                        Total Expenses
                      </td>
                      <td className="py-4 text-right font-bold text-red-700">
                        {money(totalExpenses)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
