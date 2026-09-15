/**
 * 管理画面メインスクリプト (js/admin.js)
 * 星乃ルナ Official LP - データ管理コンソール
 */

// ============================================================
// 1. 定数 & ストレージキー
// ============================================================
const STORAGE_DATA_KEY = 'lp_managed_data';
const STORAGE_SECTION_KEY = 'lp_section_config';
const API_BASE_URL = 'https://lpwebsample-api.web-sample2000-ea9.workers.dev';

// 初期フォールバックデータ（万が一APIにもLocalStorageにもデータがない場合用）
const DEFAULT_APP_DATA = {
  profile: {
    id: 1,
    name: "星乃 ルナ",
    pronunciation: "ほしの るな",
    romanization: "Luna Hoshino",
    nickname: "るなち / ルナちゃん",
    comment: "夜空からあなたの心に星の光をお届け！見習い星読みバーチャルナビゲーター✨",
    message: "はじめまして！星乃ルナです🌟\n普段はYouTubeを中心に、ゲーム実況や歌枠、まったり雑談、作業用ASMR配信などを楽しくお届けしています。\nみんなと一緒にあたたかい居場所を作っていけたら嬉しいです！チャンネル登録・SNSフォローよろしくね！",
    birthday: "07月15日",
    streaming: "2023年10月01日",
    age: "18",
    height: "152",
    fanName: "ステラメイト",
    youtubeUrl: "https://www.youtube.com/",
    xUrl: "https://x.com/",
    platforms_name_1: null,
    platforms_link_1: null,
    platforms_name_2: null,
    platforms_link_2: null,
    platforms_name_3: null,
    platforms_link_3: null,
    moves_1: "https://youtu.be/HWDVVysH_oI",
    moves_2: null,
    moves_3: null
  },
  visual: [],
  notice: [],
  scheduleTag: [],
  schedule: [],
  gallery: [],
  movieLabel: [],
  movie: [],
  shopTag: [],
  shop: [],
  linkList: []
};

// アプリケーション全体のデータキャッシュ
let appData = JSON.parse(JSON.stringify(DEFAULT_APP_DATA));

// 現在アクティブなセクション
let currentSectionId = 'profile';

// ============================================================
// 2. データ永続化 (LocalStorage / API)
// ============================================================

/**
 * データを LocalStorage に保存
 */
function saveAppData() {
  try {
    localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(appData));
    showToast('データを保存しました（LP側にも即時反映）', 'success');
    updateBadges();

    // バックグラウンドでAPI保存（対応エンドポイントがある場合）
    fetch(`${API_BASE_URL}/api/save-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    }).catch(err => {
      console.log('[API Sync Skipped/Info]:', err.message);
    });
  } catch (e) {
    console.error('LocalStorage save error:', e);
    showToast('データの保存に失敗しました', 'error');
  }
}

/**
 * データを初期読み込み
 */
async function loadAppData() {
  const localData = localStorage.getItem(STORAGE_DATA_KEY);
  if (localData) {
    try {
      appData = JSON.parse(localData);
      console.log('[Admin] Loaded data from LocalStorage:', appData);
      initAllViews();
      return;
    } catch (e) {
      console.warn('[Admin] LocalStorage parse error, fetching from API:', e);
    }
  }

  // LocalStorageにない場合はAPIから取得
  try {
    const res = await fetch(`${API_BASE_URL}/api/all`);
    if (res.ok) {
      const data = await res.json();
      console.log('[Admin] Loaded data from Workers API:', data);
      appData = data;
      if (!appData.gallery && data.galley) appData.gallery = data.galley;
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(appData));
    } else {
      console.warn('[Admin] API response not ok, using defaults');
    }
  } catch (err) {
    console.warn('[Admin] API fetch error, using defaults:', err);
  }

  initAllViews();
}

/**
 * APIから再取得（リセット）
 */
async function reloadFromApi() {
  if (!confirm('Workers APIから最新データを再取得して上書きしますか？現在の編集内容は破棄されます。')) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/all`);
    if (res.ok) {
      const data = await res.json();
      appData = data;
      if (!appData.gallery && data.galley) appData.gallery = data.galley;
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(appData));
      initAllViews();
      showToast('APIからデータを再取得しました', 'success');
    } else {
      throw new Error(`API Error: ${res.status}`);
    }
  } catch (err) {
    showToast(`再取得に失敗しました: ${err.message}`, 'error');
  }
}

// ============================================================
// 3. UI切り替え・ナビゲーション・ハンバーガーメニュー
// ============================================================

function switchSection(sectionId) {
  currentSectionId = sectionId;

  // ナビボタンのアクティブ切り替え
  document.querySelectorAll('.nav-link-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });

  // セクション表示切り替え
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `sec-${sectionId}`);
  });

  // モバイルの場合はサイドバーを閉じる
  if (window.innerWidth < 1024) {
    closeSidebar();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('btn-hamburger');
  const main = document.getElementById('admin-main');

  if (window.innerWidth >= 1024) {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
    hamburger.classList.toggle('active');
  } else {
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    hamburger.classList.toggle('active', isOpen);
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('btn-hamburger');

  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  hamburger.classList.remove('active');
}

/**
 * サイドバーの各項目件数バッジを更新
 */
function updateBadges() {
  setBadge('badge-visual', (appData.visual || []).length);
  setBadge('badge-notice', (appData.notice || []).length);
  setBadge('badge-schedule', (appData.schedule || []).length);
  setBadge('badge-gallery', (appData.gallery || []).length);
  setBadge('badge-movie', (appData.movie || []).length);
  setBadge('badge-shop', (appData.shop || []).length);
  setBadge('badge-linkList', (appData.linkList || []).length);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = count;
}

// ============================================================
// 4. トースト通知 & モーダル共通
// ============================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('is-open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('is-open');
}

// ============================================================
// 5. プロフィール（profile）: 編集のみ
// ============================================================

function initProfileForm() {
  const p = appData.profile || {};
  setVal('prof-name', p.name || '');
  setVal('prof-pronunciation', p.pronunciation || '');
  setVal('prof-romanization', p.romanization || '');
  setVal('prof-nickname', p.nickname || '');
  setVal('prof-comment', p.comment || '');
  setVal('prof-message', p.message || '');
  setVal('prof-birthday', p.birthday || '');
  setVal('prof-streaming', p.streaming || '');
  setVal('prof-age', p.age || '');
  setVal('prof-height', p.height || '');
  setVal('prof-fanName', p.fanName || '');
  setVal('prof-youtubeUrl', p.youtubeUrl || '');
  setVal('prof-xUrl', p.xUrl || '');

  // プラットフォーム (1..3)
  for (let i = 1; i <= 3; i++) {
    setVal(`prof-plat-name-${i}`, p[`platforms_name_${i}`] || '');
    setVal(`prof-plat-link-${i}`, p[`platforms_link_${i}`] || '');
  }

  // 自己紹介動画 (1..3)
  for (let i = 1; i <= 3; i++) {
    setVal(`prof-move-${i}`, p[`moves_${i}`] || '');
  }
}

function saveProfile(e) {
  e.preventDefault();
  if (!appData.profile) appData.profile = {};

  const p = appData.profile;
  p.name = getVal('prof-name');
  p.pronunciation = getVal('prof-pronunciation');
  p.romanization = getVal('prof-romanization');
  p.nickname = getVal('prof-nickname');
  p.comment = getVal('prof-comment');
  p.message = getVal('prof-message');
  p.birthday = getVal('prof-birthday');
  p.streaming = getVal('prof-streaming');
  p.age = getVal('prof-age');
  p.height = getVal('prof-height');
  p.fanName = getVal('prof-fanName');
  p.youtubeUrl = getVal('prof-youtubeUrl');
  p.xUrl = getVal('prof-xUrl');

  for (let i = 1; i <= 3; i++) {
    p[`platforms_name_${i}`] = getVal(`prof-plat-name-${i}`) || null;
    p[`platforms_link_${i}`] = getVal(`prof-plat-link-${i}`) || null;
  }

  for (let i = 1; i <= 3; i++) {
    p[`moves_${i}`] = getVal(`prof-move-${i}`) || null;
  }

  saveAppData();
}

// ============================================================
// 6. 立ち絵（visual）: 編集と追加
// ============================================================

function renderVisualTable() {
  const tbody = document.getElementById('visual-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = appData.visual || [];
  list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  list.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${item.id}</td>
      <td>
        <img src="${escapeHtml(resolvePath(item.thumdUrl || item.visualUrl, 'thumd'))}" class="table-thumb" alt="">
      </td>
      <td><strong>${escapeHtml(item.costumeName || '衣装名未設定')}</strong></td>
      <td>${escapeHtml(item.illustrator || item.characterDesign || '-')}</td>
      <td>${Number(item.priority) || 1}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openVisualModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteVisual(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openVisualModal(id = null) {
  const modalTitle = document.getElementById('modal-visual-title');
  const form = document.getElementById('form-visual');
  form.reset();

  if (id !== null) {
    const item = (appData.visual || []).find(v => v.id === id);
    if (!item) return;
    modalTitle.textContent = '立ち絵・衣装の編集';
    setVal('visual-id', item.id);
    setVal('visual-costumeName', item.costumeName || '');
    setVal('visual-visualUrl', item.visualUrl || '');
    setVal('visual-thumdUrl', item.thumdUrl || '');
    setVal('visual-thumdBackground', item.thumdBackground || '');
    setVal('visual-visualBackground', item.visualBackground || '');
    setVal('visual-comment', item.comment || '');
    setVal('visual-characterDesign', item.characterDesign || '');
    setVal('visual-illustrator', item.illustrator || '');
    setVal('visual-live2d', item.live2d || '');
    setVal('visual-3dModeling', item['3dModeling'] || item['modeling3d'] || '');
    setVal('visual-priority', item.priority || 1);
  } else {
    modalTitle.textContent = '新規立ち絵・衣装の追加';
    // 新規IDの自動生成
    const maxId = (appData.visual || []).reduce((max, v) => Math.max(max, Number(v.id) || 0), 1000);
    setVal('visual-id', maxId + 1);
    setVal('visual-priority', (appData.visual || []).length + 1);
  }

  openModal('modal-visual');
}

function saveVisualForm(e) {
  e.preventDefault();
  const id = Number(getVal('visual-id'));
  if (!id) return;

  if (!Array.isArray(appData.visual)) appData.visual = [];

  const index = appData.visual.findIndex(v => v.id === id);
  const data = {
    id: id,
    costumeName: getVal('visual-costumeName'),
    visualUrl: getVal('visual-visualUrl'),
    thumdUrl: getVal('visual-thumdUrl'),
    thumdBackground: getVal('visual-thumdBackground') || null,
    visualBackground: getVal('visual-visualBackground') || null,
    comment: getVal('visual-comment') || null,
    characterDesign: getVal('visual-characterDesign') || null,
    illustrator: getVal('visual-illustrator') || null,
    live2d: getVal('visual-live2d') || null,
    modeling3d: getVal('visual-3dModeling') || null,
    '3dModeling': getVal('visual-3dModeling') || null,
    priority: Number(getVal('visual-priority')) || 1
  };

  if (index >= 0) {
    appData.visual[index] = data;
  } else {
    appData.visual.push(data);
  }

  saveAppData();
  renderVisualTable();
  closeModal('modal-visual');
}

function deleteVisual(id) {
  if (!confirm('この立ち絵データを削除しますか？')) return;
  appData.visual = (appData.visual || []).filter(v => v.id !== id);
  saveAppData();
  renderVisualTable();
}

// ============================================================
// 7. お知らせ（notice）: 編集と追加
// ============================================================

function renderNoticeTable() {
  const tbody = document.getElementById('notice-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = appData.notice || [];
  list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  list.forEach(item => {
    const tr = document.createElement('tr');
    const badgeClass = item.status === 'published' ? 'badge-published' : (item.status === 'scheduled' ? 'badge-scheduled' : 'badge-draft');
    const badgeLabel = item.status === 'published' ? '公開中' : (item.status === 'scheduled' ? '予約' : '下書き');
    
    tr.innerHTML = `
      <td>${escapeHtml(item.created_at || '-')}</td>
      <td><span class="badge-status ${badgeClass}">${badgeLabel}</span></td>
      <td><div style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.message || '')}</div></td>
      <td>${item.picture ? `<img src="${escapeHtml(resolvePath(item.picture, 'notice'))}" class="table-thumb" alt="">` : '-'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openNoticeModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteNotice(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openNoticeModal(id = null) {
  const modalTitle = document.getElementById('modal-notice-title');
  const form = document.getElementById('form-notice');
  form.reset();

  if (id !== null) {
    const item = (appData.notice || []).find(n => n.id === id);
    if (!item) return;
    modalTitle.textContent = 'お知らせの編集';
    setVal('notice-id', item.id);
    setVal('notice-created-at', item.created_at || '');
    setVal('notice-scheduled-at', item.scheduled_at || '');
    setVal('notice-status', item.status || 'published');
    setVal('notice-message', item.message || '');
    setVal('notice-picture', item.picture || '');
  } else {
    modalTitle.textContent = '新規お知らせの追加';
    const maxId = (appData.notice || []).reduce((max, n) => Math.max(max, Number(n.id) || 0), 0);
    setVal('notice-id', maxId + 1);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setVal('notice-created-at', dateStr);
    setVal('notice-status', 'published');
  }

  openModal('modal-notice');
}

function saveNoticeForm(e) {
  e.preventDefault();
  const id = Number(getVal('notice-id'));
  if (!id) return;

  if (!Array.isArray(appData.notice)) appData.notice = [];

  const index = appData.notice.findIndex(n => n.id === id);
  const data = {
    id: id,
    created_at: getVal('notice-created-at'),
    scheduled_at: getVal('notice-scheduled-at') || null,
    status: getVal('notice-status') || 'published',
    message: getVal('notice-message'),
    picture: getVal('notice-picture') || null
  };

  if (index >= 0) {
    appData.notice[index] = data;
  } else {
    appData.notice.push(data);
  }

  saveAppData();
  renderNoticeTable();
  closeModal('modal-notice');
}

function deleteNotice(id) {
  if (!confirm('このお知らせを削除しますか？')) return;
  appData.notice = (appData.notice || []).filter(n => n.id !== id);
  saveAppData();
  renderNoticeTable();
}

// ============================================================
// 8. スケジュール（scheduleTag, schedule）: 編集と追加
// ============================================================

function renderScheduleTags() {
  const container = document.getElementById('schedule-tags-list');
  const select = document.getElementById('schedule-tag-select');
  if (!container) return;

  container.innerHTML = '';
  if (select) select.innerHTML = '';

  const tags = appData.scheduleTag || [];
  tags.forEach(tag => {
    const item = document.createElement('div');
    item.className = 'tag-badge-item';
    item.innerHTML = `
      <span>${escapeHtml(tag.tagName)} (ID: ${tag.id})</span>
      <span class="btn-remove-tag" onclick="deleteScheduleTag(${tag.id})">&times;</span>
    `;
    container.appendChild(item);

    if (select) {
      const opt = document.createElement('option');
      opt.value = tag.id;
      opt.textContent = tag.tagName;
      select.appendChild(opt);
    }
  });
}

function addScheduleTag() {
  const input = document.getElementById('new-schedule-tag-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  if (!Array.isArray(appData.scheduleTag)) appData.scheduleTag = [];
  const maxId = appData.scheduleTag.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
  appData.scheduleTag.push({ id: maxId + 1, tagName: name });

  input.value = '';
  saveAppData();
  renderScheduleTags();
  renderScheduleTable();
}

function deleteScheduleTag(id) {
  if (!confirm('このタグを削除しますか？')) return;
  appData.scheduleTag = (appData.scheduleTag || []).filter(t => t.id !== id);
  saveAppData();
  renderScheduleTags();
  renderScheduleTable();
}

function renderScheduleTable() {
  const tbody = document.getElementById('schedule-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const tagMap = {};
  (appData.scheduleTag || []).forEach(t => { tagMap[t.id] = t.tagName; });

  const list = appData.schedule || [];
  list.sort((a, b) => (a.schedule_at || '').localeCompare(b.schedule_at || ''));

  list.forEach(item => {
    const tr = document.createElement('tr');
    const tagName = tagMap[item.scheduleTag] || '未設定';
    const isActive = (item.is_active === 1 || item.is_active === true || item.is_active === "1");

    tr.innerHTML = `
      <td>${escapeHtml(item.schedule_at || '')} ${escapeHtml(item.time || '')}</td>
      <td><span class="badge-status badge-scheduled">${escapeHtml(tagName)}</span></td>
      <td><strong>${escapeHtml(item.title || '')}</strong></td>
      <td>${isActive ? '<span style="color:var(--accent-green)">公開</span>' : '<span style="color:var(--text-muted)">非公開</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openScheduleModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteSchedule(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openScheduleModal(id = null) {
  const modalTitle = document.getElementById('modal-schedule-title');
  const form = document.getElementById('form-schedule');
  form.reset();
  renderScheduleTags();

  if (id !== null) {
    const item = (appData.schedule || []).find(s => s.id === id);
    if (!item) return;
    modalTitle.textContent = 'スケジュールの編集';
    setVal('schedule-id', item.id);
    setVal('schedule-title', item.title || '');
    setVal('schedule-tag-select', item.scheduleTag || '');
    setVal('schedule-date', item.schedule_at || '');
    setVal('schedule-time', item.time || '');
    setVal('schedule-detail', item.detail || '');
    setVal('schedule-picture', item.picture || '');
    document.getElementById('schedule-is-active').checked = (item.is_active === 1 || item.is_active === true || item.is_active === "1");
  } else {
    modalTitle.textContent = '新規スケジュールの追加';
    const maxId = (appData.schedule || []).reduce((max, s) => Math.max(max, Number(s.id) || 0), 0);
    setVal('schedule-id', maxId + 1);
    document.getElementById('schedule-is-active').checked = true;
  }

  openModal('modal-schedule');
}

function saveScheduleForm(e) {
  e.preventDefault();
  const id = Number(getVal('schedule-id'));
  if (!id) return;

  if (!Array.isArray(appData.schedule)) appData.schedule = [];

  const index = appData.schedule.findIndex(s => s.id === id);
  const data = {
    id: id,
    title: getVal('schedule-title'),
    scheduleTag: Number(getVal('schedule-tag-select')) || 1,
    schedule_at: getVal('schedule-date'),
    time: getVal('schedule-time') || null,
    detail: getVal('schedule-detail') || null,
    picture: getVal('schedule-picture') || null,
    is_active: document.getElementById('schedule-is-active').checked ? 1 : 0
  };

  if (index >= 0) {
    appData.schedule[index] = data;
  } else {
    appData.schedule.push(data);
  }

  saveAppData();
  renderScheduleTable();
  closeModal('modal-schedule');
}

function deleteSchedule(id) {
  if (!confirm('このスケジュールを削除しますか？')) return;
  appData.schedule = (appData.schedule || []).filter(s => s.id !== id);
  saveAppData();
  renderScheduleTable();
}

// ============================================================
// 9. ギャラリー（gallery）: 編集と追加
// ============================================================

function renderGalleryGrid() {
  const container = document.getElementById('gallery-grid-list');
  if (!container) return;
  container.innerHTML = '';

  const list = appData.gallery || [];
  list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-card-media">
        <img src="${escapeHtml(resolvePath(item.imageUrl, 'gallery'))}" alt="">
      </div>
      <div class="item-card-body">
        <div class="item-card-title">${escapeHtml(item.name || 'ギャラリー画像')}</div>
        <div class="item-card-meta">
          <span>優先度: ${item.priority || 1}</span>
          <span>ID: #${item.id}</span>
        </div>
        <div class="table-actions" style="margin-top:8px;">
          <button class="btn-action-edit" onclick="openGalleryModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteGallery(${item.id})">削除</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openGalleryModal(id = null) {
  const modalTitle = document.getElementById('modal-gallery-title');
  const form = document.getElementById('form-gallery');
  form.reset();

  if (id !== null) {
    const item = (appData.gallery || []).find(g => g.id === id);
    if (!item) return;
    modalTitle.textContent = 'ギャラリー画像の編集';
    setVal('gallery-id', item.id);
    setVal('gallery-name', item.name || '');
    setVal('gallery-imageUrl', item.imageUrl || '');
    setVal('gallery-priority', item.priority || 1);
  } else {
    modalTitle.textContent = '新規ギャラリー画像の追加';
    const maxId = (appData.gallery || []).reduce((max, g) => Math.max(max, Number(g.id) || 0), 0);
    setVal('gallery-id', maxId + 1);
    setVal('gallery-priority', (appData.gallery || []).length + 1);
  }

  openModal('modal-gallery');
}

function saveGalleryForm(e) {
  e.preventDefault();
  const id = Number(getVal('gallery-id'));
  if (!id) return;

  if (!Array.isArray(appData.gallery)) appData.gallery = [];

  const index = appData.gallery.findIndex(g => g.id === id);
  const data = {
    id: id,
    name: getVal('gallery-name'),
    imageUrl: getVal('gallery-imageUrl'),
    priority: Number(getVal('gallery-priority')) || 1
  };

  if (index >= 0) {
    appData.gallery[index] = data;
  } else {
    appData.gallery.push(data);
  }

  saveAppData();
  renderGalleryGrid();
  closeModal('modal-gallery');
}

function deleteGallery(id) {
  if (!confirm('このギャラリー画像を削除しますか？')) return;
  appData.gallery = (appData.gallery || []).filter(g => g.id !== id);
  saveAppData();
  renderGalleryGrid();
}

// ============================================================
// 10. 動画リスト（movieLabel, movie）: 編集と追加
// ============================================================

function renderMovieLabels() {
  const container = document.getElementById('movie-labels-list');
  const select = document.getElementById('movie-label-select');
  if (!container) return;

  container.innerHTML = '';
  if (select) select.innerHTML = '';

  const labels = appData.movieLabel || [];
  labels.forEach(lbl => {
    const item = document.createElement('div');
    item.className = 'tag-badge-item';
    item.innerHTML = `
      <span>${escapeHtml(lbl.tagLabel)} (ID: ${lbl.id})</span>
      <span class="btn-remove-tag" onclick="deleteMovieLabel(${lbl.id})">&times;</span>
    `;
    container.appendChild(item);

    if (select) {
      const opt = document.createElement('option');
      opt.value = lbl.id;
      opt.textContent = lbl.tagLabel;
      select.appendChild(opt);
    }
  });
}

function addMovieLabel() {
  const input = document.getElementById('new-movie-label-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  if (!Array.isArray(appData.movieLabel)) appData.movieLabel = [];
  const maxId = appData.movieLabel.reduce((max, l) => Math.max(max, Number(l.id) || 0), 0);
  appData.movieLabel.push({ id: maxId + 1, tagLabel: name, priority: appData.movieLabel.length + 1 });

  input.value = '';
  saveAppData();
  renderMovieLabels();
  renderMovieTable();
}

function deleteMovieLabel(id) {
  if (!confirm('この動画ラベルを削除しますか？')) return;
  appData.movieLabel = (appData.movieLabel || []).filter(l => l.id !== id);
  saveAppData();
  renderMovieLabels();
  renderMovieTable();
}

function renderMovieTable() {
  const tbody = document.getElementById('movie-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const labelMap = {};
  (appData.movieLabel || []).forEach(l => { labelMap[l.id] = l.tagLabel; });

  const list = appData.movie || [];

  list.forEach(item => {
    const tr = document.createElement('tr');
    const labelName = labelMap[item.tagLabel] || '未設定';
    const isActive = (item.is_active === 1 || item.is_active === true || item.is_active === "1");

    // YouTubeサムネイル自動判定
    let thumb = item.imageUrl ? resolvePath(item.imageUrl, 'movie') : '';
    if (!thumb && item.videoUrl) {
      const match = item.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (match) thumb = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }

    tr.innerHTML = `
      <td>${thumb ? `<img src="${escapeHtml(thumb)}" class="table-thumb" alt="">` : '-'}</td>
      <td><strong>${escapeHtml(item.title || '')}</strong></td>
      <td><span class="badge-status badge-published">${escapeHtml(labelName)}</span></td>
      <td><a href="${escapeHtml(item.videoUrl)}" target="_blank" style="color:var(--accent-cyan); text-decoration:underline;">動画リンク ↗</a></td>
      <td>${isActive ? '<span style="color:var(--accent-green)">公開</span>' : '<span style="color:var(--text-muted)">非公開</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openMovieModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteMovie(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openMovieModal(id = null) {
  const modalTitle = document.getElementById('modal-movie-title');
  const form = document.getElementById('form-movie');
  form.reset();
  renderMovieLabels();

  if (id !== null) {
    const item = (appData.movie || []).find(m => m.id === id);
    if (!item) return;
    modalTitle.textContent = '動画の編集';
    setVal('movie-id', item.id);
    setVal('movie-title', item.title || '');
    setVal('movie-label-select', item.tagLabel || '');
    setVal('movie-videoUrl', item.videoUrl || '');
    setVal('movie-imageUrl', item.imageUrl || '');
    document.getElementById('movie-is-active').checked = (item.is_active === 1 || item.is_active === true || item.is_active === "1");
  } else {
    modalTitle.textContent = '新規動画の追加';
    const maxId = (appData.movie || []).reduce((max, m) => Math.max(max, Number(m.id) || 0), 1000);
    setVal('movie-id', maxId + 1);
    document.getElementById('movie-is-active').checked = true;
  }

  openModal('modal-movie');
}

function saveMovieForm(e) {
  e.preventDefault();
  const id = Number(getVal('movie-id'));
  if (!id) return;

  if (!Array.isArray(appData.movie)) appData.movie = [];

  const index = appData.movie.findIndex(m => m.id === id);
  const data = {
    id: id,
    title: getVal('movie-title'),
    tagLabel: Number(getVal('movie-label-select')) || 1,
    videoUrl: getVal('movie-videoUrl'),
    imageUrl: getVal('movie-imageUrl') || null,
    is_active: document.getElementById('movie-is-active').checked ? 1 : 0
  };

  if (index >= 0) {
    appData.movie[index] = data;
  } else {
    appData.movie.push(data);
  }

  saveAppData();
  renderMovieTable();
  closeModal('modal-movie');
}

function deleteMovie(id) {
  if (!confirm('この動画を削除しますか？')) return;
  appData.movie = (appData.movie || []).filter(m => m.id !== id);
  saveAppData();
  renderMovieTable();
}

// ============================================================
// 11. ショップ（shopTag, shop）: 編集と追加
// ============================================================

function renderShopTags() {
  const container = document.getElementById('shop-tags-list');
  const select = document.getElementById('shop-tag-select');
  if (!container) return;

  container.innerHTML = '';
  if (select) select.innerHTML = '';

  const tags = appData.shopTag || [];
  tags.forEach(t => {
    const item = document.createElement('div');
    item.className = 'tag-badge-item';
    item.innerHTML = `
      <span>${escapeHtml(t.tagName)} (ID: ${t.id})</span>
      <span class="btn-remove-tag" onclick="deleteShopTag(${t.id})">&times;</span>
    `;
    container.appendChild(item);

    if (select) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.tagName;
      select.appendChild(opt);
    }
  });
}

function addShopTag() {
  const input = document.getElementById('new-shop-tag-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  if (!Array.isArray(appData.shopTag)) appData.shopTag = [];
  const maxId = appData.shopTag.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
  appData.shopTag.push({ id: maxId + 1, tagName: name });

  input.value = '';
  saveAppData();
  renderShopTags();
  renderShopTable();
}

function deleteShopTag(id) {
  if (!confirm('この区分タグを削除しますか？')) return;
  appData.shopTag = (appData.shopTag || []).filter(t => t.id !== id);
  saveAppData();
  renderShopTags();
  renderShopTable();
}

function renderShopTable() {
  const tbody = document.getElementById('shop-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const tagMap = {};
  (appData.shopTag || []).forEach(t => { tagMap[t.id] = t.tagName; });

  const list = appData.shop || [];
  list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  list.forEach(item => {
    const tr = document.createElement('tr');
    const tagName = tagMap[item.shopTag] || '未設定';

    tr.innerHTML = `
      <td><img src="${escapeHtml(resolvePath(item.merchandiseImage, 'shop'))}" class="table-thumb" alt=""></td>
      <td><strong>${escapeHtml(item.name || '')}</strong></td>
      <td><span class="badge-status badge-scheduled">${escapeHtml(tagName)}</span></td>
      <td>¥${Number(item.price || 0).toLocaleString()}</td>
      <td>${Number(item.priority) || 1}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openShopModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteShop(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openShopModal(id = null) {
  const modalTitle = document.getElementById('modal-shop-title');
  const form = document.getElementById('form-shop');
  form.reset();
  renderShopTags();

  if (id !== null) {
    const item = (appData.shop || []).find(s => s.id === id);
    if (!item) return;
    modalTitle.textContent = '商品の編集';
    setVal('shop-id', item.id);
    setVal('shop-name', item.name || '');
    setVal('shop-tag-select', item.shopTag || '');
    setVal('shop-merchandiseImage', item.merchandiseImage || '');
    setVal('shop-price', item.price || 0);
    setVal('shop-priority', item.priority || 1);
    setVal('shop-booth', item.booth || '');
    setVal('shop-suzuri', item.suzuri || '');
    setVal('shop-base', item.base || '');
    setVal('shop-fanbox', item.fanbox || '');
  } else {
    modalTitle.textContent = '新規商品の追加';
    const maxId = (appData.shop || []).reduce((max, s) => Math.max(max, Number(s.id) || 0), 1000);
    setVal('shop-id', maxId + 1);
    setVal('shop-priority', (appData.shop || []).length + 1001);
  }

  openModal('modal-shop');
}

function saveShopForm(e) {
  e.preventDefault();
  const id = Number(getVal('shop-id'));
  if (!id) return;

  if (!Array.isArray(appData.shop)) appData.shop = [];

  const index = appData.shop.findIndex(s => s.id === id);
  const data = {
    id: id,
    name: getVal('shop-name'),
    shopTag: Number(getVal('shop-tag-select')) || 1,
    merchandiseImage: getVal('shop-merchandiseImage'),
    price: Number(getVal('shop-price')) || 0,
    priority: Number(getVal('shop-priority')) || 1,
    booth: getVal('shop-booth') || null,
    suzuri: getVal('shop-suzuri') || null,
    base: getVal('shop-base') || null,
    fanbox: getVal('shop-fanbox') || null
  };

  if (index >= 0) {
    appData.shop[index] = data;
  } else {
    appData.shop.push(data);
  }

  saveAppData();
  renderShopTable();
  closeModal('modal-shop');
}

function deleteShop(id) {
  if (!confirm('この商品を削除しますか？')) return;
  appData.shop = (appData.shop || []).filter(s => s.id !== id);
  saveAppData();
  renderShopTable();
}

// ============================================================
// 12. リンクリスト（linkList）: 編集と追加
// ============================================================

function renderLinkListTable() {
  const tbody = document.getElementById('linkList-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = appData.linkList || [];
  list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${item.id}</td>
      <td><strong>${escapeHtml(item.title || '')}</strong></td>
      <td>${item.buttonImage ? `<img src="${escapeHtml(resolvePath(item.buttonImage, 'link'))}" class="table-thumb" alt="">` : '-'}</td>
      <td><a href="${escapeHtml(item.link)}" target="_blank" style="color:var(--accent-cyan); text-decoration:underline;">${escapeHtml(item.link)} ↗</a></td>
      <td>${Number(item.priority) || 1}</td>
      <td>
        <div class="table-actions">
          <button class="btn-action-edit" onclick="openLinkListModal(${item.id})">編集</button>
          <button class="btn-action-delete" onclick="deleteLinkList(${item.id})">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openLinkListModal(id = null) {
  const modalTitle = document.getElementById('modal-linkList-title');
  const form = document.getElementById('form-linkList');
  form.reset();

  if (id !== null) {
    const item = (appData.linkList || []).find(l => l.id === id);
    if (!item) return;
    modalTitle.textContent = 'リンクの編集';
    setVal('linkList-id', item.id);
    setVal('linkList-title', item.title || '');
    setVal('linkList-buttonImage', item.buttonImage || '');
    setVal('linkList-link', item.link || '');
    setVal('linkList-priority', item.priority || 1);
  } else {
    modalTitle.textContent = '新規リンクの追加';
    const maxId = (appData.linkList || []).reduce((max, l) => Math.max(max, Number(l.id) || 0), 0);
    setVal('linkList-id', maxId + 1);
    setVal('linkList-priority', (appData.linkList || []).length + 1);
  }

  openModal('modal-linkList');
}

function saveLinkListForm(e) {
  e.preventDefault();
  const id = Number(getVal('linkList-id'));
  if (!id) return;

  if (!Array.isArray(appData.linkList)) appData.linkList = [];

  const index = appData.linkList.findIndex(l => l.id === id);
  const data = {
    id: id,
    title: getVal('linkList-title'),
    buttonImage: getVal('linkList-buttonImage') || null,
    link: getVal('linkList-link'),
    priority: Number(getVal('linkList-priority')) || 1
  };

  if (index >= 0) {
    appData.linkList[index] = data;
  } else {
    appData.linkList.push(data);
  }

  saveAppData();
  renderLinkListTable();
  closeModal('modal-linkList');
}

function deleteLinkList(id) {
  if (!confirm('このリンクを削除しますか？')) return;
  appData.linkList = (appData.linkList || []).filter(l => l.id !== id);
  saveAppData();
  renderLinkListTable();
}

// ============================================================
// 13. セクション並替・表示切替（Section Settings）
// ============================================================

const SECTION_LABELS = {
  notice: "お知らせ (Notice)",
  schedule: "スケジュール (Schedule)",
  gallery: "ギャラリー (Gallery)",
  movie: "動画リスト (Movie)",
  shop: "ショップリスト (Shop)",
  linkList: "リンクリスト (LinkList)"
};

const DEFAULT_SECTION_CONFIG = {
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

function getSectionConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_SECTION_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn(e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SECTION_CONFIG));
}

function saveSectionConfig(config) {
  try {
    localStorage.setItem(STORAGE_SECTION_KEY, JSON.stringify(config));
    showToast('セクション設定を保存しました（LP側にも反映）', 'success');
  } catch (e) {
    console.warn(e);
  }
}

function renderSectionSettings() {
  const container = document.getElementById('section-settings-list');
  if (!container) return;
  container.innerHTML = '';

  const config = getSectionConfig();

  config.order.forEach((secId, idx) => {
    const isVisible = config.visibility ? config.visibility[secId] !== false : true;
    const label = SECTION_LABELS[secId] || secId;

    const row = document.createElement('div');
    row.className = 'section-reorder-item';
    row.innerHTML = `
      <label class="section-reorder-label">
        <input type="checkbox" ${isVisible ? 'checked' : ''} data-toggle-sec="${secId}">
        <span>${label}</span>
      </label>
      <div class="section-reorder-controls">
        <button class="btn-move btn-move-up" data-move-up="${secId}" ${idx === 0 ? 'disabled' : ''} title="上へ">▲</button>
        <button class="btn-move btn-move-down" data-move-down="${secId}" ${idx === config.order.length - 1 ? 'disabled' : ''} title="下へ">▼</button>
      </div>
    `;
    container.appendChild(row);
  });

  // イベント登録
  container.querySelectorAll('input[data-toggle-sec]').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.toggleSec;
      const c = getSectionConfig();
      if (!c.visibility) c.visibility = {};
      c.visibility[id] = e.target.checked;
      saveSectionConfig(c);
      renderSectionSettings();
    });
  });

  container.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      moveSection(e.currentTarget.dataset.moveUp, -1);
    });
  });

  container.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      moveSection(e.currentTarget.dataset.moveDown, 1);
    });
  });
}

function moveSection(secId, dir) {
  const config = getSectionConfig();
  const idx = config.order.indexOf(secId);
  if (idx === -1) return;

  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= config.order.length) return;

  const temp = config.order[idx];
  config.order[idx] = config.order[targetIdx];
  config.order[targetIdx] = temp;

  saveSectionConfig(config);
  renderSectionSettings();
}

function resetSectionConfig() {
  if (!confirm('セクションの並び順と表示状態を初期状態に戻しますか？')) return;
  localStorage.removeItem(STORAGE_SECTION_KEY);
  renderSectionSettings();
  showToast('初期順序に戻しました', 'success');
}

// ============================================================
// 14. エクスポート機能 (JSON / SQL)
// ============================================================

function exportJson() {
  const jsonStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lpwebsample_data_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSONファイルをダウンロードしました', 'success');
}

function exportSql() {
  let sql = `-- Cloudflare D1 データベース用 SQLエクスポート\n-- 日時: ${new Date().toLocaleString()}\n\n`;

  // Profile
  if (appData.profile) {
    const p = appData.profile;
    sql += `-- Profile\nDELETE FROM profile;\nINSERT INTO profile (id, name, pronunciation, romanization, nickname, comment, message, birthday, streaming, age, height, fanName, youtubeUrl, xUrl, platforms_name_1, platforms_link_1, platforms_name_2, platforms_link_2, platforms_name_3, platforms_link_3, moves_1, moves_2, moves_3)\nVALUES (${p.id || 1}, ${esc(p.name)}, ${esc(p.pronunciation)}, ${esc(p.romanization)}, ${esc(p.nickname)}, ${esc(p.comment)}, ${esc(p.message)}, ${esc(p.birthday)}, ${esc(p.streaming)}, ${esc(p.age)}, ${esc(p.height)}, ${esc(p.fanName)}, ${esc(p.youtubeUrl)}, ${esc(p.xUrl)}, ${esc(p.platforms_name_1)}, ${esc(p.platforms_link_1)}, ${esc(p.platforms_name_2)}, ${esc(p.platforms_link_2)}, ${esc(p.platforms_name_3)}, ${esc(p.platforms_link_3)}, ${esc(p.moves_1)}, ${esc(p.moves_2)}, ${esc(p.moves_3)});\n\n`;
  }

  // Visual
  if (Array.isArray(appData.visual) && appData.visual.length > 0) {
    sql += `-- Visual\nDELETE FROM visual;\n`;
    appData.visual.forEach(v => {
      sql += `INSERT INTO visual (id, costumeName, visualUrl, thumdUrl, thumdBackground, visualBackground, comment, characterDesign, illustrator, live2d, modeling3d, priority) VALUES (${v.id}, ${esc(v.costumeName)}, ${esc(v.visualUrl)}, ${esc(v.thumdUrl)}, ${esc(v.thumdBackground)}, ${esc(v.visualBackground)}, ${esc(v.comment)}, ${esc(v.characterDesign)}, ${esc(v.illustrator)}, ${esc(v.live2d)}, ${esc(v.modeling3d || v['3dModeling'])}, ${v.priority || 1});\n`;
    });
    sql += `\n`;
  }

  const blob = new Blob([sql], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lpwebsample_seed_${new Date().toISOString().slice(0,10)}.sql`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('SQLファイルをダウンロードしました', 'success');
}

function esc(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// ============================================================
// 15. 汎用ヘルパー
// ============================================================

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val !== null && val !== undefined) ? val : '';
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

function resolvePath(filename, type) {
  if (!filename) return '';
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('/') || filename.startsWith('data:')) {
    return filename;
  }
  if (filename.startsWith('assets/')) {
    return filename;
  }
  switch (type) {
    case 'visual': return `assets/visual/visual/${filename}`;
    case 'thumd': return `assets/visual/thumd/${filename}`;
    case 'gallery': return `assets/gallery/${filename}`;
    case 'shop': return `assets/shop/${filename}`;
    case 'link': return `assets/link/${filename}`;
    case 'movie': return `assets/movieImage/${filename}`;
    default: return `assets/${filename}`;
  }
}

function initAllViews() {
  initProfileForm();
  renderVisualTable();
  renderNoticeTable();
  renderScheduleTags();
  renderScheduleTable();
  renderGalleryGrid();
  renderMovieLabels();
  renderMovieTable();
  renderShopTags();
  renderShopTable();
  renderLinkListTable();
  renderSectionSettings();
  updateBadges();
}

// ============================================================
// 16. イベントリスナー登録
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // データ読み込み
  loadAppData();

  // ハンバーガーボタン & オーバーレイ
  document.getElementById('btn-hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // ナビゲーション切り替え
  document.querySelectorAll('.nav-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSection(btn.dataset.section);
    });
  });

  // プロフィールフォーム保存
  document.getElementById('form-profile')?.addEventListener('submit', saveProfile);

  // 各モーダルのフォーム送信
  document.getElementById('form-visual')?.addEventListener('submit', saveVisualForm);
  document.getElementById('form-notice')?.addEventListener('submit', saveNoticeForm);
  document.getElementById('form-schedule')?.addEventListener('submit', saveScheduleForm);
  document.getElementById('form-gallery')?.addEventListener('submit', saveGalleryForm);
  document.getElementById('form-movie')?.addEventListener('submit', saveMovieForm);
  document.getElementById('form-shop')?.addEventListener('submit', saveShopForm);
  document.getElementById('form-linkList')?.addEventListener('submit', saveLinkListForm);

  // タグ追加
  document.getElementById('btn-add-schedule-tag')?.addEventListener('click', addScheduleTag);
  document.getElementById('btn-add-movie-label')?.addEventListener('click', addMovieLabel);
  document.getElementById('btn-add-shop-tag')?.addEventListener('click', addShopTag);

  // セクション設定リセット
  document.getElementById('btn-reset-section-config')?.addEventListener('click', resetSectionConfig);

  // 再取得 / エクスポート
  document.getElementById('btn-reload-api')?.addEventListener('click', reloadFromApi);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJson);
  document.getElementById('btn-export-sql')?.addEventListener('click', exportSql);

  // モーダル閉じるイベント（backdrop & closeボタン）
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-wrapper');
      if (modal) modal.classList.remove('is-open');
    });
  });

  document.querySelectorAll('.modal-wrapper').forEach(wrapper => {
    wrapper.addEventListener('click', (e) => {
      if (e.target === wrapper) {
        wrapper.classList.remove('is-open');
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-wrapper.is-open').forEach(m => m.classList.remove('is-open'));
    }
  });

  // デフォルトはプロフィール表示
  switchSection('profile');
});
