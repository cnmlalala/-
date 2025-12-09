// cultivation_panel.js - 修仙进境面板
(function(){
  const G = window.Game;
  if(!G){ console.error('[cultivation_panel] Game core not ready'); return; }

  // -------------------------------------------------------------
  // 统计字段挂到 Game.stats，便于其他模块访问/修改
  // -------------------------------------------------------------
  if(!G.stats){
    G.stats = { picked: G.totalPickups || 0, destroyed: 0, kills: G.totalKills || 0 };
  }

  // -------------------------------------------------------------
  // DOM 构建
  // -------------------------------------------------------------
  const panel = document.createElement('div');
  panel.id = 'cultivationPanel';
  panel.className = 'xian-panel cultivation-panel hidden';
  Object.assign(panel.style, {
    position: 'relative',
    maxWidth: '240px'
  });
  panel.innerHTML = `
    <div class="panel-title">修仙进境</div>
    <div id="cult-stat-picked">已拾取武器：0</div>
    <div id="cult-stat-treasures">获得法宝：0</div>
    <div id="cult-stat-destroyed">已摧毁武器：0</div>
    <div id="cult-stat-highq">最高品质：白色（再拾取0件可升阶）</div>
    <div id="cult-stat-kills">斩杀妖邪：0</div>
    <div id="cult-weapon-list">当前装备：-</div>
      <div id="cult-storage-toggle" class="toggle">存储统计 ▸</div>
      <div id="cult-storage" class="storage hidden"></div>
    <div id="cult-held-treasure">当前法宝：无</div>
    <div id="cult-held-desc" class="tre-desc"></div>
  `;
  // 挂载到 HUD 左侧容器
  const hudLeft = document.querySelector('#hud .hud-left') || document.body;
  hudLeft.appendChild(panel);
  // 隐藏旧版修仙面板（如果仍在 DOM 中）
  const legacyPanel = document.querySelector('#hud .xian-panel');
  if(legacyPanel && legacyPanel !== panel){ legacyPanel.style.display = 'none'; }

  // 元素引用
  const elPicked     = panel.querySelector('#cult-stat-picked');
  const elDestroyed  = panel.querySelector('#cult-stat-destroyed');
  const elTreasure   = panel.querySelector('#cult-stat-treasures');
  const elHighQ      = panel.querySelector('#cult-stat-highq');
  const elKills      = panel.querySelector('#cult-stat-kills');
  const elWeaponList = panel.querySelector('#cult-weapon-list');
  const elStorageTg  = panel.querySelector('#cult-storage-toggle');
  const elStorage    = panel.querySelector('#cult-storage');
  const elHeldTre    = panel.querySelector('#cult-held-treasure');
  const elHeldDesc   = panel.querySelector('#cult-held-desc');

  // 法宝描述
  const treasureDesc = {
    baguajing: '镜光四射，斩妖祛邪',
    kunsiansheng: '缚仙锁器，缴械四方',
    taijitu: '阴阳逆转，品质翻转',
    zijinhulu: '吞纳八荒，瞬吸武器'
  };
  // -------------------------------------------------------------
  // 数据与更新逻辑
  // -------------------------------------------------------------
  const QUALITY = G.QUALITY || [];
  const MERGE_NEED = G.MERGE_NEED || [];

  function updatePanel(){
    const stats = G.stats;
    if(!stats) return;

    // 同步拾取/击杀计数器（若其他模块已更新 Game.totalPickups 等）
    stats.picked = G.totalPickups || stats.picked;
    stats.kills  = G.totalKills  || stats.kills;

    // 最高品质与升级需求
    let maxQ = 0;
    const counts = new Array(QUALITY.length).fill(0);
    for(const w of G.player.weapons){
      if(!w || w.alive === false) continue;
      counts[w.quality]++;
      if(w.quality > maxQ) maxQ = w.quality;
    }

    let need = 0;
    if(maxQ < QUALITY.length - 1){
      const c = counts[maxQ];
      const needPerUpgrade = MERGE_NEED[maxQ];
      if (Number.isFinite(needPerUpgrade)) {
        need = Math.max(0, needPerUpgrade - c);
      } else {
        need = null;
      }
    }

    // 当前装备武器列表描述
    const listParts = [];
    for(let qi = QUALITY.length - 1; qi >= 0; qi--){
      if(counts[qi] > 0){
        listParts.push(`${QUALITY[qi].name}×${counts[qi]}`);
      }
    }
    const listText = listParts.join('，') || '无';

    // 存储区统计：数量与品质分布
    const sCounts = new Array(QUALITY.length).fill(0);
    const storage = (G.player && Array.isArray(G.player.storage)) ? G.player.storage : [];
    for(const q of storage){ sCounts[q]++; }
    const totalStored = storage.length;
    const sParts = [];
    for(let qi=QUALITY.length-1; qi>=0; qi--){ if(sCounts[qi]>0){ sParts.push(`${QUALITY[qi].name}×${sCounts[qi]}`); } }
    const sText = sParts.join('，') || '无';
    elStorage.textContent = `当前存储：${totalStored}（${sText}）`;
    // 展开/收起 存储统计
    elStorageTg.addEventListener('click', ()=>{
    elStorage.classList.toggle('hidden');
    elStorageTg.textContent = `存储统计 ${elStorage.classList.contains('hidden') ? '▸' : '▾'}`;
    });

    // 写入 DOM
    elPicked.textContent    = `已拾取武器：${stats.picked}`;
    elDestroyed.textContent = `已摧毁武器：${stats.destroyed}`;
    elTreasure.textContent  = `获得法宝：${G.totalTreasures||0}`;
    elKills.textContent     = `斩杀妖邪：${stats.kills}`;
    if(maxQ === QUALITY.length - 1){
      elHighQ.textContent = `最高品质：${QUALITY[maxQ]?.name || '白色'}（已获取最高品质武器）`;
    } else {
      elHighQ.textContent = `最高品质：${QUALITY[maxQ]?.name || '白色'}${need === null ? '（无法通过拾取升阶）' : `（再拾取${need}件可升阶）`}`;
    }
    elWeaponList.textContent = `当前装备：${listText}`;

    const heldId = (G.heldTreasureId && G.heldTreasureId()) || null;
    const heldName = heldId ? (G.treasureDefs?.find(t=>t.id===heldId)?.name||heldId) : '无';
    elHeldTre.textContent = `当前法宝：${heldName}`;
    elHeldDesc.textContent = heldId ? (treasureDesc[heldId]||'按Q释放') : '';
  }

  // -------------------------------------------------------------
  // 将更新函数挂到 Game，以便主 HUD 调用
  // -------------------------------------------------------------
  G.updateCultivationPanel = updatePanel;

  // 熔合到现有 HUD 更新函数
  if(typeof G.updateHUD === 'function'){
    const origHud = G.updateHUD;
    G.updateHUD = function(){
      origHud.apply(this, arguments);
      updatePanel();
    };
  }

  // -------------------------------------------------------------
  // 热键：C 键显示/隐藏
  // -------------------------------------------------------------
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 'c'){
      panel.classList.toggle('hidden');
    }
  });

})();