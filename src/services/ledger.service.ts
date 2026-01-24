import { Wallet } from "../models/Wallet.js";
import { LedgerEntry } from "../models/LedgerEntry.js";

function assertPositive(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number");
}

export async function ensureWallet(heroId: string) {
  let wallet = await Wallet.findOne({ heroId });
  if (!wallet) wallet = await Wallet.create({ heroId, balance: 0, locked: 0 });
  return wallet;
}

export async function getWallet(heroId: string) {
  return ensureWallet(heroId);
}

export async function earn(heroId: string, amount: number, memo = "", refId = "") {
  assertPositive(amount);

  const wallet = await ensureWallet(heroId);
  wallet.balance += amount;
  await wallet.save();

  await LedgerEntry.create({ heroId, type: "EARN", amount, memo, refId });
  return wallet;
}

export async function spend(heroId: string, amount: number, memo = "", refId = "", type = "SPEND") {
  assertPositive(amount);

  const wallet = await ensureWallet(heroId);
  const available = wallet.balance - wallet.locked;
  if (available < amount) throw new Error("Insufficient funds");

  wallet.balance -= amount;
  await wallet.save();

  await LedgerEntry.create({ heroId, type, amount, memo, refId });
  return wallet;
}

export async function transfer(fromHeroId: string, toHeroId: string, amount: number, memo = "", refId = "") {
  assertPositive(amount);
  if (fromHeroId === toHeroId) throw new Error("Cannot transfer to self");

  const fromWallet = await ensureWallet(fromHeroId);
  const available = fromWallet.balance - fromWallet.locked;
  if (available < amount) throw new Error("Insufficient funds");

  fromWallet.balance -= amount;
  await fromWallet.save();

  const toWallet = await ensureWallet(toHeroId);
  toWallet.balance += amount;
  await toWallet.save();

  await LedgerEntry.create({
    heroId: fromHeroId,
    type: "TRANSFER_OUT",
    amount,
    memo,
    refId,
    counterpartyHeroId: toHeroId
  });

  await LedgerEntry.create({
    heroId: toHeroId,
    type: "TRANSFER_IN",
    amount,
    memo,
    refId,
    counterpartyHeroId: fromHeroId
  });

  return { fromWallet, toWallet };
}

export async function getLedger(heroId: string, limit = 50) {
  const capped = Math.min(Math.max(limit, 1), 200);
  return LedgerEntry.find({ heroId }).sort({ createdAt: -1 }).limit(capped).lean();
}
