import { useState, useEffect } from 'react';

interface WalletData {
  address: string;
  encryptedPrivateKey: string;
}

export function useWallet() {
  const [currentWallet, setCurrentWalletState] = useState<WalletData | null>(null);

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('anoncoin_wallet');
    if (savedWallet) {
      try {
        const walletData = JSON.parse(savedWallet);
        setCurrentWalletState(walletData);
      } catch (error) {
        console.error('Failed to load wallet from storage:', error);
        localStorage.removeItem('anoncoin_wallet');
      }
    }
  }, []);

  // Save wallet to localStorage
  const setCurrentWallet = (wallet: WalletData | null) => {
    setCurrentWalletState(wallet);
    
    if (wallet) {
      localStorage.setItem('anoncoin_wallet', JSON.stringify(wallet));
    } else {
      localStorage.removeItem('anoncoin_wallet');
    }
  };

  // Clear wallet data
  const clearWallet = () => {
    setCurrentWallet(null);
  };

  return {
    currentWallet,
    setCurrentWallet,
    clearWallet,
    hasWallet: !!currentWallet
  };
}
