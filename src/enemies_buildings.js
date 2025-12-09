// 敌人与建筑模块
(function(){
  const { world, player, clamp, QUALITY, MINION_SKINS, ELITE_SKINS, BUILDING_SKINS, SPIN_SPEED_TIERS, BOSS_SKINS } = window.Game;

  // 敌人集合
  const enemies=[];

  // 角色武器环绕
  function recalcEnemyWeaponAngles(e){
    if(!e || !Array.isArray(e.weapons)) return;
    const n = e.weapons.length;
    for(let i=0;i<n;i++){
      const w = e.weapons[i];
      if(!w) continue;
      w.angle = (i / n) * Math.PI * 2;
      // Boss 的武器旋转半径更大
      w.radius = (e.role==='boss' ? 22 : 8) + (w.quality||0) * (e.role==='boss' ? 6 : 3);
    }
  }
  // 计算敌人最大武器半径与安全触及距离（角色半径 + 最大武器半径 + 缓冲）
  function getMaxWeaponRadius(e){
  let m = 0;
  if(!e || !Array.isArray(e.weapons)) return 10;
  for(const w of e.weapons){
  if(!w) continue;          // 跳过空位
  if(w.alive === false) continue; // 已被销毁
  const r = (w.radius || 10);
  if(r > m) m = r;
  }
  return m || 10;
  }
  function enemyReach(e){ return (e.radius||16) + getMaxWeaponRadius(e) + 6; }

  // 敌人武器生成，指定品质
  function createWeapon(q){ const WEAPON_SKINS=['weapon_sword','weapon_staff']; const skin=WEAPON_SKINS[Math.floor(Math.random()*WEAPON_SKINS.length)]; return { id:Math.random().toString(36).slice(2), quality:q, angle:0, radius:10, damage:8+q*5, knockback: q>=2?70:35, alive:true, skin }; }
  // 导出：敌人武器生成到 Game 对象
  window.Game.createEnemyWeapon = createWeapon;

  // 根据角色类型生成其默认武器（数量与品质范围）
  function fillWeaponsForRole(e){
    // 保护：女仙 Boss 在自然共鸣结束后锁定武器阵列与品质，不再被重置
    if(e && e.skin==='boss_nvXian' && e._lockWeapons){ return; }
     let minCount=10, maxCount=20; let qualChoices=[0,1];
     e.maxWeapons = 20; // 默认上限
    if(e.role==='boss'){ minCount=18; maxCount=20; qualChoices=[4,5]; e.maxWeapons = (e.skin==='boss_nvXian' ? 100 : 50); }
     else if(e.role==='elite'||e.ai==='guard'){ minCount=12; maxCount=16; qualChoices=[2,3]; e.maxWeapons = 20; }
     else if(e.role==='minion'){ minCount=11; maxCount=14; qualChoices=[0,1]; e.maxWeapons = 20; }
     let count = minCount + Math.floor(Math.random()*(maxCount-minCount+1));
     count = Math.min(count, e.maxWeapons);
     e.weapons.length = 0;
     for(let i=0;i<count;i++){ const q = qualChoices[Math.floor(Math.random()*qualChoices.length)]; e.weapons.push(createWeapon(q)); }
     recalcEnemyWeaponAngles(e);
  }

  // 敌人为自身添加武器（受上限限制）
  function enemyAddWeapon(e, q, count=1){
    const addOne = ()=>{ if(e.weapons.length < (e.maxWeapons||20)){ e.weapons.push(createWeapon(q)); } };
    for(let k=0;k<count;k++) addOne();
    recalcEnemyWeaponAngles(e);
  }
  // 敌人尝试拾取地图上的武器掉落（全局导出）
  function enemiesTryPickup(){
    const pickups = window.Game.pickups;
    const circleOverlap = window.Game.circleOverlap;
    for(const e of enemies){
      for(let i=pickups.length-1;i>=0;i--){ const p=pickups[i];
        if(circleOverlap(e.x,e.y,e.radius, p.x,p.y,p.r)){
          enemyAddWeapon(e, p.q, p.count);
          pickups.splice(i,1);
        }
      }
    }
  }

  // 生成普通野怪（不绑定建筑区域）
  function spawnEnemies(n=35){
    for(let i=0;i<n;i++){
      const x = Math.random()*world.width;
      const y = Math.random()*world.height;
      const skin = MINION_SKINS[Math.floor(Math.random()*MINION_SKINS.length)] || MINION_SKINS[0];
      const e={ x,y, vx:0, vy:0, speed:90+Math.random()*70, radius:16, health:40, maxHealth:40, weapons:[], role:'minion', ai:'wander', skin, weaponSpin:0, weaponSpinSpeed: SPIN_SPEED_TIERS.low + Math.random()*0.2 };
      e.cultivation = window.Game.getCultivationTypeBySkin(skin);
      // 随机游走目标
      e.wanderTimer = 0; e.wanderTarget = { x: x + (Math.random()*2-1)*180, y: y + (Math.random()*2-1)*180 };
      fillWeaponsForRole(e);
      enemies.push(e);
    }
  }

  // 生成建筑对应区域：中心Boss、周边精英、小怪随机游走
  const BUILDING_NAMES_PREFIX = ['太乙','昆仑','紫霄','玄都','青云','无量','凌霄','玉虚','天枢','北斗'];
  const BUILDING_NAMES_SUFFIX = ['宫','观','殿','堂','泉','塔','台','峰','门','楼'];
  function randomBuildingName(){ return BUILDING_NAMES_PREFIX[Math.floor(Math.random()*BUILDING_NAMES_PREFIX.length)] + BUILDING_NAMES_SUFFIX[Math.floor(Math.random()*BUILDING_NAMES_SUFFIX.length)]; }

  const buildings = [];
// 势力掉落区：整齐排列的高/低品质混合，数量为 99
function randomZoneQuality(){
  const hiProb = 0.2; // 少部分高品质
  const hi = [2,3];
  const lo = [0,1];
  return (Math.random() < hiProb)
    ? hi[Math.floor(Math.random()*hi.length)]
    : lo[Math.floor(Math.random()*lo.length)];
}
function createFactionDropZone(b){
  const { world } = window.Game;
  const cols = 5, rows = 3;
  const cell = 44; const pad = 10;
  const zoneW = cols * cell, zoneH = rows * cell;
  // 选择建筑左右一侧作为掉落区
  let zx = b.x + b.radius + 140;
  if (zx + zoneW/2 > world.width) zx = b.x - b.radius - 140;
  let zy = b.y;
  zx = window.Game.clamp(zx, zoneW/2 + pad, world.width - zoneW/2 - pad);
  zy = window.Game.clamp(zy, zoneH/2 + pad, world.height - zoneH/2 - pad);
  const id = 'zone_' + Math.random().toString(36).slice(2);
  const cells = [];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const px = zx - zoneW/2 + cell/2 + c*cell;
      const py = zy - zoneH/2 + cell/2 + r*cell;
      cells.push({x:px,y:py});
      const q = randomZoneQuality();
      window.Game.pickups.push({ x:px, y:py, r:18, q, count:99, skin:null, zoneId:id });
    }
  }
  b.dropZone = { id, x:zx, y:zy, w:zoneW, h:zoneH, cols, rows, cell, cells, restockTimer: 0 };
}
function spawnRegionForBuilding(b){
  // 三角站队参数
  const gap = 130; // 行间距（增大以避免武器相互触碰）
  const col = 92; // 列间距（增大以避免武器相互触碰）
  const cx = b.x, cy = b.y;
  // Boss（顶点，稍微靠上）
  const bossSkin = BOSS_SKINS[Math.floor(Math.random()*BOSS_SKINS.length)] || 'boss_niumo';
  const bossY = cy - gap*2;
  const boss = { x:cx, y:bossY, vx:0, vy:0, speed:40, radius:24, health:500, maxHealth:500, weapons:[], role:'boss', ai:'boss', skin: bossSkin, weaponSpin:0, weaponSpinSpeed: SPIN_SPEED_TIERS.mid, territory:{ cx:cx, cy:cy, r:b.radius+260 }, formationSlot:{ x:cx, y:bossY } };
  boss.cultivation = window.Game.getCultivationTypeBySkin(bossSkin);
  boss.wanderTimer = 0; boss.wanderTarget = { x:boss.x, y:boss.y };
  fillWeaponsForRole(boss);
  enemies.push(boss);
  // 精英（中间行，水平居中展开）
  const eliteCount = 4 + Math.floor(Math.random()*3); // 4-6
  const elitesY = cy - gap;
  for(let i=0;i<eliteCount;i++){
    const offset = i - (eliteCount-1)/2; // 居中分布
    const ex = clamp(cx + offset*col, b.radius, world.width - b.radius);
    const ey = clamp(elitesY, b.radius, world.height - b.radius);
    const skin = ELITE_SKINS[Math.floor(Math.random()*ELITE_SKINS.length)] || ELITE_SKINS[0];
    const e = { x:ex, y:ey, vx:0, vy:0, speed:85+Math.random()*50, radius:16, health:80, maxHealth:80, weapons:[], role:'elite', ai:'formation', skin, weaponSpin:0, weaponSpinSpeed: SPIN_SPEED_TIERS.low, territory:{ cx:cx, cy:cy, r:b.radius+260 }, formationSlot:{ x:ex, y:ey } };
    e.cultivation = window.Game.getCultivationTypeBySkin(skin);
    fillWeaponsForRole(e);
    enemies.push(e);
  }
  // 小怪（底部行，更宽展开）
  const minionCount = 10 + Math.floor(Math.random()*6); // 10-15
  const minionsY = cy;
  for(let i=0;i<minionCount;i++){
    const offset = i - (minionCount-1)/2;
    const mx = clamp(cx + offset*col*0.9, b.radius, world.width - b.radius);
    const my = clamp(minionsY, b.radius, world.height - b.radius);
    const skin = MINION_SKINS[Math.floor(Math.random()*MINION_SKINS.length)] || MINION_SKINS[0];
    const e = { x:mx, y:my, vx:0, vy:0, speed:90+Math.random()*60, radius:15, health:50, maxHealth:50, weapons:[], role:'minion', ai:'formation', skin, weaponSpin:0, weaponSpinSpeed: SPIN_SPEED_TIERS.low, territory:{ cx:cx, cy:cy, r:b.radius+260 }, formationSlot:{ x:mx, y:my } };
    fillWeaponsForRole(e);
    enemies.push(e);
  }
  // 预备“冠军”单位：进入势力范围时派出（初始在Boss后侧待命）
  const champX = clamp(cx + col*2, b.radius, world.width - b.radius);
  const champY = clamp(bossY - 12, b.radius, world.height - b.radius);
  const champSkin = ELITE_SKINS[Math.floor(Math.random()*ELITE_SKINS.length)] || ELITE_SKINS[0];
  const champion = { x:champX, y:champY, vx:0, vy:0, speed:105, radius:16, health:120, maxHealth:120, weapons:[], role:'elite', ai:'reserve', skin: champSkin, weaponSpin:0, weaponSpinSpeed: SPIN_SPEED_TIERS.mid, territory:{ cx:cx, cy:cy, r:b.radius+260 }, formationSlot:{ x:champX, y:champY }, dispatched:false };
  champion.cultivation = window.Game.getCultivationTypeBySkin(champSkin);
  fillWeaponsForRole(champion);
  enemies.push(champion);
  b.champion = champion;
  // 创建势力掉落区
  createFactionDropZone(b);
}

  function spawnBuildings(count=8){
    buildings.length = 0;
    for(let i=0;i<count;i++){
      const skin = BUILDING_SKINS[Math.floor(Math.random()*BUILDING_SKINS.length)] || BUILDING_SKINS[0];
      const name = randomBuildingName();
      const bx = Math.random()*world.width;
      const by = Math.random()*world.height;
      const b = { x:bx, y:by, radius:42, skin, name, alive:true };
      buildings.push(b);
      spawnRegionForBuilding(b);
    }
  }

  // 敌人更新：Boss/精英追击与规避，小怪领地游走；无武器回领地恢复
  function updateEnemies(dt){
    // 计算玩家武器危险半径（敌人不可靠近该半径内）
    let playerDangerRadius = player.radius;
    for(const w of player.weapons){ if(w.alive!==false){ const o = Math.max(0, w.orbitOffset||0); const r = player.radius + (w.radius||10) + o + 12; if(r > playerDangerRadius) playerDangerRadius = r; } }
    playerDangerRadius += 18; // 增加更大的缓冲
    // 玩家最高品质（用于冠军单位匹配）
    let playerMaxQ = -1; for(const w of player.weapons){ if(w.alive!==false){ if((w.quality||0) > playerMaxQ) playerMaxQ = (w.quality||0); } }
    // 触发派遣冠军：玩家踏入任一势力范围
    for(const b of buildings){ const dx=player.x-b.x, dy=player.y-b.y; const d=Math.hypot(dx,dy)||1; const territoryR=(b.radius+220);
      if(d < territoryR && b.champion && !b.champion.dispatched){ const matchQ = Math.max(0, playerMaxQ);
        window.Game.setEnemyWeaponsQuality(b.champion, matchQ);
        b.champion.ai='assault'; b.champion.dispatched=true; b.champion.speed = Math.max(b.champion.speed, 120);
      }
    } //xiaodu removed stray token
    // 拥挤统计
    const crowdZoneExtend = 80; const crowdLimit = 4; let nearCount = 0;
    for(const e of enemies){ const d = Math.hypot(player.x - e.x, player.y - e.y) || 0; if(d < playerDangerRadius + crowdZoneExtend) nearCount++; }
    for(const e of enemies){
      // 武器状态
      let enemyMaxQ = -1; let aliveCount = 0; for(const w of e.weapons){
        if(!w) continue;
        if(w.alive!==false){
          aliveCount++;
          if((w.quality||0) > enemyMaxQ) enemyMaxQ = (w.quality||0);
        }
      }
      let playerMinQ = Infinity; for(const w of player.weapons){ if(w.alive!==false){ if(w.quality<playerMinQ) playerMinQ = w.quality; } } if(playerMinQ===Infinity) playerMinQ=0;
      const weakerThanPlayer = enemyMaxQ < playerMinQ;
      // 新增：闭关状态（在领地内且几乎不移动）
      const inTerritory = !!(e.territory && Math.hypot(e.x - e.territory.cx, e.y - e.territory.cy) <= e.territory.r);
      const stationary = (Math.hypot(e.vx||0, e.vy||0) < 6);
      e.seclusion = inTerritory && stationary;
      // 无武器：回领地
      if(aliveCount < 1 && e.territory){
        const dxc = e.territory.cx - e.x; const dyc = e.territory.cy - e.y; const ll = Math.hypot(dxc,dyc)||1;
        e.vx = (dxc/ll) * e.speed; e.vy = (dyc/ll) * e.speed;
        const pdx0 = player.x - e.x; const pdy0 = player.y - e.y; const pdl0 = Math.hypot(pdx0,pdy0)||1; if(pdl0 < playerDangerRadius){ e.vx = (e.x - player.x)/pdl0 * e.speed; e.vy = (e.y - player.y)/pdl0 * e.speed; }
        e.x += e.vx * dt/1000; e.y += e.vy * dt/1000; if(Math.hypot(e.x - e.territory.cx, e.y - e.territory.cy) < 12){ fillWeaponsForRole(e); }
        e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius);
        if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; } continue;
      }
      // Boss：在其编队顶点附近缓慢游走并避让玩家武器
      if(e.ai==='boss' && e.territory && e.formationSlot){
        e.wanderTimer -= dt; if(e.wanderTimer<=0){ e.wanderTimer = 1600 + Math.random()*2200; const ang = Math.random()*Math.PI*2; const r = 30; e.wanderTarget = { x: e.formationSlot.x + Math.cos(ang)*r, y: e.formationSlot.y + Math.sin(ang)*r }; }
        const dx = e.wanderTarget.x - e.x; const dy = e.wanderTarget.y - e.y; const len=Math.hypot(dx,dy)||1; let dirX = dx/len, dirY = dy/len;
        const pdx = player.x - e.x; const pdy = player.y - e.y; const pdl = Math.hypot(pdx,pdy)||1; if(pdl < playerDangerRadius){ const avoidStrength = Math.min(1, Math.max(0, (playerDangerRadius - pdl)/playerDangerRadius)); const ax = -pdx/pdl, ay = -pdy/pdl; dirX = dirX*(1-avoidStrength) + ax*avoidStrength; dirY = dirY*(1-avoidStrength) + ay*avoidStrength; const nl0=Math.hypot(dirX,dirY)||1; dirX/=nl0; dirY/=nl0; }
        const lppBoss = Math.hypot(player.x - e.x, player.y - e.y)||1; if(lppBoss < playerDangerRadius + crowdZoneExtend && nearCount > crowdLimit){ const outX = (e.x - player.x)/lppBoss, outY = (e.y - player.y)/lppBoss; const alpha = Math.min(0.35, 0.10 + 0.05*(nearCount - crowdLimit)); dirX = dirX*(1-alpha) + outX*alpha; dirY = dirY*(1-alpha) + outY*alpha; const nl = Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl; }
        const extraSepBoss = lppBoss < (playerDangerRadius + crowdZoneExtend) ? 8 : 0; let sepX=0, sepY=0; for(const o of enemies){ if(o===e) continue; const ddx=e.x-o.x, ddy=e.y-o.y; const d=Math.hypot(ddx,ddy)||1; const minD = enemyReach(e)+enemyReach(o) + 4; if(d < minD){ const push=(minD-d)/minD; sepX += (ddx/d)*push; sepY += (ddy/d)*push; } } if(sepX||sepY){ const sl=Math.hypot(sepX,sepY)||1; sepX/=sl; sepY/=sl; dirX = (dirX*0.85 + sepX*0.5); dirY = (dirY*0.85 + sepY*0.5); const nl=Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl; }
        e.vx = (e.vx||0)*0.82 + dirX*e.speed*0.18; e.vy = (e.vy||0)*0.82 + dirY*e.speed*0.18; e.x += e.vx * dt/1000; e.y += e.vy * dt/1000; e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius); if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; } continue;
      }
      // 编队单位：向各自编队位置靠拢并保持队形
      if(e.ai==='formation' && e.formationSlot){
        const dxs = e.formationSlot.x - e.x; const dys = e.formationSlot.y - e.y; const ls=Math.hypot(dxs,dys)||1; let dirX = dxs/ls, dirY = dys/ls;
        const lpp = Math.hypot(player.x - e.x, player.y - e.y)||1; const extraSep = lpp < (playerDangerRadius + crowdZoneExtend) ? 8 : 0; let sepX=0, sepY=0; for(const o of enemies){ if(o===e) continue; const ddx=e.x-o.x, ddy=e.y-o.y; const d=Math.hypot(ddx,ddy)||1; const minD = enemyReach(e)+enemyReach(o) + 4; if(d < minD){ const push=(minD-d)/minD; sepX += (ddx/d)*push; sepY += (ddy/d)*push; } } if(sepX||sepY){ const sl=Math.hypot(sepX,sepY)||1; sepX/=sl; sepY/=sl; dirX = (dirX*0.85 + sepX*0.5); dirY = (dirY*0.85 + sepY*0.5); const nl=Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl; }
        e.vx = (e.vx||0)*0.82 + dirX*e.speed*0.18; e.vy = (e.vy||0)*0.82 + dirY*e.speed*0.18; e.x += e.vx * dt/1000; e.y += e.vy * dt/1000; e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius); if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; } continue;
      }
      // 预备单位：未派出前保持编队位置；派出后走突击逻辑
      if(e.ai==='reserve' && e.formationSlot){
        const dxs = e.formationSlot.x - e.x; const dys = e.formationSlot.y - e.y; const ls=Math.hypot(dxs,dys)||1; let dirX = dxs/ls, dirY = dys/ls;
        e.vx = (e.vx||0)*0.82 + dirX*e.speed*0.18; e.vy = (e.vy||0)*0.82 + dirY*e.speed*0.18; e.x += e.vx * dt/1000; e.y += e.vy * dt/1000; e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius); if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; } continue;
      }
      if(e.ai==='assault'){
        const dx = player.x - e.x; const dy = player.y - e.y; const len = Math.hypot(dx,dy)||1; let dirX = dx/len, dirY = dy/len; // 突击不主动避让玩家武器
        const lpp = Math.hypot(player.x - e.x, player.y - e.y)||1; if(lpp < playerDangerRadius*0.6){ dirX = dx/len; dirY = dy/len; }
        const extraSep = lpp < (playerDangerRadius + crowdZoneExtend) ? 8 : 0; let sepX=0, sepY=0; for(const o of enemies){ if(o===e) continue; const ddx=e.x-o.x, ddy=e.y-o.y; const d=Math.hypot(ddx,ddy)||1; const minD = enemyReach(e)+enemyReach(o) + 4; if(d < minD){ const push=(minD-d)/minD; sepX += (ddx/d)*push; sepY += (ddy/d)*push; } } if(sepX||sepY){ const sl=Math.hypot(sepX,sepY)||1; sepX/=sl; sepY/=sl; dirX = (dirX*0.85 + sepX*0.5); dirY = (dirY*0.85 + sepY*0.5); const nl=Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl; }
        e.vx = (e.vx||0)*0.82 + dirX*e.speed*0.18; e.vy = (e.vy||0)*0.82 + dirY*e.speed*0.18; e.x += e.vx * dt/1000; e.y += e.vy * dt/1000; e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius); if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; } continue;
      }
      // 其它原逻辑（wander/elite 等）保持
      if(e.ai==='wander' && e.territory){
        e.wanderTimer -= dt; if(e.wanderTimer<=0){ e.wanderTimer = 1200 + Math.random()*2000; const r = e.territory.r - 24; const ang = Math.random()*Math.PI*2; e.wanderTarget = { x: e.territory.cx + Math.cos(ang)*r*0.7, y: e.territory.cy + Math.sin(ang)*r*0.7 }; }
        const dx = e.wanderTarget.x - e.x; const dy = e.wanderTarget.y - e.y; const len=Math.hypot(dx,dy)||1;
        dirX = dx/len; dirY = dy/len;
        if(!weakerThanPlayer){ const dpx = player.x - e.x; const dpy = player.y - e.y; const lp=Math.hypot(dpx,dpy)||1; if(lp < (e.territory?.r||240)){ dirX = dpx/lp; dirY = dpy/lp; } }
      } else {
        const dx = player.x - e.x; const dy = player.y - e.y; const len = Math.hypot(dx,dy)||1;
        dirX = weakerThanPlayer ? -dx/len : dx/len;
        dirY = weakerThanPlayer ? -dy/len : dy/len;
      }
      const lpp = Math.hypot(player.x - e.x, player.y - e.y)||1;
      const localAggro = e.territory ? Math.max(140, Math.min(e.territory.r*0.55, 260)) : 200; // 缩小仇恨范围
      if(lpp > localAggro){
        // 仇恨范围外：重置为随机游走方向
        e.wanderTimer = (e.wanderTimer||0) - dt; if(e.wanderTimer<=0){ e.wanderTimer = 900 + Math.random()*1500; }
        const ang = Math.random()*Math.PI*2;
        const baseR = e.territory ? Math.max(24, e.territory.r-36) : 220;
        const tx = e.territory ? (e.territory.cx + Math.cos(ang)*baseR*0.5) : clamp(e.x + Math.cos(ang)*baseR, e.radius, world.width - e.radius);
        const ty = e.territory ? (e.territory.cy + Math.sin(ang)*baseR*0.5) : clamp(e.y + Math.sin(ang)*baseR, e.radius, world.height - e.radius);
        e.wanderTarget = { x: tx, y: ty };
        const dxw = e.wanderTarget.x - e.x; const dyw = e.wanderTarget.y - e.y; const llw = Math.hypot(dxw,dyw)||1;
        dirX = dxw/llw; dirY = dyw/llw;
      }
      // 避让玩家武器危险半径（所有非Boss分支均遵守）
      if(lpp < playerDangerRadius){ const avoidStrength = Math.min(1, Math.max(0, (playerDangerRadius - lpp)/playerDangerRadius)); const ax = (e.x - player.x)/lpp, ay = (e.y - player.y)/lpp; dirX = dirX*(1-avoidStrength) + ax*avoidStrength; dirY = dirY*(1-avoidStrength) + ay*avoidStrength; const nlA=Math.hypot(dirX,dirY)||1; dirX/=nlA; dirY/=nlA; }
      // 拥挤外推与分离（已在原逻辑中保留并增强）
      if(lpp < playerDangerRadius + crowdZoneExtend && nearCount > crowdLimit){
        const outX = (e.x - player.x)/lpp, outY = (e.y - player.y)/lpp;
        const alpha = Math.min(0.35, 0.10 + 0.05*(nearCount - crowdLimit));
        dirX = dirX*(1-alpha) + outX*alpha; dirY = dirY*(1-alpha) + outY*alpha;
        const nl = Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl;
      }
      // 敌人之间避让（防止NPC相互重叠），靠近玩家时加大分离半径
      const extraSep = lpp < (playerDangerRadius + crowdZoneExtend) ? 8 : 0;
      let sepX=0, sepY=0; for(const o of enemies){ if(o===e) continue; const ddx=e.x-o.x, ddy=e.y-o.y; const d=Math.hypot(ddx,ddy)||1; const minD = enemyReach(e)+enemyReach(o) + 4; if(d < minD){ const push=(minD-d)/minD; sepX += (ddx/d)*push; sepY += (ddy/d)*push; } }
      if(sepX||sepY){ const sl=Math.hypot(sepX,sepY)||1; sepX/=sl; sepY/=sl; dirX = (dirX*0.85 + sepX*0.5); dirY = (dirY*0.85 + sepY*0.5); const nl=Math.hypot(dirX,dirY)||1; dirX/=nl; dirY/=nl; }
  
      e.vx = (e.vx||0)*0.82 + dirX*e.speed*0.18; e.vy = (e.vy||0)*0.82 + dirY*e.speed*0.18;
      e.x += e.vx * dt/1000; e.y += e.vy * dt/1000;
      e.x = clamp(e.x, e.radius, world.width - e.radius);
      e.y = clamp(e.y, e.radius, world.height - e.radius);
      if(e.territory){ const dcx = e.x - e.territory.cx; const dcy = e.y - e.territory.cy; const dl = Math.hypot(dcx,dcy); if(dl > e.territory.r){ const k = e.territory.r/(dl||1); e.x = e.territory.cx + dcx*k; e.y = e.territory.cy + dcy*k; } }
      if(e.skin==='boss_nvXian' && window.FairyNS){ window.FairyNS.accumulateSpin(e, dt); } else if(!(e.skin==='boss_fotuo')){ e.weaponSpin += (e.weaponSpinSpeed||SPIN_SPEED_TIERS.low) * (e.seclusion?10:1) * dt/1000; }
    }
  }

  // 暴露
  window.Game.enemies = enemies;
  window.Game.spawnEnemies = spawnEnemies;
  window.Game.updateEnemies = updateEnemies;
  window.Game.buildings = buildings;
  window.Game.spawnBuildings = spawnBuildings;
  window.Game.setEnemyWeaponsQuality = setEnemyWeaponsQuality;
  function setEnemyWeaponsQuality(e, qTarget){
    const maxQ = (QUALITY && QUALITY.length) ? (QUALITY.length - 1) : 5;
    const tq = clamp(Math.floor(qTarget||0), 0, maxQ);
    // 提升敌人武器的品质到目标值（不降低，只升级）
    for(const w of e.weapons){
      if(!w || w.alive === false) continue;
      if((w.quality||0) < tq){
        w.quality = tq;
        w.damage = 8 + tq*5;
        w.knockback = tq >= 2 ? 70 : 35;
      }
    }
    // 重新计算环绕角度与半径（半径随品质略增）
    recalcEnemyWeaponAngles(e);
  }
  window.Game.updateBuildingsCombat = function(dt){
    const G = window.Game;
    const allPickups = G.pickups;
    for(const b of buildings){
      if(!b.dropZone) continue;
      const dz = b.dropZone;
      dz.restockTimer += (dt || G.dt || 16);
      // 统计每个格子的现有掉落
      const has = new Array(dz.cells.length).fill(false);
      const byCell = new Map();
      for(let i=0;i<dz.cells.length;i++) byCell.set(i,null);
      for(const p of allPickups){
        if(p.zoneId !== dz.id) continue;
        let idx=-1, best=Infinity;
        for(let i=0;i<dz.cells.length;i++){
          const cc = dz.cells[i];
          const d2 = (p.x-cc.x)*(p.x-cc.x) + (p.y-cc.y)*(p.y-cc.y);
          if(d2 < best){ best=d2; idx=i; }
        }
        if(idx>=0){ has[idx]=true; byCell.set(idx,p); }
      }
      if(dz.restockTimer >= 30000){
        dz.restockTimer = 0;
        for(let i=0;i<dz.cells.length;i++){
          const cc = dz.cells[i];
          if(!has[i]){
            const q = randomZoneQuality();
            allPickups.push({ x:cc.x, y:cc.y, r:18, q, count:99, skin:null, zoneId:dz.id });
          } else {
            const p = byCell.get(i);
            if(p && p.count < 99){ p.count = 99; }
          }
        }
      }
    }
  };
})();

// 删除 IIFE 外部的重复定义，避免作用域错误
// (setEnemyWeaponsQuality 已在 IIFE 内定义并导出)