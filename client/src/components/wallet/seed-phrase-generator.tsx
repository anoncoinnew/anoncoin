import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Undo, Copy, Download, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateSeedPhrase, validateSeedPhrase, deriveWalletFromSeed } from "@/lib/crypto";

interface SeedPhraseGeneratorProps {
  onWalletGenerated: (walletData: { address: string; encryptedPrivateKey: string }) => void;
}

export function SeedPhraseGenerator({ onWalletGenerated }: SeedPhraseGeneratorProps) {
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [restoreSeedPhrase, setRestoreSeedPhrase] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  // Сохраняем последние сгенерированные данные кошелька, чтобы можно было "войти"
  const [lastWalletData, setLastWalletData] = useState<{ address: string; encryptedPrivateKey: string } | null>(null);

  const generateNewWallet = async () => {
    setIsGenerating(true);
    try {
      // Генерация сид-фразы только на клиенте
      const newSeedPhrase = generateSeedPhrase();
      setSeedPhrase(newSeedPhrase);
      setShowSeedPhrase(true);

      // Создание кошелька из сид-фразы
      const walletData = await deriveWalletFromSeed(newSeedPhrase);
      
      // Сохраняем в локальном состоянии — чтобы можно было "войти"
      setLastWalletData(walletData);

      toast({
        title: "Кошелек создан",
        description: "Новый анонимный кошелек успешно создан",
      });

    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось создать кошелек",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const restoreWallet = async () => {
    const trimmedSeed = restoreSeedPhrase.trim();
    
    if (!validateSeedPhrase(trimmedSeed)) {
      toast({
        title: "Ошибка",
        description: "Неверная сид-фраза. Проверьте правильность ввода.",
        variant: "destructive"
      });
      return;
    }

    setIsRestoring(true);
    try {
      // Восстановление кошелька из сид-фразы
      const walletData = await deriveWalletFromSeed(trimmedSeed);
      
      // Сохраняем также для возможности входа
      setLastWalletData(walletData);

      toast({
        title: "Кошелек восстановлен",
        description: "Кошелек успешно восстановлен из сид-фразы",
      });

      onWalletGenerated(walletData);
      setRestoreSeedPhrase("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось восстановить кошелек",
        variant: "destructive"
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const copySeedPhrase = async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase);
      toast({
        title: "Скопировано",
        description: "Сид-фраза скопирована в буфер обмена"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать сид-фразу",
        variant: "destructive"
      });
    }
  };

  const downloadSeedPhrase = () => {
    try {
      const element = document.createElement('a');
      const file = new Blob([seedPhrase], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `anoncoin_seed_phrase_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      toast({
        title: "Загружено",
        description: "Сид-фраза сохранена в файл"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скачать сид-фразу",
        variant: "destructive"
      });
    }
  };

  // Кнопка "Войти в кошелек" — использует последний сгенерированный кошелек или текущую сид-фразу
  const enterWallet = async () => {
    try {
      if (lastWalletData) {
        onWalletGenerated(lastWalletData);
        toast({
          title: "Вход выполнен",
          description: "Кошелек активирован"
        });
        return;
      }

      if (seedPhrase) {
        const walletData = await deriveWalletFromSeed(seedPhrase);
        setLastWalletData(walletData);
        onWalletGenerated(walletData);
        toast({
          title: "Вход выполнен",
          description: "Кошелек активирован"
        });
        return;
      }

      toast({
        title: "Ошибка",
        description: "Сначала создайте или восстановите кошелек",
        variant: "destructive"
      });
    } catch (error) {
      toast({
        title: "Ошибка входа",
        description: "Не удалось войти в кошелек",
        variant: "destructive"
      });
    }
  };

  const renderSeedWords = () => {
    if (!seedPhrase) return null;

    const words = seedPhrase.split(' ');
    return (
      <div className="grid grid-cols-3 gap-2 mb-4">
        {words.map((word, index) => (
          <div key={index} className="bg-anon-black rounded-lg p-2 text-center border border-anon-gray">
            <div className="text-xs text-muted-foreground">{index + 1}.</div>
            <div className="text-sm font-mono text-foreground">{word}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Create New Wallet */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-green flex items-center">
            <Plus className="mr-2 h-5 w-5" />
            Новый Кошелек
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={generateNewWallet}
            disabled={isGenerating}
            className="w-full bg-anon-green hover:bg-green-600 text-white"
          >
            {isGenerating ? "Создание..." : "Создать Новый Кошелек"}
          </Button>

          {showSeedPhrase && seedPhrase && (
            <div className="space-y-4">
              <Alert className="border-anon-red bg-red-900/20">
                <AlertTriangle className="h-4 w-4 text-anon-red" />
                <AlertDescription className="text-anon-red">
                  <strong>ВАЖНО!</strong> Сохраните эту сид-фразу в безопасном месте. 
                  Она НЕ передается по сети и хранится только у вас!
                </AlertDescription>
              </Alert>

              <div className="bg-anon-gray rounded-lg p-4">
                <label className="block text-sm font-medium text-muted-foreground mb-3">
                  Сид-фраза (12 слов)
                </label>
                {renderSeedWords()}
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={copySeedPhrase}
                    className="flex-1 border-anon-purple text-anon-purple hover:bg-anon-purple hover:text-white"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Копировать
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadSeedPhrase}
                    className="flex-1 border-anon-amber text-anon-amber hover:bg-anon-amber hover:text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Скачать
                  </Button>

                  {/* Войти в кошелек — новая кнопка */}
                  <Button
                    variant="outline"
                    onClick={enterWallet}
                    className="flex-1 border-anon-blue text-anon-blue hover:bg-anon-blue hover:text-white"
                  >
                    Войти в кошелек
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Wallet */}
      <Card className="glass-effect border-anon-gray">
        <CardHeader>
          <CardTitle className="text-anon-amber flex items-center">
            <Undo className="mr-2 h-5 w-5" />
            Восстановить Кошелек
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Введите сид-фразу (12 слов)
            </label>
            <Textarea
              value={restoreSeedPhrase}
              onChange={(e) => setRestoreSeedPhrase(e.target.value)}
              placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
              className="bg-anon-gray border-anon-gray font-mono text-sm resize-none min-h-[100px]"
              rows={3}
            />
          </div>
          <Button
            onClick={restoreWallet}
            disabled={isRestoring || !restoreSeedPhrase.trim()}
            className="w-full bg-anon-amber hover:bg-yellow-600 text-white"
          >
            {isRestoring ? "Восстановление..." : "Восстановить Кошелек"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
