// Cloudflare Pages Function — AI性格診断の窓口
// ルート: POST /api/diagnose
// Geminiをサーバー側で呼ぶので、APIキー(GEMINI_API_KEY)はブラウザに漏れない。
// Cloudflare Pages の環境変数に GEMINI_API_KEY を設定すること。

const MODELS = ['gemini-2.5-flash','gemini-2.0-flash','gemini-1.5-flash','gemini-flash-latest'];

export async function onRequestOptions() {
  return new Response(null, { headers: cors() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const key = env.GEMINI_API_KEY;
    if (!key) return json({ error: 'no_key' }, 500);

    const winner = data.winner || {};
    const path = Array.isArray(data.picks) ? data.picks : [];
    const pathNames = path.map(p => `${p.name}(${p.genre})`).join(' → ');

    const prompt = `Sei un diagnosta di personalità dissacrante e spiritoso per un pubblico italiano di appassionati di anime.
Analizza il PERCORSO di scelte di un utente in un torneo "trova il tuo anime del cuore" e scrivi una diagnosi della personalità in ITALIANO, con tono sfacciato, ironico, black humor e un pizzico di slang. Battute da "otaku", frecciatine affettuose, sarcasmo. MAI offensivo su etnia/religione/genere/orientamento: colpisci solo i gusti anime e i cliché da fan.

Vincitore finale: ${winner.name} (genere: ${winner.genre})
Percorso completo delle scelte (in ordine): ${pathNames || 'non disponibile'}
Numero di scelte fatte: ${data.picksDone || path.length}

Regole:
- Basati sul PERCORSO e sulle TENDENZE (quali generi ha scelto di più, coerenza o incoerenza, colpi di scena), non solo sul vincitore.
- Inventa un'etichetta di personalità divertente e tagliente (es. "Otaku shōnen in negazione", "Edgelord con abbonamento alla terapia", "Boomer degli anime travestito da Gen Z").
- 3-5 frasi, italiano naturale e brillante. Niente markdown, niente asterischi.

Rispondi SOLO con JSON valido: {"title":"etichetta della personalità con 1 emoji","text":"la diagnosi"}`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.0, responseMimeType: 'application/json' },
    });

    let out = null, lastErr = '';
    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      if (r.ok) { out = await r.json(); break; }
      lastErr = model + ' ' + r.status;
    }
    if (!out) return json({ error: 'gemini_failed', detail: lastErr }, 502);

    const text = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed || !parsed.text) return json({ error: 'parse_failed' }, 502);

    return json({ title: parsed.title || '🧠 Diagnosi', text: parsed.text });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
