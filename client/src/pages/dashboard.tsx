import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Hammer, VenetianMask, TrendingUp, ArrowDown, ArrowUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: blockchainInfo } = useQuery({
    queryKey: ['/api/blockchain/info'],
    refetchInterval: 5000
  });

  // Заглушка последней активности - в продакшене будет из API
  const recentActivity = [
    {
      id: 1,
      type: 'received',
      amount: '+50.0',
      description: 'Анонимная транзакция',
      time: '2 минуты назад',
      icon: ArrowDown,
      color: 'text-anon-green',
      bgColor: 'bg-anon-green'
    },
    {
      id: 2,
      type: 'mining',
      amount: '+25.0',
      description: 'Награда за майнинг',
      time: '15 минут назад',
      icon: Hammer,
      color: 'text-anon-purple',
      bgColor: 'bg-anon-purple'
    },
    {
      id: 3,
      type: 'sent',
      amount: '-15.5',
      description: 'P2P торговля',
      time: '1 час назад',
      icon: ArrowUp,
      color: 'text-anon-red',
      bgColor: 'bg-anon-red'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-effect border-anon-gray glow-purple">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg font-semibold">Баланс</CardTitle>
              <Coins className="h-6 w-6 text-anon-purple" />
            </div>
            <div className="text-3xl font-bold text-anon-purple mb-2">
              {parseFloat(blockchainInfo?.totalSupply || '0').toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">anonCoin</div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-gray">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg font-semibold">Майнинг</CardTitle>
              <Hammer className="h-6 w-6 text-anon-amber" />
            </div>
            <div className="text-2xl font-bold text-anon-amber mb-2">
              Остановлен
            </div>
            <div className="text-sm text-muted-foreground">
              Последняя награда: 25 anonCoin
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-gray">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg font-semibold">Анонимность</CardTitle>
              <VenetianMask className="h-6 w-6 text-anon-green" />
            </div>
            <div className="text-2xl font-bold text-anon-green mb-2">
              Активна
            </div>
            <div className="text-sm text-muted-foreground">
              Кольцевые подписи (5 узлов)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Последняя активность */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Последняя Активность</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 bg-anon-gray rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 ${activity.bgColor} rounded-full flex items-center justify-center`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {activity.type === 'received' && 'Получено'}
                        {activity.type === 'mining' && 'Награда за майнинг'}
                        {activity.type === 'sent' && 'Отправлено'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${activity.color}`}>
                      {activity.amount} anonCoin
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activity.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Обзор сети */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-anon-green">
              Состояние Сети
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Всего блоков:</span>
                <span className="font-mono text-anon-green">
                  {blockchainInfo?.totalBlocks?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Активные узлы:</span>
                <span className="font-mono text-anon-green">
                  {blockchainInfo?.activeNodes || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сложность:</span>
                <span className="font-mono text-anon-red">
                  Высокая ({blockchainInfo?.difficulty || 8}/10)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хешрейт сети:</span>
                <span className="font-mono text-anon-amber">
                  {blockchainInfo?.networkHashRate || '0 H/s'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-anon-purple">
              Безопасность
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">P2P Шифрование:</span>
                <span className="text-anon-green">
                  {blockchainInfo?.isEncrypted ? 'Активно' : 'Неактивно'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Анонимные TX:</span>
                <span className="text-anon-green">Кольцевые подписи</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Защита от Sybil:</span>
                <span className="text-anon-green">Активна</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MITM защита:</span>
                <span className="text-anon-green">TLS/SSL</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
