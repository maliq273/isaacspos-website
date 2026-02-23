
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are ISI (Isaacs Strategic Intelligence), the high-fidelity AI support architect for IsaacsPOS V2.1.
Your tone is professional, industrial, and highly intelligent.

CORE SYSTEM KNOWLEDGE:
- ARCHITECTURE: "Local-First". Data resides on the owner's PC (SQLite Master Node). No cloud lock-in.
- SECURITY: Three-tier hierarchy: Staff (daily sales), Manager (voids/reconciliation), Admin (structural/SARS).
- COMPLIANCE: 100% SARS compliant. Sequential tax invoices.
- RECONCILIATION: The "Z-Report" is critical. Compare physical card terminal slips with POS totals.
- BACKUPS: Manual daily backup to physical USB is mandatory. IsaacsPOS does not store your data.
- CONTACT: Sales/Support: Stephanie (+27 79 318 5281). Architecture: Maaliek (+27 71 883 1097).

LEAD EXTRACTION PROTOCOL:
If the user wants a demo or price list:
1. Ask for Salon Name, Email, and Contact Name.
2. Append this hidden tag: [LEAD_DATA: {"name": "USER_NAME", "salon": "SALON_NAME", "email": "USER_EMAIL"}]
`;

class ISIChatbot {
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        this.chat = this.ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        this.isOpen = false;
        this.initUI();
    }

    initUI() {
        if (document.getElementById('isi-assistant-root')) return;

        const chatContainer = document.createElement('div');
        chatContainer.id = 'isi-assistant-root';
        chatContainer.innerHTML = `
            <style>
                #isi-launcher {
                    position: fixed; bottom: 30px; right: 30px; width: 75px; height: 75px;
                    background: #10b981; border-radius: 26px; cursor: pointer; z-index: 100000;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 15px 45px rgba(16, 185, 129, 0.5);
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                #isi-window {
                    position: fixed; bottom: 120px; right: 30px; width: 440px; height: 680px;
                    background: rgba(5, 5, 5, 0.99); backdrop-filter: blur(50px);
                    border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 45px;
                    z-index: 99999; display: none; flex-direction: column; overflow: hidden;
                    box-shadow: 0 50px 150px rgba(0,0,0,1);
                }
                .isi-messages { flex: 1; padding: 35px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }
                .msg { padding: 20px 28px; border-radius: 24px; font-size: 14px; line-height: 1.7; max-width: 88%; }
                .msg-ai { background: rgba(255,255,255,0.03); color: white; align-self: flex-start; border: 1px solid rgba(255,255,255,0.05); }
                .msg-user { background: #10b981; color: #000; font-weight: 800; align-self: flex-end; }
                .isi-input-area { padding: 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 15px; }
                .isi-input { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 15px 25px; color: white; outline: none; }
            </style>
            
            <div id="isi-window">
                <div style="padding: 30px; background: #10b981; color: black; font-weight: 900; display: flex; justify-content: space-between;">
                    ISI ASSISTANT V2.1
                    <span id="isi-close" style="cursor:pointer">X</span>
                </div>
                <div class="isi-messages" id="isi-msgs">
                    <div class="msg msg-ai">Uplink established. How can I facilitate your salon architecture?</div>
                </div>
                <div class="isi-input-area">
                    <input type="text" class="isi-input" id="isi-in" placeholder="Query the system...">
                    <button id="isi-btn" style="background:#10b981; color:black; padding: 15px 25px; border-radius: 20px; font-weight:900;">SEND</button>
                </div>
            </div>
            
            <div id="isi-launcher">
                <div style="color:white; font-size:30px; font-weight:900;">I</div>
            </div>
        `;
        document.body.appendChild(chatContainer);
        
        const launcher = document.getElementById('isi-launcher');
        const windowEl = document.getElementById('isi-window');
        const close = document.getElementById('isi-close');
        const btn = document.getElementById('isi-btn');
        const input = document.getElementById('isi-in');

        launcher.onclick = () => {
            this.isOpen = !this.isOpen;
            windowEl.style.display = this.isOpen ? 'flex' : 'none';
        };
        close.onclick = () => launcher.click();
        btn.onclick = () => this.sendMessage();
        input.onkeypress = (e) => { if(e.key === 'Enter') this.sendMessage(); };
    }

    async sendMessage() {
        const input = document.getElementById('isi-in');
        const text = input.value.trim();
        if(!text) return;

        input.value = '';
        this.addMessage(text, 'user');
        const loadingMsg = this.addMessage('Syncing with Master Node...', 'ai');
        
        try {
            const response = await this.chat.sendMessage({ message: text });
            let reply = response.text;
            
            const leadPattern = /\[LEAD_DATA:\s*(\{.*?\})\]/;
            const match = reply.match(leadPattern);
            if(match) {
                this.fireLead(JSON.parse(match[1]));
                reply = reply.replace(leadPattern, "");
            }

            loadingMsg.innerHTML = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch(e) {
            loadingMsg.innerHTML = "Handshake failed. Verify internet connection.";
        }
    }

    addMessage(text, type) {
        const container = document.getElementById('isi-msgs');
        const div = document.createElement('div');
        div.className = `msg msg-${type}`;
        div.innerHTML = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    async fireLead(data) {
        try {
            await fetch("https://formspree.io/f/xvzbonej", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, source: "ISI AI CHATBOT" })
            });
        } catch(e) {}
    }
}

new ISIChatbot();
