'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Mic, 
  Camera, 
  RotateCcw, 
  CheckCheck, 
  Sparkles,
  Bot,
  AlertCircle
} from 'lucide-react';
import { processTelegramMessage } from '@/lib/telegram-engine';
import { AppState, getInitialState, saveState } from '@/lib/store';

interface TelegramSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStateUpdated?: (newState: AppState) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isHtml?: boolean;
  time: string;
  mediaType?: 'text' | 'voice' | 'photo';
  voiceDuration?: string;
  advisorMessage?: string;
}

export default function TelegramSimulatorModal({
  isOpen,
  onClose,
  onStateUpdated
}: TelegramSimulatorModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg_welcome',
          sender: 'bot',
          text: `Halo Budi! 👋 Selamat datang di <strong>TataDana</strong>.<br><br>Dompet aktif: 👛 <strong>BCA Utama</strong><br><br>Ketik pengeluaranmu (contoh: <em>"beli sate 25rb"</em>), kirim rekaman voice note 🎙️, atau kirim foto struk 📸!`,
          isHtml: true,
          time: '12:00 WIB',
        }
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = (
    textToSend: string, 
    options?: { isVoiceNote?: boolean; voiceTranscript?: string; isPhotoReceipt?: boolean }
  ) => {
    if (!textToSend.trim() && !options?.isVoiceNote && !options?.isPhotoReceipt) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const state = getInitialState();

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend,
      time: timeStr,
      mediaType: options?.isVoiceNote ? 'voice' : (options?.isPhotoReceipt ? 'photo' : 'text'),
      voiceDuration: options?.isVoiceNote ? '0:05' : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // 2. Process via Telegram Engine
    setTimeout(() => {
      const { result, newState } = processTelegramMessage(
        textToSend, 
        state, 
        {
          isVoiceNote: options?.isVoiceNote,
          voiceDurationSec: 5,
          voiceTranscript: options?.voiceTranscript,
          isPhotoReceipt: options?.isPhotoReceipt,
          photoUrl: 'https://images.unsplash.com/photo-1554415707-9e4466b4f4c8?w=300&auto=format&fit=crop&q=80',
        }
      );

      // Save new state
      saveState(newState);
      if (onStateUpdated) onStateUpdated(newState);

      // Add Bot Reply
      const botMsg: ChatMessage = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: result.replyText.replace(/\n/g, '<br>'),
        isHtml: true,
        time: timeStr,
        advisorMessage: result.advisorMessage?.replace(/\n/g, '<br>'),
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleSimulateVoice = () => {
    handleSend('Beli ayam geprek sambal ijo 22rb', {
      isVoiceNote: true,
      voiceTranscript: 'Beli ayam geprek sambal ijo dua puluh dua ribu pakai BCA'
    });
  };

  const handleSimulateReceipt = () => {
    handleSend('Struk Indomaret Point Super', {
      isPhotoReceipt: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col h-[650px] max-h-[90vh] overflow-hidden text-zinc-100">
        
        {/* Telegram Header */}
        <div className="px-5 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-amber-400 flex items-center justify-center font-bold text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">TataDana Official Bot</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-1.5 py-0.2 rounded">BOT</span>
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Online · WIB (Asia/Jakarta)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMessages([])}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Reset Chat"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                  TD
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed font-sans ${
                  msg.sender === 'user'
                    ? 'bg-brand-500 text-white rounded-tr-xs shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-xs'
                }`}
              >
                {/* Voice note indicator */}
                {msg.mediaType === 'voice' && (
                  <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/20">
                    <Mic className="w-3.5 h-3.5" />
                    <span className="font-semibold text-[11px]">Voice Note ({msg.voiceDuration})</span>
                    <span className="text-[10px] opacity-75">▶ ılılıllı</span>
                  </div>
                )}

                {/* Photo receipt indicator */}
                {msg.mediaType === 'photo' && (
                  <div className="mb-2 p-2 bg-black/30 rounded-lg border border-white/10 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-brand-200" />
                    <span className="font-semibold text-[11px]">📸 Foto Struk Belanja (AI OCR)</span>
                  </div>
                )}

                {msg.isHtml ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: msg.text }} 
                    className="font-mono text-[11px] leading-relaxed"
                  />
                ) : (
                  <p>{msg.text}</p>
                )}

                {/* Pro Financial Advisor Alert Bubble */}
                {msg.advisorMessage && (
                  <div className="mt-3 p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-[11px] font-sans">
                    <div className="flex items-center gap-1.5 font-bold text-purple-400 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI Financial Advisor (Pro)</span>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: msg.advisorMessage }} />
                  </div>
                )}

                <div
                  className={`mt-1.5 text-[9px] flex items-center justify-end gap-1 ${
                    msg.sender === 'user' ? 'text-brand-100' : 'text-zinc-500'
                  }`}
                >
                  <span>{msg.time}</span>
                  {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-white" />}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-zinc-500 text-xs pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-[10px] italic">TataDana sedang memproses transaksi via AI...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-850 flex items-center gap-2 overflow-x-auto text-[11px] whitespace-nowrap custom-scrollbar">
          <span className="text-zinc-500 font-semibold">Coba:</span>
          <button
            onClick={() => handleSend('Beli kopi susu 25rb')}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-brand-500/20 hover:text-brand-400 border border-zinc-700/50"
          >
            ☕ Kopi susu 25rb
          </button>
          <button
            onClick={() => handleSend('Gaji bulanan 8jt')}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-700/50"
          >
            💰 Gaji bulanan 8jt
          </button>
          <button
            onClick={() => handleSend('/saldo')}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/50"
          >
            💳 /saldo
          </button>
          <button
            onClick={() => handleSend('/budget')}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/50"
          >
            📊 /budget
          </button>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputText);
          }}
          className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleSimulateVoice}
            title="Simulasi Kirim Voice Note 🎙️"
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-brand-400 transition-colors"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSimulateReceipt}
            title="Simulasi Kirim Foto Struk 📸 (Pro OCR)"
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-brand-400 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ketik 'beli bensin 50k'..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
