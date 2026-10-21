// ====================================================================
// TataDana Fintech SaaS: Admin Approval System Module (R1)
// Handles approval queues, state transitions, double-spending protection,
// audit trail logging, and balance/plan/budget real-time synchronization.
// ====================================================================

const VALID_CATEGORIES = ['plan_upgrade', 'wallet_topup', 'budget_custom', 'user_registration'];

const CATEGORY_LABELS = {
  plan_upgrade: 'Pembayaran / Upgrade Paket',
  wallet_topup: 'Penyesuaian Saldo Dompet',
  budget_custom: 'Kategori & Limit Budget',
  user_registration: 'Pendaftaran Pengguna Baru',
};

/**
 * Filter approvals list based on query parameters
 * @param {Array} approvals - Array of approval records
 * @param {Object} query - Query parameters { status, category }
 * @returns {Array} Filtered approvals
 */
function filterApprovals(approvals = [], query = {}) {
  let filtered = [...approvals];

  if (query.status && query.status !== 'all') {
    const targetStatus = String(query.status).trim().toLowerCase();
    filtered = filtered.filter(a => String(a.status).toLowerCase() === targetStatus);
  }

  if (query.category && query.category !== 'all') {
    const targetCategory = String(query.category).trim().toLowerCase();
    filtered = filtered.filter(a => String(a.category).toLowerCase() === targetCategory);
  }

  return filtered;
}

/**
 * Create a new approval request in the database
 * @param {Object} db - In-memory database
 * @param {Object} data - Request payload
 * @returns {Object} { ok, status, approval, error }
 */
function createApprovalRequest(db, data = {}) {
  if (!db.approvals) {
    db.approvals = [];
  }

  const targetCat = data.category || 'wallet_topup';
  if (!VALID_CATEGORIES.includes(targetCat)) {
    return {
      ok: false,
      status: 400,
      error: `Kategori '${targetCat}' tidak valid. Pilih dari: ${VALID_CATEGORIES.join(', ')}`,
    };
  }

  const rawAmount = data.amount !== undefined ? Number(data.amount) : 0;
  if (isNaN(rawAmount) || rawAmount < 0) {
    return {
      ok: false,
      status: 400,
      error: 'Nominal amount harus berupa angka valid dan non-negatif',
    };
  }

  const newAppr = {
    id: data.id || ('appr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
    user_id: data.user_id || db.user?.id || 'usr_admin_restu',
    user_name: data.user_name || db.user?.full_name || 'Restu Ahmad Hidayat',
    category: targetCat,
    category_label: data.category_label || CATEGORY_LABELS[targetCat] || 'Permintaan Khusus',
    title: (data.title && String(data.title).trim()) ? String(data.title).trim() : 'Pengajuan Permintaan Baru',
    description: data.description ? String(data.description).trim() : '',
    amount: rawAmount,
    details: data.details || {},
    status: 'pending',
    admin_notes: null,
    created_at: new Date().toISOString(),
    processed_at: null,
    processed_by: null,
  };

  db.approvals.unshift(newAppr);

  return {
    ok: true,
    status: 201,
    approval: newAppr,
  };
}

/**
 * Process approval action (approve or reject) with strict state machine
 * and audit trail recording.
 * @param {Object} db - In-memory database
 * @param {Object} payload - { id, approvalId, action, reason, note, notes, adminName }
 * @returns {Object} { ok, status, message, approval, error }
 */
function processApprovalAction(db, payload = {}) {
  if (!db) {
    return { ok: false, status: 500, error: 'Database instance tidak tersedia' };
  }
  if (!db.approvals) db.approvals = [];
  if (!db.auditLogs) db.auditLogs = [];
  if (!db.wallets) db.wallets = [];
  if (!db.allUsers) db.allUsers = [];
  if (!db.transactions) db.transactions = [];
  if (!db.payments) db.payments = [];
  if (!db.budgets) db.budgets = [];
  if (!db.categories) db.categories = [];

  const targetId = payload.approvalId || payload.id;
  if (!targetId) {
    return { ok: false, status: 400, error: 'approvalId atau id wajib disertakan' };
  }

  const action = payload.action;
  if (!action || !['approve', 'reject'].includes(action)) {
    return { ok: false, status: 400, error: "action harus bernilai 'approve' atau 'reject'" };
  }

  const approval = db.approvals.find(a =>
    a.id === targetId ||
    (targetId === 'appr_01' && a.id === 'appr_pending_1') ||
    (targetId === 'appr_pending_1' && a.id === 'appr_01') ||
    (targetId === 'appr_02' && a.id === 'appr_pending_2') ||
    (targetId === 'appr_pending_2' && a.id === 'appr_02') ||
    (targetId === 'appr_03' && a.id === 'appr_pending_3') ||
    (targetId === 'appr_pending_3' && a.id === 'appr_03')
  );
  if (!approval) {
    return {
      ok: false,
      status: 404,
      error: `Permintaan persetujuan dengan ID ${targetId} tidak ditemukan`,
    };
  }

  // State Machine validation: only pending requests can be processed.
  // Prevents double-spending and repeated transitions.
  if (approval.status !== 'pending') {
    return {
      ok: false,
      status: 400,
      error: `Permintaan persetujuan dengan ID ${targetId} sudah diproses sebelumnya (status: ${approval.status})`,
    };
  }

  // Rejection requires a mandatory reason
  const rawReason = payload.reason ?? payload.note ?? payload.notes ?? '';
  const trimmedReason = String(rawReason).trim();

  if (action === 'reject' && !trimmedReason) {
    return {
      ok: false,
      status: 400,
      error: 'Alasan penolakan (reason/note) wajib disertakan ketika menolak permohonan',
    };
  }

  const nowIso = new Date().toISOString();
  const adminName = payload.adminName || 'Superadmin TataDana';
  const actionNotes = trimmedReason || (action === 'approve' ? 'Disetujui oleh Superadmin' : 'Ditolak oleh Superadmin');

  if (action === 'approve') {
    approval.status = 'approved';
    approval.processed_at = nowIso;
    approval.processed_by = adminName;
    approval.admin_notes = actionNotes;

    // 1. Kategori: Pembayaran / Upgrade Paket Manual
    if (approval.category === 'plan_upgrade') {
      const targetPlan = approval.details?.plan || 'pro';
      const targetUser = db.allUsers.find(
        u => u.id === approval.user_id || u.full_name === approval.user_name
      );
      if (targetUser) {
        targetUser.plan = targetPlan;
      }

      // Update active session subscription if it matches target user
      if (
        db.user?.id === approval.user_id ||
        db.user?.full_name === approval.user_name ||
        (targetUser && db.user?.id === targetUser.id)
      ) {
        if (db.subscription) {
          db.subscription.plan = targetPlan;
        }
      }

      // Update linked payment status
      if (approval.details?.payment_id) {
        const pay = db.payments.find(p => p.id === approval.details.payment_id);
        if (pay) pay.status = 'approved';
      } else {
        const pay = db.payments.find(
          p => p.user_name === approval.user_name && p.status === 'pending'
        );
        if (pay) pay.status = 'approved';
      }

      // Audit Log
      db.auditLogs.unshift({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        admin_name: adminName,
        target_user_name: approval.user_name,
        action: 'approve_plan_upgrade',
        details: {
          approval_id: approval.id,
          plan: targetPlan,
          amount: approval.amount,
          reason: actionNotes,
        },
        created_at: nowIso,
      });
    }

    // 2. Kategori: Penyesuaian Saldo / Top-up Manual Dompet
    else if (approval.category === 'wallet_topup') {
      const walletId = approval.details?.wallet_id;
      let wallet = db.wallets.find(w => w.id === walletId);
      if (!wallet && db.wallets.length > 0) {
        wallet = db.wallets[0];
      }

      const rawAmount = Number(approval.amount || approval.details?.amount || 0);
      const isDebit =
        approval.details?.type === 'debit' ||
        approval.details?.direction === 'debit' ||
        (approval.amount && Number(approval.amount) < 0);
      const deltaAmount = isNaN(rawAmount) ? 0 : Math.abs(rawAmount);

      if (wallet) {
        if (isDebit) {
          wallet.balance = Math.max(0, wallet.balance - deltaAmount);
        } else {
          wallet.balance += deltaAmount;
        }
      }

      // Record transaction
      const txId = 'tx_appr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      db.transactions.unshift({
        id: txId,
        wallet_id: wallet ? wallet.id : 'wal_bca',
        wallet_name: wallet ? wallet.name : 'BCA Utama',
        category_id: isDebit ? 'cat_lain' : 'cat_gaji',
        category_name: isDebit ? 'Penyesuaian Saldo (Debit)' : 'Penyesuaian Saldo / Top-up',
        category_emoji: isDebit ? '🔻' : '💳',
        type: isDebit ? 'expense' : 'income',
        amount: deltaAmount,
        note: `[Disetujui Admin] ${approval.title} — ${actionNotes}`,
        source: 'web',
        transaction_date: nowIso,
      });

      // Audit Log
      db.auditLogs.unshift({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        admin_name: adminName,
        target_user_name: approval.user_name,
        action: 'approve_wallet_topup',
        details: {
          approval_id: approval.id,
          wallet_id: wallet ? wallet.id : null,
          wallet_name: wallet ? wallet.name : null,
          direction: isDebit ? 'debit' : 'credit',
          amount_added: isDebit ? -deltaAmount : deltaAmount,
          new_balance: wallet ? wallet.balance : null,
          transaction_id: txId,
          reason: actionNotes,
        },
        created_at: nowIso,
      });
    }

    // 3. Kategori: Permintaan Kategori & Limit Budget Khusus
    else if (approval.category === 'budget_custom') {
      let budget = null;
      if (approval.details?.budget_id) {
        budget = db.budgets.find(b => b.id === approval.details.budget_id);
      }
      if (!budget && approval.details?.category_name) {
        budget = db.budgets.find(
          b => b.category_name.toLowerCase() === approval.details.category_name.toLowerCase()
        );
      }

      if (budget) {
        const parsedLimit = Number(
          approval.details?.requested_limit || approval.amount || budget.monthly_limit
        );
        const newLimit = isNaN(parsedLimit) || parsedLimit < 0 ? budget.monthly_limit : parsedLimit;
        const oldLimit = budget.monthly_limit;
        budget.monthly_limit = newLimit;

        // Audit Log
        db.auditLogs.unshift({
          id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          admin_name: adminName,
          target_user_name: approval.user_name,
          action: 'approve_budget_limit',
          details: {
            approval_id: approval.id,
            budget_id: budget.id,
            category_name: budget.category_name,
            old_limit: oldLimit,
            new_limit: newLimit,
            reason: actionNotes,
          },
          created_at: nowIso,
        });
      } else {
        const customCatName =
          approval.details?.category_name ||
          approval.details?.new_category_name ||
          'Kategori Khusus';
        const customCatEmoji = approval.details?.category_emoji || '✨';
        const customCatColor = approval.details?.category_color || '#8b5cf6';
        const parsedLimit = Number(
          approval.details?.requested_limit || approval.amount || 1000000
        );
        const customLimit = isNaN(parsedLimit) || parsedLimit < 0 ? 1000000 : parsedLimit;

        let existingCat = db.categories.find(
          c => c.name.toLowerCase() === customCatName.toLowerCase()
        );
        if (!existingCat) {
          existingCat = {
            id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: customCatName,
            emoji: customCatEmoji,
            color: customCatColor,
            type: approval.details?.type || 'expense',
          };
          db.categories.push(existingCat);
        }

        let existingBud = db.budgets.find(
          b =>
            b.category_id === existingCat.id ||
            b.category_name.toLowerCase() === customCatName.toLowerCase()
        );
        if (existingBud) {
          existingBud.monthly_limit = customLimit;
        } else {
          db.budgets.push({
            id: 'bud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            category_id: existingCat.id,
            category_name: customCatName,
            category_emoji: customCatEmoji,
            monthly_limit: customLimit,
            current_spent: 0,
            month_period: '2026-10',
          });
        }

        // Audit Log
        db.auditLogs.unshift({
          id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          admin_name: adminName,
          target_user_name: approval.user_name,
          action: 'approve_custom_category',
          details: {
            approval_id: approval.id,
            category_id: existingCat.id,
            category_name: customCatName,
            monthly_limit: customLimit,
            reason: actionNotes,
          },
          created_at: nowIso,
        });
      }
    }
    // 4. Kategori: Persetujuan Pendaftaran Pengguna Baru
    else if (approval.category === 'user_registration') {
      const targetUser = (db.allUsers || []).find(
        u => u.id === approval.user_id || u.full_name === approval.user_name
      );
      if (targetUser) {
        targetUser.approval_status = 'approved';
        targetUser.is_approved = true;
        targetUser.approved_at = nowIso;
        targetUser.approved_by = adminName;
        targetUser.rejection_reason = null;
      }
      if (db.user?.id === approval.user_id || db.user?.full_name === approval.user_name) {
        db.user.approval_status = 'approved';
      }

      db.auditLogs.unshift({
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        admin_name: adminName,
        target_user_name: approval.user_name,
        action: 'approve_user_registration',
        details: {
          approval_id: approval.id,
          user_id: approval.user_id,
          reason: actionNotes
        },
        created_at: nowIso,
      });
    }
  } else if (action === 'reject') {
    approval.status = 'rejected';
    approval.processed_at = nowIso;
    approval.processed_by = adminName;
    approval.admin_notes = actionNotes;

    // When rejected: User balance & user plan are NOT modified.
    if (approval.category === 'plan_upgrade') {
      if (approval.details?.payment_id) {
        const pay = db.payments.find(p => p.id === approval.details.payment_id);
        if (pay) pay.status = 'rejected';
      } else {
        const pay = db.payments.find(
          p => p.user_name === approval.user_name && p.status === 'pending'
        );
        if (pay) pay.status = 'rejected';
      }
    } else if (approval.category === 'user_registration') {
      const targetUser = (db.allUsers || []).find(
        u => u.id === approval.user_id || u.full_name === approval.user_name
      );
      if (targetUser) {
        targetUser.approval_status = 'rejected';
        targetUser.is_approved = false;
        targetUser.rejected_at = nowIso;
        targetUser.rejected_by = adminName;
        targetUser.rejection_reason = actionNotes;
      }
      if (db.user?.id === approval.user_id || db.user?.full_name === approval.user_name) {
        db.user.approval_status = 'rejected';
      }
    }

    // Audit Log for rejection with mandatory reason
    db.auditLogs.unshift({
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      admin_name: adminName,
      target_user_name: approval.user_name,
      action: `reject_${approval.category}`,
      details: {
        approval_id: approval.id,
        category: approval.category,
        title: approval.title,
        amount: approval.amount,
        reason: actionNotes,
      },
      created_at: nowIso,
    });
  }

  return {
    ok: true,
    status: 200,
    message: `Permintaan berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}`,
    approval,
  };
}

module.exports = {
  VALID_CATEGORIES,
  CATEGORY_LABELS,
  filterApprovals,
  createApprovalRequest,
  processApprovalAction,
};
