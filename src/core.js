// 核心模块：通用配置、输入、世界与玩家、拾取与武器、HUD
(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hud = {
    healthFill: document.getElementById('health-fill'),
    weaponCount: document.getElementById('weapon-count'),
    highestQuality: document.getElementById('highest-quality'),
    kills: document.getElementById('kills-count'),
    treasureHeld: document.getElementById('treasure-held'),
    pickupLog: document.getElementById('pickup-log'),
    pauseBtn: document.getElementById('pause-btn')
  };
  const Assets = window.AssetStore || { images: {} };

  // 适配不同分辨率
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();

  // 输入系统
  const input = { keys: new Set(), mouse: {x:0,y:0,down:false}, touchTarget: null };
  window.addEventListener('keydown', e => input.keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup',   e => input.keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); input.mouse.x = e.clientX - r.left; input.mouse.y = e.clientY - r.top; });
  canvas.addEventListener('mousedown', ()=>{ input.mouse.down = true; });
  canvas.addEventListener('mouseup',   ()=>{ input.mouse.down = false; });
  canvas.addEventListener('touchstart', e => { const t=e.touches[0]; const r=canvas.getBoundingClientRect(); input.touchTarget={x:t.clientX-r.left,y:t.clientY-r.top}; }, {passive:true});
  canvas.addEventListener('touchmove',  e => { const t=e.touches[0]; if(!t) return; const r=canvas.getBoundingClientRect(); input.touchTarget={x:t.clientX-r.left,y:t.clientY-r.top}; }, {passive:true});
  canvas.addEventListener('touchend', ()=>{ input.touchTarget=null; }, {passive:true});

  // 工具函数
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };

  // 品质与旋转速度
  const QUALITY = [
    {name:'白色', color:'#ffffff', pickText:'+1 白色武器', glow:0.15, spark:'rgba(255,255,255,0.7)'},
    {name:'绿色', color:'#3cd070', pickText:'+1 绿色武器', glow:0.18, spark:'rgba(60,208,112,0.75)'},
    {name:'蓝色', color:'#3fa7ff', pickText:'+1 蓝色武器', glow:0.22, spark:'rgba(63,167,255,0.8)'},
    {name:'紫色', color:'#9e5fff', pickText:'+1 紫色武器', glow:0.26, spark:'rgba(158,95,255,0.85)'},
    {name:'橙色', color:'#ff8c3f', pickText:'+1 橙色武器', glow:0.30, spark:'rgba(255,140,63,0.85)'},
    {name:'红色', color:'#ff3f55', pickText:'+1 红色武器', glow:0.34, spark:'rgba(255,63,85,0.9)'},
    {name:'金色', color:'#ffd53f', pickText:'+1 金色武器', glow:0.42, spark:'rgba(255,213,63,0.95)'},
    // 新增：七彩（作为最高品质，用于特殊判定与视觉效果）
    {name:'七彩', color:'#ffffff', pickText:'+1 七彩武器', glow:0.55, spark:'rgba(255,255,255,0.95)'}
  ];
  const SPIN_SPEED_TIERS = { low:0.35, mid:0.6, high:0.95 };

  // 武器合成所需数量配置，对应各品质升阶所需材料数
  // [白->绿, 绿->蓝, 蓝->紫, 紫->橙, 橙->红, 红->金, 金->无, 七彩->无]
  const MERGE_NEED = [3, 3, 3, 3, 3, 3, Infinity, Infinity];

  // 皮肤键名（需与 assets.js 注册一致）
  const MINION_SKINS=['minion_rat','minion_tree','minion_cute','minion_swarm','minion_pig','minion_shrimp'];
  const ELITE_SKINS=['elite_monk','elite_taoshi','elite_xianbing','elite_tudi','elite_nvdizi','elite_monu'];
  const BUILDING_SKINS=['building_temple','building_daoguan','building_tiangong','building_xianshan','building_pagoda'];
  const BOSS_SKINS=['boss_niumo','boss_fotuo','boss_longwang','boss_nvXian','boss_tiandi'];
  const weaponSkins = ['weapon_sword','weapon_staff'];

  // 世界与障碍（地图扩大）
  const world = { width:5000, height:3500, obstacles: [] };
  for(let i=0;i<12;i++){ const w=140+Math.random()*200; const h=90+Math.random()*140; world.obstacles.push({ x:Math.random()*(world.width-w-80)+40, y:Math.random()*(world.height-h-80)+40, w,h }); }

  // 摄像机与缩放（1.5倍放大，角色居中跟随）
  const camera = { scale: 1.5, cx: 0, cy: 0, viewW: canvas.width/1.5, viewH: canvas.height/1.5 };
  function updateCamera(){
    camera.viewW = canvas.width / camera.scale;
    camera.viewH = canvas.height / camera.scale;
    camera.cx = clamp(player.x, camera.viewW/2, world.width - camera.viewW/2);
    camera.cy = clamp(player.y, camera.viewH/2, world.height - camera.viewH/2);
  }

  // 玩家
  const player = { x:world.width/2, y:world.height/2, vx:0, vy:0, speed:260, accel:1800, deccel:2200, radius:18, health:100, maxHealth:100, state:'idle', weaponCapacity:20, weapons:[], storage:[], weaponSpin:0, weaponSpinSpeed:SPIN_SPEED_TIERS.mid, skin: 'player' };

  // 漂浮文本
  function spawnFloatText(text, wx, wy, roleClass = '') {
    // 去重：同文案+同样式在存在期间只显示一个；若再次触发则延长显示时间并更新锚点位置
    const key = (roleClass ? roleClass + '|' : '') + text;
    const Gm = window.Game || (window.Game = {});
    Gm._floatTextMap = Gm._floatTextMap || new Map();
    const map = Gm._floatTextMap;
    const existing = map.get(key);
    if (existing && existing.alive) {
      // 更新位置并延长寿命到 3s（从本次触发开始重新计时）
      existing.anchor.x = wx;
      existing.anchor.y = wy;
      try { clearTimeout(existing.timer); } catch(_) {}
      existing.timer = setTimeout(() => {
        existing.alive = false;
        existing.el.remove();
        map.delete(key);
      }, 3000);
      return; // 不再新增元素
    }

    const el = document.createElement('div');
    el.className = 'float-text' + (roleClass ? ' ' + roleClass : '');
    el.textContent = text;
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    const entry = { el, anchor: { x: wx, y: wy }, alive: true, timer: null };
    function updatePos() {
      if (!entry.alive) return;
      try {
        const { camera, canvas } = window.Game;
        const rect = canvas.getBoundingClientRect();
        const sx = (entry.anchor.x - camera.cx) * camera.scale + canvas.width / 2 + rect.left;
        const sy = (entry.anchor.y - camera.cy) * camera.scale + canvas.height / 2 + rect.top;
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
      } catch (err) {
        // Game 未就绪时忽略定位异常
      }
      requestAnimationFrame(updatePos);
    }
    updatePos();

    map.set(key, entry);
    entry.timer = setTimeout(() => {
      entry.alive = false;
      el.remove();
      map.delete(key);
    }, 3000);
  }

  // 武器生成
  function createWeapon(qIndex){ const wskin = weaponSkins[Math.floor(Math.random()*weaponSkins.length)]; return { id:Math.random().toString(36).slice(2), quality:qIndex, angle:0, radius:10, damage:10+qIndex*6, knockback: qIndex>=2?80:40, alive:true, skin: wskin }; }

  // 拾取点
  const pickups=[];
  function rollPickupCount(){ const r=Math.random(); if(r<0.05) return 99; if(r<0.20) return 30+Math.floor(Math.random()*31); return 1+Math.floor(Math.random()*20); }
  // 统一拾取放置：避免与已有拾取重叠
  function placePickupNonOverlap(obj){
    obj.r = obj.r || 18;
    obj.x = clamp(obj.x, obj.r, world.width - obj.r);
    obj.y = clamp(obj.y, obj.r, world.height - obj.r);
    for(let tries=0; tries<40; tries++){
      let overlapped=false;
      for(const p of pickups){ const dx=obj.x-p.x, dy=obj.y-p.y; const rr=(obj.r||18)+(p.r||18); if(dx*dx+dy*dy <= rr*rr){ overlapped=true; break; } }
      if(!overlapped) break;
      const ang = Math.random()*Math.PI*2; const step = (obj.r||18) + 6;
      obj.x = clamp(obj.x + Math.cos(ang)*step, obj.r, world.width - obj.r);
      obj.y = clamp(obj.y + Math.sin(ang)*step, obj.r, world.height - obj.r);
    }
    return obj;
  }
  function spawnPickup(){ const qIndex=Math.floor(Math.random()*Math.min(QUALITY.length,4)); const x=Math.random()*world.width; const y=Math.random()*world.height; const obj = {x,y,r:18,q:qIndex,count:rollPickupCount(),skin:null}; placePickupNonOverlap(obj); pickups.push(obj); }

  // 根据敌人角色类型生成掉落武器
  function dropWeapons(x, y, role='minion'){
    // 1-3 个掉落物，数量总和满足区间
    const dropCount = 1 + Math.floor(Math.random()*3); // 1-3
    let totalMin=5, totalMax=50; let qualChoices=[0,1];
    if(role==='elite') { totalMin=10; totalMax=50; qualChoices=[2,3]; }
    else if(role==='boss'){ totalMin=5; totalMax=20; qualChoices=[4,5]; }
    // 确定总体数量
    const totalNum = totalMin + Math.floor(Math.random()*(totalMax - totalMin + 1));
    // 随机分配到若干拾取
    let remaining = totalNum;
    for(let i=0;i<dropCount;i++){
      const remainingSlots = dropCount - i;
      let count;
      if(remainingSlots===1) count = remaining; else {
        // 随机切分，确保每个至少1
        const maxForThis = remaining - (remainingSlots - 1);
        count = 1 + Math.floor(Math.random()*maxForThis);
      }
      remaining -= count;
      const q = qualChoices[Math.floor(Math.random()*qualChoices.length)];
      const ang = Math.random()*Math.PI*2; const dist = 30 + Math.random()*40;
      const px = clamp(x + Math.cos(ang)*dist, 18, world.width-18);
      const py = clamp(y + Math.sin(ang)*dist, 18, world.height-18);
      const obj = { x:px, y:py, r:18, q, count, skin:null };
      placePickupNonOverlap(obj);
      pickups.push(obj);
    }
  }
  // 周期性刷新拾取
  let pickupSpawnTimer = 0;
  function updatePickups(dt){
    // 先处理被法宝吸收中的拾取，向玩家位置移动
    for(const p of pickups){
      if(p.absorbing){
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        // 固定吸附速度，可根据需要调整 (像素/秒)
        const pullSpeed = 800; // 越大吸附越快
        const vx = dx / dist * pullSpeed;
        const vy = dy / dist * pullSpeed;
        p.x += vx * dt/1000;
        p.y += vy * dt/1000;
        // 若足够接近则让普通拾取逻辑接管
        // 当距离小于可拾取范围时停止吸附，让后续拾取逻辑处理
        if(dist < player.radius + (p.r||18)){
          // 保持在玩家位置附近等待普通拾取流程
          // 不立即取消 absorbing，继续保持吸力，确保能贴靠玩家
        }
      }
    }

    pickupSpawnTimer += dt;
    // 轻量随机刷新：每 30s 保证地图上有合理数量的随机拾取（不覆盖势力掉落区）
    if(pickupSpawnTimer >= 30000){
      pickupSpawnTimer = 0;
      const desired = 22; // 地图随机拾取目标数量
      let current = 0;
      for(const p of pickups){ if(!p.zoneId) current++; }
      const need = Math.max(0, desired - current);
      for(let i=0;i<need;i++) spawnPickup();
    }
    // 小刻度自然生成：每 4s 随机生成一个，避免过空
    if(pickupSpawnTimer % 4000 < dt){ spawnPickup(); }

    // 新增：战技期间的“接触即摧毁”兜底清理（防止外部包装未调用原始 tryPickup 导致拾取物停留原地）
    const G = window.Game; const act = G?.player;
    const skillActive = !!(act && Array.isArray(act.skillWeapons) && act.skillWeapons.some(sw=> sw && (sw._skillTag==='moonblade' || sw._skillTag==='magic_blade_thousand')));
    if(skillActive){
      for(let i=pickups.length-1;i>=0;i--){
        const p = pickups[i];
        if(circleOverlap(player.x, player.y, player.radius, p.x, p.y, p.r||18)){
          pickups.splice(i,1);
          G?.spawnFloatText?.('战技期间摧毁普通武器', player.x, player.y - 20, 'ft-purple');
          player.pickupShieldTimer = Math.max(700, (player.pickupShieldTimer || 0));
        }
      }
    }
  }
  for(let i=0;i<14;i++) spawnPickup();

  // HUD
  function updateHUD(){
    hud.weaponCount.textContent = `武器：${countActiveWeapons()}/${player.weaponCapacity}`;
    let hqIndex=0; for(const w of player.weapons){ if(w.alive!==false && w.quality>hqIndex) hqIndex=w.quality; }
    player.equippedQuality = hqIndex;
    hud.highestQuality.textContent = `最高品质：${QUALITY[hqIndex]?.name||'白色'}`;
    const hpPercent = clamp(player.health/player.maxHealth,0,1);
    hud.healthFill.style.width = `${Math.round(hpPercent*100)}%`;
    if(hud.kills) hud.kills.textContent = `斩杀妖邪：${window.Game.totalKills||0}`;
    if(hud.treasureHeld){
      const tName = (window.Game.heldTreasureId && window.Game.heldTreasureId()) ? TREASURE_NAME(window.Game.heldTreasureId()) : '无';
      hud.treasureHeld.textContent = `所持法宝：${tName}`;
    }
  }

  function TREASURE_NAME(id){
    if(!id) return '';
    const TRE = window.Game?.treasureDefs || [];
    const obj = TRE.find(t=>t.id===id);
    return obj?obj.name:id;
  }

  // 移动与输入（转换为世界坐标）
  function handleMovement(dt){
    // 先更新摄像机，保证输入映射正确
    updateCamera();

    // 处理输入与移动
      let dirX=0, dirY=0;
      if(input.keys.has('w')||input.keys.has('arrowup')) dirY-=1;
      if(input.keys.has('s')||input.keys.has('arrowdown')) dirY+=1;
      if(input.keys.has('a')||input.keys.has('arrowleft')) dirX-=1;
      if(input.keys.has('d')||input.keys.has('arrowright')) dirX+=1;
      if (input.mouse.down || input.touchTarget) {
        const left = camera.cx - camera.viewW/2;
        const top  = camera.cy - camera.viewH/2;
        const sx = input.touchTarget?.x ?? input.mouse.x;
        const sy = input.touchTarget?.y ?? input.mouse.y;
        const tx = left + sx / camera.scale;
        const ty = top  + sy / camera.scale;
        const dx = tx - player.x;
        const dy = ty - player.y;
        const len = Math.hypot(dx,dy);
        if (len > 2) { dirX = dx/len; dirY = dy/len; }
      }
      const curSpeedBase = input.keys.has(' ')? player.speed*2.5 : player.speed;
      const curSpeed = curSpeedBase * (player.speedMultiplier||1);
  // weapon spin speed default fallback
  if(player.weaponSpinSpeed==null) player.weaponSpinSpeed = SPIN_SPEED_TIERS.mid;
      const targetVx=dirX*curSpeed; const targetVy=dirY*curSpeed;
      player.vx=lerp(player.vx,targetVx, clamp(player.accel*dt/1000,0,1));
      player.vy=lerp(player.vy,targetVy, clamp(player.accel*dt/1000,0,1));
      if(dirX===0&&dirY===0){ player.vx=lerp(player.vx,0, clamp(player.deccel*dt/1000,0,1)); player.vy=lerp(player.vy,0, clamp(player.deccel*dt/1000,0,1)); }
    // 位置更新与边界
    player.x+=player.vx*dt/1000; player.y+=player.vy*dt/1000;
    player.x=clamp(player.x, player.radius, world.width - player.radius);
    player.y=clamp(player.y, player.radius, world.height - player.radius);
  
    // 推进玩家武器旋转
    player.weaponSpin += player.weaponSpinSpeed * dt/1000;
    // 新增：拾取护shield计时器衰减
    if(player.pickupShieldTimer && player.pickupShieldTimer>0){ player.pickupShieldTimer = Math.max(0, player.pickupShieldTimer - dt); }
  }

  // 基础碰撞
  function circleOverlap(ax,ay,ar,bx,by,br){ const d2 = dist2(ax,ay,bx,by); const r=ar+br; return d2 <= r*r; }
  function countActiveWeapons(){ let c=0; for(const w of player.weapons){ if(w.alive!==false) c++; } return c; }
  function pruneDeadWeapons(){
    // 清理已摧毁的玩家武器（不做摧毁统计，统计仅在 markWeaponDestroyed 的来源判定中处理）
    const G = window.Game;
    // 保留 G.stats 初始化以避免空引用
    if(!G || !G.stats) G.stats = (G.stats||{picked:G.totalPickups||0, destroyed:0, kills:G.totalKills||0});
    // 仅移除已死亡武器
    player.weapons = player.weapons.filter(w=>w.alive!==false);
}
// 统一摧毁入口：设置 alive=false 并打点统计（去重，按来源区分）
function markWeaponDestroyed(w, opts={}){
    if(!w) return;
    // 战技武器的免疫：不可摧毁或 Boss 技能免疫时跳过
    const killer = opts.killer;            // 'playerWeapon' | 'npcWeapon' | 'npcSkill' | 'playerSkill' | undefined
    if(w && (w.indestructible === true || (w.bossImmune === true && killer === 'npcSkill'))){
      return; // 跳过摧毁
    }
    const G = window.Game;
    // 新增：战技进行中保护玩家普通武器（moonblade / magic_blade_thousand 激活期间）
    if(G && G.player){
      const isPlayerWeapon = Array.isArray(G.player.weapons) && G.player.weapons.includes(w);
      const skillWs = Array.isArray(G.player.skillWeapons) ? G.player.skillWeapons : [];
      const hasActiveSkill = skillWs.some(sw => sw && (sw._skillTag === 'moonblade' || sw._skillTag === 'magic_blade_thousand'));
      // 仅在摧毁对象为玩家“普通武器”且战技激活时阻止摧毁；
      // 保留对战技武器的摧毁（例如技能停止时 killer === 'playerSkill'）
      if(isPlayerWeapon && hasActiveSkill && killer !== 'playerSkill'){
        return; // 战技期间保护普通武器不被摧毁
      }
    }
    w.alive = false;
    if(G){
      G.stats = G.stats || { picked: G.totalPickups||0, destroyed: 0, kills: G.totalKills||0 };
      // 仅当由玩家武器摧毁他方武器时才统计“已摧毁武器”
      const victimOwner = opts.victimOwner;  // 'player' | 'npc' | undefined
      if(!w._countedDestroyed && killer === 'playerWeapon' && victimOwner !== 'player'){
        G.stats.destroyed = (G.stats.destroyed||0) + 1;
        w._countedDestroyed = true;
      } else {
        // 为避免重复二次处理，仍标记该武器已被处理
        if(!w._countedDestroyed) w._countedDestroyed = true;
      }
      // 仅当受害者是玩家武器时提示“武器破损”
      const now = performance.now();
      const isPlayerWeapon = Array.isArray(G.player?.weapons) && G.player.weapons.includes(w);
      if((victimOwner === 'player' || isPlayerWeapon) && G.player){
        if(!G.player._lastBrokenHintAt || now - G.player._lastBrokenHintAt > 800){
          G.spawnFloatText && G.spawnFloatText('武器破损', G.player.x, G.player.y-20, 'ft-purple');
          G.player._lastBrokenHintAt = now;
        }
      }
    }
}

  // 拾取逻辑
  // 轻量级音频管理器（WebAudio）：接近嗡鸣 + 拾取音效 + 金色史诗片段
  const AudioMan = {
    ctx: null, master: null, humOsc: null, humGain: null, humQuality: -1, _interval: null,
    init(){ if(this.ctx) return this.ctx; const AC = window.AudioContext||window.webkitAudioContext; if(!AC) return null; const ctx = new AC(); this.ctx = ctx; const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); this.master = master; const humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(master); this.humGain = humGain; this.startHumInterval(); return ctx; },
    startHumInterval(){ if(this._interval) return; this._interval = setInterval(()=>{ this.updateNearHum(); }, 200); },
    updateNearHum(){ const G = window.Game; if(!G || !G.player || !G.pickups) return; const px=G.player.x, py=G.player.y; let target=null; let bestQ=-1; for(const p of G.pickups){ const dx=px-p.x, dy=py-p.y; const d2 = dx*dx+dy*dy; const rr = (p.r||18) + 160; if(d2 <= rr*rr && p.q>=3){ if(p.q > bestQ){ bestQ = p.q; target = p; } } } if(target){ this.playHum(bestQ); if(bestQ===6) this.playEpicBgm(0.15); } else { this.stopHum(); } },
    playHum(q){ if(this.humQuality===q && this.humOsc) return; this.stopHum(); const ctx = this.init(); if(!ctx) return; const osc = ctx.createOscillator(); const freqMap = [0,0,0,150,95,180,80]; const typeMap = ['sine','sine','sine','triangle','sawtooth','square','triangle']; osc.type = typeMap[q]||'sine'; osc.frequency.value = freqMap[q]||110; osc.connect(this.humGain); osc.start(); this.humOsc = osc; this.humQuality = q; const g = this.humGain.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0, ctx.currentTime); g.linearRampToValueAtTime(0.06 + Math.max(0,q-3)*0.02, ctx.currentTime+0.25); },
    stopHum(){ const ctx=this.ctx; if(this.humOsc && ctx){ const g=this.humGain.gain; g.cancelScheduledValues(ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime+0.2); try{ this.humOsc.stop(ctx.currentTime+0.25); }catch(e){} this.humOsc=null; this.humQuality=-1; } },
    playPickupSfx(q){ const ctx=this.init(); if(!ctx) return; const t=ctx.currentTime; const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.type = (q>=5 ? 'square' : (q>=3 ? 'triangle' : 'sine')); const baseFreq=[900,880,1200,1000,540,720,1100][q]||900; osc.frequency.setValueAtTime(baseFreq, t); osc.frequency.linearRampToValueAtTime(baseFreq*1.25, t+0.12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t+0.02); g.gain.exponentialRampToValueAtTime(0.001, t+0.26); osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t+0.28);
      // 额外脉冲（橙、金）
      if(q===4) this.pulse(120,0.28);
      if(q===6) this.lightBeam();
    },
    pulse(freq=110, dur=0.35){ const ctx=this.ctx; if(!ctx) return; const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=freq; g.gain.value=0.0; o.connect(g); g.connect(this.master); const t=ctx.currentTime; o.start(t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.25,t+0.06); g.gain.exponentialRampToValueAtTime(0.001,t+dur); o.stop(t+dur+0.02); },
    lightBeam(){ this.playEpicBgm(0.35); },
    playEpicBgm(vol=0.25){ const ctx=this.ctx; if(!ctx) return; const g=ctx.createGain(); g.gain.value=vol; g.connect(this.master); const o1=ctx.createOscillator(), o2=ctx.createOscillator(), o3=ctx.createOscillator(); o1.type='sine'; o2.type='sine'; o3.type='sine'; const t=ctx.currentTime; o1.frequency.value=440; o2.frequency.value=554.37; o3.frequency.value=659.25; o1.connect(g); o2.connect(g); o3.connect(g); o1.start(t); o2.start(t+0.05); o3.start(t+0.10); const end=t+1.2; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,end); o1.stop(end); o2.stop(end); o3.stop(end); }
  };
  // window.Game.audioManager = AudioMan; // 延后到 window.Game 定义处
  document.addEventListener('pointerdown', ()=>{ try{ AudioMan.init(); }catch(e){} }, { once:true });
  // Duplicate blocks have been removed. Re-define necessary functions and expose Game API.

// 统计数据
let totalPickups = 0; // 拾取的武器数量
let totalKills = 0;    // 击杀敌人数量
let totalTreasures = 0; // 拾取的法宝数量

function tryPickup(){

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (circleOverlap(player.x, player.y, player.radius, p.x, p.y, p.r)) {
      const G = window.Game; const act = G?.player;
      const skillActive = !!(act && Array.isArray(act.skillWeapons) && act.skillWeapons.some(sw=> sw && (sw._skillTag==='moonblade' || sw._skillTag==='magic_blade_thousand')));
      if(skillActive){
        // 战技激活：不添加普通武器，直接移除拾取物并提示
        pickups.splice(i, 1);
        G?.spawnFloatText?.('战技期间摧毁普通武器', player.x, player.y - 20, 'ft-purple');
        player.pickupShieldTimer = Math.max(700, (player.pickupShieldTimer || 0));
        continue;
      }
      if (window.Game && window.Game.audioManager) window.Game.audioManager.playPickupSfx(p.q);
      if (window.Game && window.Game.onPickup) window.Game.onPickup(p.q, p.x, p.y);
      addWeapon(p.q, p.count);
      spawnFloatText(`+${p.count} ${QUALITY[p.q].name}武器`, p.x, p.y);
      // 在玩家附近显示提示
      spawnFloatText(`获得 ${QUALITY[p.q].name}`, player.x, player.y - 20);
      pickups.splice(i, 1);
      player.pickupShieldTimer = Math.max(700, (player.pickupShieldTimer || 0));
      // 玩家拾取（仅玩家）：累计拾取掉落物“个数”
      // 已拾取武器：统计拾取的武器数量（堆叠按 count 累加）
      // 修复：按 p.count || 1 累计武器数
      totalPickups += p.count || 1;
    }
  }
}

function recalcWeaponAngles(){
  pruneDeadWeapons();
  const n = player.weapons.length;
  for (let i = 0; i < n; i++) {
    const w = player.weapons[i];
    w.angle  = (i / n) * Math.PI * 2;
    w.radius = 8 + w.quality * 3;
    w.glow   = QUALITY[w.quality].glow;
  }
}

function mergeWeapons(){
  let changed = true;
  while (changed) {
    changed = false;
    const counts = new Array(QUALITY.length).fill(0);
    for (const w of player.weapons) counts[w.quality]++;

    for (let q = 0; q < QUALITY.length - 1; q++) {
      const need = MERGE_NEED[q] || 10;
      // 如果背包空间不足也允许合成，先合成减少占用
      while (counts[q] >= need) {
        // remove lowest quality weapons used for merge
        let removed = 0;
        for (let i = player.weapons.length - 1; i >= 0 && removed < need; i--) {
          if (player.weapons[i].quality === q) {
            player.weapons.splice(i, 1);
            removed++;
          }
        }
        const newQ = Math.min(q + 1, QUALITY.length - 1);
        player.weapons.push(createWeapon(newQ));
        spawnFloatText(`合成升级 -> ${QUALITY[newQ].name}`, player.x, player.y);
        counts[q] -= need;
        counts[newQ]++;
        changed = true;
      }
    }
  }
  recalcWeaponAngles();
}

// ------------------ 武器平衡与自动装备 ------------------
window.Game = window.Game || {};
let weaponBalanceTimer = 0;
function rebalanceWeapons(){
  // 收集所有品质列表
  const qualities = [];
  for(const w of player.weapons){ if(w.alive!==false) qualities.push(w.quality); }
  for(const q of player.storage){ qualities.push(q); }
  // 按品质高->低排序
  qualities.sort((a,b)=>b-a);
  const best = qualities.slice(0, player.weaponCapacity);
  const rest = qualities.slice(player.weaponCapacity);
  // 如果已经满20且品质列表一致则不重新分配
  const current = player.weapons.filter(w=>w.alive!==false).map(w=>w.quality).sort((a,b)=>b-a);
  const storedNow = player.storage.slice().sort((a,b)=>b-a);
  const needRebuild = !(player.weapons.length===player.weaponCapacity &&
                        arraysEqual(current,best) &&
                        arraysEqual(storedNow, rest));
  if(needRebuild){
    player.weapons = best.map(q=>createWeapon(q));
    player.storage = rest;
    recalcWeaponAngles();
  }
}
function arraysEqual(a,b){
  if(a.length!==b.length) return false;
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
  return true;
}

function updateWeaponBalance(dt){ /* 已弃用：改为拾取时即时平衡 */ }
// 暴露到全局
window.Game.updateWeaponBalance = updateWeaponBalance;
function addWeapon(q, count = 1){
  // 新增：战技期间阻止添加普通武器（只显示战技武器）
  const G = window.Game; const act = G?.player;
  const skillActive = !!(act && Array.isArray(act.skillWeapons) && act.skillWeapons.some(sw=> sw && (sw._skillTag==='moonblade' || sw._skillTag==='magic_blade_thousand')));
  if(skillActive){
    return; // 战技期间不添加普通武器
  }
  pruneDeadWeapons();
  let active = player.weapons.length;
  // 1. 先把拾取到的武器尽量直接装备，直到达到上限
  for (let k = 0; k < count; k++) {
    if (active < player.weaponCapacity) {
      player.weapons.push(createWeapon(q));
      active++;
    } else {
      // 已达上限，剩余放入存储
      player.storage.push(q);
    }
  }

  // 2. 若因为合成等原因导致装备数不足，再从存储补充到上限
  while (active < player.weaponCapacity && player.storage.length > 0) {
    const sq = player.storage.shift();
    player.weapons.push(createWeapon(sq));
    active++;
  }

  // 3. 仅当已满编（20把）时，才触发升级、替换与平衡逻辑
  if (active >= player.weaponCapacity) {
    // 先处理存储区的合成升级
    autoUpgradeStorage();
    // 再尝试用更高品质武器替换低品质装备
    autoReplaceFromStorage();
    // 对装备和存储进行重新排序和最佳化
    rebalanceWeapons();
    // 装备内部可能因合成减少了数量，再补齐
    while (player.weapons.length < player.weaponCapacity && player.storage.length > 0) {
      const sq = player.storage.shift();
      player.weapons.push(createWeapon(sq));
    }
    // 保持满编，不在此处合成已装备武器，避免数量下降导致旋转武器不足20把
    // 合成仅针对存储区在 autoUpgradeStorage 中进行；此处不再触发 mergeWeapons。
    // 若装备数量不足，仅从存储补充至上限（已在前面处理）。
  }

  // 4. 重新计算角度
  recalcWeaponAngles();
}

function autoUpgradeStorage(){
  const counts = new Array(QUALITY.length).fill(0);
  for (const q of player.storage) counts[q]++;
  for (let q = 0; q < QUALITY.length - 1; q++) {
    const need = MERGE_NEED[q] || 10;
    while (counts[q] >= need) {
      counts[q] -= need;
      counts[q + 1] += 1;
    }
  }
  const rebuilt = [];
  for (let q = 0; q < QUALITY.length; q++) {
    for (let i = 0; i < counts[q]; i++) rebuilt.push(q);
  }
  player.storage = rebuilt;
}

function autoReplaceFromStorage(){
  pruneDeadWeapons();
  const counts = new Map();
  for (const q of player.storage) counts.set(q, (counts.get(q) || 0) + 1);

  const tryUse = (q) => {
    const c = counts.get(q) || 0;
    if (c <= 0) return false;
    let minQ = Infinity, minIdx = -1;
    for (let i = 0; i < player.weapons.length; i++) {
      const wq = player.weapons[i].quality;
      if (wq < minQ) { minQ = wq; minIdx = i; }
    }
    if (minIdx !== -1 && minQ < q) {
      player.weapons.splice(minIdx, 1, createWeapon(q));
      counts.set(q, c - 1);
      // remove one from storage
      const idx = player.storage.indexOf(q);
      if (idx !== -1) player.storage.splice(idx, 1);
      return true;
    }
    return false;
  };

  let changed = false;
  // 尝试从高到低依次替换
  for(let q=QUALITY.length-1; q>=0; q--){
    changed = tryUse(q) || changed;
  }
  if (changed) recalcWeaponAngles();
}

// 暴露到全局
window.Game = Object.assign(window.Game || {}, {
  canvas, ctx, hud, Assets,
  input,
  clamp, lerp, dist2,
  QUALITY, SPIN_SPEED_TIERS, MERGE_NEED,
  MINION_SKINS, ELITE_SKINS, BUILDING_SKINS,
  BOSS_SKINS,
  world,
  camera,
  updateCamera,
  player,
  pickups,
  spawnPickup,
  updatePickups,
  updateHUD,
  handleMovement,
  circleOverlap,
  tryPickup,
  recalcWeaponAngles,
  mergeWeapons,
  addWeapon,
  createWeapon,
  autoUpgradeStorage,
  autoReplaceFromStorage,
  spawnFloatText,
  placePickupNonOverlap,
  dropWeapons,
  pruneDeadWeapons,
  markWeaponDestroyed,
  audioManager: AudioMan,
  totalPickups,
  totalKills,
  totalTreasures,
  dt: 16 // 每帧间隔（将在主循环中更新）
});

// 为 Game.totalPickups 提供访问器，确保面板读取到实时值
try{
  Object.defineProperty(window.Game, 'totalPickups', {
    configurable: true,
    enumerable: true,
    get(){ return totalPickups; },
    set(v){ totalPickups = (v|0); }
  });
}catch(e){}
})();

// 修仙体系类型映射（可扩展）
const CULTIVATION_TYPE_MAP = {
// 佛系
'boss_fotuo': '佛',
'elite_monk': '佛',
// 道系
'boss_nvXian': '道',
'elite_taoshi': '道',
// 魔系
'boss_niumo': '魔',
'elite_monu': '魔',
// 妖系
'boss_longwang': '妖',
// 人系
'elite_nvdizi': '人',
// 神系
'boss_tiandi': '神',
'elite_tudi': '神',
'elite_xianbing': '神'
};

function getCultivationTypeBySkin(skin){
return CULTIVATION_TYPE_MAP[skin] || '凡'; // 默认“凡”
}
function registerCultivationMapping(skin, type){
CULTIVATION_TYPE_MAP[skin] = type;
}

window.Game.getCultivationTypeBySkin = getCultivationTypeBySkin;
window.Game.registerCultivationMapping = registerCultivationMapping;
window.Game.CULTIVATION_TYPE_MAP = CULTIVATION_TYPE_MAP;