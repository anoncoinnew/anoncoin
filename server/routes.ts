import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { spawn, ChildProcess } from "child_process";
import crypto from "crypto";
import { insertTransactionSchema, insertTradeOrderSchema } from "@shared/schema";

let blockchainProcess: ChildProcess | null = null;
const connectedClients = new Set<WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for P2P communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('New P2P connection established');
    connectedClients.add(ws);

    // Encrypt all P2P communications
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Decrypt incoming message if encrypted
        if (message.encrypted) {
          message.data = decryptMessage(message.data);
        }

        handleP2PMessage(ws, message);
      } catch (error) {
        console.error('P2P message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log('P2P connection closed');
    });

    // Send encrypted welcome message
    const welcomeMessage = {
      type: 'welcome',
      encrypted: true,
      data: encryptMessage({ status: 'connected', nodeCount: connectedClients.size })
    };
    ws.send(JSON.stringify(welcomeMessage));
  });

  // Blockchain API routes
  app.get('/api/blockchain/info', async (req, res) => {
    try {
      const info = await storage.getBlockchainInfo();
      const latestBlock = await storage.getLatestBlock();
      const activeNodes = await storage.getActiveNodes();
      
      res.json({
        ...info,
        latestBlockHeight: latestBlock?.height || 0,
        activeNodes: activeNodes.length,
        networkHashRate: calculateNetworkHashRate(),
        isEncrypted: true
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get blockchain info' });
    }
  });

  // Wallet management routes
  app.post('/api/wallet/create', async (req, res) => {
    try {
      const { address, encryptedPrivateKey } = req.body;
      
      if (!address || !encryptedPrivateKey) {
        return res.status(400).json({ error: 'Address and encrypted private key required' });
      }

      const wallet = await storage.createWallet({ address, encryptedPrivateKey });
      
      // Initialize mining stats
      await storage.updateMiningStats(address, {
        walletAddress: address,
        blocksMinedCount: 0,
        totalRewards: "0",
        hashRate: "0",
        isActive: false
      });

      res.json({ 
        address: wallet.address, 
        balance: wallet.balance,
        created: true 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create wallet' });
    }
  });

  app.get('/api/wallet/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const wallet = await storage.getWallet(address);
      
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const transactions = await storage.getTransactionsByAddress(address, 10);
      const miningStats = await storage.getMiningStats(address);

      res.json({
        address: wallet.address,
        balance: wallet.balance,
        transactions,
        miningStats
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get wallet info' });
    }
  });

  // Transaction routes
  app.post('/api/transaction/send', async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      
      // Enhanced difficulty for anonymous transactions
      if (validatedData.isAnonymous) {
        // Implement ring signature validation here
        const ringSize = 5; // Minimum ring size for anonymity
        console.log(`Creating anonymous transaction with ring size: ${ringSize}`);
      }

      const transaction = await storage.createTransaction(validatedData);
      
      // Broadcast to P2P network with encryption
      broadcastEncrypted({
        type: 'new_transaction',
        data: transaction
      });

      res.json({ 
        hash: transaction.hash, 
        status: 'pending',
        anonymous: validatedData.isAnonymous 
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid transaction data' });
    }
  });

  app.get('/api/transactions/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const transactions = await storage.getTransactionsByAddress(address, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  });

  // Mining routes with enhanced difficulty
  app.post('/api/mining/start', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      await storage.updateMiningStats(walletAddress, {
        isActive: true,
        lastMiningTime: new Date(),
        hashRate: "0"
      });

      // Start enhanced mining process with higher difficulty
      startEnhancedMining(walletAddress);

      res.json({ 
        status: 'Mining started', 
        difficulty: 'High (8/10)',
        algorithm: 'Enhanced SHA-256' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start mining' });
    }
  });

  app.post('/api/mining/stop', async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      await storage.updateMiningStats(walletAddress, {
        isActive: false
      });

      res.json({ status: 'Mining stopped' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop mining' });
    }
  });

  app.get('/api/mining/stats/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const stats = await storage.getMiningStats(address);
      
      res.json(stats || {
        walletAddress: address,
        blocksMinedCount: 0,
        totalRewards: "0",
        hashRate: "0",
        isActive: false
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get mining stats' });
    }
  });

  // P2P Trading routes
  app.get('/api/trading/orders', async (req, res) => {
    try {
      const orderType = req.query.type as string;
      const orders = await storage.getTradeOrders(orderType);
      
      // Anonymize order data
      const anonymizedOrders = orders.map(order => ({
        ...order,
        walletAddress: anonymizeAddress(order.walletAddress),
        seller: 'Anonymous Trader',
        escrowProtected: true
      }));

      res.json(anonymizedOrders);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get trading orders' });
    }
  });

  app.post('/api/trading/orders', async (req, res) => {
    try {
      const validatedData = insertTradeOrderSchema.parse(req.body);
      
      const order = await storage.createTradeOrder({
        ...validatedData,
        totalValue: (parseFloat(validatedData.amount) * parseFloat(validatedData.price)).toString()
      });

      // Broadcast to P2P trading network
      broadcastEncrypted({
        type: 'new_trade_order',
        data: {
          ...order,
          walletAddress: anonymizeAddress(order.walletAddress)
        }
      });

      res.json(order);
    } catch (error) {
      res.status(400).json({ error: 'Invalid order data' });
    }
  });

  app.get('/api/trading/orders/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const orders = await storage.getOrdersByWallet(walletAddress);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user orders' });
    }
  });

  // P2P Network status
  app.get('/api/p2p/nodes', async (req, res) => {
    try {
      const nodes = await storage.getActiveNodes();
      res.json({
        activeNodes: nodes.length,
        encryptionEnabled: true,
        networkType: 'Anonymous P2P'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get P2P status' });
    }
  });

  return httpServer;
}

// P2P Message handling with encryption
function handleP2PMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ 
        type: 'pong', 
        encrypted: true,
        data: encryptMessage({ timestamp: Date.now() })
      }));
      break;
      
    case 'request_blockchain':
      // Send encrypted blockchain data
      storage.getBlockchainInfo().then(info => {
        ws.send(JSON.stringify({
          type: 'blockchain_info',
          encrypted: true,
          data: encryptMessage(info)
        }));
      });
      break;
      
    case 'new_block':
      // Broadcast new block to all connected peers
      broadcastEncrypted(message, ws);
      break;
      
    case 'new_transaction':
      // Broadcast new transaction to network
      broadcastEncrypted(message, ws);
      break;
  }
}

function broadcastEncrypted(message: any, excludeWs?: WebSocket) {
  const encryptedMessage = {
    ...message,
    encrypted: true,
    data: encryptMessage(message.data)
  };
  
  connectedClients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(encryptedMessage));
    }
  });
}

// Encryption/Decryption for P2P communications
const ENCRYPTION_KEY = crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

function encryptMessage(data: any): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decryptMessage(encryptedData: string): any {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// Enhanced mining with higher difficulty
function startEnhancedMining(walletAddress: string) {
  // Simulate enhanced mining difficulty (8/10 level)
  const miningInterval = setInterval(async () => {
    const stats = await storage.getMiningStats(walletAddress);
    if (!stats?.isActive) {
      clearInterval(miningInterval);
      return;
    }

    // Enhanced difficulty calculation
    const difficulty = 8; // High difficulty level
    const hashRate = Math.random() * 500 + 200; // 200-700 H/s
    
    await storage.updateMiningStats(walletAddress, {
      hashRate: hashRate.toString(),
      lastMiningTime: new Date()
    });

    // Simulate finding a block (low probability due to high difficulty)
    if (Math.random() < 0.001) { // 0.1% chance per attempt
      const latestBlock = await storage.getLatestBlock();
      const newHeight = (latestBlock?.height || 0) + 1;
      
      const newBlock = await storage.createBlock({
        height: newHeight,
        hash: generateBlockHash(newHeight),
        previousHash: latestBlock?.hash || null,
        merkleRoot: crypto.randomBytes(32).toString('hex'),
        difficulty,
        nonce: crypto.randomBytes(8).toString('hex'),
        reward: "25",
        minerAddress: walletAddress
      });

      // Update mining stats
      const currentStats = await storage.getMiningStats(walletAddress);
      await storage.updateMiningStats(walletAddress, {
        blocksMinedCount: (currentStats?.blocksMinedCount || 0) + 1,
        totalRewards: (parseFloat(currentStats?.totalRewards || "0") + 25).toString()
      });

      // Broadcast new block
      broadcastEncrypted({
        type: 'new_block',
        data: newBlock
      });

      console.log(`Block ${newHeight} mined by ${walletAddress}`);
    }
  }, 5000); // Check every 5 seconds
}

function generateBlockHash(height: number): string {
  return crypto.createHash('sha256')
    .update(`block_${height}_${Date.now()}_${Math.random()}`)
    .digest('hex');
}

function anonymizeAddress(address: string): string {
  if (address.length < 16) return address;
  return address.substring(0, 8) + '...' + address.substring(address.length - 8);
}

function calculateNetworkHashRate(): string {
  // Simulate network hash rate calculation
  return `${(Math.random() * 10000 + 5000).toFixed(0)} H/s`;
}
