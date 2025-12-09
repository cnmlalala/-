// treasures.js - Treasure system implementation
(function(){
  // Ensure core is ready
  const G = window.Game;
  if(!G){ console.error('[treasures] Game core not ready'); return; }
  const AS = window.AssetStore;

  // ------------------------------------------------------------------
  // Definitions & asset registration
  // ------------------------------------------------------------------
  const PREFIX = '图片素材/法宝/';
  const TREASURES = [
    { id:'baguajing',  name:'八卦镜', img: PREFIX+'八卦镜.png'  },
    { id:'kunsiansheng', name:'捆仙绳', img: PREFIX+'捆仙绳.png'  },
    { id:'taijitu',    name:'太极图', img: PREFIX+'太极图.png'    },
    { id:'zijinhulu',  name:'紫金葫芦', img: PREFIX+'紫金葫芦.png'  },
  ];
  if(AS && AS.registerImage){
    TREASURES.forEach(t=> AS.registerImage('treasure_'+t.id, t.img));
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const MAP_TREASURES = []; // {id,x,y,r}
  let heldTreasure = null;  // treasure id

  // expose helper for HUD
  window.Game.heldTreasureId = () => heldTreasure;
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function circleOverlap(ax,ay,ar,bx,by,br){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy <= (ar+br)*(ar+br); }

  // ------------------------------------------------------------------
  // Spawning logic – ensure unique instance for each type
  // ------------------------------------------------------------------
  const WORLD = G.world || { width:5000, height:3500, obstacles:[] };
  function spawnSingle(id){
    const def = TREASURES.find(t=>t.id===id); if(!def) return;
    let tries = 40;
    const r = 22;
    while(tries--){
      const x = Math.random()*WORLD.width;
      const y = Math.random()*WORLD.height;
      let blocked=false;
      for(const ob of WORLD.obstacles||[]){
        if(x>ob.x-40 && x<ob.x+ob.w+40 && y>ob.y-40 && y<ob.y+ob.h+40){ blocked=true; break; }
      }
      if(!blocked){ MAP_TREASURES.push({id:def.id,x,y,r}); break; }
    }
  }
  function ensureTreasures(){
    TREASURES.forEach(t=>{
      if(!MAP_TREASURES.some(mt=>mt.id===t.id) && heldTreasure!==t.id){
        spawnSingle(t.id);
      }
    });
  }
  ensureTreasures();
  setInterval(ensureTreasures, 30000);

  // ------------------------------------------------------------------
  // Pickup logic
  // ------------------------------------------------------------------
  function tryPickupTreasure(){
    const p = G.player;
    for(let i=MAP_TREASURES.length-1;i>=0;i--){
      const tr = MAP_TREASURES[i];
      if(circleOverlap(p.x,p.y,p.radius,tr.x,tr.y,tr.r)){
        // replace
        if(heldTreasure){
          spawnSingle(heldTreasure); // drop previous one back to map somewhere
        }
        heldTreasure = tr.id;
        MAP_TREASURES.splice(i,1);
        const name = TREASURES.find(t=>t.id===heldTreasure).name;
        G.spawnFloatText?.(`获得法宝【${name}】, 按Q释放`, p.x, p.y);
        G.totalTreasures = (G.totalTreasures||0) + 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // Activation logic (placeholder effects)
  // ------------------------------------------------------------------
  function activateTreasure(){
    if(!heldTreasure) return;
    const id = heldTreasure; heldTreasure = null;
    const name = TREASURES.find(t=>t.id===id)?.name || id;
    const p = G.player;
    G.spawnFloatText?.(`释放 ${name}!`, p.x, p.y);

    // Handle individual treasure effects
    if(window.TreasureFX){ TreasureFX.trigger(id); }
    switch(id){
      case 'baguajing':{ // 八卦镜：杀死小怪，摧毁精英武器，停止Boss旋转
        const enemies = G.enemies || [];
        let killCount = 0;
        for(let i=enemies.length-1; i>=0; i--){
          const e = enemies[i];
          if(!e) continue;
          if(e.role === 'minion'){
            // spawn visual effect
            if(G.spawnSparks){ G.spawnSparks(e.x, e.y, 'rgba(255,230,160,0.9)', 14); }
            enemies.splice(i,1);
            killCount++;
          } else if(e.role === 'elite'){
            // destroy all weapons of elite
            for(const w of e.weapons){ if(w) (G.markWeaponDestroyed ? G.markWeaponDestroyed(w, { killer:'playerTreasure', victimOwner:'npc' }) : (w.alive=false)); }
          } else if(e.role === 'boss'){
            // 由 BuddhaNS 统一处理佛陀的冻结与特效；其他Boss维持通用逻辑
            if(window.BuddhaNS && BuddhaNS.isBuddha(e)){
              BuddhaNS.onTreasureActivate('baguajing', e);
            } else {
              const now = performance.now();
              e._spinFrozenUntil = Math.max(e._spinFrozenUntil||0, now + 5000);
              e.weaponSpinSpeed = 0;
              e._spinInnerSpeed = 0;
              e._spinOuterSpeed = 0;
            }
          }
        }
        if(killCount>0){ G.spawnFloatText?.(`消灭${killCount}个小怪!`, p.x, p.y-30); }
        // update total kills stats
        if(killCount>0){ G.totalKills = (G.totalKills||0) + killCount; }
        break; }
      case 'kunsiansheng':
        {
          // 捆仙绳：缴械所有敌人，将其武器作为掉落物抛出，5 秒后敌人恢复新武器
          const enemies = G.enemies || [];
          const DROP_RADIUS = 26;
          const RESTORE_DELAY = 5000; // ms
          enemies.forEach(e => {
            if (!e || !e.weapons || e.weapons.length === 0) return;
            // 保护：女仙 Boss 在自然共鸣结束后锁定武器，不参与捆仙绳清理与重建
            if (e && e.skin==='boss_nvXian' && e._lockWeapons) return;
            if(window.BuddhaNS && BuddhaNS.isBuddha(e)){
              // 钩子：佛陀对捆仙绳的特殊响应（当前为空，实现保持一致行为）
              BuddhaNS.onTreasureActivate('kunsiansheng', e);
            }
            // Drop each alive weapon as a pickup with count 1 at enemy position
            e.weapons.forEach(w => {
              if (!w.alive) return;
              const px = e.x + (Math.random() - 0.5) * DROP_RADIUS;
              const py = e.y + (Math.random() - 0.5) * DROP_RADIUS;
              const pick = { x: px, y: py, r: 18, q: w.quality, count: 1 };
              (G.placePickupNonOverlap ? G.placePickupNonOverlap(pick) : pick);
              (G.pickups || []).push(pick);
              w.alive = false;
            });
            // Schedule weapon regeneration after delay
            const regenFn = () => {
              // 再次保护：女仙 Boss 已锁定武器时不做重建
              if (e && e.skin==='boss_nvXian' && e._lockWeapons) return;
              if (e.alive === false) return; // if enemy dead ignore
              const newCount = Math.min(4, 2 + Math.floor(Math.random() * 3));
              e.weapons = [];
              for (let i = 0; i < newCount; i++) {
                const q = Math.min(G.QUALITY.length - 1, Math.floor(Math.random() * 4));
                const newW = G.addWeapon ? G.addWeapon(q, 0) : { quality: q, angle: 0, radius: 10, alive: true };
                e.weapons.push(newW);
              }
            };
            setTimeout(regenFn, RESTORE_DELAY);
          });
        }
        break;
      case 'taijitu':
        {
          // 太极图：翻转所有武器品质（高<->低）；若存在佛陀Boss，触发佛陀特攻（封禁禅寂领域20s）
          const maxQ = G.QUALITY.length - 1;
          // player weapons
          G.player.weapons.forEach(w => { w.quality = maxQ - w.quality; });
          // enemy weapons
          (G.enemies || []).forEach(e => {
            e.weapons.forEach(w => { w.quality = maxQ - w.quality; });
            if(window.BuddhaNS && BuddhaNS.isBuddha(e)){
              BuddhaNS.onTreasureActivate('taijitu', e);
            }
          });
          // pickups on map
          (G.pickups || []).forEach(p => { p.q = maxQ - p.q; });
          // recalc visuals
          if (typeof G.recalcWeaponAngles === 'function') G.recalcWeaponAngles();
          G.spawnFloatText?.('阴阳逆转！', p.x, p.y - 24);
        }
        break;
      case 'zijinhulu':
        {
          // 紫金葫芦：瞬间吸收地图上所有拾取物并立刻计入背包，触发自动合成
          const picks = G.pickups || [];
          let absorbed = 0;
          for (let i = picks.length - 1; i >= 0; i--) {
            const pk = picks[i];
            if (!pk) continue;
            // 视觉效果
            G.spawnSparks?.(pk.x, pk.y, 'rgba(255,215,128,0.9)', 12);
            // 标记为吸收中，让 updatePickups 执行飞向玩家动画
            pk.absorbing = true;
            // 不立即移除，让核心拾取逻辑在靠近玩家时处理
            absorbed += pk.count || 1;
          }
          if(absorbed>0){
            G.spawnFloatText?.(`葫芦吸收 ${absorbed} 件武器！`, p.x, p.y - 24);
          }
        }
        break;
      default:
        break;
    }
  }

  // listen keyboard
  document.addEventListener('keydown', e=>{
    if(e.key==='q' || e.key==='Q'){
      if(!heldTreasure){
        const p = G.player || {x:0,y:0};
        G.spawnFloatText?.('当前背包无法宝', p.x, p.y - 30, 'ft-error');
      } else {
        activateTreasure();
      }
    }
    if(e.key==='m' || e.key==='M'){
      miniMapVisible = !miniMapVisible;
      updateMiniMapVisibility();
    }
  });

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function drawTreasures(){
    const ctx = G.ctx; if(!ctx) return;
    ctx.save();
    // use same camera transform defined in render_particles.applyCamera if exists
    if(typeof G.applyCamera==='function'){ G.applyCamera(); }
    MAP_TREASURES.forEach(tr=>{
      const imgKey = 'treasure_'+tr.id;
      const img = AS?.images?.[imgKey];
      if(img){ ctx.drawImage(img, tr.x-tr.r, tr.y-tr.r, tr.r*2, tr.r*2); }
      else { ctx.fillStyle = '#f5d142'; ctx.beginPath(); ctx.arc(tr.x,tr.y,tr.r,0,Math.PI*2); ctx.fill(); }
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Patch into existing game loop
  // ------------------------------------------------------------------
  const origTryPickup = G.tryPickup;
  G.tryPickup = function(){ if(origTryPickup) origTryPickup.apply(this,arguments); tryPickupTreasure(); };

  // ------------------------------------------------------------------
  // Mini-map (top-right overlay)
  // ------------------------------------------------------------------
  const mmCanvas = document.getElementById('minimapCanvas') || (()=>{
    const c = document.createElement('canvas');
    document.body.appendChild(c);
    // mark that we injected this element so we can style it independently
    c.__injectedByTreasure = true;
    return c;
  })();
  const mmSize = { w: mmCanvas.width || 160, h: mmCanvas.height || 160 };
  mmCanvas.width = mmSize.w;
  mmCanvas.height = mmSize.h;

  // Common style tweaks
  mmCanvas.style.pointerEvents = 'none'; // 不阻挡鼠标

  // Only apply absolute positioning if this script injected the mini-map canvas directly under body.
  if (mmCanvas.__injectedByTreasure) {
    Object.assign(mmCanvas.style, {
      position: 'absolute',
      right: '10px',
      top: '10px',
      width: mmSize.w + 'px',
      height: mmSize.h + 'px',
      zIndex: 20,
      border: 'none',
      background: 'transparent'
    });
  }
  const mmCtx = mmCanvas.getContext('2d');

  // 小地图可见性
  let miniMapVisible = true;
  function updateMiniMapVisibility(){
    mmCanvas.style.display = miniMapVisible ? 'block' : 'none';
  }
  updateMiniMapVisibility();

  function drawMiniMap(){
    if(!miniMapVisible) return;
    mmCtx.clearRect(0,0,mmSize.w,mmSize.h);
    // 背景半透明黑色
    mmCtx.fillStyle = 'rgba(0,0,0,0.35)';
    mmCtx.fillRect(0,0,mmSize.w,mmSize.h);
    mmCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    mmCtx.lineWidth = 2;
    mmCtx.strokeRect(0.5,0.5,mmSize.w-1,mmSize.h-1);

    const world = G.world || {width:1,height:1};
    const scaleX = mmSize.w / world.width;
    const scaleY = mmSize.h / world.height;
    // draw treasures (use icon if loaded)
    MAP_TREASURES.forEach(tr=>{
      const imgKey = 'treasure_'+tr.id;
      const img = AS?.images?.[imgKey];
      const tx = tr.x * scaleX;
      const ty = tr.y * scaleY;
      if(img && img.complete && img.naturalWidth>0){
        const size = 16; // icon size on minimap
        mmCtx.drawImage(img, tx - size/2, ty - size/2, size, size);
      } else {
        mmCtx.fillStyle = '#ffd53f';
        mmCtx.beginPath();
        mmCtx.arc(tx, ty, 6, 0, Math.PI*2); mmCtx.fill();
      }
    });
    // draw player
    if(G.player){
      mmCtx.fillStyle = '#ffffff';
      mmCtx.beginPath(); mmCtx.arc(G.player.x*scaleX, G.player.y*scaleY, 5, 0, Math.PI*2); mmCtx.fill();
    }
  }

  // ------------------------------------------------------------------
  // integrate into main draw AFTER all modules have set up G.draw.
  // We will hook when window 'load' or immediate call via patchDraw function below.
  /* immediate wrapper removed; patchDraw will handle integration */
  // ------------------------------------------------------------------
  
  /* remove separate loop previously added */
  // integrate into main draw AFTER all modules have set up G.draw
  function patchDraw(){
    const base = G.draw;
    if(!base || base.__treasurePatched) return;
    const wrapped = function(){
      base.apply(this, arguments);
      drawTreasures();
      drawMiniMap();
    };
    wrapped.__treasurePatched = true;
    G.draw = wrapped;
  }
  
  if(document.readyState === 'complete'){
    patchDraw();
  }else{
    window.addEventListener('load', patchDraw);
  }
  
  /* separate rAF loop already removed */
  // expose for debugging
  Object.assign(G,{
    treasuresOnMap: MAP_TREASURES,
    heldTreasureId: ()=>heldTreasure,
    treasureDefs: TREASURES,
    activateTreasure
  });
})();