import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hash: text("hash").notNull().unique(),
  fromAddress: text("from_address"),
  toAddress: text("to_address").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 8 }).default("0.001"),
  isAnonymous: boolean("is_anonymous").default(false),
  blockHeight: integer("block_height"),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  timestamp: timestamp("timestamp").defaultNow(),
});

export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  height: integer("height").notNull().unique(),
  hash: text("hash").notNull().unique(),
  previousHash: text("previous_hash"),
  merkleRoot: text("merkle_root").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  difficulty: integer("difficulty").notNull(),
  nonce: text("nonce").notNull(),
  reward: decimal("reward", { precision: 18, scale: 8 }).notNull(),
  minerAddress: text("miner_address").notNull(),
});

export const miningStats = pgTable("mining_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  blocksMinedCount: integer("blocks_mined_count").default(0),
  totalRewards: decimal("total_rewards", { precision: 18, scale: 8 }).default("0"),
  hashRate: decimal("hash_rate", { precision: 15, scale: 2 }).default("0"),
  lastMiningTime: timestamp("last_mining_time"),
  isActive: boolean("is_active").default(false),
});

export const tradeOrders = pgTable("trade_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  orderType: text("order_type").notNull(), // buy, sell
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  status: text("status").notNull().default("active"), // active, filled, cancelled
  isAnonymous: boolean("is_anonymous").default(true),
  escrowLocked: boolean("escrow_locked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
});

export const p2pNodes = pgTable("p2p_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeId: text("node_id").notNull().unique(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull(),
  publicKey: text("public_key").notNull(),
  lastSeen: timestamp("last_seen").defaultNow(),
  isActive: boolean("is_active").default(true),
  reputation: integer("reputation").default(100),
});

// Insert schemas
export const insertWalletSchema = createInsertSchema(wallets).pick({
  address: true,
  encryptedPrivateKey: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  hash: true,
  fromAddress: true,
  toAddress: true,
  amount: true,
  fee: true,
  isAnonymous: true,
});

export const insertBlockSchema = createInsertSchema(blocks).pick({
  height: true,
  hash: true,
  previousHash: true,
  merkleRoot: true,
  difficulty: true,
  nonce: true,
  reward: true,
  minerAddress: true,
});

export const insertTradeOrderSchema = createInsertSchema(tradeOrders).pick({
  walletAddress: true,
  orderType: true,
  amount: true,
  price: true,
  totalValue: true,
  isAnonymous: true,
});

// Types
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type InsertTradeOrder = z.infer<typeof insertTradeOrderSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type MiningStats = typeof miningStats.$inferSelect;
export type TradeOrder = typeof tradeOrders.$inferSelect;
export type P2PNode = typeof p2pNodes.$inferSelect;
