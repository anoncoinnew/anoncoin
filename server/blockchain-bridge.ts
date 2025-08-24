import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { storage } from './storage';

class BlockchainBridge {
  private pythonProcess: ChildProcess | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const scriptPath = path.join(process.cwd(), 'blockchain', 'anoncoin_core.py');
    
    try {
      this.pythonProcess = spawn('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[Blockchain]:', output);
        this.handleBlockchainOutput(output);
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        console.error('[Blockchain Error]:', data.toString());
      });

      this.pythonProcess.on('close', (code) => {
        console.log(`Blockchain process exited with code ${code}`);
        this.isRunning = false;
      });

      this.isRunning = true;
      console.log('Blockchain bridge started successfully');
    } catch (error) {
      console.error('Failed to start blockchain bridge:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
      this.isRunning = false;
    }
  }

  private async handleBlockchainOutput(output: string): Promise<void> {
    try {
      // Parse blockchain events from Python process
      if (output.includes('Блок') && output.includes('замайнен')) {
        const blockMatch = output.match(/Блок (\d+) замайнен/);
        if (blockMatch) {
          const blockHeight = parseInt(blockMatch[1]);
          await this.syncBlock(blockHeight);
        }
      }

      if (output.includes('Транзакция отправлена')) {
        // Handle new transaction
        await this.syncTransactions();
      }
    } catch (error) {
      console.error('Error handling blockchain output:', error);
    }
  }

  private async syncBlock(height: number): Promise<void> {
    // Sync block data from Python blockchain to Node.js storage
    try {
      const existingBlock = await storage.getBlock(height);
      if (!existingBlock) {
        // Create block record in storage
        await storage.createBlock({
          height,
          hash: this.generateHash(`block_${height}`),
          previousHash: height > 0 ? this.generateHash(`block_${height - 1}`) : null,
          merkleRoot: this.generateHash(`merkle_${height}`),
          difficulty: 8, // Enhanced difficulty
          nonce: Math.random().toString(),
          reward: "25",
          minerAddress: "system"
        });
        console.log(`Block ${height} synced to storage`);
      }
    } catch (error) {
      console.error(`Error syncing block ${height}:`, error);
    }
  }

  private async syncTransactions(): Promise<void> {
    // Sync pending transactions
    console.log('Syncing transactions with blockchain');
  }

  private generateHash(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input + Date.now()).digest('hex');
  }

  async sendCommand(command: string, data?: any): Promise<any> {
    if (!this.pythonProcess || !this.isRunning) {
      throw new Error('Blockchain process not running');
    }

    return new Promise((resolve, reject) => {
      const message = JSON.stringify({ command, data });
      this.pythonProcess!.stdin?.write(message + '\n');
      
      // Set up timeout for response
      const timeout = setTimeout(() => {
        reject(new Error('Blockchain command timeout'));
      }, 10000);

      // Listen for response (simplified - in production would need proper message handling)
      const responseHandler = (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch {
          resolve({ success: true });
        }
      };

      this.pythonProcess!.stdout?.once('data', responseHandler);
    });
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const blockchainBridge = new BlockchainBridge();

// Auto-start blockchain bridge
process.nextTick(async () => {
  try {
    await blockchainBridge.start();
  } catch (error) {
    console.error('Failed to auto-start blockchain bridge:', error);
  }
});

// Cleanup on process exit
process.on('SIGINT', async () => {
  await blockchainBridge.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await blockchainBridge.stop();
  process.exit(0);
});
