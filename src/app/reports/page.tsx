
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CircleDollarSign,
  Package
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Sale = {
  id: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  created_at: string;
};

type SaleItem = {
  sale_id: string;
  line_cost: number;
};

type Payment = {
  sale_id: string;
  amount: number;
  created_at: string;
};

type Expense = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
};

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);

const inputClass =
  "block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

export default function ReportsPage() {
  const today = localDate(new Date());
  const firstDayOfMonth = localDate(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [businessName, setBusinessName] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please log in again to access reports.");
      }

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      if (businessError) throw businessError;

      if (!business) {
        throw new Error(
          "No business profile found. Please set up your business first."
        );
      }

      setBusinessName(business.business_name);

      const start = new Date(`${startDate}T00:00:00`).toISOString();
      const end = new Date(
        new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
      ).toISOString();

      const [
        salesResult,
        itemsResult,
        paymentsResult,
        expensesResult
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total_amount, amount_paid, balance, created_at")
          .eq("business_id", business.id)
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false }),

        supabase
          .from("sale_items")
          .select("sale_id, line_cost")
          .eq("business_id", business.id)
          .gte("created_at", start)
          .lt("created_at", end),

        // Fetch all payment history so we can separate the
        // original sale payment from later repayments.
        supabase
          .from("customer_payments")
          .select("sale_id, amount, created_at")
          .eq("business_id", business.id),

        supabase
          .from("expenses")
          .select("id, category, amount, expense_date")
          .eq("business_id", business.id)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false })
      ]);

      if (salesResult.error) throw salesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;

      setSales((salesResult.data || []) as Sale[]);
      setSaleItems((itemsResult.data || []) as SaleItem[]);
      setPayments((paymentsResult.data || []) as Payment[]);
      setExpenses((expensesResult.data || []) as Expense[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial reports."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const costOfGoods = saleItems.reduce(
    (sum, item) => sum + Number(item.line_cost || 0),
    0
  );

  const grossProfit = revenue - costOfGoods;

  const operatingExpenses = expenses
    .filter(
      item => item.category.trim().toLowerCase() !== "stock purchase"
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const stockPurchases = expenses
    .filter(
      item => item.category.trim().toLowerCase() === "stock purchase"
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const netProfit = grossProfit - operatingExpenses;

  // Initial payments are stored on sales.amount_paid.
  // Later repayments are stored in customer_payments.
  const repaymentsBySale = new Map<string, number>();

  payments.forEach(payment => {
    const current = repaymentsBySale.get(payment.sale_id) || 0;
    repaymentsBySale.set(
      payment.sale_id,
      current + Number(payment.amount || 0)
    );
  });

  const initialPayments = sales.reduce((sum, sale) => {
    const laterPayments = repaymentsBySale.get(sale.id) || 0;
    const initialPayment = Math.max(
      0,
      Number(sale.amount_paid || 0) - laterPayments
    );

    return sum + initialPayment;
  }, 0);

  const startBoundary = new Date(`${startDate}T00:00:00`).getTime();
  const endBoundary = new Date(
    new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000
  ).getTime();

  const laterPaymentsInPeriod = payments
    .filter(payment => {
      const paymentTime = new Date(payment.created_at).getTime();
      return paymentTime >= startBoundary && paymentTime < endBoundary;
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const paymentsReceived = initialPayments + laterPaymentsInPeriod;

  const outstandingBalance = sales.reduce(
    (sum, sale) => sum + Number(sale.balance || 0),
    0
  );

  const saleCount = sales.length;

  const expenseBreakdown = expenses.reduce((result, item) => {
    const category = item.category || "Other";
    result[category] =
      (result[category] || 0) + Number(item.amount || 0);
    return result;
  }, {} as Record<string, number>);

  const expenseRows = Object.entries(expenseBreakdown).sort(
    (a, b) => b[1] - a[1]
  );

  function setPeriod(period: "today" | "week" | "month" | "year") {
    const now = new Date();
    const end = localDate(now);
    let start = end;

    if (period === "week") {
      const day = now.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - mondayOffset);
      start = localDate(monday);
    }

    if (period === "month") {
      start = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    }

    if (period === "year") {
      start = `${now.getFullYear()}-01-01`;
    }

    setStartDate(start);
    setEndDate(end);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex-1 bg-gray-50 p-6">
        <p className="text-sm text-gray-600">
          Loading MALIKEEP financial reports...
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
              Financial Reports
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Understand your sales, costs, expenses and business profit.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 sm:w-auto"
          >
            <RefreshCw size={16} />
            Refresh Report
          </button>
        </header>

        {error && (
          <div className="break-words rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-green-700" size={20} />
            <h2 className="font-bold text-gray-900">Report Period</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                From
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={event => setStartDate(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                To
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={event => setEndDate(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPeriod("today")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPeriod("year")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              This Year
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Sales Revenue</p>
              <TrendingUp className="text-green-700" size={22} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-gray-900">
              {money(revenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {saleCount} recorded sales
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Cost of Goods Sold</p>
              <Package className="text-orange-600" size={22} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-gray-900">
              {money(costOfGoods)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Cost of products sold
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Gross Profit</p>
              <BarChart3 className="text-blue-700" size={22} />
            </div>
            <p className={`mt-3 break-words text-2xl font-bold ${grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
              {money(grossProfit)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Revenue minus cost of goods
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Operating Expenses</p>
              <TrendingDown className="text-red-600" size={22} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-gray-900">
              {money(operatingExpenses)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Excludes stock purchases
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="text-green-700" size={23} />
            <h2 className="text-lg font-bold text-gray-900">
              Net Profit / Loss
            </h2>
          </div>

          <p className={`mt-4 break-words text-3xl font-bold sm:text-4xl ${netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
            {money(netProfit)}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Gross profit minus operating expenses for the selected period.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Sales Revenue</p>
              <p className="mt-1 font-semibold text-gray-900">
                {money(revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Gross Profit</p>
              <p className="mt-1 font-semibold text-gray-900">
                {money(grossProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Operating Expenses</p>
              <p className="mt-1 font-semibold text-gray-900">
                {money(operatingExpenses)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Payments Received</p>
              <Wallet className="text-green-700" size={22} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-gray-900">
              {money(paymentsReceived)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Initial payments and later repayments received in this period
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <Receipt className="text-orange-600" size={22} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-gray-900">
              {money(outstandingBalance)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Current unpaid balance on sales in this report period
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Package className="text-orange-600" size={21} />
            <h2 className="text-lg font-bold text-gray-900">
              Stock Purchases
            </h2>
          </div>

          <p className="mt-3 text-2xl font-bold text-gray-900">
            {money(stockPurchases)}
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Stock purchases are shown separately and are not deducted again
            from profit because the cost of goods sold is already calculated
            from the recorded sale items.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">
            Expense Breakdown
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Expenses recorded during the selected period.
          </p>

          {expenseRows.length === 0 ? (
            <p className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              No expenses recorded for this period.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {expenseRows.map(([category, amount]) => (
                <div
                  key={category}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm text-gray-700">
                    {category}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {money(amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-gray-500">
          Figures are based on records currently saved in MALIKEEP. This
          report uses sales revenue and the cost captured when each product
          was sold. Payments received and outstanding balances are shown
          separately from profit.
        </p>
      </div>
    </main>
  );
}
