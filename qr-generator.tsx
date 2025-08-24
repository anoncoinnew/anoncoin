import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, QrCode, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRGeneratorProps {
  address: string;
  size?: number;
}

export function QRGenerator({ address, size = 200 }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrGenerated, setQrGenerated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    generateQR();
  }, [address]);

  const generateQR = async () => {
    if (!canvasRef.current || !address) return;
    
    try {
      // Использование библиотеки QRCode из CDN (загружена глобально)
      const QRCode = (window as any).QRCode;
      if (!QRCode) {
        console.error('QRCode library not loaded');
        return;
      }

      await QRCode.toCanvas(canvasRef.current, address, {
        width: size,
        margin: 2,
        color: {
          dark: '#8B5CF6', // anon-purple
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrGenerated(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать QR код",
        variant: "destructive"
      });
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast({
        title: "Скопировано",
        description: "Адрес кошелька скопирован в буфер обмена"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать адрес",
        variant: "destructive"
      });
    }
  };

  const downloadQR = () => {
    if (!canvasRef.current) return;
    
    try {
      const link = document.createElement('a');
      link.download = `anoncoin_wallet_${address.substring(0, 8)}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
      
      toast({
        title: "Загружено",
        description: "QR код сохранен как изображение"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скачать QR код",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="glass-effect border-anon-gray">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Address display */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Адрес кошелька
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-anon-gray border border-anon-gray rounded-lg px-3 py-2">
                <code className="text-sm font-mono text-foreground break-all">
                  {address}
                </code>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyAddress}
                className="border-anon-purple text-anon-purple hover:bg-anon-purple hover:text-white"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* QR Code display */}
          <div className="text-center">
            <div className="inline-block p-4 bg-white rounded-lg">
              <canvas 
                ref={canvasRef}
                className="block"
                style={{ width: size, height: size }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex-1 border-anon-green text-anon-green hover:bg-anon-green hover:text-white"
              onClick={generateQR}
              disabled={!address}
            >
              <QrCode className="mr-2 h-4 w-4" />
              Обновить QR
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-anon-amber text-anon-amber hover:bg-anon-amber hover:text-white"
              onClick={downloadQR}
              disabled={!qrGenerated}
            >
              <Download className="mr-2 h-4 w-4" />
              Скачать
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
