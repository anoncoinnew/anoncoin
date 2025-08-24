import { useEffect, useRef, useState } from 'react';
import { encryptP2PMessage, decryptP2PMessage, generateRandomKey } from '@/lib/crypto';

interface WebSocketMessage {
  type: string;
  data: any;
  encrypted?: boolean;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  encryptMessages?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    encryptMessages = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const encryptionKeyRef = useRef<string>(generateRandomKey());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      onConnect?.();
      
      // Отправка зашифрованного пинга для установки безопасного соединения
      sendMessage({
        type: 'ping',
        data: { timestamp: Date.now() }
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Расшифровка сообщения если зашифровано
        if (message.encrypted && encryptMessages) {
          try {
            message.data = decryptP2PMessage(message.data, encryptionKeyRef.current);
          } catch (error) {
            console.error('Failed to decrypt P2P message:', error);
            return;
          }
        }
        
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      onDisconnect?.();
      
      // Auto-reconnect if enabled
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      let messageToSend = { ...message };
      
      // Encrypt message if encryption is enabled
      if (encryptMessages && message.type !== 'ping' && message.type !== 'pong') {
        messageToSend = {
          ...message,
          encrypted: true,
          data: encryptP2PMessage(message.data, encryptionKeyRef.current)
        };
      }
      
      wsRef.current.send(JSON.stringify(messageToSend));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  };

  // Broadcast transaction to P2P network
  const broadcastTransaction = (transaction: any) => {
    sendMessage({
      type: 'new_transaction',
      data: transaction
    });
  };

  // Broadcast block to P2P network
  const broadcastBlock = (block: any) => {
    sendMessage({
      type: 'new_block',
      data: block
    });
  };

  // Request blockchain info from peers
  const requestBlockchainInfo = () => {
    sendMessage({
      type: 'request_blockchain',
      data: {}
    });
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    sendMessage,
    broadcastTransaction,
    broadcastBlock,
    requestBlockchainInfo,
    connect,
    disconnect
  };
}
