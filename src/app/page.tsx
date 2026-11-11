
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Sale = {
  id: string;
  sale_number: string | null;
  customer_name: string | null;
  total_amount: number;
  balance: number;
  payment_status: string | null;
  created_at: string;
};

type SaleItem = {
  line_cost: number;
};

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at?: string;
};

type Product = {
  id: string;
  product_name: string;
  quantity: number;
  low_stock_threshold: number;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  amount: number;
  date: string;
  type: "sale" | "expense";
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const navigation = [
  { name: "Dashboard", href: "/", icon: ChartNoAxesCombined },
  { name: "Sales", href: "/sales", icon: ShoppingCart },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Expenses", href: "/expenses", icon: Wallet },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Reports", href: "/reports", icon: Activity },
];

const quickActions = [
  {
    name: "Record Sale",
    description: "Record a customer purchase",
    href: "/sales",
    icon: ShoppingCart,
  },
  {
    name: "Add Product",
    description: "Manage your inventory",
    href: "/products",
    icon: Package,
  },
  {
    name: "Add Expense",
    description: "Track business spending",
    href: "/expenses",
    icon: Wallet,
  },
  {
    name: "Customers",
    description: "Manage customer accounts",
    href: "/customers",
    icon: Users,
  },
  {
    name: "Stock",
    description: "Monitor available products",
    href: "/inventory",
    icon: Boxes,
  },
  {
    name: "Reports",
    description: "Review business performance",
    href: "/reports",
    icon: Activity,
  },
];

export default function Home() {
  const [businessName, setBusinessName] = useState("");
  const [salesToday, setSalesToday] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);
  const [profitToday, setProfitToday] = useState(0);
  const [outstandingDebts, setOutstandingDebts] = useState(0);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please log in again to access your dashboard.");
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
          "No business profile found. Please complete your business setup."
        );
      }

      setBusinessName(business.business_name);

      const now = new Date();
      const today = localDate(now);
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();
      const startOfTomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ).toISOString();

      const [
        todaySalesResult,
        recentSalesResult,
        outstandingResult,
        todayExpensesResult,
        recentExpensesResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total_amount, balance, created_at")
          .eq("business_id", business.id)
          .gte("created_at", startOfToday)
          .lt("created_at", startOfTomorrow),

        supabase
          .from("sales")
          .select(
            "id, sale_number, customer_name, total_amount, balance, payment_status, created_at"
          )
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("sales")
          .select("balance")
          .eq("business_id", business.id)
          .gt("balance", 0),

        supabase
          .from("expenses")
          .select("id, category, description, amount, expense_date, created_at")
          .eq("business_id", business.id)
          .eq("expense_date", today),

        supabase
          .from("expenses")
          .select("id, category, description, amount, expense_date, created_at")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("products")
          .select("id, product_name, quantity, low_stock_threshold")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("quantity", { ascending: true })
          .limit(100),
      ]);

      if (todaySalesResult.error) throw todaySalesResult.error;
      if (recentSalesResult.error) throw recentSalesResult.error;
      if (outstandingResult.error) throw outstandingResult.error;
      if (todayExpensesResult.error) throw todayExpensesResult.error;
      if (recentExpensesResult.error) throw recentExpensesResult.error;
      if (productsResult.error) throw productsResult.error;

      const todaySalesData = todaySalesResult.data || [];
      const recentSalesData = (recentSalesResult.data || []) as Sale[];
      const todayExpensesData = (todayExpensesResult.data || []) as Expense[];
      const recentExpensesData = (recentExpensesResult.data || []) as Expense[];

      const revenue = todaySalesData.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      const expenses = todayExpensesData
        .filter(
          (expense) =>
            expense.category.trim().toLowerCase() !== "stock purchase"
        )
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      let costOfGoods = 0;

      if (todaySalesData.length > 0) {
        const saleIds = todaySalesData.map((sale) => sale.id);

        const { data: items, error: itemsError } = await supabase
          .from("sale_items")
          .select("line_cost")
          .eq("business_id", business.id)
          .in("sale_id", saleIds);

        if (itemsError) throw itemsError;

        costOfGoods = ((items || []) as SaleItem[]).reduce(
          (sum, item) => sum + Number(item.line_cost || 0),
          0
        );
      }

      const outstanding = (outstandingResult.data || []).reduce(
        (sum, sale) => sum + Number(sale.balance || 0),
        0
      );

      setSalesToday(revenue);
      setExpensesToday(expenses);
      setProfitToday(revenue - costOfGoods - expenses);
      setOutstandingDebts(outstanding);
      setRecentSales(recentSalesData);

      const activities: ActivityItem[] = [
        ...recentSalesData.map((sale) => ({
          id: `sale-${sale.id}`,
          title: `Sale ${sale.sale_number || ""}`.trim(),
          detail: sale.customer_name || "Walk-in customer",
          amount: Number(sale.total_amount || 0),
          date: sale.created_at,
          type: "sale" as const,
        })),
        ...recentExpensesData.map((expense) => ({
          id: `expense-${expense.id}`,
          title: expense.category || "Expense",
          detail: expense.description || "Business expense",
          amount: Number(expense.amount || 0),
          date: expense.created_at || expense.expense_date,
          type: "expense" as const,
        })),
      ];

      activities.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setRecentActivity(activities.slice(0, 6));

      const products = (productsResult.data || []) as Product[];

      setLowStockProducts(
        products.filter(
          (product) =>
            Number(product.quantity) <=
            Number(product.low_stock_threshold)
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-600">
          Loading your MALIKEEP dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#103522] px-5 py-4 text-white sm:px-8">
        <div>
          <h2 className="text-2xl font-extrabold tracking-wide">
            MALI<span className="text-[#9bc9a8]">KEEP</span>
          </h2>
          <p className="text-xs text-[#c5d9cb]">
            Know Your Business. Grow Your Business.
          </p>
        </div>
        <div className="text-xs text-[#d9e7dd] sm:text-sm">
          Small Business Management
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-75px)]">
        <aside className="hidden w-56 shrink-0 bg-[#164a32] p-5 text-white md:block">
          <p className="mb-5 text-xs font-semibold tracking-widest text-[#b5d0bd]">
            MAIN MENU
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/";

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#286b47] font-bold"
                      : "text-white/90 hover:bg-[#286b47]"
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 border-t border-[#46765a] pt-5 text-xs text-[#c5d9cb]">
            MALIKEEP
            <p className="mt-2">Business management made simple.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:p-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-green-700">
                  {businessName}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
                  Business Overview
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Welcome to your live business dashboard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-green-50 px-4 py-3 text-xs font-bold text-green-800">
                  Currency: KES
                </span>
                <button
                  type="button"
                  onClick={loadDashboard}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="break-words rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                    item.href === "/"
                      ? "bg-green-800 text-white"
                      : "border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Today&apos;s Sales</p>
                  <ShoppingCart className="text-green-700" size={22} />
                </div>
                <p className="mt-3 break-words text-2xl font-bold text-gray-900">
                  {money(salesToday)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Total sales recorded today
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Today&apos;s Expenses</p>
                  <Wallet className="text-orange-600" size={22} />
                </div>
                <p className="mt-3 break-words text-2xl font-bold text-gray-900">
                  {money(expensesToday)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Operating expenses only
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Today&apos;s Profit</p>
                  <ChartNoAxesCombined className="text-blue-700" size={22} />
                </div>
                <p
                  className={`mt-3 break-words text-2xl font-bold ${
                    profitToday >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {money(profitToday)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  After product costs and expenses
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Outstanding Debts</p>
                  <CreditCard className="text-orange-600" size={22} />
                </div>
                <p className="mt-3 break-words text-2xl font-bold text-gray-900">
                  {money(outstandingDebts)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Current unpaid customer balances
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Quick Actions
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Your essential business tools in one place.
                  </p>
                </div>
                <BriefcaseBusiness className="text-green-700" size={23} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.name}
                      href={action.href}
                      className="group rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-green-300 hover:bg-green-50"
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="text-green-800" size={23} />
                        <ChevronRight
                          size={18}
                          className="text-gray-400 transition group-hover:translate-x-1"
                        />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-gray-900">
                        {action.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {action.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Recent Sales
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Your latest recorded transactions.
                    </p>
                  </div>
                  <ShoppingCart className="text-green-700" size={22} />
                </div>

                {recentSales.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No sales recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {sale.sale_number || "Sale"}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {sale.customer_name || "Walk-in customer"}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(sale.created_at).toLocaleString("en-KE")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {money(Number(sale.total_amount || 0))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {sale.payment_status || "Recorded"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href="/sales"
                  className="mt-3 flex items-center justify-center gap-1 border-t border-gray-100 pt-4 text-sm font-semibold text-green-800 hover:text-green-600"
                >
                  View Sales <ChevronRight size={16} />
                </Link>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Business Activity
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Recent sales and expenses.
                    </p>
                  </div>
                  <Activity className="text-green-700" size={22} />
                </div>

                {recentActivity.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No recent business activity.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`rounded-full p-2 ${
                              item.type === "sale"
                                ? "bg-green-50"
                                : "bg-orange-50"
                            }`}
                          >
                            {item.type === "sale" ? (
                              <ArrowUpRight
                                size={17}
                                className="text-green-700"
                              />
                            ) : (
                              <ArrowDownRight
                                size={17}
                                className="text-orange-600"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {item.title}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {item.detail}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(item.date).toLocaleString("en-KE")}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-bold ${
                            item.type === "sale"
                              ? "text-green-700"
                              : "text-orange-600"
                          }`}
                        >
                          {item.type === "sale" ? "+" : "-"}
                          {money(item.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Low Stock Alerts
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Products at or below their stock warning level.
                  </p>
                </div>
                <CircleAlert className="text-orange-600" size={23} />
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                  No low-stock products detected. Your stock levels are looking good.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        {product.product_name}
                      </p>
                      <p className="text-sm font-semibold text-orange-700">
                        {product.quantity} remaining
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/inventory"
                className="mt-3 flex items-center justify-center gap-1 border-t border-gray-100 pt-4 text-sm font-semibold text-green-800 hover:text-green-600"
              >
                View Inventory <ChevronRight size={16} />
              </Link>
            </section>

            <footer className="py-5 text-center text-xs text-gray-400">
              © 2026 MALIKEEP. All rights reserved.
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
