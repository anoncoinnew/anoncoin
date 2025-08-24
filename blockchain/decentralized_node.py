import os
import asyncio
import json
import logging
import uvicorn
from typing import List, Optional, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Импорт из твоего ядра
from anoncoin_core import Blockchain, Wallet, Transaction, Block

# ==========================
# ЛОГИ
# ==========================
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ==========================
# FASTAPI
# ==========================
app = FastAPI(title="anonCoin Full Node")

# CORS (если нужно, чтобы сайт работал на другом домене)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # для безопасности укажи конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# ПУТИ ДАННЫХ
# ==========================
DATA_DIR = "data"
BLOCKCHAIN_FILE = os.path.join(DATA_DIR, "blockchain.json")
WALLETS_FILE   = os.path.join(DATA_DIR, "wallets.json")

# ==========================
# BOOTSTRAP НОДЫ
# ==========================
# ВАЖНО: указывай именно WS-эндпоинт /ws
BOOTSTRAP_NODES = [
    "ws://127.0.0.1:8000/ws",
    # сюда можно добавить публичные адреса других нод, например:
    # "ws://example.com:8000/ws",
]

# ==========================
# ГЛОБАЛЫ
# ==========================
blockchain: Optional[Blockchain] = None
wallets: dict = {}  # адрес -> Wallet
connected_peers: List[WebSocket] = []

# ==========================
# HELPERS (ключи кошельков)
# ==========================
def _wallet_priv_hex(w: Wallet) -> Optional[str]:
    """
    Аккуратно достаём приватный ключ в hex из разных возможных форматов Wallet,
    не падая, если нет нужных полей.
    """
    # 1) Если есть строковый атрибут private_key_hex
    if hasattr(w, "private_key_hex"):
        val = getattr(w, "private_key_hex")
        if isinstance(val, str):
            return val

    # 2) Если есть метод export_private_key_hex()
    if hasattr(w, "export_private_key_hex"):
        try:
            return w.export_private_key_hex()
        except Exception:
            pass

    # 3) Если есть объект private_key (например, ecdsa.SigningKey)
    if hasattr(w, "private_key"):
        pk = getattr(w, "private_key")
        # Попробуем получить сырые байты
        try:
            # ecdsa.SigningKey -> to_string()
            raw = pk.to_string()
            return raw.hex()
        except Exception:
            pass
        # Если вдруг это bytes
        try:
            if isinstance(pk, (bytes, bytearray)):
                return bytes(pk).hex()
        except Exception:
            pass
        # Если вдруг у него есть .hex()
        try:
            return pk.hex()
        except Exception:
            pass

    # 4) Ничего не нашли
    return None

def _wallet_pub_hex(w: Wallet) -> Optional[str]:
    if hasattr(w, "public_key_hex"):
        val = getattr(w, "public_key_hex")
        if isinstance(val, str):
            return val
    if hasattr(w, "export_public_key_hex"):
        try:
            return w.export_public_key_hex()
        except Exception:
            pass
    # Иногда адрес — это хеш публичного ключа; всё равно вернём None, это не критично
    return None

# ==========================
# ЗАГРУЗКА/СОХРАНЕНИЕ
# ==========================
def save_blockchain():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    with open(BLOCKCHAIN_FILE, "w", encoding="utf-8") as f:
        json.dump([block.to_dict() for block in blockchain.chain], f, ensure_ascii=False, indent=2)
    logging.info("Блокчейн сохранён")

def load_blockchain():
    if os.path.exists(BLOCKCHAIN_FILE):
        with open(BLOCKCHAIN_FILE, "r", encoding="utf-8") as f:
            blocks_data = json.load(f)
            blockchain.chain = [Block.from_dict(b) for b in blocks_data]
        logging.info(f"Загружен блокчейн из файла, блоков: {len(blockchain.chain)}")
    else:
        logging.info("Файл блокчейна не найден, создаём новый")

def save_wallets():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    wallets_data = {
        addr: {
            "private_key_hex": _wallet_priv_hex(w),
            "public_key_hex":  _wallet_pub_hex(w),
        }
        for addr, w in wallets.items()
    }
    with open(WALLETS_FILE, "w", encoding="utf-8") as f:
        json.dump(wallets_data, f, ensure_ascii=False, indent=2)
    logging.info(f"Сохранено кошельков: {len(wallets)}")

def load_wallets():
    global wallets
    if not os.path.exists(WALLETS_FILE):
        logging.info("Файл кошельков не найден — создаём пустой")
        wallets = {}
        return
    try:
        with open(WALLETS_FILE, "r", encoding="utf-8") as f:
            raw = f.read().strip()
        if not raw:
            logging.warning("Файл кошельков пустой — создаём пустой")
            wallets = {}
            return
        wallets_data = json.loads(raw)
        out = {}
        for addr, info in wallets_data.items():
            priv_hex = info.get("private_key_hex")
            if not priv_hex:
                # если приватника нет — пропускаем, чтобы не падать
                continue
            # стандартный путь
            if hasattr(Wallet, "from_private_key_hex"):
                w = Wallet.from_private_key_hex(priv_hex)
            else:
                # если в твоём Wallet другой метод, можно добавить ещё веток
                w = Wallet.from_private_key_hex(priv_hex)  # оставляем как есть
            out[addr] = w
        wallets = out
        logging.info(f"Загружено кошельков: {len(wallets)}")
    except Exception as e:
        logging.error(f"Не удалось загрузить кошельки: {e} — создаём пустой список")
        wallets = {}

# ==========================
# P2P WS: СЕРВЕР
# ==========================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_peers.append(websocket)
    logging.info(f"Подключён новый пир: {websocket.client.host}:{websocket.client.port}")
    try:
        # При подключении отправляем текущий блокчейн
        await websocket.send_json({
            "type": "blockchain",
            "chain": [block.to_dict() for block in blockchain.chain]
        })
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            await handle_p2p_message(websocket, msg)
    except WebSocketDisconnect:
        if websocket in connected_peers:
            connected_peers.remove(websocket)
        logging.info(f"Пир отключился: {websocket.client.host}:{websocket.client.port}")

async def handle_p2p_message(websocket: Optional[Any], msg: dict):
    """
    websocket может быть:
      - starlette.websockets.WebSocket (входящее соединение /ws)
      - websockets.client.WebSocketClientProtocol (исходящее подключение к bootstrap)
      - или None
    """
    msg_type = msg.get("type")

    if msg_type == "new_block":
        block_data = msg.get("block")
        block = Block.from_dict(block_data)

        # Проверка валидности нового блока
        if hasattr(blockchain, "is_valid_new_block"):
            valid = blockchain.is_valid_new_block(block)
        else:
            prev = blockchain.get_latest_block()
            valid = (block.previous_hash == prev.hash and block.hash == block.calculate_hash())

        if valid:
            blockchain.chain.append(block)
            blockchain.pending_transactions.clear()
            save_blockchain()
            logging.info(f"Добавлен новый блок {block.index} от пира")
            await broadcast_p2p({"type": "new_block", "block": block.to_dict()},
                                exclude=[websocket] if websocket else [])
        else:
            logging.warning("Получен некорректный блок — отклонён.")

    elif msg_type == "new_transaction":
        tx_data = msg.get("transaction")
        tx = Transaction.from_dict(tx_data)
        if blockchain.add_transaction(tx):
            logging.info("Добавлена новая транзакция от пира")
            await broadcast_p2p({"type": "new_transaction", "transaction": tx.to_dict()},
                                exclude=[websocket] if websocket else [])
        else:
            logging.warning("Транзакция от пира отклонена")

    elif msg_type == "request_blockchain":
        if websocket and hasattr(websocket, "send_json"):
            await websocket.send_json({
                "type": "blockchain",
                "chain": [block.to_dict() for block in blockchain.chain]
            })

    elif msg_type == "blockchain":
        incoming = msg.get("chain", [])
        try:
            foreign_chain = [Block.from_dict(b) for b in incoming]
            temp = Blockchain()
            temp.chain = foreign_chain
            if temp.is_chain_valid() and len(foreign_chain) > len(blockchain.chain):
                blockchain.chain = foreign_chain
                blockchain.pending_transactions.clear()
                save_blockchain()
                logging.info(f"Принята более длинная цепочка от пира: длина={len(foreign_chain)}")
            else:
                logging.info("Цепочка от пира короче/невалидна — оставляем свою")
        except Exception as e:
            logging.warning(f"Не удалось обработать присланную цепочку: {e}")

async def broadcast_p2p(message: dict, exclude: List[Any] = []):
    disconnected = []
    for peer in connected_peers:
        if peer and peer in exclude:
            continue
        try:
            await peer.send_json(message)
        except Exception:
            disconnected.append(peer)
    for d in disconnected:
        if d in connected_peers:
            connected_peers.remove(d)

# ==========================
# API
# ==========================
@app.get("/")
async def root():
    return HTMLResponse(
        """
        <h2>anonCoin Full Node</h2>
        <p>Используйте API для взаимодействия.</p>
        """
    )

@app.get("/api/blockchain/info")
async def api_blockchain_info():
    # Совместимость и с твоими ключами, и с фронтом (totalBlocks/totalSupply)
    info = {
        "blocks_count": len(blockchain.chain),
        "total_supply": blockchain.get_total_supply(),
        "pending_transactions": len(blockchain.pending_transactions),
        "is_valid": blockchain.is_chain_valid()
    }
    # дубликаты под фронт
    return {
        **info,
        "totalBlocks": info["blocks_count"],
        "totalSupply": str(info["total_supply"]),
        "difficulty": getattr(blockchain, "difficulty", None),
    }

@app.post("/api/wallet/create")
async def api_create_wallet():
    w = Wallet()
    addr = w.get_address()
    wallets[addr] = w
    save_wallets()
    balance = blockchain.get_balance(addr)
    return {
        "address": addr,
        "balance": balance,
        "public_key": _wallet_pub_hex(w),
    }

@app.post("/api/wallet/recover")
async def api_recover_wallet(req: Request):
    data = await req.json()
    priv_hex = data.get("private_key_hex")
    if not priv_hex:
        raise HTTPException(status_code=400, detail="private_key_hex is required")
    if hasattr(Wallet, "from_private_key_hex"):
        w = Wallet.from_private_key_hex(priv_hex)
    else:
        # если у тебя другая сигнатура, тут можно добавить альтернативы
        w = Wallet.from_private_key_hex(priv_hex)
    addr = w.get_address()
    wallets[addr] = w
    save_wallets()
    balance = blockchain.get_balance(addr)
    return {
        "address": addr,
        "balance": balance,
        "public_key": _wallet_pub_hex(w),
    }

@app.post("/api/wallet/{address}")
async def api_wallet_info(address: str):
    bal = blockchain.get_balance(address)
    return {"address": address, "balance": bal}

@app.post("/api/transaction/send")
async def api_send_transaction(req: Request):
    data = await req.json()
    sender_addr = data.get("sender")
    receiver    = data.get("receiver")
    amount      = float(data.get("amount"))
    anonymous   = data.get("anonymous", False)

    if not sender_addr or not receiver:
        raise HTTPException(status_code=400, detail="sender and receiver required")

    if sender_addr not in wallets:
        raise HTTPException(status_code=400, detail="Sender wallet not found")

    sender_wallet = wallets[sender_addr]
    balance = blockchain.get_balance(sender_addr)
    if balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    try:
        if anonymous and hasattr(sender_wallet, "create_anonymous_transaction"):
            tx = sender_wallet.create_anonymous_transaction(receiver, amount)
        else:
            tx = Transaction(sender_wallet.public_key_hex, receiver, amount)
            # Подписываем транзакцию кошельком (поддержка твоего Wallet)
            if hasattr(tx, "sign_transaction"):
                tx.sign_transaction(sender_wallet)
        if blockchain.add_transaction(tx):
            await broadcast_p2p({"type": "new_transaction", "transaction": tx.to_dict()})
            save_blockchain()
            return {"success": True}
        else:
            raise HTTPException(status_code=500, detail="Failed to add transaction")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mining/start")
async def api_start_mining(req: Request):
    data = await req.json()
    miner_addr = data.get("miner_address")
    if miner_addr not in wallets:
        raise HTTPException(status_code=400, detail="Miner wallet not found")

    miner_wallet = wallets[miner_addr]
    # Запускаем майнинг асинхронно, чтобы не блокировать сервер
    asyncio.create_task(run_mining(miner_wallet))
    return {"success": True, "message": "Mining started", "difficulty": getattr(blockchain, "difficulty", None)}

async def run_mining(miner_wallet: Wallet):
    try:
        blockchain.mine_pending_transactions(miner_wallet.get_address())
        latest_block = blockchain.get_latest_block()
        await broadcast_p2p({"type": "new_block", "block": latest_block.to_dict()})
        save_blockchain()
        logging.info(f"Замайнен новый блок {latest_block.index} майнером {miner_wallet.get_address()[:16]}")
    except Exception as e:
        logging.error(f"Ошибка майнинга: {e}")

# ==========================
# АВТОПОДКЛЮЧЕНИЕ К BOOTSTRAP-НОДАМ
# ==========================
# Требуется библиотека:
#    pip install websockets
import websockets  # клиент для исходящих WS-подключений

async def _peer_loop(node_ws_url: str):
    """Постоянно поддерживаем подключение к bootstrap-ноде и обрабатываем сообщения."""
    while True:
        try:
            async with websockets.connect(node_ws_url, ping_interval=20, ping_timeout=20) as ws:
                logging.info(f"Подключено к bootstrap ноде: {node_ws_url}")
                # Запрашиваем у узла их текущую цепочку
                await ws.send(json.dumps({"type": "request_blockchain"}))

                while True:
                    raw = await ws.recv()  # строка
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        if isinstance(raw, dict):
                            msg = raw
                        else:
                            logging.warning("Получено не-JSON сообщение от пира — игнор")
                            continue
                    await handle_p2p_message(None, msg)
        except Exception as e:
            logging.warning(f"Связь с {node_ws_url} потеряна/не установлена: {e}. Повтор через 5с")
            await asyncio.sleep(5)

async def connect_bootstrap_nodes():
    tasks = []
    for node in BOOTSTRAP_NODES:
        tasks.append(asyncio.create_task(_peer_loop(node)))
    # держим задачи активными
    await asyncio.gather(*tasks)

@app.on_event("startup")
async def _startup_connect_peers():
    # не блокируем сервер — соединения к bootstrap пойдут в фоне
    asyncio.create_task(connect_bootstrap_nodes())

# ==========================
# СТАРТ УЗЛА
# ==========================
def start_node(host="0.0.0.0", port=8000):
    global blockchain
    blockchain = Blockchain()  # твой PoW уже внутри ядра
    load_blockchain()
    load_wallets()
    logging.info("anonCoin узел запущен")
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start_node()

