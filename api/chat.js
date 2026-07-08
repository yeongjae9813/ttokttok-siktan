'use strict';
// POST /api/chat  { message, context }  →  Gemini(LLM)로 자연어 답변 생성
// 키는 Vercel 환경변수 GEMINI_API_KEY 에 저장 (코드에 노출 X)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') {
    const K = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (!(req.query && req.query.selftest)) { res.status(200).json({ ok: true, hasKey: !!K, model }); return; }
    if (!K) { res.status(200).json({ error: 'no_key' }); return; }
    try {
      const ctx = { 오늘: '7월 8일 수요일', 이번주_식단: '월요일: 돼지안심스테이크 등 | 화요일: 제육 등 | 수요일: 불고기마늘종비빔밥 등 | 목요일: 찰흑미밥, 사골콩나물우거지국, 닭고기카레강정, 건파래볶음, 상추된장무침, 총각김치 | 금요일: 구내식당 휴무', 배식시간: '11:35~' };
      const sys = '너는 세종시청 구내식당 도우미야. 아래 [정보]만 근거로 2~4문장으로 답해. 내일/특정 요일 메뉴는 오늘 요일 기준으로 이번주_식단에서 찾아 답해줘.\n[정보]\n' + JSON.stringify(ctx);
      const u = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + K;
      const rr = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: 'user', parts: [{ text: '내일 메뉴 뭔지 알아?' }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } }) });
      const j = await rr.json();
      const c = j && j.candidates && j.candidates[0];
      const reply = c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text;
      res.status(200).json({ status: rr.status, finishReason: c && c.finishReason, reply: reply || null });
    } catch (e) { res.status(200).json({ selftest_error: String((e && e.message) || e) }); }
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) { res.status(503).json({ error: 'no_key', hint: 'Vercel 환경변수 GEMINI_API_KEY 를 설정하세요.' }); return; }

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};
    const message = String(body.message || '').slice(0, 500);
    const ctx = body.context || {};
    if (!message.trim()) { res.status(400).json({ error: 'no_message' }); return; }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const sys = [
      '너는 세종특별자치시 본청 구내식당 서비스 「똑똑 식판」의 친절한 식단 안내 도우미야.',
      '아래 [정보]만 근거로 한국어로 친근하게 답해. 답변은 2~4문장.',
      '메뉴는 빠짐없이 나열해줘. 내일이나 특정 요일 메뉴를 물으면 "오늘" 요일을 기준으로 "이번주_식단"에서 찾아 답해줘. 정보에 없는 건 모른다고 솔직히 말하고 지어내지 마. 이모지는 최대 1개.',
      '[정보]',
      JSON.stringify(ctx)
    ].join('\n');

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + KEY;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: 'gemini_error', status: r.status, detail: t.slice(0, 400) });
      return;
    }
    const j = await r.json();
    const reply = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
      j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
    res.status(200).json({ reply: (reply || '죄송해요, 지금은 답변을 만들지 못했어요.').trim(), model, source: 'gemini' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
