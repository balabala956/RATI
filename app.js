/* =========================================================
   聚了吗？—— 应用逻辑
   ========================================================= */

/* Chrome 61 基线：检测 flex 布局下 gap 是否真实生效（不能只用 CSS.supports 语法检测）。
   生效时给 <html> 加 supports-flex-gap，由 CSS 启用 gap 增强层；否则走 margin 基线。 */
(function detectFlexGap() {
  var flex = document.createElement('div');
  flex.style.position = 'absolute';
  flex.style.visibility = 'hidden';
  flex.style.display = 'flex';
  flex.style.flexDirection = 'column';
  flex.style.rowGap = '1px';
  flex.appendChild(document.createElement('div'));
  flex.appendChild(document.createElement('div'));
  document.body.appendChild(flex);
  var supported = flex.scrollHeight === 1;
  flex.parentNode.removeChild(flex);
  if (supported) document.documentElement.className += ' supports-flex-gap';
})();

const state = {
  city: '',
  scene: null,
  people: 4,
  members: ['ENFP', 'INFJ', 'ESTP', 'ISTJ'],
  shown: new Set(),
  game: '' // 追加：聚会小游戏类型
};

const AVATARS = ['🦊', '🐼', '🐱', '🐶', '🐰', '🦁', '🐸', '🐵'];
function toIndexMap(list, keyField) {
  const map = {};
  list.forEach(function (item) { map[item[keyField]] = item; });
  return map;
}
const SCENE_MAP = toIndexMap(SCENES, 'key');
const TYPE_MAP = toIndexMap(MBTI_TYPES, 'type');

const LOADING_TEXTS = [
  '正在算 E 人还能撑多久……撑挺久的，别急',
'正在给 I 人找一个没人看得见的角落……找到了',
'正在测你们这群人的脑洞浓度……有点超，我记一下',
'正在把 P 人的计划表删掉。他说不用，那就删',
'正在翻你们那儿的老馆子……有三家我看着不错',
'正在抄小红书爆款……抄完了，改了点，比它好',
'正在统计 J 人的安全感……数字很低，建议提前订位',
'正在找社牛和社恐的平衡点……找到了，在角落里'
];

const QUICK_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '长沙', '西安'];

/* ---------------- 城市与地域（全国覆盖） ---------------- */
/* 地理条件判定：a.geo = 'c' 需沿海；'w' 需临水（沿海/江/湖）
   tags 为 null/undefined = 城市未知（不限制）；空字符串 '' = 确认无地理特征（应排除） */
function geoMatch(geo, tags) {
  if (!geo || tags == null) return null;
  const t = String(tags);
  if (geo === 'c') return t.includes('c');
  if (geo === 'w') return t.includes('c') || t.includes('r');
  return null;
}

/* 把坐标/标签/区域信息挂到城市数据上 */
function withGeo(data, name) {
  const g = CITY_GEO[name];
  if (!g) return Object.assign({}, data, { name: name, tags: '', lat: null, lng: null });
  return Object.assign({}, data, { name: name, lat: g[0], lng: g[1], tags: g[2] || '', region: g[3] });
}

/* 未收录专属攻略的城市：按区域风味合成数据（不编造具体店名） */
function synthCity(name) {
  const g = CITY_GEO[name];
  const profile = REGION_PROFILE[g[3]];
  return {
    name,
    lat: g[0], lng: g[1], tags: g[2] || '', region: g[3],
    synth: true,
    regionLabel: profile.label,
    regionNote: profile.note,
    foods: profile.foods,
    spots: GENERIC_SPOTS,
    localPlay: GENERIC_LOCAL_PLAY
  };
}

function findCity(input) {
  const q = (input || '').trim()
    .replace(/(市|省|自治区|特别行政区)$/, '')
    .replace(/(壮族|回族|维吾尔)(?=自治区)?/, '');
  if (!q) return null;

  /* 1. 省份名 → 省会兜底 */
  const viaProvince = PROVINCE_CAPITAL[q];
  /* 2. 18 个有专属攻略的城市优先 */
  for (const [name, data] of Object.entries(CITIES)) {
    if (q === name || q.includes(name) || (q.length >= 2 && name.includes(q))) {
      return withGeo(data, name);
    }
  }
  /* 3. 全国地理库：精确 → 模糊包含 */
  if (CITY_GEO[q]) return synthCity(q);
  for (const name of Object.keys(CITY_GEO)) {
    if (q.includes(name) || (q.length >= 2 && name.includes(q))) return synthCity(name);
  }
  if (viaProvince && CITY_GEO[viaProvince]) return synthCity(viaProvince);
  return null;
}

/* 根据经纬度反查最近的城市（免 Key 反向地理编码） */
function nearestCity(lat, lng) {
  let best = null, bestD = Infinity;
  const k = Math.cos(lat * Math.PI / 180);
  for (const [name, g] of Object.entries(CITY_GEO)) {
    const dLat = (g[0] - lat) * 111;
    const dLng = (g[1] - lng) * 111 * k;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

/* Chrome 61 基线：String.prototype.replaceAll 为 ES2021，用 split/join 等价替换字面量 */
function replaceLiteral(str, find, replacement) {
  return String(str).split(find).join(replacement);
}

function localize(text, city) {
  const f = city ? city.foods : [];
  const s = city ? city.spots : [];
  let out = String(text);
  out = replaceLiteral(out, '{city}', city ? city.name : '你们城市');
  out = replaceLiteral(out, '{c}', city ? city.name : '本地');
  out = replaceLiteral(out, '{f1}', f[0] || '本地特色小吃');
  out = replaceLiteral(out, '{f2}', f[1] || '本地老字号');
  out = replaceLiteral(out, '{f3}', f[2] || '夜市招牌');
  out = replaceLiteral(out, '{s1}', s[0] || '城市老街');
  out = replaceLiteral(out, '{s2}', s[1] || '城市公园');
  return out;
}

function getSteps(a, city) {
  if (a.dynamic === 'localQuest') {
    if (city) {
      const steps = city.localPlay.slice();
      steps.push(`临走前：带一份${city.foods[3] || '本地特产'}当伴手礼，或在${city.spots[0]}寄一张明信片`);
      return steps;
    }
    return [
      '上午：去本地点评最高的菜市场逛一圈，吃个本地人早餐',
      '下午：挑一条老街慢慢走，钻进随机遇到的小店',
      '晚上：夜市或小吃街解决晚饭，哪家本地人多排哪家',
      '临走前：买一份本地特产当伴手礼'
    ];
  }
  return a.steps;
}

/* ---------------- 屏幕切换 ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  document.getElementById(id).classList.add('screen-active');
  window.scrollTo(0, 0);
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- 配置页渲染 ---------------- */
function renderCityChips() {
  const wrap = document.getElementById('city-chips');
  if (!wrap) return;
  wrap.innerHTML = QUICK_CITIES.map(c =>
    `<button class="city-chip ${state.city.includes(c) ? 'city-chip-active' : ''}" data-city="${c}">${c}</button>`
  ).join('');
  wrap.querySelectorAll('.city-chip').forEach(b => {
    b.onclick = () => {
      state.city = b.dataset.city;
      document.getElementById('input-city').value = b.dataset.city;
      renderCityChips();
    };
  });
}

function renderSceneChips() {
  const wrap = document.getElementById('scene-chips');
  wrap.innerHTML = SCENES.map(s => `
    <button class="chip ${state.scene === s.key ? 'chip-active' : ''}" data-scene="${s.key}">
      <span class="chip-emoji">${s.emoji}</span>${s.label}
    </button>
  `).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => {
      state.scene = c.dataset.scene;
      renderSceneChips();
    };
  });
}

function renderMembers() {
  document.getElementById('people-count').textContent = state.people;
  document.getElementById('btn-minus').disabled = state.people <= 1;
  document.getElementById('btn-plus').disabled = state.people >= 8;

  const wrap = document.getElementById('member-list');
  wrap.innerHTML = state.members.map((m, i) => `
    <div class="member-row">
      <div class="member-avatar">${AVATARS[i]}</div>
      <div class="member-name">朋友 ${i + 1}</div>
      <select class="member-type" data-idx="${i}">
        <option value="" ${!m ? 'selected' : ''}>🤷 随缘</option>
        ${MBTI_TYPES.map(t => `
          <option value="${t.type}" ${m === t.type ? 'selected' : ''}>
            ${t.type} ${t.role}
          </option>
        `).join('')}
      </select>
    </div>
  `).join('');

  wrap.querySelectorAll('.member-type').forEach(sel => {
    sel.onchange = () => {
      state.members[+sel.dataset.idx] = sel.value || null;
      updateDecisionSummary();
    };
  });
}

function setPeople(n) {
  state.people = n;
  while (state.members.length < n) state.members.push(null);
  state.members = state.members.slice(0, n);
  renderMembers();
  updateDecisionSummary();
}

/* ---------------- 决策环节：数据摘要更新 ---------------- */
function updateDecisionSummary() {
  var el = document.getElementById('decision-summary');
  if (!el) return;
  var city = state.city || document.getElementById('input-city').value || '';
  var n = state.people || 0;
  if (!city || !n) {
    el.textContent = '地点和人数还没给我。不给，我就没法干。';
    el.classList.remove('ready');
    return;
  }
  var mbtis = (state.members || []).filter(function (m) { return m; });
  var mbtiStr = mbtis.length > 0 ? mbtis.join('/') : '未提供';
  el.textContent = n + '人 · ' + city + ' · ' + mbtiStr;
  el.classList.add('ready');
}

/* ---------------- 群体画像 ---------------- */
function buildProfile(members) {
  let e = 0, n = 0, t = 0, j = 0;
  const typeCount = {};
  members.forEach(m => {
    if (!m) { e += .5; n += .5; t += .5; j += .5; return; }
    const d = TYPE_MAP[m].dims;
    e += d.e; n += d.n; t += d.t; j += d.j;
    typeCount[m] = (typeCount[m] || 0) + 1;
  });
  const c = members.length;
  return { e: e / c, n: n / c, t: t / c, j: j / c, total: c, typeCount };
}

function dominantTemperament(p) {
  let best = null, bestCount = 0;
  Object.entries(TEMPERAMENTS).forEach(([key, temp]) => {
    const count = temp.types.reduce((sum, ty) => sum + (p.typeCount[ty] || 0), 0);
    if (count > bestCount) { bestCount = count; best = Object.assign({ key: key }, temp, { count: count }); }
  });
  return best;
}

function buildVibe(p) {
  let eiTitle, eiDesc;
  if (p.total === 1) {
    eiTitle = '独处充电日';
    eiDesc = '一个人也要好好玩，今天所有安排由你说了算，不用迁就任何人';
  } else if (p.total === 2) {
    if (p.e >= 0.7) { eiTitle = '双人能量场'; eiDesc = '两个人也能高能输出，需要有互动节奏的玩法'; }
    else if (p.e <= 0.3) { eiTitle = '双人治愈舱'; eiDesc = '低社交密度的高质量陪伴，安静但不无聊'; }
    else { eiTitle = '双人默契局'; eiDesc = '一热一慢刚刚好，主打有话聊、有事做'; }
  } else if (p.e >= 0.7) { eiTitle = 'E 人过载·发电站'; eiDesc = '全员高能，需要一个能尽情发疯的舞台'; }
  else if (p.e <= 0.3) { eiTitle = 'I 人舒适·充电舱'; eiDesc = '慢热型阵容，低压力的平行社交最舒服'; }
  else { eiTitle = 'EI 混搭·快慢皆宜'; eiDesc = '社牛带气氛、社恐有角落，配置刚刚好'; }

  const temp = dominantTemperament(p);
  const title = `${eiTitle}<br><span class="vibe-accent">× ${temp.name}</span>`;
  return { title, sub: `${eiDesc}；${temp.desc}。` };
}

function buildCoachTips(p, cityData) {
  const tips = [];

  if (p.total === 1) {
    tips.push('独处模式：所有推荐都零社交压力，不用怕冷场、不用等谁，玩累了随时撤');
    if (p.e >= 0.6) tips.push('E 人一个人也想热闹？选开放麦、飞盘皮卡局这类现场，能自然认识新朋友');
    else tips.push('一个人出门最划算的投资：买花、吃好的、看日落——对自己大方一点');
    if (cityData) tips.push(`既然在${cityData.name}，必吃清单（${cityData.foods.slice(0,3).join('、')}）值得单独安排半天`);
    return tips.slice(0, 2);
  }

  if (p.total === 2) {
    tips.push('两人局最忌「面对面干聊」，推荐玩法都自带互动节奏，话题荒也不怕');
  }

  if (p.e >= 0.7) tips.push('全场 E 人超标，请优先选场地大、能出声的方案，餐厅局容易「拆家」');
  else if (p.e <= 0.3) tips.push('全员 I 人：所有推荐均无强制表演环节，被 cue 到可以用「下次一定」婉拒');
  else if (p.total > 2) tips.push('E 人负责热场，但记得每 90 分钟给 I 人 15 分钟安静回血时间');

  if (p.j >= 0.7) tips.push('J 人浓度高：门票、餐厅务必提前订好，同时留一个随机小环节给生活一点意外');
  else if (p.j <= 0.3) tips.push('P 人浓度高：集合时间可以模糊，但凡是需要预约的项目，请授权一位 J 人锁死');

  if (p.n >= 0.75) tips.push('N 人过多：请准备实体道具和明确规则，否则你们会聊到宇宙起源但什么都没玩成');
  if (p.t >= 0.8) tips.push('T 人过多：胜负欲警告，计分规则提前写清楚，友谊第一比赛第二');
  if (p.t <= 0.2) tips.push('F 人浓度爆表：多安排走心环节，纸巾常备，竞技类别设太重的惩罚');

  return tips.slice(0, 2);
}

/* ---------------- 推荐引擎 ---------------- */
function scoreActivities(p, scene, size, cityData) {
  return ACTIVITIES.map(a => {
    if (size < a.size[0] || size > a.size[1]) return null;
    let s = 50;
    s += a.scenes.includes(scene) ? 22 : -8;
    [['e', p.e], ['n', p.n], ['t', p.t], ['j', p.j]].forEach(([k, v]) => {
      s += (1 - Math.abs(v - a.fit[k])) * 14;
    });
    if (a.hot) s += 4;
    /* 人数适配：独处/双人专属玩法加权 */
    if (a.solo && size === 1) s += 14;
    if (a.duo && size === 2) s += 12;
    if (size === 1 && a.fit.e >= 0.8) s -= 6;   // 单人局避开强表演高能活动
    /* 地域限定：选了城市时本地玩法加权 */
    if (a.regional && cityData) s += 8;
    /* 地理条件：赶海必须靠海、夜游船/桨板必须临水；不符的城市直接排除，不推错方案 */
    if (a.geo && cityData) {
      const gm = geoMatch(a.geo, cityData.tags);
      if (gm === false) return null;
      if (gm === true) s += 10;
    }
    if (state.shown.has(a.id)) s -= 25;
    s += Math.random() * 10;
    return { a, s };
  }).filter(Boolean).sort((x, y) => y.s - x.s);
}

function buildReasons(a, p, scene, size, cityData) {
  const reasons = [];
  const pct = v => Math.round(v * 100);

  if (size === 1)
    reasons.push('一个人的局不用迁就任何人，这个玩法零社交压力，随时开始、玩累随时撤');
  else if (size === 2 && (a.duo || a.size[1] <= 4))
    reasons.push('两人局最忌干聊，这个玩法自带互动节奏，面对面一整晚不冷场');

  if (a.regional && cityData)
    reasons.push(`${cityData.name}本地限定：${cityData.foods[0]}、${cityData.spots[0]}都安排上了，是本地人认证的打开方式`);

  if (cityData && a.geo) {
    const gm = geoMatch(a.geo, cityData.tags);
    if (gm === true && a.geo === 'c')
      reasons.push(`${cityData.name}靠海，这是海边城市的地理福利，内陆朋友羡慕不来`);
    else if (gm === true && a.geo === 'w')
      reasons.push(`${cityData.name}沿江临湖，水上晚风局在你们这儿下楼就能安排`);
  }

  if (p.e >= 0.65 && Math.abs(p.e - a.fit.e) < 0.28)
    reasons.push(`E 人含量 ${pct(p.e)}%，需要释放能量的舞台，这个局带表演感、互动密度高`);
  if (p.e <= 0.35 && a.fit.e <= 0.45)
    reasons.push(`I 人居多（${pct(1 - p.e)}%），挑了不用硬聊、不被 cue 也舒服的玩法`);
  if (p.n >= 0.65 && a.fit.n >= 0.65)
    reasons.push(`N 人浓度 ${pct(p.n)}%，开脑洞、讲故事的创作型玩法正中你们下怀`);
  if (p.n <= 0.35 && a.fit.n <= 0.45)
    reasons.push(`S 人占多数，动手做、有实物产出的活动比空谈更对味`);
  if (p.t >= 0.7 && a.fit.t >= 0.6)
    reasons.push(`T 人浓度 ${pct(p.t)}%，有规则、讲策略的环节会让你们两眼发光`);
  if (p.t <= 0.3 && a.fit.t <= 0.4)
    reasons.push(`F 人浓度 ${pct(1 - p.t)}%，走心、能留下回忆的环节最戳你们`);
  if (p.j >= 0.7 && a.fit.j >= 0.55)
    reasons.push(`J 人占比高，流程清晰、目标明确的安排让全员安心`);
  if (p.j <= 0.3 && a.fit.j <= 0.3)
    reasons.push(`P 人浓度 ${pct(1 - p.j)}%，开放随机、走哪算哪的自由局才是你们的菜`);

  if (a.scenes.includes(scene))
    reasons.push(`不用转场，在「${SCENE_MAP[scene].label}」里直接就能开局`);
  if (size >= 4 && size <= 6 && a.size[0] <= 4 && a.size[1] >= 5)
    reasons.push(`${size} 人规模正好，分组后每个人都有戏份，没人当观众`);
  if (a.hot)
    reasons.push('小红书 2026 热门玩法，出片率和话题度都在线');

  return reasons.slice(0, 3);
}

/* ---------------- 结果渲染 ---------------- */
function dimBar(left, right, val, color) {
  return `
    <div class="dim-row">
      <span class="dim-label-l" style="color:${color}">${left}</span>
      <div class="dim-track">
        <div class="dim-fill" style="width:${Math.round(val * 100)}%;background:${color}"></div>
      </div>
      <span class="dim-label-r">${right}</span>
    </div>`;
}

function renderResult(picks, p, cityData) {
  const city = state.city.trim();
  const cityName = cityData ? cityData.name : (city || '神秘城市');
  const sceneLabel = state.scene ? SCENE_MAP[state.scene].label : '自由活动';
  const vibe = buildVibe(p);
  const tips = buildCoachTips(p, cityData);
  const isSolo = state.people === 1;

  const memberChips = state.members.map((m, i) => {
    const label = isSolo ? '今天的主角' : `朋友${i + 1}`;
    if (!m) return `<span class="member-chip">${AVATARS[i]} ${label} · <span class="mc-type">随缘</span></span>`;
    const meta = TYPE_MAP[m];
    return `<span class="member-chip">${meta.emoji} ${label} · <span class="mc-type">${m}</span></span>`;
  }).join('');

  /* 地域限定卡 */
  let regionCard = '';
  if (cityData && cityData.synth) {
    /* 全国任意城市：按区域风味合成的攻略卡（诚实标注，具体门店走地图） */
    const geoBadges = [
      cityData.tags.includes('c') ? '<span class="region-tag tag-spot">🌊 沿海城市</span>' : '',
      cityData.tags.includes('r') ? '<span class="region-tag tag-spot">🚢 临江临湖</span>' : ''
    ].join('');
    regionCard = `
      <div class="region-card region-card-synth">
        <h3>🧭 ${cityData.name} · ${cityData.regionLabel}攻略</h3>
        <div class="region-tags" style="margin-bottom:8px">${geoBadges}</div>
        <div class="region-line"><span class="region-ico">🍜</span><b>本地该吃什么</b>
          <div class="region-tags">${cityData.foods.map(f => `<span class="region-tag tag-food">${f}</span>`).join('')}</div>
        </div>
        <div class="region-line"><span class="region-ico">📸</span><b>到这得逛</b>
          <div class="region-tags">${cityData.spots.map(sp => `<span class="region-tag tag-spot">${sp}</span>`).join('')}</div>
        </div>
        <div class="region-local">✨ <b>${cityData.regionNote}</b><br>📍 具体哪家好吃，点下面的高德或腾讯按钮，看真实评分和距离</div>
      </div>`;
  } else if (cityData) {
    regionCard = `
      <div class="region-card">
        <h3>🏮 ${cityData.name}限定 · 本地攻略</h3>
        <div class="region-tags" style="margin-bottom:8px">${[
          cityData.tags.includes('c') ? '<span class="region-tag tag-spot">🌊 沿海城市</span>' : '',
          cityData.tags.includes('r') ? '<span class="region-tag tag-spot">🚢 临江临湖</span>' : ''
        ].join('')}</div>
        <div class="region-line"><span class="region-ico">🍜</span><b>到这得吃</b>
          <div class="region-tags">${cityData.foods.map(f => `<span class="region-tag tag-food">${f}</span>`).join('')}</div>
        </div>
        <div class="region-line"><span class="region-ico">📸</span><b>到这得逛</b>
          <div class="region-tags">${cityData.spots.map(sp => `<span class="region-tag tag-spot">${sp}</span>`).join('')}</div>
        </div>
        <div class="region-local">✨ <b>本地人平时这么走：</b>${cityData.localPlay.join(' → ')}</div>
      </div>`;
  } else {
    regionCard = `
      <div class="region-card region-card-empty">
        <h3>🏮 本地攻略没解锁</h3>
        <p>回上一页把城市填上（杭州、成都、长沙都行），我就把本地必吃、必逛和本地人那条路线给你</p>
      </div>`;
  }

  const cards = picks.map(({ a, s }, idx) => {
    const match = Math.min(98, Math.max(76, Math.round(s / 1.36)));
    const reasons = buildReasons(a, p, state.scene, state.people, cityData);
    const steps = getSteps(a, cityData).map(st => `<li>${localize(st, cityData)}</li>`).join('');
    const props = a.props.map(pr => `<span class="act-prop">${localize(pr, cityData)}</span>`).join('');
    const sizeTag = a.solo && isSolo ? '👤 一个人也能玩' : `👥 ${a.size[0]}-${a.size[1]} 人`;
    const kws = poiKeywords(a);
    const poiBtns = `
      <div class="act-poi">
        <span class="poi-btn poi-amap">📍 搜「${kws[0]}」</span>
        <span class="poi-btn poi-qq">搜「${kws[1] || kws[0]}」</span>
        <span class="poi-hint">去地图 App 搜上面的词找场馆</span>
      </div>`;
    return `
      <article class="act-card" style="animation-delay:${idx * .12}s">
        <div class="act-hero">
          <div class="act-emoji">${a.emoji}</div>
          <div class="act-head-main">
            <div class="act-name">${localize(a.name, cityData)}</div>
            <div class="act-tags">
              ${a.hot ? '<span class="act-tag tag-hot">🔥 最近挺火</span>' : ''}
              ${a.regional && cityData ? '<span class="act-tag tag-region">🏮 就你们那儿有</span>' : ''}
              <span class="act-tag tag-cat">${a.cat}</span>
              <span class="act-tag">⏱ ${a.dur}</span>
              <span class="act-tag">💰 ${a.cost}</span>
              <span class="act-tag">${sizeTag}</span>
            </div>
          </div>
          <div class="match-ring" style="--pct:${match * 3.6}deg">
            <b>${match}%</b><small>匹配</small>
          </div>
        </div>
        <div class="act-body">
          <div class="act-why">
            <span class="why-title">🎯 为什么${isSolo ? '这局适合你' : '这局适合你们'}</span>
            <ul>${reasons.map(r => `<li>${r}</li>`).join('')}</ul>
          </div>
          <div class="act-section">
            <h4><span class="sec-emoji">📝</span>怎么玩</h4>
            <ol class="act-steps">${steps}</ol>
          </div>
          <div class="act-section">
            <h4><span class="sec-emoji">🎒</span>带这些东西</h4>
            <div class="act-props">${props}</div>
          </div>
          <div class="act-tip">💡 我说句实话：${localize(a.tip, cityData)}</div>
          <div class="act-venue">📍 去哪儿：${localize(a.venue, cityData)}</div>
          ${poiBtns}
        </div>
      </article>`;
  }).join('');

  /* LBS 地图卡（离线版） */
  const poiRows = picks.map(({ a }) => {
    const kws = poiKeywords(a);
    return `
      <div class="poi-row">
        <span class="poi-name">${a.emoji} ${localize(a.name, cityData)}</span>
        <span class="poi-links">
          <span class="poi-btn poi-amap">📍 搜「${kws[0]}」</span>
          <span class="poi-btn poi-qq">搜「${kws[1] || kws[0]}」</span>
        </span>
      </div>`;
  }).join('');
  const mapCard = `
    <div class="map-card">
      <h3>🗺️ 去哪找场地（关键词给你列好了）</h3>
      <div id="lbs-map" class="lbs-map"></div>
      <div class="poi-rows">${poiRows}</div>
      <p class="map-note">本环境不支持联网地图。打开你手机里的高德/百度/腾讯地图，搜上面的关键词，附近真实场馆、距离、评分一目了然。我不编，你自己看。</p>
    </div>`;

  document.getElementById('result-body').innerHTML = `
    <div class="summary-card">
      <div class="summary-meta">${cityName} · ${sceneLabel} · ${isSolo ? '1 人独处局' : `${state.people} 人局`}</div>
      <div class="vibe-title">${vibe.title}</div>
      <p class="vibe-sub">${vibe.sub}</p>
      <div class="member-chips">${memberChips}</div>
      <div class="dim-bars">
        ${dimBar('E', 'I', p.e, '#ff8a3d')}
        ${dimBar('N', 'S', p.n, '#7c5cff')}
        ${dimBar('T', 'F', p.t, '#4d8dff')}
        ${dimBar('J', 'P', p.j, '#ffb703')}
      </div>
    </div>

    ${regionCard}

    ${mapCard}

    <div class="coach-tip">
      🧭 <b>我最后说两句：</b><br>${tips.map(t => `· ${t}`).join('<br>')}
    </div>

    <div class="section-head">
      <h3>${isSolo ? '🎁 一个人怎么玩，我想好了' : '🎁 给你们排的，照做就行'}</h3>
      <span class="head-note">按匹配度排的 · 一共 ${ACTIVITIES.length} 个玩法可选</span>
    </div>
    ${cards}

    <div id="friction-section-wrap"></div>
  `;

  /* 地图初始化（Leaflet 异步加载，失败有降级） */
  initLbsMap(picks, cityData);

  /* 追加：MBTI 社交摩擦预判（非独处局且有成员时才渲染） */
  if (!isSolo && state.members.filter(m => m).length > 0) {
    renderFrictionAnalysis();
  }
}

/* ---------------- MBTI 社交摩擦预判渲染 ---------------- */
function renderFrictionAnalysis() {
  var participants = state.members.map(function (m, i) {
    return { name: '朋友' + (i + 1), mbti: m || '', note: '' };
  });
  var activity = state.game || 'draw-guess';
  var scene = state.scene || '';

  var result = MBTIAnalyzer.analyzeSocialFriction({ participants: participants, activity: activity, scene: scene });

  var riskClass = result.overallRisk === '高' ? 'risk-high' : (result.overallRisk === '中' ? 'risk-mid' : 'risk-low');

  var html = '<div class="friction-section">'
    + '<div class="friction-header">'
    + '<h3>🧠 谁可能会先急眼</h3>'
    + '<span class="friction-risk-badge ' + riskClass + '">总体风险：' + result.overallRisk + '</span>'
    + '</div>';

  // 摘要
  html += '<div class="friction-summary">' + result.summary + '</div>';

  // 风险卡片
  if (result.risks && result.risks.length > 0) {
    result.risks.forEach(function (r) {
      var rc = r.level === '高' ? 'risk-high' : (r.level === '中' ? 'risk-mid' : 'risk-low');
      html += '<div class="friction-card ' + rc + '">'
        + '<div class="friction-card-title">⚠️ ' + r.title + ' <span class="friction-risk-badge ' + rc + '" style="margin-left:auto">' + r.level + '</span></div>'
        + '<div class="friction-card-desc">' + r.desc + '</div>'
        + '<div class="friction-card-action"><b>建议：</b>' + r.action + '</div>'
        + '</div>';
    });
  }

  // 角色分配
  if (result.assignments && result.assignments.length > 0) {
    var gameNames = { 'draw-guess':'你画我猜', 'werewolf':'狼人杀', 'undercover':'谁是卧底', 'turtle-soup':'海龟汤' };
    var gameLabel = gameNames[activity] || activity;
    html += '<div class="friction-header" style="margin-top:14px"><h3>🎭 ' + gameLabel + ' · 谁负责干嘛</h3></div>';
    html += '<div class="friction-role-list">';
    result.assignments.forEach(function (a, i) {
      var avatar = AVATARS[i] || '👤';
      html += '<div class="friction-role-item">'
        + '<div class="friction-role-avatar">' + avatar + '</div>'
        + '<div class="friction-role-info">'
        + '<div class="friction-role-name">' + a.name
        + ' <span class="friction-role-mbti">' + a.mbti + '</span>'
        + ' <span class="friction-role-tag">' + a.role + '</span>'
        + '</div>'
        + '<div class="friction-role-reason">' + a.reason + '</div>'
        + (a.warning ? '<div class="friction-role-warn">' + a.warning + '</div>' : '')
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // 分组建议
  if (result.grouping) {
    html += '<div class="friction-grouping">'
      + '<div class="friction-grouping-title">👥 谁跟谁坐一块</div>'
      + '<div class="friction-grouping-text">' + result.grouping + '</div>'
      + '</div>';
  }

  // 风险提示清单
  if (result.warnings && result.warnings.length > 0) {
    html += '<div class="friction-header" style="margin-top:14px"><h3>📋 提前防一下</h3></div>';
    result.warnings.forEach(function (w) {
      html += '<div class="friction-card risk-high"><div class="friction-card-desc" style="color:var(--ink)">' + w + '</div></div>';
    });
  }

  html += '</div>';

  var wrap = document.getElementById('friction-section-wrap');
  if (wrap) wrap.innerHTML = html;
}

function runRecommendation() {
  const cityData = findCity(state.city);
  const p = buildProfile(state.members);
  /* 没展示过的合规玩法不足 3 个时，重置去重池，保证「换一批」永远有新内容 */
  const eligible = ACTIVITIES.filter(a => state.people >= a.size[0] && state.people <= a.size[1]);
  const unseen = eligible.filter(a => !state.shown.has(a.id)).length;
  if (unseen < 3) state.shown.clear();
  const picks = scoreActivities(p, state.scene, state.people, cityData).slice(0, 3);
  picks.forEach(({ a }) => state.shown.add(a.id));
  renderResult(picks, p, cityData);
}

/* ---------------- 地图 LBS（离线版：仅展示 POI 关键词，用户自行去地图 App 搜索） ---------------- */
function poiKeywords(a) {
  return (a.poi && a.poi.length ? a.poi : (CAT_POI[a.cat] || ['好玩的地方']));
}

function initLbsMap(picks, cityData) {
  const el = document.getElementById('lbs-map');
  if (!el) return;
  const cityName = cityData ? cityData.name : '';
  el.innerHTML =
    '<div class="map-fallback">' +
    '🗺️ 本环境不支持联网地图。下方已列出每个活动的搜索关键词，' +
    '请自行打开高德/百度/腾讯地图 App 搜索对应关键词即可找到附近真实场馆。' +
    (cityName ? `（当前城市：${cityName}）` : '') +
    '</div>';
}

/* ---------------- 加载动画 ---------------- */
function playLoading(done) {
  const overlay = document.getElementById('loading');
  const textEl = document.getElementById('loading-text');
  const emojiEl = document.getElementById('loading-emoji');
  const emojis = ['🌀', '🎲', '🔮', '✨', '🎯'];
  overlay.classList.add('show');
  let i = 0;
  textEl.textContent = LOADING_TEXTS[0];
  const timer = setInterval(() => {
    i++;
    if (i >= LOADING_TEXTS.length) {
      clearInterval(timer);
      overlay.classList.remove('show');
      done();
      return;
    }
    textEl.textContent = LOADING_TEXTS[i];
    emojiEl.textContent = emojis[i % emojis.length];
  }, 480);
}

/* ---------------- 事件绑定 ---------------- */
document.getElementById('btn-start').onclick = () => {
  showScreen('screen-setup');
  updateDecisionSummary();
};
document.getElementById('btn-back-home').onclick = () => showScreen('screen-home');
document.getElementById('btn-back-setup').onclick = () => showScreen('screen-setup');

document.getElementById('btn-minus').onclick = () => {
  if (state.people > 1) setPeople(state.people - 1);
};
document.getElementById('btn-plus').onclick = () => {
  if (state.people < 8) setPeople(state.people + 1);
};

document.getElementById('btn-random').onclick = () => {
  state.members = Array.from({ length: state.people }, () => {
    const roll = Math.random();
    if (roll < 0.08) return null; // 少量随缘
    return MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)].type;
  });
  renderMembers();
  toast('🎲 配好了。就这样吧，挺好的');
};

document.getElementById('input-city').oninput = e => { state.city = e.target.value; updateDecisionSummary(); };

document.getElementById('btn-geo-city').onclick = () => {
  toast('📍 定位能力已下线。直接在上面的框里敲城市名，我一样给你排');
};

document.getElementById('btn-generate').onclick = () => {
  state.city = document.getElementById('input-city').value;
  if (!state.city) { toast('地点空的。填一下。'); return; }
  if (!state.people || state.people < 1) { toast('人数也空的。选一下。'); return; }
  if (!state.scene) { toast('场景还没选。挑一个。'); return; }
  state.game = document.getElementById('input-game').value;
  state.shown.clear();
  playLoading(() => {
    runRecommendation();
    showScreen('screen-result');
    var gameBtn = document.getElementById('btn-open-game');
    if (state.game) {
      gameBtn.style.display = 'block';
      var gameNames = { 'draw-guess':'🎨 你画我猜', 'werewolf':'🐺 简易狼人杀', 'undercover':'🕵️ 谁是卧底', 'turtle-soup':'🐢 海龟汤' };
      gameBtn.textContent = '🎮 开始聚会游戏：' + (gameNames[state.game] || '');
    } else {
      gameBtn.style.display = 'none';
    }
  });
};

document.getElementById('btn-reshuffle').onclick = () => {
  playLoading(() => {
    runRecommendation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('🔄 换好了。这批我挑过');
  });
};

document.getElementById('btn-reedit').onclick = () => showScreen('screen-setup');

/* ---------------- 初始化 ---------------- */
renderCityChips();
renderSceneChips();
renderMembers();

/* =========================================================
   追加：定位板块 —— 已下线（沙箱禁用 navigator.geolocation）
   ========================================================= */
document.getElementById('btn-geo-loc').onclick = function () {
  var result = document.getElementById('geo-result');
  result.innerHTML = '<div class="geo-line geo-error">📡 定位能力在本环境不可用。去组局页手动填城市名，我一样给你排。</div>';
};

/* =========================================================
   追加：联机游戏 —— 与 games.js 联动
   ========================================================= */
// 结果页「开始聚会游戏」按钮
document.getElementById('btn-open-game').onclick = function () {
  if (!state.game) return;
  if (window.GameClient) {
    GameClient.openGame(state.game);
  } else {
    toast('游戏还在加载。等一下，别连点。');
  }
};

// 首页「加入游戏房间」按钮 —— 联机模式已下线，改为提示本地玩法
document.getElementById('btn-join-game').onclick = function () {
  toast('🎮 已改为单设备本地模式：组局时选好游戏，生成方案后点「开始聚会游戏」，大家传着手机轮着玩');
};

// 游戏弹窗关闭
document.getElementById('btn-close-game').onclick = function () {
  document.getElementById('game-modal').classList.remove('show');
  if (window.GameClient) GameClient.onClose();
};
document.getElementById('game-modal').addEventListener('click', function (e) {
  if (e.target === this) {
    this.classList.remove('show');
    if (window.GameClient) GameClient.onClose();
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var modal = document.getElementById('game-modal');
    if (modal.classList.contains('show')) {
      modal.classList.remove('show');
      if (window.GameClient) GameClient.onClose();
    }
  }
});

/* =========================================================
   追加：冷场急救 —— 按钮触发 → 2步筛选 → 游戏卡
   ========================================================= */
var egGroupSize = 0;
var egMobility = 0;
var egTimerInterval = null;

// 急救按钮 → 打开筛选弹窗
document.getElementById('btn-emergency').onclick = function () {
  egGroupSize = 0;
  egMobility = 0;
  // 重置筛选状态
  var filterModal = document.getElementById('emergency-filter-modal');
  filterModal.classList.add('show');
  document.getElementById('ef-step-2').style.display = 'none';
  var opts = filterModal.querySelectorAll('.ef-option');
  opts.forEach(function (el) { el.classList.remove('selected'); });
};

// 筛选弹窗关闭
document.getElementById('btn-close-emergency-filter').onclick = function () {
  document.getElementById('emergency-filter-modal').classList.remove('show');
};
document.getElementById('emergency-filter-modal').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('show');
});

// 筛选选项点击
document.getElementById('emergency-filter-modal').addEventListener('click', function (e) {
  var btn = e.target.closest('.ef-option');
  if (!btn) return;

  if (btn.dataset.group) {
    // 第一步
    egGroupSize = parseInt(btn.dataset.group);
    var step1 = btn.closest('.ef-step');
    step1.querySelectorAll('.ef-option').forEach(function (el) { el.classList.remove('selected'); });
    btn.classList.add('selected');
    // 显示第二步
    document.getElementById('ef-step-2').style.display = 'block';
    document.getElementById('ef-step-2').scrollIntoView({ behavior: 'smooth' });
  }

  if (btn.dataset.mobility) {
    // 第二步
    egMobility = parseInt(btn.dataset.mobility);
    btn.closest('.ef-step').querySelectorAll('.ef-option').forEach(function (el) { el.classList.remove('selected'); });
    btn.classList.add('selected');
    // 关闭筛选弹窗，打开游戏卡
    setTimeout(function () {
      document.getElementById('emergency-filter-modal').classList.remove('show');
      showEmergencyGame();
    }, 300);
  }
});

// 渲染游戏卡
function showEmergencyGame() {
  // 从 MBTI 模块拿数据：I 人是否多
  var iHeavy = false;
  if (state.members && state.members.length > 0) {
    var valid = state.members.filter(function (m) { return m; });
    if (valid.length > 0) {
      var iCount = valid.filter(function (m) { return m.indexOf('I') === 0 || m.indexOf('i') === 0; }).length;
      iHeavy = iCount / valid.length >= 0.5;
    }
  }

  var pick = EmergencyGames.pick(egGroupSize, egMobility, iHeavy);
  if (!pick.main) {
    document.getElementById('emergency-game-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-soft)">这个条件下我没找到合适的游戏。改一下人数或场地，再说一句。</div>';
    document.getElementById('emergency-game-modal').classList.add('show');
    return;
  }

  renderEmergencyGameCard(pick);
  document.getElementById('emergency-game-modal').classList.add('show');
}

function renderEmergencyGameCard(pick) {
  var main = pick.main;
  var alts = pick.alternatives || [];

  var propsText = main.props.length === 0 ? '什么都不用' : main.props.join('、');
  var durNum = parseInt(main.duration) || 5;

  var html = '<div class="eg-main-card">'
    + '<span class="eg-main-badge">主推</span>'
    + '<div class="eg-game-name">' + main.name + '</div>'
    + '<div class="eg-game-tag">' + main.tagline + '</div>'
    + '<div class="eg-info-row">'
    + '<span class="eg-info-chip"><b>人数</b> ' + (main.minPeople === main.maxPeople ? main.minPeople : main.minPeople + '-' + main.maxPeople) + '人</span>'
    + '<span class="eg-info-chip"><b>道具</b> ' + propsText + '</span>'
    + '<span class="eg-info-chip"><b>时长</b> ' + main.duration + '</span>'
    + '</div>'
    + '<div class="eg-section-label">怎么玩</div>'
    + '<ol class="eg-steps">' + main.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>'
    + '<div class="eg-win">🏆 ' + main.winCondition + '</div>'
    + '<div class="eg-host-line">'
    + '<div class="eg-host-label">🎤 主持人开场话术（直接念）</div>'
    + '<div class="eg-host-text">"' + main.hostLine + '"</div>'
    + '</div>'
    + (durNum > 0 ? '<button class="eg-timer-btn" id="eg-timer-btn">⏱️ 开始' + durNum + '分钟倒计时</button><div class="eg-timer-display" id="eg-timer-display" style="display:none"></div>' : '')
    + '</div>';

  // 备选
  if (alts.length > 0) {
    html += '<div class="eg-alts-header">备选（点一下换主推）</div>';
    html += '<div class="eg-alt-list">';
    alts.forEach(function (g) {
      html += '<div class="eg-alt-item" data-game-id="' + g.id + '">'
        + '<div class="eg-alt-info">'
        + '<div class="eg-alt-name">' + g.name + '</div>'
        + '<div class="eg-alt-tag">' + g.tagline + ' · ' + g.duration + '</div>'
        + '</div>'
        + '<span class="eg-alt-swap">换这个 →</span>'
        + '</div>';
    });
    html += '</div>';
    html += '<button class="eg-refresh-btn" id="eg-refresh-btn">🔄 换一批备选</button>';
  }

  document.getElementById('emergency-game-body').innerHTML = html;

  // 绑定倒计时
  var timerBtn = document.getElementById('eg-timer-btn');
  if (timerBtn) {
    timerBtn.onclick = function () {
      if (egTimerInterval) { clearInterval(egTimerInterval); egTimerInterval = null; }
      var display = document.getElementById('eg-timer-display');
      display.style.display = 'block';
      var seconds = durNum * 60;
      timerBtn.textContent = '⏸️ 暂停倒计时';
      function update() {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        display.textContent = m + ':' + (s < 10 ? '0' + s : s);
        if (seconds <= 0) {
          clearInterval(egTimerInterval);
          egTimerInterval = null;
          display.textContent = '⏰ 时间到！';
          timerBtn.textContent = '🔄 重新计时';
          return;
        }
        seconds--;
      }
      update();
      egTimerInterval = setInterval(update, 1000);
      // 切换暂停/恢复
      timerBtn.onclick = function () {
        if (egTimerInterval) {
          clearInterval(egTimerInterval);
          egTimerInterval = null;
          timerBtn.textContent = '▶️ 继续倒计时';
        } else {
          seconds = parseInt(display.textContent.split(':')[0]) * 60 + parseInt(display.textContent.split(':')[1]);
          if (seconds <= 0) seconds = durNum * 60;
          timerBtn.textContent = '⏸️ 暂停倒计时';
          update();
          egTimerInterval = setInterval(update, 1000);
        }
      };
    };
  }

  // 备选 → 换主推
  document.querySelectorAll('.eg-alt-item').forEach(function (el) {
    el.onclick = function () {
      var gameId = el.dataset.gameId;
      var game = EMERGENCY_GAMES.find(function (g) { return g.id === gameId; });
      if (game) {
        var newPick = { main: game, alternatives: [pick.main].concat(pick.alternatives.filter(function (g2) { return g2.id !== game.id; })) };
        renderEmergencyGameCard(newPick);
      }
    };
  });

  // 换一批备选
  var refreshBtn = document.getElementById('eg-refresh-btn');
  if (refreshBtn) {
    refreshBtn.onclick = function () {
      var iHeavy = false;
      if (state.members && state.members.length > 0) {
        var valid = state.members.filter(function (m) { return m; });
        if (valid.length > 0) {
          var iCount = valid.filter(function (m) { return m.indexOf('I') === 0 || m.indexOf('i') === 0; }).length;
          iHeavy = iCount / valid.length >= 0.5;
        }
      }
      var newPick = EmergencyGames.pick(egGroupSize, egMobility, iHeavy);
      renderEmergencyGameCard(newPick);
    };
  }
}

// 游戏卡弹窗关闭
document.getElementById('btn-close-emergency-game').onclick = function () {
  document.getElementById('emergency-game-modal').classList.remove('show');
  if (egTimerInterval) { clearInterval(egTimerInterval); egTimerInterval = null; }
};
document.getElementById('emergency-game-modal').addEventListener('click', function (e) {
  if (e.target === this) {
    this.classList.remove('show');
    if (egTimerInterval) { clearInterval(egTimerInterval); egTimerInterval = null; }
  }
});

/* =========================================================
   追加：一键拍板 + 剧本生成
   ========================================================= */
var currentScript = null;

// 拍板按钮
document.getElementById('btn-decide').onclick = function () {
  // 校验：地点和人数必填
  var city = document.getElementById('input-city').value;
  if (!city) { toast('地点空的。填一下。'); return; }
  if (!state.people || state.people < 1) { toast('人数也空的。选一下。'); return; }

  // 准备输入数据
  var people = [];
  if (state.members && state.members.length > 0) {
    people = state.members.map(function (m, i) {
      return { name: '朋友' + (i + 1), mbti: m || '' };
    });
  }

  var input = {
    people: people,
    count: state.people,
    city: city,
    startTime: '14:00',
    duration: '半天',
    budget: '',
    avoid: [],
    mode: 'random',
  };

  // 过场动画
  var overlay = document.getElementById('script-loading-overlay');
  var textEl = document.getElementById('sl-text');
  overlay.classList.add('show');
  // 强制重排确保 overlay 可见
  void overlay.offsetHeight;

  // 打字机效果
  var phrases = [
    '我正在给你排第 ' + (Math.floor(Math.random() * 98) + 1) + ' 版……',
    '在挑主题，别催……',
    '在分谁负责干嘛……',
    '快好了，最后一步……',
  ];
  var pi = 0;
  var ci = 0;
  textEl.textContent = '';
  function typeWriter() {
    if (pi >= phrases.length) {
      // 多停顿500ms再出结果，确保用户看到了动画
      setTimeout(function () {
        currentScript = ScriptGenerator.generate(input);
        overlay.classList.remove('show');
        renderScript(currentScript);
        showScreen('screen-script');
      }, 500);
      return;
    }
    var phrase = phrases[pi];
    if (ci < phrase.length) {
      textEl.textContent += phrase[ci];
      ci++;
      setTimeout(typeWriter, 80);
    } else {
      pi++;
      ci = 0;
      setTimeout(function () {
        textEl.textContent = '';
        typeWriter();
      }, 400);
    }
  }
  typeWriter();
};

// 从剧本页返回
document.getElementById('btn-back-from-script').onclick = function () {
  showScreen('screen-home');
};

// 渲染剧本
function renderScript(script) {
  var body = document.getElementById('script-body');
  if (!body) return;

  var html = '';

  // 标题卡
  html += '<div class="script-header-card">'
    + '<div class="script-title">' + script.title + '</div>'
    + '<div class="script-oneliner">' + script.oneLiner + '</div>'
    + '<div class="script-meta-row">'
    + '<span class="script-meta-chip">主题：' + script.theme + '</span>'
    + '<span class="script-meta-chip">地点：' + script.meta.city + '</span>'
    + '<span class="script-meta-chip">' + script.meta.startTime + ' - ' + script.meta.endTime + '</span>'
    + '<span class="script-meta-chip">' + script.meta.count + '人</span>'
    + '</div>'
    + '</div>';

  // 时间轴
  html += '<div class="script-timeline">'
    + '<div class="script-tl-title">📅 几点干什么</div>'
    + '<div class="tl-list">';
  script.timeline.forEach(function (t) {
    html += '<div class="tl-item">'
      + '<div class="tl-time">' + t.time + '</div>'
      + '<div class="tl-name">' + t.name + '</div>'
      + '<div class="tl-do">' + t.do + '</div>'
      + '<div class="tl-meta">'
      + '<span class="tl-dur">⏱ ' + t.dur + '</span>'
      + '<span class="tl-need">📦 ' + t.need + '</span>'
      + '</div>'
      + '</div>';
  });
  html += '</div></div>';

  // 暗线安排
  html += '<div class="script-roles">'
    + '<div class="script-roles-header" id="script-roles-header">'
    + '<span class="script-roles-title">🎭 谁负责干嘛（别给他们看）</span>'
    + '<span class="script-roles-toggle">点开看我给你安排的 →</span>'
    + '</div>'
    + '<div class="script-roles-content" id="script-roles-content">';
  script.roles.forEach(function (r) {
    html += '<div class="script-role-item">'
      + '<div class="script-role-name">' + r.name + ' <span class="script-role-mbti">' + r.mbti + '</span></div>'
      + '<div class="script-role-duty">职责：' + r.duty + '</div>'
      + '<div class="script-role-reason">' + r.reason + '</div>'
      + '</div>';
  });
  if (script.protectNotes && script.protectNotes.length > 0) {
    script.protectNotes.forEach(function (n) {
      html += '<div class="script-protect">' + n + '</div>';
    });
  }
  html += '</div></div>';

  // 节目组提示
  html += '<div class="script-host">'
    + '<div class="script-host-title">🎙️ 到时候这么说（直接念，别改）</div>';
  script.hostLines.forEach(function (h) {
    html += '<div class="script-host-card">'
      + '<div class="script-host-scene">[' + h.scene + ']</div>'
      + '<div class="script-host-line">"' + h.line + '"</div>'
      + '<button class="script-host-copy" data-line="' + h.line.replace(/"/g, '&quot;') + '">📋 抄走</button>'
      + '</div>';
  });
  html += '</div>';

  // 分享按钮
  html += '<button class="script-share-btn" id="btn-share-script">📤 发出去（他们总得看一眼）</button>';

  body.innerHTML = html;

  // 绑定暗线折叠
  var rolesHeader = document.getElementById('script-roles-header');
  var rolesContent = document.getElementById('script-roles-content');
  if (rolesHeader) {
    rolesHeader.onclick = function () {
      rolesContent.classList.toggle('show');
      var toggle = rolesHeader.querySelector('.script-roles-toggle');
      if (toggle) {
        toggle.textContent = rolesContent.classList.contains('show') ? '收起来 ↑' : '点开看我给你安排的 →';
      }
    };
  }

  // 绑定「抄走」—— 沙箱禁用 clipboard/execCommand，改用 alert 展示台词供用户长按复制
  body.querySelectorAll('.script-host-copy').forEach(function (btn) {
    btn.onclick = function () {
      var text = btn.dataset.line;
      alert('🎤 主持人台词：\n\n' + text + '\n\n（长按上面的文字可复制）');
    };
  });

  // 绑定分享
  var shareBtn = document.getElementById('btn-share-script');
  if (shareBtn) {
    shareBtn.onclick = function () { showScriptShareCard(script); };
  }
}

// 分享卡弹窗
function showScriptShareCard(script) {
  var body = document.getElementById('script-share-body');
  var card = ScriptGenerator.generateShareCard(script);

  var html = '<div class="script-share-card">'
    + '<span class="ssc-badge">📺 今晚的流程</span>'
    + '<div class="ssc-title">' + card.title + '</div>'
    + '<div class="ssc-oneliner">' + card.oneLiner + '</div>'
    + '<div class="ssc-divider"></div>'
    + '<div class="ssc-row"><span class="ssc-label">参与者</span><span class="ssc-val">' + card.participants + '</span></div>'
    + '<div class="ssc-row"><span class="ssc-label">时间</span><span class="ssc-val">' + card.timeRange + '</span></div>'
    + '<div class="ssc-divider"></div>'
    + '<div class="ssc-timeline">';
  card.timeline.forEach(function (t) {
    html += t + '<br>';
  });
  html += '</div>'
    + '<div class="ssc-footer">聚了吗？｜我排的</div>'
    + '</div>';

  body.innerHTML = html;
  document.getElementById('script-share-modal').classList.add('show');
}

// 分享卡关闭
document.getElementById('btn-close-script-share').onclick = function () {
  document.getElementById('script-share-modal').classList.remove('show');
};
document.getElementById('script-share-modal').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('show');
});
