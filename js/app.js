/* =====================================================
   网剧编剧制作小组 · 协作工作台
   纯前端单页应用，数据保存在浏览器 localStorage
   ===================================================== */

(function () {
  "use strict";

  /* ---------- 常量 ---------- */
  const STORAGE_KEY = "webdrama_writers_room_v1";

  const ROLES = [
    "总编剧", "编剧", "助理编剧", "剧本统筹", "责任编辑",
    "制片人", "导演", "审核人"
  ];

  const SCRIPT_STATUS = [
    "策划中", "大纲阶段", "剧本撰写中", "审核中", "已定稿", "制作中", "已完结"
  ];

  const EPISODE_STATUS = ["未开始", "撰写中", "已完成初稿", "修改中", "已定稿"];

  const REVIEW_STAGES = ["待审核", "一审", "二审", "终审", "已通过", "需修改"];

  const CHAR_TYPES = ["主角", "配角", "反派", "群像", "客串"];

  const AVATAR_COLORS = [
    "#5b5bd6", "#16a085", "#e0a800", "#e05252", "#2f7fd6",
    "#8e44ad", "#e67e22", "#2c9ca6", "#c0392b", "#6c5ce7"
  ];

  // 分集生产流水线：环节顺序、负责人岗位、待办动作
  const FLOW_STEPS = [
    { key: "撰写", label: "撰写", role: "编剧", action: "完成初稿" },
    { key: "一审", label: "一审", role: "责任编辑", action: "一审" },
    { key: "二审", label: "二审", role: "审核人", action: "二审" },
    { key: "终审", label: "终审", role: "总编剧", action: "终审签字" },
    { key: "定稿", label: "定稿", role: null, action: null }
  ];

  /* ---------- 工具函数 ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function colorFor(seed) {
    let h = 0;
    const s = String(seed || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function initial(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  /* ---------- 状态 ---------- */
  let state = load();

  function defaultState() {
    return {
      members: [],
      scripts: [],
      episodes: [],
      characters: [],
      reviews: [],
      announcements: [],
      todos: [],
      ui: { view: "dashboard", selectedScript: null }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign(defaultState(), parsed);
      }
    } catch (e) {
      console.warn("读取本地数据失败，使用演示数据", e);
    }
    // 云端模式：不生成演示数据，等云端拉取团队数据；单机模式才填充演示数据
    if (location.protocol === "http:" || location.protocol === "https:") {
      return defaultState();
    }
    return seed();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("保存失败", e);
    }
    syncPush();
  }

  /* ---------- 云端同步（团队共享） ---------- */
  const SYNC = { enabled: false, url: null, pushTimer: null, suppress: false };

  function syncInit() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      SYNC.enabled = true;
      SYNC.url = "./api/state";
    }
    const el = document.getElementById("syncStatus");
    if (el) {
      el.textContent = SYNC.enabled ? "☁️ 已连接云端同步" : "🔌 单机模式";
      if (SYNC.enabled) el.classList.add("online");
    }
  }

  // 从云端拉取；若云端更新则采用并重绘。返回是否取到了数据
  function syncPull() {
    if (!SYNC.enabled) return Promise.resolve(false);
    return fetch(SYNC.url, { cache: "no-store" })
      .then((r) => r.json())
      .then((remote) => {
        if (remote && typeof remote === "object" && remote.updatedAt) {
          if (!state.updatedAt || remote.updatedAt > state.updatedAt) {
            SYNC.suppress = true;
            state = Object.assign(defaultState(), remote);
            render();
            SYNC.suppress = false;
          }
          return true;
        }
        return false;
      })
      .catch(() => false);
  }

  function syncPushNow() {
    if (!SYNC.enabled || SYNC.suppress) return;
    state.updatedAt = Date.now();
    return fetch(SYNC.url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    }).catch(() => {});
  }

  function syncPush() {
    if (!SYNC.enabled || SYNC.suppress) return;
    clearTimeout(SYNC.pushTimer);
    SYNC.pushTimer = setTimeout(syncPushNow, 800);
  }

  /* ---------- 演示数据 ---------- */
  function seed() {
    const base = defaultState();

    const m1 = uid(), m2 = uid(), m3 = uid(), m4 = uid(),
          m5 = uid(), m6 = uid(), m7 = uid();

    base.members = [
      { id: m1, name: "林远", role: "总编剧", email: "linyuan@writers.com", phone: "138****0001", bio: "项目总负责人，把控整体故事方向与世界观。" },
      { id: m2, name: "苏晴", role: "编剧", email: "suqing@writers.com", phone: "138****0002", bio: "主力编剧，擅长悬疑与人物弧线。" },
      { id: m3, name: "周维", role: "剧本统筹", email: "zhouwei@writers.com", phone: "138****0003", bio: "负责分集拆解与场次统筹。" },
      { id: m4, name: "陈默", role: "责任编辑", email: "chenmo@writers.com", phone: "138****0004", bio: "内容审核与质量把控。" },
      { id: m5, name: "郑凯", role: "制片人", email: "zhengkai@writers.com", phone: "138****0005", bio: "预算与排期管理，对接平台。" },
      { id: m6, name: "何雨", role: "助理编剧", email: "heyu@writers.com", phone: "138****0006", bio: "资料收集、台词打磨与格式整理。" },
      { id: m7, name: "方璐", role: "审核人", email: "fanglu@writers.com", phone: "138****0007", bio: "平台方审核对接，终审签字。" }
    ];

    const s1 = uid(), s2 = uid(), s3 = uid();
    base.scripts = [
      { id: s1, title: "迷雾追凶", genre: "悬疑 / 犯罪", status: "剧本撰写中", logline: "一桩尘封十年的连环悬案被重新翻出，刑警与隐退法医联手追凶，却发现真相指向自己最信任的人。", targetEpisodes: 24, ownerId: m1, createdAt: Date.now() - 86400000 * 20 },
      { id: s2, title: "星河之下", genre: "青春 / 科幻", status: "大纲阶段", logline: "一群高中生在观测站偶遇外星信号，展开一场跨越星河的青春冒险与成长。", targetEpisodes: 16, ownerId: m2, createdAt: Date.now() - 86400000 * 9 },
      { id: s3, title: "半城烟火", genre: "都市 / 情感", status: "已定稿", logline: "三代人同住一条老巷，在拆迁与城市更新中重新理解亲情、爱情与故乡。", targetEpisodes: 30, ownerId: m3, createdAt: Date.now() - 86400000 * 45 }
    ];

    const e1 = uid(), e2 = uid(), e3 = uid(), e4 = uid();
    base.episodes = [
      { id: e1, scriptId: s1, number: 1, title: "尘封的档案", outline: "旧档案室搬迁，年轻刑警意外发现一宗被标记为「意外」的连环失踪案，直觉告诉他另有隐情。", status: "已定稿", writerId: m2 },
      { id: e2, scriptId: s1, number: 2, title: "第一目击者", outline: "唯一幸存者现身，却三缄其口；主角在废弃工厂找到关键证物，案件疑点重重。", status: "已完成初稿", writerId: m2 },
      { id: e3, scriptId: s1, number: 3, title: "隐退的法医", outline: "主角拜访早已隐退的老法医，两人旧怨难解，最终为真相勉强联手。", status: "撰写中", writerId: m6 },
      { id: e4, scriptId: s1, number: 4, title: "第二现场", outline: "关键证物指向一处早已拆除的老宅，主角顺藤摸瓜发现案发时有人刻意抹去痕迹。", status: "未开始", writerId: m2 },
      { id: uid(), scriptId: s2, number: 1, title: "信号", outline: "天文社观测夜，主角度过一个失败的告白夜，却在凌晨收到一段无法解析的外星信号。", status: "已完成初稿", writerId: m6 },
      { id: uid(), scriptId: s2, number: 2, title: "解码", outline: "天才同学加入解码，五人小队首次集结，信号的来源越来越离奇。", status: "撰写中", writerId: m2 },
      { id: uid(), scriptId: s3, number: 1, title: "回家的路", outline: "在外打拼的孙女回到即将拆迁的老巷，与固执的爷爷爆发激烈冲突。", status: "已定稿", writerId: m3 }
    ];

    const c1 = uid(), c2 = uid(), c3 = uid();
    base.characters = [
      { id: c1, scriptId: s1, name: "顾长风", type: "主角", age: 34, personality: "冷静克制，固执，对真相有近乎偏执的追求", background: "刑警，十年前因一桩未破案件与师父决裂，从此自我封闭。", arc: "从独行到学会信任，直面内心愧疚。", note: "全剧视角人物" },
      { id: c2, scriptId: s1, name: "沈清", type: "主角", age: 52, personality: "毒舌、严谨、外冷内热", background: "隐退法医，当年因证物污染被冤枉而离开警队。", arc: "解开当年心结，重新找回职业尊严。", note: "与顾长风有旧怨" },
      { id: c3, scriptId: s1, name: "宋柏年", type: "反派", age: 47, personality: "温和儒雅，城府极深", background: "知名慈善家，与连环案有千丝万缕的联系。", arc: "一步步暴露真实面目。", note: "明线是善人，暗线是凶手" },
      { id: uid(), scriptId: s2, name: "夏小满", type: "主角", age: 17, personality: "热血、乐观、有点冒失", background: "普通高中生，天文社社长。", arc: "在冒险中学会责任与取舍。", note: "" },
      { id: uid(), scriptId: s3, name: "林奶奶", type: "主角", age: 78, personality: "固执、念旧、刀子嘴豆腐心", background: "在老巷住了六十年的老人。", arc: "从抗拒拆迁到与家人和解。", note: "" }
    ];

    base.reviews = [
      { id: uid(), targetType: "episode", targetId: e1, stage: "已通过", reviewerId: m4, comment: "节奏紧凑，人物动机扎实，可定稿。", date: Date.now() - 86400000 * 2 },
      { id: uid(), targetType: "episode", targetId: e2, stage: "二审", reviewerId: m4, comment: "第二幕转折稍显生硬，建议强化证人心理动机。", date: Date.now() - 86400000 * 1 },
      { id: uid(), targetType: "episode", targetId: e3, stage: "一审", reviewerId: m7, comment: "待全文后统一评估人物台词风格。", date: Date.now() },
      { id: uid(), targetType: "script", targetId: s1, stage: "终审", reviewerId: m1, comment: "整体框架通过，待前四集定稿后进入制作排期。", date: Date.now() }
    ];

    base.announcements = [
      { id: uid(), title: "本周编剧会时间调整", content: "原定周四的编剧会调整至周三 14:00，请大家提前整理各自负责分集的修改稿。", date: Date.now() - 86400000, pinned: true },
      { id: uid(), title: "《迷雾追凶》前四集定稿冲刺", content: "平台方要求下周一前提交前四集定稿版本，请相关编剧与责任编辑优先跟进审核意见。", date: Date.now() - 86400000 * 3, pinned: true },
      { id: uid(), title: "新人入组欢迎", content: "欢迎助理编剧何雨加入小组，协助资料整理与台词打磨。", date: Date.now() - 86400000 * 6, pinned: false }
    ];

    base.todos = [
      { id: uid(), text: "完成《迷雾追凶》第4集大纲", assigneeId: m2, due: Date.now() + 86400000 * 2, done: false, priority: "high" },
      { id: uid(), text: "整理《星河之下》世界观设定文档", assigneeId: m6, due: Date.now() + 86400000 * 4, done: false, priority: "medium" },
      { id: uid(), text: "与平台对接《半城烟火》排期", assigneeId: m5, due: Date.now() - 86400000, done: false, priority: "high" },
      { id: uid(), text: "回填一审修改意见", assigneeId: m4, due: Date.now() + 86400000, done: true, priority: "medium" }
    ];

    base.ui.selectedScript = s1;
    return base;
  }

  /* ---------- 通用：查询 ---------- */
  function memberById(id) { return state.members.find((m) => m.id === id); }
  function scriptById(id) { return state.scripts.find((s) => s.id === id); }
  function episodeById(id) { return state.episodes.find((e) => e.id === id); }
  function episodesOf(scriptId) {
    return state.episodes
      .filter((e) => e.scriptId === scriptId)
      .sort((a, b) => a.number - b.number);
  }
  function charactersOf(scriptId) {
    return state.characters.filter((c) => c.scriptId === scriptId);
  }
  function scriptProgress(scriptId) {
    const eps = episodesOf(scriptId);
    if (eps.length === 0) return 0;
    const done = eps.filter((e) => e.status === "已定稿").length;
    return Math.round((done / eps.length) * 100);
  }
  function reviewTarget(review) {
    if (review.targetType === "episode") {
      const ep = episodeById(review.targetId);
      const sc = ep ? scriptById(ep.scriptId) : null;
      return ep ? `${sc ? sc.title + " " : ""}第${ep.number}集 · ${ep.title}` : "未知分集";
    }
    const sc = scriptById(review.targetId);
    return sc ? `《${sc.title}》整体` : "未知剧本";
  }
  function reviewStageIndex(stage) {
    return REVIEW_STAGES.indexOf(stage);
  }

  /* ---------- 工作流辅助 ---------- */
  function memberByRole(role) {
    return state.members.find((m) => m.role === role) || null;
  }

  function latestReview(episodeId) {
    const list = state.reviews
      .filter((r) => r.targetType === "episode" && r.targetId === episodeId)
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    return list[0] || null;
  }

  // 返回该集当前所处的流程环节下标（0=撰写 … 4=定稿完成）
  function episodeFlowIndex(ep) {
    const latest = latestReview(ep.id);
    if (latest) {
      if (latest.stage === "已通过") return FLOW_STEPS.length - 1;
      if (latest.stage === "需修改") return 0;
      if (latest.stage === "待审核" || latest.stage === "一审") return 1;
      if (latest.stage === "二审") return 2;
      if (latest.stage === "终审") return 3;
    }
    if (ep.status === "已定稿") return FLOW_STEPS.length - 1;
    if (ep.status === "已完成初稿") return 1;
    return 0;
  }

  function ensureReviewForEpisode(ep, stage, reviewerRole) {
    let r = latestReview(ep.id);
    if (!r || r.stage === "已通过" || r.stage === "需修改") {
      r = { id: uid(), targetType: "episode", targetId: ep.id, stage: stage, reviewerId: null, comment: "", date: Date.now() };
      state.reviews.push(r);
    } else {
      r.stage = stage;
    }
    if (reviewerRole) {
      const m = memberByRole(reviewerRole);
      if (m) r.reviewerId = m.id;
    }
    return r;
  }

  function stageTodoText(sc, ep, step) {
    return `【工作流】《${sc.title}》第${ep.number}集 · ${step.action}`;
  }

  // 完成当前环节 index，并流转到下一环节、为下一负责人生成待办
  function applyStep(ep, sc, index) {
    if (index === 0) {
      ep.status = "已完成初稿";
      ensureReviewForEpisode(ep, "一审", "责任编辑");
    } else if (index === 1) {
      ensureReviewForEpisode(ep, "二审", "审核人");
    } else if (index === 2) {
      ensureReviewForEpisode(ep, "终审", "总编剧");
    } else if (index === 3) {
      ep.status = "已定稿";
      ensureReviewForEpisode(ep, "已通过", null);
    }
    const nextIdx = index + 1;
    if (nextIdx < FLOW_STEPS.length) {
      const nextStep = FLOW_STEPS[nextIdx];
      if (nextStep.role && nextStep.action) {
        const m = memberByRole(nextStep.role);
        const text = stageTodoText(sc, ep, nextStep);
        if (!state.todos.some((t) => !t.done && t.text === text)) {
          state.todos.push({ id: uid(), text, assigneeId: m ? m.id : null, due: Date.now() + 3 * 86400000, done: false, priority: nextIdx >= 3 ? "high" : "medium" });
        }
      }
    }
  }

  function advanceEpisode(epId) {
    const ep = episodeById(epId);
    if (!ep) return;
    const sc = scriptById(ep.scriptId);
    const idx = episodeFlowIndex(ep);
    if (idx >= FLOW_STEPS.length - 1) { toast("该集已定稿"); return; }
    applyStep(ep, sc, idx);
    toast(`《${sc.title}》第${ep.number}集 → ${FLOW_STEPS[idx + 1].label}`);
    render();
  }

  function generateWorkflowTasks() {
    const sc = scriptById(state.ui.selectedScript);
    if (!sc) { toast("请先选择剧本"); return; }
    let count = 0;
    episodesOf(sc.id).forEach((ep) => {
      const idx = episodeFlowIndex(ep);
      if (idx >= FLOW_STEPS.length - 1) return;
      const step = FLOW_STEPS[idx];
      if (step.role && step.action) {
        const m = memberByRole(step.role);
        const text = stageTodoText(sc, ep, step);
        if (!state.todos.some((t) => !t.done && t.text === text)) {
          state.todos.push({ id: uid(), text, assigneeId: m ? m.id : null, due: Date.now() + 3 * 86400000, done: false, priority: idx >= 3 ? "high" : "medium" });
          count++;
        }
      }
    });
    toast(count ? `已为 ${count} 集生成当前任务` : "所有分集已定稿，无需生成任务");
    render();
  }

  // 审稿环节：退回修改（填写意见，退回给编剧返工）
  function openRejectModal(epId) {
    const ep = episodeById(epId);
    if (!ep) return;
    const sc = scriptById(ep.scriptId);
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">退回修改 · 《${esc(sc.title)}》第${ep.number}集</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveReject(event, '${ep.id}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("修改意见", `<textarea name="comment" required placeholder="填写需要修改的地方，编剧将据此返工" style="min-height:110px"></textarea>`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-danger">退回修改</button>
        </div>
      </form>
    `);
  }

  function saveReject(event, epId) {
    event.preventDefault();
    const ep = episodeById(epId);
    if (!ep) return false;
    const comment = event.target.comment.value.trim();
    if (!comment) { toast("请填写修改意见"); return false; }
    let r = latestReview(ep.id);
    if (r) {
      r.stage = "需修改";
      r.comment = comment;
    } else {
      r = { id: uid(), targetType: "episode", targetId: ep.id, stage: "需修改", reviewerId: null, comment: comment, date: Date.now() };
      state.reviews.push(r);
    }
    ep.status = "修改中";
    const sc = scriptById(ep.scriptId);
    const w = ep.writerId ? memberById(ep.writerId) : memberByRole("编剧");
    const text = `【工作流】《${sc.title}》第${ep.number}集 · 按意见修改`;
    if (!state.todos.some((t) => !t.done && t.text === text)) {
      state.todos.push({ id: uid(), text, assigneeId: w ? w.id : null, due: Date.now() + 3 * 86400000, done: false, priority: "high" });
    }
    closeModal();
    toast(`已退回《${sc.title}》第${ep.number}集给编剧`);
    render();
    return false;
  }

  // 双向自动同步：分集状态 ↔ 审核记录
  function syncReviewFromEpisode(ep) {
    if (ep.status === "已完成初稿") {
      ensureReviewForEpisode(ep, "一审", "责任编辑");
    }
  }
  function syncEpisodeFromReview(r) {
    if (r.targetType !== "episode") return;
    const ep = episodeById(r.targetId);
    if (!ep) return;
    if (r.stage === "已通过") ep.status = "已定稿";
    else if (r.stage === "需修改") ep.status = "修改中";
    else ep.status = "已完成初稿";
  }

  // 侧边栏角标 + 启动提醒
  function updateBadges() {
    const pendingReviews = state.reviews.filter((r) => !["已通过", "需修改"].includes(r.stage)).length;
    const overdueTodos = state.todos.filter((t) => !t.done && t.due && t.due < Date.now()).length;
    const nbR = document.getElementById("navBadgeReviews");
    const nbT = document.getElementById("navBadgeTodos");
    if (nbR) { nbR.textContent = pendingReviews; nbR.hidden = pendingReviews === 0; }
    if (nbT) { nbT.textContent = overdueTodos; nbT.hidden = overdueTodos === 0; }
  }

  function remindOverdue() {
    const overdue = state.todos.filter((t) => !t.done && t.due && t.due < Date.now());
    const pending = state.reviews.filter((r) => !["已通过", "需修改"].includes(r.stage));
    if (overdue.length || pending.length) {
      setTimeout(() => {
        const parts = [];
        if (overdue.length) parts.push(`${overdue.length} 条待办已逾期`);
        if (pending.length) parts.push(`${pending.length} 项待审核`);
        toast("⏰ " + parts.join("，"));
      }, 700);
    }
  }

  /* ---------- 组件 ---------- */
  function avatarHtml(name, size) {
    const cls = size === "lg" ? "avatar avatar-lg" : "avatar";
    return `<span class="${cls}" style="background:${colorFor(name)}">${esc(initial(name))}</span>`;
  }

  function statusBadge(status, type) {
    const map = {
      green: ["已定稿", "已通过", "已完结", "已完成初稿"],
      blue: ["撰写中", "制作中", "一审", "二审", "终审"],
      amber: ["大纲阶段", "策划中", "修改中", "待审核", "未开始"],
      red: ["需修改"],
      gray: []
    };
    let cls = "badge-gray";
    if (map.green.includes(status)) cls = "badge-green";
    else if (map.blue.includes(status)) cls = "badge-blue";
    else if (map.amber.includes(status)) cls = "badge-amber";
    else if (map.red.includes(status)) cls = "badge-red";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }

  function emptyState(icon, title, sub, actionHtml) {
    return `<div class="empty">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${esc(title)}</div>
      ${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ""}
      ${actionHtml ? `<div style="margin-top:16px">${actionHtml}</div>` : ""}
    </div>`;
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------- 模态框 ---------- */
  function openModal(html) {
    const overlay = document.getElementById("modalOverlay");
    document.getElementById("modal").innerHTML = html;
    overlay.hidden = false;
  }
  function closeModal() {
    document.getElementById("modalOverlay").hidden = true;
    document.getElementById("modal").innerHTML = "";
  }
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- 表单字段生成 ---------- */
  function fieldHtml(label, inputHtml, opts) {
    opts = opts || {};
    const full = opts.full ? " full" : "";
    const hint = opts.hint ? `<span class="hint">${opts.hint}</span>` : "";
    return `<div class="form-field${full}">
      <label>${label}</label>
      ${inputHtml}
      ${hint}
    </div>`;
  }

  function selectHtml(name, options, value) {
    const opts = options
      .map((o) => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`)
      .join("");
    return `<select name="${name}">${opts}</select>`;
  }

  function memberSelectHtml(name, value, allowEmpty) {
    let opts = "";
    if (allowEmpty) opts = `<option value="">未分配</option>`;
    opts += state.members.map((m) => `<option value="${m.id}" ${m.id === value ? "selected" : ""}>${esc(m.name)} · ${esc(m.role)}</option>`).join("");
    return `<select name="${name}">${opts}</select>`;
  }

  /* =====================================================
     视图渲染
     ===================================================== */
  function setTopbar(title, desc, actionsHtml) {
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("pageDesc").textContent = desc;
    document.getElementById("topbarActions").innerHTML = actionsHtml || "";
  }

  function render() {
    const view = state.ui.view;
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.view === view));

    switch (view) {
      case "members": renderMembers(); break;
      case "scripts": renderScripts(); break;
      case "episodes": renderEpisodes(); break;
      case "characters": renderCharacters(); break;
      case "workflow": renderWorkflow(); break;
      case "reviews": renderReviews(); break;
      case "announcements": renderAnnouncements(); break;
      default: renderDashboard();
    }
    updateBadges();
    save();
  }

  /* ---------- 工作台概览 ---------- */
  function renderDashboard() {
    setTopbar("工作台概览", "网剧编剧制作小组的协作总览",
      `<button class="btn btn-primary" onclick="openScriptModal()">＋ 新建剧本</button>`);

    const totalMembers = state.members.length;
    const totalScripts = state.scripts.length;
    const activeScripts = state.scripts.filter((s) => !["已定稿", "已完结"].includes(s.status)).length;
    const pendingReviews = state.reviews.filter((r) => !["已通过", "需修改"].includes(r.stage)).length;
    const openTodos = state.todos.filter((t) => !t.done).length;
    const totalEpisodes = state.episodes.length;
    const draftedEpisodes = state.episodes.filter((e) => e.status === "已定稿").length;

    const recentScripts = [...state.scripts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const openTodosList = state.todos.filter((t) => !t.done).slice(0, 5);
    const pendingReviewList = state.reviews
      .filter((r) => !["已通过", "需修改"].includes(r.stage))
      .slice(0, 5);

    const stats = [
      { label: "团队成员", value: totalMembers, icon: "👥", hint: "覆盖编剧、统筹、审核等岗位" },
      { label: "在制剧本", value: totalScripts, icon: "📚", hint: `进行中 ${activeScripts} 部` },
      { label: "分集完成度", value: `${draftedEpisodes}/${totalEpisodes}`, icon: "🗂️", hint: "已定稿 / 总分集" },
      { label: "待审核", value: pendingReviews, icon: "✅", hint: "等待处理意见" },
      { label: "待办事项", value: openTodos, icon: "📝", hint: "未完成任务" }
    ];

    const statsHtml = stats.map((s) => `
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-label">${s.label}</span><span class="stat-icon">${s.icon}</span></div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-hint">${s.hint}</div>
      </div>`).join("");

    const scriptListHtml = recentScripts.length
      ? recentScripts.map((s) => {
          const prog = scriptProgress(s.id);
          const owner = memberById(s.ownerId);
          return `
          <div class="script-card card" onclick="openScriptDetail('${s.id}')">
            <div class="script-title">《${esc(s.title)}》</div>
            <div class="script-logline">${esc(s.logline)}</div>
            <div class="script-meta">
              <span class="badge badge-gray">${esc(s.genre)}</span>
              ${statusBadge(s.status)}
              <span class="badge badge-purple">${s.targetEpisodes} 集</span>
            </div>
            <div class="script-progress">
              <div class="progress-label"><span>定稿进度</span><span>${prog}%</span></div>
              <div class="progress"><div class="progress-bar" style="width:${prog}%"></div></div>
            </div>
            <div style="font-size:12px;color:var(--text-3)">负责人：${owner ? esc(owner.name) : "未分配"}</div>
          </div>`;
        }).join("")
      : emptyState("📚", "还没有剧本", "点击右上角「新建剧本」开始创作", `<button class="btn btn-primary" onclick="openScriptModal()">＋ 新建剧本</button>`);

    const todoHtml = openTodosList.length
      ? openTodosList.map((t) => {
          const m = memberById(t.assigneeId);
          const prio = t.priority === "high" ? '<span class="badge badge-red">紧急</span>' :
                       t.priority === "medium" ? '<span class="badge badge-amber">普通</span>' : '<span class="badge badge-gray">低</span>';
          return `<div class="todo-item">
            <div class="todo-check" onclick="toggleTodo('${t.id}')"></div>
            <div class="todo-text">${esc(t.text)}</div>
            <div class="todo-meta">${m ? esc(m.name) : ""} · ${fmtDate(t.due)} ${prio}</div>
          </div>`;
        }).join("")
      : `<div class="empty" style="padding:20px">暂无待办 🎉</div>`;

    const reviewHtml = pendingReviewList.length
      ? pendingReviewList.map((r) => {
          const rev = memberById(r.reviewerId);
          return `<div class="episode-item">
            <div class="ep-main">
              <div class="ep-title">${esc(reviewTarget(r))}</div>
              <div class="ep-outline">审核人：${rev ? esc(rev.name) : "未分配"}</div>
            </div>
            ${statusBadge(r.stage)}
          </div>`;
        }).join("")
      : `<div class="empty" style="padding:20px">暂无待审核项 ✅</div>`;

    const memberStrip = state.members.slice(0, 8).map((m) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
        ${avatarHtml(m.name)}
        <div>
          <div style="font-weight:600">${esc(m.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${esc(m.role)}</div>
        </div>
      </div>`).join("");

    document.getElementById("content").innerHTML = `
      <div class="stats-grid" style="margin-bottom:18px">${statsHtml}</div>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px" class="dash-grid">
        <div class="card card-pad">
          <div class="section-head">
            <h3 class="section-title">📚 最近剧本</h3>
            <a href="javascript:void(0)" class="badge badge-blue" onclick="goView('scripts')">查看全部 →</a>
          </div>
          <div class="script-grid" style="grid-template-columns:1fr 1fr">${scriptListHtml}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="card card-pad">
            <div class="section-head"><h3 class="section-title">👥 团队</h3></div>
            ${memberStrip}
            <button class="btn btn-sm" style="width:100%;margin-top:8px" onclick="goView('members')">管理成员</button>
          </div>
          <div class="card card-pad">
            <div class="section-head">
              <h3 class="section-title">📝 待办</h3>
              <a href="javascript:void(0)" class="badge badge-blue" onclick="goView('announcements')">全部 →</a>
            </div>
            ${todoHtml}
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:18px">
        <div class="section-head">
          <h3 class="section-title">✅ 待审核进度</h3>
          <a href="javascript:void(0)" class="badge badge-blue" onclick="goView('reviews')">进入审核流程 →</a>
        </div>
        ${reviewHtml}
      </div>

      <style>
        @media (max-width:1000px){ .dash-grid{grid-template-columns:1fr !important;} }
      </style>
    `;
  }

  /* ---------- 成员管理 ---------- */
  function renderMembers() {
    setTopbar("成员管理", "小组岗位分工与成员信息",
      `<button class="btn btn-primary" onclick="openMemberModal()">＋ 添加成员</button>`);

    const html = state.members.length
      ? `<div class="member-grid">${state.members.map((m) => `
          <div class="card member-card">
            <div class="member-head">
              ${avatarHtml(m.name, "lg")}
              <div>
                <div class="member-name">${esc(m.name)}</div>
                <div class="member-role">${esc(m.role)}</div>
              </div>
            </div>
            <div class="member-meta">
              ${m.email ? `<span>✉️ ${esc(m.email)}</span>` : ""}
              ${m.phone ? `<span>📱 ${esc(m.phone)}</span>` : ""}
              ${m.bio ? `<span style="margin-top:4px">${esc(m.bio)}</span>` : ""}
            </div>
            <div class="member-actions">
              <button class="btn btn-sm" onclick="openMemberModal('${m.id}')">编辑</button>
              <button class="btn btn-sm" style="color:var(--red)" onclick="deleteMember('${m.id}')">删除</button>
            </div>
          </div>`).join("")}</div>`
      : emptyState("👥", "还没有成员", "点击右上角添加第一位小组成员", `<button class="btn btn-primary" onclick="openMemberModal()">＋ 添加成员</button>`);

    document.getElementById("content").innerHTML = html;
  }

  /* ---------- 剧本库 ---------- */
  function renderScripts() {
    setTopbar("剧本库", "管理与跟踪所有在制网剧项目",
      `<button class="btn btn-primary" onclick="openScriptModal()">＋ 新建剧本</button>`);

    const statusCounts = {};
    state.scripts.forEach((s) => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });
    const filterHtml = `
      <div class="filter-bar">
        <input class="search-input" placeholder="🔍 搜索剧本名称 / 简介..." oninput="renderScriptsFiltered(this.value)">
      </div>`;

    const listHtml = state.scripts.length
      ? `<div class="script-grid">${state.scripts.map((s) => {
          const prog = scriptProgress(s.id);
          const owner = memberById(s.ownerId);
          return `
          <div class="card script-card" onclick="openScriptDetail('${s.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div class="script-title">《${esc(s.title)}》</div>
              ${statusBadge(s.status)}
            </div>
            <div class="script-logline">${esc(s.logline) || "暂无简介"}</div>
            <div class="script-meta">
              <span class="badge badge-gray">${esc(s.genre)}</span>
              <span class="badge badge-purple">${s.targetEpisodes} 集</span>
              <span class="badge badge-gray">${episodesOf(s.id).length} 集大纲</span>
            </div>
            <div class="script-progress">
              <div class="progress-label"><span>定稿进度</span><span>${prog}%</span></div>
              <div class="progress"><div class="progress-bar" style="width:${prog}%"></div></div>
            </div>
            <div style="font-size:12px;color:var(--text-3)">负责人：${owner ? esc(owner.name) : "未分配"} · 创建于 ${fmtDate(s.createdAt)}</div>
          </div>`;
        }).join("")}</div>`
      : emptyState("📚", "剧本库空空如也", "创建你的第一部网剧吧", `<button class="btn btn-primary" onclick="openScriptModal()">＋ 新建剧本</button>`);

    document.getElementById("content").innerHTML = filterHtml + listHtml;

    // 记住搜索过滤函数
    window._scriptFilter = "";
  }

  function renderScriptsFiltered(keyword) {
    window._scriptFilter = keyword.toLowerCase();
    const cards = document.querySelectorAll(".script-card");
    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(window._scriptFilter) ? "" : "none";
    });
  }

  /* ---------- 分集大纲 ---------- */
  function renderEpisodes() {
    const sc = scriptById(state.ui.selectedScript);
    setTopbar("分集大纲", "按剧集拆分故事，管理每一集的创作进度",
      `<button class="btn btn-primary" onclick="openEpisodeModal()">＋ 新增分集</button>`);

    if (state.scripts.length === 0) {
      document.getElementById("content").innerHTML = emptyState("🗂️", "先创建一个剧本", "分集大纲需要挂靠在剧本下", `<button class="btn btn-primary" onclick="goView('scripts')">去剧本库创建</button>`);
      return;
    }

    const scriptPicker = `<div class="filter-bar">
      <select onchange="selectScript(this.value)">
        ${state.scripts.map((s) => `<option value="${s.id}" ${s.id === state.ui.selectedScript ? "selected" : ""}>《${esc(s.title)}》 · ${esc(s.status)}</option>`).join("")}
      </select>
      ${sc ? `<span class="badge badge-gray">共 ${episodesOf(sc.id).length} / ${sc.targetEpisodes} 集</span>` : ""}
    </div>`;

    let body;
    if (!sc) {
      body = emptyState("🗂️", "请选择剧本");
    } else {
      const eps = episodesOf(sc.id);
      body = eps.length
        ? `<div class="card table-wrap"><table>
            <thead><tr><th style="width:70px">集数</th><th>标题</th><th>大纲摘要</th><th>编剧</th><th style="width:110px">状态</th><th style="width:120px">操作</th></tr></thead>
            <tbody>${eps.map((e) => {
              const w = memberById(e.writerId);
              return `<tr>
                <td><span class="ep-num">${e.number}</span></td>
                <td><strong>${esc(e.title)}</strong></td>
                <td style="max-width:320px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2)">${esc(e.outline || "—")}</div></td>
                <td>${w ? esc(w.name) : '<span style="color:var(--text-3)">未分配</span>'}</td>
                <td>${statusBadge(e.status)}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm" onclick="openEpisodeModal('${e.id}')">编辑</button>
                  <button class="btn btn-sm" style="color:var(--red)" onclick="deleteEpisode('${e.id}')">删除</button>
                </td>
              </tr>`;
            }).join("")}</tbody></table></div>`
        : emptyState("🗂️", "还没有分集", "点击右上角为《" + sc.title + "》添加第一集", `<button class="btn btn-primary" onclick="openEpisodeModal()">＋ 新增分集</button>`);
    }

    document.getElementById("content").innerHTML = scriptPicker + body;
  }

  function selectScript(id) {
    state.ui.selectedScript = id;
    save();
    render();
  }

  /* ---------- 人物小传 ---------- */
  function renderCharacters() {
    const sc = scriptById(state.ui.selectedScript);
    setTopbar("人物小传", "刻画角色性格、背景与成长弧线",
      `<button class="btn btn-primary" onclick="openCharacterModal()">＋ 新增人物</button>`);

    if (state.scripts.length === 0) {
      document.getElementById("content").innerHTML = emptyState("🎭", "先创建一个剧本", "人物小传需要挂靠在剧本下", `<button class="btn btn-primary" onclick="goView('scripts')">去剧本库创建</button>`);
      return;
    }

    const scriptPicker = `<div class="filter-bar">
      <select onchange="selectScript(this.value)">
        ${state.scripts.map((s) => `<option value="${s.id}" ${s.id === state.ui.selectedScript ? "selected" : ""}>《${esc(s.title)}》</option>`).join("")}
      </select>
    </div>`;

    let body;
    if (!sc) {
      body = emptyState("🎭", "请选择剧本");
    } else {
      const chars = charactersOf(sc.id);
      body = chars.length
        ? `<div class="char-grid">${chars.map((c) => `
            <div class="card char-card">
              <div class="char-head">
                ${avatarHtml(c.name, "lg")}
                <div>
                  <div class="char-name">${esc(c.name)}</div>
                  <div class="char-sub">${esc(c.type)} · ${c.age ? esc(c.age) + " 岁" : "年龄未知"}</div>
                </div>
              </div>
              <div class="char-fields">
                ${c.personality ? `<span class="badge badge-blue">性格</span>` : ""}
                ${c.arc ? `<span class="badge badge-purple">弧线</span>` : ""}
              </div>
              ${c.personality ? `<div class="char-desc"><strong>性格：</strong>${esc(c.personality)}</div>` : ""}
              ${c.background ? `<div class="char-desc"><strong>背景：</strong>${esc(c.background)}</div>` : ""}
              ${c.arc ? `<div class="char-desc"><strong>成长弧线：</strong>${esc(c.arc)}</div>` : ""}
              ${c.note ? `<div class="char-desc" style="color:var(--text-3)"><strong>备注：</strong>${esc(c.note)}</div>` : ""}
              <div class="member-actions">
                <button class="btn btn-sm" onclick="openCharacterModal('${c.id}')">编辑</button>
                <button class="btn btn-sm" style="color:var(--red)" onclick="deleteCharacter('${c.id}')">删除</button>
              </div>
            </div>`).join("")}</div>`
        : emptyState("🎭", "还没有人物", "点击右上角为《" + sc.title + "》添加角色", `<button class="btn btn-primary" onclick="openCharacterModal()">＋ 新增人物</button>`);
    }

    document.getElementById("content").innerHTML = scriptPicker + body;
  }

  /* ---------- 工作流 ---------- */
  function renderWorkflow() {
    setTopbar("工作流", "按「撰写→一审→二审→终审→定稿」自动流转每一集，并为下一环节负责人生成任务",
      `<button class="btn" onclick="generateWorkflowTasks()">⚡ 一键生成任务</button>`);

    if (state.scripts.length === 0) {
      document.getElementById("content").innerHTML = emptyState("⚙️", "先创建一个剧本", "工作流需要挂靠在剧本下", `<button class="btn btn-primary" onclick="goView('scripts')">去剧本库创建</button>`);
      return;
    }

    const sc = scriptById(state.ui.selectedScript);
    const scriptPicker = `<div class="filter-bar">
      <select onchange="selectScript(this.value)">
        ${state.scripts.map((s) => `<option value="${s.id}" ${s.id === state.ui.selectedScript ? "selected" : ""}>《${esc(s.title)}》</option>`).join("")}
      </select>
      <span class="badge badge-gray">流程：撰写 → 一审 → 二审 → 终审 → 定稿</span>
    </div>`;

    let body;
    if (!sc) {
      body = emptyState("⚙️", "请选择剧本");
    } else {
      const eps = episodesOf(sc.id);
      if (eps.length === 0) {
        body = emptyState("⚙️", "该剧本还没有分集", "先到「分集大纲」添加分集，再来流转", `<button class="btn btn-primary" onclick="goView('episodes')">去添加分集</button>`);
      } else {
        const rows = eps.map((ep) => {
          const idx = episodeFlowIndex(ep);
          const step = FLOW_STEPS[idx];
          const owner = step.role ? memberByRole(step.role) : null;
          const done = idx >= FLOW_STEPS.length - 1;
          const flowHtml = FLOW_STEPS.map((s, i) => {
            let cls = "";
            if (i < idx) cls = "done";
            else if (i === idx) cls = "current";
            const dot = `<div class="flow-step ${cls}"><span class="flow-dot"></span><span>${s.label}</span></div>`;
            const line = i < FLOW_STEPS.length - 1 ? `<div class="flow-line ${i < idx ? "done" : ""}"></div>` : "";
            return dot + line;
          }).join("");
          let actionHtml;
          if (done) {
            actionHtml = '<span class="badge badge-green">✓ 完成</span>';
          } else if (idx === 0) {
            actionHtml = `<button class="btn btn-sm btn-primary" onclick="advanceEpisode('${ep.id}')">提交初稿 →</button>`;
          } else {
            actionHtml = `<button class="btn btn-sm btn-primary" onclick="advanceEpisode('${ep.id}')">✓ 通过</button>
              <button class="btn btn-sm" style="color:var(--red)" onclick="openRejectModal('${ep.id}')">↩ 退回</button>`;
          }
          return `<div class="workflow-row">
            <span class="ep-num">${ep.number}</span>
            <div class="ep-main" style="min-width:150px;max-width:200px">
              <div class="ep-title">${esc(ep.title)}</div>
              <div class="ep-outline">${done ? "已定稿" : "当前：" + step.label + " · " + (owner ? esc(owner.name) + "（" + esc(owner.role) + "）" : "未分配")}</div>
            </div>
            <div class="flow-steps">${flowHtml}</div>
            <div style="flex-shrink:0;display:flex;gap:6px;flex-wrap:wrap">${actionHtml}</div>
          </div>`;
        }).join("");
        body = `<div class="card">${rows}</div>
          <div style="margin-top:12px;color:var(--text-3);font-size:12px">
            编剧点「提交初稿」进入一审；审稿环节可「✓ 通过」流转到下一审，或「↩ 退回」填写意见退回编剧返工；「一键生成任务」为所有未定稿分集的当前负责人补发任务；逾期与待审核会在侧边栏显示红点角标。
          </div>`;
      }
    }

    document.getElementById("content").innerHTML = scriptPicker + body;
  }

  /* ---------- 审核流程 ---------- */
  function renderReviews() {
    setTopbar("审核流程", "看板式管理剧本与分集的审核进度",
      `<button class="btn btn-primary" onclick="openReviewModal()">＋ 提交审核</button>`);

    const cols = REVIEW_STAGES.map((stage) => {
      const items = state.reviews.filter((r) => r.stage === stage);
      const cards = items.map((r) => {
        const rev = memberById(r.reviewerId);
        return `<div class="kanban-card">
          <div class="kanban-card-title">${esc(reviewTarget(r))}</div>
          <div class="kanban-card-sub">审核人：${rev ? esc(rev.name) : "未分配"} · ${fmtDate(r.date)}</div>
          ${r.comment ? `<div class="kanban-card-sub" style="color:var(--text-2);margin-top:6px">“${esc(r.comment)}”</div>` : ""}
          <div class="kanban-card-foot">
            <button class="btn btn-sm" onclick="openReviewModal('${r.id}')">编辑</button>
            <button class="btn btn-sm" style="color:var(--red)" onclick="deleteReview('${r.id}')">删除</button>
          </div>
        </div>`;
      }).join("");
      return `<div class="kanban-col">
        <div class="kanban-title">${stage} <span class="kanban-count">${items.length}</span></div>
        ${cards || `<div style="color:var(--text-3);font-size:12px;text-align:center;padding:10px">—</div>`}
      </div>`;
    }).join("");

    document.getElementById("content").innerHTML = `<div class="kanban">${cols}</div>`;
  }

  /* ---------- 公告与待办 ---------- */
  function renderAnnouncements() {
    setTopbar("公告与待办", "小组公告与任务待办清单",
      `<button class="btn btn-primary" onclick="openAnnouncementModal()">＋ 发布公告</button>
       <button class="btn" onclick="openTodoModal()">＋ 新建待办</button>`);

    const annHtml = state.announcements.length
      ? state.announcements
          .slice()
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date - a.date)
          .map((a) => `
            <div class="announcement-item">
              <div class="ann-title">
                ${a.pinned ? "📌" : "📢"} ${esc(a.title)}
                <span class="ann-date">${fmtDate(a.date)}</span>
                <button class="btn btn-sm" onclick="deleteAnnouncement('${a.id}')" style="color:var(--red);margin-left:8px">删除</button>
              </div>
              <div class="ann-content">${esc(a.content)}</div>
            </div>`).join("")
      : `<div class="empty" style="padding:24px">暂无公告</div>`;

    const todos = state.todos.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    const todoHtml = todos.length
      ? todos.map((t) => {
          const m = memberById(t.assigneeId);
          const overdue = !t.done && t.due && t.due < Date.now();
          const prio = t.priority === "high" ? '<span class="badge badge-red">紧急</span>' :
                       t.priority === "medium" ? '<span class="badge badge-amber">普通</span>' : '<span class="badge badge-gray">低</span>';
          return `<div class="todo-item">
            <div class="todo-check ${t.done ? "done" : ""}" onclick="toggleTodo('${t.id}')">${t.done ? "✓" : ""}</div>
            <div class="todo-text ${t.done ? "done" : ""}">${esc(t.text)}</div>
            <div class="todo-meta">${m ? esc(m.name) : "未分配"} · ${fmtDate(t.due)} ${overdue ? '<span class="badge badge-red">已逾期</span>' : prio}</div>
            <button class="btn btn-sm" onclick="openTodoModal('${t.id}')">编辑</button>
            <button class="btn btn-sm" style="color:var(--red)" onclick="deleteTodo('${t.id}')">删除</button>
          </div>`;
        }).join("")
      : `<div class="empty" style="padding:24px">暂无待办 🎉</div>`;

    document.getElementById("content").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px" class="ann-grid">
        <div class="card card-pad">
          <div class="section-head"><h3 class="section-title">📢 小组公告</h3></div>
          ${annHtml}
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3 class="section-title">📝 待办清单</h3></div>
          ${todoHtml}
        </div>
      </div>
      <style>@media (max-width:900px){ .ann-grid{grid-template-columns:1fr !important;} }</style>
    `;
  }

  /* =====================================================
     模态框：成员
     ===================================================== */
  function openMemberModal(id) {
    const m = id ? memberById(id) : null;
    const isEdit = !!m;
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑成员" : "添加成员"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form id="memberForm" onsubmit="return saveMember(event, '${isEdit ? m.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("姓名", `<input name="name" required value="${isEdit ? esc(m.name) : ""}" placeholder="例如：林远">`, { full: true })}
            ${fieldHtml("岗位", selectHtml("role", ROLES, isEdit ? m.role : "编剧"))}
            ${fieldHtml("邮箱", `<input name="email" type="email" value="${isEdit ? esc(m.email) : ""}" placeholder="name@example.com">`)}
            ${fieldHtml("电话", `<input name="phone" value="${isEdit ? esc(m.phone) : ""}" placeholder="手机号">`, { full: true })}
            ${fieldHtml("简介", `<textarea name="bio" placeholder="一句话介绍该成员的职责与擅长方向">${isEdit ? esc(m.bio) : ""}</textarea>`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);
  }

  function saveMember(event, id) {
    event.preventDefault();
    const f = event.target;
    const data = {
      name: f.name.value.trim(),
      role: f.role.value,
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      bio: f.bio.value.trim()
    };
    if (!data.name) { toast("请填写姓名"); return false; }
    if (id) {
      Object.assign(memberById(id), data);
      toast("成员信息已更新");
    } else {
      state.members.push(Object.assign({ id: uid() }, data));
      toast("成员已添加");
    }
    closeModal();
    render();
    return false;
  }

  function deleteMember(id) {
    const m = memberById(id);
    if (!m) return;
    if (!confirm(`确定删除成员「${m.name}」吗？`)) return;
    state.members = state.members.filter((x) => x.id !== id);
    state.episodes.forEach((e) => { if (e.writerId === id) e.writerId = null; });
    state.todos.forEach((t) => { if (t.assigneeId === id) t.assigneeId = null; });
    state.reviews.forEach((r) => { if (r.reviewerId === id) r.reviewerId = null; });
    toast("成员已删除");
    render();
  }

  /* =====================================================
     模态框：剧本
     ===================================================== */
  function openScriptModal(id) {
    const s = id ? scriptById(id) : null;
    const isEdit = !!s;
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑剧本" : "新建剧本"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveScript(event, '${isEdit ? s.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("剧本名称", `<input name="title" required value="${isEdit ? esc(s.title) : ""}" placeholder="例如：迷雾追凶">`, { full: true })}
            ${fieldHtml("题材类型", `<input name="genre" value="${isEdit ? esc(s.genre) : ""}" placeholder="例如：悬疑 / 犯罪">`)}
            ${fieldHtml("目标集数", `<input name="targetEpisodes" type="number" min="1" value="${isEdit ? s.targetEpisodes : 24}">`)}
            ${fieldHtml("状态", selectHtml("status", SCRIPT_STATUS, isEdit ? s.status : "策划中"))}
            ${fieldHtml("负责人", memberSelectHtml("ownerId", isEdit ? s.ownerId : null, true), { full: true })}
            ${fieldHtml("一句话简介（Logline）", `<textarea name="logline" placeholder="用一句话概括故事核心矛盾与看点">${isEdit ? esc(s.logline) : ""}</textarea>`, { full: true, hint: "建议 30–50 字，一句话讲清主角、目标与阻碍" })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);
  }

  function saveScript(event, id) {
    event.preventDefault();
    const f = event.target;
    const data = {
      title: f.title.value.trim(),
      genre: f.genre.value.trim(),
      targetEpisodes: parseInt(f.targetEpisodes.value, 10) || 1,
      status: f.status.value,
      ownerId: f.ownerId.value || null,
      logline: f.logline.value.trim()
    };
    if (!data.title) { toast("请填写剧本名称"); return false; }
    if (id) {
      Object.assign(scriptById(id), data);
      toast("剧本已更新");
    } else {
      state.scripts.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
      state.ui.selectedScript = state.scripts[state.scripts.length - 1].id;
      toast("剧本已创建");
    }
    closeModal();
    render();
    return false;
  }

  function deleteScript(id) {
    const s = scriptById(id);
    if (!s) return;
    if (!confirm(`确定删除剧本《${s.title}》吗？相关的分集、人物、审核记录也会一并删除。`)) return;
    const epIds = state.episodes.filter((x) => x.scriptId === id).map((x) => x.id);
    state.scripts = state.scripts.filter((x) => x.id !== id);
    state.episodes = state.episodes.filter((x) => x.scriptId !== id);
    state.characters = state.characters.filter((x) => x.scriptId !== id);
    state.reviews = state.reviews.filter((x) => !((x.targetType === "script" && x.targetId === id) || (x.targetType === "episode" && epIds.includes(x.targetId))));
    if (state.ui.selectedScript === id) state.ui.selectedScript = state.scripts[0] ? state.scripts[0].id : null;
    toast("剧本已删除");
    render();
  }

  /* ---------- 剧本详情 ---------- */
  function openScriptDetail(id) {
    const s = scriptById(id);
    if (!s) return;
    const owner = memberById(s.ownerId);
    const eps = episodesOf(id);
    const chars = charactersOf(id);
    const prog = scriptProgress(id);

    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">《${esc(s.title)}》</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <span class="badge badge-gray">${esc(s.genre)}</span>
          ${statusBadge(s.status)}
          <span class="badge badge-purple">${s.targetEpisodes} 集</span>
          <span class="badge badge-gray">${eps.length} 集大纲</span>
          <span class="badge badge-blue">${chars.length} 个人物</span>
        </div>
        <p style="color:var(--text-2);margin:0 0 16px">${esc(s.logline) || "暂无简介"}</p>
        <div class="progress-label"><span>定稿进度</span><span>${prog}%</span></div>
        <div class="progress"><div class="progress-bar" style="width:${prog}%"></div></div>
        <div style="font-size:13px;color:var(--text-3);margin:12px 0 16px">负责人：${owner ? esc(owner.name) + " · " + esc(owner.role) : "未分配"} · 创建于 ${fmtDate(s.createdAt)}</div>

        <h4 style="margin:0 0 8px">分集进度</h4>
        ${eps.length ? eps.slice(0, 6).map((e) => `
          <div class="episode-item" style="padding:8px 0">
            <span class="ep-num" style="width:32px;height:32px;font-size:13px">${e.number}</span>
            <div class="ep-main"><div class="ep-title" style="font-size:14px">${esc(e.title)}</div></div>
            ${statusBadge(e.status)}
          </div>`).join("") : '<div style="color:var(--text-3);font-size:13px">暂无分集</div>'}
      </div>
      <div class="modal-foot">
        <button class="btn" style="color:var(--red)" onclick="deleteScript('${s.id}')">删除剧本</button>
        <button class="btn" onclick="closeModal()">关闭</button>
        <button class="btn btn-primary" onclick="openScriptModal('${s.id}')">编辑</button>
      </div>
    `);
  }

  /* =====================================================
     模态框：分集
     ===================================================== */
  function openEpisodeModal(id) {
    const e = id ? episodeById(id) : null;
    const isEdit = !!e;
    const sc = e ? scriptById(e.scriptId) : scriptById(state.ui.selectedScript);
    const nextNum = sc ? episodesOf(sc.id).length + 1 : 1;
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑分集" : "新增分集"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveEpisode(event, '${isEdit ? e.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("所属剧本", `<select name="scriptId">${state.scripts.map((s) => `<option value="${s.id}" ${s.id === (sc ? sc.id : null) ? "selected" : ""}>《${esc(s.title)}》</option>`).join("")}</select>`, { full: true })}
            ${fieldHtml("集数", `<input name="number" type="number" min="1" required value="${isEdit ? e.number : nextNum}">`)}
            ${fieldHtml("本集标题", `<input name="title" required value="${isEdit ? esc(e.title) : ""}" placeholder="例如：尘封的档案">`)}
            ${fieldHtml("状态", selectHtml("status", EPISODE_STATUS, isEdit ? e.status : "未开始"))}
            ${fieldHtml("负责编剧", memberSelectHtml("writerId", isEdit ? e.writerId : null, true))}
            ${fieldHtml("剧情大纲", `<textarea name="outline" placeholder="本集主要情节、关键冲突与结尾钩子" style="min-height:120px">${isEdit ? esc(e.outline) : ""}</textarea>`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);
  }

  function saveEpisode(event, id) {
    event.preventDefault();
    const f = event.target;
    const data = {
      scriptId: f.scriptId.value,
      number: parseInt(f.number.value, 10) || 1,
      title: f.title.value.trim(),
      status: f.status.value,
      writerId: f.writerId.value || null,
      outline: f.outline.value.trim()
    };
    if (!data.title) { toast("请填写标题"); return false; }
    let ep;
    if (id) {
      ep = episodeById(id);
      Object.assign(ep, data);
      toast("分集已更新");
    } else {
      ep = Object.assign({ id: uid() }, data);
      state.episodes.push(ep);
      toast("分集已添加");
    }
    syncReviewFromEpisode(ep);
    state.ui.selectedScript = data.scriptId;
    closeModal();
    render();
    return false;
  }

  function deleteEpisode(id) {
    if (!confirm("确定删除这一集吗？相关审核记录也会删除。")) return;
    state.episodes = state.episodes.filter((x) => x.id !== id);
    state.reviews = state.reviews.filter((x) => !(x.targetType === "episode" && x.targetId === id));
    toast("分集已删除");
    render();
  }

  /* =====================================================
     模态框：人物
     ===================================================== */
  function openCharacterModal(id) {
    const c = id ? state.characters.find((x) => x.id === id) : null;
    const isEdit = !!c;
    const sc = c ? scriptById(c.scriptId) : scriptById(state.ui.selectedScript);
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑人物" : "新增人物"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveCharacter(event, '${isEdit ? c.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("所属剧本", `<select name="scriptId">${state.scripts.map((s) => `<option value="${s.id}" ${s.id === (sc ? sc.id : null) ? "selected" : ""}>《${esc(s.title)}》</option>`).join("")}</select>`, { full: true })}
            ${fieldHtml("姓名", `<input name="name" required value="${isEdit ? esc(c.name) : ""}" placeholder="角色姓名">`)}
            ${fieldHtml("类型", selectHtml("type", CHAR_TYPES, isEdit ? c.type : "主角"))}
            ${fieldHtml("年龄", `<input name="age" type="number" min="0" value="${isEdit ? c.age : ""}" placeholder="例如：34">`)}
            ${fieldHtml("性格特点", `<textarea name="personality" placeholder="关键词或简短描述">${isEdit ? esc(c.personality) : ""}</textarea>`)}
            ${fieldHtml("人物背景", `<textarea name="background" placeholder="出身、经历、现状">${isEdit ? esc(c.background) : ""}</textarea>`)}
            ${fieldHtml("成长弧线", `<textarea name="arc" placeholder="角色在故事中的变化轨迹">${isEdit ? esc(c.arc) : ""}</textarea>`)}
            ${fieldHtml("备注", `<input name="note" value="${isEdit ? esc(c.note) : ""}" placeholder="补充说明（可选）">`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);
  }

  function saveCharacter(event, id) {
    event.preventDefault();
    const f = event.target;
    const data = {
      scriptId: f.scriptId.value,
      name: f.name.value.trim(),
      type: f.type.value,
      age: f.age.value ? parseInt(f.age.value, 10) : "",
      personality: f.personality.value.trim(),
      background: f.background.value.trim(),
      arc: f.arc.value.trim(),
      note: f.note.value.trim()
    };
    if (!data.name) { toast("请填写姓名"); return false; }
    if (id) {
      Object.assign(state.characters.find((x) => x.id === id), data);
      toast("人物已更新");
    } else {
      state.characters.push(Object.assign({ id: uid() }, data));
      toast("人物已添加");
    }
    state.ui.selectedScript = data.scriptId;
    closeModal();
    render();
    return false;
  }

  function deleteCharacter(id) {
    if (!confirm("确定删除这个人物吗？")) return;
    state.characters = state.characters.filter((x) => x.id !== id);
    toast("人物已删除");
    render();
  }

  /* =====================================================
     模态框：审核
     ===================================================== */
  function openReviewModal(id) {
    const r = id ? state.reviews.find((x) => x.id === id) : null;
    const isEdit = !!r;

    const targetOptions = () => {
      let html = '<optgroup label="剧本整体">';
      html += state.scripts.map((s) => `<option value="script:${s.id}">《${esc(s.title)}》整体</option>`).join("");
      html += '</optgroup><optgroup label="分集">';
      state.scripts.forEach((s) => {
        episodesOf(s.id).forEach((e) => {
          html += `<option value="episode:${e.id}">《${esc(s.title)}》第${e.number}集 · ${esc(e.title)}</option>`;
        });
      });
      html += '</optgroup>';
      return html;
    };

    const curTarget = r ? `${r.targetType}:${r.targetId}` : "";

    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑审核" : "提交审核"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveReview(event, '${isEdit ? r.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("审核对象", `<select name="target">${targetOptions()}</select>`, { full: true })}
            ${fieldHtml("审核阶段", selectHtml("stage", REVIEW_STAGES, isEdit ? r.stage : "待审核"))}
            ${fieldHtml("审核人", memberSelectHtml("reviewerId", isEdit ? r.reviewerId : null, true))}
            ${fieldHtml("审核意见", `<textarea name="comment" placeholder="填写修改意见或通过结论">${isEdit ? esc(r.comment) : ""}</textarea>`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);

    if (curTarget) {
      const sel = document.querySelector('select[name="target"]');
      sel.value = curTarget;
    }
  }

  function saveReview(event, id) {
    event.preventDefault();
    const f = event.target;
    const [targetType, targetId] = f.target.value.split(":");
    const data = {
      targetType,
      targetId,
      stage: f.stage.value,
      reviewerId: f.reviewerId.value || null,
      comment: f.comment.value.trim()
    };
    if (id) {
      const r = state.reviews.find((x) => x.id === id);
      Object.assign(r, data);
      syncEpisodeFromReview(r);
      toast("审核已更新");
    } else {
      const r = Object.assign({ id: uid(), date: Date.now() }, data);
      state.reviews.push(r);
      syncEpisodeFromReview(r);
      toast("已提交审核");
    }
    closeModal();
    render();
    return false;
  }

  function deleteReview(id) {
    if (!confirm("确定删除这条审核记录吗？")) return;
    state.reviews = state.reviews.filter((x) => x.id !== id);
    toast("审核记录已删除");
    render();
  }

  /* =====================================================
     模态框：公告 / 待办
     ===================================================== */
  function openAnnouncementModal() {
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">发布公告</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveAnnouncement(event)">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("标题", `<input name="title" required placeholder="公告标题">`, { full: true })}
            ${fieldHtml("内容", `<textarea name="content" required placeholder="公告正文" style="min-height:120px"></textarea>`, { full: true })}
            ${fieldHtml("置顶", `<label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="pinned" style="width:auto"> 置顶显示</label>`, { full: true })}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">发布</button>
        </div>
      </form>
    `);
  }

  function saveAnnouncement(event) {
    event.preventDefault();
    const f = event.target;
    state.announcements.unshift({
      id: uid(),
      title: f.title.value.trim(),
      content: f.content.value.trim(),
      date: Date.now(),
      pinned: f.pinned.checked
    });
    closeModal();
    toast("公告已发布");
    render();
    return false;
  }

  function deleteAnnouncement(id) {
    if (!confirm("确定删除这条公告吗？")) return;
    state.announcements = state.announcements.filter((x) => x.id !== id);
    toast("公告已删除");
    render();
  }

  function openTodoModal(id) {
    const t = id ? state.todos.find((x) => x.id === id) : null;
    const isEdit = !!t;
    const dueStr = t && t.due ? new Date(t.due).toISOString().slice(0, 10) : "";
    openModal(`
      <div class="modal-head">
        <h3 class="modal-title">${isEdit ? "编辑待办" : "新建待办"}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form onsubmit="return saveTodo(event, '${isEdit ? t.id : ""}')">
        <div class="modal-body">
          <div class="form-grid">
            ${fieldHtml("任务内容", `<input name="text" required value="${isEdit ? esc(t.text) : ""}" placeholder="例如：完成第4集大纲">`, { full: true })}
            ${fieldHtml("负责人", memberSelectHtml("assigneeId", isEdit ? t.assigneeId : null, true))}
            ${fieldHtml("截止日期", `<input name="due" type="date" value="${dueStr}">`)}
            ${fieldHtml("优先级", selectHtml("priority", ["high", "medium", "low"].map((p) => p === "high" ? "紧急" : p === "medium" ? "普通" : "低"), isEdit ? (t.priority === "high" ? "紧急" : t.priority === "medium" ? "普通" : "低") : "普通"))}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" onclick="closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    `);
  }

  function saveTodo(event, id) {
    event.preventDefault();
    const f = event.target;
    const prioMap = { "紧急": "high", "普通": "medium", "低": "low" };
    const data = {
      text: f.text.value.trim(),
      assigneeId: f.assigneeId.value || null,
      due: f.due.value ? new Date(f.due.value + "T23:59:59").getTime() : null,
      priority: prioMap[f.priority.value] || "medium"
    };
    if (!data.text) { toast("请填写任务内容"); return false; }
    if (id) {
      Object.assign(state.todos.find((x) => x.id === id), data);
      toast("待办已更新");
    } else {
      state.todos.push(Object.assign({ id: uid(), done: false }, data));
      toast("待办已添加");
    }
    closeModal();
    render();
    return false;
  }

  function toggleTodo(id) {
    const t = state.todos.find((x) => x.id === id);
    if (t) {
      t.done = !t.done;
      toast(t.done ? "已完成 ✓" : "已恢复为未完成");
      render();
    }
  }

  function deleteTodo(id) {
    if (!confirm("确定删除这条待办吗？")) return;
    state.todos = state.todos.filter((x) => x.id !== id);
    toast("待办已删除");
    render();
  }

  /* =====================================================
     导航 & 初始化
     ===================================================== */
  function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.body.classList.remove("menu-open");
  }

  function toggleMenu() {
    const sb = document.getElementById("sidebar");
    const open = sb.classList.toggle("open");
    document.body.classList.toggle("menu-open", open);
  }

  function goView(view) {
    closeMenu();
    state.ui.view = view;
    render();
  }

  document.getElementById("nav").addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) goView(item.dataset.view);
  });

  document.getElementById("menuBtn").addEventListener("click", toggleMenu);
  document.getElementById("sidebarBackdrop").addEventListener("click", closeMenu);

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("将清空当前所有数据并恢复为演示数据，确定继续吗？")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = seed();
    render();
    toast("已恢复演示数据");
  });

  /* ---------- 暴露到全局（供 onclick 调用） ---------- */
  Object.assign(window, {
    goView,
    closeModal,
    openScriptModal, saveScript, deleteScript, openScriptDetail,
    openMemberModal, saveMember, deleteMember,
    openEpisodeModal, saveEpisode, deleteEpisode, selectScript,
    openCharacterModal, saveCharacter, deleteCharacter,
    openReviewModal, saveReview, deleteReview,
    openAnnouncementModal, saveAnnouncement, deleteAnnouncement,
    openTodoModal, saveTodo, toggleTodo, deleteTodo,
    renderScriptsFiltered,
    advanceEpisode, generateWorkflowTasks,
    openRejectModal, saveReject
  });

  /* ---------- 启动 ---------- */
  render();
  remindOverdue();
  syncInit();
  if (SYNC.enabled) {
    // 首次拉取；若云端尚无数据，则把本地数据推送上去
    syncPull().then((hadRemote) => { if (!hadRemote) syncPushNow(); });
    setInterval(syncPull, 4000);
  }
})();
