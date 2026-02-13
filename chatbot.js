import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are ISI (Isaacs Strategic Intelligence), the high-fidelity AI support architect for IsaacsPOS V2.1.
Your tone is professional, industrial, and highly intelligent.

CORE SYSTEM KNOWLEDGE:
- ARCHITECTURE: "Local-First". Data resides on the owner's PC (SQLite Master Node). No cloud lock-in.
- SECURITY: Three-tier hierarchy: Staff (daily sales), Manager (voids/reconciliation), Admin (structural/SARS).
- COMPLIANCE: 100% SARS compliant. Sequential tax invoices. Hard-coded R95,750 tax threshold logic.
- RECONCILIATION: The "Z-Report" is critical. Compare physical card terminal slips with POS totals.
- BACKUPS: Manual daily backup to physical USB is mandatory. IsaacsPOS does not store your data.
- TROUBLESHOOTING: "Invalid Token" usually means internet loss. "Card Approved/POS Failed" -> Record as manual Cash and note terminal slip #.
- CONTACT: Sales/Support: Stephanie (+27 79 318 5281). Architecture: Maaliek (+27 71 883 1097).
- EMAIL: info@isaacsandpartners.online.

GOAL: Provide technical help or capture leads for new installations.

LEAD EXTRACTION PROTOCOL:
If the user wants a demo, price list, or setup:
1. Proactively ask for their Salon Name, Professional Email, and Contact Name.
2. Once they provide it, acknowledge professionally.
3. YOU MUST append this hidden tag at the very end of your final confirmation message: 
   [LEAD_DATA: {"name": "USER_NAME", "salon": "SALON_NAME", "email": "USER_EMAIL"}]
`;

class ISIChatbot {
    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
                    position: fixed; bottom: 30px; right: 30px; width: 70px; height: 70px;
                    background: #10b981; border-radius: 24px; cursor: pointer; z-index: 100000;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4);
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                #isi-launcher:hover { transform: scale(1.1) rotate(5deg); background: #059669; }
                
                #isi-bubble {
                    position: fixed; bottom: 110px; right: 30px; background: #fff; color: #000;
                    padding: 15px 25px; border-radius: 25px 25px 0 25px; font-weight: 800;
                    font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
                    z-index: 100000; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                    opacity: 0; transform: translateY(20px); transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    pointer-events: none; border: 1px solid rgba(0,0,0,0.05);
                }
                #isi-bubble.show { opacity: 1; transform: translateY(0); }

                #isi-launcher .status-dot {
                    position: absolute; top: 15px; right: 15px; width: 12px; height: 12px;
                    background: #fff; border-radius: 50%; border: 2px solid #10b981;
                    animation: isi-pulse 2s infinite;
                }
                @keyframes isi-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                
                #isi-window {
                    position: fixed; bottom: 120px; right: 30px; width: 420px; height: 650px;
                    background: rgba(5, 5, 5, 0.98); backdrop-filter: blur(50px);
                    border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 40px;
                    z-index: 99999; display: none; flex-direction: column; overflow: hidden;
                    box-shadow: 0 40px 120px rgba(0,0,0,1);
                }
                .isi-header {
                    padding: 30px; background: linear-gradient(135deg, #10b981, #064e3b);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .isi-messages {
                    flex: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
                    scrollbar-width: thin; scrollbar-color: #10b981 transparent;
                }
                .msg { padding: 18px 24px; border-radius: 22px; font-size: 14px; line-height: 1.6; max-width: 85%; }
                .msg-ai { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.05); align-self: flex-start; }
                .msg-user { background: #10b981; color: #000; font-weight: 700; align-self: flex-end; }
                
                .isi-input-area { padding: 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; background: rgba(0,0,0,0.2); }
                .isi-input {
                    flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px; padding: 18px 24px; color: white; outline: none; font-size: 14px;
                }
                .isi-input:focus { border-color: #10b981; }
                .isi-send {
                    width: 55px; height: 55px; background: #10b981; border-radius: 18px;
                    display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;
                    transition: all 0.3s ease;
                }
                .isi-send:hover { background: #059669; transform: scale(1.05); }
            </style>
            
            <div id="isi-bubble">Uplink established. Need help?</div>

            <div id="isi-window">
                <div class="isi-header">
                    <div>
                        <div style="font-size: 10px; font-weight: 900; letter-spacing: 0.3em; color: rgba(255,255,255,0.7); text-transform: uppercase;">System AI Uplink</div>
                        <div style="font-size: 18px; font-weight: 900; color: white; text-transform: uppercase; letter-spacing: -0.02em;">ISI Assistant V2.1</div>
                    </div>
                    <div id="isi-close" style="cursor: pointer; opacity: 0.5; padding: 10px;"><i data-lucide="x"></i></div>
                </div>
                <div class="isi-messages" id="isi-msgs">
                    <div class="msg msg-ai">Uplink established. System status: **OPTIMAL**. I am **ISI**, the high-fidelity AI architect for IsaacsPOS. How can I facilitate your salon's digital architecture today?</div>
                </div>
                <div class="isi-input-area">
                    <input type="text" class="isi-input" id="isi-in" placeholder="Type technical command...">
                    <button class="isi-send" id="isi-btn"><i data-lucide="send" style="color: black;"></i></button>
                </div>
            </div>
            
            <div id="isi-launcher">
                <i data-lucide="brain-circuit" style="color: white; width: 34px; height: 34px;"></i>
                <div class="status-dot"></div>
            </div>
        `;
        document.body.appendChild(chatContainer);
        
        const launcher = document.getElementById('isi-launcher');
        const bubble = document.getElementById('isi-bubble');
        const windowEl = document.getElementById('isi-window');
        const close = document.getElementById('isi-close');
        const input = document.getElementById('isi-in');
        const btn = document.getElementById('isi-btn');

        launcher.onclick = () => {
            this.isOpen = !this.isOpen;
            windowEl.style.display = this.isOpen ? 'flex' : 'none';
            bubble.classList.remove('show');
        };
        close.onclick = () => launcher.click();
        btn.onclick = () => this.sendMessage();
        input.onkeypress = (e) => { if(e.key === 'Enter') this.sendMessage(); };

        if (window.lucide) lucide.createIcons();

        // Proactive engagement bubble after 4 seconds
        setTimeout(() => {
            if(!this.isOpen) bubble.classList.add('show');
        }, 4000);
    }

    async sendMessage() {
        const input = document.getElementById('isi-in');
        const text = input.value.trim();
        if(!text) return;

        input.value = '';
        this.addMessage(text, 'user');
        
        const loadingMsg = this.addMessage('Analysing operational uplink...', 'ai');
        
        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ role: 'user', parts: [{ text }] }],
                config: { systemInstruction: SYSTEM_INSTRUCTION }
            });

            let reply = response.text;
            
            const leadPattern = /\[LEAD_DATA:\s*({.*?})\]/;
            const match = reply.match(leadPattern);
            if(match) {
                try {
                    const leadInfo = JSON.parse(match[1]);
                    this.fireLead(leadInfo);
                    reply = reply.replace(leadPattern, "");
                } catch(e) {}
            }

            loadingMsg.innerHTML = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch(e) {
            loadingMsg.innerHTML = "Uplink failure. Please check your system's network connectivity.";
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
                body: JSON.stringify({
                    subject: `ISI AI LEAD: ${data.salon}`,
                    salon: data.salon,
                    email: data.email,
                    name: data.name,
                    origin: window.location.pathname,
                    message: "Automatic lead generated via ISI Pro Intelligent Assistant."
                })
            });
        } catch(e) {}
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ISIChatbot());
} else {
    new ISIChatbot();
}