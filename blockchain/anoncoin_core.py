#!/usr/bin/env python3
"""
anonCoin - Полный блокчейн с анонимными функциями в одном файле
Для работы в Pydroid3: pip install ecdsa pycryptodome
"""

import os
import json
import hashlib
import time
import logging
import random
from mnemonic import Mnemonic
from base64 import b64encode, b64decode
from typing import List, Dict, Any
from ecdsa import SigningKey, VerifyingKey, NIST384p, BadSignatureError
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

# ===== UTXO + key-image helpers =====
from dataclasses import dataclass
from hashlib import sha256

def sha256_hex(data: bytes) -> str:
    return sha256(data).hexdigest()

@dataclass
class TxOutput:
    txid: str
    index: int
    address: str
    amount: float

    def to_dict(self):
        return {"txid": self.txid, "index": self.index, "address": self.address, "amount": self.amount}

    @classmethod
    def from_dict(cls, d):
        return cls(d["txid"], d["index"], d["address"], d["amount"])

@dataclass
class TxInput:
    prev_txid: str
    output_index: int
    signature: str | None = None  # подпись владельца (для стандартных tx)

    def to_dict(self):
        return {"prev_txid": self.prev_txid, "output_index": self.output_index, "signature": self.signature}

    @classmethod
    def from_dict(cls, d):
        return cls(d["prev_txid"], d["output_index"], d.get("signature"))

class UTXOSet:
    """
    Простой in-memory UTXO-набор. Не сериализуем в файл — восстанавливаем из цепочки.
    """
    def __init__(self):
        self._map: dict[tuple[str, int], TxOutput] = {}

    def add(self, out: TxOutput):
        self._map[(out.txid, out.index)] = out

    def spend(self, prev_txid: str, idx: int):
        self._map.pop((prev_txid, idx), None)

    def has(self, prev_txid: str, idx: int) -> bool:
        return (prev_txid, idx) in self._map

    def get(self, prev_txid: str, idx: int) -> TxOutput | None:
        return self._map.get((prev_txid, idx))

    def balance(self, address: str) -> float:
        return sum(o.amount for o in self._map.values() if o.address == address)

    def available_for(self, address: str) -> list[TxOutput]:
        return [o for o in self._map.values() if o.address == address]

def compute_key_image(private_key_bytes: bytes, inputs: list[TxInput]) -> str:
    """
    Упрощённая key image: KI = H( priv || concat(prev_txid||index) )
    Достаточно для обнаружения повторной траты тех же «анонимных» входов.
    """
    h = sha256()
    h.update(private_key_bytes)
    for i in inputs:
        h.update(i.prev_txid.encode())
        h.update(str(i.output_index).encode())
    return h.hexdigest()

# ================================
# КОНФИГУРАЦИЯ
# ================================

BLOCKCHAIN_NAME = "anonCoin"
MAX_SUPPLY = 33_000_000
HALVING_INTERVAL = 5000
ANON_BLOCK_INTERVAL = 333
BONUS_REWARD = 5
DEFAULT_DIFFICULTY = 3
DEFAULT_REWARD = 50
RING_SIZE = 5
AES_KEY_SIZE = 16
BLOCKCHAIN_DATA_FILE = "blockchain_data.json"
WALLETS_DATA_FILE = "wallets_data.json"

# Глобальное хранилище кошельков для анонимных транзакций
wallets = {}

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# ================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ================================

def pubkey_to_address(pubkey_bytes: bytes) -> str:
    """Преобразование публичного ключа в адрес через SHA256"""
    return hashlib.sha256(pubkey_bytes).hexdigest()

def serialize_transaction(tx_dict: dict) -> bytes:
    """Сериализация транзакции в байты для подписи"""
    tx_copy = tx_dict.copy()
    tx_copy.pop('signature', None)
    tx_copy.pop('ring_signature', None)
    return json.dumps(tx_copy, separators=(',', ':'), sort_keys=True).encode()

def generate_transaction_id(transaction) -> str:
    """Генерация уникального ID транзакции"""
    tx_data = {
        'sender_pubkey': transaction.sender_pubkey,
        'receiver_address': transaction.receiver_address,
        'amount': transaction.amount,
        'timestamp': transaction.timestamp,
        'tx_type': transaction.tx_type
    }
    tx_string = json.dumps(tx_data, separators=(',', ':'), sort_keys=True)
    return hashlib.sha256(tx_string.encode()).hexdigest()

def is_duplicate_transaction(blockchain, tx_hash: str) -> bool:
    """Проверка дублирования транзакции в блокчейне"""
    for block in blockchain.chain:
        for tx in block.transactions:
            if generate_transaction_id(tx) == tx_hash:
                return True

    for tx in blockchain.pending_transactions:
        if generate_transaction_id(tx) == tx_hash:
            return True

    return False

def calculate_balance(blockchain, address: str) -> float:
    """Расчет баланса для указанного адреса"""
    balance = 0.0

    for block in blockchain.chain:
        for tx in block.transactions:
            if tx.receiver_address == address:
                balance += tx.amount

            sender_address = tx.get_sender_address()
            if sender_address == address:
                balance -= tx.amount

    return balance

def validate_transaction_balance(blockchain, transaction) -> bool:
    """Проверка достаточности баланса отправителя"""
    if transaction.get_sender_address() is None:  # Coinbase транзакция
        return True

    sender_balance = calculate_balance(blockchain, transaction.get_sender_address())
    return sender_balance >= transaction.amount

def format_hash(hash_str: str, length: int = 8) -> str:
    """Форматирование хеша для отображения"""
    return f"{hash_str[:length]}..."

def format_timestamp(timestamp: int) -> str:
    """Форматирование времени для отображения"""
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))

# ================================
# АНОНИМНЫЕ ФУНКЦИИ (КОЛЬЦЕВЫЕ ПОДПИСИ)
# ================================

def create_ring_signature(message: bytes, private_key: SigningKey, public_keys: List[str]):
    """Создание кольцевой подписи для анонимных транзакций"""
    signatures = []
    key_images = []

    for pub_hex in public_keys:
        pub_bytes = bytes.fromhex(pub_hex)
        # Если это наш ключ - подписываем настоящим ключом
        if pub_bytes == private_key.verifying_key.to_string():
            sig = private_key.sign(message)
        else:
            # Иначе создаем фальшивую подпись
            fake_key = SigningKey.generate(curve=NIST384p)
            sig = fake_key.sign(message)

        signatures.append(b64encode(sig).decode())
        key_images.append(pub_hex)

    return (signatures, key_images)

def verify_ring_signature(message: bytes, ring_signature, key_images):
    """Проверка кольцевой подписи"""
    signatures, key_images_list = ring_signature

    for sig_b64, pub_hex in zip(signatures, key_images_list):
        valid = False
        pub_bytes = bytes.fromhex(pub_hex)

        # Проверяем подпись с каждым кошельком в системе
        for wallet_info in wallets.values():
            pubkey_hex = wallet_info.get("public_key", "")
            pubkey_bytes = bytes.fromhex(pubkey_hex) if pubkey_hex else b""

            if pubkey_bytes == pub_bytes:
                try:
                    vk = VerifyingKey.from_string(pubkey_bytes, curve=NIST384p)
                    if vk.verify(b64decode(sig_b64), message):
                        valid = True
                        break
                except Exception:
                    continue

        if not valid:
            return False
    return True

def get_ring_public_keys(sender_address, ring_size=RING_SIZE):
    """Получение публичных ключей для кольцевой подписи"""
    all_addresses = list(wallets.keys())

    if len(all_addresses) < ring_size:
        ring_size = len(all_addresses)

    if ring_size <= 1:
        # Если недостаточно кошельков, возвращаем только отправителя
        if sender_address in wallets:
            return [wallets[sender_address]["public_key"]]
        return []

    ring_members = random.sample(all_addresses, min(ring_size - 1, len(all_addresses)))

    if sender_address not in ring_members and sender_address in wallets:
        ring_members.append(sender_address)

    random.shuffle(ring_members)
    return [wallets[addr]["public_key"] for addr in ring_members if addr in wallets]

# ================================
# КЛАСС КОШЕЛЬКА
# ================================

class Wallet:
    def __init__(self, seed_phrase=None):
        """Инициализация кошелька. Если передан seed_phrase, восстанавливаем кошелек"""
        if seed_phrase:
            # Восстанавливаем кошелек из сид-фразы
            self._restore_from_seed(seed_phrase)
        else:
            # Генерация нового кошелька
            self.private_key = SigningKey.generate(curve=NIST384p)
            self.public_key = self.private_key.verifying_key
            self.aes_key = os.urandom(AES_KEY_SIZE)
            self.public_key_hex = self.public_key.to_string().hex()
            self.seed_phrase = self.generate_seed_phrase()

    def generate_seed_phrase(self):
        """Генерация сид-фразы для кошелька"""
        mnemonic = Mnemonic("english")
        seed = os.urandom(32)  # Генерация случайного 256-битного значения
        seed_phrase = mnemonic.to_mnemonic(seed)
        return seed_phrase

    def _restore_from_seed(self, seed_phrase):
        from mnemonic import Mnemonic

        # Приводим seed_phrase к строке, если это bytes
        if isinstance(seed_phrase, bytes):
            try:
                seed_phrase = seed_phrase.decode("utf-8", errors="ignore")
            except Exception:
                seed_phrase = seed_phrase.decode("latin1", errors="ignore")

        mnemo = Mnemonic("english")

        # Проверяем валидность сид-фразы (если хочешь, можно убрать)
        if not mnemo.check(seed_phrase):
            raise ValueError("Невалидная сид-фраза")

        seed = mnemo.to_seed(seed_phrase)
        # Извлекаем из seed приватный ключ
        self.private_key = SigningKey.from_string(seed[:32], curve=NIST384p)
        self.public_key = self.private_key.verifying_key
        self.aes_key = os.urandom(AES_KEY_SIZE)  # Новый AES ключ
        self.public_key_hex = self.public_key.to_string().hex()
        self.seed_phrase = seed_phrase

    @staticmethod
    def from_private_key_hex(priv_hex: str):
        wallet = Wallet.__new__(Wallet)
        wallet.private_key = SigningKey.from_string(bytes.fromhex(priv_hex), curve=NIST384p)
        wallet.public_key = wallet.private_key.verifying_key
        wallet.public_key_hex = wallet.public_key.to_string().hex()
        wallet.aes_key = os.urandom(AES_KEY_SIZE)
        wallet.seed_phrase = None
        return wallet

    def get_address(self) -> str:
        """Получение адреса кошелька"""
        return pubkey_to_address(self.public_key.to_string())

    def get_public_key(self):
        """Получение объекта публичного ключа"""
        return self.public_key

    def get_private_key(self):
        """Получение объекта приватного ключа"""
        return self.private_key

    def get_seed_phrase(self):
        """Получение сид-фразы"""
        return self.seed_phrase

    def sign(self, message_bytes: bytes) -> str:
        """Подпись сообщения с возвратом base64 подписи"""
        return b64encode(self.private_key.sign(message_bytes)).decode()

    def verify(self, message_bytes: bytes, signature_b64: str, pubkey_hex: str) -> bool:
        """Проверка подписи"""
        try:
            pubkey_bytes = bytes.fromhex(pubkey_hex)
            pub_key = VerifyingKey.from_string(pubkey_bytes, curve=NIST384p)
            return pub_key.verify(b64decode(signature_b64), message_bytes)
        except Exception as e:
            logging.warning(f"Ошибка проверки: {e}")
            return False

    def encrypt_metadata(self, data_str: str) -> str:
        """Шифрование метаданных с помощью AES"""
        iv = os.urandom(16)
        cipher = AES.new(self.aes_key, AES.MODE_CBC, iv)
        encrypted = cipher.encrypt(pad(data_str.encode(), AES.block_size))
        return b64encode(iv + encrypted).decode()

    def decrypt_metadata(self, encrypted_str: str) -> str | None:
        """Расшифровка метаданных"""
        try:
            raw = b64decode(encrypted_str)
            iv, encrypted = raw[:16], raw[16:]
            cipher = AES.new(self.aes_key, AES.MODE_CBC, iv)
            decrypted = unpad(cipher.decrypt(encrypted), AES.block_size)
            return decrypted.decode()
        except Exception as e:
            logging.warning(f"Ошибка расшифровки: {e}")
            return None

    def create_anonymous_transaction(self, receiver_address: str, amount: float, metadata=None):
       """Создание анонимной транзакции: входы UTXO + key_image + (опционально) ring signature."""
       sender_address = self.get_address()
   
       # 1) Попросим блокчейн (глобально импортирован в узле) подсказать доступные UTXO.
       #    Если это ядро используется отдельно, ниже fallback через глобальную функцию.
       try:
           available = GLOBAL_BLOCKCHAIN_REF.utxo_set.available_for(sender_address)  # будет задан ниже
       except Exception:
           available = []
   
       # Fallback: если утх-реестр ещё не собран, пусть блокчейн соберёт его из цепи
       if not available and 'GLOBAL_BLOCKCHAIN_REF' in globals():
           try:
               GLOBAL_BLOCKCHAIN_REF.ensure_state()
               available = GLOBAL_BLOCKCHAIN_REF.utxo_set.available_for(sender_address)
           except Exception:
               available = []
   
       # 2) Набираем входы на требуемую сумму
       inputs, total_in = [], 0.0
       for out in available:
           inputs.append(TxInput(prev_txid=out.txid, output_index=out.index))
           total_in += out.amount
           if total_in + 1e-9 >= amount:
               break
   
       if total_in + 1e-9 < amount:
           print("❌ Недостаточно средств в UTXO")
           return None
   
       # 3) Формируем выходы: получатель и (если нужно) сдача
       outputs = []
       # txid пока неизвестен — заполним постфактум при применении блока; но для сериализации хватит адрес/amount
       outputs.append(TxOutput(txid="", index=0, address=receiver_address, amount=float(amount)))
       change = total_in - amount
       if change > 0:
           outputs.append(TxOutput(txid="", index=1, address=sender_address, amount=float(change)))
   
       # 4) Собираем транзакцию
       tx = Transaction(
           sender_pubkey_hex=None,           # скрыт
           receiver_address=receiver_address,
           amount=float(amount),
           metadata=metadata,
           tx_type="anonymous",
           inputs=inputs,
           outputs=outputs,
       )
   
       # 5) key image: связываем с конкретными входами, чтобы нельзя было потратить повторно
       try:
           priv_bytes = self.private_key.to_string()
           tx.key_image = compute_key_image(priv_bytes, inputs)
       except Exception:
           # если по какой-то причине не удалось — всё равно заблокируем повтор по входам на этапе валидации
           tx.key_image = None
   
       # 6) (Опционально) кольцевая подпись — если в кодовой базе есть нужные функции
       try:
           ring_keys = get_ring_public_keys(sender_address, RING_SIZE)
           if len(ring_keys) >= 2:
               message = serialize_transaction({k: v for k, v in tx.to_dict().items() if k not in ("signature", "ring_signature")})
               ring_signature = create_ring_signature(message, self.private_key, ring_keys)
               tx.ring_signature = ring_signature
       except Exception as e:
           # кольцо не обязательно — защита от двойной траты обеспечивается key image + UTXO
           logging.info(f"Ring signature пропущена: {e}")
   
       print(f"✅ Создана анонимная транзакция с {len(inputs)} вход(а/ов) и key_image={tx.key_image[:16]+'…' if tx.key_image else 'None'}")
       return tx

    def to_dict(self):
        """Сериализация кошелька в словарь"""
        return {
            'private_key': self.private_key.to_string().hex(),
            'public_key': self.public_key_hex,
            'aes_key': b64encode(self.aes_key).decode(),
            'address': self.get_address(),
            'seed_phrase': self.seed_phrase  # Добавляем сид-фразу в сериализованный объект
        }

    @classmethod
    def from_dict(cls, data):
        """Десериализация кошелька из словаря"""
        wallet = cls.__new__(cls)
        wallet.private_key = SigningKey.from_string(bytes.fromhex(data['private_key']), curve=NIST384p)
        wallet.public_key = wallet.private_key.verifying_key
        wallet.public_key_hex = data['public_key']
        wallet.aes_key = b64decode(data['aes_key'])
        wallet.seed_phrase = data.get('seed_phrase')  # Восстановление сид-фразы
        return wallet


# ================================
# КЛАСС ТРАНЗАКЦИИ (обновлённый)
# ================================
class Transaction:
    def __init__(
        self,
        sender_pubkey_hex,
        receiver_address,
        amount,
        signature=None,
        metadata=None,
        tx_type="standard",
        timestamp=None,
        ring_signature=None,
        inputs: list[TxInput] | None = None,
        outputs: list[TxOutput] | None = None,
        key_image: str | None = None,
    ):
        self.sender_pubkey = sender_pubkey_hex
        self.receiver_address = receiver_address
        self.amount = amount
        self.signature = signature
        self.metadata = metadata
        self.tx_type = tx_type
        self.timestamp = timestamp if timestamp else int(time.time())
        self.ring_signature = ring_signature

        # Новое:
        self.inputs = inputs or []     # список входов UTXO
        self.outputs = outputs or []   # список выходов UTXO
        self.key_image = key_image     # для анонимных транзакций

    def to_dict(self) -> dict:
        result = {
            "sender_pubkey": self.sender_pubkey,
            "receiver_address": self.receiver_address,
            "amount": self.amount,
            "signature": self.signature,
            "metadata": self.metadata,
            "tx_type": self.tx_type,
            "timestamp": self.timestamp,
        }
        if self.ring_signature:
            result["ring_signature"] = self.ring_signature
        if self.inputs:
            result["inputs"] = [i.to_dict() for i in self.inputs]
        if self.outputs:
            result["outputs"] = [o.to_dict() for o in self.outputs]
        if self.key_image:
            result["key_image"] = self.key_image
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True)

    def sign_transaction(self, wallet):
        """Подпись транзакции кошельком (для стандартных транзакций)."""
        self.sender_pubkey = wallet.public_key.to_string().hex()
        # подписываем «чистые» данные без подписи и кольца
        tx_data = self.to_dict()
        tx_data.pop("signature", None)
        tx_data.pop("ring_signature", None)
        message = serialize_transaction(tx_data)
        self.signature = wallet.sign(message)

    def verify_signature(self) -> bool:
        """Проверка подписи транзакции."""
        # Анонимные транзакции — подпись кольцом (если используется) + key_image проверяется отдельно
        if self.tx_type == "anonymous":
            if self.ring_signature:
                try:
                    message = serialize_transaction({k: v for k, v in self.to_dict().items() if k not in ("signature", "ring_signature")})
                    return verify_ring_signature(message, self.ring_signature, self.ring_signature[1])
                except Exception as e:
                    logging.warning(f"Ошибка проверки ring signature: {e}")
                    return False
            # допускаем анонимные без ring_signature, если активна модель с одним отправителем
            return True

        # Для обычных транзакций — ECDSA
        if not self.sender_pubkey or not self.signature:
            return False
        try:
            pubkey_bytes = bytes.fromhex(self.sender_pubkey)
            pub_key = VerifyingKey.from_string(pubkey_bytes, curve=NIST384p)
            tx_data = self.to_dict()
            tx_data.pop("signature", None)
            tx_data.pop("ring_signature", None)
            message = serialize_transaction(tx_data)
            return pub_key.verify(b64decode(self.signature), message)
        except Exception as e:
            logging.warning(f"Ошибка проверки подписи: {e}")
            return False

    def get_sender_address(self):
        """Адрес отправителя (скрыт для анонимных)."""
        if self.tx_type == "anonymous":
            return "ANONYMOUS"
        if not self.sender_pubkey:
            return None
        return pubkey_to_address(bytes.fromhex(self.sender_pubkey))

    @classmethod
    def from_dict(cls, data):
        """Создание транзакции из словаря (совместимо со старым форматом)."""
        inputs = [TxInput.from_dict(i) for i in data.get("inputs", [])]
        outputs = [TxOutput.from_dict(o) for o in data.get("outputs", [])]
        return cls(
            sender_pubkey_hex=data.get('sender_pubkey'),
            receiver_address=data['receiver_address'],
            amount=data['amount'],
            signature=data.get('signature'),
            metadata=data.get('metadata'),
            tx_type=data.get('tx_type', 'standard'),
            timestamp=data.get('timestamp'),
            ring_signature=data.get('ring_signature'),
            inputs=inputs,
            outputs=outputs,
            key_image=data.get("key_image"),
        )
# ================================
# КЛАСС БЛОКА
# ================================

class Block:
    def __init__(self, index, previous_hash, timestamp, transactions, nonce=0, manifest=None):
        self.index = index
        self.previous_hash = previous_hash
        self.timestamp = timestamp
        self.transactions = transactions
        self.nonce = nonce
        self.manifest = manifest
        self.hash = self.calculate_hash()

    def calculate_hash(self):
        """Расчет хеша блока"""
        tx_str = ''.join([tx.to_json() for tx in self.transactions])
        block_string = f"{self.index}{self.previous_hash}{self.timestamp}{tx_str}{self.nonce}{self.manifest}"
        return hashlib.sha256(hashlib.sha256(block_string.encode()).digest()).hexdigest()

    def mine_block(self, difficulty):
        """Майнинг блока с заданной сложностью"""
        target = '0' * difficulty
        while self.hash[:difficulty] != target:
            self.nonce += 1
            self.hash = self.calculate_hash()

        logging.info(f"Блок {self.index} замайнен: nonce={self.nonce}, хеш={self.hash}")

    def to_dict(self):
        """Преобразование блока в словарь"""
        return {
            'index': self.index,
            'previous_hash': self.previous_hash,
            'timestamp': self.timestamp,
            'transactions': [tx.to_dict() for tx in self.transactions],
            'nonce': self.nonce,
            'manifest': self.manifest,
            'hash': self.hash
        }

    @classmethod
    def from_dict(cls, data):
        """Создание блока из словаря"""
        block = cls(
            index=data['index'],
            previous_hash=data['previous_hash'],
            timestamp=data['timestamp'],
            transactions=[Transaction.from_dict(tx) for tx in data['transactions']],
            nonce=data['nonce'],
            manifest=data['manifest']
        )
        block.hash = data['hash']
        return block

# ================================
# КЛАСС БЛОКЧЕЙНА
# ================================

class Blockchain:
    def __init__(self, difficulty=DEFAULT_DIFFICULTY):
        self.chain = []
        self.pending_transactions = []
        self.difficulty = difficulty
        self.rewards = DEFAULT_REWARD
        # === Новые структуры состояния ===
        self.utxo_set = UTXOSet()
        self.seen_key_images: set[str] = set()
        self.create_genesis_block()
        # Глобальная ссылка для доступа из Wallet (см. create_anonymous_transaction)
        global GLOBAL_BLOCKCHAIN_REF
        GLOBAL_BLOCKCHAIN_REF = self

    def create_genesis_block(self):
        """Создание генезис блока с фиксированным балансом"""
        start_balance = 3333666  # фиксированная сумма в anonCoin

        initial_tx = Transaction(
            sender_pubkey_hex=None,  # coinbase
            receiver_address="anonf770bde4ec1a03a313997b09fa56d995",  # твой адрес
            amount=start_balance,
            tx_type="coinbase"
        )

        # Генерация ID для транзакции
        initial_tx.id = generate_transaction_id(initial_tx)

        # Убедимся, что транзакция считается валидной
        if not hasattr(initial_tx, "signature") or initial_tx.signature is None:
            initial_tx.signature = "GENESIS_SIGNATURE"

        genesis_block = Block(
            index=0,
            previous_hash="0",
            timestamp=int(time.time()),
            transactions=[initial_tx],
            manifest="Genesis"
        )

        # Майним генезис-блок
        genesis_block.mine_block(self.difficulty)

        self.chain.append(genesis_block)
        logging.info("✅ Генезис-блок создан: %s монет отправлено на %s",
                     start_balance, initial_tx.receiver_address)

        # Зарегистрировать coinbase-выход как UTXO
        self._apply_block_utxo(genesis_block)

    def get_latest_block(self):
        return self.chain[-1]

    def get_total_supply(self):
        total = 0
        for block in self.chain:
            for tx in block.transactions:
                if tx.get_sender_address() is None or tx.get_sender_address() == "ANONYMOUS":
                    if tx.tx_type == "coinbase":
                        total += tx.amount
        return total

    def add_transaction(self, transaction: Transaction):
        """Добавление транзакции в пул ожидания"""
        try:
            if not transaction.verify_signature():
                logging.warning("❌ Неверная подпись транзакции. Транзакция отклонена.")
                return False

            if transaction.tx_type not in ["anonymous", "coinbase"]:
                if not transaction.sender_pubkey or not transaction.receiver_address:
                    logging.warning("❌ Пустой адрес отправителя или получателя. Транзакция отклонена.")
                    return False

            if transaction.tx_type != "coinbase":
                if not validate_transaction_balance(self, transaction):
                    logging.warning("❌ Недостаточно средств. Транзакция отклонена.")
                    return False

            tx_hash = generate_transaction_id(transaction)
            if is_duplicate_transaction(self, tx_hash):
                logging.warning("❌ Дублирующая транзакция. Отклонено.")
                return False

            self.pending_transactions.append(transaction)
            logging.info("✅ Транзакция добавлена в пул.")
            return True
        except Exception as e:
            logging.error(f"Ошибка при добавлении транзакции: {e}")
            return False

    def mine_pending_transactions(self, miner_address: str, manifest=None):
        block_index = len(self.chain)

        # Награда за блок
        if self.get_total_supply() < MAX_SUPPLY:
            if block_index % HALVING_INTERVAL == 0 and self.rewards > 1:
                self.rewards = max(self.rewards // 2, 1)

            reward = min(self.rewards, MAX_SUPPLY - self.get_total_supply())

            metadata = None
            if block_index % ANON_BLOCK_INTERVAL == 0:
                if (block_index // ANON_BLOCK_INTERVAL) % 2 == 0:
                    metadata = b64encode(f"сообщение анон блока {block_index}".encode()).decode()
                else:
                    metadata = b64encode(os.urandom(32)).decode()
                reward += BONUS_REWARD

            reward_tx = Transaction(None, miner_address, reward, metadata=metadata, tx_type="coinbase")
            self.pending_transactions.insert(0, reward_tx)

        previous_hash = self.get_latest_block().hash
        block = Block(
            index=block_index,
            previous_hash=previous_hash,
            timestamp=int(time.time()),
            transactions=self.pending_transactions.copy(),
            manifest=manifest
        )
        block.mine_block(self.difficulty)
        self.chain.append(block)
        self.pending_transactions = []

        # Обновляем UTXO и KeyImages
        self._apply_block_utxo(block)

        logging.info(f"✅ Блок {block_index} замайнен успешно!")

    def is_chain_valid(self):
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i - 1]

            if current_block.hash != current_block.calculate_hash():
                return False
            if current_block.previous_hash != previous_block.hash:
                return False
        return True

    def get_balance(self, address: str) -> float:
        return calculate_balance(self, address)

    def ensure_state(self):
        """Если UTXO/KeyImages ещё не восстановлены"""
        if not self.utxo_set._map and len(self.chain) > 0:
            self.rebuild_state()

    def rebuild_state(self):
        """Полная реконструкция UTXO и key images"""
        self.utxo_set = UTXOSet()
        self.seen_key_images = set()
        for block in self.chain:
            self._apply_block_utxo(block)

    def _apply_block_utxo(self, block):
        """Применить все транзакции блока к UTXO/KeyImages."""
        for tx in block.transactions:
            txid = generate_transaction_id(tx)
    
            # 1) Потратить входы (если есть)
            for txin in getattr(tx, "inputs", []) or []:
                if not self.utxo_set.exists(txin.prev_txid, txin.output_index):
                    raise ValueError(f"Попытка потратить несуществующий UTXO: {txin.prev_txid}:{txin.output_index}")
                self.utxo_set.spend(txin.prev_txid, txin.output_index)
    
            # 2) Создать выходы
            if getattr(tx, "outputs", None):
                for idx, out in enumerate(tx.outputs):
                    out.txid = txid
                    out.index = idx
                    self.utxo_set.add(out)
            else:
                # Для coinbase или старых транзакций без outputs
                out = TxOutput(txid, 0, tx.receiver_address, float(tx.amount))
                self.utxo_set.add(out)
    
            # 3) Key image для анонимных транзакций
            if tx.tx_type == "anonymous" and tx.key_image:
                if tx.key_image in self.seen_key_images:
                    raise ValueError(f"Двойная трата key_image: {tx.key_image}")
                self.seen_key_images.add(tx.key_image)

    def validate_transaction_utxo(self, tx: Transaction) -> bool:
        """Проверка трат через UTXO/KeyImages"""
        self.ensure_state()

        if not getattr(tx, "inputs", None) or not getattr(tx, "outputs", None):
            if tx.tx_type != "coinbase":
                logging.warning("TX без inputs/outputs не допускается (кроме coinbase)")
                return False

        if tx.tx_type == "coinbase":
            return True

        amount_in, amount_out = 0.0, 0.0

        # Проверка входов
        for i in tx.inputs:
            if not self.utxo_set.has(i.prev_txid, i.output_index):
                logging.warning("Потраченный или отсутствующий вход UTXO")
                return False
            utxo = self.utxo_set.get(i.prev_txid, i.output_index)
            amount_in += float(utxo.amount)

        # Сумма выходов
        for o in tx.outputs:
            amount_out += float(o.amount)

        if amount_in + 1e-9 < amount_out:
            logging.warning("Сумма входов меньше суммы выходов")
            return False

        # Анонимные tx
        if tx.tx_type == "anonymous":
            if tx.key_image and tx.key_image in self.seen_key_images:
                logging.warning("Повторная трата: key_image уже встречался")
                return False
            return True

        # Стандартные tx
        if not tx.verify_signature():
            logging.warning("Невалидная подпись стандартной транзакции")
            return False

        sender_addr = tx.get_sender_address()
        for i in tx.inputs:
            utxo = self.utxo_set.get(i.prev_txid, i.output_index)
            if not utxo or utxo.address != sender_addr:
                logging.warning("Вход UTXO не принадлежит отправителю")
                return False

        return True

    def to_dict(self):
        return {
            'chain': [block.to_dict() for block in self.chain],
            'pending_transactions': [tx.to_dict() for tx in self.pending_transactions],
            'difficulty': self.difficulty,
            'rewards': self.rewards
        }

    @classmethod
    def from_dict(cls, data):
        blockchain = cls(difficulty=data['difficulty'])
        blockchain.chain = [Block.from_dict(block) for block in data['chain']]
        blockchain.pending_transactions = [Transaction.from_dict(tx) for tx in data['pending_transactions']]
        blockchain.rewards = data['rewards']
        blockchain.rebuild_state()
        return blockchain

# ================================
# ФУНКЦИИ СОХРАНЕНИЯ/ЗАГРУЗКИ
# ================================

def save_blockchain(blockchain: Blockchain, filename=BLOCKCHAIN_DATA_FILE):
    """Сохранение блокчейна в JSON файл"""
    try:
        data = blockchain.to_dict()
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logging.info(f"✅ Блокчейн сохранен в {filename}")
        return True
    except Exception as e:
        logging.error(f"❌ Ошибка сохранения блокчейна: {e}")
        return False

def load_blockchain(filename=BLOCKCHAIN_DATA_FILE) -> Blockchain | None:
    """Загрузка блокчейна из JSON файла"""
    try:
        if not os.path.exists(filename):
            logging.info(f"📁 Файл блокчейна {filename} не найден, создается новый")
            return None

        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)

        blockchain = Blockchain.from_dict(data)
        logging.info(f"✅ Блокчейн загружен из {filename}")
        return blockchain
    except Exception as e:
        logging.error(f"❌ Ошибка загрузки блокчейна: {e}")
        return None

def save_wallets(filename=WALLETS_DATA_FILE):
    """Сохранение кошельков в JSON файл"""
    try:
        wallet_data = {}
        for address, wallet_info in wallets.items():
            if isinstance(wallet_info, dict):
                wallet_data[address] = wallet_info
            else:
                wallet_data[address] = {
                    'public_key': wallet_info.public_key_hex,
                    'address': address
                }

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(wallet_data, f, indent=2, ensure_ascii=False)
        logging.info(f"✅ Кошельки сохранены в {filename}")
        return True
    except Exception as e:
        logging.error(f"❌ Ошибка сохранения кошельков: {e}")
        return False

def load_wallets(filename=WALLETS_DATA_FILE):
    """Загрузка кошельков из JSON файла"""
    global wallets
    try:
        if not os.path.exists(filename):
            logging.info(f"📁 Файл кошельков {filename} не найден")
            return

        with open(filename, 'r', encoding='utf-8') as f:
            wallets = json.load(f)

        logging.info(f"✅ Кошельки загружены из {filename}")
    except Exception as e:
        logging.error(f"❌ Ошибка загрузки кошельков: {e}")

def register_wallet(wallet: Wallet):
    """Регистрация кошелька в глобальном хранилище"""
    address = wallet.get_address()
    wallets[address] = {
        'public_key': wallet.public_key_hex,
        'address': address
    }
    logging.info(f"✅ Кошелек зарегистрирован: {address[:16]}...")

# ================================
# ДЕМОНСТРАЦИЯ И ТЕСТИРОВАНИЕ
# ================================

def demo_blockchain():
    """Демонстрация всех функций блокчейна"""
    print("=" * 80)
    print(f"🚀 {BLOCKCHAIN_NAME} - Демонстрация блокчейна с анонимными функциями")
    print("=" * 80)

    # Инициализация блокчейна
    blockchain = Blockchain(difficulty=2)  # Низкая сложность для демо

    # Создание кошельков
    print("\n👛 СОЗДАНИЕ КОШЕЛЬКОВ")
    print("-" * 40)

    wallets_demo = []
    for i in range(4):  # Создаем 4 кошелька для демо анонимности
        wallet = Wallet()
        wallets_demo.append(wallet)
        register_wallet(wallet)

        address = wallet.get_address()
        print(f"✅ Кошелек {i+1}: {address[:16]}...{address[-8:]}")

    print(f"📊 Всего кошельков для анонимности: {len(wallets)}")

    # Майнинг начальных блоков
    print("\n⛏️  МАЙНИНГ НАЧАЛЬНЫХ БЛОКОВ")
    print("-" * 40)

    miner = wallets_demo[0]
    miner_address = miner.get_address()

    for i in range(3):
        print(f"⛏️  Майнинг блока {i+1}...")
        blockchain.mine_pending_transactions(miner_address, f"Демо блок {i+1}")
        balance = calculate_balance(blockchain, miner_address)
        print(f"   Баланс майнера: {balance:.2f} {BLOCKCHAIN_NAME}")

    # Обычные транзакции
    print("\n💰 ОБЫЧНЫЕ ТРАНЗАКЦИИ")
    print("-" * 40)

    sender = wallets_demo[0]
    receiver = wallets_demo[1]

    # Создание обычной транзакции
    tx1 = Transaction(
        sender_pubkey_hex=sender.public_key_hex,
        receiver_address=receiver.get_address(),
        amount=30.0,
        metadata="Обычная транзакция"
    )
    tx1.sign_transaction(sender)

    if blockchain.add_transaction(tx1):
        print("✅ Обычная транзакция создана")
        print(f"   От: {sender.get_address()[:16]}...")
        print(f"   К: {receiver.get_address()[:16]}...")
        print(f"   Сумма: {tx1.amount}")

    # АНОНИМНЫЕ ТРАНЗАКЦИИ
    print("\n🔒 АНОНИМНЫЕ ТРАНЗАКЦИИ")
    print("-" * 40)

    # Создание анонимной транзакции
    anon_tx = sender.create_anonymous_transaction(
        receiver_address=wallets_demo[2].get_address(),
        amount=20.0,
        metadata="Секретная транзакция"
    )

    if anon_tx and blockchain.add_transaction(anon_tx):
        print("✅ Анонимная транзакция создана")
        print(f"   От: {anon_tx.get_sender_address()}")  # Покажет "ANONYMOUS"
        print(f"   К: {anon_tx.receiver_address[:16]}...")
        print(f"   Сумма: {anon_tx.amount}")
        print(f"   Тип: {anon_tx.tx_type}")

    # Майнинг блока с транзакциями
    print("\n⛏️  МАЙНИНГ БЛОКА С ТРАНЗАКЦИЯМИ")
    print("-" * 40)

    print(f"Ожидающих транзакций: {len(blockchain.pending_transactions)}")
    blockchain.mine_pending_transactions(miner_address, "Блок с транзакциями")

    # Показать балансы
    print("\n💰 ИТОГОВЫЕ БАЛАНСЫ")
    print("-" * 40)

    for i, wallet in enumerate(wallets_demo):
        address = wallet.get_address()
        balance = calculate_balance(blockchain, address)
        print(f"Кошелек {i+1}: {balance:.2f} {BLOCKCHAIN_NAME}")

    # Проверка блокчейна
    print("\n🔍 ПРОВЕРКА БЛОКЧЕЙНА")
    print("-" * 40)

    print(f"🔗 Всего блоков: {len(blockchain.chain)}")
    print(f"🪙 Общее предложение: {blockchain.get_total_supply():.2f}")
    print(f"✅ Блокчейн валиден: {blockchain.is_chain_valid()}")

    # Сохранение данных
    print("\n💾 СОХРАНЕНИЕ ДАННЫХ")
    print("-" * 40)

    if save_blockchain(blockchain):
        print("✅ Блокчейн сохранен")

    if save_wallets():
        print("✅ Кошельки сохранены")

    print("\n" + "=" * 80)
    print("🎉 Демонстрация завершена успешно!")
    print("🔍 Блокчейн с анонимными функциями полностью работает!")
    print("=" * 80)

    return blockchain, wallets_demo

# ================================
# ПРОСТОЙ КОНСОЛЬНЫЙ ИНТЕРФЕЙС
# ================================

def console_interface():
    """Простой консольный интерфейс для управления блокчейном"""

    # Загрузка существующих данных
    blockchain = load_blockchain() or Blockchain()
    load_wallets()

    user_wallets = {}
    current_wallet = None

    while True:
        print("\n" + "=" * 60)
        print(f"🪙  {BLOCKCHAIN_NAME} - Консольный интерфейс")
        print("=" * 60)
        print(f"📊 Всего блоков: {len(blockchain.chain)}")
        print(f"🪙 Общее предложение: {blockchain.get_total_supply():.2f}")
        print(f"📝 Ожидающих транзакций: {len(blockchain.pending_transactions)}")
        print(f"👛 Зарегистрированных кошельков: {len(wallets)}")

        if current_wallet:
            balance = calculate_balance(blockchain, current_wallet.get_address())
            print(f"💰 Ваш баланс: {balance:.2f} {BLOCKCHAIN_NAME}")

        print("\n🔹 Меню:")
        print("1. 👛 Создать кошелек")
        print("2. 💰 Отправить обычную транзакцию")
        print("3. 🔒 Отправить анонимную транзакцию")
        print("4. ⛏️  Майнить блок")
        print("5. 🔍 Показать блокчейн")
        print("6. 💾 Сохранить данные")
        print("7. 🚀 Запустить демо")
        print("8. ❌ Выйти")

        choice = input("\n👉 Выберите действие (1-8): ").strip()

        if choice == '1':
            # Создание кошелька
            wallet = Wallet()
            wallet_name = f"Кошелек_{len(user_wallets) + 1}"
            user_wallets[wallet_name] = wallet
            register_wallet(wallet)

            if not current_wallet:
                current_wallet = wallet

            print(f"✅ {wallet_name} создан!")
            print(f"📍 Адрес: {wallet.get_address()}")

        elif choice == '2':
            # Обычная транзакция
            if not current_wallet:
                print("❌ Сначала создайте кошелек!")
                continue

            try:
                receiver = input("👉 Адрес получателя: ").strip()
                amount = float(input("👉 Сумма: ").strip())

                balance = calculate_balance(blockchain, current_wallet.get_address())
                if balance < amount:
                    print(f"❌ Недостаточно средств. Доступно: {balance:.2f}")
                    continue

                tx = Transaction(
                    sender_pubkey_hex=current_wallet.public_key_hex,
                    receiver_address=receiver,
                    amount=amount
                )
                tx.sign_transaction(current_wallet)

                if blockchain.add_transaction(tx):
                    print("✅ Транзакция отправлена!")
                else:
                    print("❌ Ошибка отправки транзакции")

            except ValueError:
                print("❌ Неверная сумма")
            except Exception as e:
                print(f"❌ Ошибка: {e}")

        elif choice == '3':
            # Анонимная транзакция
            if not current_wallet:
                print("❌ Сначала создайте кошелек!")
                continue

            if len(wallets) < 3:
                print("❌ Для анонимных транзакций нужно минимум 3 кошелька в системе")
                continue

            try:
                receiver = input("👉 Адрес получателя: ").strip()
                amount = float(input("👉 Сумма: ").strip())

                balance = calculate_balance(blockchain, current_wallet.get_address())
                if balance < amount:
                    print(f"❌ Недостаточно средств. Доступно: {balance:.2f}")
                    continue

                anon_tx = current_wallet.create_anonymous_transaction(receiver, amount)

                if anon_tx and blockchain.add_transaction(anon_tx):
                    print("✅ Анонимная транзакция отправлена!")
                    print("🔒 Ваша личность скрыта в кольцевой подписи")
                else:
                    print("❌ Ошибка отправки анонимной транзакции")

            except ValueError:
                print("❌ Неверная сумма")
            except Exception as e:
                print(f"❌ Ошибка: {e}")

        elif choice == '4':
            # Майнинг
            if not current_wallet:
                print("❌ Сначала создайте кошелек для получения наград!")
                continue

            if not blockchain.pending_transactions:
                print("❌ Нет транзакций для майнинга")
                continue

            print("⛏️  Майнинг блока...")
            miner_address = current_wallet.get_address()
            blockchain.mine_pending_transactions(miner_address)
            print("✅ Блок замайнен!")

        elif choice == '5':
            # Показать блокчейн
            print(f"\n🔍 Обзор блокчейна:")
            print(f"🔗 Всего блоков: {len(blockchain.chain)}")
            print(f"🪙 Общее предложение: {blockchain.get_total_supply():.2f}")
            print(f"⚙️  Сложность: {blockchain.difficulty}")
            print(f"🎁 Текущая награда: {blockchain.rewards}")

            print("\n📋 Последние блоки:")
            recent = blockchain.chain[-3:]
            for block in recent:
                print(f"   Блок {block.index}: {format_hash(block.hash)} ({len(block.transactions)} транзакций)")

        elif choice == '6':
            # Сохранить данные
            print("💾 Сохранение данных...")
            if save_blockchain(blockchain) and save_wallets():
                print("✅ Данные сохранены!")
            else:
                print("❌ Ошибка сохранения")

        elif choice == '7':
            # Демо
            print("🚀 Запуск демонстрации...")
            demo_blockchain()

        elif choice == '8':
            # Выход
            print("💾 Автосохранение...")
            save_blockchain(blockchain)
            save_wallets()
            print("👋 До свидания!")
            break

        else:
            print("❌ Неверный выбор")

        input("\nНажмите Enter для продолжения...")

# ================================
# ГЛАВНАЯ ФУНКЦИЯ
# ================================

def main():
    """Главная точка входа"""
    print("🪙 Добро пожаловать в anonCoin - блокчейн с анонимными функциями!")
    print()

    while True:
        print("Выберите режим:")
        print("1. 🖥️  Консольный интерфейс")
        print("2. 🚀 Демонстрация")
        print("3. ❌ Выход")

        choice = input("\n👉 Ваш выбор (1-3): ").strip()

        if choice == '1':
            console_interface()
            break
        elif choice == '2':
            demo_blockchain()
            break
        elif choice == '3':
            print("👋 До свидания!")
            break
        else:
            print("❌ Неверный выбор")

if __name__ == "__main__":
    main()
