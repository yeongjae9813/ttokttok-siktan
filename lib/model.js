'use strict';
/* 똑똑 식판 · 예측 모델 (서버 공용)
 * 영양사 앱과 동일한 메뉴·변수·공식으로 '고정' 샘플 데이터를 만들어
 * 서버에서 실제 선형회귀를 학습한다. (결과는 콜드스타트 사이 캐시)
 */
const MENUS = [
  { name: '제육볶음', pop: 92 }, { name: '돈까스', pop: 88 }, { name: '함박스테이크', pop: 85 },
  { name: '김치찌개', pop: 78 }, { name: '비빔밥', pop: 70 }, { name: '고등어구이', pop: 55 }
];
const DOWS = ['월', '화', '수', '목', '금'];
const DAYF = { '월': 15, '화': 5, '수': 0, '목': -20, '금': -60 };
const CAP = 980;

// 시드 고정 PRNG → 매 배포/콜드스타트마다 동일한 샘플 데이터
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function genData(n, seed) {
  const r = mulberry32(seed); const out = [];
  for (let i = 0; i < n; i++) {
    const dow = DOWS[i % 5];
    const temp = Math.max(0, Math.min(35, Math.round(8 + r() * 22 + (r() - 0.5) * 6)));
    const rain = r() < 0.25 ? 1 : 0;
    const leave = Math.round(60 + r() * 170), trip = Math.round(40 + r() * 130), remote = 60;
    const staff = CAP - leave - trip - remote;
    const m = MENUS[Math.floor(r() * MENUS.length)];
    const special = r() < 0.22 ? Math.round((r() - 0.5) * 70) : 0;
    const noise = (r() - 0.5) * 54;
    const y = Math.round(staff + DAYF[dow] + (rain ? -25 : 0) + (22 - temp) * 1.1 + (m.pop - 70) * 1.2 + special + noise);
    out.push({ dow, temp, rain, staff, menu: m.name, pop: m.pop, special, y });
  }
  return out;
}
// 특징: [실근무, 기온, 강수, 메뉴인기, 일정, 월,화,목,금] (수=기준)
function feat(d) {
  return [d.staff, d.temp, d.rain, d.pop, d.special,
    d.dow === '월' ? 1 : 0, d.dow === '화' ? 1 : 0, d.dow === '목' ? 1 : 0, d.dow === '금' ? 1 : 0];
}
function build() {
  const N = 252, SPLIT = 202, DATA = genData(N, 20240708);
  const TR = DATA.slice(0, SPLIT), TE = DATA.slice(SPLIT);
  const Xr = TR.map(feat), y = TR.map(d => d.y), M = Xr[0].length, means = [], stds = [];
  for (let j = 0; j < M; j++) {
    const c = Xr.map(r => r[j]); const mu = c.reduce((a, b) => a + b, 0) / c.length;
    const sd = Math.sqrt(c.reduce((a, b) => a + (b - mu) ** 2, 0) / c.length) || 1;
    means.push(mu); stds.push(sd);
  }
  const std = row => row.map((v, j) => (v - means[j]) / stds[j]);
  const X = Xr.map(std);
  let w = new Array(M).fill(0), b = 0;
  for (let e = 0; e < 1000; e++) {
    const gw = new Array(M).fill(0); let gb = 0;
    for (let i = 0; i < X.length; i++) {
      let p = b; for (let j = 0; j < M; j++) p += w[j] * X[i][j];
      const err = p - y[i]; for (let j = 0; j < M; j++) gw[j] += err * X[i][j]; gb += err;
    }
    for (let j = 0; j < M; j++) w[j] -= 0.15 * gw[j] / X.length; b -= 0.15 * gb / X.length;
  }
  const predict = d => { const x = std(feat(d)); let p = b; for (let j = 0; j < M; j++) p += w[j] * x[j]; return p; };
  const tp = TE.map(predict);
  const mae = TE.reduce((a, d, i) => a + Math.abs(tp[i] - d.y), 0) / TE.length;
  const avg = TE.reduce((a, d) => a + d.y, 0) / TE.length;
  return { DATA, means, stds, w, b, predict, mae, acc: 100 * (1 - mae / avg), split: SPLIT, testN: TE.length };
}
let _cache = null;
function model() { return _cache || (_cache = build()); }

module.exports = { MENUS, DOWS, DAYF, CAP, model };
