import { 
  type Wallet, 
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
  type Block,
  type InsertBlock,
  type MiningStats,
  type TradeOrder,
  type InsertTradeOrder,
  type P2PNode
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Wallet operations
  getWallet(address: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(address: string, balance: string): Promise<void>;
  
  // Transaction operations
  getTransaction(hash: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByAddress(address: string, limit?: number): Promise<Transaction[]>;
  updateTransactionStatus(hash: string, status: string, blockHeight?: number): Promise<void>;
  
  // Block operations
  getBlock(height: number): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  getLatestBlock(): Promise<Block | undefined>;
  getBlockchainInfo(): Promise<{ totalBlocks: number; totalSupply: string; difficulty: number }>;
  
  // Mining operations
  getMiningStats(walletAddress: string): Promise<MiningStats | undefined>;
  updateMiningStats(walletAddress: string, stats: Partial<MiningStats>): Promise<void>;
  
  // Trading operations
  getTradeOrders(orderType?: string): Promise<TradeOrder[]>;
  createTradeOrder(order: InsertTradeOrder): Promise<TradeOrder>;
  updateTradeOrderStatus(id: string, status: string): Promise<void>;
  getOrdersByWallet(walletAddress: string): Promise<TradeOrder[]>;
  
  // P2P operations
  getActiveNodes(): Promise<P2PNode[]>;
  updateNodeStatus(nodeId: string, isActive: boolean): Promise<void>;
}

export class MemStorage implements IStorage {
  private wallets: Map<string, Wallet> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private blocks: Map<number, Block> = new Map();
  private miningStats: Map<string, MiningStats> = new Map();
  private tradeOrders: Map<string, TradeOrder> = new Map();
  private p2pNodes: Map<string, P2PNode> = new Map();

  constructor() {
    // Initialize with genesis block
    this.initializeGenesis();
  }

  private initializeGenesis() {
    const genesisBlock: Block = {
      id: randomUUID(),
      height: 0,
      hash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
      previousHash: null,
      merkleRoot: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      timestamp: new Date("2025-01-01T00:00:00Z"),
      difficulty: 4,
      nonce: "2083236893",
      reward: "50",
      minerAddress: "genesis"
    };
    this.blocks.set(0, genesisBlock);
  }

  async getWallet(address: string): Promise<Wallet | undefined> {
    return this.wallets.get(address);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const wallet: Wallet = {
      id: randomUUID(),
      ...insertWallet,
      balance: "0",
      createdAt: new Date(),
    };
    this.wallets.set(wallet.address, wallet);
    return wallet;
  }

  async updateWalletBalance(address: string, balance: string): Promise<void> {
    const wallet = this.wallets.get(address);
    if (wallet) {
      wallet.balance = balance;
    }
  }

  async getTransaction(hash: string): Promise<Transaction | undefined> {
    return this.transactions.get(hash);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const transaction: Transaction = {
      id: randomUUID(),
      ...insertTransaction,
      blockHeight: null,
      status: "pending",
      timestamp: new Date(),
    };
    this.transactions.set(transaction.hash, transaction);
    return transaction;
  }

  async getTransactionsByAddress(address: string, limit: number = 50): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.fromAddress === address || tx.toAddress === address)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async updateTransactionStatus(hash: string, status: string, blockHeight?: number): Promise<void> {
    const transaction = this.transactions.get(hash);
    if (transaction) {
      transaction.status = status;
      if (blockHeight !== undefined) {
        transaction.blockHeight = blockHeight;
      }
    }
  }

  async getBlock(height: number): Promise<Block | undefined> {
    return this.blocks.get(height);
  }

  async createBlock(insertBlock: InsertBlock): Promise<Block> {
    const block: Block = {
      id: randomUUID(),
      ...insertBlock,
      timestamp: new Date(),
    };
    this.blocks.set(block.height, block);
    return block;
  }

  async getLatestBlock(): Promise<Block | undefined> {
    const heights = Array.from(this.blocks.keys()).sort((a, b) => b - a);
    return heights.length > 0 ? this.blocks.get(heights[0]) : undefined;
  }

  async getBlockchainInfo(): Promise<{ totalBlocks: number; totalSupply: string; difficulty: number }> {
    const totalBlocks = this.blocks.size;
    const totalSupply = (totalBlocks * 25).toString(); // 25 coins per block
    const latestBlock = await this.getLatestBlock();
    const difficulty = latestBlock?.difficulty || 4;
    
    return { totalBlocks, totalSupply, difficulty };
  }

  async getMiningStats(walletAddress: string): Promise<MiningStats | undefined> {
    return this.miningStats.get(walletAddress);
  }

  async updateMiningStats(walletAddress: string, stats: Partial<MiningStats>): Promise<void> {
    const existing = this.miningStats.get(walletAddress) || {
      id: randomUUID(),
      walletAddress,
      blocksMinedCount: 0,
      totalRewards: "0",
      hashRate: "0",
      lastMiningTime: null,
      isActive: false,
    };
    
    this.miningStats.set(walletAddress, { ...existing, ...stats });
  }

  async getTradeOrders(orderType?: string): Promise<TradeOrder[]> {
    return Array.from(this.tradeOrders.values())
      .filter(order => !orderType || order.orderType === orderType)
      .filter(order => order.status === "active")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createTradeOrder(insertOrder: InsertTradeOrder): Promise<TradeOrder> {
    const order: TradeOrder = {
      id: randomUUID(),
      ...insertOrder,
      status: "active",
      escrowLocked: false,
      createdAt: new Date(),
      filledAt: null,
    };
    this.tradeOrders.set(order.id, order);
    return order;
  }

  async updateTradeOrderStatus(id: string, status: string): Promise<void> {
    const order = this.tradeOrders.get(id);
    if (order) {
      order.status = status;
      if (status === "filled") {
        order.filledAt = new Date();
      }
    }
  }

  async getOrdersByWallet(walletAddress: string): Promise<TradeOrder[]> {
    return Array.from(this.tradeOrders.values())
      .filter(order => order.walletAddress === walletAddress)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveNodes(): Promise<P2PNode[]> {
    return Array.from(this.p2pNodes.values())
      .filter(node => node.isActive)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  async updateNodeStatus(nodeId: string, isActive: boolean): Promise<void> {
    const node = this.p2pNodes.get(nodeId);
    if (node) {
      node.isActive = isActive;
      node.lastSeen = new Date();
    }
  }
}

export const storage = new MemStorage();
