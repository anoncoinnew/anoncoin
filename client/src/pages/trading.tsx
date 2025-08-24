import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, Shield, TrendingUp } from "lucide-react";
import { OrderBook } from "@/components/trading/order-book";
import { useWallet } from "@/hooks/use-wallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export default function Trading() {
  const { currentWallet } = useWallet();

  const { data: p2pInfo } = useQuery({
    queryKey: ['/api/p2p/nodes'],
    refetchInterval: 10000
  });

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-anon-purple rounded-lg flex items-center justify-center glow-purple">
          <ArrowLeftRight className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-anon-purple">P2P Торговля</h1>
          <p className="text-muted-foreground">Анонимная торговля anonCoin без посредников</p>
        </div>
      </div>

      {/* Состояние безопасности */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-effect border-anon-green">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-anon-green rounded-full pulse-animation"></div>
              <div>
                <div className="font-semibold text-anon-green">Анонимное P2P</div>
                <div className="text-xs text-muted-foreground">Шифрование активно</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-amber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-anon-amber" />
              <div>
                <div className="font-semibold text-anon-amber">Эскроу Защита</div>
                <div className="text-xs text-muted-foreground">Безопасные сделки</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-purple">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-anon-purple" />
              <div>
                <div className="font-semibold text-anon-purple">
                  {p2pInfo?.activeNodes || 0} Узлов
                </div>
                <div className="text-xs text-muted-foreground">Активные трейдеры</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Уведомление о необходимости кошелька */}
      {!currentWallet && (
        <Alert className="border-anon-red bg-red-900/20">
          <ArrowLeftRight className="h-4 w-4 text-anon-red" />
          <AlertDescription className="text-anon-red">
            Для торговли необходимо создать или восстановить кошелек в разделе "Кошелек"
          </AlertDescription>
        </Alert>
      )}

      {/* Order Book */}
      {currentWallet && (
        <OrderBook walletAddress={currentWallet.address} />
      )}

      {/* Trading Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-green">Как работает P2P торговля</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-anon-green rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Создание заявки</h4>
                  <p className="text-sm text-muted-foreground">
                    Создайте анонимную заявку на покупку или продажу anonCoin
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-anon-purple rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Эскроу блокировка</h4>
                  <p className="text-sm text-muted-foreground">
                    Средства автоматически блокируются в эскроу до завершения сделки
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-anon-amber rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Анонимный обмен</h4>
                  <p className="text-sm text-muted-foreground">
                    Обмен происходит через зашифрованные P2P каналы
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-red">Безопасность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Анонимность:</span>
                <span className="text-anon-green">Полная</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Шифрование:</span>
                <span className="text-anon-green">AES-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Эскроу:</span>
                <span className="text-anon-green">Умные контракты</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KYC:</span>
                <span className="text-anon-red">Не требуется</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Комиссия:</span>
                <span className="text-anon-amber">0.1%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Statistics */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-purple">Статистика Рынка (24ч)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-lg font-bold text-anon-green">₿0.0125</div>
              <div className="text-sm text-muted-foreground">Средняя цена</div>
            </div>
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-lg font-bold text-anon-purple">2,450</div>
              <div className="text-sm text-muted-foreground">Объем (anonCoin)</div>
            </div>
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-lg font-bold text-anon-amber">47</div>
              <div className="text-sm text-muted-foreground">Активные заявки</div>
            </div>
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-lg font-bold text-anon-green">156</div>
              <div className="text-sm text-muted-foreground">Завершенные сделки</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
