
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Package,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

const stats = [
  {
    title: "Today's Sales",
    amount: "KES 0.00",
    note: "No sales recorded yet",
    icon: ShoppingCart,
  },
  {
    title: "Today's Expenses",
    amount: "KES 0.00",
    note: "No expenses recorded yet",
    icon: Wallet,
  },
  {
    title: "Today's Profit",
    amount: "KES 0.00",
    note: "Based on recorded activity",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Outstanding Debts",
    amount: "KES 0.00",
    note: "Customer balances",
    icon: CreditCard,
  },
];

const modules = [
  { name: "Record Sale", description: "Record a customer purchase", icon: ShoppingCart },
  { name: "Add Product", description: "Manage your inventory", icon: Package },
  { name: "Add Expense", description: "Track business spending", icon: Wallet },
  { name: "Customers", description: "Manage customer accounts", icon: Users },
  { name: "Stock", description: "Monitor available products", icon: Boxes },
  { name: "Reports", description: "Review business performance", icon: Activity },
];

export default function Home() {
  return (
    <main className="app-container">
      <header style={{
        background: "#103522",
        color: "white",
        padding: "19px 5%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12
      }}>
        <div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: 1 }}>
            MALI<span style={{ color: "#9bc9a8" }}>KEEP</span>
          </h2>
          <p style={{ fontSize: 11, color: "#c5d9cb" }}>
            Know Your Business. Grow Your Business.
          </p>
        </div>
        <div style={{ fontSize: 13, color: "#d9e7dd" }}>
          Small Business Management
        </div>
      </header>

      <div style={{
        display: "flex",
        minHeight: "calc(100vh - 75px)"
      }}>
        <aside style={{
          width: 225,
          background: "#164a32",
          padding: 22,
          color: "white",
          flexShrink: 0
        }}>
          <p style={{
            fontSize: 11,
            color: "#b5d0bd",
            marginBottom: 18,
            letterSpacing: 1
          }}>
            MAIN MENU
          </p>

          {[
            "Dashboard",
            "Sales",
            "Products",
            "Inventory",
            "Expenses",
            "Customers",
            "Suppliers",
            "Reports",
            "Settings"
          ].map((item, index) => (
            <div key={item} style={{
              padding: "12px 13px",
              borderRadius: 8,
              marginBottom: 5,
              background: index === 0 ? "#286b47" : "transparent",
              fontSize: 14,
              fontWeight: index === 0 ? 700 : 500
            }}>
              {item}
            </div>
          ))}

          <div style={{
            marginTop: 35,
            padding: 13,
            borderTop: "1px solid #46765a",
            fontSize: 12,
            color: "#c5d9cb"
          }}>
            MALIKEEP
            <p style={{ marginTop: 6 }}>Business management made simple.</p>
          </div>
        </aside>

        <section style={{
          flex: 1,
          minWidth: 0,
          padding: "30px 25px"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 15,
            marginBottom: 28
          }}>
            <div>
              <h1 className="page-title">Business Overview</h1>
              <p className="page-subtitle">
                Welcome to your business dashboard.
              </p>
            </div>
            <div style={{
              background: "#e8f1eb",
              color: "#164a32",
              padding: "10px 15px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700
            }}>
              Currency: KES
            </div>
          </div>

          <div className="grid grid-4" style={{ marginBottom: 25 }}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="card" key={stat.title}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                  }}>
                    <p style={{ color: "#718078", fontSize: 13 }}>
                      {stat.title}
                    </p>
                    <Icon size={21} color="#2e8053" />
                  </div>
                  <h2 style={{
                    fontSize: 22,
                    color: "#164a32",
                    marginBottom: 9
                  }}>
                    {stat.amount}
                  </h2>
                  <p style={{ color: "#89958d", fontSize: 11 }}>
                    {stat.note}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="section-heading">
              <div>
                <h2 style={{ fontSize: 18 }}>Quick Actions</h2>
                <p className="page-subtitle">
                  Your essential business tools in one place.
                </p>
              </div>
              <BriefcaseBusiness size={23} color="#2e8053" />
            </div>

            <div className="grid grid-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <div key={module.name} style={{
                    border: "1px solid #e4ebe6",
                    padding: 17,
                    borderRadius: 10,
                    background: "#fbfdfb"
                  }}>
                    <Icon size={23} color="#286b47" />
                    <h3 style={{ fontSize: 14, marginTop: 13 }}>
                      {module.name}
                    </h3>
                    <p style={{
                      color: "#718078",
                      fontSize: 11,
                      marginTop: 5
                    }}>
                      {module.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="section-heading">
                <h2 style={{ fontSize: 17 }}>Recent Sales</h2>
                <ShoppingCart size={21} color="#2e8053" />
              </div>
              <div style={{
                textAlign: "center",
                padding: "28px 10px",
                color: "#718078"
              }}>
                <ArrowUpRight size={30} color="#9aafa1" />
                <p style={{ marginTop: 10, fontSize: 13 }}>
                  No sales recorded yet.
                </p>
                <p style={{ fontSize: 11, marginTop: 5 }}>
                  Your recorded sales will appear here.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="section-heading">
                <h2 style={{ fontSize: 17 }}>Business Activity</h2>
                <Activity size={21} color="#2e8053" />
              </div>
              <div style={{
                textAlign: "center",
                padding: "28px 10px",
                color: "#718078"
              }}>
                <CircleDollarSign size={30} color="#9aafa1" />
                <p style={{ marginTop: 10, fontSize: 13 }}>
                  Your business activity will appear here.
                </p>
                <p style={{ fontSize: 11, marginTop: 5 }}>
                  Start by setting up your business.
                </p>
              </div>
            </div>
          </div>

          <footer style={{
            textAlign: "center",
            padding: "28px 10px",
            color: "#89958d",
            fontSize: 11
          }}>
            © 2026 MALIKEEP. All rights reserved.
          </footer>
        </section>
      </div>
    </main>
  );
}
