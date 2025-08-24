import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Wallet, 
  Hammer, 
  ArrowLeftRight, 
  List,
  UserCheck,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet"; // подключаем твой хук

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ href, icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start px-4 py-3 h-auto text-left transition-all duration-200",
        isActive 
          ? "nav-active" 
          : "nav-inactive"
      )}
      onClick={onClick}
    >
      <Icon className="mr-3 h-5 w-5" />
      {label}
    </Button>
  );
}

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { hasWallet, clearWallet } = useWallet(); // достаём состояние кошелька
  const { data: blockchainInfo } = useQuery({
    queryKey: ['/api/blockchain/info'],
    refetchInterval: 5000
  });

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Панель управления" },
    { href: "/wallet", icon: Wallet, label: "Кошелек" },
    { href: "/mining", icon: Hammer, label: "Майнинг" },
    { href: "/trading", icon: ArrowLeftRight, label: "P2P Торговля" },
    { href: "/transactions", icon: List, label: "Транзакции" },
  ];

  return (
    <aside className="w-72 glass-effect border-r border-anon-gray flex flex-col">
      <div className="p-6">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={location === item.href}
              onClick={() => setLocation(item.href)}
            />
          ))}

          {/* Кнопка выхода — только если кошелёк активен */}
          {hasWallet && (
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-3 h-auto text-left text-red-500 hover:text-red-600"
              onClick={() => {
                clearWallet();
                setLocation("/wallet");
              }}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Выйти
            </Button>
          )}
        </nav>
      </div>

      {/* Статус блокчейна */}
      <div className="mt-auto p-6">
        <div className="glass-effect rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-4">
            <UserCheck className="w-5 h-5 text-anon-green" />
            <h3 className="font-semibold text-anon-green">Статус Сети</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Блоков:</span>
              <span className="font-mono text-anon-green">
                {blockchainInfo?.totalBlocks?.toLocaleString() || '0'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Эмиссия:</span>
              <span className="font-mono text-anon-amber">
                {blockchainInfo?.totalSupply || '0'} anonCoin
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">P2P Узлов:</span>
              <span className="font-mono text-anon-green">
                {blockchainInfo?.activeNodes || 0}
              </span>
            </div>
            
            <div className="pt-2 border-t border-anon-gray">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Анонимность:</span>
                <span className="text-anon-green text-xs">
                  Кольцевые подписи
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
