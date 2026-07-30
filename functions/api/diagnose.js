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

    const prompt = `Sei un diagnosta di personalità dissacrante, spiritoso e SEMPRE ORIGINALE per un pubblico italiano di appassionati di anime.
Scrivi una diagnosi della personalità UNICA e cucita su misura, in ITALIANO, con tono sfacciato, ironico, black humor e un pizzico di slang. Frecciatine affettuose sui cliché da fan. MAI offensivo su etnia, religione, genere o orientamento: colpisci solo i gusti anime.

DATI DELL'UTENTE:
- Vincitore finale: ${winner.name} (genere: ${winner.genre})
- Titoli scelti lungo il percorso, in ordine: ${pathNames || 'non disponibile'}
- Numero di scelte fatte: ${data.picksDone || path.length}

ISTRUZIONI FONDAMENTALI (per garantire varietà):
- Inventa OGNI VOLTA un'etichetta di personalità completamente NUOVA e originale, cucita su QUESTO percorso specifico. NON riutilizzare etichette generiche o ricorrenti: sorprendimi.
- Cita ESPLICITAMENTE 2 o 3 titoli SPECIFICI presi dal percorso qui sopra e usali per le battute (non solo il vincitore).
- Analizza le TENDENZE reali: quale genere domina, se è coerente o caotico, eventuali colpi di scena tra i titoli scelti.
- Sii imprevedibile: due utenti con percorsi diversi devono ricevere diagnosi MOLTO diverse tra loro.
- 3-5 frasi, italiano naturale e brillante. Niente markdown, niente asterischi, niente elenchi.

Rispondi SOLO con JSON valido: {"title":"etichetta personalità originale con 1 emoji","text":"la diagnosi"}`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.35, topP: 0.95, responseMimeType: 'application/json' },
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
