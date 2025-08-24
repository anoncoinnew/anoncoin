import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer, Zap, Award, Clock } from "lucide-react";
import { MiningControls } from "@/components/mining/mining-controls";
import { useWallet } from "@/hooks/use-wallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export default function Mining() {
  const { currentWallet } = useWallet();

  const { data: blockchainInfo } = useQuery({
    queryKey: ['/api/blockchain/info'],
    refetchInterval: 5000
  });

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-anon-amber rounded-lg flex items-center justify-center glow-green">
          <Hammer className="h-6 w-6 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-anon-amber">Майнинг</h1>
          <p className="text-muted-foreground">Добыча anonCoin с повышенной сложностью</p>
        </div>
      </div>

      {/* Уведомление о необходимости кошелька */}
      {!currentWallet && (
        <Alert className="border-anon-red bg-red-900/20">
          <Hammer className="h-4 w-4 text-anon-red" />
          <AlertDescription className="text-anon-red">
            Для начала майнинга необходимо создать или восстановить кошелек в разделе "Кошелек"
          </AlertDescription>
        </Alert>
      )}

      {/* Управление майнингом */}
      {currentWallet && (
        <MiningControls walletAddress={currentWallet.address} />
      )}

      {/* Информация о майнинг-пуле */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-green flex items-center">
            <Zap className="mr-2 h-5 w-5" />
            Информация о Майнинге
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <Award className="h-8 w-8 text-anon-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-anon-green mb-1">Solo</div>
              <div className="text-sm text-muted-foreground">Режим майнинга</div>
            </div>
            
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-2xl font-bold text-anon-purple mb-1">25.0</div>
              <div className="text-sm text-muted-foreground">Награда за блок (anonCoin)</div>
            </div>
            
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <Clock className="h-8 w-8 text-anon-amber mx-auto mb-2" />
              <div className="text-2xl font-bold text-anon-amber mb-1">~15 мин</div>
              <div className="text-sm text-muted-foreground">Среднее время блока</div>
            </div>
            
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="text-2xl font-bold text-anon-red mb-1">8/10</div>
              <div className="text-sm text-muted-foreground">Уровень сложности</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Mining Algorithm Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-purple">Алгоритм Майнинга</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Алгоритм:</span>
                <span className="font-mono text-anon-purple">Enhanced SHA-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сложность:</span>
                <span className="font-mono text-anon-red">
                  {blockchainInfo?.difficulty || 8} (Высокая)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Целевое время:</span>
                <span className="font-mono text-anon-amber">15 минут</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Перерасчет:</span>
                <span className="font-mono text-anon-green">Каждые 2016 блоков</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-green">Экономика Майнинга</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Текущая награда:</span>
                <span className="font-mono text-anon-green">25 anonCoin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Халвинг через:</span>
                <span className="font-mono text-anon-amber">~184,320 блоков</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Макс. эмиссия:</span>
                <span className="font-mono text-anon-purple">33,000,000 anonCoin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Комиссии майнерам:</span>
                <span className="font-mono text-anon-green">100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Features */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-red">Безопасность Майнинга</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="w-12 h-12 bg-anon-green rounded-full flex items-center justify-center mx-auto mb-3">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-anon-green mb-2">Защита от ASIC</h3>
              <p className="text-sm text-muted-foreground">
                Алгоритм адаптирован для GPU майнинга
              </p>
            </div>
            
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="w-12 h-12 bg-anon-purple rounded-full flex items-center justify-center mx-auto mb-3">
                <Hammer className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-anon-purple mb-2">Децентрализация</h3>
              <p className="text-sm text-muted-foreground">
                Независимые майнеры по всему миру
              </p>
            </div>
            
            <div className="text-center p-4 bg-anon-gray rounded-lg">
              <div className="w-12 h-12 bg-anon-amber rounded-full flex items-center justify-center mx-auto mb-3">
                <Award className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-anon-amber mb-2">Справедливость</h3>
              <p className="text-sm text-muted-foreground">
                Равные возможности для всех майнеров
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
