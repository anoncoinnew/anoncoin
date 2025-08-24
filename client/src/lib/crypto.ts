import CryptoJS from 'crypto-js';

// BIP39 word list for seed phrase generation
const BIP39_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit'
  // ... (truncated for brevity, would include full 2048 words)
];

// Simple implementation - in production use proper BIP39 library
export function generateSeedPhrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * BIP39_WORDS.length);
    words.push(BIP39_WORDS[randomIndex]);
  }
  return words.join(' ');
}

export function validateSeedPhrase(seedPhrase: string): boolean {
  const words = seedPhrase.trim().split(/\s+/);
  
  // Check word count
  if (words.length !== 12) return false;
  
  // Check if all words are in BIP39 word list
  return words.every(word => BIP39_WORDS.includes(word.toLowerCase()));
}

// Derive wallet from seed phrase (simplified implementation)
export async function deriveWalletFromSeed(seedPhrase: string): Promise<{
  address: string;
  encryptedPrivateKey: string;
}> {
  // Generate deterministic private key from seed phrase
  const privateKey = CryptoJS.SHA256(seedPhrase).toString();
  
  // Generate public key (simplified - would use proper elliptic curve in production)
  const publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
  
  // Generate address from public key
  const address = 'anon' + CryptoJS.SHA256(publicKey).toString().substring(0, 32);
  
  // Encrypt private key for storage
  const encryptionKey = CryptoJS.SHA256('anoncoin' + Date.now()).toString();
  const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, encryptionKey).toString();
  
  return {
    address,
    encryptedPrivateKey
  };
}

// Generate transaction hash
export function generateTransactionHash(data: {
  fromAddress?: string;
  toAddress: string;
  amount: string;
  timestamp: number;
}): string {
  const hashInput = `${data.fromAddress || 'coinbase'}_${data.toAddress}_${data.amount}_${data.timestamp}`;
  return CryptoJS.SHA256(hashInput).toString();
}

// Create ring signature for anonymous transactions (simplified)
export function createRingSignature(
  transaction: any,
  privateKey: string,
  publicKeys: string[]
): string {
  // Simplified ring signature implementation
  // In production, would use proper cryptographic ring signature algorithm
  const ringData = {
    transaction: CryptoJS.SHA256(JSON.stringify(transaction)).toString(),
    publicKeys,
    signature: CryptoJS.HmacSHA256(JSON.stringify(transaction), privateKey).toString()
  };
  
  return CryptoJS.SHA256(JSON.stringify(ringData)).toString();
}

// Verify ring signature
export function verifyRingSignature(
  transaction: any,
  signature: string,
  publicKeys: string[]
): boolean {
  // Simplified verification
  // In production, would implement proper ring signature verification
  return signature.length === 64 && publicKeys.length >= 3;
}

// Encrypt P2P messages
export function encryptP2PMessage(message: any, sharedKey: string): string {
  const messageString = JSON.stringify(message);
  return CryptoJS.AES.encrypt(messageString, sharedKey).toString();
}

// Decrypt P2P messages
export function decryptP2PMessage(encryptedMessage: string, sharedKey: string): any {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, sharedKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error('Failed to decrypt P2P message');
  }
}

// Generate secure random keys
export function generateRandomKey(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString();
}

// Hash function for mining (enhanced difficulty)
export function mineBlockHash(
  blockData: any,
  difficulty: number,
  nonce: number
): { hash: string; isValid: boolean } {
  const blockString = JSON.stringify({ ...blockData, nonce });
  const hash = CryptoJS.SHA256(blockString).toString();
  
  // Enhanced difficulty check - requires more leading zeros
  const target = '0'.repeat(difficulty);
  const isValid = hash.startsWith(target);
  
  return { hash, isValid };
}
