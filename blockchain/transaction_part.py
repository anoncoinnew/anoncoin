class Transaction:
    def __init__(self, sender_pubkey_hex, receiver_address, amount, signature=None, 
                 metadata=None, tx_type="standard", timestamp=None, ring_signature=None):
        self.sender_pubkey = sender_pubkey_hex
        self.receiver_address = receiver_address
        self.amount = amount
        self.signature = signature
        self.metadata = metadata
        self.tx_type = tx_type
        self.timestamp = timestamp if timestamp else int(time.time())
        self.ring_signature = ring_signature

    def to_dict(self) -> dict:
        result = {
            "sender_pubkey": self.sender_pubkey,
            "receiver_address": self.receiver_address,
            "amount": self.amount,
            "signature": self.signature,
            "metadata": self.metadata,
            "tx_type": self.tx_type,
            "timestamp": self.timestamp
        }
        if self.ring_signature:
            result["ring_signature"] = self.ring_signature
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True)

    def sign_transaction(self, wallet):
        """Подпись транзакции кошельком"""
        self.sender_pubkey = wallet.public_key.to_string().hex()
        message = serialize_transaction(self.to_dict())
        self.signature = wallet.sign(message)

    def verify_signature(self) -> bool:
        """Проверка подписи транзакции"""
        # Для анонимных транзакций проверяем кольцевую подпись
        if self.tx_type == "anonymous" and self.ring_signature:
            message = serialize_transaction(self.to_dict())
            return verify_ring_signature(message, self.ring_signature, self.ring_signature[1])
        
        # Для обычных транзакций проверяем ECDSA подпись
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
        """Получение адреса отправителя из публичного ключа"""
        if self.tx_type == "anonymous":
            return "ANONYMOUS"  # Скрываем адрес для анонимных транзакций
        
        if not self.sender_pubkey:
            return None
        return pubkey_to_address(bytes.fromhex(self.sender_pubkey))

    @classmethod
    def from_dict(cls, data):
        """Создание транзакции из словаря"""
        return cls(
            sender_pubkey_hex=data.get('sender_pubkey'),
            receiver_address=data['receiver_address'],
            amount=data['amount'],
            signature=data.get('signature'),
            metadata=data.get('metadata'),
            tx_type=data.get('tx_type', 'standard'),
            timestamp=data.get('timestamp'),
            ring_signature=data.get('ring_signature')
        )

# ================================
# КЛАСС БЛОКА
# ================================

