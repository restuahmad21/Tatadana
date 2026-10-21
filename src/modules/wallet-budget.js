// ====================================================================
// TataDana Fintech SaaS - Wallet & Multi-Period Budget Module (M2 / R2)
// Handles wallet creation, multi-period budget tracking (daily, weekly, monthly),
// and Starter plan wallet limit enforcement.
// ====================================================================

/**
 * Calculates multi-period budget utilization (daily, weekly, monthly)
 * based on wallet budget_limit and transaction history.
 *
 * Formulas:
 * - Daily limit   : Math.round(budget_limit / 30)
 * - Weekly limit  : Math.round(budget_limit / 4)
 * - Monthly limit : budget_limit
 * - Utilization % : (spent / limit) * 100%
 *
 * @param {Object} wallet - Wallet object with id, balance, budget_limit
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Multi-period budget stats
 */
function calculateWalletBudgetStats(wallet, transactions = []) {
  const budgetLimit = Math.max(0, Number(wallet.budget_limit) || 0);

  const dailyLimit = budgetLimit > 0 ? Math.round(budgetLimit / 30) : 0;
  const weeklyLimit = budgetLimit > 0 ? Math.round(budgetLimit / 4) : 0;
  const monthlyLimit = budgetLimit;

  // Filter expense transactions for this specific wallet
  const walletExpenses = (transactions || []).filter(
    t => t.wallet_id === wallet.id && t.type === 'expense'
  );

  // Find reference time: latest transaction timestamp or current time
  let refTime = Date.now();
  if (transactions && transactions.length > 0) {
    const validTimestamps = transactions
      .map(t => new Date(t.transaction_date).getTime())
      .filter(ts => !isNaN(ts));
    if (validTimestamps.length > 0) {
      refTime = Math.max(...validTimestamps);
    }
  }
  const refDate = new Date(refTime);

  let dailySpent = 0;
  let weeklySpent = 0;
  let monthlySpent = 0;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

  walletExpenses.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const txTime = new Date(tx.transaction_date).getTime();
    const txDate = new Date(tx.transaction_date);

    if (isNaN(txTime)) return;

    // Monthly: Same year and month as reference date, or within last 30 days
    const isSameMonth = txDate.getFullYear() === refDate.getFullYear() &&
                        txDate.getMonth() === refDate.getMonth();
    if (isSameMonth || (refTime - txTime <= 30 * ONE_DAY_MS && refTime >= txTime)) {
      monthlySpent += amount;
    }

    // Weekly: within 7 days of reference date
    if (refTime - txTime <= SEVEN_DAYS_MS && refTime >= txTime) {
      weeklySpent += amount;
    }

    // Daily: same calendar day as reference date
    const isSameDay = txDate.getFullYear() === refDate.getFullYear() &&
                      txDate.getMonth() === refDate.getMonth() &&
                      txDate.getDate() === refDate.getDate();
    if (isSameDay) {
      dailySpent += amount;
    }
  });

  const dailyPct = dailyLimit > 0 ? Number(((dailySpent / dailyLimit) * 100).toFixed(1)) : 0;
  const weeklyPct = weeklyLimit > 0 ? Number(((weeklySpent / weeklyLimit) * 100).toFixed(1)) : 0;
  const monthlyPct = monthlyLimit > 0 ? Number(((monthlySpent / monthlyLimit) * 100).toFixed(1)) : 0;

  return {
    daily: {
      limit: dailyLimit,
      spent: dailySpent,
      remaining: Math.max(0, dailyLimit - dailySpent),
      percentage: dailyPct,
      utilization: dailyPct
    },
    weekly: {
      limit: weeklyLimit,
      spent: weeklySpent,
      remaining: Math.max(0, weeklyLimit - weeklySpent),
      percentage: weeklyPct,
      utilization: weeklyPct
    },
    monthly: {
      limit: monthlyLimit,
      spent: monthlySpent,
      remaining: Math.max(0, monthlyLimit - monthlySpent),
      percentage: monthlyPct,
      utilization: monthlyPct
    }
  };
}

/**
 * Enriches a wallet object with budget_stats and multi-period data.
 */
function enrichWallet(wallet, transactions = []) {
  const budgetStats = calculateWalletBudgetStats(wallet, transactions);
  return {
    ...wallet,
    budget_limit: Number(wallet.budget_limit) || 0,
    budget_stats: budgetStats,
    budget_periods: budgetStats
  };
}

/**
 * Handles wallet creation with plan limit enforcement and multi-period budget tracking.
 *
 * @param {Object} db - In-memory DB state
 * @param {Object} payload - { name, type, balance, budget_limit }
 * @returns {Object} { status, wallet, budget_stats, error }
 */
function handleCreateWallet(db, payload = {}) {
  const userId = payload.user_id || payload.userId || (db.user && db.user.id) || 'usr_admin_restu';
  const userWallets = (db.wallets || []).filter(w => w.user_id === userId);

  // Plan limit: Starter max 3 wallets per user (Part 6 / R2 AC 3)
  if (db.subscription && db.subscription.plan === 'starter' && userWallets.length >= 3) {
    return {
      status: 403,
      ok: false,
      error: 'Batas maksimal 3 dompet untuk paket Starter tercapai. Upgrade ke Pro untuk dompet unlimited!'
    };
  }

  const name = (payload.name || '').trim() || 'Dompet Baru';
  const type = payload.type || 'bank';
  const balance = Number(payload.balance) || 0;
  const budgetLimit = Math.max(0, Number(payload.budget_limit) || 0);

  // Extract specific bank or e-wallet name (BRI, BCA, Mandiri, BNI, BSI / DANA, GoPay, ShopeePay, OVO)
  let institutionName = (payload.institution_name || payload.bank_name || payload.bankName || payload.ewallet_name || payload.ewalletName || payload.provider_name || payload.sub_type || '').trim();
  if (!institutionName) {
    if (type === 'bank') {
      const knownBanks = ['BRI', 'BCA', 'Mandiri', 'BNI', 'BSI'];
      const matched = knownBanks.find(b => name.toUpperCase().includes(b));
      if (matched) institutionName = matched;
    } else if (type === 'ewallet') {
      const knownEwallets = ['DANA', 'GoPay', 'ShopeePay', 'OVO'];
      const matched = knownEwallets.find(w => name.toUpperCase().includes(w.toUpperCase()));
      if (matched) institutionName = matched;
    }
  }

  const newWallet = {
    id: 'wal_' + Date.now(),
    user_id: userId,
    name,
    type,
    institution_name: institutionName || undefined,
    bank_name: type === 'bank' ? (institutionName || undefined) : undefined,
    provider_name: institutionName || undefined,
    sub_type: institutionName || undefined,
    balance,
    initial_balance: balance,
    budget_limit: budgetLimit,
    is_default: userWallets.length === 0,
    is_active: true,
    created_at: new Date().toISOString()
  };

  const userTxs = (db.transactions || []).filter(t => t.user_id === userId);
  const budgetStats = calculateWalletBudgetStats(newWallet, userTxs);
  newWallet.budget_stats = budgetStats;
  newWallet.budget_periods = budgetStats;

  db.wallets.push(newWallet);

  return {
    status: 200,
    ok: true,
    wallet: newWallet,
    budget_stats: budgetStats,
    budget_periods: budgetStats
  };
}

/**
 * Returns all wallets enriched with budget stats.
 * Optionally filtered by userId.
 */
function getWalletsWithBudgets(db, userId) {
  const targetUserId = userId || (db && db.user && db.user.id);
  const wallets = targetUserId ? (db.wallets || []).filter(w => w.user_id === targetUserId) : (db.wallets || []);
  const txs = targetUserId ? (db.transactions || []).filter(t => t.user_id === targetUserId) : (db.transactions || []);
  return wallets.map(w => enrichWallet(w, txs));
}

module.exports = {
  calculateWalletBudgetStats,
  enrichWallet,
  handleCreateWallet,
  getWalletsWithBudgets
};
