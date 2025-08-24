import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  List, 
  ArrowDown, 
  ArrowUp, 
  Hammer, 
  Shield, 
  Search, 
  Filter, 
  Download,
  ExternalLink,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { currentWallet } = useWallet();
  const { toast } = useToast();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['/api/transactions', currentWallet?.address],
    enabled: !!currentWallet?.address,
    refetchInterval: 10000
  });

  const getTransactionIcon = (transaction: any) => {
    if (!currentWallet) return ArrowUp;
    
    if (transaction.fromAddress === null) return Hammer; // Mining reward
    if (transaction.toAddress === currentWallet.address) return ArrowDown; // Received
    return ArrowUp; // Sent
  };

  const getTransactionColor = (transaction: any) => {
    if (!currentWallet) return "text-anon-purple";
    
    if (transaction.fromAddress === null) return "text-anon-purple"; // Mining reward
    if (transaction.toAddress === currentWallet.address) return "text-anon-green"; // Received
    return "text-anon-red"; // Sent
  };

  const getTransactionBgColor = (transaction: any) => {
    if (!currentWallet) return "bg-anon-purple";
    
    if (transaction.fromAddress === null) return "bg-anon-purple"; // Mining reward
    if (transaction.toAddress === currentWallet.address) return "bg-anon-green"; // Received
    return "bg-anon-red"; // Sent
  };

  const getTransactionType = (transaction: any) => {
    if (!currentWallet) return "Неизвестно";
    
    if (transaction.fromAddress === null) return "Награда за майнинг";
    if (transaction.toAddress === currentWallet.address) return "Получено";
    return "Отправлено";
  };

  const getAmountPrefix = (transaction: any) => {
    if (!currentWallet) return "";
    
    if (transaction.fromAddress === null) return "+"; // Mining reward
    if (transaction.toAddress === currentWallet.address) return "+"; // Received
    return "-"; // Sent
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-anon-green text-white">Подтверждено</Badge>;
      case 'pending':
        return <Badge className="bg-anon-amber text-white">Ожидание</Badge>;
      case 'failed':
        return <Badge className="bg-anon-red text-white">Ошибка</Badge>;
      default:
        return <Badge variant="outline">Неизвестно</Badge>;
    }
  };

  const filteredTransactions = transactions?.filter((tx: any) => {
    const matchesSearch = searchTerm === "" || 
      tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.toAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.fromAddress && tx.fromAddress.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === "all" || 
      (filterType === "received" && tx.toAddress === currentWallet?.address) ||
      (filterType === "sent" && tx.fromAddress === currentWallet?.address) ||
      (filterType === "mining" && tx.fromAddress === null) ||
      (filterType === "anonymous" && tx.isAnonymous);
    
    return matchesSearch && matchesFilter;
  }) || [];

  const exportTransactions = () => {
    if (!transactions || transactions.length === 0) {
      toast({
        title: "Нет данных",
        description: "Нет транзакций для экспорта",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      ["Дата", "Тип", "Хеш", "От", "Кому", "Сумма", "Комиссия", "Статус", "Анонимная"].join(","),
      ...transactions.map((tx: any) => [
        new Date(tx.timestamp).toLocaleString('ru-RU'),
        getTransactionType(tx),
        tx.hash,
        tx.fromAddress || "Coinbase",
        tx.toAddress,
        tx.amount,
        tx.fee,
        tx.status,
        tx.isAnonymous ? "Да" : "Нет"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `anoncoin_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "Экспорт завершен",
      description: "Транзакции сохранены в CSV файл"
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-anon-purple rounded-lg flex items-center justify-center glow-purple">
          <List className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-anon-purple">Транзакции</h1>
          <p className="text-muted-foreground">История всех транзакций кошелька</p>
        </div>
      </div>

      {/* Wallet Required Alert */}
      {!currentWallet && (
        <Alert className="border-anon-red bg-red-900/20">
          <List className="h-4 w-4 text-anon-red" />
          <AlertDescription className="text-anon-red">
            Для просмотра транзакций необходимо создать или восстановить кошелек
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and Search */}
      {currentWallet && (
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-anon-purple">Фильтры и Поиск</CardTitle>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-anon-purple text-anon-purple hover:bg-anon-purple hover:text-white"
                  onClick={exportTransactions}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Экспорт CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по хешу или адресу..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-anon-gray border-anon-gray"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-anon-gray border-anon-gray">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все транзакции</SelectItem>
                  <SelectItem value="received">Получено</SelectItem>
                  <SelectItem value="sent">Отправлено</SelectItem>
                  <SelectItem value="mining">Майнинг</SelectItem>
                  <SelectItem value="anonymous">Анонимные</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="text-sm text-muted-foreground flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                Найдено: {filteredTransactions.length} транзакций
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List */}
      {currentWallet && (
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle>История Транзакций</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-anon-purple mx-auto"></div>
                <p className="text-muted-foreground mt-2">Загрузка транзакций...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  Нет транзакций
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterType !== "all" 
                    ? "Попробуйте изменить фильтры поиска" 
                    : "История транзакций будет отображаться здесь"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction: any) => {
                  const IconComponent = getTransactionIcon(transaction);
                  return (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center p-4 bg-anon-gray rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 ${getTransactionBgColor(transaction)} rounded-full flex items-center justify-center`}>
                          <IconComponent className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center space-x-2">
                            <span>{getTransactionType(transaction)}</span>
                            {transaction.isAnonymous && (
                              <Shield className="h-4 w-4 text-anon-green" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {transaction.hash.substring(0, 16)}...
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-2 text-anon-purple hover:text-purple-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.isAnonymous ? 'Анонимная транзакция' : 'Обычная транзакция'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`font-bold ${getTransactionColor(transaction)}`}>
                          {getAmountPrefix(transaction)}{parseFloat(transaction.amount).toFixed(8)} anonCoin
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(transaction.timestamp).toLocaleString('ru-RU')}
                        </div>
                        <div className="mt-1">
                          {getStatusBadge(transaction.status)}
                        </div>
                        {transaction.blockHeight && (
                          <div className="text-xs text-muted-foreground">
                            Блок: #{transaction.blockHeight}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
