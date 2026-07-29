const API_ORIGIN = "https://spfkvetigfwneapfbplk.supabase.co";
let posts = [];

const tabs = [
  ["today", "今日"],
  ["history", "历史"],
  ["search", "搜索"],
  ["saved", "收藏"],
  ["status", "状态"],
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
  detailId: null,
  selectedBriefId: null,
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

const issueDate = (value) =>
  value ? value.replaceAll("-", ".") : "WAITING";

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

const safeMediaUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["pbs.twimg.com", "video.twimg.com"].includes(url.hostname)
      ? url.href
      : "";
  } catch {
    return "";
  }
};

function mediaFor(post) {
  return (Array.isArray(post.mediaAssets) ? post.mediaAssets : [])
    .map((asset) => {
      const fallbackUrl = safeMediaUrl(
        asset.type === "video" ? asset.posterUrl : asset.posterUrl || asset.url,
      );
      if (!fallbackUrl) return null;
      return {
        displayUrl: `${API_ORIGIN}/functions/v1/radar-app/api/media?url=${encodeURIComponent(fallbackUrl)}`,
        fallbackUrl,
        type: asset.type === "video" ? "video" : "image",
        source: asset.source === "quoted" ? "quoted" : "main",
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function brand() {
  return `<button class="brand" data-tab="today" aria-label="返回今日简报">
    <span>BC</span><b>KOREA <small>RADAR</small></b>
  </button>`;
}

function mediaFigure(post, detail = false) {
  const media = mediaFor(post);
  if (!media.length) {
    return `<figure class="post-media media-fallback ${detail ? "detail-media-main" : ""}">
      <span>TEXT<br>CLIPPING</span>
      <i>${post.listType === "signal" ? "SIGNAL" : String(post.rank).padStart(2, "0")}</i>
    </figure>`;
  }
  const first = media[0];
  return `<figure class="post-media ${detail ? "detail-media-main" : ""}">
    <img src="${escapeHtml(first.displayUrl)}" data-fallback-src="${escapeHtml(first.fallbackUrl)}" alt="${escapeHtml(post.visualDescription || "X 原帖配图")}" loading="${detail ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer">
    <span class="media-error">图片暂未载入<small>仍可查看原帖与画面说明</small></span>
    <figcaption>${first.source === "quoted" ? "引用帖图片" : first.type === "video" ? "视频封面" : `X 图片 1/${media.length}`}</figcaption>
  </figure>`;
}

function card(post) {
  const saved = state.saved.includes(post.id);
  const media = mediaFor(post);
  const coreKo = post.coreKo || post.ko;
  return `<article class="post-card ${media.length ? "has-media" : "text-clipping"}" data-open-post="${escapeHtml(post.id)}">
    <div class="paper-tape" aria-hidden="true"></div>
    ${media.length ? mediaFigure(post) : ""}
    <div class="post-card-copy">
      <div class="post-card-top">
        <span class="rank-badge ${post.listType === "signal" ? "signal" : ""}">${post.listType === "signal" ? "苗头" : String(post.rank).padStart(2, "0")}</span>
        <span class="views-label">${compact(post.views)} 浏览</span>
      </div>
      <p class="author-line"><strong>${escapeHtml(post.author)}</strong><span>${escapeHtml(post.handle)} · ${escapeHtml(post.time)}</span></p>
      <p class="korean-copy" lang="ko">${escapeHtml(coreKo)}</p>
      <p class="translation">${escapeHtml(post.zh || "AI 中文翻译暂未生成")}</p>
      <div class="category-row">${post.categories.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <button class="save-button ${saved ? "is-saved" : ""}" data-save="${escapeHtml(post.id)}" aria-label="${saved ? "取消收藏" : "收藏"}">${saved ? "已收藏" : "收藏"}</button>
  </article>`;
}

function detail(post) {
  const saved = state.saved.includes(post.id);
  const media = mediaFor(post);
  return `<section class="post-detail">
    <header class="detail-head">
      <button data-close-detail>← 返回本期</button>
      <span>CLIPPING ${String(post.rank).padStart(2, "0")}</span>
    </header>
    <div class="detail-media-layout">
      ${mediaFigure(post, true)}
      ${
        media.length > 1
          ? `<div class="detail-filmstrip">${media
              .slice(1)
              .map(
                (asset, index) =>
                  `<button data-detail-media="${index + 1}" aria-label="查看第 ${index + 2} 张图片">
                    <img src="${escapeHtml(asset.displayUrl)}" data-fallback-src="${escapeHtml(asset.fallbackUrl)}" alt="${escapeHtml(post.visualDescription || "X 原帖配图")}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                    ${asset.type === "video" ? "<span>VIDEO</span>" : ""}
                  </button>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>
    <article class="detail-body">
      <div class="detail-meta"><strong>${compact(post.views)} 浏览</strong><span>${compact(post.likes + post.reposts)} 互动</span></div>
      <p class="detail-author">${escapeHtml(post.author)} · ${escapeHtml(post.handle)} · ${escapeHtml(post.time)}</p>
      <h1 lang="ko">${escapeHtml(post.ko)}</h1>
      <p class="detail-translation">${escapeHtml(post.zh || "AI 中文翻译暂未生成")}</p>
      ${
        post.visualDescription
          ? `<section class="visual-note"><span>画面说明</span><p>${escapeHtml(post.visualDescription)}</p></section>`
          : ""
      }
      <section class="signal-note">
        <span>BC SIGNAL</span>
        <p>${escapeHtml(post.why || "AI 洞察暂未生成；原帖数据仍可查看。")}</p>
      </section>
      <div class="category-row detail-tags">${post.categories.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      <div class="detail-actions">
        <a href="${safeXUrl(post.url)}" target="_blank" rel="noreferrer">打开 X 原帖 ↗</a>
        <button class="save-button ${saved ? "is-saved" : ""}" data-save="${escapeHtml(post.id)}">${saved ? "已收藏" : "收藏"}</button>
      </div>
    </article>
  </section>`;
}

function gate() {
  return `<main class="gate">
    <div class="gate-brand"><span>BC</span><b>KOREA <small>RADAR</small></b></div>
    <section class="gate-card">
      <p class="eyebrow">PRIVATE ACCESS</p>
      <h1>韩国审美<br>每日剪报</h1>
      <p class="gate-intro">韩国 X 审美热点、韩文原帖与 BeautyCam 灵感，只向受邀团队成员开放。</p>
      <form id="invite-form">
        <label>公司邮箱<input id="email" type="email" required autocomplete="email" placeholder="name@meitu.com"></label>
        <label>密码<input id="password" type="password" required minlength="10" autocomplete="current-password" placeholder="至少 10 个字符"></label>
        <label>一次性邀请码（首次登录填写）<input id="invite-token" type="text" autocomplete="off" placeholder="已有账号再次登录时留空"></label>
        <p class="gate-message" id="gate-message">首次使用邀请链接设置密码；以后只需邮箱和密码。</p>
        <button class="primary-button" id="auth-submit" type="submit">首次接受邀请 / 已有账号登录</button>
      </form>
    </section>
    <p class="privacy-note">不上传 X Cookie/token · 图片仅通过 X 远程地址显示 · 不复制图片文件</p>
  </main>`;
}

function cover(brief, hotPosts, signalPosts) {
  const highestViews = hotPosts.reduce(
    (highest, post) => Math.max(highest, post.views),
    0,
  );
  return `<section class="issue-cover">
    <div class="issue-ticket">
      <span class="vertical-type">KOREA · X · DAILY</span>
      <span class="issue-no">ISSUE<br>${issueDate(brief?.brief_date)}</span>
    </div>
    <div class="cover-main">
      <span class="cover-kicker">TODAY'S AESTHETIC</span>
      <h1>韩国审美<br>今日剪报</h1>
      <p>过去 24 小时，韩国 X 上值得 BeautyCam 关注的视觉与社交信号。</p>
      <div class="cover-stats" aria-label="今日数据">
        <span><b>${String(hotPosts.length).padStart(2, "0")}</b>热点</span>
        <span><b>${compact(highestViews)}</b>最高</span>
        <span><b>${String(signalPosts.length).padStart(2, "0")}</b>苗头</span>
      </div>
    </div>
  </section>`;
}

function today() {
  if (state.detailId) {
    const selected = posts.find((post) => post.id === state.detailId);
    if (selected) return detail(selected);
    state.detailId = null;
  }

  const brief = state.latestBrief;
  const hotPosts = posts.filter((post) => post.listType === "hot");
  const signalPosts = posts.filter((post) => post.listType === "signal");
  const visiblePosts = state.listType === "hot" ? hotPosts : signalPosts;
  const feed =
    state.dataState === "loading"
      ? `<div class="empty-state"><span>BC</span><h2>正在读取私有简报</h2><p>登录成功后将加载本期剪报。</p></div>`
      : state.dataState === "error"
        ? `<div class="empty-state"><span>!</span><h2>简报暂时无法读取</h2><p>${escapeHtml(state.dataMessage)}</p></div>`
        : brief
          ? `<div class="feed-header">
              <div class="segmented-control">
                <button class="${state.listType === "hot" ? "active" : ""}" data-list="hot">热点主榜 <span>${hotPosts.length}</span></button>
                <button class="${state.listType === "signal" ? "active" : ""}" data-list="signal">高启发观察 <span>${signalPosts.length}</span></button>
              </div>
              <p>${state.listType === "hot" ? "≥ 500,000 浏览 · 通过业务相关性筛选后按浏览量排序" : "1,000–499,999 浏览 · 只称苗头/启发，不称热点"}</p>
            </div>
            ${visiblePosts.length ? `<section class="post-list">${visiblePosts.map(card).join("")}</section>` : `<div class="empty-state"><span>BC</span><h2>本期没有${state.listType === "hot" ? "合格热点" : "高启发苗头"}</h2><p>系统不会用低浏览内容凑数。</p></div>`}`
          : `<div class="empty-state"><span>BC</span><h2>还没有已发布简报</h2><p>抓取成功后会立即出现在这里；设备未在线时仍会发送“暂未生成”通知。</p></div>`;

  return `${cover(brief, hotPosts, signalPosts)}
    <div class="contents-strip" aria-label="主题目录">
      <span>01 拍照</span><span>02 美妆</span><span>03 穿搭</span><span>04 社交文化</span>
    </div>
    <div class="window-note"><span class="pulse-dot"></span>${brief ? `${dateTime(brief.window_start)} — ${dateTime(brief.window_end)}` : "等待首期简报"} · 北京时间</div>
    ${feed}`;
}

function history() {
  return `<section class="inner-page">
    <p class="eyebrow">ARCHIVE</p><h1>历史简报</h1>
    <p class="section-intro">工作日自动生成，周末内容合并到周一。</p>
    ${state.history.length ? `<div class="history-list">${state.history.map((brief) => {
      const status = brief.status === "partial" ? "部分生成" : "已生成";
      return `<button class="history-row" data-brief-id="${escapeHtml(brief.id)}" aria-label="打开 ${escapeHtml(dateLabel(brief.brief_date))} 简报">
        <span class="history-date"><b>${escapeHtml(dateLabel(brief.brief_date))}</b><small>${brief.is_monday ? "周一合并版" : "工作日"}</small></span>
        <span class="history-count">${brief.hot_count} 热点 · ${brief.signal_count} 苗头</span>
        <span class="${status === "部分生成" ? "recovered" : ""}">${status}</span><i aria-hidden="true">›</i>
      </button>`;
    }).join("")}</div>` : `<div class="empty-state"><span>BC</span><h2>暂无历史简报</h2><p>发布后的简报会永久保存在这里。</p></div>`}
  </section>`;
}

function saved() {
  const list = posts.filter((post) => state.saved.includes(post.id));
  return `<section class="inner-page"><p class="eyebrow">MY PICKS</p><h1>个人收藏</h1>
    <p class="section-intro">收藏保存在当前账号的使用设备上。</p>
    ${list.length ? `<div class="post-list">${list.map(card).join("")}</div>` : `<div class="empty-state"><span>BC</span><h2>还没有收藏</h2><p>在简报中点击“收藏”，重要灵感会出现在这里。</p></div>`}
  </section>`;
}

function search() {
  const list = posts.filter((post) =>
    `${post.ko} ${post.zh} ${post.why} ${post.handle}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  return `<section class="inner-page"><p class="eyebrow">SEARCH</p><h1>搜索趋势</h1>
    <label class="search-field"><span>⌕</span><input id="search-input" placeholder="搜索韩文、中文、作者或洞察"></label>
    <p class="result-count">${list.length} 条结果</p><div class="post-list">${list.map(card).join("")}</div>
  </section>`;
}

function status() {
  return `<section class="inner-page"><p class="eyebrow">SYSTEM</p><h1>运行状态</h1>
    <p class="section-intro">只展示与日报生成和手机通知有关的必要状态。</p>
    <div class="status-card primary-status"><div><span class="status-dot"></span><p>本地链路</p><strong>真实 X 与本地 AI 已验证</strong></div><small>最近一次验证成功</small></div>
    <div class="status-grid">
      <div class="status-card"><span>云端任务</span><strong>已连接</strong><small>工作日定时任务已启用</small></div>
      <div class="status-card"><span>本地采集器</span><strong>已验证</strong><small>OpenCLI + Chrome 登录态</small></div>
      <div class="status-card"><span>媒体图片</span><strong>远程显示</strong><small>不复制 X 图片文件</small></div>
      <div class="status-card"><span>今日任务</span><strong>${state.latestBrief ? "已发布" : "等待首期"}</strong><small>生成后立即推送</small></div>
    </div>
    <div class="test-panel"><div><span class="mini-label">PUSH CHECK</span><h2>通知验证</h2><p id="push-state">${state.push}</p></div>
      <button class="primary-button" id="enable-push">启用系统通知</button>
      <div class="test-actions"><button data-notify="normal">测试正常通知</button><button data-notify="failed">测试失败通知</button><button data-notify="recovered">测试补抓通知</button></div>
    </div>
    <div class="run-timeline"><h2>工作日运行规则</h2>
      <div><time>10:55</time><p><strong>创建任务</strong><span>云端先登记当日简报。</span></p></div>
      <div><time>11:00</time><p><strong>抓取并立即推送</strong><span>OpenCLI 成功后才访问 X。</span></p></div>
      <div><time>11:10</time><p><strong>失败检查</strong><span>未收到结果就发送“暂未生成”。</span></p></div>
      <div><time>18:00</time><p><strong>停止补抓</strong><span>仍未完成则标记“未生成”。</span></p></div>
    </div>
  </section>`;
}

function app() {
  const content = { today, history, search, saved, status }[state.tab]();
  const liveStamp =
    state.dataState !== "ready"
      ? "BC INTERNAL"
      : state.latestBrief?.status === "partial" ||
          state.latestBrief?.aiStatus === "failed"
        ? "部分生成"
        : "오늘 생성 완료";
  return `<div class="app-shell">
    <header class="masthead">${brand()}<div class="masthead-actions"><span class="live-stamp">${liveStamp}</span><button class="install-button" id="install">安装</button></div></header>
    <main>${content}</main>
    ${state.detailId ? "" : `<nav class="bottom-nav" aria-label="主导航">${tabs.map(([id,label])=>`<button data-tab="${id}" class="${state.tab===id?"active":""}">${label}</button>`).join("")}</nav>`}
  </div>`;
}

function installSheet() {
  return `<div class="sheet-backdrop" id="sheet"><section class="install-sheet"><div class="sheet-handle"></div><span class="mini-label">IPHONE INSTALL</span><h2>添加到 iPhone 主屏幕</h2>
  <ol><li><b>1</b><span>使用 Safari 打开这个私人网址。</span></li><li><b>2</b><span>点击 Safari 底部的“分享”。</span></li><li><b>3</b><span>选择“添加到主屏幕”。</span></li><li><b>4</b><span>登录后到“状态”页启用通知。</span></li></ol>
  <button class="primary-button" id="close-sheet">我知道了</button></section></div>`;
}

function render() {
  document.querySelector("#app").innerHTML = state.gate ? gate() : app();
  bind();
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const shouldReloadLatest =
        button.dataset.tab === "today" && state.selectedBriefId;
      state.tab = button.dataset.tab;
      state.detailId = null;
      if (shouldReloadLatest) {
        state.selectedBriefId = null;
        void loadPrivateData(true);
        return;
      }
      render();
      scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-brief-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = "today";
      state.detailId = null;
      state.listType = "hot";
      state.selectedBriefId = button.dataset.briefId;
      void loadPrivateData(true, state.selectedBriefId);
      scrollTo({ top: 0 });
    });
  });
  document.querySelectorAll("[data-open-post]").forEach((article) => {
    article.addEventListener("click", (event) => {
      if (event.target.closest("button,a")) return;
      state.detailId = article.dataset.openPost;
      render();
      scrollTo({ top: 0 });
    });
  });
  document.querySelector("[data-close-detail]")?.addEventListener("click", () => {
    state.detailId = null;
    render();
  });
  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
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
  document.querySelectorAll(".detail-filmstrip button").forEach((button) => {
    button.addEventListener("click", () => {
      const main = document.querySelector(".detail-media-main img");
      const thumbnail = button.querySelector("img");
      if (!main || !thumbnail) return;
      const current = main.src;
      main.src = thumbnail.src;
      thumbnail.src = current;
    });
  });
  document.querySelectorAll(".post-media img,.detail-filmstrip img").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = image.dataset.fallbackSrc;
      if (fallback && image.src !== fallback) {
        image.src = fallback;
        return;
      }
      image.closest(".post-media,.detail-filmstrip button")?.classList.add("is-broken");
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
  const submitButton = document.querySelector("#auth-submit");
  const email = document.querySelector("#email").value;
  const password = document.querySelector("#password").value;
  if (submitButton.disabled) return;
  submitButton.disabled = true;
  submitButton.textContent = "正在登录…";
  message.textContent = "正在验证账号…";
  try {
    const inviteToken = document.querySelector("#invite-token").value.trim();
    let response = await fetch(`${API_ORIGIN}/functions/v1/radar-app/api/auth/${inviteToken ? "accept-invite" : "sign-in"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(inviteToken ? { inviteToken } : {}),
      }),
    });
    let payload = await response.json();
    if (!response.ok && inviteToken) {
      message.textContent = "邀请已使用，正在尝试已有账号登录…";
      response = await fetch(
        `${API_ORIGIN}/functions/v1/radar-app/api/auth/sign-in`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      payload = await response.json();
    }
    if (!response.ok || !payload.accessToken) throw new Error(payload.message || "登录失败");
    localStorage.setItem("bc-radar-access-token", payload.accessToken);
    if (payload.refreshToken) localStorage.setItem("bc-radar-refresh-token", payload.refreshToken);
    state.gate = false;
    state.dataState = "loading";
    render();
    await loadPrivateData();
  } catch (error) {
    message.textContent = error.message || "登录服务暂时无法连接。";
    submitButton.disabled = false;
    submitButton.textContent = "首次接受邀请 / 已有账号登录";
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

async function loadPrivateData(allowRefresh = true, briefId = null) {
  state.dataState = "loading";
  if (!state.gate) render();
  const accessToken = localStorage.getItem("bc-radar-access-token");
  try {
    const briefApiUrl = new URL(`${API_ORIGIN}/functions/v1/brief-api`);
    if (briefId) briefApiUrl.searchParams.set("briefId", briefId);
    const response = await fetch(
      briefApiUrl,
      {
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : {},
      },
    );
    if (response.status === 401 && allowRefresh && (await refreshAccessToken())) {
      return loadPrivateData(false, briefId);
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
    state.selectedBriefId = briefId;
    posts = (payload.latestBrief?.posts || []).map((post) => ({
      ...post,
      time: dateTime(post.publishedAt),
      categories: post.categories || [],
      mediaAssets: Array.isArray(post.mediaAssets) ? post.mediaAssets : [],
    }));
    state.dataState = "ready";
    state.dataMessage = "";
    const locationUrl = new URL(location.href);
    if (briefId) locationUrl.searchParams.set("brief", briefId);
    else locationUrl.searchParams.delete("brief");
    window.history.replaceState({}, "", locationUrl);
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
    normal: ["今日简报已生成", "主榜热点已更新，打开查看今日第一条。"],
    failed: ["今日简报暂未生成", "本地采集设备暂未在线；系统将在 18:00 前自动等待补抓。"],
    recovered: ["今日简报补抓完成", "热点简报已恢复生成，可以打开查看。"],
    enabled: ["BC Korea Radar 通知已开启", "这是本机验证通知。"],
  }[type];
  await registration.showNotification(copy[0], {
    body: copy[1],
    icon: "./radar-icon-192.png",
    badge: "./radar-badge-96.png",
    tag: `bc-radar-${type}`,
    data: { url: "./index.html?from=notification" },
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" });
}
render();
if (!state.gate) {
  loadPrivateData(
    true,
    new URLSearchParams(location.search).get("brief"),
  );
}
