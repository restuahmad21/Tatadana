// ====================================================================
// TataDana Fintech SaaS: In-App Tata AI Client Widget Module
// File: public/modules/tata-ai.js
// Provides interactive chat drawer, floating launcher, and real-time AI conversation
// ====================================================================

(function () {
  'use strict';

  // Internal Chat State
  const state = {
    isOpen: false,
    history: [],
    isLoading: false,
    pendingTransaction: null,
    defaultSuggestions: [
      '📊 Analisis Pengeluaran',
      '💡 Rekomendasi Hemat',
      '🔮 Simulasi Kopi 35rb/hari',
      '🎯 Cek Peringatan Budget'
    ]
  };

  /**
   * Escape HTML to prevent injection
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Safe HTML formatter for Tata AI assistant replies
   * Preserves intentional tags (<strong>, <em>, <br>, <code>, bullet points, emoji)
   */
  function formatAssistantReply(rawText) {
    if (!rawText) return '';
    // If text already contains HTML tags, return formatted
    return rawText
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/•/g, '&bull;');
  }

  /**
   * Toggle Tata AI Drawer Visibility
   */
  function toggleTataAiDrawer() {
    const drawer = document.getElementById('tata-ai-drawer');
    if (!drawer) return;

    state.isOpen = !state.isOpen;
    if (state.isOpen) {
      drawer.classList.remove('hidden');
      setTimeout(() => {
        const input = document.getElementById('tata-ai-input');
        if (input) input.focus();
        scrollToBottom();
      }, 50);
    } else {
      drawer.classList.add('hidden');
    }
  }

  function openTataAiDrawer() {
    const drawer = document.getElementById('tata-ai-drawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      state.isOpen = true;
      setTimeout(() => {
        const input = document.getElementById('tata-ai-input');
        if (input) input.focus();
        scrollToBottom();
      }, 50);
    }
  }

  function closeTataAiDrawer() {
    const drawer = document.getElementById('tata-ai-drawer');
    if (drawer) {
      drawer.classList.add('hidden');
      state.isOpen = false;
    }
  }

  /**
   * Scroll chat message container to bottom
   */
  function scrollToBottom() {
    const container = document.getElementById('tata-ai-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Show / Hide typing indicator
   */
  function setTyping(isTyping) {
    state.isLoading = isTyping;
    const typingIndicator = document.getElementById('tata-ai-typing');
    const sendBtn = document.getElementById('tata-ai-send-btn');
    if (typingIndicator) {
      if (isTyping) {
        typingIndicator.classList.remove('hidden');
      } else {
        typingIndicator.classList.add('hidden');
      }
    }
    if (sendBtn) {
      sendBtn.disabled = isTyping;
      sendBtn.style.opacity = isTyping ? '0.6' : '1';
    }
    if (isTyping) scrollToBottom();
  }

  /**
   * Update Quick Prompt Chips dynamically
   */
  function updateQuickChips(chips) {
    const container = document.getElementById('tata-ai-quick-chips');
    if (!container) return;

    const chipList = Array.isArray(chips) && chips.length > 0 ? chips : state.defaultSuggestions;
    let html = `<span class="text-zinc-500 font-bold shrink-0 text-[10px] uppercase">Rekomendasi:</span>`;

    chipList.forEach(chipText => {
      html += `
        <button
          type="button"
          onclick="window.sendTataAiQuickPrompt('${escapeHtml(chipText)}')"
          class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-700/60 text-zinc-300 transition-colors shrink-0"
        >
          ${escapeHtml(chipText)}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * Append a message bubble into the conversation
   */
  function appendMessage(sender, text, options = {}) {
    const container = document.getElementById('tata-ai-messages');
    if (!container) return;

    const isUser = sender === 'user';
    const bubble = document.createElement('div');
    bubble.className = `flex items-start gap-2.5 ${isUser ? 'justify-end' : ''}`;

    const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (isUser) {
      bubble.innerHTML = `
        <div class="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl rounded-tr-xs p-3.5 max-w-[85%] shadow-md leading-relaxed">
          <p class="font-medium">${escapeHtml(text)}</p>
          <div class="text-[9px] text-orange-200/80 text-right mt-1 font-mono">${timestamp}</div>
        </div>
        <div class="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
          Saya
        </div>
      `;
    } else {
      let contentHtml = formatAssistantReply(text);

      // Simulation card rendering if present
      if (options.simulation) {
        const sim = options.simulation;
        contentHtml += `
          <div class="mt-3 p-3 rounded-xl bg-zinc-950/70 border border-orange-500/30 text-[11px] space-y-1.5 shadow-inner">
            <div class="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-bold text-orange-400">
              <span>🔮 Ringkasan Simulasi: ${escapeHtml(sim.item || 'Item')}</span>
              <span class="px-2 py-0.5 rounded-full ${sim.is_feasible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} text-[9px] font-bold">
                ${sim.is_feasible ? 'Aman' : 'Perlu Waspada'}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <div>• Biaya / Bulan: <strong>${formatRupiah(sim.monthly_impact || 0)}</strong></div>
              <div>• Biaya / Tahun: <strong>${formatRupiah(sim.annual_impact || 0)}</strong></div>
            </div>
          </div>
        `;
      }

      bubble.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-md">
          ✨
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-xs p-3.5 max-w-[88%] text-zinc-200 leading-relaxed font-sans shadow-md">
          <div class="prose prose-invert max-w-none text-xs">${contentHtml}</div>
          <div class="text-[9px] text-zinc-500 text-left mt-2 flex items-center justify-between border-t border-zinc-850 pt-1.5 font-mono">
            <span>Tata AI • Advisor</span>
            <span>${timestamp} WIB</span>
          </div>
        </div>
      `;
    }

    container.appendChild(bubble);
    scrollToBottom();
  }

  /**
   * Format Rupiah helper on client
   */
  function formatRupiah(num) {
    const n = Math.round(Number(num) || 0);
    return 'Rp' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Reset Conversation
   */
  function resetTataAiChat() {
    state.history = [];
    state.pendingTransaction = null;
    const container = document.getElementById('tata-ai-messages');
    if (!container) return;

    container.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-md">
          ✨
        </div>
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-xs p-4 max-w-[88%] text-zinc-200 leading-relaxed font-sans shadow-md space-y-2">
          <p>Halo! 👋 Saya <strong>Tata AI</strong>, asisten finansial cerdas in-app Anda di TataDana.</p>
          <p class="text-zinc-400 text-[11px]">Saya terhubung langsung dengan catatan transaksi riil dan anggaran dompet Anda. Diskusikan apa saja:</p>
          <div class="grid grid-cols-1 gap-1.5 pt-1">
            <div class="p-2 rounded-lg bg-zinc-800/80 border border-zinc-750 text-[11px] text-zinc-300">
              📊 <strong>Analisis Pengeluaran</strong> — Evaluasi pos boros & cashflow
            </div>
            <div class="p-2 rounded-lg bg-zinc-800/80 border border-zinc-750 text-[11px] text-zinc-300">
              💡 <strong>Rekomendasi Hemat</strong> — Tips cerdas berbasis transaksi riil
            </div>
            <div class="p-2 rounded-lg bg-zinc-800/80 border border-zinc-750 text-[11px] text-zinc-300">
              🔮 <strong>Simulasi Transaksi</strong> — Proyeksi pengeluaran & latte factor
            </div>
          </div>
          <p class="text-[11px] text-orange-400 font-medium pt-1">Pilih prompt di atas atau ketik pertanyaan Anda di bawah! 👇</p>
        </div>
      </div>
    `;
    updateQuickChips(state.defaultSuggestions);
  }

  /**
   * Send message to backend POST /api/ai/chat
   */
  async function sendMessage(text) {
    if (!text || state.isLoading) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    // Append user message
    appendMessage('user', cleanText);
    state.history.push({ role: 'user', content: cleanText });

    // Clear input field
    const input = document.getElementById('tata-ai-input');
    if (input) input.value = '';

    setTyping(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: state.history,
          pending_transaction: state.pendingTransaction
        })
      });

      const data = await response.json();
      setTyping(false);

      if (data && data.ok) {
        state.pendingTransaction = data.pending_transaction !== undefined ? data.pending_transaction : null;
        appendMessage('assistant', data.reply, { simulation: data.simulation });
        state.history.push({ role: 'assistant', content: data.reply });

        if (Array.isArray(data.suggestions)) {
          updateQuickChips(data.suggestions);
        }

        // When transaction is saved, refresh the dashboard views immediately!
        if (data.transaction && typeof window.loadState === 'function') {
          try {
            window.loadState();
          } catch (e) {
            console.warn('Dashboard loadState warning:', e.message);
          }
        }
      } else {
        appendMessage('assistant', '⚠️ Maaf, terjadi kendala saat memproses respons AI: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      setTyping(false);
      appendMessage('assistant', '⚠️ Gagal terhubung ke layanan Tata AI. Pastikan server aktif.');
    }
  }

  /**
   * Handle Form Submission
   */
  function handleTataAiSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('tata-ai-input');
    if (input && input.value) {
      sendMessage(input.value);
    }
  }

  /**
   * Trigger from quick prompt chip
   */
  function sendTataAiQuickPrompt(promptText) {
    sendMessage(promptText);
  }

  // Export functions to global window object
  window.toggleTataAiDrawer = toggleTataAiDrawer;
  window.openTataAiDrawer = openTataAiDrawer;
  window.closeTataAiDrawer = closeTataAiDrawer;
  window.handleTataAiSubmit = handleTataAiSubmit;
  window.sendTataAiQuickPrompt = sendTataAiQuickPrompt;
  window.resetTataAiChat = resetTataAiChat;
  window.tataAiState = state;

  console.log('🤖 Tata AI In-App Widget Module Loaded.');
})();
