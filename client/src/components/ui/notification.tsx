import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  onClose?: () => void;
}

export function Notification({ type, title, message, duration = 5000, onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-anon-green" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-anon-red" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-anon-amber" />;
      case 'info':
        return <Info className="h-5 w-5 text-anon-purple" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return "border-anon-green bg-green-900/20";
      case 'error':
        return "border-anon-red bg-red-900/20";
      case 'warning':
        return "border-anon-amber bg-amber-900/20";
      case 'info':
        return "border-anon-purple bg-purple-900/20";
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 transition-all duration-300 transform",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
    >
      <Alert className={cn("glass-effect max-w-sm", getStyles())}>
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1">
            <div className="font-medium text-foreground">{title}</div>
            <AlertDescription className="text-muted-foreground text-sm">
              {message}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
}
