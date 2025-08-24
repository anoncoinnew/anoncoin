import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Settings, Hammer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MiningControlsProps {
  walletAddress: string;
}

export function MiningControls({ walletAddress }: MiningControlsProps) {
  const [miningProgress, setMiningProgress] = useState(0);
  const [hashRate, setHashRate] = useState(0);
  const [miningStartTime, setMiningStartTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: miningStats, isLoading } = useQuery({
    queryKey: ['/api/mining/stats', walletAddress],
    enabled: !!walletAddress,
    refetchInterval: 2000
  });

  const startMiningMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/mining/start', { walletAddress }),
    onSuccess: () => {
      setMiningStartTime(new Date());
      toast({
        title: "Майнинг запущен",
        description: "Начат поиск новых блоков с повышенной сложностью"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mining/stats'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить майнинг",
        variant: "destructive"
      });
    }
  });

  const stopMiningMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/mining/stop', { walletAddress }),
    onSuccess: () => {
      setMiningStartTime(null);
      setMiningProgress(0);
      setHashRate(0);
      toast({
        title: "Майнинг остановлен",
        description: "Поиск блоков прекращен"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mining/stats'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось остановить майнинг",
        variant: "destructive"
      });
    }
  });

  // Симуляция прогресса майнинга когда активен
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (miningStats?.isActive) {
      interval = setInterval(() => {
        // Симуляция майнинга с повышенной сложностью
        const newProgress = Math.min(100, miningProgress + Math.random() * 2);
        const newHashRate = Math.floor(Math.random() * 300 + 200); // 200-500 H/s из-за высокой сложности
        
        setMiningProgress(newProgress);
        setHashRate(newHashRate);
        
        // Сброс прогресса когда блок "найден"
        if (newProgress >= 100) {
          setMiningProgress(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [miningStats?.isActive, miningProgress]);

  const formatUptime = () => {
    if (!miningStartTime) return "00:00:00";
    
    const now = new Date();
    const diff = now.getTime() - miningStartTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isActive = miningStats?.isActive || false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Управление майнингом */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-amber flex items-center">
            <Hammer className="mr-2 h-5 w-5" />
            Майнинг Контроль
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Индикатор статуса майнинга */}
          <div className="text-center p-6 bg-anon-gray rounded-lg">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isActive ? 'bg-anon-green glow-green' : 'bg-anon-red'
            }`}>
              {isActive ? (
                <Hammer className="h-8 w-8 text-white animate-pulse" />
              ) : (
                <Square className="h-8 w-8 text-white" />
              )}
            </div>
            <div className={`text-xl font-bold mb-2 ${
              isActive ? 'text-anon-green' : 'text-anon-red'
            }`}>
              {isActive ? 'Активен' : 'Остановлен'}
            </div>
            <div className="text-muted-foreground text-sm">
              {isActive ? 'Поиск блоков с повышенной сложностью' : 'Нажмите кнопку для начала майнинга'}
            </div>
          </div>

          {/* Кнопки управления */}
          <div className="space-y-3">
            <Button
              onClick={isActive ? () => stopMiningMutation.mutate() : () => startMiningMutation.mutate()}
              disabled={startMiningMutation.isPending || stopMiningMutation.isPending || !walletAddress}
              className={`w-full ${
                isActive 
                  ? 'bg-anon-red hover:bg-red-600' 
                  : 'bg-anon-green hover:bg-green-600'
              } text-white`}
            >
              {isActive ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Остановить Майнинг
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Начать Майнинг
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full border-anon-gray text-muted-foreground hover:bg-anon-gray"
              onClick={() => toast({ title: "Настройки", description: "Функция настроек в разработке" })}
            >
              <Settings className="mr-2 h-4 w-4" />
              Настройки Майнинга
            </Button>
          </div>

          {/* Прогресс майнинга */}
          {isActive && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Прогресс текущего блока</div>
              <Progress 
                value={miningProgress} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{hashRate} H/s</span>
                <span>{miningProgress.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mining Statistics */}
      <div className="space-y-6">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-purple">Статистика Майнинга</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Добыто блоков:</span>
                <span className="font-mono text-anon-green">
                  {miningStats?.blocksMinedCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Общая награда:</span>
                <span className="font-mono text-anon-purple">
                  {miningStats?.totalRewards || '0'} anonCoin
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Средний хешрейт:</span>
                <span className="font-mono text-anon-amber">
                  {miningStats?.hashRate || '0'} H/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время работы:</span>
                <span className="font-mono text-foreground">
                  {formatUptime()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network Difficulty */}
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-red">Сложность Сети</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-anon-red mb-2">Высокая</div>
                <div className="text-muted-foreground">Уровень 8/10</div>
              </div>
              <Progress value={80} className="h-3" />
              <div className="text-xs text-muted-foreground text-center">
                Следующее изменение через ~2,156 блоков
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
