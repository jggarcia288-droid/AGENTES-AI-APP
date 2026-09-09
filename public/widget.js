(function () {
  "use strict";

  var scriptTag = document.currentScript;
  var agentCode = scriptTag.getAttribute("data-agent");
  var supabaseUrl = "https://vxzqhbhcfpwapayqejim.supabase.co";
  var chatEndpoint = supabaseUrl + "/functions/v1/chat-agent";

  if (!agentCode) {
    console.error("[DeyahoWidget] Falta el atributo data-agent");
    return;
  }

  var sessionId = "sess_" + Math.random().toString(36).slice(2, 11);
  var convState = {
    fase: "enganche",
    servicio_interes: "",
    num_personas: "",
    fecha: "",
    ubicacion: "",
    nombre: "",
    telefono: "",
    metodo_pago: "",
    venta_cerrada: false,
  };

  var isOpen = false;
  var messages = [];

  var styles = `
    .deyaho-fab { position: fixed; bottom: 24px; right: 24px; z-index: 999998; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(99,102,241,.4); display: flex; align-items: center; justify-content: center; transition: transform .3s ease; }
    .deyaho-fab:hover { transform: scale(1.08); }
    .deyaho-fab svg { color: #fff; }
    .deyaho-fab-badge { position: absolute; top: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: system-ui; }
    .deyaho-chat { position: fixed; bottom: 96px; right: 24px; z-index: 999999; width: 380px; max-width: calc(100vw - 48px); height: 560px; max-height: calc(100vh - 130px); background: #0f172a; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.5); display: none; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    .deyaho-chat.open { display: flex; }
    .deyaho-header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
    .deyaho-header-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; }
    .deyaho-header-info { flex: 1; }
    .deyaho-header-info strong { color: #fff; font-size: 14px; display: block; }
    .deyaho-header-info span { color: rgba(255,255,255,.7); font-size: 11px; }
    .deyaho-header-close { background: none; border: none; color: #fff; cursor: pointer; opacity: .7; padding: 4px; }
    .deyaho-header-close:hover { opacity: 1; }
    .deyaho-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #0f172a; }
    .deyaho-msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .deyaho-msg.bot { align-self: flex-start; background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; }
    .deyaho-msg.user { align-self: flex-end; background: #6366f1; color: #fff; border-bottom-right-radius: 4px; }
    .deyaho-typing { align-self: flex-start; display: flex; gap: 4px; padding: 12px 16px; background: #1e293b; border-radius: 14px; border-bottom-left-radius: 4px; }
    .deyaho-typing span { width: 8px; height: 8px; border-radius: 50%; background: #64748b; animation: deyaho-bounce 1.4s infinite; }
    .deyaho-typing span:nth-child(2) { animation-delay: .2s; }
    .deyaho-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes deyaho-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }
    .deyaho-input { display: flex; gap: 8px; padding: 12px; background: #1e293b; border-top: 1px solid #334155; }
    .deyaho-input input { flex: 1; padding: 10px 14px; border-radius: 22px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 13px; outline: none; font-family: inherit; }
    .deyaho-input input:focus { border-color: #6366f1; }
    .deyaho-input button { width: 38px; height: 38px; border-radius: 50%; border: none; background: #6366f1; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .deyaho-input button:hover { background: #5457e5; }
    .deyaho-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 8px; background: #0f172a; }
    .deyaho-quick-btn { padding: 8px 14px; border-radius: 18px; border: 1px solid #475569; background: #1e293b; color: #93c5fd; font-size: 12px; cursor: pointer; font-family: inherit; }
    .deyaho-quick-btn:hover { background: #334155; border-color: #6366f1; }
    .deyaho-scroll { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
    .deyaho-scroll::-webkit-scrollbar { width: 6px; }
    .deyaho-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  `;

  var styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  var fab = document.createElement("button");
  fab.className = "deyaho-fab";
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span class="deyaho-fab-badge">1</span>';
  document.body.appendChild(fab);

  var chat = document.createElement("div");
  chat.className = "deyaho-chat";
  chat.innerHTML = `
    <div class="deyaho-header">
      <div class="deyaho-header-avatar">AI</div>
      <div class="deyaho-header-info"><strong>Asistente de Ventas</strong><span>En línea</span></div>
      <button class="deyaho-header-close" onclick="document.querySelector('.deyaho-chat').classList.remove('open')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="deyaho-messages deyaho-scroll" id="deyaho-messages"></div>
    <div class="deyaho-quick" id="deyaho-quick"></div>
    <div class="deyaho-input">
      <input type="text" id="deyaho-input-field" placeholder="Escribe un mensaje..." />
      <button id="deyaho-send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
  `;
  document.body.appendChild(chat);

  var msgContainer = document.getElementById("deyaho-messages");
  var inputField = document.getElementById("deyaho-input-field");
  var sendBtn = document.getElementById("deyaho-send");
  var quickContainer = document.getElementById("deyaho-quick");

  fab.addEventListener("click", function () {
    chat.classList.toggle("open");
    isOpen = chat.classList.contains("open");
    if (isOpen && messages.length === 0) {
      startConversation();
    }
    fab.querySelector(".deyaho-fab-badge").style.display = "none";
  });

  function addMessage(direction, text) {
    var msg = document.createElement("div");
    msg.className = "deyaho-msg " + direction;
    msg.textContent = text;
    msgContainer.appendChild(msg);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    messages.push({ direction: direction, text: text });
  }

  function showTyping() {
    var typing = document.createElement("div");
    typing.className = "deyaho-typing";
    typing.id = "deyaho-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    msgContainer.appendChild(typing);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById("deyaho-typing");
    if (t) t.remove();
  }

  function showQuickButtons(buttons) {
    quickContainer.innerHTML = "";
    buttons.forEach(function (label) {
      var btn = document.createElement("button");
      btn.className = "deyaho-quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", function () {
        sendMessage(label);
        quickContainer.innerHTML = "";
      });
      quickContainer.appendChild(btn);
    });
  }

  async function startConversation() {
    showTyping();
    try {
      var res = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentCode: agentCode,
          mensaje: "hola",
          sessionId: sessionId,
          convState: convState,
        }),
      });
      var data = await res.json();
      hideTyping();
      if (data.response) {
        addMessage("bot", data.response);
        convState = data.convState || convState;
        if (convState.fase === "seleccion") {
          showQuickButtons(["Xcaret $2,900", "Xel-Há $2,700", "Xplor $3,200"]);
        }
      }
    } catch (e) {
      hideTyping();
      addMessage("bot", "¡Hola! 👋 ¿En qué te puedo ayudar hoy?");
    }
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    addMessage("user", text);
    inputField.value = "";
    showTyping();

    try {
      var res = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentCode: agentCode,
          mensaje: text,
          sessionId: sessionId,
          convState: convState,
        }),
      });
      var data = await res.json();
      hideTyping();
      if (data.response) {
        addMessage("bot", data.response);
        convState = data.convState || convState;

        if (convState.fase === "decision") {
          showQuickButtons(["SÍ, APARTAR MI LUGAR", "HABLAR CON ASESOR"]);
        } else if (convState.fase === "datos_pago" || convState.fase === "esperando_pago") {
          showQuickButtons(["Transferencia", "Link de pago"]);
        } else if (convState.fase === "congelar") {
          showQuickButtons(["Sí, congélalo", "Quiero apartar ya"]);
        }
      }
    } catch (e) {
      hideTyping();
      addMessage("bot", "Disculpa, tuve un problema técnico. ¿Me repites? 😊");
    }
  }

  sendBtn.addEventListener("click", function () {
    sendMessage(inputField.value);
  });

  inputField.addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage(inputField.value);
  });
})();
