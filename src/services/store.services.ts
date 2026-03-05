import { Hero } from "../models/Hero.js";
import { Wallet } from "../models/Wallet.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { connectDb } from "../config/db.js";
import { ensureWallet } from "./ledger.service.js";

export interface StoreItemPurchase {
  sku: string;
  name: string;
  description: string;
  icon: string;
  price: number;
}

function assertPositive(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
}

async function ensureHero(heroId: string) {
  let hero = await Hero.findOne({ heroId });
  if (!hero) {
    hero = await Hero.create({ heroId });
  }
  return hero;
}

/**
 * Purchase a store item for a hero
 * Deducts credits from wallet and adds item to inventory
 */
export async function purchaseStoreItem(
  heroId: string,
  item: StoreItemPurchase
): Promise<{ hero: any; wallet: any }> {
  await connectDb();

  // Validate input
  if (!heroId || typeof heroId !== "string") {
    throw new Error("heroId is required and must be a string");
  }
  if (!item.sku || !item.name || typeof item.price !== "number") {
    throw new Error("Invalid item data: sku, name, and price are required");
  }
  assertPositive(item.price);

  // Ensure wallet and hero exist
  const wallet = await ensureWallet(heroId);
  const hero = await ensureHero(heroId);

  // Check if item is already unlocked
  if (hero.unlockedItemSkus?.includes(item.sku)) {
    throw new Error("Item already unlocked");
  }

  // Check if hero has enough credits
  const available = wallet.balance - (wallet.locked || 0);
  if (available < item.price) {
    throw new Error("Insufficient funds");
  }

  // Deduct credits
  wallet.balance -= item.price;
  await wallet.save();

  // Add to inventory
  const inventoryItem = {
    sku: item.sku,
    name: item.name,
    description: item.description || "",
    icon: item.icon || "",
    quantity: 1,
  };

  if (!hero.inventory) {
    hero.inventory = [];
  }
  hero.inventory.push(inventoryItem);

  if (!hero.unlockedItemSkus) {
    hero.unlockedItemSkus = [];
  }
  hero.unlockedItemSkus.push(item.sku);

  await hero.save();

  // Create ledger entry
  await LedgerEntry.create({
    heroId,
    type: "STORE_PURCHASE",
    amount: item.price,
    memo: `Purchased ${item.name}`,
    refId: item.sku,
  });

  return { hero, wallet };
}

/**
 * Purchase an IAP pack (adds credits to wallet)
 * Note: In production, this would integrate with a real payment processor
 */
export async function purchaseIapPack(
  heroId: string,
  pack: { sku: string; price: number; hcAmount: number }
): Promise<{ wallet: any }> {
  await connectDb();

  // Validate input
  if (!heroId || typeof heroId !== "string") {
    throw new Error("heroId is required and must be a string");
  }
  if (!pack.sku || typeof pack.price !== "number" || typeof pack.hcAmount !== "number") {
    throw new Error("Invalid pack data: sku, price, and hcAmount are required");
  }
  assertPositive(pack.hcAmount);

  // Ensure wallet exists
  const wallet = await ensureWallet(heroId);

  // Add credits (in production, verify payment first)
  wallet.balance += pack.hcAmount;
  await wallet.save();

  // Create ledger entry
  await LedgerEntry.create({
    heroId,
    type: "IAP_PURCHASE",
    amount: pack.hcAmount,
    memo: `IAP Pack: ${pack.sku}`,
    refId: pack.sku,
  });

  return { wallet };
}