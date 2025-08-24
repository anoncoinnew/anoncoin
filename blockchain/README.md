# anonCoin Blockchain Integration

## Обзор

Интеграция Python блокчейн реализации с Express.js backend через `blockchain-bridge.ts`.

## Установка зависимостей

```bash
pip install ecdsa pycryptodome mnemonic flask
```

## Основные компоненты

### `anoncoin_core.py`
Основная реализация блокчейна с поддержкой:
- Кольцевые подписи для анонимных транзакций
- Proof of Work майнинг с усложненной логикой  
- BIP39 совместимые кошельки с seed-фразами
- AES шифрование для метаданных
- JSON API интерфейс для интеграции

### `blockchain-bridge.ts`
Мост между Node.js Express сервером и Python блокчейном:
- Автоматический запуск Python процесса
- Синхронизация блоков и транзакций  
- Обработка команд через JSON IPC
- Graceful shutdown при завершении

## Архитектура интеграции

1. **Express Routes** → `blockchain-bridge.ts` → **Python Process**
2. **WebSocket Events** ← `blockchain-bridge.ts` ← **Python Events**
3. **Storage Sync** между Node.js и Python данными

## Используемые файлы пользователя

- `anoncoin_single.py` - базовая реализация (адаптирована в anoncoin_core.py)
- `anonCoin_P2P.py` - P2P версия с веб-интерфейсом (функции интегрированы)