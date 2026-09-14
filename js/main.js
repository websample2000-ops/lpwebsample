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
function resolveAssetUrl(filename, type) {
  if (!filename) return '';
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

  static moveSection(sectionId, direction) {
    const config = SectionManager.getConfig();
    const index = config.order.indexOf(sectionId);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= config.order.length) return;

    const temp = config.order[index];
    config.order[index] = config.order[targetIndex];
    config.order[targetIndex] = temp;

    SectionManager.applyConfig(config);
    SectionManager.renderAdminPanel();
  }

  static setVisibility(sectionId, isVisible) {
    const config = SectionManager.getConfig();
    if (!config.visibility) config.visibility = {};
    config.visibility[sectionId] = isVisible;

    SectionManager.applyConfig(config);
    SectionManager.renderAdminPanel();
  }

  static renderAdminPanel() {
    const listEl = document.getElementById('admin-section-list');
    if (!listEl) return;

    const config = SectionManager.getConfig();
    listEl.innerHTML = '';

    config.order.forEach((sectionId, idx) => {
      const isVisible = config.visibility ? config.visibility[sectionId] !== false : true;
      const label = SectionManager.SECTION_LABELS[sectionId] || sectionId;

      const item = document.createElement('div');
      item.className = 'admin-section-item';
      item.innerHTML = `
        <label class="admin-item-label">
          <input type="checkbox" ${isVisible ? 'checked' : ''} data-toggle-id="${sectionId}">
          <span>${label}</span>
        </label>
        <div class="admin-item-controls">
          <button class="btn-move btn-move-up" title="上へ移動" data-move-up="${sectionId}" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-move btn-move-down" title="下へ移動" data-move-down="${sectionId}" ${idx === config.order.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      `;
      listEl.appendChild(item);
    });

    listEl.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        SectionManager.setVisibility(e.target.dataset.toggleId, e.target.checked);
      });
    });

    listEl.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SectionManager.moveSection(e.currentTarget.dataset.moveUp, -1);
      });
    });

    listEl.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SectionManager.moveSection(e.currentTarget.dataset.moveDown, 1);
      });
    });
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
  renderMovies(data.movieLabel, data.movie);
  renderShops(data.shopTag, data.shop);
  renderLinks(data.linkList);
}

function renderProfileAndVisual(profile, visuals) {
  if (profile) {
    if (profile.name) {
      document.title = `${profile.name} Official Website`;
    }
    const logoEl = document.querySelector('.logo-text');
    if (logoEl && (profile.romanization || profile.name)) {
      logoEl.textContent = profile.romanization || profile.name;
    }

    setText('prof-name', profile.name);
    setText('prof-pronunciation', profile.pronunciation);
    setText('prof-romanization', profile.romanization);
    setText('prof-nickname', profile.nickname);
    setText('prof-comment', profile.comment);
    
    const msgEl = document.getElementById('prof-message');
    if (msgEl && profile.message) {
      msgEl.innerHTML = escapeHtml(profile.message).replace(/\n/g, '<br>');
    }

    setText('prof-birthday', profile.birthday);
    setText('prof-streaming', profile.streaming);
    setText('prof-age', profile.age);
    setText('prof-height', profile.height);
    setText('prof-fanName', profile.fanName);

    const ytEl = document.getElementById('prof-youtube');
    if (ytEl && profile.youtubeUrl) ytEl.href = profile.youtubeUrl;
    
    const xEl = document.getElementById('prof-x');
    if (xEl && profile.xUrl) xEl.href = profile.xUrl;

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
        const btn = document.createElement('button');
        btn.className = 'btn-movie-play';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> <span>${escapeHtml(title)}</span>`;
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
      const btn = document.createElement('button');
      btn.className = `costume-thumb-btn ${index === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <img src="${escapeHtml(thumdPath)}" alt="${escapeHtml(vis.costumeName || '衣装')}">
        <span>${escapeHtml(vis.costumeName || `衣装 #${vis.id}`)}</span>
      `;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.costume-thumb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchVisual(vis);
      });
      thumbsContainer.appendChild(btn);
    });

    switchVisual(visuals[0]);
  }
}

function switchVisual(visual) {
  if (!visual) return;
  const mainImg = document.getElementById('current-visual-img');
  const badge = document.getElementById('current-costume-badge');

  const visualPath = resolveAssetUrl(visual.visualUrl, 'visual');

  if (mainImg) {
    mainImg.style.opacity = '0';
    setTimeout(() => {
      mainImg.src = visualPath;
      mainImg.alt = visual.costumeName || '立ち絵';
      mainImg.style.opacity = '1';
    }, 200);
  }

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
  const gridContainer = document.getElementById('schedule-container');
  if (!tabContainer || !gridContainer) return;

  const tagMap = {};
  if (Array.isArray(tags)) {
    tags.forEach(t => { tagMap[t.id] = t.tagName; });
  }

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

  function displaySchedules(filterTagId = 'all') {
    gridContainer.innerHTML = '';
    const items = Array.isArray(schedules) ? schedules : [];
    
    const filtered = items.filter(s => {
      const active = (s.is_active === 1 || s.is_active === true || s.is_active === "1");
      if (!active) return false;
      if (filterTagId === 'all') return true;
      return String(s.scheduleTag) === String(filterTagId);
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = '<p class="text-muted" style="text-align:center;grid-column:1/-1;padding:30px;">予定されているスケジュールはありません。</p>';
      return;
    }

    filtered.forEach(item => {
      const tagName = tagMap[item.scheduleTag] || 'イベント';
      const picUrl = item.picture ? resolveAssetUrl(item.picture, 'schedule') : null;
      const card = document.createElement('div');
      card.className = 'schedule-card';
      card.innerHTML = `
        ${picUrl ? `
          <div class="schedule-image-box">
            <img src="${escapeHtml(picUrl)}" alt="${escapeHtml(item.title)}">
          </div>
        ` : ''}
        <div class="schedule-card-body">
          <div class="schedule-date-tag-row">
            <div class="schedule-datetime">
              <span class="schedule-date">${escapeHtml(item.schedule_at || '')}</span>
              ${item.time ? `<span class="schedule-time">${escapeHtml(item.time)}〜</span>` : ''}
            </div>
            <span class="schedule-tag-badge">${escapeHtml(tagName)}</span>
          </div>
          <h3 class="schedule-card-title">${escapeHtml(item.title)}</h3>
          ${item.detail ? `<p class="schedule-card-detail">${escapeHtml(item.detail)}</p>` : ''}
        </div>
      `;
      gridContainer.appendChild(card);
    });
  }

  tabContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.filter-tab');
    if (!target) return;
    tabContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    displaySchedules(target.dataset.tagId);
  });

  displaySchedules('all');
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
      
      // サムネイルURL判定（未入力の場合はYouTube動画IDからhqdefault.jpgを自動生成）
      let imgUrl = item.imageUrl ? resolveAssetUrl(item.imageUrl, 'movie') : '';
      if (!imgUrl && item.videoUrl) {
        const ytId = getYouTubeId(item.videoUrl);
        if (ytId) {
          imgUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
      }

      const card = document.createElement('div');
      card.className = 'movie-card';
      card.innerHTML = `
        <div class="movie-thumb-wrapper">
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}">
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
  if (!tabContainer || !gridContainer) return;

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

  function displayShops(filterTag = 'all') {
    gridContainer.innerHTML = '';
    const items = Array.isArray(shops) ? shops : [];

    const filtered = items.filter(s => {
      if (filterTag === 'all') return true;
      return String(s.shopTag) === String(filterTag);
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = '<p class="text-muted" style="text-align:center;grid-column:1/-1;padding:30px;">グッズはありません。</p>';
      return;
    }

    filtered.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    filtered.forEach(item => {
      const tagName = tagMap[item.shopTag] || 'グッズ';
      const imgUrl = resolveAssetUrl(item.merchandiseImage, 'shop');
      const card = document.createElement('div');
      card.className = 'shop-card';

      let linksHtml = '';
      if (item.booth) linksHtml += `<a href="${escapeHtml(item.booth)}" target="_blank" rel="noopener noreferrer" class="shop-btn btn-booth">BOOTH</a>`;
      if (item.suzuri) linksHtml += `<a href="${escapeHtml(item.suzuri)}" target="_blank" rel="noopener noreferrer" class="shop-btn btn-suzuri">SUZURI</a>`;
      if (item.base) linksHtml += `<a href="${escapeHtml(item.base)}" target="_blank" rel="noopener noreferrer" class="shop-btn btn-base">BASE</a>`;
      if (item.fanbox) linksHtml += `<a href="${escapeHtml(item.fanbox)}" target="_blank" rel="noopener noreferrer" class="shop-btn btn-fanbox">FANBOX</a>`;

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
          <div class="shop-links-group">
            ${linksHtml}
          </div>
        </div>
      `;
      gridContainer.appendChild(card);
    });
  }

  tabContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.filter-tab');
    if (!target) return;
    tabContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    target.classList.add('active');
    displayShops(target.dataset.shopTag);
  });

  displayShops('all');
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
    const card = document.createElement('a');
    card.className = 'link-card';
    card.href = item.link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
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
  const currentConfig = SectionManager.getConfig();
  SectionManager.applyConfig(currentConfig);
  SectionManager.renderAdminPanel();

  const apiInput = document.getElementById('api-url-input');
  if (apiInput) {
    apiInput.value = API_CONFIG.getBaseUrl();
  }

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
    // エラー時はフォールバックデータで表示
    applyAllData(FALLBACK_SCHEMA_DATA);
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

  const dockToggle = document.getElementById('admin-dock-toggle');
  const adminPanel = document.getElementById('admin-panel');
  const adminClose = document.getElementById('admin-panel-close');
  const btnReset = document.getElementById('btn-admin-reset');
  const btnSaveApi = document.getElementById('btn-save-api');
  const apiInput = document.getElementById('api-url-input');

  if (dockToggle && adminPanel) {
    dockToggle.addEventListener('click', () => {
      adminPanel.classList.toggle('is-open');
    });
  }

  if (adminClose && adminPanel) {
    adminClose.addEventListener('click', () => {
      adminPanel.classList.remove('is-open');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('セクションの並び順と表示状態を初期状態に戻しますか？')) {
        SectionManager.resetConfig();
      }
    });
  }

  if (btnSaveApi && apiInput) {
    btnSaveApi.addEventListener('click', () => {
      API_CONFIG.setBaseUrl(apiInput.value);
      initApp();
    });
  }

  // モーダルイベント
  document.getElementById('image-modal-close')?.addEventListener('click', closeImageModal);
  document.getElementById('image-modal-backdrop')?.addEventListener('click', closeImageModal);
  document.getElementById('video-modal-close')?.addEventListener('click', closeVideoModal);
  document.getElementById('video-modal-backdrop')?.addEventListener('click', closeVideoModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImageModal();
      closeVideoModal();
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
