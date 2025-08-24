import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowUpDown, Plus, Shield, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface OrderBookProps {
  walletAddress: string;
}

export function OrderBook({ walletAddress }: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'BTC' | 'USDT'>('BTC');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: buyOrders } = useQuery({
    queryKey: ['/api/trading/orders', { type: 'buy' }],
    refetchInterval: 5000
  });

  const { data: sellOrders } = useQuery({
    queryKey: ['/api/trading/orders', { type: 'sell' }],
    refetchInterval: 5000
  });

  const { data: myOrders } = useQuery({
    queryKey: ['/api/trading/orders', walletAddress],
    enabled: !!walletAddress,
    refetchInterval: 10000
  });

  const createOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest('POST', '/api/trading/orders', orderData),
    onSuccess: () => {
      toast({
        title: "Заявка создана",
        description: "Анонимная торговая заявка успешно создана"
      });
      setAmount('');
      setPrice('');
      queryClient.invalidateQueries({ queryKey: ['/api/trading/orders'] });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать заявку",
        variant: "destructive"
      });
    }
  });

  const handleCreateOrder = () => {
    if (!amount || !price || !walletAddress || !currency) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive"
      });
      return;
    }

    // Преобразуем amount и price в числа
    const parsedAmount = parseFloat(amount);
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedAmount) || isNaN(parsedPrice)) {
      toast({
        title: "Ошибка",
        description: "Количество и цена должны быть числами",
        variant: "destructive"
      });
      return;
    }

    createOrderMutation.mutate({
      walletAddress,
      orderType,
      amount: parsedAmount,
      price: parsedPrice,
      currency,
      isAnonymous: true
    });
  };

  const OrderList = ({ orders, type }: { orders: any[], type: 'buy' | 'sell' }) => (
    <div className="space-y-2">
      <h4 className={`font-semibold mb-4 flex items-center ${
        type === 'buy' ? 'text-anon-green' : 'text-anon-red'
      }`}>
        {type === 'buy' ? (
          <>
            <TrendingUp className="mr-2 h-4 w-4" />
            Заявки на покупку
          </>
        ) : (
          <>
            <TrendingDown className="mr-2 h-4 w-4" />
            Заявки на продажу
          </>
        )}
      </h4>
      {orders?.length > 0 ? (
        orders.map((order, index) => (
          <div
            key={order.id || index}
            className="flex justify-between items-center p-3 bg-anon-gray rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <div>
              <div className={`font-mono ${type === 'buy' ? 'text-anon-green' : 'text-anon-red'}`}>
                {parseFloat(order.price).toFixed(4)} {order.currency || 'BTC'}
              </div>
              <div className="text-xs text-muted-foreground">
                {order.seller || 'Анонимный трейдер'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-foreground">
                {parseFloat(order.amount).toFixed(2)} anonCoin
              </div>
              <div className="text-xs text-muted-foreground">
                Эскроу защита
              </div>
            </div>
            <Button
              size="sm"
              className={`${
                type === 'buy'
                  ? 'bg-anon-green hover:bg-green-600'
                  : 'bg-anon-red hover:bg-red-600'
              } text-white`}
            >
              {type === 'buy' ? 'Купить' : 'Продать'}
            </Button>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Нет активных заявок
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Order Book */}
      <div className="lg:col-span-2">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-anon-purple flex items-center">
                <ArrowUpDown className="mr-2 h-5 w-5" />
                P2P Торговля
              </CardTitle>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-anon-green rounded-full pulse-animation"></div>
                <span className="text-sm text-anon-green">Анонимное соединение</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tab Navigation */}
            <div className="flex mb-6">
              <Button
                variant={activeTab === 'buy' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('buy')}
                className={`flex-1 rounded-r-none ${
                  activeTab === 'buy'
                    ? 'bg-anon-green hover:bg-green-600'
                    : 'bg-anon-gray hover:bg-gray-600'
                }`}
              >
                Купить anonCoin
              </Button>
              <Button
                variant={activeTab === 'sell' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('sell')}
                className={`flex-1 rounded-l-none ${
                  activeTab === 'sell'
                    ? 'bg-anon-red hover:bg-red-600'
                    : 'bg-anon-gray hover:bg-gray-600'
                }`}
              >
                Продать anonCoin
              </Button>
            </div>

            {/* Выбор валюты */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Валюта
              </label>
              <Select value={currency} onValueChange={(value: 'BTC' | 'USDT') => setCurrency(value)}>
                <SelectTrigger className="bg-anon-gray border-anon-gray">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order Lists */}
            {activeTab === 'buy' && (
              <OrderList orders={buyOrders || []} type="buy" />
            )}
            {activeTab === 'sell' && (
              <OrderList orders={sellOrders || []} type="sell" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Order */}
      <div className="space-y-6">
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-purple flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Создать Заявку
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Тип заявки
              </label>
              <Select value={orderType} onValueChange={(value: 'buy' | 'sell') => setOrderType(value)}>
                <SelectTrigger className="bg-anon-gray border-anon-gray">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Купить anonCoin</SelectItem>
                  <SelectItem value="sell">Продать anonCoin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Количество anonCoin
              </label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="bg-anon-gray border-anon-gray"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Цена ({currency})
              </label>
              <Input
                type="number"
                step="0.0001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currency === 'BTC' ? "0.0120" : "25.00"}
                className="bg-anon-gray border-anon-gray"
              />
            </div>

            <Alert className="border-anon-amber bg-amber-900/20">
              <Shield className="h-4 w-4 text-anon-amber" />
              <AlertDescription className="text-anon-amber">
                <strong>Эскроу защита:</strong> Средства блокируются до завершения сделки
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleCreateOrder}
              disabled={createOrderMutation.isPending || !walletAddress}
              className="w-full bg-anon-purple hover:bg-purple-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Создать Заявку
            </Button>
          </CardContent>
        </Card>

        {/* Trading Statistics */}
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle className="text-anon-green">Статистика Торговли</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Активные заявки:</span>
                <span className="font-mono text-anon-green">
                  {myOrders?.filter(o => o.status === 'active').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Завершено сделок:</span>
                <span className="font-mono text-anon-purple">
                  {myOrders?.filter(o => o.status === 'filled').length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Объем торгов:</span>
                <span className="font-mono text-anon-amber">
                  {myOrders?.reduce((sum, o) => sum + (parseFloat(o.totalValue) || 0), 0).toFixed(4) || '0.0000'} {currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Рейтинг:</span>
                <span className="text-anon-green">Новый трейдер</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Orders */}
      {myOrders && myOrders.length > 0 && (
        <div className="lg:col-span-3">
          <Card className="glass-effect border-anon-gray">
            <CardHeader>
              <CardTitle className="text-anon-amber">Мои Заявки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-4 bg-anon-gray rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        order.orderType === 'buy' ? 'bg-anon-green' : 'bg-anon-red'
                      }`}>
                        {order.orderType === 'buy' ? (
                          <TrendingUp className="h-4 w-4 text-white" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {order.orderType === 'buy' ? 'Покупка' : 'Продажа'} {parseFloat(order.amount).toFixed(2)} anonCoin
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {parseFloat(order.price).toFixed(4)} {order.currency || 'BTC'} ·
                          <Badge variant="outline" className="ml-1">
                            {order.status === 'active' ? 'Активна' : 'Завершена'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-anon-amber text-anon-amber hover:bg-anon-amber hover:text-white"
                      >
                        Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-anon-red text-anon-red hover:bg-anon-red hover:text-white"
                      >
                        Отменить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
