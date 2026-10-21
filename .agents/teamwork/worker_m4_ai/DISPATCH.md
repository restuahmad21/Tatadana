## 2026-10-12T07:02:15Z
You are Specialist Worker 4 for TataDana Fintech SaaS, assigned to Milestone 4: Modul Integrasi In-App 'Tata AI Bot' (R4).
Your working directory is: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\worker_m4_ai
The project root is: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana
PROJECT.md path: C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\orchestrator\PROJECT.md
MANDATORY: You MUST read C:\Users\ASUS Vivobook\.gemini\antigravity\scratch\tatadana\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Acceptance Criteria for R4:
- Panel/widget chat 'Tata AI' tersedia di dashboard web dengan respons instan berbahasa Indonesia.
- Mampu memberikan saran penghematan cerdas berdasarkan riwayat transaksi aktual pengguna.
- Tersedia quick prompt chips untuk analisis pengeluaran, rekomendasi hemat, dan simulasi pencatatan transaksi cerdas.
Files owned exclusively:
- public/modules/tata-ai.js (and integrate floating button #tata-ai-floating-btn / drawer #tata-ai-drawer in public/index.html).
- Backend route POST /api/ai/chat in server.js delivering contextual Indonesian financial advice and simulation.
Tasks:
1. Implement the in-app chat widget UI in public/index.html (floating button with Tata AI branding, interactive chat drawer/modal, input box, send button, and quick suggestion chips).
2. Implement backend endpoint POST /api/ai/chat in server.js that analyzes actual user transactions (db.transactions) to generate smart savings insights and transaction simulations in natural Indonesian.
3. Ensure chat interaction is instant, responsive, and reflects real user finances.
4. Run tests (node test_suite.js, node test_navigation.js) and add automated test assertions for POST /api/ai/chat and UI elements.
5. Write full report to handoff.md. Send a message when finished.
