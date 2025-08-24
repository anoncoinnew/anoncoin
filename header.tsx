import { Shield, Users, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const { data: blockchainInfo } = useQuery({
    queryKey: ['/api/blockchain/info'],
    refetchInterval: 5000
  });

  const { data: p2pInfo } = useQuery({
    queryKey: ['/api/p2p/nodes'],
    refetchInterval: 10000
  });

  return (
    <header className="glass-effect border-b border-anon-gray">
      <div className="px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Логотип и название */}
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-anon-purple rounded-lg flex items-center justify-center glow-purple">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-anon-purple">anonCoin</h1>
              <p className="text-xs text-muted-foreground">Анонимный блокчейн</p>
            </div>
          </div>

          {/* Индикаторы состояния */}
          <div className="flex items-center space-x-6">
            {/* Сложность майнинга */}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Сложность майнинга</div>
              <div className="text-anon-amber font-mono font-semibold">Высокая (8/10)</div>
            </div>

            {/* Статус сети */}
            <div className="flex items-center space-x-2 glass-effect rounded-lg px-3 py-2">
              <div className="w-2 h-2 bg-anon-green rounded-full pulse-animation"></div>
              <span className="text-sm text-anon-green">P2P Зашифровано</span>
              <Shield className="w-4 h-4 text-anon-green" />
            </div>

            {/* Активные узлы */}
            <div className="flex items-center space-x-2 text-sm">
              <Users className="w-4 h-4 text-anon-purple" />
              <span className="text-muted-foreground">Узлов:</span>
              <span className="text-anon-green font-mono">
                {p2pInfo?.activeNodes || 0}
              </span>
            </div>

            {/* Хешрейт сети */}
            <div className="flex items-center space-x-2 text-sm">
              <Zap className="w-4 h-4 text-anon-amber" />
              <span className="text-muted-foreground">Сеть:</span>
              <span className="text-anon-amber font-mono">
                {blockchainInfo?.networkHashRate || '0 H/s'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
