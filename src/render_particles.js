// 深林色背景，更显浮动文字
const BG_COLOR = '#243820';

// 渲染与粒子模块
(function(){
  const { canvas, ctx, player, world, camera, updateCamera, enemies, buildings, pickups, QUALITY } = window.Game;

  // 粒子系统
  const particles = [];
  function spawnSparks(x,y,color='rgba(255,255,255,0.8)',count=8){ for(let i=0;i<count;i++){ const ang=Math.random()*Math.PI*2; const sp=60+Math.random()*180; particles.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:400,size:2,color}); } }
  function updateParticles(dt){ for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; if(p.life<=0){ particles.splice(i,1); continue; } p.x+=p.vx*dt/1000; p.y+=p.vy*dt/1000; p.vx*=0.98; p.vy*=0.98; } }
  function drawParticles(){ ctx.save(); applyCamera(); for(const p of particles){ if(!isOnScreen(p.x,p.y,p.size+2)) continue; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); } ctx.restore(); }

  // 摄像机：应用缩放与平移，使角色居中
  function applyCamera(){
    updateCamera();
    const left = camera.cx - camera.viewW/2;
    const top  = camera.cy - camera.viewH/2;
    ctx.setTransform(camera.scale,0,0,camera.scale, -left*camera.scale, -top*camera.scale);
  }
  // 视口工具
  function getViewRect(){ const left = camera.cx - camera.viewW/2; const top = camera.cy - camera.viewH/2; return { left, top, right: left+camera.viewW, bottom: top+camera.viewH }; }
  function isOnScreen(x,y,r=0){ const v=getViewRect(); return x+r>v.left && x-r<v.right && y+r>v.top && y-r<v.bottom; }
  function isRectOnScreen(x,y,w,h){ const v=getViewRect(); return !(x+w < v.left || x > v.right || y+h < v.top || y > v.bottom); }

  // 绘制地图边界（灰色线）
  function drawMapBounds(){ ctx.save(); applyCamera(); ctx.strokeStyle='#888'; ctx.lineWidth=3; ctx.strokeRect(0,0, world.width, world.height); ctx.restore(); }

  // 绘制障碍与拾取
  function drawWorldObjects(){
    ctx.save(); applyCamera();
    // 障碍（屏幕外裁剪）
    ctx.fillStyle='rgba(120,120,120,0.35)';
    for(const o of world.obstacles){ if(!isRectOnScreen(o.x,o.y,o.w,o.h)) continue; ctx.fillRect(o.x, o.y, o.w, o.h); }
    // 拾取（统一调用视觉函数）- 屏幕外裁剪
    for(const p of pickups){
      if(!isOnScreen(p.x,p.y,p.r+24)) continue;
      drawPickupVisual(p);
    }
    ctx.restore();
  }

  // 绘制建筑元素（替换圆环）
  function drawBuildings(){
    ctx.save(); applyCamera();
    for(const b of buildings){
      if(!b.alive) continue;
      if(!isOnScreen(b.x,b.y,b.radius+30)) continue;
      // 建筑底座
      ctx.fillStyle = 'rgba(70,70,70,0.5)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill();
      // 建筑皮肤（图片）；若没有图片，则用占位形状
      const img = window.AssetStore?.images?.[b.skin];
      if(img){
        const size = b.radius*2;
        ctx.drawImage(img, b.x - size/2, b.y - size/2, size, size);
      } else {
        ctx.fillStyle = '#bba'; ctx.fillRect(b.x - b.radius*0.9, b.y - b.radius*0.9, b.radius*1.8, b.radius*1.8);
      }
      // 建筑名称
      ctx.fillStyle = '#fff'; ctx.font = `${Math.max(12, Math.floor(b.radius*0.6))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(b.name, b.x, b.y + b.radius + 6);
    }
    ctx.restore();
  }

  // 绘制角色/敌人的环绕武器
  function drawActorWeapons(actor){
    const hasAny = ((actor.weapons&&actor.weapons.length>0) || (actor.skillWeapons&&actor.skillWeapons.length>0));
    if(!hasAny) return;
    const now = performance.now();
    if(actor._hideWeapons || ((actor._hideWeaponsUntil||0) > now)) return; // 新增：隐藏武器渲染支持
    // 若持有者不在屏幕内，但其某些武器绑定了屏幕内的轨道目标（_orbitActor），则仍进入绘制流程
    const actorOnScreen = isOnScreen(actor.x, actor.y, (actor.radius||16)+60);
    let hasOrbitOnScreen = false;
    const combinedList = [ ...(actor.weapons||[]), ...(actor.skillWeapons||[]) ];
    if(!actorOnScreen){
      for(const w of combinedList){
        const oa = w && w._orbitActor;
        if(oa && isOnScreen(oa.x, oa.y, (oa.radius||16)+60)){ hasOrbitOnScreen = true; break; }
      }
      if(!hasOrbitOnScreen) return;
    }
    const enableBlur = (actor === player);
    for(const w of combinedList){
      if(!w || !w.alive) continue;
      if(w._detached) continue; // 在Boss技能火焰风暴期间，暂时不绘制已分离的武器
      const orbitActor = w._orbitActor || actor; // 支持围绕目标（例如玩家）旋转
      const spinDir = (w.spinDir==null?1:w.spinDir);
      const spinMul = (w.spinMul==null?1:w.spinMul); // 每个武器的旋转速度倍率
      const isBuddha = (orbitActor && orbitActor.role==='boss' && orbitActor.skin==='boss_fotuo');
      const isFairy = (orbitActor && orbitActor.role==='boss' && orbitActor.skin==='boss_nvXian');
      const baseSpin = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getSpin(orbitActor, w) : (window.FairyNS && isFairy) ? window.FairyNS.getSpin(orbitActor, w) : (orbitActor.weaponSpin||0);
      const ang = (w.angle||0) + baseSpin*spinDir*spinMul;
      const dist = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getDistance(orbitActor, w) : (orbitActor.radius + (w.radius||10) + 6 + (w.orbitOffset||0));
      const wx = orbitActor.x + Math.cos(ang) * dist;
      const wy = orbitActor.y + Math.sin(ang) * dist;
      if(!isOnScreen(wx, wy, (w.radius||10)+8)) continue;
      // 佛陀专属：仅保留外圈淡金色流光；残影/拖光效果已移除
      const isOuter = ((w.orbitOffset||0) >= 60);
      // no trail/ghost for Buddha weapons
      const img = window.AssetStore?.images?.[w.skin];
      const moonImg = window.AssetStore?.images?.['skill_moonblade'];
      const sizeBase = w.drawSize || (20 + (w.quality||0)*4);
      
      // unify shadow/halo via SkillVFX; sealed/locked weapons变暗
      const sh = window.SkillVFX?.getShadowForWeapon(w, orbitActor, enableBlur) || {color:'transparent', blur:0};
      const rectMoon = window.SkillVFX?.getDrawRect(w, sizeBase, moonImg) || {dw:sizeBase, dh:sizeBase};
      const rectImg = window.SkillVFX?.getDrawRect(w, sizeBase, img) || {dw:sizeBase, dh:sizeBase};
      const isDim = ((((w._sealedUntil||0) > now) || (w._locked===true)) && !(w.indestructible===true || w.bossImmune===true));
      if(isDim){ ctx.save(); ctx.globalAlpha = 0.45; }
      if(w.isMoonBlade && moonImg){
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(ang + Math.PI/2);
        ctx.shadowColor = sh.color;
        ctx.shadowBlur = sh.blur;
        // 佛陀外圈流光：淡金色增强
        if(isBuddha && isOuter){ ctx.shadowColor = 'rgba(255,215,0,0.75)'; ctx.shadowBlur = Math.max(sh.blur||0, 12); }
        ctx.drawImage(moonImg, -rectMoon.dw/2, -rectMoon.dh/2, rectMoon.dw, rectMoon.dh);
        ctx.restore();
      } else if(w.isMoonBlade){
        if(window.AssetStore?.registerImage){ window.AssetStore.registerImage('skill_moonblade', '图片素材/战技/月牙刀.png'); }
        // 佛陀外圈流光：淡金色增强
        if(isBuddha && isOuter){ ctx.save(); ctx.shadowColor = 'rgba(255,215,0,0.75)'; ctx.shadowBlur = 12; ctx.restore(); }
        drawCrescent(wx, wy, sizeBase*0.9, '#a7d0ff', ang + Math.PI/2);
      } else if(img){
        const size = sizeBase;
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(ang + Math.PI/2);
        ctx.shadowColor = sh.color;
        ctx.shadowBlur = sh.blur;
        // 佛陀外圈流光：淡金色增强
        if(isBuddha && isOuter){ ctx.shadowColor = 'rgba(255,215,0,0.75)'; ctx.shadowBlur = Math.max(sh.blur||0, 12); }
        ctx.drawImage(img, -rectImg.dw/2, -rectImg.dh/2, rectImg.dw, rectImg.dh);
        ctx.restore();
      } else {
        const size = sizeBase;
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(ang + Math.PI/2);
        ctx.shadowColor = sh.color;
        ctx.shadowBlur = sh.blur;
        // 佛陀外圈流光：淡金色增强
        if(isBuddha && isOuter){ ctx.shadowColor = 'rgba(255,215,0,0.75)'; ctx.shadowBlur = Math.max(sh.blur||0, 12); }
        drawCrescent(wx, wy, size*0.9, '#a7d0ff', ang + Math.PI/2);
        ctx.restore();
      }
      if(isDim){ ctx.restore(); }
    }
  }

  // 绘制敌人与玩家（使用图片）
  function drawActors(){
    ctx.save(); applyCamera();
    // 敌人（屏幕外裁剪）
    for(const e of enemies){
      // 先尝试绘制其武器（函数内自带屏幕检测：若持有者离屏但其武器围绕在屏幕内的轨道目标，则仍会绘制）
      drawActorWeapons(e);
      // 敌人主体（图片与光晕）仍遵循屏幕裁剪
      if(!isOnScreen(e.x,e.y,(e.radius||16)+60)) continue;
      // 新增：闭关NPC的圆形七彩光晕（视觉近似）
      if(e.seclusion){
        const auraR = Math.max(e.radius+10, 22);
        // 使用径向渐变实现七彩环，避免复杂多段路径带来的性能开销
        const grad = ctx.createRadialGradient(e.x, e.y, auraR*0.65, e.x, e.y, auraR);
        grad.addColorStop(0.00, 'rgba(255,255,255,0.0)');
        grad.addColorStop(0.35, 'rgba(255,0,0,0.15)');
        grad.addColorStop(0.45, 'rgba(255,165,0,0.18)');
        grad.addColorStop(0.55, 'rgba(255,255,0,0.20)');
        grad.addColorStop(0.65, 'rgba(0,255,0,0.20)');
        grad.addColorStop(0.75, 'rgba(0,127,255,0.20)');
        grad.addColorStop(0.85, 'rgba(139,0,255,0.20)');
        grad.addColorStop(0.95, 'rgba(255,255,255,0.22)');
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = 'rgba(255,255,255,0.0)';
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(e.x, e.y, auraR, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
      const img = window.AssetStore?.images?.[e.skin];
      let size = e.radius*2;
      if(e.role==='boss') size = size * 2; // Boss图标2倍
      if(img){
        ctx.drawImage(img, e.x - size/2, e.y - size/2, size, size);
      } else {
        if(!e._imgWarned){
          console.warn('缺少贴图资源:', e.skin);
          e._imgWarned = true;
        }
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.arc(e.x,e.y,e.radius*(e.role==='boss'?2:1),0,Math.PI*2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      // 已提前绘制武器，避免重复调用
      // drawActorWeapons(e);
    }
    // 玩家
    {
      const img = window.AssetStore?.images?.[player.skin];
      const size = player.radius*2;
      // 先绘制定位光环，保证即便图片透明也可见
      ctx.save();
      const qColor = QUALITY[(player.equippedQuality||0)]?.color || 'rgba(255,255,255,0.7)';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = qColor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.radius+4, 0, Math.PI*2); ctx.stroke();
      ctx.restore();

      if(img){
        ctx.drawImage(img, player.x - size/2, player.y - size/2, size, size);
      } else {
        ctx.fillStyle = '#66ccff'; ctx.beginPath(); ctx.arc(player.x,player.y,player.radius,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      // 中心点（细小）
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(player.x, player.y, 2, 0, Math.PI*2); ctx.fill(); ctx.restore();
      drawActorWeapons(player);
    }
    ctx.restore();
  }

  // 主绘制
  function drawBackground(){
    ctx.save();
    // 使用摄像机变换，让背景随地图移动
    applyCamera();

    // 使用背景模块绘制势力/郊外
    if(window.Game?.Background){
      window.Game.Background.drawBackground(ctx, world);
    } else {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0,0, world.width, world.height);
    }

    // 绘制多条简约山丘（水平波浪线）
    const hillCount = 4;
    for(let i=0;i<hillCount;i++){
      const yBase = world.height*0.3 + i*world.height*0.12;
      const amp = 80 - i*10;
      const freq = 2*Math.PI / (world.width/3);
      ctx.strokeStyle = '#5fa96f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for(let x=0;x<=world.width;x+=40){
        const y = yBase + Math.sin(x*freq + i)*amp;
        if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    // 绘制多条简约河流（竖向曲线）
    const riverCount = 3;
    for(let i=0;i<riverCount;i++){
      const xBase = world.width*0.15 + i*world.width*0.3;
      const amp = 90;
      const freq = 2*Math.PI / (world.height/3);
      ctx.strokeStyle = '#4ac0c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(let y=0;y<=world.height;y+=40){
        const x = xBase + Math.sin(y*freq + i*2)*amp;
        if(y===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function qColor(q){ return QUALITY[q]?.color || '#ffffff'; }

  function drawCrescent(x, y, size=18, color='#ffd53f', rotation=0){
    const outerRadius = size;
    const innerRadius = size * 0.72; // 内圆半径，明显的月牙厚度
    const offset = size * 0.42;      // 位移更大以形成清晰的月牙
  
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
  
    // 使用奇偶填充规则绘制：外圆 + 反向内圆，得到稳定的月牙形状
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI*2, false);
    // 反向绘制内圆，中心偏移
    ctx.arc(offset, 0, innerRadius, Math.PI*2, 0, true);
    // 使用 evenodd 填充规则确保得到外圆减去内圆的区域
    if(typeof ctx.fill === 'function'){
      try { ctx.fill('evenodd'); }
      catch(e){ ctx.fill(); } // 某些环境不支持 fill('evenodd')，退化为普通填充
    } else {
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrystalByQuality(p){
    const r = p.r;
    const outerColor = qColor(p.q);
    const bgCol = (window.Game?.Background?.getColor(p.x, p.y, world)) || '#000';
    ctx.save();
    ctx.fillStyle = outerColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    ctx.fill();
    // enlarged inner circle (still smaller than outer)
    const innerR = r * 0.8; // was 0.6
    const offset = r * 0.38;
    ctx.fillStyle = bgCol;
    ctx.beginPath();
    ctx.arc(p.x + offset, p.y + offset, innerR, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // 绘制拾取物（武器水晶 + 数字）
  function drawPickupVisual(p){
    // 月牙主体
    drawCrystalByQuality(p);

    // 右下角数字背景与文本
    ctx.save();
    ctx.translate(p.x + p.r*0.5, p.y + p.r*0.5);
    const badgeR = Math.max(10, p.r*0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, badgeR, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(badgeR*0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.count, 0, 0);
    ctx.restore();
  }

  // 绘制函数序列
  function draw(){
    drawBackground();
    drawMapBounds();
    drawWorldObjects();
    drawBuildings();
    drawActors();
    drawParticles();
  }

  // 暴露接口到 Game
  Object.assign(window.Game, {
    draw,
    updateParticles,
    drawPickupVisual,
    spawnSparks,
    applyCamera
  });

})();