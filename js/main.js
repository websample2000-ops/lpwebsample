/**
 * 潤華ねろ Official LP - メインスクリプト (js/main.js)
 * Cloudflare Workers (workers/worker.js) + D1 Database 連携版
 * 実API: https://lpwebsample-api.web-sample2000-ea9.workers.dev
 */

// ============================================================
// 1. API設定 & データ取得 (Cloudflare Workers / D1)
// ============================================================
const API_CONFIG = {
  // 提供された Workers の本番エンドポイント
  DEFAULT_BASE_URL: 'https://lpwebsample-api.web-sample2000-ea9.workers.dev',

  getEndpoint() {
    const customBase = window.API_BASE_URL || localStorage.getItem('d1_api_base_url') || this.DEFAULT_BASE_URL;
    return customBase.trim().replace(/\/+$/, '') + '/api/all';
  },
  getBaseUrl() {
    return window.API_BASE_URL || localStorage.getItem('d1_api_base_url') || this.DEFAULT_BASE_URL;
  },
  setBaseUrl(url) {
    if (url && url.trim() !== '') {
      localStorage.setItem('d1_api_base_url', url.trim());
    } else {
      localStorage.removeItem('d1_api_base_url');
    }
  }
};

/**
 * YouTube の動画IDを抽出
 */
function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * 画像アセットのローカルパス解決
 * (D1データベース内のファイル名を assets/ 以下のパスに補完)
 */
const DEFAULT_VISUAL_BACKGROUND = 'assets/visual/background/default_visualBackground.png';
const DEFAULT_THUMD_BACKGROUND = 'assets/visual/thumd/background/default_thumdBackground.png';
const DEFAULT_LINK_BUTTON_IMAGE = 'assets/link/defaultbutton.png';

function resolveAssetUrl(filename, type) {
  if (!filename) return '';
  if (filename.startsWith('asset/')) {
    filename = 'assets/' + filename.slice(6);
  }
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('/') || filename.startsWith('data:')) {
    return filename;
  }
  if (filename.startsWith('assets/')) {
    return filename;
  }
  switch (type) {
    case 'visual':
      return `assets/visual/visual/${filename}`;
    case 'thumd':
      return `assets/visual/thumd/${filename}`;
    case 'thumdBackground':
      return `assets/visual/thumd/background/${filename}`;
    case 'visualBackground':
      return `assets/visual/background/${filename}`;
    case 'gallery':
      return `assets/gallery/${filename}`;
    case 'shop':
      return `assets/shop/${filename}`;
    case 'link':
      return `assets/link/${filename}`;
    case 'movie':
      return `assets/movieImage/${filename}`;
    default:
      return `assets/${filename}`;
  }
}

/**
 * サムネイル背景画像URLの解決
 * (未設定の場合は schema/visual.yaml の default_thumdBackground.png を参照)
 */
function getThumdBackgroundUrl(bgFilename) {
  if (!bgFilename || typeof bgFilename !== 'string') {
    return DEFAULT_THUMD_BACKGROUND;
  }
  const trimmed = bgFilename.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '-') {
    return DEFAULT_THUMD_BACKGROUND;
  }
  return resolveAssetUrl(trimmed, 'thumdBackground');
}

/**
 * リンクリストのボタン背景画像URLの解決
 * (未設定の場合は schema/linkList.yaml の defaultbutton.png を参照)
 */
function getLinkButtonImageUrl(imgFilename) {
  if (!imgFilename || typeof imgFilename !== 'string') {
    return DEFAULT_LINK_BUTTON_IMAGE;
  }
  let trimmed = imgFilename.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '-') {
    return DEFAULT_LINK_BUTTON_IMAGE;
  }
  // 拡張子が省略されている場合は .png を補完
  if (!trimmed.includes('.') && !trimmed.startsWith('data:')) {
    trimmed += '.png';
  }
  return resolveAssetUrl(trimmed, 'link');
}

/**
 * ページ全体の背景画像を更新
 * (未設定の場合は schema/visual.yaml の default 背景画像を参照)
 */
function applyVisualBackground(bgFilename) {
  let bgPath = DEFAULT_VISUAL_BACKGROUND;
  if (bgFilename && typeof bgFilename === 'string') {
    const trimmed = bgFilename.trim();
    if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== '-') {
      bgPath = resolveAssetUrl(trimmed, 'visualBackground');
    }
  }

  console.log('[Visual Background Applied]:', bgPath);

  const bgEl = document.getElementById('page-bg-layer');
  if (bgEl) {
    bgEl.style.backgroundImage = `url('${bgPath}')`;
  }
  document.body.style.backgroundImage = `url('${bgPath}')`;
}

/**
 * Cloudflare Workers APIから全テーブルデータを取得
 */
async function fetchD1DatabaseData() {
  const endpoint = API_CONFIG.getEndpoint();
  console.log(`[D1 Fetch] Accessing API: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}


// ============================================================
// 2. セクション管理コントローラー (SectionManager)
// ============================================================
class SectionManager {
  static STORAGE_KEY = 'lp_section_config';

  static SECTION_LABELS = {
    notice: "お知らせ (Notice)",
    schedule: "スケジュール (Schedule)",
    gallery: "ギャラリー (Gallery)",
    movie: "動画リスト (Movie)",
    shop: "ショップリスト (Shop)",
    linkList: "リンクリスト (LinkList)"
  };

  static DEFAULT_CONFIG = {
    order: ["notice", "schedule", "gallery", "movie", "shop", "linkList"],
    visibility: {
      notice: true,
      schedule: true,
      gallery: true,
      movie: true,
      shop: true,
      linkList: true
    }
  };

  static getConfig() {
    try {
      const stored = localStorage.getItem(SectionManager.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("LocalStorage read failed:", e);
    }
    return JSON.parse(JSON.stringify(SectionManager.DEFAULT_CONFIG));
  }

  static saveConfig(config) {
    try {
      localStorage.setItem(SectionManager.STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("LocalStorage write failed:", e);
    }
  }

  static resetConfig() {
    try {
      localStorage.removeItem(SectionManager.STORAGE_KEY);
    } catch (e) {
      console.warn("LocalStorage reset failed:", e);
    }
    SectionManager.applyConfig(SectionManager.DEFAULT_CONFIG);
    SectionManager.renderAdminPanel();
  }

  static applyConfig(config) {
    const container = document.getElementById('section-container');
    if (!container) return;

    if (Array.isArray(config.order)) {
      config.order.forEach(sectionId => {
        const sectionEl = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionEl) {
          container.appendChild(sectionEl);
        }
      });
    }

    if (config.visibility) {
      Object.entries(config.visibility).forEach(([sectionId, isVisible]) => {
        const sectionEl = document.querySelector(`[data-section-id="${sectionId}"]`);
        const navItemEl = document.querySelector(`[data-nav-for="${sectionId}"]`);

        if (sectionEl) {
          if (isVisible) {
            sectionEl.classList.remove('is-hidden');
          } else {
            sectionEl.classList.add('is-hidden');
          }
        }

        if (navItemEl) {
          navItemEl.style.display = isVisible ? '' : 'none';
        }
      });
    }

    SectionManager.saveConfig(config);
  }
}

window.SectionManager = SectionManager;
window.API_CONFIG = API_CONFIG;


// ============================================================
// 3. 各セクションの描画ロジック (D1 レスポンス構造対応)
// ============================================================
function applyAllData(data) {
  if (!data) return;
  renderProfileAndVisual(data.profile, data.visual);
  renderNotices(data.notice);
  renderSchedules(data.scheduleTag, data.schedule);
  renderGalleries(data.galley);
  renderGalleries(data.gallery || data.galley);
  renderMovies(data.movieLabel, data.movie);
  renderShops(data.shopTag, data.shop);
  renderLinks(data.linkList);
}

function renderProfileAndVisual(profile, visuals) {
  if (profile) {
    if (profile.name) {
      document.title = `${profile.name} Official Website`;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && (profile.comment || profile.name)) {
      metaDesc.content = `${profile.name || ''} オフィシャルサイト。${profile.comment || ''}`.trim();
    }

    const logoEl = document.querySelector('.logo-text');
    if (logoEl) {
      logoEl.textContent = profile.romanization || profile.name || '';
    }

    // ヘッダーSNSリンク
    const navYt = document.getElementById('nav-sns-yt');
    if (navYt) {
      if (profile.youtubeUrl) {
        navYt.href = profile.youtubeUrl;
        navYt.style.display = '';
      } else {
        navYt.style.display = 'none';
      }
    }
    const navX = document.getElementById('nav-sns-x');
    if (navX) {
      if (profile.xUrl) {
        navX.href = profile.xUrl;
        navX.style.display = '';
      } else {
        navX.style.display = 'none';
      }
    }

    setText('prof-name', profile.name);
    setText('prof-pronunciation', profile.pronunciation);
    setText('prof-romanization', profile.romanization);
    setText('prof-nickname', profile.nickname);
    setText('prof-comment', profile.comment);
    
    const msgEl = document.getElementById('prof-message');
    if (msgEl) {
      msgEl.innerHTML = profile.message ? escapeHtml(profile.message).replace(/\n/g, '<br>') : '';
    }

    setText('prof-birthday', profile.birthday);
    setText('prof-streaming', profile.streaming);

    const ageEl = document.getElementById('prof-age');
    const ageUnitEl = document.getElementById('prof-age-unit');
    if (ageEl) ageEl.textContent = (profile.age !== undefined && profile.age !== null) ? profile.age : '';
    if (ageUnitEl) ageUnitEl.textContent = (profile.age !== undefined && profile.age !== null && String(profile.age).trim() !== '') ? ' 歳' : '';

    const heightEl = document.getElementById('prof-height');
    const heightUnitEl = document.getElementById('prof-height-unit');
    if (heightEl) heightEl.textContent = (profile.height !== undefined && profile.height !== null) ? profile.height : '';
    if (heightUnitEl) heightUnitEl.textContent = (profile.height !== undefined && profile.height !== null && String(profile.height).trim() !== '') ? ' cm' : '';

    setText('prof-fanName', profile.fanName);

    // プロフィール内 SNSリンク
    const ytEl = document.getElementById('prof-youtube');
    if (ytEl) {
      if (profile.youtubeUrl) {
        ytEl.href = profile.youtubeUrl;
        ytEl.style.display = '';
      } else {
        ytEl.style.display = 'none';
      }
    }
    
    const xEl = document.getElementById('prof-x');
    if (xEl) {
      if (profile.xUrl) {
        xEl.href = profile.xUrl;
        xEl.style.display = '';
      } else {
        xEl.style.display = 'none';
      }
    }

    // フッターブランド＆コピーライト
    const footerBrand = document.getElementById('footer-brand-name');
    if (footerBrand) {
      footerBrand.textContent = profile.name ? `${profile.name} Official Web` : 'Official Web';
    }
    const footerDesc = document.getElementById('footer-brand-desc');
    if (footerDesc) {
      footerDesc.textContent = profile.comment || '';
    }
    const footerCopy = document.getElementById('footer-copyright');
    if (footerCopy) {
      const year = new Date().getFullYear();
      const nameStr = profile.romanization || profile.name || 'Official Web';
      footerCopy.innerHTML = `&copy; ${year} ${escapeHtml(nameStr)}. All Rights Reserved.`;
    }

    // platforms (配列・JSON文字列・または platforms_link_1..3 に対応)
    let platforms = [];
    if (Array.isArray(profile.platforms)) {
      platforms = profile.platforms;
    } else if (typeof profile.platforms === 'string') {
      try { platforms = JSON.parse(profile.platforms); } catch (e) {}
    } else {
      for (let i = 1; i <= 3; i++) {
        const name = profile[`platforms_name_${i}`];
        const link = profile[`platforms_link_${i}`];
        if (link) {
          platforms.push({ name: name || `Platform ${i}`, link });
        }
      }
    }

    const platformBox = document.getElementById('prof-platforms');
    if (platformBox && Array.isArray(platforms)) {
      platformBox.querySelectorAll('.custom-platform').forEach(el => el.remove());
      platforms.forEach(p => {
        if (!p || !p.link) return;
        const a = document.createElement('a');
        a.className = 'channel-link custom-platform';
        a.href = p.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.innerHTML = `<span>${escapeHtml(p.name || 'Platform')}</span>`;
        platformBox.appendChild(a);
      });
    }

    // moves (配列・JSON文字列・または moves_1..3 に対応)
    let moves = [];
    if (Array.isArray(profile.moves)) {
      moves = profile.moves;
    } else if (typeof profile.moves === 'string') {
      try { moves = JSON.parse(profile.moves); } catch (e) {}
    } else {
      for (let i = 1; i <= 3; i++) {
        const url = profile[`moves_${i}`];
        if (url) {
          moves.push({ title: `自己紹介動画 #${i}`, url });
        }
      }
    }

    const movesBox = document.getElementById('prof-moves-buttons');
    if (movesBox && Array.isArray(moves)) {
      movesBox.innerHTML = '';
      moves.forEach((move, i) => {
        const url = typeof move === 'string' ? move : (move.url || move.link);
        const title = (typeof move === 'object' && move.title) ? move.title : `自己紹介動画 #${i + 1}`;
        if (!url) return;

        // サムネイル画像の取得（YouTube動画の場合は高画質maxresdefaultを優先し、非対応時はhqdefaultへフォールバック）
        let thumbUrl = (typeof move === 'object' && move.thumbnail) ? move.thumbnail : '';
        let fallbackThumbUrl = '';
        if (!thumbUrl) {
          const ytId = getYouTubeId(url);
          if (ytId) {
            thumbUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
            fallbackThumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
          }
        }

        const btn = document.createElement('button');
        btn.className = 'intro-movie-card';
        btn.type = 'button';
        btn.title = title;
        btn.setAttribute('aria-label', `${title} を再生`);
        btn.innerHTML = `
          <div class="intro-movie-thumb-wrapper">
            ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(title)}" loading="lazy"${fallbackThumbUrl ? ` onerror="this.onerror=null;this.src='${escapeHtml(fallbackThumbUrl)}';"` : ''}>` : `<div class="intro-movie-placeholder"><svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg></div>`}
            <div class="intro-movie-play-badge">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        `;
        btn.addEventListener('click', () => openVideoModal(url, title));
        movesBox.appendChild(btn);
      });
    }
  }

  if (Array.isArray(visuals) && visuals.length > 0) {
    const thumbsContainer = document.getElementById('costume-thumbs');
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = '';

    visuals.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    visuals.forEach((vis, index) => {
      const thumdPath = resolveAssetUrl(vis.thumdUrl || vis.visualUrl, 'thumd');
      const thumdBgPath = getThumdBackgroundUrl(vis.thumdBackground || vis.thumd_background);
      const btn = document.createElement('button');
      btn.className = `costume-thumb-btn ${index === 0 ? 'active' : ''}`;
      if (vis.costumeName) btn.title = vis.costumeName;
      btn.setAttribute('aria-label', vis.costumeName || `衣装 #${vis.id}`);
      btn.innerHTML = `
        <div class="costume-thumb-wrapper">
          <img class="costume-thumb-bg" src="${escapeHtml(thumdBgPath)}" alt="" loading="lazy">
          <img class="costume-thumb-img" src="${escapeHtml(thumdPath)}" alt="${escapeHtml(vis.costumeName || '衣装')}" loading="lazy">
        </div>
      `;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.costume-thumb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchVisual(vis);
      });
      thumbsContainer.appendChild(btn);
    });

    switchVisual(visuals[0], true);
  }
}

let visualSwitchTimeout = null;

function switchVisual(visual, isInitial = false) {
  if (!visual) return;
  const mainImg = document.getElementById('current-visual-img');
  const badge = document.getElementById('current-costume-badge');

  // ページ全体の背景画像を visualBackground (未設定時は default 背景) に更新
  const targetBg = visual.visualBackground || visual.visual_background;
  applyVisualBackground(targetBg);

  const visualPath = resolveAssetUrl(visual.visualUrl, 'visual');

  if (badge) {
    badge.textContent = visual.costumeName || '衣装';
  }

  setText('credit-characterDesign', visual.characterDesign || '-');
  setText('credit-illustrator', visual.illustrator || '-');
  setText('credit-live2d', visual.live2d || '-');
  
  const modeling3d = visual['3dModeling'] || visual['modeling3d'];
  const row3d = document.getElementById('credit-row-3d');
  if (row3d) {
    if (modeling3d) {
      row3d.style.display = 'flex';
      setText('credit-3dModeling', modeling3d);
    } else {
      row3d.style.display = 'none';
    }
  }

  if (mainImg) {
    // 初回表示時はアニメーションなしで即時セット
    if (isInitial) {
      mainImg.src = visualPath;
      mainImg.alt = visual.costumeName || '立ち絵';
      mainImg.classList.remove('is-slide-out', 'is-slide-in-prep');
      mainImg.dataset.currentSrc = visualPath;
      return;
    }

    // すでに同じ画像が表示されている場合はスキップ
    if (mainImg.dataset.currentSrc === visualPath) {
      return;
    }
    mainImg.dataset.currentSrc = visualPath;

    // 前のアニメーションタイマーがあればクリア
    if (visualSwitchTimeout) {
      clearTimeout(visualSwitchTimeout);
      visualSwitchTimeout = null;
    }

    // 1. 右へスライドしながらフェードアウト
    mainImg.classList.remove('is-slide-in-prep');
    mainImg.classList.add('is-slide-out');

    // フェードアウト所要時間（240ms）後に新しい画像を右側からスライドイン
    visualSwitchTimeout = setTimeout(() => {
      // 2. 画像差し替え & 右側初期位置へセット（トランジション無効化）
      mainImg.src = visualPath;
      mainImg.alt = visual.costumeName || '立ち絵';
      mainImg.classList.remove('is-slide-out');
      mainImg.classList.add('is-slide-in-prep');

      // リフロー強制（ブラウザに初期位置を認識させる）
      void mainImg.offsetWidth;

      // 3. 次の描画フレームで初期位置から中央へスライドイン＆フェードイン
      requestAnimationFrame(() => {
        mainImg.classList.remove('is-slide-in-prep');
      });
    }, 240);
  }
}

function renderNotices(notices) {
  const container = document.getElementById('notice-container');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(notices) || notices.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:30px;">現在お知らせはありません。</p>';
    return;
  }

  notices.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'notice-card';

    const rawDate = notice.created_at || notice.scheduled_at || '';
    const dateStr = rawDate ? rawDate.split(' ')[0].replace(/-/g, '.') : '';
    const statusClass = notice.status === 'published' ? 'badge-published' : 'badge-scheduled';
    const statusText = notice.status === 'published' ? '公開中' : '予約';
    const picUrl = notice.picture ? resolveAssetUrl(notice.picture, 'notice') : null;

    card.innerHTML = `
      <div class="notice-meta">
        <span class="notice-date">${dateStr}</span>
        <span class="notice-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="notice-content">
        ${escapeHtml(notice.message)}
      </div>
      ${picUrl ? `
        <div class="notice-media-thumb" data-full-img="${escapeHtml(picUrl)}" data-caption="お知らせ添付画像">
          <img src="${escapeHtml(picUrl)}" alt="添付画像">
        </div>
      ` : ''}
    `;

    const thumb = card.querySelector('.notice-media-thumb');
    if (thumb) {
      thumb.addEventListener('click', () => {
        openImageModal(thumb.dataset.fullImg, thumb.dataset.caption);
      });
    }

    container.appendChild(card);
  });
}

function renderSchedules(tags, schedules) {
  const tabContainer = document.getElementById('schedule-filter-tabs');
  const container = document.getElementById('schedule-container');
  if (!tabContainer || !container) return;

  const tagMap = {};
  if (Array.isArray(tags)) {
    tags.forEach(t => { tagMap[t.id] = t.tagName; });
  }

  // scheduleTag タブの生成
  tabContainer.innerHTML = '<button class="filter-tab active" data-tag-id="all">すべて</button>';
  if (Array.isArray(tags)) {
    tags.forEach(tag => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab';
      tab.dataset.tagId = tag.id;
      tab.textContent = tag.tagName;
      tabContainer.appendChild(tab);
    });
  }

  // 日付操作ユーティリティ
  function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getMonday(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay(); // 0: 日, 1: 月, ..., 6: 土
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  function addDays(d, days) {
    const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    result.setDate(result.getDate() + days);
    return result;
  }

  const WEEK_DAYS = [
    { ja: '月', en: 'MON' },
    { ja: '火', en: 'TUE' },
    { ja: '水', en: 'WED' },
    { ja: '木', en: 'THU' },
    { ja: '金', en: 'FRI' },
    { ja: '土', en: 'SAT', isSat: true },
    { ja: '日', en: 'SUN', isSun: true }
  ];

  const today = new Date();
  const todayYMD = toYMD(today);

  // 状態管理
  let currentWeekMonday = getMonday(today);
  let selectedDateYMD = todayYMD;
  let currentFilterTagId = 'all';
  let isInitial = true;

  const allItems = Array.isArray(schedules) ? schedules : [];

  // カレンダーとぶら下がりタスクを再描画する関数
  function updateView() {
    container.innerHTML = '';

    // 有効なスケジュールをフィルタリング（タグ絞り込み含む）
    const activeItems = allItems.filter(s => {
      const active = (s.is_active === 1 || s.is_active === true || s.is_active === "1");
      if (!active) return false;
      if (currentFilterTagId === 'all') return true;
      return String(s.scheduleTag) === String(currentFilterTagId);
    });

    // 日付ごとのスケジュール配列マップを作成
    const dateScheduleMap = {};
    activeItems.forEach(item => {
      if (!item.schedule_at) return;
      const dStr = item.schedule_at.split(' ')[0].trim();
      if (!dateScheduleMap[dStr]) {
        dateScheduleMap[dStr] = [];
      }
      dateScheduleMap[dStr].push(item);
    });

    // 現在週の7日間の日付を算出（月曜〜日曜）
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentWeekMonday, i);
      weekDates.push({
        dateObj: d,
        ymd: toYMD(d),
        month: d.getMonth() + 1,
        day: d.getDate(),
        ...WEEK_DAYS[i]
      });
    }

    // 初回ロード時、または選択中の日付が当週に含まれていない場合のスマート選択
    const isSelectedInWeek = weekDates.some(w => w.ymd === selectedDateYMD);
    if (isInitial || !isSelectedInWeek) {
      // 1. 今日に予定があれば今日
      if (dateScheduleMap[todayYMD] && dateScheduleMap[todayYMD].length > 0 && weekDates.some(w => w.ymd === todayYMD)) {
        selectedDateYMD = todayYMD;
      } else {
        // 2. 今日以降（未来）で予定がある直近の日
        const futureEvent = weekDates.find(w => w.ymd >= todayYMD && dateScheduleMap[w.ymd] && dateScheduleMap[w.ymd].length > 0);
        if (futureEvent) {
          selectedDateYMD = futureEvent.ymd;
        } else {
          // 3. 当週内のいずれかの予定日
          const anyEvent = weekDates.find(w => dateScheduleMap[w.ymd] && dateScheduleMap[w.ymd].length > 0);
          if (anyEvent) {
            selectedDateYMD = anyEvent.ymd;
          } else {
            // 4. 今週であれば今日、他週であれば月曜日
            selectedDateYMD = weekDates.some(w => w.ymd === todayYMD) ? todayYMD : weekDates[0].ymd;
          }
        }
      }
      isInitial = false;
    }

    const startD = weekDates[0];
    const endD = weekDates[6];
    const rangeLabel = `${startD.dateObj.getFullYear()}年${startD.month}月${startD.day}日(${startD.ja}) 〜 ${endD.dateObj.getFullYear() !== startD.dateObj.getFullYear() ? endD.dateObj.getFullYear() + '年' : ''}${endD.month}月${endD.day}日(${endD.ja})`;

    const thisWeekMondayYMD = toYMD(getMonday(today));
    const isCurrentWeek = toYMD(currentWeekMonday) === thisWeekMondayYMD;

    // 1. 週ナビゲーション
    const navEl = document.createElement('div');
    navEl.className = 'schedule-week-nav';
    navEl.innerHTML = `
      <div class="schedule-nav-controls">
        <button type="button" class="schedule-nav-btn schedule-nav-prev" aria-label="前の週へ">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>前の週</span>
        </button>
        <button type="button" class="schedule-nav-today-btn ${isCurrentWeek ? 'is-disabled' : ''}" aria-label="今週へジャンプ">
          今週
        </button>
        <button type="button" class="schedule-nav-btn schedule-nav-next" aria-label="次の週へ">
          <span>次の週</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
      <div class="schedule-week-range-text">
        <span class="schedule-range-icon">📅</span>
        <span class="schedule-range-dates">${escapeHtml(rangeLabel)}</span>
      </div>
    `;

    navEl.querySelector('.schedule-nav-prev').addEventListener('click', () => {
      currentWeekMonday = addDays(currentWeekMonday, -7);
      isInitial = true;
      updateView();
    });

    navEl.querySelector('.schedule-nav-next').addEventListener('click', () => {
      currentWeekMonday = addDays(currentWeekMonday, 7);
      isInitial = true;
      updateView();
    });

    navEl.querySelector('.schedule-nav-today-btn').addEventListener('click', () => {
      currentWeekMonday = getMonday(today);
      selectedDateYMD = todayYMD;
      isInitial = true;
      updateView();
    });

    container.appendChild(navEl);

    // 2. 7日間カレンダーバー
    const stripEl = document.createElement('div');
    stripEl.className = 'schedule-week-strip';
    stripEl.setAttribute('role', 'tablist');
    stripEl.setAttribute('aria-label', '週間カレンダー');

    weekDates.forEach((w) => {
      const itemsForDay = dateScheduleMap[w.ymd] || [];
      const hasSchedule = itemsForDay.length > 0;
      const isSelected = (w.ymd === selectedDateYMD);
      const isToday = (w.ymd === todayYMD);

      const slotBtn = document.createElement('button');
      slotBtn.type = 'button';
      slotBtn.className = `schedule-day-slot ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''} ${hasSchedule ? 'has-schedule' : ''}`;
      slotBtn.setAttribute('role', 'tab');
      slotBtn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      slotBtn.setAttribute('aria-label', `${w.month}月${w.day}日 ${w.ja}曜日 ${hasSchedule ? `${itemsForDay.length}件の予定` : '予定なし'}`);

      let dowClass = 'dow-weekday';
      if (w.isSat) dowClass = 'dow-sat';
      if (w.isSun) dowClass = 'dow-sun';

      slotBtn.innerHTML = `
        <div class="schedule-day-dow ${dowClass}">${w.ja}</div>
        <div class="schedule-day-num">${w.day}</div>
        ${isToday ? '<span class="schedule-today-pill">TODAY</span>' : ''}
        <div class="schedule-slot-status">
          ${hasSchedule ? `
            <span class="schedule-slot-dot"></span>
            <span class="schedule-slot-badge">${itemsForDay.length}件</span>
          ` : `
            <span class="schedule-slot-empty-dot"></span>
          `}
        </div>
        ${isSelected ? '<span class="schedule-slot-pointer"></span>' : ''}
      `;

      slotBtn.addEventListener('click', () => {
        if (selectedDateYMD !== w.ymd) {
          selectedDateYMD = w.ymd;
          updateView();
        }
      });

      stripEl.appendChild(slotBtn);
    });

    container.appendChild(stripEl);

    // 3. 対象日のぶら下がりタスクエリア
    const dayTasksArea = document.createElement('div');
    dayTasksArea.className = 'schedule-day-tasks';

    // 選択日の詳細表示情報
    const selectedDateObj = weekDates.find(w => w.ymd === selectedDateYMD);
    let selectedTitle = selectedDateYMD;
    let selectedDow = '';
    if (selectedDateObj) {
      selectedTitle = `${selectedDateObj.month}月${selectedDateObj.day}日`;
      selectedDow = `(${selectedDateObj.ja})`;
    } else {
      const parts = selectedDateYMD.split('-');
      if (parts.length === 3) {
        selectedTitle = `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
      }
    }

    const currentDayItems = dateScheduleMap[selectedDateYMD] || [];
    // 時間順にソート（時間が空のものは後ろへ）
    currentDayItems.sort((a, b) => {
      const tA = a.time || '99:99';
      const tB = b.time || '99:99';
      return tA.localeCompare(tB);
    });

    // タスクエリアヘッダー
    const headerEl = document.createElement('div');
    headerEl.className = 'schedule-tasks-header';
    headerEl.innerHTML = `
      <div class="schedule-tasks-heading">
        <span class="schedule-heading-accent"></span>
        <h3 class="schedule-day-heading-title">
          <span class="schedule-day-date-text">${escapeHtml(selectedTitle)} <span class="schedule-day-dow-text">${escapeHtml(selectedDow)}</span></span>
          <span class="schedule-day-subtext">の予定</span>
        </h3>
        <span class="schedule-tasks-count-badge ${currentDayItems.length > 0 ? 'has-count' : 'is-zero'}">
          ${currentDayItems.length}件
        </span>
      </div>
      ${selectedDateYMD === todayYMD ? '<span class="schedule-today-tag">本日</span>' : ''}
    `;
    dayTasksArea.appendChild(headerEl);

    // タスクカード一覧または空表示
    if (currentDayItems.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'schedule-empty-box';
      emptyBox.innerHTML = `
        <div class="schedule-empty-icon">☕</div>
        <p class="schedule-empty-title">この日のスケジュールはありません</p>
        <p class="schedule-empty-hint">カレンダーの日付をタップすると、その日の予定を確認できます</p>
      `;
      dayTasksArea.appendChild(emptyBox);
    } else {
      const taskGrid = document.createElement('div');
      taskGrid.className = 'schedule-tasks-grid';

      currentDayItems.forEach(item => {
        const tagName = tagMap[item.scheduleTag] || 'イベント';
        const picUrl = item.picture ? resolveAssetUrl(item.picture, 'schedule') : null;
        const card = document.createElement('div');
        card.className = 'schedule-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${item.title || 'スケジュール'} の詳細を表示`);

        const dateText = item.schedule_at || selectedDateYMD;
        const timeText = item.time ? `${item.time}〜` : '時間未定';

        card.innerHTML = `
          <div class="schedule-card-body">
            <div class="schedule-date-tag-row">
              <div class="schedule-datetime">
                <span class="schedule-date">${escapeHtml(dateText)}</span>
                <span class="schedule-time">${escapeHtml(timeText)}</span>
              </div>
              <span class="schedule-tag-badge">${escapeHtml(tagName)}</span>
            </div>
            <h4 class="schedule-card-title">${escapeHtml(item.title)}</h4>
            <div class="schedule-card-footer">
              <span>詳細を見る</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          openScheduleModal(item, tagName, picUrl);
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openScheduleModal(item, tagName, picUrl);
          }
        });

        taskGrid.appendChild(card);
      });

      dayTasksArea.appendChild(taskGrid);
    }

    container.appendChild(dayTasksArea);
  }

  // タブクリックイベント
  tabContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.filter-tab');
    if (!target) return;
    tabContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    currentFilterTagId = target.dataset.tagId;
    updateView();
  });

  // 初回描画
  updateView();
}

function renderGalleries(galleries) {
  const container = document.getElementById('gallery-container');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(galleries) || galleries.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;grid-column:1/-1;padding:30px;">ギャラリー画像はまだありません。</p>';
    return;
  }

  galleries.sort((a, b) => (a.priority || 0) - (b.priority || 0));

  galleries.forEach(item => {
    const imgUrl = resolveAssetUrl(item.imageUrl, 'gallery');
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
      <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name || 'ギャラリー画像')}">
      <div class="gallery-overlay">
        <div class="gallery-name">${escapeHtml(item.name || '')}</div>
        <div class="gallery-zoom-hint">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          拡大表示
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openImageModal(imgUrl, item.name || 'ギャラリー');
    });

    container.appendChild(card);
  });
}

function renderMovies(labels, movies) {
  const tabContainer = document.getElementById('movie-filter-tabs');
  const gridContainer = document.getElementById('movie-container');
  if (!tabContainer || !gridContainer) return;

  const labelMap = {};
  if (Array.isArray(labels)) {
    labels.forEach(l => { labelMap[l.id] = l.tagLabel; });
  }

  tabContainer.innerHTML = '<button class="filter-tab active" data-label-id="all">すべて</button>';
  if (Array.isArray(labels)) {
    labels.forEach(lbl => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab';
      tab.dataset.labelId = lbl.id;
      tab.textContent = lbl.tagLabel;
      tabContainer.appendChild(tab);
    });
  }

  function displayMovies(filterLabelId = 'all') {
    gridContainer.innerHTML = '';
    const items = Array.isArray(movies) ? movies : [];

    const filtered = items.filter(m => {
      const active = (m.is_active === 1 || m.is_active === true || m.is_active === "1");
      if (!active) return false;
      if (filterLabelId === 'all') return true;
      return String(m.tagLabel) === String(filterLabelId);
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = '<p class="text-muted" style="text-align:center;grid-column:1/-1;padding:30px;">動画はありません。</p>';
      return;
    }

    filtered.forEach(item => {
      const tagName = labelMap[item.tagLabel] || '動画';
      
      // サムネイルURL判定（未入力の場合はYouTube動画IDから高画質maxresdefaultを優先、非対応時はhqdefaultへフォールバック）
      let imgUrl = item.imageUrl ? resolveAssetUrl(item.imageUrl, 'movie') : '';
      let fallbackImgUrl = '';
      if (!imgUrl && item.videoUrl) {
        const ytId = getYouTubeId(item.videoUrl);
        if (ytId) {
          imgUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
          fallbackImgUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
      }

      const card = document.createElement('div');
      card.className = 'movie-card';
      card.innerHTML = `
        <div class="movie-thumb-wrapper">
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" loading="lazy"${fallbackImgUrl ? ` onerror="this.onerror=null;this.src='${escapeHtml(fallbackImgUrl)}';"` : ''}>
          <div class="movie-play-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="movie-card-body">
          <span class="movie-tag">${escapeHtml(tagName)}</span>
          <h3 class="movie-card-title">${escapeHtml(item.title)}</h3>
        </div>
      `;

      card.addEventListener('click', () => {
        openVideoModal(item.videoUrl, item.title);
      });

      gridContainer.appendChild(card);
    });
  }

  tabContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.filter-tab');
    if (!target) return;
    tabContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    displayMovies(target.dataset.labelId);
  });

  displayMovies('all');
}

function renderShops(tags, shops) {
  const tabContainer = document.getElementById('shop-filter-tabs');
  const gridContainer = document.getElementById('shop-container');
  let paginationContainer = document.getElementById('shop-pagination');
  if (!tabContainer || !gridContainer) return;

  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'shop-pagination';
    paginationContainer.className = 'shop-pagination';
    gridContainer.after(paginationContainer);
  }

  const tagMap = {};
  if (Array.isArray(tags)) {
    tags.forEach(t => { tagMap[t.id] = t.tagName; });
  }

  tabContainer.innerHTML = '<button class="filter-tab active" data-shop-tag="all">すべて</button>';
  if (Array.isArray(tags)) {
    tags.forEach(tag => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab';
      tab.dataset.shopTag = tag.id;
      tab.textContent = tag.tagName;
      tabContainer.appendChild(tab);
    });
  }

  let currentFilterTag = 'all';
  let currentPage = 1;

  // 画面幅に応じた1ページあたりの件数判定
  // PC画面（> 860px）: 4列 × 2行 = 8件
  // スマホなどの縦長画面（<= 860px）: 2列 × 3行 = 6件
  function getItemsPerPage() {
    return window.innerWidth <= 860 ? 6 : 8;
  }

  function renderPagination(totalPages) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    // 前へボタン
    const prevBtn = document.createElement('button');
    prevBtn.className = 'shop-page-btn shop-page-prev';
    prevBtn.innerHTML = '&lt; 前へ';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        displayShops(currentFilterTag, currentPage - 1, true);
      }
    });
    paginationContainer.appendChild(prevBtn);

    // ページ番号ボタン
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7) {
        if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
          if (p === 2 || p === totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'shop-page-ellipsis';
            ellipsis.textContent = '…';
            paginationContainer.appendChild(ellipsis);
          }
          continue;
        }
      }

      const pageBtn = document.createElement('button');
      pageBtn.className = `shop-page-btn ${p === currentPage ? 'active' : ''}`;
      pageBtn.textContent = p;
      if (p === currentPage) {
        pageBtn.disabled = true;
      } else {
        pageBtn.addEventListener('click', () => {
          displayShops(currentFilterTag, p, true);
        });
      }
      paginationContainer.appendChild(pageBtn);
    }

    // 次へボタン
    const nextBtn = document.createElement('button');
    nextBtn.className = 'shop-page-btn shop-page-next';
    nextBtn.innerHTML = '次へ &gt;';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        displayShops(currentFilterTag, currentPage + 1, true);
      }
    });
    paginationContainer.appendChild(nextBtn);
  }

  function displayShops(filterTag = 'all', page = 1, scrollToTop = false) {
    currentFilterTag = filterTag;
    currentPage = page;
    gridContainer.innerHTML = '';

    const items = Array.isArray(shops) ? shops : [];
    const filtered = items.filter(s => {
      if (filterTag === 'all') return true;
      return String(s.shopTag) === String(filterTag);
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = '<p class="text-muted" style="text-align:center;grid-column:1/-1;padding:30px;">グッズはありません。</p>';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    filtered.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    pageItems.forEach(item => {
      const tagName = tagMap[item.shopTag] || 'グッズ';
      const imgUrl = resolveAssetUrl(item.merchandiseImage, 'shop');
      const card = document.createElement('div');
      card.className = 'shop-card';

      card.innerHTML = `
        <div class="shop-image-wrapper">
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name)}">
          <span class="shop-tag-badge">${escapeHtml(tagName)}</span>
        </div>
        <div class="shop-card-body">
          <h3 class="shop-card-title">${escapeHtml(item.name)}</h3>
          <div class="shop-price-row">
            <span class="shop-currency">¥</span>
            <span class="shop-price-val">${Number(item.price || 0).toLocaleString()}</span>
          </div>
          <button type="button" class="btn-shop-buy">
            <svg class="cart-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span>購入はこちら</span>
          </button>
        </div>
      `;

      const buyBtn = card.querySelector('.btn-shop-buy');
      if (buyBtn) {
        buyBtn.addEventListener('click', () => {
          openShopModal(item, imgUrl);
        });
      }

      gridContainer.appendChild(card);
    });

    renderPagination(totalPages);

    if (scrollToTop) {
      const sectionEl = document.getElementById('sec-shop');
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  tabContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.filter-tab');
    if (!target) return;
    tabContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    displayShops(target.dataset.shopTag, 1, false);
  });

  // 画面リサイズ時に1ページあたり件数が切り替わったら再描画
  let lastItemsPerPage = getItemsPerPage();
  window.addEventListener('resize', () => {
    const newItemsPerPage = getItemsPerPage();
    if (newItemsPerPage !== lastItemsPerPage) {
      lastItemsPerPage = newItemsPerPage;
      displayShops(currentFilterTag, 1, false);
    }
  });

  displayShops('all', 1, false);
}

function renderLinks(linkLists) {
  const container = document.getElementById('link-container');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(linkLists) || linkLists.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:30px;">リンクはありません。</p>';
    return;
  }

  linkLists.sort((a, b) => (a.priority || 0) - (b.priority || 0));

  linkLists.forEach(item => {
    const buttonImgUrl = getLinkButtonImageUrl(item.buttonImage);
    const card = document.createElement('a');
    card.className = 'link-card';
    card.href = item.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <img class="link-card-bg" src="${escapeHtml(buttonImgUrl)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_LINK_BUTTON_IMAGE)}';">
      <div class="link-card-left">
        <div class="link-card-icon">✦</div>
        <span class="link-card-title">${escapeHtml(item.title)}</span>
      </div>
      <div class="link-card-arrow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    `;
    container.appendChild(card);
  });
}


// ============================================================
// 4. モーダル制御
// ============================================================
function openImageModal(imgSrc, caption = '') {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('image-modal-img');
  const cap = document.getElementById('image-modal-caption');
  if (!modal || !img) return;

  img.src = imgSrc;
  if (cap) cap.textContent = caption;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openVideoModal(videoUrl, title = '') {
  const modal = document.getElementById('video-modal');
  const iframe = document.getElementById('video-modal-iframe');
  const titleEl = document.getElementById('video-modal-title');
  if (!modal || !iframe) return;

  let embedUrl = videoUrl;
  const ytId = getYouTubeId(videoUrl);
  if (ytId) {
    embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
  }

  iframe.src = embedUrl;
  if (titleEl) titleEl.textContent = title;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeVideoModal() {
  const modal = document.getElementById('video-modal');
  const iframe = document.getElementById('video-modal-iframe');
  if (!modal) return;
  if (iframe) iframe.src = '';
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openShopModal(item, imgUrl) {
  const modal = document.getElementById('shop-modal');
  if (!modal) return;

  const thumbEl = document.getElementById('shop-modal-thumb');
  const titleEl = document.getElementById('shop-modal-title');
  const priceEl = document.getElementById('shop-modal-price');
  const linksContainer = document.getElementById('shop-modal-links');

  if (thumbEl) {
    thumbEl.src = imgUrl || '';
    thumbEl.alt = item.name || '';
  }
  if (titleEl) {
    titleEl.textContent = item.name || '';
  }
  if (priceEl) {
    priceEl.textContent = `¥${Number(item.price || 0).toLocaleString()}`;
  }

  if (linksContainer) {
    linksContainer.innerHTML = '';

    // プラットフォーム定義（画像2準拠のアイコン・テキスト・配色クラス）
    const platforms = [
      {
        id: 'booth',
        name: 'BOOTHで購入',
        url: item.booth,
        className: 'btn-mall-booth',
        icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>`
      },
      {
        id: 'suzuri',
        name: 'SUZURIで購入',
        url: item.suzuri,
        className: 'btn-mall-suzuri',
        icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 2l-4 3-4-3-6 4 3 4 2-1v12h10V8l2 1 3-4-6-4z"/></svg>`
      },
      {
        id: 'base',
        name: 'BASEで購入',
        url: item.base,
        className: 'btn-mall-base',
        icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>`
      },
      {
        id: 'fanbox',
        name: 'FANBOXで支援・購入',
        url: item.fanbox,
        className: 'btn-mall-fanbox',
        icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
      }
    ];

    let hasAnyLink = false;
    platforms.forEach(p => {
      const url = p.url ? String(p.url).trim() : '';
      if (url && url !== '-' && url !== 'null' && url !== 'undefined') {
        hasAnyLink = true;
        const btn = document.createElement('a');
        btn.href = url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.className = `shop-mall-btn ${p.className}`;
        btn.innerHTML = `
          <span class="mall-btn-left">
            <span class="mall-icon">${p.icon}</span>
            <span class="mall-text">${escapeHtml(p.name)}</span>
          </span>
          <span class="mall-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
        `;
        linksContainer.appendChild(btn);
      }
    });

    if (!hasAnyLink) {
      linksContainer.innerHTML = '<p class="text-muted" style="text-align:center;padding:16px 0;font-size:0.85rem;">現在設定されている購入先はありません。</p>';
    }
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeShopModal() {
  const modal = document.getElementById('shop-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openScheduleModal(item, tagName, picUrl) {
  const modal = document.getElementById('schedule-modal');
  if (!modal) return;

  const dateEl = document.getElementById('schedule-modal-date');
  const timeEl = document.getElementById('schedule-modal-time');
  const tagEl = document.getElementById('schedule-modal-tag');
  const titleEl = document.getElementById('schedule-modal-title');
  const imgWrap = document.getElementById('schedule-modal-img-wrap');
  const imgEl = document.getElementById('schedule-modal-img');
  const detailEl = document.getElementById('schedule-modal-detail');

  if (dateEl) dateEl.textContent = item.schedule_at || '';
  if (timeEl) timeEl.textContent = item.time ? `${item.time}〜` : '';
  if (tagEl) tagEl.textContent = tagName || 'イベント';
  if (titleEl) titleEl.textContent = item.title || '';

  if (imgWrap && imgEl) {
    if (picUrl) {
      imgEl.src = picUrl;
      imgEl.alt = item.title || 'スケジュール画像';
      imgWrap.style.display = 'block';
    } else {
      imgEl.src = '';
      imgWrap.style.display = 'none';
    }
  }

  if (detailEl) {
    if (item.detail) {
      detailEl.textContent = item.detail;
      detailEl.style.display = 'block';
    } else {
      detailEl.textContent = '';
      detailEl.style.display = 'none';
    }
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeScheduleModal() {
  const modal = document.getElementById('schedule-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}


// ============================================================
// 5. ユーティリティ
// ============================================================
function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text !== undefined && text !== null) {
    el.textContent = text;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ============================================================
// 6. アプリケーション初期化 (D1 API連携)
// ============================================================
async function initApp() {
  // 初期背景画像（デフォルト背景）を設定
  applyVisualBackground();

  const currentConfig = SectionManager.getConfig();
  SectionManager.applyConfig(currentConfig);

  // 1. 管理画面で保存されたローカルデータ（lp_managed_data）があれば最優先で適用
  const localManagedData = localStorage.getItem('lp_managed_data');
  if (localManagedData) {
    try {
      const parsedData = JSON.parse(localManagedData);
      console.log('[LP App] Loaded custom managed data from LocalStorage:', parsedData);
      applyAllData(parsedData);
      return;
    } catch (e) {
      console.warn('[LP App] LocalStorage parse error, falling back to API:', e);
    }
  }

  // 2. LocalStorageにない場合は Workers API から取得
  try {
    const d1Data = await fetchD1DatabaseData();
    console.log('[D1 Data Received Successfully]:', d1Data);

    // 取得したD1実データを画面に反映
    applyAllData(d1Data);

    // バナーを非表示
    const errorBanner = document.getElementById('api-error-banner');
    if (errorBanner) errorBanner.style.display = 'none';

  } catch (err) {
    console.warn('[D1 API Warning]:', err);
    if (typeof FALLBACK_SCHEMA_DATA !== 'undefined') {
      applyAllData(FALLBACK_SCHEMA_DATA);
    }
    showApiWarning(err.message);
  }
}

function showApiWarning(errorMsg) {
  let banner = document.getElementById('api-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'api-error-banner';
    banner.className = 'api-error-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  const currentEndpoint = API_CONFIG.getEndpoint();

  banner.innerHTML = `
    <div class="container api-error-container">
      <div class="api-error-icon">ℹ️</div>
      <div class="api-error-text">
        <strong>Workers D1 データベース接続エラー</strong>
        <p>アクセス先: <code>${escapeHtml(currentEndpoint)}</code> (${escapeHtml(errorMsg)})</p>
      </div>
      <div class="api-banner-buttons">
        <button class="btn-retry" onclick="initApp()">再接続</button>
        <button class="btn-close-banner" onclick="document.getElementById('api-error-banner').style.display='none'">&times;</button>
      </div>
    </div>
  `;
  banner.style.display = 'block';
}


document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // モーダルイベント
  document.getElementById('image-modal-close')?.addEventListener('click', closeImageModal);
  document.getElementById('image-modal-backdrop')?.addEventListener('click', closeImageModal);
  document.getElementById('video-modal-close')?.addEventListener('click', closeVideoModal);
  document.getElementById('video-modal-backdrop')?.addEventListener('click', closeVideoModal);
  document.getElementById('shop-modal-close')?.addEventListener('click', closeShopModal);
  document.getElementById('shop-modal-backdrop')?.addEventListener('click', closeShopModal);
  document.getElementById('schedule-modal-close')?.addEventListener('click', closeScheduleModal);
  document.getElementById('schedule-modal-backdrop')?.addEventListener('click', closeScheduleModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImageModal();
      closeVideoModal();
      closeShopModal();
      closeScheduleModal();
    }
  });

  // モバイルメニュー
  const menuBtn = document.getElementById('menu-toggle');
  const globalNav = document.getElementById('global-nav');
  if (menuBtn && globalNav) {
    menuBtn.addEventListener('click', () => {
      globalNav.classList.toggle('mobile-active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        globalNav.classList.remove('mobile-active');
      });
    });
  }

  // スクロール監視
  const sections = document.querySelectorAll('header, .lp-section');
  const navItems = document.querySelectorAll('.nav-item');

  window.addEventListener('scroll', () => {
    let currentId = 'sec-profile';
    const scrollPos = window.scrollY + 120;

    sections.forEach(sec => {
      if (!sec.classList.contains('is-hidden') && sec.offsetTop <= scrollPos) {
        currentId = sec.id;
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === `#${currentId}`) {
        item.classList.add('active');
      }
    });
  });
});
