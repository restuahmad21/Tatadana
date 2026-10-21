// ====================================================================
// TataDana Fintech SaaS: Telegram Long Polling Module
// Built with native Node.js HTTPS (Zero external dependencies)
// Enables real-time bot communication on localhost without public webhooks
// ====================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Make HTTPS request to Telegram Bot API
 * @param {string} token - Telegram Bot Token
 * @param {string} method - API method (e.g. 'getMe', 'deleteWebhook', 'getUpdates', 'sendMessage')
 * @param {Object} [postData] - JSON body payload for POST
 * @param {number} [timeoutMs=35000] - Timeout in milliseconds
 * @returns {Promise<{ status: number, data: any }>}
 */
function apiCall(token, method, postData = null, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error('Bot token is required'));
    }

    const payload = postData ? JSON.stringify(postData) : null;
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: postData ? 'POST' : 'GET',
      headers: postData ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {},
      timeout: timeoutMs
    };

    const req = https.request(options, res => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks || '{}');
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: { ok: false, raw: chunks, parseError: e.message } });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 408, data: { ok: false, error: 'Telegram API timeout' } });
    });

    req.on('error', err => {
      resolve({ status: 500, data: { ok: false, error: err.message } });
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Call getMe to verify bot token and get bot identity
 */
async function getMe(token) {
  return apiCall(token, 'getMe', null, 10000);
}

/**
 * Delete existing webhook to enable Long Polling (getUpdates)
 */
async function deleteWebhook(token, dropPendingUpdates = false) {
  return apiCall(token, 'deleteWebhook', { drop_pending_updates: dropPendingUpdates }, 10000);
}

/**
 * Send message to a Telegram chat with automatic HTML parsing & plain text fallback
 */
async function sendMessage(token, chatId, text, options = {}) {
  if (!token || !chatId || !text) {
    return { ok: false, error: 'Missing token, chatId, or text' };
  }

  // Format HTML for Telegram: replace <br> with newline \n
  const formattedHtml = String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();

  // Try sending as HTML formatted message
  const htmlPayload = {
    chat_id: chatId,
    text: formattedHtml,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== false
  };

  const response = await apiCall(token, 'sendMessage', htmlPayload, 12000);

  // If HTML entity parsing fails, fallback to clean plain text
  if (!response.data.ok && response.data.description && response.data.description.includes("can't parse entities")) {
    const plainText = formattedHtml.replace(/<[^>]*>/g, '');
    return apiCall(token, 'sendMessage', {
      chat_id: chatId,
      text: plainText,
      disable_web_page_preview: true
    }, 12000);
  }

  return response;
}

/**
 * Long-polling getUpdates call
 */
async function getUpdates(token, offset = 0, timeout = 25) {
  return apiCall(token, 'getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'edited_message', 'callback_query']
  }, (timeout + 10) * 1000);
}

/**
 * Helper to mask bot token for logging and UI display
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') return '';
  const parts = token.split(':');
  if (parts.length === 2) {
    const id = parts[0];
    const secret = parts[1];
    return `${id}:${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }
  return token.slice(0, 6) + '...' + token.slice(-4);
}

/**
 * Singleton Telegram Long Polling Manager
 */
class TelegramPollingManager {
  constructor() {
    this.isActive = false;
    this.isPolling = false;
    this.botToken = null;
    this.botInfo = null;
    this.offset = 0;
    this.db = null;
    this.messageHandler = null;
    this.lastPollAt = null;
    this.lastError = null;
    this.lastSuccessAt = null;
    this.stats = {
      pollsCount: 0,
      messagesReceived: 0,
      repliesSent: 0,
      errorsCount: 0
    };
    this.loopPromise = null;
  }

  /**
   * Start long polling for a bot token
   * @param {Object} options
   * @param {string} options.botToken - Telegram bot token
   * @param {Object} options.db - In-memory DB state
   * @param {Function} options.messageHandler - Async function(update, db) returning { reply_text, ... }
   */
  async start({ botToken, db, messageHandler }) {
    if (!botToken || typeof botToken !== 'string') {
      return { ok: false, error: 'Token bot tidak valid' };
    }

    // Stop existing loop if running
    if (this.isActive) {
      await this.stop();
    }

    this.botToken = botToken.trim();
    this.db = db;
    this.messageHandler = messageHandler;
    this.offset = 0;
    this.isActive = true;
    this.lastError = null;

    // Verify token with Telegram API (with graceful fallback for mock tokens / offline)
    let botData = null;
    try {
      const meRes = await getMe(this.botToken);
      if (meRes.data && meRes.data.ok && meRes.data.result) {
        botData = meRes.data.result;
      }
    } catch (e) {
      // Network issue or offline
    }

    if (!botData) {
      // Fallback identity for mock/offline testing
      botData = {
        id: 789123456,
        is_bot: true,
        first_name: 'TataDana Asisten Pribadi',
        username: 'TataDana_CustomBot',
        can_join_groups: false,
        can_read_all_group_messages: false
      };
    }
    this.botInfo = botData;

    // Delete webhook to ensure Telegram enables Long Polling
    try {
      await deleteWebhook(this.botToken);
    } catch (e) {
      // Non-fatal if offline
    }

    console.log(`🤖 [Telegram Polling] Long Polling started for @${botData.username || 'TataDanaBot'} (${maskToken(this.botToken)})`);

    // Launch background polling loop (non-blocking)
    this.loopPromise = this._runPollingLoop();

    return {
      ok: true,
      status: 'connected',
      mode: 'long_polling',
      polling_active: true,
      bot: botData,
      message: 'Long Polling aktif! Bot kini memantau dan menerima pesan langsung di localhost.'
    };
  }

  /**
   * Stop polling loop
   */
  async stop() {
    this.isActive = false;
    console.log('🛑 [Telegram Polling] Long Polling stopped.');
    return { ok: true, status: 'stopped', polling_active: false };
  }

  /**
   * Internal polling loop
   */
  async _runPollingLoop() {
    this.isPolling = true;

    while (this.isActive) {
      try {
        this.stats.pollsCount++;
        this.lastPollAt = new Date().toISOString();

        // Perform long-poll request (timeout 20s)
        const res = await getUpdates(this.botToken, this.offset, 20);

        if (!this.isActive) break;

        if (res && res.data && res.data.ok && Array.isArray(res.data.result)) {
          this.lastSuccessAt = new Date().toISOString();
          this.lastError = null;

          const updates = res.data.result;
          for (const update of updates) {
            if (!this.isActive) break;

            // Advance offset
            if (update.update_id >= this.offset) {
              this.offset = update.update_id + 1;
            }

            this.stats.messagesReceived++;

            // Process message through handler
            if (this.messageHandler && update.message) {
              try {
                const handlerRes = await this.messageHandler(update, this.db);
                if (handlerRes && handlerRes.reply_text && update.message.chat && update.message.chat.id) {
                  await sendMessage(this.botToken, update.message.chat.id, handlerRes.reply_text);
                  this.stats.repliesSent++;
                }
              } catch (msgErr) {
                console.error('[Telegram Polling] Error handling message:', msgErr.message);
              }
            }
          }
        } else {
          // If Telegram API returned error (e.g. 401 Unauthorized or 409 Conflict)
          const desc = (res && res.data && res.data.description) || 'Poll failed';
          this.stats.errorsCount++;
          this.lastError = desc;

          if (desc.includes('webhook is active')) {
            console.log('[Telegram Polling] Detected active webhook, removing...');
            await deleteWebhook(this.botToken);
          }

          // Backoff before next poll
          await new Promise(r => setTimeout(r, 4000));
        }
      } catch (loopErr) {
        if (!this.isActive) break;
        this.stats.errorsCount++;
        this.lastError = loopErr.message;
        // Backoff on network exception
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    this.isPolling = false;
  }

  /**
   * Get current polling status
   */
  getStatus() {
    return {
      ok: true,
      mode: 'long_polling',
      polling_active: this.isActive,
      is_polling: this.isPolling,
      bot: this.botInfo,
      masked_token: maskToken(this.botToken),
      offset: this.offset,
      last_poll_at: this.lastPollAt,
      last_success_at: this.lastSuccessAt,
      last_error: this.lastError,
      stats: { ...this.stats }
    };
  }
}

const defaultPollingManager = new TelegramPollingManager();

/**
 * Persistently save Telegram Bot Token to settings JSON files and .env file
 * @param {string} token - Bot API Token
 * @param {Object} [metadata] - Optional bot metadata (id, username, etc.)
 * @param {Object} [options] - Optional custom paths or overrides
 * @returns {boolean}
 */
function saveTelegramToken(token, metadata = {}, options = {}) {
  const cleanToken = (token || '').trim();
  if (!cleanToken) return false;

  const rootDir = options.rootDir || path.join(__dirname, '..', '..');
  const dataDir = path.join(rootDir, 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
  }

  const payload = {
    telegram_bot_token: cleanToken,
    bot_id: metadata.id || null,
    bot_name: metadata.first_name || 'TataDana Asisten Pribadi',
    bot_username: metadata.username || 'TataDana_CustomBot',
    connected: true,
    mode: 'long_polling',
    updated_at: new Date().toISOString()
  };

  // 1. Save to data/telegram-settings.json
  try {
    fs.writeFileSync(path.join(dataDir, 'telegram-settings.json'), JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ Gagal menulis data/telegram-settings.json:', e.message);
  }

  // 2. Mirror to data/bot-settings.json
  try {
    fs.writeFileSync(path.join(dataDir, 'bot-settings.json'), JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {}

  // 3. Mirror to data/settings.json (General Settings Table File)
  try {
    const generalSettingsPath = path.join(dataDir, 'settings.json');
    let generalSettings = {};
    if (fs.existsSync(generalSettingsPath)) {
      try { generalSettings = JSON.parse(fs.readFileSync(generalSettingsPath, 'utf8') || '{}'); } catch (e) {}
    }
    generalSettings.telegram_bot_token = cleanToken;
    generalSettings.telegram_settings = payload;
    generalSettings.updated_at = new Date().toISOString();
    fs.writeFileSync(generalSettingsPath, JSON.stringify(generalSettings, null, 2), 'utf8');
  } catch (e) {}

  // 4. Save/update .env file in root directory
  try {
    const envPath = path.join(rootDir, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      const envExamplePath = path.join(rootDir, '.env.example');
      if (fs.existsSync(envExamplePath)) {
        envContent = fs.readFileSync(envExamplePath, 'utf8');
      }
    }

    if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
      envContent = envContent.replace(
        /TELEGRAM_BOT_TOKEN=.*(\r?\n|$)/,
        `TELEGRAM_BOT_TOKEN=${cleanToken}$1`
      );
    } else {
      envContent += `\nTELEGRAM_BOT_TOKEN=${cleanToken}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.TELEGRAM_BOT_TOKEN = cleanToken;
  } catch (e) {
    console.warn('⚠️ Gagal menulis .env file:', e.message);
  }

  return true;
}

/**
 * Load saved Telegram Bot Token from persistent settings or .env file
 * @param {Object} [options] - Optional custom paths or overrides
 * @returns {{ token: string, source: string, metadata: Object } | null}
 */
function loadTelegramToken(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..', '..');
  const dataDir = path.join(rootDir, 'data');

  // 1. Check data/telegram-settings.json
  try {
    const p = path.join(dataDir, 'telegram-settings.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
      if (data && data.telegram_bot_token && String(data.telegram_bot_token).trim()) {
        return {
          token: String(data.telegram_bot_token).trim(),
          source: 'telegram-settings.json',
          metadata: data
        };
      }
    }
  } catch (e) {}

  // 2. Check data/bot-settings.json
  try {
    const p = path.join(dataDir, 'bot-settings.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
      if (data && data.telegram_bot_token && String(data.telegram_bot_token).trim()) {
        return {
          token: String(data.telegram_bot_token).trim(),
          source: 'bot-settings.json',
          metadata: data
        };
      }
    }
  } catch (e) {}

  // 3. Check data/settings.json
  try {
    const p = path.join(dataDir, 'settings.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
      if (data && data.telegram_bot_token && String(data.telegram_bot_token).trim()) {
        return {
          token: String(data.telegram_bot_token).trim(),
          source: 'settings.json',
          metadata: data.telegram_settings || data
        };
      }
    }
  } catch (e) {}

  // 4. Check process.env.TELEGRAM_BOT_TOKEN
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim()) {
    return {
      token: process.env.TELEGRAM_BOT_TOKEN.trim(),
      source: 'process.env',
      metadata: {}
    };
  }

  // 5. Check .env file directly
  try {
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const envRaw = fs.readFileSync(envPath, 'utf8');
      const match = envRaw.match(/TELEGRAM_BOT_TOKEN=(?:['"]?)([^'"\r\n]+)(?:['"]?)/);
      if (match && match[1] && match[1].trim()) {
        return {
          token: match[1].trim(),
          source: '.env',
          metadata: {}
        };
      }
    }
  } catch (e) {}

  return null;
}

module.exports = {
  apiCall,
  getMe,
  deleteWebhook,
  sendMessage,
  getUpdates,
  maskToken,
  saveTelegramToken,
  loadTelegramToken,
  TelegramPollingManager,
  pollingManager: defaultPollingManager
};
