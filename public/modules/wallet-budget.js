// ====================================================================
// TataDana Fintech SaaS - Frontend Wallet & Multi-Period Budget Module (M2 / R2)
// Provides:
// 1. #add-wallet-modal form with real-time multi-period calculation preview
// 2. Multi-period budget utilization rendering (daily: limit/30, weekly: limit/4, monthly: limit)
// 3. Starter plan 3-wallet limit check with upgrade modal & prompt
// ====================================================================

/**
 * Calculates client-side multi-period budget statistics for a wallet
 * based on transaction expenses if not already precalculated by backend.
 */
function calculateClientWalletBudget(wallet, transactions) {
  if (wallet.budget_stats && wallet.budget_stats.daily && wallet.budget_stats.weekly && wallet.budget_stats.monthly) {
    return wallet.budget_stats;
  }

  const limit = Math.max(0, Number(wallet.budget_limit) || 0);
  const dailyLimit = limit > 0 ? Math.round(limit / 30) : 0;
  const weeklyLimit = limit > 0 ? Math.round(limit / 4) : 0;
  const monthlyLimit = limit;

  const expenses = (transactions || []).filter(t => t.wallet_id === wallet.id && t.type === 'expense');

  let refTime = Date.now();
  if (transactions && transactions.length > 0) {
    const valid = transactions.map(t => new Date(t.transaction_date).getTime()).filter(t => !isNaN(t));
    if (valid.length > 0) refTime = Math.max(...valid);
  }
  const refDate = new Date(refTime);
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let dailySpent = 0;
  let weeklySpent = 0;
  let monthlySpent = 0;

  expenses.forEach(t => {
    const amt = Number(t.amount) || 0;
    const txTime = new Date(t.transaction_date).getTime();
    const txDate = new Date(t.transaction_date);
    if (isNaN(txTime)) return;

    if (txDate.getFullYear() === refDate.getFullYear() && txDate.getMonth() === refDate.getMonth()) {
      monthlySpent += amt;
    }
    if (refTime - txTime <= 7 * ONE_DAY && refTime >= txTime) {
      weeklySpent += amt;
    }
    if (txDate.getFullYear() === refDate.getFullYear() &&
        txDate.getMonth() === refDate.getMonth() &&
        txDate.getDate() === refDate.getDate()) {
      dailySpent += amt;
    }
  });

  const dailyPct = dailyLimit > 0 ? Number(((dailySpent / dailyLimit) * 100).toFixed(1)) : 0;
  const weeklyPct = weeklyLimit > 0 ? Number(((weeklySpent / weeklyLimit) * 100).toFixed(1)) : 0;
  const monthlyPct = monthlyLimit > 0 ? Number(((monthlySpent / monthlyLimit) * 100).toFixed(1)) : 0;

  return {
    daily: { limit: dailyLimit, spent: dailySpent, remaining: Math.max(0, dailyLimit - dailySpent), percentage: dailyPct },
    weekly: { limit: weeklyLimit, spent: weeklySpent, remaining: Math.max(0, weeklyLimit - weeklySpent), percentage: weeklyPct },
    monthly: { limit: monthlyLimit, spent: monthlySpent, remaining: Math.max(0, monthlyLimit - monthlySpent), percentage: monthlyPct }
  };
}

/**
 * Opens the Add Wallet dialog. Enforces Starter plan max 3 wallets restriction.
 */
function openAddWalletModal() {
  const isStarter = window.appState && window.appState.subscription && window.appState.subscription.plan === 'starter';
  const walletCount = (window.appState && window.appState.wallets ? window.appState.wallets.length : 0);

  if (isStarter && walletCount >= 3) {
    // Show upgrade modal / message for Starter plan limit
    openWalletUpgradeModal();
    return;
  }

  const modal = document.getElementById('add-wallet-modal');
  if (modal) {
    // Reset form inputs
    const form = document.getElementById('add-wallet-form');
    if (form) form.reset();
    const nameInput = document.getElementById('new-wallet-name');
    if (nameInput) nameInput.value = '';
    const typeSelect = document.getElementById('new-wallet-type');
    if (typeSelect) typeSelect.value = 'bank';
    const balanceInput = document.getElementById('new-wallet-balance');
    if (balanceInput) balanceInput.value = '';
    const budgetInput = document.getElementById('new-wallet-budget');
    if (budgetInput) budgetInput.value = '';

    const bankSelect = document.getElementById('new-wallet-bank');
    if (bankSelect) bankSelect.value = 'BCA';
    const ewalletSelect = document.getElementById('new-wallet-ewallet');
    if (ewalletSelect) ewalletSelect.value = 'GoPay';

    handleWalletTypeChange('bank');
    updateMultiPeriodPreview(0);
    modal.classList.remove('hidden');
    if (nameInput) nameInput.focus();
  }
}

/**
 * Toggles conditional fields for Bank / E-Wallet selection
 * @param {string} type - 'bank' | 'ewallet' | 'cash'
 */
function handleWalletTypeChange(type) {
  const bankCont = document.getElementById('wallet-bank-container');
  const ewalletCont = document.getElementById('wallet-ewallet-container');

  if (type === 'bank') {
    if (bankCont) bankCont.classList.remove('hidden');
    if (ewalletCont) ewalletCont.classList.add('hidden');
  } else if (type === 'ewallet') {
    if (bankCont) bankCont.classList.add('hidden');
    if (ewalletCont) ewalletCont.classList.remove('hidden');
  } else {
    // cash or other
    if (bankCont) bankCont.classList.add('hidden');
    if (ewalletCont) ewalletCont.classList.add('hidden');
  }
}

/**
 * Closes the Add Wallet dialog.
 */
function closeAddWalletModal() {
  const modal = document.getElementById('add-wallet-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Opens the Starter plan upgrade notification modal.
 */
function openWalletUpgradeModal() {
  const modal = document.getElementById('wallet-upgrade-modal');
  if (modal) {
    modal.classList.remove('hidden');
  } else if (typeof showToast === 'function') {
    showToast('Batas maksimal 3 dompet untuk paket Starter tercapai. Upgrade ke Pro untuk dompet unlimited!');
  }
}

/**
 * Closes the Starter plan upgrade notification modal.
 */
function closeWalletUpgradeModal() {
  const modal = document.getElementById('wallet-upgrade-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Updates live multi-period budget preview calculation in #add-wallet-modal.
 */
function updateMultiPeriodPreview(budgetLimit) {
  const limit = Math.max(0, Number(budgetLimit) || 0);
  const daily = Math.round(limit / 30);
  const weekly = Math.round(limit / 4);
  const monthly = limit;

  const fmt = (typeof formatRupiah === 'function') ? formatRupiah : (val => 'Rp ' + Number(val).toLocaleString('id-ID'));

  const dailyEl = document.getElementById('preview-daily-limit');
  const weeklyEl = document.getElementById('preview-weekly-limit');
  const monthlyEl = document.getElementById('preview-monthly-limit');

  if (dailyEl) dailyEl.innerText = fmt(daily);
  if (weeklyEl) weeklyEl.innerText = fmt(weekly);
  if (monthlyEl) monthlyEl.innerText = fmt(monthly);
}

/**
 * Handles wallet creation form submission.
 */
async function handleCreateWalletSubmit(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById('new-wallet-name');
  const typeSelect = document.getElementById('new-wallet-type');
  const balanceInput = document.getElementById('new-wallet-balance');
  const budgetInput = document.getElementById('new-wallet-budget');
  const submitBtn = document.getElementById('btn-save-wallet');

  const name = nameInput ? nameInput.value.trim() : '';
  const type = typeSelect ? typeSelect.value : 'bank';
  const balance = balanceInput ? (parseFloat(balanceInput.value) || 0) : 0;
  const budget_limit = budgetInput ? (parseFloat(budgetInput.value) || 0) : 0;

  // Extract conditional specific bank or e-wallet name
  let institution_name = '';
  if (type === 'bank') {
    const bankSelect = document.getElementById('new-wallet-bank');
    institution_name = bankSelect ? bankSelect.value : 'BCA';
  } else if (type === 'ewallet') {
    const ewalletSelect = document.getElementById('new-wallet-ewallet');
    institution_name = ewalletSelect ? ewalletSelect.value : 'GoPay';
  }

  if (!name) {
    if (typeof showToast === 'function') showToast('Harap masukkan nama dompet');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.innerText;
    submitBtn.innerText = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        type,
        balance,
        budget_limit,
        institution_name,
        bank_name: type === 'bank' ? institution_name : undefined,
        provider_name: institution_name,
        sub_type: institution_name
      })
    });

    const data = await res.json();

    if (res.status === 403 || !data.ok) {
      closeAddWalletModal();
      if (res.status === 403 || (data.error && data.error.includes('Starter'))) {
        openWalletUpgradeModal();
      }
      if (typeof showToast === 'function') {
        showToast(data.error || 'Gagal membuat dompet baru');
      }
      return;
    }

    // Success
    closeAddWalletModal();
    const fmt = (typeof formatRupiah === 'function') ? formatRupiah : (val => 'Rp ' + Number(val).toLocaleString('id-ID'));
    const instLabel = institution_name ? ` (${institution_name})` : '';
    if (typeof showToast === 'function') {
      showToast(`Dompet "${data.wallet.name}"${instLabel} berhasil dibuat dengan limit budget ${fmt(budget_limit)}!`);
    }

    if (typeof loadState === 'function') {
      await loadState();
    }
  } catch (err) {
    console.error('Create wallet error:', err);
    if (typeof showToast === 'function') {
      showToast('Terjadi kesalahan jaringan');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = submitBtn.dataset.origText || 'Simpan & Buat Dompet';
    }
  }
}

/**
 * Renders wallet cards in #wallets-container with 3 multi-period progress bars.
 */
function renderWalletCardsWithBudget(wallets) {
  const container = document.getElementById('wallets-container');
  if (!container) return;

  if (!wallets || wallets.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-4">
        <div class="w-16 h-16 mx-auto rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-3xl">
          👛
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-base text-zinc-900 dark:text-white">Belum Ada Dompet</h4>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">Saldo total Rp0. Anda belum memiliki dompet keuangan terdaftar. Buat dompet pertama Anda sekarang.</p>
        </div>
        <div>
          <button onclick="openAddWalletModal()" class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-all inline-flex items-center gap-2">
            <span>➕</span> Tambah Dompet Pertama
          </button>
        </div>
      </div>
    `;
    return;
  }

  const fmt = (typeof formatRupiah === 'function') ? formatRupiah : (val => 'Rp ' + Number(val).toLocaleString('id-ID'));
  const transactions = (window.appState && window.appState.transactions) ? window.appState.transactions : [];

  container.innerHTML = wallets.map(w => {
    const stats = calculateClientWalletBudget(w, transactions);

    // Color helper based on percentage
    const getColorClass = (pct) => {
      if (pct >= 90) return { bar: 'bg-rose-500', text: 'text-rose-500' };
      if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-500' };
      return { bar: 'bg-emerald-500', text: 'text-emerald-500 dark:text-emerald-400' };
    };

    const dailyColor = getColorClass(stats.daily.percentage);
    const weeklyColor = getColorClass(stats.weekly.percentage);
    const monthlyColor = getColorClass(stats.monthly.percentage);

    const typeEmoji = w.type === 'bank' ? '🏦' : (w.type === 'ewallet' ? '📱' : '💵');
    const typeBadge = w.type === 'bank'
      ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20'
      : (w.type === 'ewallet'
        ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20'
        : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20');

    return `
      <div class="p-5 rounded-2xl bg-white dark:bg-zinc-900 border ${w.is_default ? 'border-orange-500 ring-1 ring-orange-500/30' : 'border-zinc-200 dark:border-zinc-800'} space-y-4 shadow-sm hover:shadow-md transition-shadow">
        <!-- Top row: Identity and Default badge -->
        <div class="flex justify-between items-start gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-base">${typeEmoji}</span>
              <span class="font-bold text-sm text-zinc-900 dark:text-white">${w.name}</span>
              <span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${typeBadge}">${w.institution_name || w.bank_name || w.provider_name || w.type}</span>
            </div>
            <div class="text-[11px] text-zinc-400">Saldo Dompet Saat Ini</div>
            <div class="text-xl font-black text-zinc-900 dark:text-white">${fmt(w.balance)}</div>
          </div>
          <div>
            ${w.is_default ? '<span class="text-[10px] bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full font-bold border border-orange-500/30 inline-block">DEFAULT BOT</span>' : `<button onclick="setDefaultWallet('${w.id}')" class="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 hover:border-orange-500 border border-zinc-200 dark:border-zinc-700 font-medium transition-colors">Jadikan Default</button>`}
          </div>
        </div>

        <!-- Multi-period budget tracking container -->
        <div class="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>📊</span> Utilisasi Budget Multi-Periode
            </span>
            <span class="text-[11px] font-semibold text-zinc-400">
              Limit: <strong class="text-orange-500">${fmt(w.budget_limit || 0)}</strong>
            </span>
          </div>

          <!-- 1. Harian (Limit / 30) -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-zinc-500 dark:text-zinc-400">📅 Harian (Limit/30)</span>
              <span class="font-mono font-bold ${dailyColor.text}">${fmt(stats.daily.spent)} / ${fmt(stats.daily.limit)} (${stats.daily.percentage}%)</span>
            </div>
            <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div class="${dailyColor.bar} h-2 rounded-full transition-all duration-300" style="width: ${Math.min(100, stats.daily.percentage)}%"></div>
            </div>
          </div>

          <!-- 2. Mingguan (Limit / 4) -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-zinc-500 dark:text-zinc-400">📆 Mingguan (Limit/4)</span>
              <span class="font-mono font-bold ${weeklyColor.text}">${fmt(stats.weekly.spent)} / ${fmt(stats.weekly.limit)} (${stats.weekly.percentage}%)</span>
            </div>
            <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div class="${weeklyColor.bar} h-2 rounded-full transition-all duration-300" style="width: ${Math.min(100, stats.weekly.percentage)}%"></div>
            </div>
          </div>

          <!-- 3. Bulanan (Total Limit) -->
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-zinc-500 dark:text-zinc-400">🗓️ Bulanan (Total Limit)</span>
              <span class="font-mono font-bold ${monthlyColor.text}">${fmt(stats.monthly.spent)} / ${fmt(stats.monthly.limit)} (${stats.monthly.percentage}%)</span>
            </div>
            <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div class="${monthlyColor.bar} h-2 rounded-full transition-all duration-300" style="width: ${Math.min(100, stats.monthly.percentage)}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Expose functions globally for browser & test environments
window.openAddWalletModal = openAddWalletModal;
window.closeAddWalletModal = closeAddWalletModal;
window.handleWalletTypeChange = handleWalletTypeChange;
window.openWalletUpgradeModal = openWalletUpgradeModal;
window.closeWalletUpgradeModal = closeWalletUpgradeModal;
window.updateMultiPeriodPreview = updateMultiPeriodPreview;
window.handleCreateWalletSubmit = handleCreateWalletSubmit;
window.renderWalletCardsWithBudget = renderWalletCardsWithBudget;
window.calculateClientWalletBudget = calculateClientWalletBudget;
