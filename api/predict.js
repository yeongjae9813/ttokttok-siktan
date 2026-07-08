'use strict';
// GET /api/predict?dow=목&staff=712&temp=24&rain=1&menu=제육볶음(or pop=92)&special=-20
// 서버에서 학습한 모델로 내일 식수를 실제 계산해 반환한다.
const { MENUS, model } = require('../lib/model.js');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const q = req.query || {};
    const m = model();
    let pop = q.pop != null && q.pop !== '' ? +q.pop : null;
    if (pop == null && q.menu) { const mm = MENUS.find(x => x.name === q.menu); pop = mm ? mm.pop : 70; }
    if (pop == null) pop = 92;
    const rec0 = {
      dow: q.dow || '목',
      staff: q.staff != null && q.staff !== '' ? +q.staff : 712,
      temp: q.temp != null && q.temp !== '' ? +q.temp : 24,
      rain: (q.rain === '1' || q.rain === 'true') ? 1 : 0,
      pop: pop,
      special: q.special != null && q.special !== '' ? +q.special : -20
    };
    const p = Math.round(m.predict(rec0));
    const rec = Math.round(p + p * 0.03 + 8);
    const base = m.predict(rec0);
    const contrib = mod => Math.round(base - m.predict(Object.assign({}, rec0, mod)));
    const contributions = {
      '실근무 인원': contrib({ staff: m.means[0] }),
      '요일': contrib({ dow: '수' }),
      '날씨(비)': contrib({ rain: 0 }),
      '기온': contrib({ temp: m.means[1] }),
      '메뉴 인기': contrib({ pop: m.means[3] })
    };
    res.status(200).json({
      pred: p, rec: rec, band: Math.round(p * 0.035),
      input: rec0, contributions: contributions,
      mae: +m.mae.toFixed(1), acc: +m.acc.toFixed(1),
      trained_on: m.split + '일 (검증 ' + m.testN + '일)',
      model: 'server-trained linear regression (browser sample data)',
      source: 'server'
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
