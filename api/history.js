'use strict';
// GET /api/history?limit=20  → 과거 식수 샘플 데이터셋 + 모델 성능
const { model } = require('../lib/model.js');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const m = model();
    const q = req.query || {};
    const limit = Math.min(60, Math.max(1, +(q.limit) || 20));
    res.status(200).json({
      count: m.DATA.length,
      mae: +m.mae.toFixed(1),
      acc: +m.acc.toFixed(1),
      rows: m.DATA.slice(0, limit),
      source: 'server'
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
