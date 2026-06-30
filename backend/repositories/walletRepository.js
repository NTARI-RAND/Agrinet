const pool = require("../lib/db");
const {
  agrinet_wallet_debit_fail_total,
  agrinet_wallet_credit_total
} = require("../lib/metrics");
const { auditFinancialEvent } = require("../utils/financialAudit");

async function findByUserId(userId) {
  const [rows] = await pool.query(
    "SELECT user_id, balance FROM wallets WHERE user_id = ?",
    [userId]
  );

  return rows[0] || null;
}

async function debit(userId, amount, note, refId = null, externalConnection = null) {
  const connection = externalConnection || await pool.getConnection();
  const isExternal = !!externalConnection;

  try {
    if (!isExternal) {
      await connection.beginTransaction();
    }

    const [rows] = await connection.query(
      "SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (!rows.length) {
      throw new Error("Wallet not found");
    }

    const currentBalance = Number(rows[0].balance);

    if (currentBalance < amount) {
      throw new Error("Insufficient balance");
    }

    const [result] = await connection.query(
      `
      UPDATE wallets
      SET balance = balance - ?
      WHERE user_id = ?
      AND balance >= ?
      `,
      [amount, userId, amount]
    );

    if (result.affectedRows === 0) {
      throw new Error("Insufficient balance");
    }

    await connection.query(
      "INSERT INTO wallet_history (user_id, type, amount, note, tx_id) VALUES (?, ?, ?, ?, ?)",
      [userId, "purchase", -amount, note, refId]
    );

    if (!isExternal) {
      await connection.commit();
    }

    return currentBalance - amount;
  } catch (err) {
    agrinet_wallet_debit_fail_total.inc();
    if (!isExternal) {
      await connection.rollback();
    }
    throw err;
  } finally {
    if (!isExternal) {
      connection.release();
    }
  }
}

async function credit(
  userId,
  amount,
  note,
  txId = null,
  paymentId = null,
  type = "sale",
  externalConnection = null
) {
  const connection = externalConnection || await pool.getConnection();
  const isExternal = !!externalConnection;

  try {
    if (!isExternal) await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (!rows.length) {
      throw new Error("Wallet not found");
    }

    const currentBalance = Number(rows[0].balance);
    const newBalance = currentBalance + amount;

    await connection.query(
      "UPDATE wallets SET balance = ? WHERE user_id = ?",
      [newBalance, userId]
    );

    await connection.query(
      `
      INSERT INTO wallet_history
      (user_id, type, amount, note, tx_id, payment_id)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, type, amount, note, txId || null, paymentId || null]
    );

    await auditFinancialEvent({
      eventType: amount >= 0 ? "wallet_credit" : "wallet_debit",
      userId: userId,
      walletUserId: userId,
      transactionId: txId,
      paymentId: paymentId,
      amount: amount,
      metadata: { note, type },
      connection
    });
    agrinet_wallet_credit_total.inc();

    if (!isExternal) await connection.commit();

    return currentBalance - amount;

  } catch (err) {
    if (!isExternal) await connection.rollback();
    throw err;
  } finally {
    if (!isExternal) connection.release();
  }
}

async function refund(userId, amount, note, paymentId, externalConnection = null) {
  const connection = externalConnection || await pool.getConnection();
  const isExternal = !!externalConnection;

  try {
    if (!isExternal) await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );
    if (!rows.length) throw new Error("Wallet not found");

    const currentBalance = Number(rows[0].balance);
    const newBalance = currentBalance - Number(amount);

    await connection.query(
      "UPDATE wallets SET balance = ? WHERE user_id = ?",
      [newBalance, userId]
    );

    // importante: amount NEGATIVO no histórico (igual purchase)
    await connection.query(
      "INSERT INTO wallet_history (user_id, type, amount, note, tx_id, payment_id) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, "refund", -Number(amount), note, null, paymentId]
    );

    if (!isExternal) await connection.commit();
    return currentBalance - amount;

  } catch (err) {
    if (!isExternal) await connection.rollback();
    throw err;
  } finally {
    if (!isExternal) connection.release();
  }
}

module.exports = {
  findByUserId,
  debit,
  credit,
  refund
};
