/* =========================================================
   聚了吗？—— MBTI 社交摩擦预判引擎
   三层分析：单个人角色标签 → 组合摩擦风险 → 可执行安排
   严格按规则实现，不自由发挥
   ========================================================= */

/**
 * MBTI 容错解析
 * 支持：大小写不统一、"-A"/"-T" 后缀、部分填写（如 "I" 或 "INF"）
 * @param {string} raw - 原始输入
 * @returns {{ type: string, dims: {e,i,n,s,t,f,j,p}, full: boolean, valid: boolean }}
 */
function parseMBTI(raw) {
  if (!raw || typeof raw !== 'string') return { type: '', dims: null, full: false, valid: false };
  // 去空格、转大写、去 -A/-T 后缀
  var s = raw.trim().toUpperCase().replace(/[-_]?(A|T)$/, '');
  // 提取有效字母
  var letters = s.replace(/[^EIFTNSP]/g, '');
  if (letters.length === 0) return { type: '', dims: null, full: false, valid: false };

  var dims = { e: .5, i: .5, n: .5, s: .5, t: .5, f: .5, j: .5, p: .5 };

  // 从完整类型中解析维度
  if (letters.length >= 4) {
    // 尝试取前4个有效字母作为完整类型
    var type = '';
    var seen = {};
    var order = [];
    for (var k = 0; k < letters.length; k++) {
      if (!seen[letters[k]]) { seen[letters[k]] = true; order.push(letters[k]); }
    }
    // 标准MBTI: E/I, N/S, T/F, J/P
    var hasE = letters.indexOf('E') >= 0;
    var hasI = letters.indexOf('I') >= 0;
    var hasN = letters.indexOf('N') >= 0;
    var hasS = letters.indexOf('S') >= 0;
    var hasT = letters.indexOf('T') >= 0;
    var hasF = letters.indexOf('F') >= 0;
    var hasJ = letters.indexOf('J') >= 0;
    var hasP = letters.indexOf('P') >= 0;

    if (hasE) { dims.e = 1; dims.i = 0; }
    if (hasI) { dims.e = 0; dims.i = 1; }
    if (hasN) { dims.n = 1; dims.s = 0; }
    if (hasS) { dims.n = 0; dims.s = 1; }
    if (hasT) { dims.t = 1; dims.f = 0; }
    if (hasF) { dims.t = 0; dims.f = 1; }
    if (hasJ) { dims.j = 1; dims.p = 0; }
    if (hasP) { dims.j = 0; dims.p = 1; }

    // 构造标准类型字符串
    type = (hasE ? 'E' : (hasI ? 'I' : 'E')) +
           (hasN ? 'N' : (hasS ? 'S' : 'N')) +
           (hasT ? 'T' : (hasF ? 'F' : 'T')) +
           (hasJ ? 'J' : (hasP ? 'P' : 'J'));

    return { type: type, dims: dims, full: true, valid: true };
  }

  // 部分填写：只识别已有维度
  if (letters.indexOf('E') >= 0) { dims.e = 1; dims.i = 0; }
  if (letters.indexOf('I') >= 0) { dims.e = 0; dims.i = 1; }
  if (letters.indexOf('N') >= 0) { dims.n = 1; dims.s = 0; }
  if (letters.indexOf('S') >= 0) { dims.n = 0; dims.s = 1; }
  if (letters.indexOf('T') >= 0) { dims.t = 1; dims.f = 0; }
  if (letters.indexOf('F') >= 0) { dims.t = 0; dims.f = 1; }
  if (letters.indexOf('J') >= 0) { dims.j = 1; dims.p = 0; }
  if (letters.indexOf('P') >= 0) { dims.j = 0; dims.p = 1; }

  return { type: letters, dims: dims, full: false, valid: true };
}

/**
 * 第一层：单个人 → 角色标签
 */
function getPersonTags(parsed) {
  if (!parsed.valid || !parsed.dims) return [];
  var d = parsed.dims;
  var tags = [];
  if (d.i > d.e) tags.push({ key: 'I', label: '内向', desc: '不主动发起互动、大群体中易沉默、讨厌被临时点名表演' });
  if (d.e > d.i) tags.push({ key: 'E', label: '外向', desc: '主动破冰、喜欢表达、能带动气氛' });
  if (d.j > d.p) tags.push({ key: 'J', label: '判断', desc: '需要明确的流程和时间安排，讨厌"随便"' });
  if (d.p > d.j) tags.push({ key: 'P', label: '知觉', desc: '随性、讨厌被催、临时改计划反而开心' });
  if (d.t > d.f) tags.push({ key: 'T', label: '思维', desc: '对话偏理性、可能对情绪化表达不耐烦' });
  if (d.f > d.t) tags.push({ key: 'F', label: '情感', desc: '重视氛围和谐、对冲突敏感' });
  if (d.s > d.n) tags.push({ key: 'S', label: '实感', desc: '喜欢具体、看得见的活动' });
  if (d.n > d.s) tags.push({ key: 'N', label: '直觉', desc: '喜欢有脑洞、有反转的活动' });
  return tags;
}

/**
 * 第二层：组合 → 摩擦风险
 */
function detectRisks(participants, activity, scene) {
  var parsed = participants.map(function (p) {
    var pr = parseMBTI(p.mbti);
    return { name: p.name, mbti: p.mbti, note: p.note || '', parsed: pr, tags: getPersonTags(pr) };
  });

  var risks = [];
  var n = parsed.length;
  if (n === 0) return { risks: [], parsed: parsed };

  // 风险1：沉默风险（I 人占比 ≥ 50%）
  var iCount = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.i > p.parsed.dims.e; }).length;
  if (n > 1 && iCount / n >= 0.5) {
    var iNames = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.i > p.parsed.dims.e; })
      .map(function (p) { return p.name + '(' + (p.parsed.type || p.mbti) + ')'; });
    risks.push({
      level: iCount / n >= 0.75 ? '高' : '中',
      type: 'silence',
      title: '沉默风险（冷场来源）',
      desc: n + '人里有 ' + iCount + ' 个 I 人（' + iNames.join('、') + '），整体偏安静，更容易冷场',
      action: '减少需要当众发言的环节，设计"不依赖发言"的活动（如画牌、动作类、并行操作）',
      names: iNames
    });
  }

  // 风险2：表演压力风险
  var perfActivities = {
    'draw-guess': { role: '表演方/画的人', safeRole: '猜词方/计分方' },
    'werewolf': { role: '首轮发言', safeRole: '后排发言/记录' },
    'turtle-soup': { role: '提问方/出题方', safeRole: '记录人/旁观推理' },
    'undercover': { role: '首轮描述', safeRole: '后排描述/投票' }
  };
  if (perfActivities[activity]) {
    var pa = perfActivities[activity];
    var iPersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.i > p.parsed.dims.e; });
    iPersons.forEach(function (p) {
      risks.push({
        level: '高',
        type: 'performance-pressure',
        title: '表演压力风险',
        desc: '⚠️ ' + p.name + '(' + (p.parsed.type || p.mbti) + ') 是 I 人，被安排进需要"上台/被围观/即兴表演"的角色（' + pa.role + '）容易尴尬',
        action: '建议安排为"' + pa.safeRole + '"角色，不要让他当众表演',
        names: [p.name + '(' + (p.parsed.type || p.mbti) + ')']
      });
    });
  }

  // 风险3：节奏冲突风险（J 与 P 各占 40%-60%）
  var jCount = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.j > p.parsed.dims.p; }).length;
  var pCount = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.p > p.parsed.dims.j; }).length;
  if (n > 1) {
    var jRatio = jCount / n;
    var pRatio = pCount / n;
    if (jRatio >= 0.4 && jRatio <= 0.6 && pRatio >= 0.4 && pRatio <= 0.6) {
      var jNames = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.j > p.parsed.dims.p; })
        .map(function (p) { return p.name + '(' + (p.parsed.type || p.mbti) + ')'; });
      var pNames = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.p > p.parsed.dims.j; })
        .map(function (p) { return p.name + '(' + (p.parsed.type || p.mbti) + ')'; });
      risks.push({
        level: '中',
        type: 'pace-conflict',
        title: '节奏冲突风险',
        desc: 'J 人(' + jNames.join('、') + ') 要流程，P 人(' + pNames.join('、') + ') 要随性，两边都不少',
        action: '流程别排太死，也别完全没安排，建议"主线固定 + 环节留白"',
        names: jNames.concat(pNames)
      });
    }
  }

  // 风险4：情绪摩擦风险（同时存在 T 和 F，且活动含竞争/评价）
  var tPersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.t > p.parsed.dims.f; });
  var fPersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.f > p.parsed.dims.t; });
  var competitiveActivities = ['draw-guess', 'werewolf', 'undercover'];
  if (tPersons.length > 0 && fPersons.length > 0 && competitiveActivities.indexOf(activity) >= 0) {
    var tNames = tPersons.map(function (p) { return p.name + '(' + (p.parsed.type || p.mbti) + ')'; });
    var fNames = fPersons.map(function (p) { return p.name + '(' + (p.parsed.type || p.mbti) + ')'; });
    risks.push({
      level: '中',
      type: 'emotional-friction',
      title: '情绪摩擦风险',
      desc: 'T 人(' + tNames.join('、') + ') 对话偏理性，F 人(' + fNames.join('、') + ') 对冲突敏感，活动含竞争/评价',
      action: '避免让 T 人直接评价 F 人的表现，判分环节让 T 人做、鼓励环节让 F 人做',
      names: tNames.concat(fNames)
    });
  }

  // 总体风险等级
  var highCount = risks.filter(function (r) { return r.level === '高'; }).length;
  var medCount = risks.filter(function (r) { return r.level === '中'; }).length;
  var overall = '低';
  if (highCount >= 1) overall = '高';
  else if (medCount >= 1) overall = '中';

  return { risks: risks, overall: overall, parsed: parsed };
}

/**
 * 第三层A：角色分配（针对当前活动）
 */
function assignRoles(parsed, activity) {
  var ACTIVITY_ROLES = {
    'draw-guess': ['画的人', '猜的人', '计时的人', '计分的人'],
    'werewolf': ['主持人', '玩家', '玩家', '玩家'],
    'turtle-soup': ['出题人', '提问人', '记录人', '旁观人'],
    'undercover': ['描述人', '描述人', '投票人', '投票人'],
  };

  var roles = ACTIVITY_ROLES[activity];
  if (!roles) return parsed.map(function (p) {
    return { name: p.name, mbti: p.parsed.type || p.mbti, role: '自由参与', reason: '', warning: '' };
  });

  var assignments = [];
  var usedRoles = {};
  var remaining = parsed.slice();

  // 优先级 1：E+J → 主持 / 流程推进
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.e > d.i && d.j > d.p) {
      var role = roles[0] || '参与者';
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'E+J，适合主持和流程推进', warning: ''
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 优先级 2：I 人 → 猜 / 答 / 记录 / 计时（不要当众表演）
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.i > d.e) {
      // 找一个安全的角色
      var safeRoles = {
        'draw-guess': ['猜的人', '计分的人', '计时的人'],
        'werewolf': ['玩家'],
        'turtle-soup': ['记录人', '旁观人'],
        'undercover': ['投票人'],
      };
      var candidates = (safeRoles[activity] || roles).filter(function (r) { return !usedRoles[r]; });
      var role = candidates[0] || (roles.filter(function (r) { return !usedRoles[r]; })[0]) || '参与者';
      var warn = '';
      if (activity === 'draw-guess' && role === '画的人') {
        warn = '⚠️ I人不宜当表演方，已调整为猜的一方';
      }
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'I人，安排为"' + role + '"避免当众表演', warning: warn
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 优先级 3：N 人 → 适合有脑洞的角色
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.n > d.s) {
      var brainRoles = {
        'draw-guess': ['猜的人'],
        'turtle-soup': ['提问人'],
        'undercover': ['描述人'],
        'werewolf': ['玩家'],
      };
      var candidates = (brainRoles[activity] || roles).filter(function (r) { return !usedRoles[r]; });
      var role = candidates[0] || (roles.filter(function (r) { return !usedRoles[r]; })[0]) || '参与者';
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'N人，适合有脑洞的角色（' + role + '）', warning: ''
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 优先级 4：S 人 → 适合具体明确的角色
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.s > d.n) {
      var concreteRoles = {
        'draw-guess': ['计时的人', '计分的人'],
        'werewolf': ['玩家'],
        'turtle-soup': ['记录人'],
        'undercover': ['投票人'],
      };
      var candidates = (concreteRoles[activity] || roles).filter(function (r) { return !usedRoles[r]; });
      var role = candidates[0] || (roles.filter(function (r) { return !usedRoles[r]; })[0]) || '参与者';
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'S人，适合具体明确的角色（' + role + '）', warning: ''
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 优先级 5：T 人 → 适合判分、当裁判
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.t > d.f) {
      var judgeRoles = {
        'draw-guess': ['计分的人'],
        'werewolf': ['主持人', '玩家'],
        'turtle-soup': ['记录人'],
        'undercover': ['投票人'],
      };
      var candidates = (judgeRoles[activity] || roles).filter(function (r) { return !usedRoles[r]; });
      var role = candidates[0] || (roles.filter(function (r) { return !usedRoles[r]; })[0]) || '参与者';
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'T人，适合判分/裁判角色（' + role + '）', warning: ''
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 优先级 6：F 人 → 适合照顾气氛、鼓励他人
  for (var i = 0; i < remaining.length; i++) {
    var p = remaining[i];
    if (!p.parsed.valid) continue;
    var d = p.parsed.dims;
    if (d.f > d.t) {
      var warmRoles = {
        'draw-guess': ['猜的人'],
        'werewolf': ['玩家'],
        'turtle-soup': ['提问人'],
        'undercover': ['描述人'],
      };
      var candidates = (warmRoles[activity] || roles).filter(function (r) { return !usedRoles[r]; });
      var role = candidates[0] || (roles.filter(function (r) { return !usedRoles[r]; })[0]) || '参与者';
      assignments.push({
        name: p.name, mbti: p.parsed.type || p.mbti,
        role: role, reason: 'F人，适合照顾气氛/鼓励他人（' + role + '）', warning: ''
      });
      usedRoles[role] = true;
      remaining.splice(i, 1);
      i--;
    }
  }

  // 剩余的人（未填 MBTI 或维度不明显）
  remaining.forEach(function (p) {
    var role = roles.filter(function (r) { return !usedRoles[r]; })[0] || '参与者';
    assignments.push({
      name: p.name, mbti: p.parsed.type || p.mbti || '未填',
      role: role, reason: '自由分配', warning: ''
    });
    usedRoles[role] = true;
  });

  return assignments;
}

/**
 * 第三层B：分组/座位建议
 */
function suggestGrouping(parsed, participants) {
  var n = parsed.length;
  var ePersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.e > p.parsed.dims.i; });
  var iPersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.i > p.parsed.dims.e; });

  if (n < 6) {
    if (ePersons.length > 0 && iPersons.length > 0) {
      // 互相不熟的人拆开、与 E 人搭配
      var notClose = participants.filter(function (p) { return p.note && p.note.indexOf('不熟') >= 0; });
      if (notClose.length > 0) {
        return '互相不熟的人拆开坐，和 E 人(' + ePersons.map(function (p) { return p.name; }).join('、') + ')搭配，帮忙破冰';
      }
      return '人数不多不用拆组，让 E 人(' + ePersons.map(function (p) { return p.name; }).join('、') + ')挨着 I 人坐，自然带聊';
    }
    if (iPersons.length === n && n > 1) {
      return '全员 I 人，别强求热聊，安排平行活动（如各自画画、一起看片），有话聊就聊、没话也不尴尬';
    }
    return '人数不多，自由就座即可';
  }

  // 人数 ≥ 6：建议拆 2 组
  if (ePersons.length >= 2) {
    var groupLeaders = ePersons.slice(0, 2).map(function (p) { return p.name; });
    return '建议分成 2 组，E 人 ' + groupLeaders.join(' 和 ') + ' 分任组长，把 I 人均匀拆到两组，不熟的别放一组';
  }
  if (ePersons.length === 1) {
    return '建议分成 2 组，只有 1 个 E 人(' + ePersons[0].name + ')，让 ta 带人数多的那组，另一组安排最外向的 I 人牵头';
  }
  return '全员 I 人，建议分成 2 组各玩各的，别强求大群互动，每组安排结构化任务（如比赛制）减少尬聊';
}

/**
 * 第三层C：风险提示清单（面向组织者，语气直白、具体）
 */
function buildWarnings(parsed, participants) {
  var warnings = [];

  // 找性格反差大的组合
  for (var i = 0; i < parsed.length; i++) {
    for (var j = i + 1; j < parsed.length; j++) {
      var a = parsed[i], b = parsed[j];
      if (!a.parsed.valid || !b.parsed.valid) continue;
      var da = a.parsed.dims, db = b.parsed.dims;
      var diff = 0;
      if (da.e > da.i && db.i > db.e) diff++;
      if (da.i > da.e && db.e > db.i) diff++;
      if (da.j > da.p && db.p > db.j) diff++;
      if (da.p > da.j && db.j > db.p) diff++;
      if (da.t > da.f && db.f > db.t) diff++;
      if (da.f > db.t && db.t > db.f) diff++;
      if (diff >= 3) {
        warnings.push('⚠️ ' + a.name + '(' + (a.parsed.type || a.mbti) + ') 和 ' + b.name + '(' + (b.parsed.type || b.mbti) + ') 性格反差大，别安排坐一起做需要商量的任务');
      }
    }
  }

  // 不熟的人搭配
  var notClose = participants.filter(function (p) { return p.note && p.note.indexOf('不熟') >= 0; });
  if (notClose.length > 0) {
    var ePersons = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.e > p.parsed.dims.i; });
    if (ePersons.length > 0) {
      warnings.push('📌 ' + notClose.map(function (p) { return p.name; }).join('、') + ' 标注了"不太熟"，安排和 E 人(' + ePersons.map(function (p) { return p.name; }).join('或') + ')同组，有人带聊不会尬');
    }
  }

  return warnings;
}

/**
 * 主入口：生成完整的摩擦预判报告
 * @param {Object} input - { participants: [{name, mbti, note}], activity, scene }
 * @returns {Object} - { overallRisk, summary, assignments, warnings, grouping }
 */
function analyzeSocialFriction(input) {
  var participants = input.participants || [];
  var activity = input.activity || '';
  var scene = input.scene || '';

  var result = detectRisks(participants, activity, scene);
  var parsed = result.parsed;
  var risks = result.risks;

  // 角色分配
  var assignments = assignRoles(parsed, activity);

  // 分组建议
  var grouping = suggestGrouping(parsed, participants);

  // 风险提示清单
  var warnings = buildWarnings(parsed, participants);

  // 摘要
  var n = participants.length;
  var iCount = parsed.filter(function (p) { return p.parsed.valid && p.parsed.dims && p.parsed.dims.i > p.parsed.dims.e; }).length;
  var summary = n + '人' + (iCount > 0 ? '里有' + iCount + '个I人' : '') + '，';
  if (result.overall === '高') {
    summary += '社交风险较高，' + (iCount >= n * 0.5 ? '整体偏安静，建议减少需要当众发言的环节。' : '需要注意角色分配和节奏把控。');
  } else if (result.overall === '中') {
    summary += '有一定社交摩擦风险，注意角色搭配和流程节奏。';
  } else {
    summary += '社交风险低，大家基本能自洽，正常玩就行。';
  }

  return {
    overallRisk: result.overall,
    summary: summary,
    assignments: assignments,
    warnings: warnings,
    grouping: grouping,
    risks: risks
  };
}

/* 暴露到全局 */
window.MBTIAnalyzer = {
  parseMBTI: parseMBTI,
  analyzeSocialFriction: analyzeSocialFriction,
};
