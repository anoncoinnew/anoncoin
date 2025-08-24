import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import Dashboard from "@/pages/dashboard";
import Wallet from "@/pages/wallet";
import Mining from "@/pages/mining";
import Trading from "@/pages/trading";
import Transactions from "@/pages/transactions";
import NotFound from "@/pages/not-found";

// иконки
import { Home, Wallet as WalletIcon, Pickaxe, LineChart, Link } from "lucide-react";

function Router() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-anon-black to-anon-dark">
      {/* Sidebar для ПК */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Sidebar для мобильных */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/70">
          <div className="w-64 bg-anon-dark h-full shadow-lg p-4 flex flex-col">
            <button
              className="mb-6 flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl glass-effect hover:bg-anon-purple/40 transition"
              onClick={() => setSidebarOpen(false)}
            >
              ✕ Закрыть
            </button>

            {/* Мобильное меню кнопками */}
            <nav className="flex flex-col space-y-3">
              <a
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-effect text-white hover:bg-anon-purple/30 transition"
              >
                <Home className="w-5 h-5 text-anon-purple" />
                <span className="font-semibold">Панель управления</span>
              </a>

              <a
                href="/wallet"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-effect text-white hover:bg-anon-purple/30 transition"
              >
                <WalletIcon className="w-5 h-5 text-anon-amber" />
                <span className="font-semibold">Кошелёк</span>
              </a>

              <a
                href="/mining"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-effect text-white hover:bg-anon-purple/30 transition"
              >
                <Pickaxe className="w-5 h-5 text-anon-green" />
                <span className="font-semibold">Майнинг</span>
              </a>

              <a
                href="/trading"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-effect text-white hover:bg-anon-purple/30 transition"
              >
                <LineChart className="w-5 h-5 text-anon-red" />
                <span className="font-semibold">Торговля</span>
              </a>

              <a
                href="/transactions"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-effect text-white hover:bg-anon-purple/30 transition"
              >
                <Link className="w-5 h-5 text-anon-blue" />
                <span className="font-semibold">Транзакции</span>
              </a>
            </nav>
          </div>
        </div>
      )}

      {/* Основной контейнер */}
      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 flex flex-col">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/wallet" component={Wallet} />
            <Route path="/mining" component={Mining} />
            <Route path="/trading" component={Trading} />
            <Route path="/transactions" component={Transactions} />
            <Route component={NotFound} />
          </Switch>

          {/* Футер на всех страницах */}
          <footer className="mt-auto text-center text-gray-400 text-sm py-2">
            &copy; 2025 AnonCoin – Ваша анонимность наша работа 
          </footer>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
