// boss_skill_core.js - Boss技能核心（公共VFX/调度/更新与注册，<=500行）
(function(){
  const G = window.Game; if(!G){ console.error('[BossSkillCore] Game not ready'); return; }
  const { enemies, player } = G;

  // 视口工具（与 render_particles 一致）
  function updateCam(){ if(typeof G.updateCamera==='function') G.updateCamera(); }
  function getViewRect(){ updateCam(); const c=G.camera; const left=c.cx - c.viewW/2, top=c.cy - c.viewH/2; return { left, top, right:left+c.viewW, bottom:top+c.viewH }; }
  function isOnScreen(x,y,r=0){ const v=getViewRect(); return x+r>v.left && x-r<v.right && y+r>v.top && y-r<v.bottom; }

  // ---------------- 公共视觉特效库 ----------------
  const SkillVFXLib = {
    rings:[], flames:[], trails:[], petals:[], bolts:[], vines:[], links:[], tornados:[], rains:[], sealFx:[], beams:[],
    // 独立模块：屏幕扫过的矩形柱（不随玩家移动，屏幕空间锚定）
    sweeps:[],
    // 新增：高亮模糊光点
    glowDots:[],
    // 新增：技能提示标签
    labels:[],
    // 图片爆闪：在点位显示图片，随后淡出并转为金光
    imageBursts:[],
    worldSweeps:[],
    spawnMagmaRing(x,y,r,color=null,life=1200,growRate=0){ const ring={x,y,r,life,color,growRate}; this.rings.push(ring); return ring; },
    spawnAuraRing(x,y,r,color,life=1600){ this.rings.push({x,y,r,life,color,fill:true}); },
    // 新增：技能提示标签（金色填充，白色描边，默认大号字体）
    spawnLabel(x,y,text, opts={}){ const { life=2200, font='bold 28px KaiTi, serif', fillColor='rgba(255,215,0,0.95)', strokeColor='rgba(255,255,255,0.95)', align='center' } = opts; this.labels.push({ x, y, text, life, font, fillColor, strokeColor, align }); },
    spawnFlameStorm(cx,cy,storm,owner){ const f={cx,cy,storm,life:5000, owner}; this.flames.push(f); return f; },
    spawnRushTrail(boss, life=null){ const now=performance.now?.() ?? Date.now(); const L=(life!=null)?life:Math.max(600, ((boss?._rush?.end ?? now + 800) - now) + 600); this.trails.push({ boss, life:L }); },
    addWeaponTrails(boss,ws){ this.trails.push({ boss, ws, life:300 }); },
    spawnPetals(boss,parts){ this.petals.push({ boss, parts: parts.map(p=>({...p})), life:5000 }); },
    spawnLightning(strikes, life = 1000){ this.bolts.push({ strikes: strikes.map(s=>({...s})), life }); },
    spawnVines(list){ this.vines.push({ list, life:3500 }); },
    spawnLink(boss,player){ this.links.push({ boss, player, life:1200 }); },
    spawnTornado(boss){ this.tornados.push({ boss, life:4500 }); },
    spawnPetalShots(shots){ this.petals.push({ shots, life:4000 }); },
    spawnBeams(beams, life = 1000, owner = null){ this.beams.push({ owner, beams: beams.map(b=>({...b})), life }); },
    spawnRain(drops){ this.rains.push({ drops, life:2500 }); },
    spawnSealLightning(w){ this.sealFx.push({ w, life:3000 }); },
    // 新增：高亮模糊光点生成
    spawnGlowDots(dots, life=1500){ this.glowDots.push({ dots: dots.map(d=>({...d})), life }); },
    // 图片爆闪：在点位显示图片，随后淡出并转为金光
    spawnImageBurst(x,y, opts={}){
      const { imgKey='skill_balance_scale', size=120, life=1200, glowLife=800, glowColor='rgba(255,215,0,0.85)', blur=8, coverScreen=false } = opts;
      const img = window.AssetStore?.images?.[imgKey] || null;
      this.imageBursts.push({ x, y, imgKey, img, size, life, glowLife, glowColor, blur, coverScreen, lifeMax: life, glowMax: glowLife });
    },
    // 新增：生成屏幕锚定扫屏柱（支持 axis: 'x' | 'y'）
    spawnScreenSweep({ owner=null, offset=0, thick=80, color='rgba(120,180,255,0.75)', blur=6, dir=1, speed=560, life=11000, axis='x', mode='strip', labelText=null, labelColor='rgba(190,225,255,0.95)', labelFont='bold 22px KaiTi, serif', centerWorldCoord=null, startWorldPos=null }){
      const s = { owner, offset, thick, color, blur, dir, speed, life, axis, mode, labelText, labelColor, labelFont };
      const W = G.world?.width||10000, H = G.world?.height||10000;
      // 以世界坐标初始化：起点为世界边界或调用方指定；头部初始与起点相同
      if((axis||'x')==='y'){
        s.startWorldPos = (startWorldPos!=null) ? startWorldPos : (((s.dir||1) > 0) ? 0 : H);
        s.centerWorldCoord = (centerWorldCoord!=null) ? centerWorldCoord : (owner?.x ?? G.player?.x ?? (W*0.5));
        s.worldPos = s.startWorldPos;
      } else {
        s.startWorldPos = (startWorldPos!=null) ? startWorldPos : (((s.dir||1) > 0) ? 0 : W);
        s.centerWorldCoord = (centerWorldCoord!=null) ? centerWorldCoord : (owner?.y ?? G.player?.y ?? (H*0.5));
        s.worldPos = s.startWorldPos;
      }
      this.sweeps.push(s);
      return s;
    },
    // 便捷：生成纵向扫屏（从上到下），相当于 axis='y'
    spawnScreenSweepY(opts={}){ return this.spawnScreenSweep({ ...opts, axis:'y' }); },
    // 查询：按 owner 返回 sweep 的位置信息 { axis, worldPos, thick }
    getSweepPositionsByOwner(owner){ const list=[]; for(const s of this.sweeps){ if(s.owner===owner){ const worldPos = (s.worldPos!=null) ? s.worldPos : (s.startWorldPos??0); list.push({ axis:(s.axis||'x'), worldPos, thick:(s.thick||80) }); } } return list; },
    // 兼容旧接口：仅返回 axis==='x' 的世界X坐标
    getSweepXsByOwner(owner){ const xs=[]; for(const s of this.sweeps){ if(s.owner===owner && (s.axis!=='y')){ const worldPos = (s.worldPos!=null) ? s.worldPos : (s.startWorldPos??0); xs.push(worldPos); } } return xs; },
    // 提供清理：移除某个 owner 的扫屏柱
    removeSweepsByOwner(owner){ for(let i=this.sweeps.length-1;i>=0;i--){ if(this.sweeps[i].owner===owner) this.sweeps.splice(i,1); } },
    update(dt){
      for(const r of this.rings){ if(r.growRate){ r.r += r.growRate * dt/1000; } }
      // 使用世界坐标推进扫屏柱，并按世界边界判出界
      const W = G.world?.width||10000, H = G.world?.height||10000;
      for(let i=this.sweeps.length-1;i>=0;i--){ const s=this.sweeps[i];
        if(s.worldPos==null){ s.worldPos = s.startWorldPos??0; }
        s.worldPos += (s.dir||1) * (s.speed||560) * dt/1000;
        s.life -= dt;
        const thick=(s.thick||80); let out=false;
        if((s.axis||'x')==='y'){
          out = (s.dir>0 && s.worldPos > H + thick) || (s.dir<0 && s.worldPos < -thick);
        } else {
          out = (s.dir>0 && s.worldPos > W + thick) || (s.dir<0 && s.worldPos < -thick);
        }
        if(s.life<=0 || out){ this.sweeps.splice(i,1); }
      }
      for(const arr of [this.rings,this.flames,this.trails,this.petals,this.bolts,this.vines,this.links,this.tornados,this.rains,this.sealFx,this.beams]){ for(let i=arr.length-1;i>=0;i--){ arr[i].life-=dt; if(arr[i].life<=0) arr.splice(i,1); } }
      // 新增：光点生命周期
      for(let i=this.glowDots.length-1;i>=0;i--){ this.glowDots[i].life -= dt; if(this.glowDots[i].life<=0) this.glowDots.splice(i,1); }
      // 新增：技能标签生命周期
      for(let i=this.labels.length-1;i>=0;i--){ this.labels[i].life -= dt; if(this.labels[i].life<=0) this.labels.splice(i,1); }
      // 图片爆闪生命周期
      for(let i=this.imageBursts.length-1;i>=0;i--){ const b=this.imageBursts[i]; b.life = (b.life||0) - dt; b.glowLife = (b.glowLife||0) - dt; if((b.life<=0) && (b.glowLife<=0)) this.imageBursts.splice(i,1); }
    },
    draw(ctx){ const cam = G.camera; const left = cam.cx - cam.viewW/2; const top = cam.cy - cam.viewH/2; ctx.save(); ctx.setTransform(cam.scale,0,0,cam.scale, -left*cam.scale, -top*cam.scale);
      // 按世界坐标绘制扫屏柱（不随相机变化），不再基于视口边界裁剪
      for(const s of this.sweeps){ const thick=(s.thick||80); ctx.save(); if(s.blur){ ctx.filter=`blur(${s.blur}px)`; } ctx.fillStyle=(s.color||'rgba(120,180,255,0.75)');
        if((s.axis||'x')==='y'){
          const hw = thick*0.5; const headY = (s.worldPos!=null) ? s.worldPos : (s.startWorldPos??0); const startY = (s.startWorldPos!=null) ? s.startWorldPos : 0;
          if(s.mode==='extend'){
            const y0World = Math.min(startY, headY), y1World = Math.max(startY, headY);
            const cx = (s.centerWorldCoord!=null) ? s.centerWorldCoord : (G.world?.width||0)*0.5;
            ctx.beginPath(); ctx.moveTo(cx - hw, y0World); ctx.lineTo(cx + hw, y0World); ctx.lineTo(cx + hw, y1World); ctx.lineTo(cx - hw, y1World); ctx.closePath(); ctx.fill();
            const coreHW=hw*0.7; ctx.beginPath(); ctx.moveTo(cx - coreHW, y0World); ctx.lineTo(cx + coreHW, y0World); ctx.lineTo(cx + coreHW, y1World); ctx.lineTo(cx - coreHW, y1World); ctx.closePath(); ctx.fill();
            if(s.labelText){ const posY = headY + (((s.dir||1) > 0) ? 18 : -12); const posX = cx; ctx.save(); ctx.filter='none'; ctx.shadowColor='rgba(60,120,200,0.55)'; ctx.shadowBlur=8; ctx.fillStyle=(s.labelColor||'rgba(190,225,255,0.95)'); ctx.font=(s.labelFont||'bold 22px KaiTi, serif'); ctx.textAlign='center'; ctx.fillText(s.labelText, posX, posY); ctx.restore(); }
          } else {
            const y = headY; const cx = (s.centerWorldCoord!=null) ? s.centerWorldCoord : (G.world?.width||0)*0.5; ctx.beginPath(); ctx.moveTo(cx - hw, y - 0); ctx.lineTo(cx + hw, y - 0); ctx.lineTo(cx + hw, y + 0); ctx.lineTo(cx - hw, y + 0); ctx.closePath(); ctx.fill();
            const coreHW=hw*0.7; ctx.beginPath(); ctx.moveTo(cx - coreHW, y - 0); ctx.lineTo(cx + coreHW, y - 0); ctx.lineTo(cx + coreHW, y + 0); ctx.lineTo(cx - coreHW, y + 0); ctx.closePath(); ctx.fill();
            if(s.labelText){ const posY = y - hw - 12; const posX = cx; ctx.save(); ctx.filter='none'; ctx.shadowColor='rgba(60,120,200,0.55)'; ctx.shadowBlur=8; ctx.fillStyle=(s.labelColor||'rgba(190,225,255,0.95)'); ctx.font=(s.labelFont||'bold 22px KaiTi, serif'); ctx.textAlign='center'; ctx.fillText(s.labelText, posX, posY); ctx.restore(); }
          }
        } else {
          const hw = thick*0.5; const headX = (s.worldPos!=null) ? s.worldPos : (s.startWorldPos??0); const startX = (s.startWorldPos!=null) ? s.startWorldPos : 0;
          if(s.mode==='extend'){
            const x0World = Math.min(startX, headX), x1World = Math.max(startX, headX);
            const cy = (s.centerWorldCoord!=null) ? s.centerWorldCoord : (G.world?.height||0)*0.5;
            ctx.beginPath(); ctx.moveTo(x0World, cy - hw); ctx.lineTo(x1World, cy - hw); ctx.lineTo(x1World, cy + hw); ctx.lineTo(x0World, cy + hw); ctx.closePath(); ctx.fill();
            const coreHW=hw*0.7; ctx.beginPath(); ctx.moveTo(x0World, cy - coreHW); ctx.lineTo(x1World, cy - coreHW); ctx.lineTo(x1World, cy + coreHW); ctx.lineTo(x0World, cy + coreHW); ctx.closePath(); ctx.fill();
            if(s.labelText){ const posX = headX + (((s.dir||1) > 0) ? 18 : -18); const posY = cy; ctx.save(); ctx.filter='none'; ctx.shadowColor='rgba(60,120,200,0.55)'; ctx.shadowBlur=8; ctx.fillStyle=(s.labelColor||'rgba(190,225,255,0.95)'); ctx.font=(s.labelFont||'bold 22px KaiTi, serif'); ctx.textAlign='center'; ctx.fillText(s.labelText, posX, posY); ctx.restore(); }
          } else {
            const x = headX; const cy = (s.centerWorldCoord!=null) ? s.centerWorldCoord : (G.world?.height||0)*0.5;
            ctx.beginPath(); ctx.moveTo(x - hw, cy - 0); ctx.lineTo(x + hw, cy - 0); ctx.lineTo(x + hw, cy + 0); ctx.lineTo(x - hw, cy + 0); ctx.closePath(); ctx.fill();
            const coreHW=hw*0.7; ctx.beginPath(); ctx.moveTo(x - coreHW, cy - 0); ctx.lineTo(x + coreHW, cy - 0); ctx.lineTo(x + coreHW, cy + 0); ctx.lineTo(x - coreHW, cy + 0); ctx.closePath(); ctx.fill();
            if(s.labelText){ const posX = x + hw + 12; const posY = cy; ctx.save(); ctx.filter='none'; ctx.shadowColor='rgba(60,120,200,0.55)'; ctx.shadowBlur=8; ctx.fillStyle=(s.labelColor||'rgba(190,225,255,0.95)'); ctx.font=(s.labelFont||'bold 22px KaiTi, serif'); ctx.textAlign='center'; ctx.fillText(s.labelText, posX, posY); ctx.restore(); }
          }
        }
        if(s.blur){ ctx.filter='none'; }
        ctx.restore();
      }
      for(const r of this.rings){ ctx.save(); if(r.fill){ ctx.fillStyle = r.color || 'rgba(255,80,60,0.3)'; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.fill(); } else { ctx.strokeStyle = r.color || 'rgba(255,80,60,0.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); } ctx.restore(); }
      for(const f of this.flames){
        for(const s of f.storm){
          const bx = (s.boss && s.boss.x!=null) ? s.boss.x : f.cx;
          const by = (s.boss && s.boss.y!=null) ? s.boss.y : f.cy;
          const dx = (s.x - bx) || 0;
          const dy = (s.y - by) || 0;
          const dist = Math.hypot(dx, dy) || 1;
          const len = (s.len!=null ? s.len : dist);
          const nx = dx / dist, ny = dy / dist;
          const ex = bx + nx * len, ey = by + ny * len;
          ctx.save();
          ctx.strokeStyle = (s.color || 'rgba(255,120,40,0.85)');
          ctx.lineWidth = s.thick || 10;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.stroke();
          ctx.restore();
        }
      }
      for(const t of this.trails){
        const b=t.boss;
        if(!b) continue;
        if(b.skin==='boss_niumo'){
          // 新增：红色径向渐变包裹（仅牛魔王）
          ctx.save();
          const baseR = (b.radius||24);
          const outerR = baseR * (b.role==='boss' ? 2.4 : 1.15);
          const innerR = baseR * (b.role==='boss' ? 0.7 : 0.2);
          const grad = ctx.createRadialGradient(b.x, b.y, innerR, b.x, b.y, outerR);
          grad.addColorStop(0, 'rgba(255,40,40,0.85)');
          grad.addColorStop(0.55, 'rgba(255,60,60,0.35)');
          grad.addColorStop(1, 'rgba(255,0,0,0.0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, outerR, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
          // 原拖尾（仅牛魔王）
          ctx.save();
          ctx.strokeStyle='rgba(255,0,0,0.45)';
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(b.x,b.y);
          ctx.lineTo(b.x - (b._rush?.vx||0)*0.08, b.y - (b._rush?.vy||0)*0.08);
          ctx.stroke();
          ctx.restore();
          // 如果包含关联武器，绘制其轨迹小光点（仅牛魔王）
          if(t.ws){
            for(const w of t.ws){
              const isBuddha = (b && b.role==='boss' && b.skin==='boss_fotuo');
              const spinDir = (w.spinDir==null?1:w.spinDir);
              const spinMul = (w.spinMul==null?1:w.spinMul);
              const baseSpin = (window.BuddhaNS && isBuddha) ? BuddhaNS.getSpin(b, w) : (b.weaponSpin||0);
              const ang=(w.angle||0)+ baseSpin*spinDir*spinMul;
              const dist=(window.BuddhaNS && isBuddha) ? BuddhaNS.getDistance(b, w) : (b.radius+(w.radius||10)+6+(w.orbitOffset||0));
              const x=b.x+Math.cos(ang)*dist, y=b.y+Math.sin(ang)*dist;
              ctx.save();
              ctx.strokeStyle='rgba(255,230,160,0.6)';
              ctx.beginPath();
              ctx.arc(x,y,6,0,Math.PI*2);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }
      for(const p of this.petals){ if(p.parts){ const b=p.boss; if(!b) continue; for(const part of p.parts){ const x=b.x+Math.cos(part.ang)*part.dist, y=b.y+Math.sin(part.ang)*part.dist; ctx.save(); ctx.fillStyle='rgba(255,160,220,0.85)'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill(); ctx.restore(); } } else if(p.shots){ for(const s of p.shots){ if(!s || s.life<=0) continue; ctx.save(); ctx.fillStyle=(s.color||'rgba(255,160,220,0.9)'); const len=s.len, thick=s.thick, vx=s.vx, vy=s.vy; if(len && thick && (vx||vy)){ const ang=Math.atan2(vy||0, vx||0); const half=len/2, rad=thick/2; ctx.translate(s.x, s.y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-half, -rad); ctx.lineTo(half, -rad); ctx.arc(half, 0, rad, -Math.PI/2, Math.PI/2); ctx.lineTo(-half, rad); ctx.arc(-half, 0, rad, Math.PI/2, -Math.PI/2); ctx.closePath(); ctx.fill(); } else { ctx.beginPath(); ctx.arc(s.x,s.y,4,0,Math.PI*2); ctx.fill(); } ctx.restore(); } } }
      // 新增：绘制更亮更模糊的绿黄光点（自然共鸣周边）
      for(const g of this.glowDots){ const dots=g.dots||[]; for(const d of dots){ ctx.save(); if(d.blur){ ctx.filter = `blur(${d.blur}px)`; } ctx.fillStyle = d.color || 'rgba(200,255,160,0.9)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r||3, 0, Math.PI*2); ctx.fill(); if(d.blur){ ctx.filter='none'; } ctx.restore(); } }
      // 绘制图片爆闪与金光
      for(const b of this.imageBursts){
        const tImg = (b.lifeMax>0) ? Math.max(0, Math.min(1, (b.life||0)/b.lifeMax)) : 0;
        const tGlow = (b.glowMax>0) ? Math.max(0, Math.min(1, (b.glowLife||0)/b.glowMax)) : 0;
        const imgRef = b.img || (window.AssetStore?.images?.[b.imgKey] || null);
        if(imgRef && tImg>0){
          ctx.save();
          if(b.blur){ ctx.filter = `blur(${b.blur}px)`; }
          const sz = (b.size||120) * (0.95 + 0.05*(1 - tImg));
          ctx.globalAlpha = tImg;
          ctx.drawImage(imgRef, b.x - sz/2, b.y - sz/2, sz, sz);
          ctx.filter='none';
          ctx.restore();
          b.img = imgRef; // 缓存以避免每帧查找
        }
        if(tGlow>0){
          ctx.save();
          ctx.fillStyle = b.glowColor || 'rgba(255,215,0,0.85)';
          if(b.blur){ ctx.filter = `blur(${b.blur}px)`; }
          const r = (b.size||120) * (0.8 + 0.5*(1 - tGlow));
          ctx.globalAlpha = 0.35 * tGlow;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI*2);
          ctx.fill();
          if(b.coverScreen){
            // 全图淡金覆盖闪光（屏幕空间）
            ctx.filter = b.blur ? `blur(${b.blur}px)` : 'none';
            ctx.globalAlpha = 0.16 * tGlow;
            ctx.fillStyle = b.glowColor || 'rgba(255,215,0,0.85)';
            ctx.fillRect(left, top, cam.viewW, cam.viewH);
          }
          ctx.filter='none';
          ctx.restore();
        }
      }
      // 新增：绘制通用技能标签（支持金色填充 + 白色描边），置于图片之上
      for(const l of this.labels){
        if(!l || l.life<=0) continue;
        ctx.save();
        ctx.filter = 'none';
        ctx.font = l.font || 'bold 28px KaiTi, serif';
        ctx.textAlign = l.align || 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = l.strokeColor || 'rgba(255,255,255,0.95)';
        ctx.fillStyle = l.fillColor || 'rgba(255,215,0,0.95)';
        // 先描边后填充，确保白边清晰
        if(l.text){ ctx.strokeText(l.text, l.x, l.y); ctx.fillText(l.text, l.x, l.y); }
        ctx.restore();
      }
      for(const bm of this.beams){
      const hasSweepForOwner = bm.owner && this.sweeps.some(s=>s.owner===bm.owner);
      if(hasSweepForOwner) continue;
      for(const b of bm.beams){
      if(b.scrOffset!=null || b.anchor==='screen'){
      const hw = (b.thick||8)*0.5; const x = left + (b.scrOffset||0); const yTop = top; const height = cam.viewH;
      ctx.save(); if(b.blur){ ctx.filter = `blur(${b.blur}px)`; }
      ctx.fillStyle=(b.color||'rgba(120,180,255,0.75)');
      ctx.beginPath(); ctx.moveTo(x - hw, yTop); ctx.lineTo(x + hw, yTop); ctx.lineTo(x + hw, yTop + height); ctx.lineTo(x - hw, yTop + height); ctx.closePath(); ctx.fill(); if(b.blur){ ctx.filter = 'none'; }
      const coreHW = hw*0.7; ctx.fillStyle=(b.color||'rgba(120,180,255,0.75)');
      ctx.beginPath(); ctx.moveTo(x - coreHW, yTop); ctx.lineTo(x + coreHW, yTop); ctx.lineTo(x + coreHW, yTop + height); ctx.lineTo(x - coreHW, yTop + height); ctx.closePath(); ctx.fill(); ctx.restore();
      continue;
      }
      // 避免世界坐标的 seaDivide 梭形绘制（仅保留屏幕锚定矩形），防止出现第二条水柱
      if(b.tag==='seaDivide') continue;
      const vlen=Math.hypot(b.vx,b.vy)||1; const dx=b.vx/vlen, dy=b.vy/vlen; const len=b.len||140; const x2=b.x + dx*len, y2=b.y + dy*len; const thick=(b.thick||8);
      // 新增：闪电/藤蔓状折线绘制（女仙藤蔓缠绕专用），仅当 b.shape==='zigzag' 时启用
      if(b.shape==='zigzag'){
        const segs = Math.max(6, Math.floor(len / 24));
        const jitter = (b.jitter==null?8:b.jitter);
        const nx = -dy, ny = dx; // 法线
        // 线性渐变（起点到终点）
        const grad = ctx.createLinearGradient(b.x, b.y, x2, y2);
        const gcs = Array.isArray(b.gradColors)? b.gradColors : ['rgba(60,200,140,0.25)','rgba(220,255,220,0.85)'];
        grad.addColorStop(0, gcs[0]); grad.addColorStop(1, gcs[gcs.length-1]);
        const points = [];
        points.push({x:b.x, y:b.y});
        for(let i=1;i<segs;i++){
          const t = i/segs;
          const px = b.x + dx*len*t;
          const py = b.y + dy*len*t;
          const amp = ((i%2===0)?1:-1) * jitter * (0.6 + 0.4*Math.random());
          points.push({ x: px + nx*amp, y: py + ny*amp, t });
        }
        points.push({x:x2, y:y2, t:1});
        ctx.save();
        if(b.blur){ ctx.filter = `blur(${b.blur}px)`; }
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // 端点透明度过渡：分两段绘制，中段清晰，两端逐渐透明
        const midStart = Math.floor(points.length*0.15);
        const midEnd = Math.ceil(points.length*0.85);
        // 第一段：头部到中段，逐步提升 alpha
        for(let pass=0; pass<2; pass++){
          const alphaStart = (pass===0?0.0:0.0);
          const alphaMid = (pass===0?0.65:0.35);
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(2, thick*0.8);
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for(let i=1;i<midStart;i++){ ctx.lineTo(points[i].x, points[i].y); }
          ctx.globalAlpha = alphaMid;
          ctx.stroke();
          // 中段到尾部：逐步降低 alpha
          ctx.beginPath();
          ctx.moveTo(points[midStart].x, points[midStart].y);
          for(let i=midStart+1;i<midEnd;i++){ ctx.lineTo(points[i].x, points[i].y); }
          ctx.globalAlpha = (pass===0?0.85:0.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(points[midEnd].x, points[midEnd].y);
          for(let i=midEnd+1;i<points.length;i++){ ctx.lineTo(points[i].x, points[i].y); }
          ctx.globalAlpha = alphaMid;
          ctx.stroke();
        }
        // 外围淡光（保持较低透明）
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = (b.color||'rgba(60,200,140,0.55)');
        ctx.lineWidth = Math.max(1, thick*0.45);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i=1;i<points.length;i++){ ctx.lineTo(points[i].x, points[i].y); }
        ctx.stroke();
        // 周围叶片：绿色或黄色椭圆，沿藤蔓两侧，按藤蔓方向倾斜
        ctx.globalAlpha = 0.65;
        const rotBase = Math.atan2(dy, dx);
        const leafPalette = Array.isArray(b.leafColors) ? b.leafColors : ['rgba(60,220,140,0.9)','rgba(220,255,120,0.9)','rgba(255,160,220,0.9)'];
        const leafTilt = (b.leafTilt!=null) ? b.leafTilt : (0.38 + Math.PI/2); // 叶片倾斜角增加90度
        const leafRx = (b.leafRx!=null) ? b.leafRx : 5;         // 椭圆长轴（略增）
        const leafRy = (b.leafRy!=null) ? b.leafRy : 2.2;       // 椭圆短轴
        const leafOffset = (b.leafOffset!=null) ? b.leafOffset : Math.max(4, thick*0.9); // 与藤蔓的侧向距离
        for(let i=0;i<points.length;i++){
          const p = points[i];
          // 两端不遮挡角色：端点处保持透明
          const edgeFade = (p.t==null)? (i===0||i===points.length-1 ? 0.0 : 1.0) : (p.t<0.08 || p.t>0.92 ? 0.0 : 1.0);
          if(edgeFade<=0) continue;
          const jitterSide = (Math.random()*2-1) * 0.8;
          // 左侧（沿法线正方向）
          const cxL = p.x + nx*(leafOffset + jitterSide);
          const cyL = p.y + ny*(leafOffset + jitterSide);
          const colorL = leafPalette[i % leafPalette.length];
          ctx.fillStyle = colorL;
          ctx.beginPath();
          ctx.ellipse(cxL, cyL, leafRx, leafRy, rotBase - leafTilt, 0, Math.PI*2);
          ctx.fill();
          // 右侧（沿法线负方向）
          const cxR = p.x - nx*(leafOffset + jitterSide);
          const cyR = p.y - ny*(leafOffset + jitterSide);
          const colorR = leafPalette[(i+1) % leafPalette.length];
          ctx.fillStyle = colorR;
          ctx.beginPath();
          ctx.ellipse(cxR, cyR, leafRx, leafRy, rotBase + leafTilt, 0, Math.PI*2);
          ctx.fill();
        }
        if(b.blur){ ctx.filter = 'none'; }
        ctx.restore();
        continue;
      }
      const nx=-dy, ny=dx; const hw = thick*0.5;
      // 梭子型参数：两端极窄，中部大幅膨胀，并使用贝塞尔曲线形成圆滑侧边
      const sHW = Math.max(1, hw*0.05);
      const cHW = hw*2.6;
      const t1 = 0.35, t2 = 0.65;
      const p0x=b.x, p0y=b.y;
      const p4x=x2, p4y=y2;
      const p1ux=p0x + nx*sHW, p1uy=p0y + ny*sHW;
      const p3ux=p4x + nx*sHW, p3uy=p4y + ny*sHW;
      const p1lx=p0x - nx*sHW, p1ly=p0y - ny*sHW;
      const p3lx=p4x - nx*sHW, p3ly=p4y - ny*sHW;
      // 上下侧的控制点（使中部更宽、两端收敛）
      const cu1x=p0x + dx*len*t1 + nx*cHW*0.95, cu1y=p0y + dy*len*t1 + ny*cHW*0.95;
      const cu2x=p0x + dx*len*t2 + nx*cHW*0.95, cu2y=p0y + dy*len*t2 + ny*cHW*0.95;
      const cl2x=p0x + dx*len*t2 - nx*cHW*0.95, cl2y=p0y + dy*len*t2 - ny*cHW*0.95;
      const cl1x=p0x + dx*len*t1 - nx*cHW*0.95, cl1y=p0y + dy*len*t1 - ny*cHW*0.95;
      // 第一层：带模糊边缘的梭子型填充
      ctx.save();
      if(b.blur){ ctx.filter = `blur(${b.blur}px)`; }
      ctx.fillStyle=(b.color||'rgba(0,200,80,0.9)');
      ctx.beginPath();
      ctx.moveTo(p0x,p0y); // 起点尖
      ctx.lineTo(p1ux,p1uy);
      ctx.bezierCurveTo(cu1x,cu1y, cu2x,cu2y, p3ux,p3uy);
      ctx.lineTo(p4x,p4y); // 终点尖
      ctx.lineTo(p3lx,p3ly);
      ctx.bezierCurveTo(cl2x,cl2y, cl1x,cl1y, p1lx,p1ly);
      ctx.closePath();
      ctx.fill();
      if(b.blur){ ctx.filter = 'none'; }
      ctx.restore();
      // 第二层：清晰核心（更窄，保持主体清晰）
      const coreHW = hw*0.7; const coreSW = 0;
      const cu1x2=p0x + dx*len*t1 + nx*coreHW*0.9, cu1y2=p0y + dy*len*t1 + ny*coreHW*0.9;
      const cu2x2=p0x + dx*len*t2 + nx*coreHW*0.9, cu2y2=p0y + dy*len*t2 + ny*coreHW*0.9;
      const cl2x2=p0x + dx*len*t2 - nx*coreHW*0.9, cl2y2=p0y + dy*len*t2 - ny*coreHW*0.9;
      const cl1x2=p0x + dx*len*t1 - nx*coreHW*0.9, cl1y2=p0y + dy*len*t1 - ny*coreHW*0.9;
      ctx.save();
      ctx.fillStyle=(b.color||'rgba(0,200,80,0.9)');
      ctx.beginPath();
      ctx.moveTo(p0x,p0y);
      ctx.lineTo(p0x + nx*coreSW, p0y + ny*coreSW);
      ctx.bezierCurveTo(cu1x2,cu1y2, cu2x2,cu2y2, p4x + nx*coreSW, p4y + ny*coreSW);
      ctx.lineTo(p4x,p4y);
      ctx.lineTo(p4x - nx*coreSW, p4y - ny*coreSW);
      ctx.bezierCurveTo(cl2x2,cl2y2, cl1x2,cl1y2, p0x - nx*coreSW, p0y - ny*coreSW);
      ctx.closePath();
      ctx.fill();
      ctx.restore(); } }
      for(const bl of this.bolts){
        // 组生命控制
        if(bl.life<=0) continue;
        for(const s of bl.strikes){
          // 单个闪电的参数支持：颜色、粗细、模糊、长度
          ctx.save();
          if(s.blur){ ctx.filter = `blur(${s.blur}px)`; }
          ctx.strokeStyle = s.color || 'rgba(255,255,120,0.95)';
          ctx.lineWidth = s.thick || 3;
          const len = s.len || 48;
          ctx.beginPath();
          const startY = (s.sky ? top - 40 : ((s.y || 0) - len*0.8));
          const endY = (s.y || 0) + (s.sky ? 0 : len*0.2);
          ctx.moveTo(s.x, startY);
          ctx.lineTo(s.x, endY);
          ctx.stroke();
          if(s.blur){ ctx.filter = 'none'; }
          ctx.restore();
        }
      }
      for(const v of this.vines){ for(const it of v.list){ const w=it.target; if(!w) continue; const ang=(w.angle||0)+(player.weaponSpin||0); const dist=player.radius+(w.radius||10)+6; const x=player.x+Math.cos(ang)*dist, y=player.y+Math.sin(ang)*dist; ctx.save(); ctx.strokeStyle='rgba(120,220,140,0.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x, y-12); ctx.lineTo(x, y+6); ctx.stroke(); ctx.restore(); } }
      for(const lk of this.links){ const b=lk.boss, p=lk.player; ctx.save(); ctx.strokeStyle='rgba(255,230,160,0.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.restore(); }
      for(const tr of this.tornados){ const b=tr.boss; ctx.save(); ctx.strokeStyle='rgba(120,180,255,0.7)'; ctx.beginPath(); ctx.arc(b.x,b.y,48,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
      for(const rn of this.rains){ for(const d of rn.drops){ ctx.save(); ctx.fillStyle='rgba(120,180,255,0.9)'; ctx.beginPath(); ctx.arc(d.x,d.y,3,0,Math.PI*2); ctx.fill(); ctx.restore(); } }
      for(const sf of this.sealFx){ const w=sf.w; if(!w) continue; const ang=(w.angle||0)+(player.weaponSpin||0); const dist=player.radius+(w.radius||10)+6; const x=player.x+Math.cos(ang)*dist, y=player.y+Math.sin(ang)*dist; ctx.save(); ctx.strokeStyle='rgba(255,255,140,0.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
      ctx.restore(); }
  };
  window.BossSkillVFX = SkillVFXLib;

  // ---------------- 技能集合与调度 ----------------
  const SkillLib = {}; // 由各Boss文件填充
  const SkillSets = {}; // 由各Boss文件注册
  const PassiveHooks = [];
  function registerPassive(fn){ if(typeof fn==='function') PassiveHooks.push(fn); }

  const Scheduler = {
    _cooldowns: new Map(),
    _lastCast: new Map(),
    getClosestOnScreenBoss(){ let best=null, bestD=Infinity; for(const e of enemies||[]){ if(!e || e.role!=='boss') continue; if(!isOnScreen(e.x,e.y,(e.radius||24)+20)) continue; const order = SkillSets[e.skin]||[]; if(order.length===0) continue; const d=Math.hypot(e.x-player.x, e.y-player.y)||1; if(d<bestD){ bestD=d; best=e; } } return best; },
    canCast(boss){ const now=performance.now(); const cd=this._cooldowns.get(boss)||0; const order=SkillSets[boss?.skin]||[]; return order.length>0 && now>=cd; },
    setCD(boss, ms){ this._cooldowns.set(boss, performance.now()+ms); },
    pickSkillForBoss(boss){ const order = SkillSets[boss?.skin]||[]; if(order.length===0) return null; const last = this._lastCast.get(boss)||null; const idx = last? (order.indexOf(last)+1)%order.length : 0; return order[idx]||null; },
    update(dt){ const now=performance.now(); for(const e of enemies||[]){ if(!e || e.role!=='boss') continue; if(!isOnScreen(e.x,e.y,(e.radius||24)+20)) continue; if(!this.canCast(e)) continue; const skillId = this.pickSkillForBoss(e); if(!skillId) continue; const skill = SkillLib[skillId]; if(!skill) continue; try{ skill.cast(e); this._lastCast.set(e, skillId); this.setCD(e, 6000); e._bossSkillActive = { id: skillId, end: now + (skill.duration||1000) }; skill.update(dt, e); }catch(err){ console.warn('[BossSkillScheduler] cast/update error', err); } } }
  };

  function update(dt){
    // 持续效果更新（屏幕外不更新技能）
    for(const e of enemies||[]){
      if(!e || e.role!=='boss') continue;
      const st=e._bossSkillActive;
      if(st){
        const sk=SkillLib[st.id];
        if(sk){
          if(isOnScreen(e.x,e.y,(e.radius||24)+20)){
            try{ sk.update(dt, e); }catch(err){ console.warn('[BossSkillCore] skill update error', err); }
          }
          if(performance.now()>=st.end){ e._bossSkillActive=null; }
        }
      }
    }
    // 被动挂钩
    for(const fn of PassiveHooks){ try{ fn(dt, G); }catch(err){ console.warn('[BossPassive] error', err); } }
    // 调度器施放（屏幕外不施放已在调度器中处理）
    Scheduler.update(dt);
  }

  window.BossSkillSystem = { update, SkillLib, Scheduler, SkillSets, registerPassive };
})();