import { type User, type InsertUser, type EmailLog, type BankAccount, type InsertBankAccount } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const BANK_ACCOUNTS_FILE = path.join(DATA_DIR, "bankAccounts.json");

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Email Logs
  getEmailLogs(): EmailLog[];
  addEmailLog(log: EmailLog): void;

  // Bank Accounts
  getBankAccounts(): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private emailLogs: EmailLog[];

  constructor() {
    this.users = new Map();
    this.emailLogs = [];
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  getEmailLogs(): EmailLog[] {
    return this.emailLogs;
  }

  addEmailLog(log: EmailLog): void {
    this.emailLogs.push(log);
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    if (!fs.existsSync(BANK_ACCOUNTS_FILE)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(BANK_ACCOUNTS_FILE, "utf-8"));
    return (data.bankAccounts || []).map((a: any) => ({
      ...a,
      createdAt: new Date(a.createdAt)
    }));
  }

  async createBankAccount(insertAccount: InsertBankAccount): Promise<BankAccount> {
    const accounts = await this.getBankAccounts();
    const newAccount: BankAccount = {
      accountType: insertAccount.accountType,
      accountName: insertAccount.accountName,
      accountCode: insertAccount.accountCode ?? null,
      currency: insertAccount.currency ?? "INR",
      accountNumber: insertAccount.accountNumber ?? null,
      bankName: insertAccount.bankName ?? null,
      ifsc: insertAccount.ifsc ?? null,
      description: insertAccount.description ?? null,
      isPrimary: insertAccount.isPrimary ?? false,
      id: randomUUID(),
      createdAt: new Date(),
    };
    
    if (newAccount.isPrimary) {
      accounts.forEach(a => a.isPrimary = false);
    }
    
    accounts.push(newAccount);
    fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify({ bankAccounts: accounts }, null, 2));
    return newAccount;
  }
}

export const storage = new MemStorage();
