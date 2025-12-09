// orbit_fx.js - 独立武器环绕模块（纯视觉，解耦于武器系统，<=500行）
(function(){
  const G = window.Game;
  if(!G){ console.error('[OrbitFX] Game core not ready'); return; }

  // 顶层覆盖画布（屏幕坐标渲染）
  const overlay = document.createElement('canvas');
  overlay.id = 'orbitFxCanvas';
  Object.assign(overlay.style, {
    position: 'fixed', left: 0, top: 0, width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 29 // 低于 TreasureFX(30)，避免遮挡其大字与闪光
  });
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');
  function resize(){ overlay.width = innerWidth; overlay.height = innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // 世界坐标 → 屏幕坐标
  function worldToScreen(wx, wy){
    const cam = G.camera;
    if(!cam){ return {x:wx, y:wy}; }
    const left = cam.cx - cam.viewW/2;
    const top  = cam.cy - cam.viewH/2;
    const sx = (wx - left) * cam.scale;
    const sy = (wy - top ) * cam.scale;
    return {x:sx, y:sy};
  }

  // 资源选择：优先使用武器贴图
  const store = window.AssetStore;
  function pickWeaponImage(i){
    if(!store || !store.images) return null;
    const keys = ['weapon_sword','weapon_staff'];
    const k = keys[i % keys.length];
    return store.images[k] || null;
  }

  // 环绕效应列表
  const rings = [];

  function spawnOrbitRing(actor, opts={}){
    if(!actor){ console.warn('[OrbitFX] spawnOrbitRing 缺少 actor'); return null; }
    const count = Math.max(1, opts.count||50);
    const baseR = (opts.radius!=null ? opts.radius : ((actor.radius||24) + 22));
    const itemR = Math.max(2, opts.itemRadius||10); // 用于展示圆点大小或贴图缩放
    const spinSpeed = (opts.spinSpeed!=null ? opts.spinSpeed : (G.SPIN_SPEED_TIERS?.mid||0));
    const life = (opts.life!=null ? opts.life : 8000); // ms，默认8秒，可设置为Infinity
    const start = performance.now();
    const imgs = new Array(count).fill(null).map((_,i)=> pickWeaponImage(i));
    // 若存在已绑定的环绕，先移除，保证唯一实例
    for(let i=rings.length-1;i>=0;i--){ if(rings[i].actor===actor) rings.splice(i,1); }
    const ring = { type:'orbit', actor, count, baseR, itemR, spinSpeed, start, life, baseAng: (actor.weaponSpin||0), imgs };
    rings.push(ring);
    return ring;
  }

  function cancelOrbit(actor){
    for(let i=rings.length-1;i>=0;i--){ if(rings[i].actor===actor) rings.splice(i,1); }
  }

  function clearAll(){ rings.length = 0; }

  function draw(){
    const now = performance.now();
    octx.clearRect(0,0,overlay.width, overlay.height);
    for(let i=rings.length-1;i>=0;i--){
      const r = rings[i];
      if(!r || !r.actor){ rings.splice(i,1); continue; }
      const age = now - (r.start||now);
      if(r.life!=null && isFinite(r.life) && age >= r.life){ rings.splice(i,1); continue; }
      const center = worldToScreen(r.actor.x, r.actor.y);
      const scale = (G.camera?.scale||1);
      const radius = r.baseR * scale;
      const t = age/1000; // seconds
      // 旋转角度：独立通道（不依赖 actor.weaponSpin），避免交互冲突
      const spin = r.baseAng + r.spinSpeed * t;
      // 渐入/渐出：前200ms淡入，若有life则最后200ms淡出
      let alpha = 1;
      if(age < 200){ alpha = age/200; }
      if(isFinite(r.life) && r.life>0 && (r.life - age) < 200){ alpha = Math.min(alpha, (r.life - age)/200); }
      octx.save();
      octx.globalAlpha = Math.max(0, Math.min(1, alpha));
      for(let k=0;k<r.count;k++){
        const ang = spin + k*(Math.PI*2 / r.count);
        const x = center.x + Math.cos(ang) * radius;
        const y = center.y + Math.sin(ang) * radius;
        const img = r.imgs[k];
        if(img){
          const sz = r.itemR * scale * 2; // 直径约等于 itemR*2
          octx.drawImage(img, x - sz/2, y - sz/2, sz, sz);
        } else {
          // 占位圆点
          octx.beginPath();
          octx.arc(x, y, Math.max(3, r.itemR*0.8*scale), 0, Math.PI*2);
          octx.fillStyle = 'rgba(255,230,160,0.9)';
          octx.fill();
        }
      }
      octx.restore();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // 暴露 API
  window.OrbitFX = {
    spawnOrbitRing,
    cancelOrbit,
    clearAll,
  };
})();