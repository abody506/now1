const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── API Configuration ────────────────────────────────────────────────────────
// Poe API key (provided by user)
const POE_API_KEY = 'sk-poe-LRYfgj0kMwK-Tf1nO-rMCQxyYTyLh7ZHxoMyrouY2_o';

// Groq free API — https://console.groq.com
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';

// OpenRouter free API — get your free key at https://openrouter.ai
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Helper: call Poe OpenAI-compatible API ───────────────────────────────────
async function callPoe(messages, model = 'GPT-4o') {
  const r = await fetch('https://api.poe.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Poe ${r.status}`), { status: r.status, body: text });
  const data = JSON.parse(text);
  return data.choices[0].message.content;
}

// ─── Helper: call Groq free API ───────────────────────────────────────────────
async function callGroq(messages, model = 'llama-3.3-70b-versatile') {
  if (!GROQ_API_KEY) throw new Error('No GROQ_API_KEY set');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Groq ${r.status}`), { status: r.status, body: text });
  const data = JSON.parse(text);
  return data.choices[0].message.content;
}

// ─── Helper: call OpenRouter free API ────────────────────────────────────────
async function callOpenRouter(messages, model = 'meta-llama/llama-3.3-70b-instruct:free') {
  if (!OPENROUTER_API_KEY) throw new Error('No OPENROUTER_API_KEY set');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'ARIA AI Voice Assistant',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`OpenRouter ${r.status}`), { status: r.status, body: text });
  const data = JSON.parse(text);
  return data.choices[0].message.content;
}

// ─── System Prompt — الكلية التطبيقية بجامعة القصيم ─────────────────────────
const SYSTEM_PROMPT = `أنت مساعد افتراضي ذكي مصمم خصيصاً لطلاب الكلية التطبيقية بجامعة القصيم.
شخصيتك ودية ومتعاونة وتتحدث باللهجة العربية السعودية بشكل طبيعي.
أجب فقط على الأسئلة المتعلقة بالكلية التطبيقية وتخصصاتها وخدماتها.

المعلومات الأساسية التي تعرفها:

**الموقع:** المقر الرئيسي في المدينة الجامعية لجامعة القصيم في المليداء.

**التخصصات (22 تخصصاً):**
- التقنية: الجرافيكس والوسائط المتعددة، الأمن السيبراني، البرمجة والتطبيقات، تطوير الويب، تصميم واجهات المستخدم UI/UX، الحوسبة السحابية، تصميم وتحليل النظم، أنظمة المؤسسة وإدارة البيانات، الدعم الفني.
- الصحية: مساعد طبيب أسنان، محضّرو المختبرات، فني رعاية مرضى، التعقيم الطبي.
- الإدارية: المحاسبة العامة، التسويق والمبيعات، التسويق الرقمي، سلاسل الإمداد واللوجستيات، خدمة العملاء، إدارة وتنظيم الفعاليات.
- المتنوعة: تقنية الطاقة الشمسية، السلامة والأمن الصناعي، تعليم اللغة العربية للناطقين بغيرها.

**معلومات عامة:**
- الدراسة مجانية وتُصرف مكافأة شهرية للطلاب المنتظمين.
- مدة الدراسة سنتان إلى سنتان ونصف شاملة التدريب الميداني.
- التقديم إلكترونياً عبر بوابة القبول الموحد لجامعة القصيم (عادةً في الصيف).
- الشهادة معتمدة رسمياً من جامعة القصيم.
- درجة النجاح 60 من 100، والمعدل التراكمي من 5.00.
- الحرمان عند تجاوز 25% غياب بدون عذر.
- فترة الحذف والإضافة في الأسبوع الأول من كل فصل.
- الأنظمة المستخدمة: البلاك بورد Blackboard والبوابة الإلكترونية للجامعة.
- الزي: السكراب الطبي للتخصصات الصحية، الزي الوطني لباقي التخصصات.
- متوفر كافتيريات، مواقف سيارات، مركز طبي، باصات جامعية، ومكتبة مركزية.
- التدريب الميداني إلزامي في أغلب البرامج قبل التخرج.

إذا سُئلت عن موضوع خارج نطاق الكلية (رياضة، سياسة، طبخ، جامعات أخرى...) أجب بأدب أنك مخصص فقط للكلية التطبيقية.
ردودك تكون مختصرة وواضحة ومفيدة. لا تتجاوز 3-4 جمل في الرد العادي.`;

// ─── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ];

  let reply = '';
  let usedProvider = '';

  // Try Poe first, then Groq, then OpenRouter
  try {
    reply = await callPoe(messages);
    usedProvider = 'Poe';
  } catch (poeErr) {
    console.warn(`[chat] Poe failed (${poeErr.message}), trying Groq...`);

    try {
      reply = await callGroq(messages);
      usedProvider = 'Groq';
    } catch (groqErr) {
      console.warn(`[chat] Groq failed (${groqErr.message}), trying OpenRouter...`);

      try {
        reply = await callOpenRouter(messages);
        usedProvider = 'OpenRouter';
      } catch (orErr) {
        console.error('[chat] All providers failed:', orErr.message);
        return res.status(502).json({
          error: 'All AI providers failed. Please check your API keys.',
          details: {
            poe: poeErr.message,
            groq: groqErr.message,
            openrouter: orErr.message,
          },
        });
      }
    }
  }

  console.log(`[chat] Reply from ${usedProvider} (${reply.length} chars)`);
  return res.json({ response: reply.trim() });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    providers: {
      poe: !!POE_API_KEY,
      groq: !!GROQ_API_KEY,
      openrouter: !!OPENROUTER_API_KEY,
    },
  });
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🤖 ARIA AI Voice Assistant running at http://localhost:${PORT}`);
  console.log(`   Poe key:        ${POE_API_KEY ? '✅ set' : '❌ missing'}`);
  console.log(`   Groq key:       ${GROQ_API_KEY ? '✅ set' : '❌ missing (set GROQ_API_KEY env var)'}`);
  console.log(`   OpenRouter key: ${OPENROUTER_API_KEY ? '✅ set' : '❌ missing (set OPENROUTER_API_KEY env var)'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
