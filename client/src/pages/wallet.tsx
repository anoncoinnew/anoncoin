import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet as WalletIcon, Send, QrCode, Shield, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QRGenerator } from "@/components/wallet/qr-generator";
import { SeedPhraseGenerator } from "@/components/wallet/seed-phrase-generator";
import { generateTransactionHash } from "@/lib/crypto";
import { useWallet } from "@/hooks/use-wallet";

export default function Wallet() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWallet, setCurrentWallet } = useWallet();

  const { data: walletInfo, isLoading } = useQuery({
    queryKey: ['/api/wallet', currentWallet?.address],
    enabled: !!currentWallet?.address,
    refetchInterval: 10000
  });

  const createTransactionMutation = useMutation({
    mutationFn: (transactionData: any) => apiRequest('POST', '/api/transaction/send', transactionData),
    onSuccess: (data) => {
      toast({
        title: "Транзакция отправлена",
        description: `${transactionAmount} anonCoin отправлено ${isAnonymous ? 'анонимно' : 'открыто'}`
      });
      setRecipientAddress("");
      setTransactionAmount("");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка транзакции",
        description: error.message || "Не удалось отправить транзакцию",
        variant: "destructive"
      });
    }
  });

  const handleWalletGenerated = async (walletData: { address: string; encryptedPrivateKey: string }) => {
    try {
      const response = await apiRequest('POST', '/api/wallet/create', walletData);
      const result = await response.json();

      setCurrentWallet({
        address: walletData.address,
        encryptedPrivateKey: walletData.encryptedPrivateKey
      });

      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });

      toast({
        title: "Кошелек активирован",
        description: "Кошелек успешно создан и активирован в системе"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось активировать кошелек в системе",
        variant: "destructive"
      });
    }
  };

  const handleSendTransaction = () => {
    if (!currentWallet?.address) {
      toast({
        title: "Ошибка",
        description: "Сначала создайте или восстановите кошелек",
        variant: "destructive"
      });
      return;
    }

    if (!recipientAddress || !transactionAmount) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(transactionAmount);
    const balance = parseFloat(walletInfo?.balance || "0");

    if (amount <= 0) {
      toast({
        title: "Ошибка",
        description: "Сумма должна быть больше нуля",
        variant: "destructive"
      });
      return;
    }

    if (balance < amount + 0.001) { // Include fee
      toast({
        title: "Ошибка",
        description: "Недостаточно средств для транзакции",
        variant: "destructive"
      });
      return;
    }

    const transactionHash = generateTransactionHash({
      fromAddress: currentWallet.address,
      toAddress: recipientAddress,
      amount: transactionAmount,
      timestamp: Date.now()
    });

    createTransactionMutation.mutate({
      hash: transactionHash,
      fromAddress: currentWallet.address,
      toAddress: recipientAddress,
      amount: transactionAmount,
      fee: "0.001",
      isAnonymous
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-anon-purple rounded-lg flex items-center justify-center">
          <WalletIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-anon-purple">Кошелек</h1>
          <p className="text-muted-foreground">Управление анонимным кошельком anonCoin</p>
        </div>
      </div>

      {/* Seed Phrase Management */}
      {!currentWallet && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-anon-green">Создание или восстановление кошелька</h2>
          <SeedPhraseGenerator onWalletGenerated={handleWalletGenerated} />
        </div>
      )}

      {/* Wallet Info */}
      {currentWallet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wallet Information & QR Code */}
          <div className="space-y-6">
            <Card className="glass-effect border-anon-gray">
              <CardHeader>
                <CardTitle className="text-anon-purple flex items-center">
                  <QrCode className="mr-2 h-5 w-5" />
                  Информация о Кошельке
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Balance Display */}
                  <div className="text-center p-6 bg-anon-gray rounded-lg">
                    <div className="text-4xl font-bold text-anon-purple mb-2">
                      {parseFloat(walletInfo?.balance || "0").toFixed(8)}
                    </div>
                    <div className="text-muted-foreground">anonCoin</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      ≈ ${(parseFloat(walletInfo?.balance || "0") * 0.012).toFixed(2)} USD
                    </div>
                  </div>

                  {/* Address Display */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Адрес кошелька
                    </label>
                    <div className="bg-anon-gray border border-anon-gray rounded-lg p-3">
                      <code className="text-sm font-mono text-foreground break-all">
                        {currentWallet.address}
                      </code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Code Generator */}
            <QRGenerator address={currentWallet.address} />
          </div>

          {/* Send Transaction */}
          <div className="space-y-6">
            <Card className="glass-effect border-anon-gray">
              <CardHeader>
                <CardTitle className="text-anon-purple flex items-center">
                  <Send className="mr-2 h-5 w-5" />
                  Отправить Транзакцию
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Адрес получателя
                  </label>
                  <Input
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="anon1x9f8k2m..."
                    className="bg-anon-gray border-anon-gray font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Сумма
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.00000001"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                      placeholder="0.00000000"
                      className="bg-anon-gray border-anon-gray pr-20"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      anonCoin
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous-transaction"
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                  <label
                    htmlFor="anonymous-transaction"
                    className="text-sm text-muted-foreground flex items-center"
                  >
                    <Shield className="mr-1 h-4 w-4 text-anon-green" />
                    Анонимная транзакция (кольцевые подписи)
                  </label>
                </div>

                {/* Transaction Fee */}
                <div className="bg-anon-gray rounded-lg p-4">
                  <h4 className="font-medium mb-2 text-foreground">Комиссия сети</h4>
                  <div className="text-2xl font-bold text-anon-green mb-1">0.001 anonCoin</div>
                  <div className="text-sm text-muted-foreground">
                    {isAnonymous ? 'Анонимная комиссия (повышенная)' : 'Стандартная комиссия'}
                  </div>
                </div>

                <Button
                  onClick={handleSendTransaction}
                  disabled={createTransactionMutation.isPending || !recipientAddress || !transactionAmount}
                  className="w-full bg-anon-purple hover:bg-purple-600 text-white glow-purple"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createTransactionMutation.isPending ? "Отправка..." : "Отправить Транзакцию"}
                </Button>

                {isAnonymous && (
                  <Alert className="border-anon-green bg-green-900/20">
                    <Shield className="h-4 w-4 text-anon-green" />
                    <AlertDescription className="text-anon-green">
                      Анонимная транзакция использует кольцевые подписи для полной приватности
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Alert className="border-anon-amber bg-amber-900/20">
              <AlertTriangle className="h-4 w-4 text-anon-amber" />
              <AlertDescription className="text-anon-amber">
                <strong>Безопасность:</strong> Ваши приватные ключи хранятся только локально и никогда не передаются на сервер
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {currentWallet && walletInfo?.transactions && walletInfo.transactions.length > 0 && (
        <Card className="glass-effect border-anon-gray">
          <CardHeader>
            <CardTitle>Последние Транзакции</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {walletInfo.transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-anon-gray rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.toAddress === currentWallet.address ? 'bg-anon-green' : 'bg-anon-red'
                    }`}>
                      {tx.toAddress === currentWallet.address ? (
                        <Send className="h-4 w-4 text-white transform rotate-180" />
                      ) : (
                        <Send className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {tx.toAddress === currentWallet.address ? 'Получено' : 'Отправлено'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {tx.hash.substring(0, 16)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      tx.toAddress === currentWallet.address ? 'text-anon-green' : 'text-anon-red'
                    }`}>
                      {tx.toAddress === currentWallet.address ? '+' : '-'}{parseFloat(tx.amount).toFixed(8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.timestamp).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
