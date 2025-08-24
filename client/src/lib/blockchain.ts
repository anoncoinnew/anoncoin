import { apiRequest } from "./queryClient";

export interface BlockchainInfo {
  totalBlocks: number;
  totalSupply: string;
  difficulty: number;
  latestBlockHeight: number;
  activeNodes: number;
  networkHashRate: string;
  isEncrypted: boolean;
}

export interface WalletInfo {
  address: string;
  balance: string;
  transactions: Transaction[];
  miningStats?: MiningStats;
}

export interface Transaction {
  id: string;
  hash: string;
  fromAddress?: string;
  toAddress: string;
  amount: string;
  fee: string;
  isAnonymous: boolean;
  blockHeight?: number;
  status: string;
  timestamp: string;
}

export interface MiningStats {
  walletAddress: string;
  blocksMinedCount: number;
  totalRewards: string;
  hashRate: string;
  lastMiningTime?: string;
  isActive: boolean;
}

export interface TradeOrder {
  id: string;
  walletAddress: string;
  orderType: 'buy' | 'sell';
  amount: string;
  price: string;
  totalValue: string;
  status: string;
  isAnonymous: boolean;
  escrowLocked: boolean;
  createdAt: string;
}

export class BlockchainAPI {
  static async getBlockchainInfo(): Promise<BlockchainInfo> {
    const response = await apiRequest('GET', '/api/blockchain/info');
    return response.json();
  }

  static async createWallet(address: string, encryptedPrivateKey: string): Promise<{ address: string; balance: string; created: boolean }> {
    const response = await apiRequest('POST', '/api/wallet/create', {
      address,
      encryptedPrivateKey
    });
    return response.json();
  }

  static async getWalletInfo(address: string): Promise<WalletInfo> {
    const response = await apiRequest('GET', `/api/wallet/${address}`);
    return response.json();
  }

  static async sendTransaction(data: {
    hash: string;
    fromAddress?: string;
    toAddress: string;
    amount: string;
    fee?: string;
    isAnonymous?: boolean;
  }): Promise<{ hash: string; status: string; anonymous: boolean }> {
    const response = await apiRequest('POST', '/api/transaction/send', data);
    return response.json();
  }

  static async getTransactions(address: string, limit?: number): Promise<Transaction[]> {
    const url = `/api/transactions/${address}${limit ? `?limit=${limit}` : ''}`;
    const response = await apiRequest('GET', url);
    return response.json();
  }

  static async startMining(walletAddress: string): Promise<{ status: string; difficulty: string; algorithm: string }> {
    const response = await apiRequest('POST', '/api/mining/start', { walletAddress });
    return response.json();
  }

  static async stopMining(walletAddress: string): Promise<{ status: string }> {
    const response = await apiRequest('POST', '/api/mining/stop', { walletAddress });
    return response.json();
  }

  static async getMiningStats(address: string): Promise<MiningStats> {
    const response = await apiRequest('GET', `/api/mining/stats/${address}`);
    return response.json();
  }

  static async getTradeOrders(orderType?: string): Promise<TradeOrder[]> {
    const url = `/api/trading/orders${orderType ? `?type=${orderType}` : ''}`;
    const response = await apiRequest('GET', url);
    return response.json();
  }

  static async createTradeOrder(data: {
    walletAddress: string;
    orderType: 'buy' | 'sell';
    amount: string;
    price: string;
    isAnonymous?: boolean;
  }): Promise<TradeOrder> {
    const response = await apiRequest('POST', '/api/trading/orders', data);
    return response.json();
  }

  static async getUserOrders(walletAddress: string): Promise<TradeOrder[]> {
    const response = await apiRequest('GET', `/api/trading/orders/${walletAddress}`);
    return response.json();
  }

  static async getP2PStatus(): Promise<{ activeNodes: number; encryptionEnabled: boolean; networkType: string }> {
    const response = await apiRequest('GET', '/api/p2p/nodes');
    return response.json();
  }
}
