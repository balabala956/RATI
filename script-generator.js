/* =========================================================
   聚了吗？—— 聚会剧本生成引擎
   生成流程骨架+暗线角色+节目组提示，不生成台词对话
   ========================================================= */

/* ===================== 主题池 ===================== */
var SCRIPT_THEMES = [
  {
    id: 'brain',
    name: '轻度走脑',
    themes: ['不逛街挑战·脑力版', '今天谁都别想安静·推理场', '桌游降智大赛'],
    segments: [
      { name: '集合·拍开场', do: '约在咖啡馆/奶茶店集合，先拍一张全员合照当片头', dur: 15, need: '手机一个' },
      { name: '环节一·桌游开局', do: '用手机搜附近的桌游店，选一个评分高的直接去，推荐玩策略类或欢乐类桌游', dur: 90, need: '手机一个' },
      { name: '转场·找吃的', do: '从桌游店走到附近小吃街，边走边聊，找个评价不错的小店', dur: 20, need: '无' },
      { name: '环节二·边吃边推理', do: '饭桌上玩两真一假或数字炸弹（冷场急救里有），不用道具', dur: 45, need: '无' },
      { name: '环节三·复盘局', do: '找个安静的甜品店或便利店门口坐着，每人说一件今天最离谱的事，投票最佳', dur: 30, need: '无' },
    ],
  },
  {
    id: 'hands-on',
    name: '动手类',
    themes: ['手工硬核局', '今天不逛街·做饭版', '手残党也有春天'],
    segments: [
      { name: '集合·拍开场', do: '约在地铁站口集合，先拍一张全员合照当片头', dur: 15, need: '手机一个' },
      { name: '环节一·买食材', do: '去最近的菜市场或超市，分工买食材，每人负责一道菜的材料', dur: 30, need: '手机付款' },
      { name: '环节二·一起做饭', do: '去其中一个人家（或租厨房），每人做一道菜，不会做的现场搜教程', dur: 90, need: '厨房+食材' },
      { name: '环节三·盲品评奖', do: '全员盲品每道菜打分，最高分的菜授予"今日厨神"称号（不用道具，手机记分）', dur: 30, need: '手机记分' },
      { name: '环节四·复盘拍照', do: '把成品摆一桌拍个合照，配上"今日米其林"滤镜发群里', dur: 15, need: '手机一个' },
    ],
  },
  {
    id: 'outdoor',
    name: '户外轻运动',
    themes: ['武汉半日游·硬核版', '不坐车的City Walk', '阳光限额·出门版'],
    segments: [
      { name: '集合·拍开场', do: '约在公园入口或地标集合，先拍一张全员合照当片头', dur: 15, need: '手机一个' },
      { name: '环节一·City Walk', do: '沿一条有意思的街道走，规定沿途每人拍一张"最离谱的东西"', dur: 60, need: '手机一个' },
      { name: '转场·找歇脚点', do: '走到一个咖啡馆或便利店，歇脚补水', dur: 15, need: '无' },
      { name: '环节二·照片盲选', do: '把刚才拍的照片传到群里，每人选一张别人的"最离谱"投票，票最高的赢', dur: 30, need: '手机一个' },
      { name: '环节三·找吃的收尾', do: '走到附近评价好的馆子，边吃边聊今天的"最离谱"发现', dur: 45, need: '无' },
    ],
  },
  {
    id: 'indoor-social',
    name: '室内社交',
    themes: ['不逛街挑战', '今天谁都别想安静', '奶茶克星·室内版'],
    segments: [
      { name: '集合·拍开场', do: '约在其中一个朋友家或轰趴馆集合，先拍一张全员合照当片头', dur: 15, need: '手机一个' },
      { name: '环节一·你画我猜', do: '打开网页自带的你画我猜插件，画的人画手机上猜的人猜，轮着来', dur: 45, need: '手机一个' },
      { name: '环节二·海龟汤', do: '打开网页自带的海龟汤插件，主持人出题大家提问', dur: 45, need: '手机一个' },
      { name: '转场·点外卖', do: '边玩边点外卖，选一个大家都没异议的品类', dur: 10, need: '手机付款' },
      { name: '环节三·狼人杀', do: '吃饱了玩一把狼人杀收尾，用网页自带的狼人杀插件', dur: 60, need: '手机一个' },
    ],
  },
  {
    id: 'chill',
    name: '纯放松',
    themes: ['今天谁都别想卷', '公园躺平局', '不安排就是最好的安排'],
    segments: [
      { name: '集合·拍开场', do: '约在公园或咖啡馆集合，先拍一张全员合照当片头', dur: 15, need: '手机一个' },
      { name: '环节一·找位置', do: '在公园找个舒服的草地或长椅，铺好坐垫坐下来', dur: 15, need: '坐垫或报纸' },
      { name: '环节二·闲聊局', do: '用"两真一假"或"我有你没有"破冰（冷场急救里有），不用道具', dur: 45, need: '无' },
      { name: '转场·买吃的', do: '去附近的便利店买零食饮料，每人选一样', dur: 15, need: '手机付款' },
      { name: '环节三·躺平收尾', do: '边吃边聊，拍一张"躺平照"当片尾，配上"本期完"字样', dur: 30, need: '手机一个' },
    ],
  },
];

/* ===================== 工具函数 ===================== */
function sgShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function sgPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* MBTI 容错解析（复用 mbti-analyzer 的逻辑，独立实现避免依赖） */
function sgParseMBTI(raw) {
  if (!raw || typeof raw !== 'string') return { type: '', isI: false, isE: false, isJ: false, isP: false, isT: false, isF: false, isN: false, isS: false, valid: false };
  var s = raw.trim().toUpperCase().replace(/[-_]?(A|T)$/, '');
  var letters = s.replace(/[^EIFTNSP]/g, '');
  if (letters.length === 0) return { type: '', valid: false };
  return {
    type: letters,
    isI: letters.indexOf('I') >= 0, isE: letters.indexOf('E') >= 0,
    isN: letters.indexOf('N') >= 0, isS: letters.indexOf('S') >= 0,
    isT: letters.indexOf('T') >= 0, isF: letters.indexOf('F') >= 0,
    isJ: letters.indexOf('J') >= 0, isP: letters.indexOf('P') >= 0,
    valid: true,
  };
}

/* 时间计算 */
function sgAddMinutes(timeStr, mins) {
  var parts = timeStr.split(':');
  var h = parseInt(parts[0]);
  var m = parseInt(parts[1]);
  var total = h * 60 + m + mins;
  var nh = Math.floor(total / 60) % 24;
  var nm = total % 60;
  return (nh < 10 ? '0' + nh : nh) + ':' + (nm < 10 ? '0' + nm : nm);
}

/* 时长解析为分钟 */
function sgParseDuration(d) {
  if (!d) return 240; // 默认4小时
  if (d.indexOf('半天') >= 0 || d.indexOf('半日') >= 0) return 240;
  if (d.indexOf('全天') >= 0 || d.indexOf('一天') >= 0) return 480;
  if (d.indexOf('小时') >= 0) {
    var m = d.match(/(\d+)\s*小时/);
    if (m) return parseInt(m[1]) * 60;
  }
  var m2 = d.match(/(\d+)/);
  if (m2) return parseInt(m2[1]) * 60;
  return 240;
}

/* ===================== 主生成函数 ===================== */
function generateScript(input) {
  var people = (input.people || []).map(function (p, i) {
    var parsed = sgParseMBTI(p.mbti);
    return { name: p.name || ('朋友' + (i + 1)), mbti: p.mbti || '', parsed: parsed };
  });
  var count = input.count || people.length || 4;
  var city = input.city || '本地';
  var startTime = input.startTime || '14:00';
  var duration = input.duration || '半天';
  var budget = input.budget || '';
  var avoid = input.avoid || [];
  var mode = input.mode || 'random';
  var themeChoice = input.themeChoice || null;

  // 1. 选主题
  var themeObj;
  if (mode === 'pick' && themeChoice) {
    themeObj = SCRIPT_THEMES.find(function (t) { return t.id === themeChoice; }) || sgPick(SCRIPT_THEMES);
  } else {
    themeObj = sgPick(SCRIPT_THEMES);
  }

  // 2. 选主题名
  var themeName = sgPick(themeObj.themes);
  // 如果城市不是"本地"，把城市名加进去
  if (city !== '本地' && themeName.indexOf('武汉') >= 0) {
    themeName = themeName.replace('武汉', city);
  } else if (city !== '本地' && Math.random() > 0.5) {
    themeName = city + '·' + themeName;
  }

  // 3. 生成期数
  var episodeNum = Math.floor(Math.random() * 98) + 1;
  var title = '《' + themeName + ' · 第 ' + episodeNum + ' 版》';

  // 4. 一句话
  var oneLiners = [
    '今天的目标：不把这次聚成喝奶茶。',
    '今天不逛街。今天我说了算。',
    '今天的任务：让所有人笑到肚子疼，笑不出来算我输。',
    '今天谁先摸手机谁请客，我说真的。',
    '今天的规则：没有规则。跟着我给的流程走就行。',
    '今天的 KPI：拍出 3 张能发朋友圈的照片，不然白聚。',
  ];
  var oneLiner = sgPick(oneLiners);

  // 5. 构建时间轴
  var totalMinutes = sgParseDuration(duration);
  var segments = themeObj.segments.slice();
  // 去掉超过总时长的环节
  var timeline = [];
  var currentTime = startTime;
  var usedMinutes = 0;

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (usedMinutes + seg.dur > totalMinutes) {
      // 调整最后一个环节的时长
      var remaining = totalMinutes - usedMinutes;
      if (remaining >= 15) {
        timeline.push({
          time: currentTime,
          name: seg.name,
          do: seg.do,
          dur: remaining + '分钟',
          need: seg.need,
        });
        usedMinutes += remaining;
        currentTime = sgAddMinutes(currentTime, remaining);
      }
      break;
    }
    timeline.push({
      time: currentTime,
      name: seg.name,
      do: seg.do,
      dur: seg.dur + '分钟',
      need: seg.need,
    });
    usedMinutes += seg.dur;
    currentTime = sgAddMinutes(currentTime, seg.dur);
  }

  // 6. 暗线角色分配
  var roles = [];
  var protectNotes = [];

  // 准备角色池
  var duties = ['看时间 + 记东西', '接话 + 带气氛', '拍照 + 发群里', '推流程 + 催人'];
  var dutyReasons = {
    '看时间 + 记东西': '偏内向或 J 人，适合干有条理的事',
    '接话 + 带气氛': 'E 人，能主动破冰，气氛靠他',
    '拍照 + 发群里': 'S 人，盯着看得见摸得着的事',
    '推流程 + 催人': 'J 人，需要明确的流程和时间，不然他会难受',
  };

  people.forEach(function (p, i) {
    var duty, reason;
    var pr = p.parsed;

    if (!pr.valid) {
      // 没填 MBTI 的人
      duty = duties[i % duties.length];
      reason = '没填性格。随便分，有事我担着';
    } else if (pr.isI && !pr.isE) {
      duty = '看时间 + 记东西';
      reason = '偏内向。别点名让他表演，他会记仇';
      protectNotes.push('⚠️ ' + p.name + '（' + (pr.type || p.mbti) + '）让他记时间、记东西，别把他推出去表演');
    } else if (pr.isE && !pr.isI) {
      if (pr.isJ) {
        duty = '推流程 + 催人';
        reason = 'E + J，适合当主持、推流程';
      } else {
        duty = '接话 + 带气氛';
        reason = 'E 人，能主动破冰，气氛靠他';
      }
    } else if (pr.isS && !pr.isN) {
      duty = '拍照 + 发群里';
      reason = 'S 人，爱看具体的实物，拍照交给他';
    } else if (pr.isJ && !pr.isP) {
      duty = '推流程 + 催人';
      reason = 'J 人，得有明确流程和时间，他才安心';
    } else if (pr.isF && !pr.isT) {
      duty = '接话 + 带气氛';
      reason = 'F 人，会照顾气氛，也愿意哄人';
    } else if (pr.isT && !pr.isF) {
      duty = '看时间 + 记东西';
      reason = 'T 人，判分客观，记账不会赖';
    } else if (pr.isN && !pr.isS) {
      duty = '接话 + 带气氛';
      reason = 'N 人，脑洞大，接话能把场子带起来';
    } else {
      duty = duties[i % duties.length];
      reason = '维度不明显。随便分，不行再换';
    }

    // 如果 T 和 F 同时在场，加情绪摩擦提示
    roles.push({
      name: p.name,
      mbti: pr.type || p.mbti || '未填',
      duty: duty,
      reason: reason,
    });
  });

  // 情绪摩擦检测
  var tPersons = people.filter(function (p) { return p.parsed.valid && p.parsed.isT && !p.parsed.isF; });
  var fPersons = people.filter(function (p) { return p.parsed.valid && p.parsed.isF && !p.parsed.isT; });
  if (tPersons.length > 0 && fPersons.length > 0) {
    var tName = tPersons[0].name;
    var fName = fPersons[0].name;
    protectNotes.push('⚠️ ' + tName + '（T 型）和 ' + fName + '（F 型）都在。别让 ' + tName + ' 当面评价 ' + fName + ' 干得怎么样');
  }

  // 如果没有人员，降级处理
  if (people.length === 0) {
    roles.push({ name: '组织者', mbti: '未提供', duty: '全流程推进', reason: '没人填信息。那只能你自己全干了' });
  }

  // 7. 节目组提示
  var hostLines = [
    { scene: '开场', line: '来，今天这局叫"' + themeName + '"。先拍张合照，所有人看镜头。' },
    { scene: '切环节', line: '这环节完了，走，去下一站。跟紧，别自己走丢了。' },
    { scene: '救场', line: '聊干了？点页面上的「冷场了，救我」，30 秒就能拉回来。' },
  ];
  // 额外切环节提示
  if (timeline.length > 2) {
    hostLines.splice(1, 0, { scene: '切环节', line: '第一个环节结束了，换场子。路上别散开。' });
  }

  // 8. 构建 oneLiner
  var cityPart = city !== '本地' ? city : '';
  oneLiner = oneLiner.replace('{city}', cityPart);

  return {
    title: title,
    theme: themeObj.name,
    themeId: themeObj.id,
    oneLiner: oneLiner,
    timeline: timeline,
    roles: roles,
    protectNotes: protectNotes,
    hostLines: hostLines,
    meta: {
      city: city,
      startTime: startTime,
      duration: duration,
      endTime: timeline.length > 0 ? sgAddMinutes(timeline[timeline.length - 1].time, parseInt(timeline[timeline.length - 1].dur)) : startTime,
      count: count,
    },
  };
}

/* 生成分享卡数据（精简版） */
function generateShareCard(script) {
  return {
    title: script.title,
    theme: script.theme,
    oneLiner: script.oneLiner,
    participants: script.roles.map(function (r) { return r.name; }).join('、'),
    timeRange: script.meta.startTime + ' - ' + script.meta.endTime,
    timeline: script.timeline.map(function (t) { return t.time + ' ' + t.name; }),
  };
}

window.ScriptGenerator = {
  themes: SCRIPT_THEMES,
  generate: generateScript,
  generateShareCard: generateShareCard,
};
