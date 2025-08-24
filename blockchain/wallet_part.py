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
        """Создание анонимной транзакции с кольцевой подписью"""
        sender_address = self.get_address()
        
        # Получаем кольцо публичных ключей
        ring_keys = get_ring_public_keys(sender_address, RING_SIZE)
        
        if len(ring_keys) < 2:
            print("❌ Недостаточно кошельков для анонимной транзакции")
            return None
        
        # Создаем транзакцию
        tx = Transaction(
            sender_pubkey_hex=None,  # Скрываем отправителя
            receiver_address=receiver_address,
            amount=amount,
            metadata=metadata,
            tx_type="anonymous"
        )
        
        # Создаем кольцевую подпись
        message = serialize_transaction(tx.to_dict())
        ring_signature = create_ring_signature(message, self.private_key, ring_keys)
        tx.ring_signature = ring_signature
        
        print(f"✅ Создана анонимная транзакция с кольцом из {len(ring_keys)} участников")
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
# КЛАСС ТРАНЗАКЦИИ
# ================================

