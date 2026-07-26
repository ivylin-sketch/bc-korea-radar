const API_ORIGIN = "https://spfkvetigfwneapfbplk.supabase.co";
let posts = [];

const tabs = [
  ["today", "今", "今日"],
  ["history", "历", "历史"],
  ["search", "搜", "搜索"],
  ["saved", "藏", "收藏"],
  ["status", "态", "状态"],
];

const state = {
  gate: !localStorage.getItem("bc-radar-access-token"),
  tab: "today",
  saved: JSON.parse(localStorage.getItem("bc-radar-demo-favorites") || "[]"),
  query: "",
  push: "尚未启用系统通知",
  latestBrief: null,
  history: [],
  dataState: localStorage.getItem("bc-radar-access-token")
    ? "loading"
    : "idle",
  dataMessage: "",
  listType: "hot",
};

const compact = (value) =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(1)}M`
    : value >= 1000
      ? `${Math.round(value / 1000)}K`
      : String(value);

const dateTime = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

const dateLabel = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00+08:00`));

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeXUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname,
      )
      ? url.href
      : "#";
  } catch {
    return "#";
  }
};

function brand() {
  return `<button class="brand" data-tab="today" aria-label="返回今日简报"><span>BC</span><b>KOREA<br>RADAR</b></button>`;
}

function card(post) {
  const saved = state.saved.includes(post.id);
  return `<article class="post-card">
    <div class="post-card-top">
      <span class="rank-badge ${post.listType === "signal" ? "signal" : ""}">${post.listType === "signal" ? "苗头" : String(post.rank).padStart(2, "0")}</span>
      <button class="save-button ${saved ? "is-saved" : ""}" data-save="${post.id}">${saved ? "已收藏" : "收藏"}</button>
    </div>
    <div class="author-line">
      <div class="author-avatar">${escapeHtml(post.author.slice(0, 1).toUpperCase())}</div>
      <div><strong>${escapeHtml(post.author)}</strong><span>${escapeHtml(post.handle)} · ${escapeHtml(post.time)}</span></div>
    </div>
    <p class="korean-copy" lang="ko">${escapeHtml(post.ko)}</p>
    <p class="translation">${escapeHtml(post.zh)}</p>
    <div class="metrics">
      <span><b>${compact(post.views)}</b> 浏览</span>
      <span><b>${compact(post.likes + post.reposts)}</b> 互动</span>
      <span class="metric-detail">${compact(post.likes)} 赞 + ${compact(post.reposts)} 转发</span>
    </div>
    <div class="why-box"><span>BC SIGNAL</span><p>${escapeHtml(post.why || "AI 洞察暂未生成")}</p></div>
    <div class="post-footer">
      <div class="category-row">${post.categories.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      <a href="${safeXUrl(post.url)}" target="_blank" rel="noreferrer">打开 X 原帖 ↗</a>
    </div>
  </article>`;
}

function gate() {
  return `<main class="gate">
    <div class="gate-brand"><span>BC</span><b>KOREA<br>RADAR</b></div>
    <section class="gate-card">
      <p class="eyebrow">PRIVATE ACCESS · PHASE 0</p>
      <h1>每日趋势，准时抵达。</h1>
      <p class="gate-intro">韩国 X 审美热点、韩文原帖与 BeautyCam 灵感，只向受邀团队成员开放。</p>
      <form id="invite-form">
        <label>公司邮箱<input id="email" type="email" required autocomplete="email" placeholder="name@meitu.com"></label>
        <label>设置密码<input id="password" type="password" required minlength="10" autocomplete="new-password" placeholder="至少 10 个字符"></label>
        <label>一次性邀请码（首次登录填写）<input id="invite-token" type="text" autocomplete="off" placeholder="已有账号再次登录时可留空"></label>
        <p class="gate-message" id="gate-message">首次使用邀请链接设置密码；以后只需邮箱和密码。</p>
        <button class="primary-button" type="submit">首次接受邀请 / 已有账号登录</button>
      </form>
    </section>
    <p class="privacy-note">不上传 X Cookie/token · 不抓取或展示 X 图片 · 仅保存文字、数据和原帖链接</p>
  </main>`;
}

function today() {
  const brief = state.latestBrief;
  const hotPosts = posts.filter((post) => post.listType === "hot");
  const signalPosts = posts.filter((post) => post.listType === "signal");
  const visiblePosts = state.listType === "hot" ? hotPosts : signalPosts;
  const highestViews = hotPosts.reduce(
    (highest, post) => Math.max(highest, post.views),
    0,
  );
  const feed =
    state.dataState === "loading"
      ? `<div class="empty-state"><span>BC</span><h2>正在读取私有简报</h2><p>只有登录成功后才会从 Supabase 加载帖子和历史数据。</p></div>`
      : state.dataState === "error"
        ? `<div class="empty-state"><span>!</span><h2>简报暂时无法读取</h2><p>${escapeHtml(state.dataMessage)}</p></div>`
        : brief
          ? `<div class="feed-header">
              <div class="segmented-control">
                <button class="${state.listType === "hot" ? "active" : ""}" data-list="hot">热点主榜 <span>${hotPosts.length}</span></button>
                <button class="${state.listType === "signal" ? "active" : ""}" data-list="signal">高启发观察 <span>${signalPosts.length}</span></button>
              </div>
              <p>${state.listType === "hot" ? "仅展示 ≥ 500,000 浏览的 X 原帖，按相关性筛选后依浏览量排序。" : "展示 1,000–499,999 浏览的业务启发，只称苗头/观察，不称热点。"}</p>
            </div>
            ${visiblePosts.length ? `<section class="post-list">${visiblePosts.map(card).join("")}</section>` : `<div class="empty-state"><span>BC</span><h2>本期没有${state.listType === "hot" ? "合格热点" : "高启发苗头"}</h2><p>系统不会用低浏览内容凑数。</p></div>`}`
          : `<div class="empty-state"><span>BC</span><h2>还没有已发布简报</h2><p>抓取成功后会立即出现在这里；Mac 未在线时仍会发送“暂未生成”通知。</p></div>`;

  return `<section class="hero">
      <p class="eyebrow">KOREA · X TREND · DAILY</p>
      <h1>韩国审美，<br>今天在谈什么？</h1>
      <p class="hero-copy">过去 24 小时的高浏览审美内容，转译成 BeautyCam 可立即使用的选题与功能灵感。</p>
      <div class="window-note"><span class="pulse-dot"></span>${brief ? `${dateTime(brief.window_start)} — ${dateTime(brief.window_end)}` : "等待首期简报"} · 北京时间</div>
    </section>
    <section class="scoreboard" aria-label="今日数据">
      <div><b>${String(hotPosts.length).padStart(2, "0")}</b><span>主榜热点</span></div>
      <div><b>${compact(highestViews)}</b><span>最高浏览</span></div>
      <div><b>500K</b><span>硬门槛</span></div>
    </section>
    ${hotPosts[0]?.why ? `<section class="insight-strip"><span>今日一句</span><p>${escapeHtml(hotPosts[0].why)}</p></section>` : ""}
    ${feed}`;
}

function history() {
  const rows = state.history.map((brief) => [
    dateLabel(brief.brief_date),
    brief.is_monday ? "周一合并版" : "工作日",
    `${brief.hot_count} 热点 · ${brief.signal_count} 苗头`,
    brief.status === "partial" ? "部分生成" : "已生成",
  ]);
  return `<section class="inner-page"><p class="eyebrow">ARCHIVE</p><h1>历史简报</h1>
    <p class="section-intro">工作日自动生成，周末内容合并至周一并加倍榜单上限。</p>
    ${rows.length ? `<div class="history-list">${rows.map((row)=>`<button class="history-row"><span class="history-date"><b>${row[0]}</b><small>${row[1]}</small></span><span class="history-count">${row[2]}</span><span class="${row[3]==="部分生成"?"recovered":""}">${row[3]}</span><i>›</i></button>`).join("")}</div>` : `<div class="empty-state"><span>BC</span><h2>暂无历史简报</h2><p>发布后的简报会永久保存在这里。</p></div>`}
  </section>`;
}

function saved() {
  const list = posts.filter((post) => state.saved.includes(post.id));
  return `<section class="inner-page"><p class="eyebrow">MY PICKS</p><h1>个人收藏</h1>
    <p class="section-intro">收藏仅自己可见；团队标签和备注将在完整 MVP 中共享。</p>
    ${list.length ? `<div class="post-list">${list.map(card).join("")}</div>` : `<div class="empty-state"><span>BC</span><h2>还没有收藏</h2><p>在今日简报或搜索结果中点击“收藏”，重要灵感就会出现在这里。</p></div>`}
  </section>`;
}

function search() {
  const list = posts.filter((post) =>
    `${post.ko} ${post.zh} ${post.why} ${post.handle}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  return `<section class="inner-page"><p class="eyebrow">SEARCH</p><h1>搜索趋势</h1>
    <label class="search-field"><span>⌕</span><input id="search-input" placeholder="搜索韩文、中文、作者或洞察"></label>
    <div class="filter-chips">${["全部","拍照/自拍","美妆/美颜","时尚/穿搭","消费趋势"].map((x,i)=>`<button class="${i===0?"active":""}">${x}</button>`).join("")}</div>
    <p class="result-count">${list.length} 条结果</p><div class="post-list">${list.map(card).join("")}</div>
  </section>`;
}

function status() {
  return `<section class="inner-page"><p class="eyebrow">SYSTEM</p><h1>运行状态</h1>
    <p class="section-intro">Phase 0 验证页只显示与日报生成有关的必要状态；尚未通过的项目不会标记为成功。</p>
    <div class="status-card primary-status"><div><span class="status-dot"></span><p>本地链路</p><strong>真实 X 与本地 AI 已验证</strong></div><small>2026年7月26日更新</small></div>
    <div class="status-grid">
      <div class="status-card"><span>云端任务</span><strong>已连接</strong><small>Supabase 首尔项目与三条工作日定时任务已启用</small></div>
      <div class="status-card"><span>本地采集器</span><strong>已验证</strong><small>OpenCLI + Chrome X 登录态正常</small></div>
      <div class="status-card"><span>本地 AI</span><strong>Smoke 通过</strong><small>Gemma 3 4B / Qwen3 8B</small></div>
      <div class="status-card"><span>今日任务</span><strong>等待首期</strong><small>下一工作日 10:55 自动创建任务</small></div>
    </div>
    <div class="test-panel"><div><span class="mini-label">PUSH CHECK</span><h2>通知验证</h2><p id="push-state">${state.push}</p></div>
      <button class="primary-button" id="enable-push">启用系统通知</button>
      <div class="test-actions"><button data-notify="normal">测试正常通知</button><button data-notify="failed">测试失败通知</button><button data-notify="recovered">测试补抓通知</button></div>
    </div>
    <div class="run-timeline"><h2>工作日运行规则</h2>
      <div><time>10:55</time><p><strong>创建今日任务</strong><span>云端先登记，确保 Mac 关机时仍有状态。</span></p></div>
      <div><time>11:00</time><p><strong>本地抓取并立即推送</strong><span>OpenCLI 成功后才访问 X；AI 失败不会阻塞原帖数据。</span></p></div>
      <div><time>11:10</time><p><strong>失败检查</strong><span>未收到结果就推送“暂未生成”，不会发送空白消息。</span></p></div>
      <div><time>18:00</time><p><strong>停止补抓</strong><span>仍未完成则标记“未生成”，当天不再继续。</span></p></div>
    </div>
  </section>`;
}

function app() {
  const content = { today, history, search, saved, status }[state.tab]();
  return `<div class="app-shell">
    <header class="masthead">${brand()}<div class="masthead-actions"><span class="demo-pill">PHASE 0</span><button class="install-button" id="install">安装</button></div></header>
    <main>${content}</main>
    <nav class="bottom-nav">${tabs.map(([id,mark,label])=>`<button data-tab="${id}" class="${state.tab===id?"active":""}"><span>${mark}</span>${label}</button>`).join("")}</nav>
  </div>`;
}

function installSheet() {
  return `<div class="sheet-backdrop" id="sheet"><section class="install-sheet"><div class="sheet-handle"></div><span class="mini-label">IPHONE INSTALL</span><h2>添加到 iPhone 主屏幕</h2>
  <ol><li><b>1</b><span>使用 Safari 打开这个私人网址。</span></li><li><b>2</b><span>点击 Safari 底部的“分享”按钮。</span></li><li><b>3</b><span>选择“添加到主屏幕”，然后打开 BC Korea Radar。</span></li><li><b>4</b><span>登录后在“状态”页启用系统通知。</span></li></ol>
  <button class="primary-button" id="close-sheet">我知道了</button></section></div>`;
}

function render() {
  document.querySelector("#app").innerHTML = state.gate ? gate() : app();
  bind();
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });
  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.save;
      state.saved = state.saved.includes(id)
        ? state.saved.filter((item) => item !== id)
        : [...state.saved, id];
      localStorage.setItem("bc-radar-demo-favorites", JSON.stringify(state.saved));
      render();
    });
  });
  document.querySelectorAll("[data-list]").forEach((button) => {
    button.addEventListener("click", () => {
      state.listType = button.dataset.list;
      render();
    });
  });
  document.querySelector("#invite-form")?.addEventListener("submit", acceptInvite);
  const token = new URLSearchParams(location.search).get("invite");
  if (token && document.querySelector("#invite-token")) {
    document.querySelector("#invite-token").value = token;
  }
  document.querySelector("#install")?.addEventListener("click", () => {
    document.body.insertAdjacentHTML("beforeend", installSheet());
    document.querySelector("#close-sheet")?.addEventListener("click", () => document.querySelector("#sheet")?.remove());
    document.querySelector("#sheet")?.addEventListener("click", (event) => {
      if (event.target.id === "sheet") event.currentTarget.remove();
    });
  });
  const searchInput = document.querySelector("#search-input");
  if (searchInput) searchInput.value = state.query;
  searchInput?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
    const input = document.querySelector("#search-input");
    input.focus();
    input.setSelectionRange(state.query.length, state.query.length);
  });
  document.querySelector("#enable-push")?.addEventListener("click", enablePush);
  document.querySelectorAll("[data-notify]").forEach((button) => {
    button.addEventListener("click", () => localNotification(button.dataset.notify));
  });
}

async function acceptInvite(event) {
  event.preventDefault();
  const message = document.querySelector("#gate-message");
  message.textContent = "正在验证邀请…";
  try {
    const inviteToken = document.querySelector("#invite-token").value.trim();
    const response = await fetch(`${API_ORIGIN}/functions/v1/radar-app/api/auth/${inviteToken ? "accept-invite" : "sign-in"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: document.querySelector("#email").value,
        password: document.querySelector("#password").value,
        ...(inviteToken ? { inviteToken } : {}),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.accessToken) throw new Error(payload.message || "邀请验证失败");
    localStorage.setItem("bc-radar-access-token", payload.accessToken);
    if (payload.refreshToken) localStorage.setItem("bc-radar-refresh-token", payload.refreshToken);
    state.gate = false;
    state.dataState = "loading";
    render();
    await loadPrivateData();
  } catch (error) {
    message.textContent = error.message || "验证环境暂未连接云端。";
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("bc-radar-refresh-token");
  if (!refreshToken) return false;
  const response = await fetch(
    `${API_ORIGIN}/functions/v1/radar-app/api/auth/refresh`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.accessToken) return false;
  localStorage.setItem("bc-radar-access-token", payload.accessToken);
  if (payload.refreshToken) {
    localStorage.setItem("bc-radar-refresh-token", payload.refreshToken);
  }
  return true;
}

async function loadPrivateData(allowRefresh = true) {
  state.dataState = "loading";
  if (!state.gate) render();
  const accessToken = localStorage.getItem("bc-radar-access-token");
  try {
    const response = await fetch(
      `${API_ORIGIN}/functions/v1/brief-api`,
      {
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : {},
      },
    );
    if (response.status === 401 && allowRefresh && (await refreshAccessToken())) {
      return loadPrivateData(false);
    }
    const payload = await response.json();
    if (response.status === 401) {
      localStorage.removeItem("bc-radar-access-token");
      localStorage.removeItem("bc-radar-refresh-token");
      state.gate = true;
      state.dataState = "idle";
      render();
      return;
    }
    if (!response.ok) throw new Error(payload.message || "简报读取失败");

    state.latestBrief = payload.latestBrief;
    state.history = payload.history || [];
    posts = (payload.latestBrief?.posts || []).map((post) => ({
      ...post,
      time: dateTime(post.publishedAt),
      categories: post.categories || [],
    }));
    state.dataState = "ready";
    state.dataMessage = "";
    render();
  } catch (error) {
    state.dataState = "error";
    state.dataMessage = error.message || "请稍后重试。";
    render();
  }
}

async function enablePush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    state.push = "当前浏览器不支持 Web Push";
    render();
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    state.push = "通知权限未开启";
    render();
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const configResponse = await fetch(`${API_ORIGIN}/functions/v1/radar-app/api/push/public-key`);
    const config = await configResponse.json();
    if (!config.configured || !config.publicKey) {
      state.push = "浏览器通知权限已开启；云端 Push 密钥尚未配置";
      render();
      await localNotification("enabled");
      return;
    }
    const padding = "=".repeat((4 - (config.publicKey.length % 4)) % 4);
    const base64 = (config.publicKey + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const applicationServerKey = Uint8Array.from(
      [...atob(base64)].map((character) => character.charCodeAt(0)),
    );
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    const token = localStorage.getItem("bc-radar-access-token");
    const response = await fetch(`${API_ORIGIN}/functions/v1/radar-app/api/push/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(subscription),
    });
    if (!response.ok) throw new Error("云端订阅保存失败");
    state.push = "系统通知与云端订阅均已启用";
    render();
  } catch {
    state.push = "通知订阅未完成，请稍后重试";
    render();
  }
}

async function localNotification(type) {
  const registration = await navigator.serviceWorker.ready;
  const copy = {
    normal: ["今日简报已生成", "6 条主榜热点｜第一条：随手拍也能出人生照"],
    failed: ["今日简报暂未生成", "本地采集设备暂未在线；系统将在 18:00 前自动等待补抓。"],
    recovered: ["今日简报补抓完成", "热点简报已恢复生成，可以打开查看。"],
    enabled: ["BC Korea Radar 通知已开启", "这是本机验证通知。"],
  }[type];
  await registration.showNotification(copy[0], {
    body: copy[1],
    icon: "./icon-192.png",
    badge: "./badge-96.png",
    tag: `bc-radar-${type}`,
    data: { url: "./index.html?from=notification" },
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" });
}
render();
if (!state.gate) loadPrivateData();
