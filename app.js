/* ============================================================
   AI Voice Assistant — app.js
   Voice Recognition · Text-to-Speech · Poe API · Particles
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  language: 'ar',          // افتراضي عربي لأن البوت عربي
  ttsEnabled: true,
  isListening: false,
  isThinking: false,
  isSpeaking: false,
  autoListen: true,         // المايك المستمر مفعّل دائماً
  recognition: null,
  synth: window.speechSynthesis,
  currentUtterance: null,
  chatHistory: [],
  animFrame: null,
  particles: [],
  wavePoints: [],
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const dom = {
  orb:               document.getElementById('orb'),
  orbIcon:           document.getElementById('orb-icon'),
  micBtn:            document.getElementById('mic-btn'),
  ttsBtn:            document.getElementById('tts-btn'),
  sendBtn:           document.getElementById('send-btn'),
  textInput:         document.getElementById('text-input'),
  chatHistory:       document.getElementById('chat-history'),
  clearBtn:          document.getElementById('clear-btn'),
  statusPill:        document.getElementById('status-pill'),
  statusText:        document.getElementById('status-text'),
  transcriptDisplay: document.getElementById('transcript-display'),
  langBtns:          document.querySelectorAll('.lang-btn'),
  particleCanvas:    document.getElementById('particle-canvas'),
  waveformCanvas:    document.getElementById('waveform-canvas'),
  toast:             document.getElementById('toast'),
  appRoot:           document.getElementById('app'),
  autoListenBadge:   document.getElementById('auto-listen-badge'),
  badgeText:         document.getElementById('badge-text'),
};

const pCtx = dom.particleCanvas.getContext('2d');
const wCtx = dom.waveformCanvas.getContext('2d');

// ─── Initialise ───────────────────────────────────────────────────────────────
function init() {
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  initParticles();
  initWavePoints();
  requestAnimationFrame(animationLoop);

  setupSpeechRecognition();
  setupEventListeners();
  setStatus('idle');
}

// ─── Canvas resize ────────────────────────────────────────────────────────────
function resizeCanvases() {
  dom.particleCanvas.width  = window.innerWidth;
  dom.particleCanvas.height = window.innerHeight;

  const rect = dom.orb.getBoundingClientRect();
  dom.waveformCanvas.width  = rect.width  || 160;
  dom.waveformCanvas.height = rect.height || 160;
}

// ─── Particles ────────────────────────────────────────────────────────────────
function initParticles() {
  state.particles = [];
  const count = Math.min(80, Math.floor(window.innerWidth / 20));
  for (let i = 0; i < count; i++) {
    state.particles.push(createParticle());
  }
}

function createParticle() {
  return {
    x:     Math.random() * window.innerWidth,
    y:     Math.random() * window.innerHeight,
    vx:    (Math.random() - 0.5) * 0.4,
    vy:    (Math.random() - 0.5) * 0.4,
    size:  Math.random() * 2 + 0.5,
    alpha: Math.random() * 0.5 + 0.1,
    color: Math.random() > 0.5 ? '0,212,255' : '123,47,255',
  };
}

function drawParticles() {
  pCtx.clearRect(0, 0, dom.particleCanvas.width, dom.particleCanvas.height);

  state.particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) p.x = dom.particleCanvas.width;
    if (p.x > dom.particleCanvas.width)  p.x = 0;
    if (p.y < 0) p.y = dom.particleCanvas.height;
    if (p.y > dom.particleCanvas.height) p.y = 0;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(${p.color},${p.alpha})`;
    pCtx.fill();
  });

  // Draw connecting lines between nearby particles
  for (let i = 0; i < state.particles.length; i++) {
    for (let j = i + 1; j < state.particles.length; j++) {
      const a = state.particles[i];
      const b = state.particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        pCtx.beginPath();
        pCtx.moveTo(a.x, a.y);
        pCtx.lineTo(b.x, b.y);
        pCtx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - dist / 100)})`;
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
      }
    }
  }
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function initWavePoints() {
  state.wavePoints = [];
  const count = 64;
  for (let i = 0; i < count; i++) {
    state.wavePoints.push({
      angle:     (i / count) * Math.PI * 2,
      amplitude: 0,
      target:    0,
      phase:     Math.random() * Math.PI * 2,
      speed:     0.02 + Math.random() * 0.03,
    });
  }
}

function drawWaveform() {
  const canvas = dom.waveformCanvas;
  const ctx    = wCtx;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) / 2 - 4;

  ctx.clearRect(0, 0, W, H);

  const isActive = state.isListening || state.isSpeaking || state.isThinking;
  const intensity = isActive ? 1 : 0.15;

  // Update wave points
  state.wavePoints.forEach((pt) => {
    pt.phase += pt.speed * (isActive ? 2 : 0.5);
    const noise = Math.sin(pt.phase) * 0.5 + Math.sin(pt.phase * 2.3) * 0.3 + Math.sin(pt.phase * 0.7) * 0.2;
    pt.target = noise * 18 * intensity;
    pt.amplitude += (pt.target - pt.amplitude) * 0.15;
  });

  // Choose color based on state
  let color1, color2;
  if (state.isListening) {
    color1 = '0,255,157'; color2 = '0,212,255';
  } else if (state.isThinking) {
    color1 = '123,47,255'; color2 = '255,45,120';
  } else if (state.isSpeaking) {
    color1 = '0,212,255'; color2 = '123,47,255';
  } else {
    color1 = '0,212,255'; color2 = '123,47,255';
  }

  // Draw outer wave
  ctx.beginPath();
  state.wavePoints.forEach((pt, i) => {
    const r = baseR + pt.amplitude;
    const x = cx + Math.cos(pt.angle) * r;
    const y = cy + Math.sin(pt.angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR + 20);
  grad.addColorStop(0, `rgba(${color1},0.1)`);
  grad.addColorStop(0.7, `rgba(${color1},0.3)`);
  grad.addColorStop(1, `rgba(${color2},0.05)`);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = `rgba(${color1},${isActive ? 0.8 : 0.3})`;
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.shadowColor = `rgba(${color1},0.6)`;
  ctx.shadowBlur = isActive ? 12 : 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw inner bars (radial equalizer)
  if (isActive) {
    const barCount = 32;
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const pt = state.wavePoints[i * 2] || state.wavePoints[i];
      const barLen = Math.abs(pt.amplitude) * 1.5 + 2;
      const innerR = baseR * 0.55;
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + barLen);
      const y2 = cy + Math.sin(angle) * (innerR + barLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${color1},0.6)`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = `rgba(${color1},0.8)`;
      ctx.shadowBlur = 6;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}

// ─── Animation loop ───────────────────────────────────────────────────────────
function animationLoop() {
  drawParticles();
  drawWaveform();
  state.animFrame = requestAnimationFrame(animationLoop);
}

// ─── Status management ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  idle:      { text: { en: 'Ready',     ar: 'جاهز'  }, cls: '' },
  listening: { text: { en: 'Listening', ar: 'أستمع' }, cls: 'listening' },
  thinking:  { text: { en: 'Thinking',  ar: 'أفكر'  }, cls: 'thinking' },
  speaking:  { text: { en: 'Speaking',  ar: 'أتحدث' }, cls: 'speaking' },
};

function setStatus(status) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  dom.statusText.textContent = cfg.text[state.language] || cfg.text.en;
  dom.statusPill.className = cfg.cls;
  dom.orb.className = 'orb' + (cfg.cls ? ` ${cfg.cls}` : '');
  dom.micBtn.classList.toggle('active', status === 'listening');
  updateOrbIcon(status);
}

function updateOrbIcon(status) {
  const icons = {
    idle:      `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    listening: `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
    thinking:  `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`,
    speaking:  `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  };
  dom.orbIcon.innerHTML = icons[status] || icons.idle;
}

function updateAutoListenBadge() {
  if (state.autoListen) {
    dom.autoListenBadge.classList.remove('off');
    dom.badgeText.textContent = 'استماع مستمر';
    dom.micBtn.classList.add('active');
  } else {
    dom.autoListenBadge.classList.add('off');
    dom.badgeText.textContent = 'الاستماع متوقف';
    dom.micBtn.classList.remove('active');
  }
}

// ─── Speech Recognition ───────────────────────────────────────────────────────
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    dom.micBtn.title = 'Speech recognition not supported in this browser';
    dom.micBtn.style.opacity = '0.4';
    dom.micBtn.style.cursor = 'not-allowed';
    return;
  }

  const rec = new SpeechRecognition();
  rec.continuous      = false;   // نوقفه يدوياً بعد كل جملة ونعيد تشغيله
  rec.interimResults  = true;
  rec.maxAlternatives = 1;
  rec.lang            = state.language === 'ar' ? 'ar-SA' : 'en-US';

  rec.onstart = () => {
    state.isListening = true;
    setStatus('listening');
    dom.transcriptDisplay.textContent = '';
    dom.transcriptDisplay.classList.add('active');
  };

  rec.onresult = (e) => {
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    dom.transcriptDisplay.textContent = final || interim;
    if (final) {
      stopListening();
      sendMessage(final.trim());
    }
  };

  rec.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    state.isListening = false;
    dom.transcriptDisplay.classList.remove('active');
    // أعد التشغيل تلقائياً إلا في حالة الإيقاف المتعمد
    if (state.autoListen && e.error !== 'aborted') {
      scheduleRestart();
    }
  };

  rec.onend = () => {
    state.isListening = false;
    dom.transcriptDisplay.classList.remove('active');
    // أعد التشغيل تلقائياً بعد انتهاء الجلسة
    if (state.autoListen && !state.isThinking && !state.isSpeaking) {
      scheduleRestart();
    }
  };

  state.recognition = rec;
}

// إعادة تشغيل المايك بعد تأخير قصير لتجنب التعارض
let restartTimer = null;
function scheduleRestart(delay = 300) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (state.autoListen && !state.isListening && !state.isThinking && !state.isSpeaking) {
      startListening();
    }
  }, delay);
}

function startListening() {
  if (!state.recognition) {
    showToast('المتصفح لا يدعم التعرف على الصوت', true);
    return;
  }
  if (state.isListening || state.isThinking || state.isSpeaking) return;

  if (state.synth.speaking) {
    state.synth.cancel();
    state.isSpeaking = false;
  }

  state.recognition.lang = state.language === 'ar' ? 'ar-SA' : 'en-US';
  try {
    state.recognition.start();
  } catch (e) {
    console.warn('Recognition start error:', e.message);
  }
}

function stopListening() {
  state.isListening = false;
  dom.transcriptDisplay.classList.remove('active');
  if (state.recognition) {
    try { state.recognition.stop(); } catch (_) {}
  }
  if (!state.isThinking && !state.isSpeaking) setStatus('idle');
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────────
function speak(text) {
  if (!state.ttsEnabled || !text) return;

  if (state.synth.speaking) state.synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang  = state.language === 'ar' ? 'ar-SA' : 'en-US';
  utterance.rate  = 1.0;
  utterance.pitch = 1.0;

  const voices = state.synth.getVoices();
  const preferred = voices.find((v) =>
    state.language === 'ar'
      ? v.lang.startsWith('ar')
      : v.lang.startsWith('en') && v.name.toLowerCase().includes('google')
  ) || voices.find((v) =>
    state.language === 'ar' ? v.lang.startsWith('ar') : v.lang.startsWith('en')
  );
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => {
    state.isSpeaking = true;
    setStatus('speaking');
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    setStatus('idle');
    dom.transcriptDisplay.textContent = '';
    // أعد تشغيل المايك تلقائياً بعد انتهاء الرد
    if (state.autoListen) {
      scheduleRestart(500);
    }
  };

  utterance.onerror = () => {
    state.isSpeaking = false;
    setStatus('idle');
  };

  state.currentUtterance = utterance;
  state.synth.speak(utterance);
}

// ─── Poe API ──────────────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (!text || state.isThinking) return;

  addMessageToUI('user', text);
  state.chatHistory.push({ role: 'user', content: text });

  dom.textInput.value = '';
  dom.transcriptDisplay.textContent = '';

  state.isThinking = true;
  setStatus('thinking');

  const thinkingId = addThinkingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-10),
        language: state.language,
      }),
    });

    removeThinkingIndicator(thinkingId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.response || '';

    if (!reply) throw new Error('Empty response from API');

    state.chatHistory.push({ role: 'assistant', content: reply });
    addMessageToUI('assistant', reply);

    state.isThinking = false;
    setStatus('idle');

    // Speak the reply — المايك سيعود تلقائياً بعد انتهاء الكلام
    speak(reply);

    // إذا كان TTS مطفياً، أعد المايك مباشرة
    if (!state.ttsEnabled && state.autoListen) {
      scheduleRestart(500);
    }

  } catch (err) {
    removeThinkingIndicator(thinkingId);
    state.isThinking = false;
    setStatus('idle');
    console.error('API error:', err);

    const errMsg = state.language === 'ar'
      ? `عذراً، حدث خطأ: ${err.message}`
      : `Sorry, an error occurred: ${err.message}`;

    addMessageToUI('assistant', errMsg);
    showToast(state.language === 'ar' ? 'فشل الاتصال بالخادم' : 'Failed to connect to server', true);

    // أعد المايك حتى بعد الخطأ
    if (state.autoListen) scheduleRestart(1000);
  }
}

// ─── Chat UI ──────────────────────────────────────────────────────────────────
function addMessageToUI(role, content) {
  const isAr = /[\u0600-\u06FF]/.test(content);
  const dir  = isAr ? 'rtl' : 'ltr';

  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  roleLabel.textContent = role === 'user'
    ? (state.language === 'ar' ? 'أنت' : 'You')
    : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.setAttribute('dir', dir);
  bubble.textContent = content;

  msgEl.appendChild(roleLabel);
  msgEl.appendChild(bubble);
  dom.chatHistory.appendChild(msgEl);
  dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
}

function addThinkingIndicator() {
  const id = 'thinking-' + Date.now();
  const msgEl = document.createElement('div');
  msgEl.className = 'message assistant';
  msgEl.id = id;

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  roleLabel.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;

  msgEl.appendChild(roleLabel);
  msgEl.appendChild(bubble);
  dom.chatHistory.appendChild(msgEl);
  dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;

  return id;
}

function removeThinkingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChat() {
  state.chatHistory = [];
  dom.chatHistory.innerHTML = '';
  if (state.synth.speaking) state.synth.cancel();
  state.isSpeaking = false;
  state.isThinking = false;
  setStatus('idle');
  dom.transcriptDisplay.textContent = '';
}

// ─── Language ─────────────────────────────────────────────────────────────────
function setLanguage(lang) {
  state.language = lang;

  dom.langBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  if (lang === 'ar') {
    dom.textInput.placeholder = 'اكتب رسالتك هنا...';
    dom.textInput.setAttribute('dir', 'rtl');
    dom.appRoot.setAttribute('lang', 'ar');
  } else {
    dom.textInput.placeholder = 'Type your message here...';
    dom.textInput.setAttribute('dir', 'ltr');
    dom.appRoot.setAttribute('lang', 'en');
  }

  if (state.recognition) {
    state.recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  }

  setStatus('idle');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false) {
  dom.toast.textContent = msg;
  dom.toast.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.className = '';
  }, 3000);
}

// ─── Event listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // زر المايك — يوقف/يشغّل الوضع المستمر
  dom.micBtn.addEventListener('click', () => {
    if (state.autoListen) {
      state.autoListen = false;
      clearTimeout(restartTimer);
      stopListening();
      updateAutoListenBadge();
      showToast('تم إيقاف الاستماع التلقائي');
    } else {
      state.autoListen = true;
      updateAutoListenBadge();
      showToast('تم تفعيل الاستماع التلقائي');
      startListening();
    }
  });

  // الكورة — نفس وظيفة زر المايك
  dom.orb.addEventListener('click', () => {
    if (state.autoListen) {
      state.autoListen = false;
      clearTimeout(restartTimer);
      stopListening();
      updateAutoListenBadge();
      showToast('تم إيقاف الاستماع التلقائي');
    } else {
      state.autoListen = true;
      updateAutoListenBadge();
      showToast('تم تفعيل الاستماع التلقائي');
      startListening();
    }
  });

  dom.orb.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dom.orb.click();
    }
  });

  dom.ttsBtn.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    dom.ttsBtn.classList.toggle('active', state.ttsEnabled);
    if (!state.ttsEnabled && state.synth.speaking) {
      state.synth.cancel();
      state.isSpeaking = false;
      setStatus('idle');
    }
    showToast(
      state.ttsEnabled
        ? (state.language === 'ar' ? 'تم تفعيل الصوت' : 'Voice output enabled')
        : (state.language === 'ar' ? 'تم إيقاف الصوت' : 'Voice output disabled')
    );
  });

  dom.sendBtn.addEventListener('click', () => {
    const text = dom.textInput.value.trim();
    if (text) sendMessage(text);
  });

  dom.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = dom.textInput.value.trim();
      if (text) sendMessage(text);
    }
  });

  dom.clearBtn.addEventListener('click', clearChat);

  dom.langBtns.forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  if (state.synth.onvoiceschanged !== undefined) {
    state.synth.onvoiceschanged = () => {};
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  dom.ttsBtn.classList.add('active');

  // ضبط اللغة العربية افتراضياً
  setLanguage('ar');

  // رسالة الترحيب
  setTimeout(() => {
    const welcome = 'أهلاً وسهلاً! أنا مساعدك الافتراضي في الكلية التطبيقية بجامعة القصيم. يسعدني مساعدتك في أي استفسار عن التخصصات أو القبول أو الحياة الجامعية. تفضل بسؤالك!';
    addMessageToUI('assistant', welcome);
    speak(welcome);
  }, 800);

  // تشغيل المايك تلقائياً بعد الترحيب
  setTimeout(() => {
    updateAutoListenBadge();
    if (state.autoListen) startListening();
  }, 1200);
});
