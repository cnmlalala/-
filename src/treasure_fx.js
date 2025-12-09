// treasure_fx.js - Visual & text effects for treasure activation (<=500 lines)
(function(){
  const G = window.Game;
  if(!G){ console.error('[treasure_fx] Game core not ready'); return; }

  // ---------------------------------------------------
  // Overlay canvas for screen-space effects
  // ---------------------------------------------------
  const overlay = document.createElement('canvas');
  overlay.id = 'treasureFxCanvas';
  Object.assign(overlay.style, {
    position: 'fixed', left: 0, top: 0, width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 30
  });
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');
  function resize(){ overlay.width = innerWidth; overlay.height = innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // ---------------------------------------------------
  // Effect helpers
  // ---------------------------------------------------
  const effects = []; // active effects list

  function worldToScreen(wx, wy){
    const cam = G.camera;
    if(!cam){ return {x:wx, y:wy}; }
    const left = cam.cx - cam.viewW/2;
    const top  = cam.cy - cam.viewH/2;
    const sx = (wx - left) * cam.scale;
    const sy = (wy - top ) * cam.scale;
    return {x:sx, y:sy};
  }

  function addEffect(obj){ effects.push(obj); }

  // Big golden text in center-top
  function bigText(str, dur=1600){
    const start = performance.now();
    addEffect({ type:'bigtext', text:str, start, dur });
  }

  // ---------------------------------------------------
  // Specific treasure effect generators
  // ---------------------------------------------------
  function effectTaijitu(){
    // Screen flashes black then white, then back to normal (yin-yang switch)
    const dur = 900;
    const start = performance.now();
    addEffect({ type:'flashbw', start, dur });
    bigText('乾坤翻动·阴阳逆转');
  }

  function effectKunsian(){
    // Rope particles
    const ropeCount = 6;
    const start = performance.now();
    const dur = 600;
    const ropes = [];
    for(let i=0;i<ropeCount;i++){
      const ang = Math.PI*2 * i/ropeCount;
      ropes.push({ ang });
    }
    addEffect({ type:'rope', start, dur, ropes });
    bigText('捆仙绳·乾坤锁');
  }

  function effectHulu(){
    // Swallowing vortex that implodes into player center
    const start = performance.now();
    const dur = 1000;
    addEffect({ type:'swallow', start, dur, rot:0 });
    bigText('紫金葫芦·吞纳万物');
  }

  function effectBagua(){
    const start = performance.now();
    const dur = 900;
    addEffect({ type:'ring', start, dur });
    bigText('八卦显形');
  }

  // 新增：世界坐标锚定的圆形填充阴影（解耦于 BossSkillVFX）
  function spawnWorldCircle(wx, wy, rWorld, color='rgba(255,40,40,0.35)', dur=2000){
    const start = performance.now();
    addEffect({ type:'worldCircle', start, dur, x: wx, y: wy, r: rWorld, color });
  }

  // ---------------------------------------------------
  // Drawing each effect per frame
  // ---------------------------------------------------
  function drawEffects(){
    const now = performance.now();
    octx.clearRect(0,0,overlay.width, overlay.height);

    for(let i=effects.length-1;i>=0;i--){
      const ef = effects[i];
      const t = (now - ef.start) / ef.dur;
      if(t>=1){ effects.splice(i,1); continue; }
      switch(ef.type){
        case 'bigtext':{
          const alpha = 1 - t;
          octx.save();
          octx.globalAlpha = alpha;
          octx.fillStyle = '#ffd700';
          octx.font = 'bold 64px KaiTi,serif';
          octx.textAlign = 'center';
          octx.textBaseline = 'middle';
          const cx = overlay.width/2;
          const cy = overlay.height*0.25;
          octx.fillText(ef.text, cx, cy);
          octx.restore();
          break;}
        case 'invert':{
          const a = t<0.5 ? 1 : 1 - (t-0.5)*2; // fade out second half
          octx.save();
          octx.globalAlpha = a;
          octx.globalCompositeOperation = 'difference';
          octx.fillStyle = '#ffffff';
          octx.fillRect(0,0,overlay.width, overlay.height);
          octx.restore();
          break;}
        case 'flashbw':{
          // First third: fade in black, second third: fade to white, last third: fade out
          let alpha=0, col='#000';
          if(t<0.33){
            alpha = t/0.33;
            col = '#000000';
          }else if(t<0.66){
            alpha = (t-0.33)/0.33;
            col = '#ffffff';
          }else{
            alpha = (1 - t)/0.34;
            col = '#ffffff';
          }
          octx.save();
          octx.globalAlpha = Math.min(1,alpha);
          octx.fillStyle = col;
          octx.fillRect(0,0,overlay.width, overlay.height);
          octx.restore();
          break;}
        case 'swallow':{
          const center = worldToScreen(G.player.x, G.player.y);
          const maxR = Math.hypot(overlay.width, overlay.height)*0.5;
          const r = maxR * (1 - t); // shrink
          ef.rot += 0.25;
          octx.save();
          octx.translate(center.x, center.y);
          octx.rotate(ef.rot);
          // draw spiral lines
          octx.strokeStyle = `rgba(253,223,128,${1 - t})`;
          octx.lineWidth = 5;
          for(let i=0;i<6;i++){
            const angle = i*Math.PI/3 + ef.rot;
            const x = Math.cos(angle)*r;
            const y = Math.sin(angle)*r;
            octx.beginPath();
            octx.moveTo(0,0);
            octx.lineTo(x,y);
            octx.stroke();
          }
          // radial fade circle
          const grd = octx.createRadialGradient(0,0, r*0.1, 0,0, r);
          grd.addColorStop(0,'rgba(253,223,128,'+(1-t)+')');
          grd.addColorStop(1,'rgba(253,223,128,0)');
          octx.fillStyle = grd;
          octx.beginPath();
          octx.arc(0,0,r,0,Math.PI*2);
          octx.fill();
          octx.restore();
          break;}
        case 'vortex':{
          const center = worldToScreen(G.player.x, G.player.y);
          const radius = 20 + 160*t;
          ef.rot += 0.2;
          octx.save();
          octx.translate(center.x, center.y);
          octx.rotate(ef.rot);
          const grd = octx.createRadialGradient(0,0, radius*0.1, 0,0, radius);
          grd.addColorStop(0,'rgba(253,223,128,'+(1-t)+')');
          grd.addColorStop(1,'rgba(253,223,128,0)');
          octx.fillStyle = grd;
          octx.beginPath();
          octx.arc(0,0,radius,0,Math.PI*2);
          octx.fill();
          octx.restore();
          break;}
        case 'ring':{
          const center = worldToScreen(G.player.x, G.player.y);
          const rMax = Math.hypot(G.camera.viewW,G.camera.viewH);
          const r = rMax * t;
          octx.save();
          octx.strokeStyle = 'rgba(255,255,255,'+(1-t)+')';
          octx.lineWidth = 6;
          octx.beginPath();
          octx.arc(center.x, center.y, r, 0, Math.PI*2);
          octx.stroke();
          octx.restore();
          break;}
        // 新增：绘制世界坐标圆形填充阴影
        case 'worldCircle':{
          const center = worldToScreen(ef.x, ef.y);
          const scale = (G.camera?.scale||1);
          const sr = ef.r * scale; // 将世界半径转换为屏幕半径
          octx.save();
          octx.globalAlpha = Math.max(0, 1 - t); // 随时间淡出
          // 使用径向渐变增强阴影质感
          const grd = octx.createRadialGradient(center.x, center.y, sr*0.1, center.x, center.y, sr);
          grd.addColorStop(0, ef.color);
          grd.addColorStop(1, 'rgba(255,40,40,0)');
          octx.fillStyle = grd;
          octx.beginPath();
          octx.arc(center.x, center.y, sr, 0, Math.PI*2);
          octx.fill();
          octx.restore();
          break;}
        case 'rope':{
          // 绘制六根金色锁链从屏幕四周快速收束至玩家
          const center = worldToScreen(G.player.x, G.player.y);
          const maxLen = Math.max(overlay.width, overlay.height);
          const len = maxLen * (1 - t*0.8); // 逐渐收缩
          octx.save();
          octx.lineWidth = 4;
          octx.lineCap = 'round';
          ef.ropes.forEach(rp=>{
            const ang = rp.ang;
            const ex = center.x + Math.cos(ang)*len;
            const ey = center.y + Math.sin(ang)*len;
            octx.strokeStyle = `rgba(255,215,0,${1-t})`;
            octx.beginPath();
            octx.moveTo(ex, ey);
            octx.lineTo(center.x, center.y);
            octx.stroke();
          });
          octx.restore();
          break;}
        default:{
          // 未实现的特效类型，避免静默失败
          console.warn('[TreasureFX] 未识别的特效类型:', ef.type);
          effects.splice(i,1);
          break;}
      }
    }
    requestAnimationFrame(drawEffects);
  }
  requestAnimationFrame(drawEffects);

  // ---------------------------------------------------
  // Public API
  // ---------------------------------------------------
  window.TreasureFX = {
    trigger(id){
      switch(id){
        case 'taijitu': effectTaijitu(); break;
        case 'kunsiansheng': effectKunsian(); break;
        case 'zijinhulu': effectHulu(); break;
        case 'baguajing': effectBagua(); break;
        default: bigText(`已使用 ${id}`); break;
      }
    },
    spawnSparks: G.spawnSparks,
    bigText,
    // 新增：公开世界圆形阴影 API
    spawnWorldCircle
  };
})();