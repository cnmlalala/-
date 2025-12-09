// boss_tiandi_skills.js - 天帝技能（<=500行）
(function(){
  const G = window.Game; if(!G || !window.BossSkillSystem){ console.error('[TianDiSkills] prerequisites missing'); return; }
  const { SkillLib, SkillSets } = window.BossSkillSystem;
  const VFX = window.BossSkillVFX; const { player, enemies } = G;
  // 视口工具
  function viewRect(){ const c=G.camera; const left=c.cx - c.viewW/2, top=c.cy - c.viewH/2; return { left, top, right:left+c.viewW, bottom:top+c.viewH, width:c.viewW, height:c.viewH }; }

  // 天罚雷击：玩家脚下红圈，50% 透明，基础3s；每0.2s随机摧毁一把武器；玩家每持有红/金/七彩武器，持续+0.1s；闪电为金色
  SkillLib.thunderSmite = {
    duration: 3000,
    cast(boss){
      const redRingColor = 'rgba(255,60,60,0.5)';
      const baseDuration = 3000 + 1000; // 延长1s
      let bonus = 0;
      for(const w of (player.weapons||[])){
        if(!w || w.alive===false) continue;
        const q = w.quality||0; if(q===5 || q===6 || q===7) bonus += 100; // 红、金、七彩各+0.1s
      }
      const totalDuration = baseDuration + bonus;
      SkillLib.thunderSmite.duration = totalDuration;
      const now = performance.now();
      const r = Math.max(80, Math.min(viewRect().width, viewRect().height)*0.18);
      boss._thunderSmite = { cx: player.x, cy: player.y, r, nextAt: now + 200, end: now + totalDuration };
      VFX.spawnAuraRing(player.x, player.y, r, redRingColor, totalDuration);
      VFX.spawnLabel?.(player.x, player.y-28, '天罚雷击');
      // 技能提示（浮字）
      window.Game?.spawnFloatText?.('天罚雷击', boss.x, boss.y-24, 'ft-boss-gold');
      const strikes = [];
      const beams = 6;
      for(let i=0;i<beams;i++){
        const ang = (Math.PI*2) * (i/beams);
        const len = 80;
        strikes.push({ x: player.x + Math.cos(ang)*12, y: player.y + Math.sin(ang)*12, color: 'rgba(255,230,120,0.98)', thick: 4, blur: 1.5, len, sky: true });
      }
      VFX.spawnLightning(strikes, Math.min(1600, totalDuration));
    },
    update(dt,boss){ const st=boss._thunderSmite; if(!st) return; const now=performance.now();
      if(now >= st.nextAt){
        st.nextAt = now + 200;
        // 仅当玩家仍处于红圈范围内时生效
        const dx = player.x - st.cx, dy = player.y - st.cy;
        if(Math.hypot(dx, dy) <= st.r){
          const ws=(player.weapons||[]).filter(w=>w && w.alive!==false);
          const candidates = ws.map(w=>({ w, owner: player }));
          if(candidates.length>0){
            const pick = candidates[Math.floor(Math.random()*candidates.length)];
            if(G.markWeaponDestroyed) G.markWeaponDestroyed(pick.w, { killer:'npcSkill', victimOwner:'player' }); else pick.w.alive=false;
            if(pick.owner===player){ const last = player._lastBrokenHintAt||0; if(now - last > 600){ G.spawnFloatText && G.spawnFloatText('武器破损', player.x, player.y-24, 'ft-boss-red'); player._lastBrokenHintAt = now; } }
          }
        }
      }
      VFX.update(dt);
      if(now >= st.end){ boss._thunderSmite = null; }
    }
  };

  // 神域禁制：玩家武器攻击到天帝或其环绕武器品质每次下降一级；白色无法击杀天帝会直接损毁。解耦旋转：不依赖 weaponSpin 特性。
  SkillLib.divineSanction = {
    duration: 6000,
    cast(boss){ const r=160; const now=performance.now(); boss._sanction={ r, end:now+6000, _lastPulse: now }; VFX.spawnAuraRing(boss.x,boss.y,r,'rgba(255,220,120,0.6)', 1800); VFX.spawnLabel?.(boss.x, boss.y-24, '神域禁制');
      // 技能提示（浮字）
      window.Game?.spawnFloatText?.('神域禁制', boss.x, boss.y-24, 'ft-boss-gold'); },
    update(dt,boss){ const st=boss._sanction; if(!st) return; const r=st.r; const now=performance.now();
      // 周期性淡黄色光环脉冲，显示生效区域
      if(now - (st._lastPulse||0) >= 600){ VFX.spawnAuraRing(boss.x,boss.y,r,'rgba(255,220,120,0.35)', 1200); st._lastPulse = now; }
      // 检测玩家与 NPC 武器的世界坐标并判定是否与天帝本体或其武器相交
      const actors=[player, ...(G.enemies||[])];
      const bossWeapons = boss.weapons||[];
      for(const a of actors){ for(const w of a.weapons||[]){ if(!w || w.alive===false) continue; const ang=(w.angle||0)+(a.weaponSpin||0); const dist=a.radius+(w.radius||10)+6; const wx=a.x+Math.cos(ang)*dist, wy=a.y+Math.sin(ang)*dist;
          let hitBoss = Math.hypot(wx-boss.x, wy-boss.y) <= r;
          if(!hitBoss){ for(const bw of bossWeapons){ if(!bw || bw.alive===false) continue; const bang=(bw.angle||0)+(boss.weaponSpin||0); const bdist=boss.radius+(bw.radius||10)+6; const bx=boss.x+Math.cos(bang)*bdist, by=boss.y+Math.sin(bang)*bdist; if(Math.hypot(wx-bx, wy-by) <= Math.max(16, (w.radius||10)+6)) { hitBoss = true; break; } }
          }
          if(hitBoss){ const q=w.quality||0; if(q<=0){ if(G.markWeaponDestroyed) G.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }); else w.alive=false; if(a===player){ const now2=performance.now(); if(!player._lastBrokenHintAt || now2 - player._lastBrokenHintAt > 800){ G.spawnFloatText && G.spawnFloatText('武器破损', player.x, player.y-24, 'ft-boss-red'); player._lastBrokenHintAt = now2; } } }
            else { w.quality = Math.max(0, q-1); if(a===player){ G.spawnFloatText && G.spawnFloatText('武器品质下降', player.x, player.y-24, 'ft-boss-gold'); } }
          }
        }
      }
      VFX.update(dt);
      if(performance.now()>=st.end){ boss._sanction=null; }
    }
  };

  // 武器天平：释放时在天帝位置显示天平图片，随后淡出并转为金光，全图淡金覆盖闪光后消失（纯视觉，全图范围）
  SkillLib.balanceScale = {
    duration: 1600+1000, // 延长1s
    cast(boss){
      const now = performance.now();
      boss._balanceScale = { end: now + (SkillLib.balanceScale.duration||2600) };
      // 计算半屏尺寸：取相机视口短边的一半（世界单位），确保在屏幕上显示为半屏大小
      const cam = G.camera || {};
      const halfScreen = Math.min(cam.viewW || 800, cam.viewH || 600) * 0.5;
      // 延长图片与金光寿命，确保可见
      VFX.spawnImageBurst(boss.x, boss.y, { imgKey: 'skill_balance_scale', size: halfScreen, life: 2400, glowLife: 2600, glowColor: 'rgba(255,220,120,0.92)', blur: 12, coverScreen: true });
      VFX.spawnLabel?.(boss.x, boss.y - 52, '众生平等', { font: 'bold 36px KaiTi, serif', fillColor: 'rgba(255,220,120,0.98)', strokeColor: 'rgba(255,255,255,0.98)', align: 'center', life: 2600 });
      // 技能提示（浮字）
      window.Game?.spawnFloatText?.('众生平等', boss.x, boss.y-24, 'ft-boss-gold');
    },
    update(dt,boss){ const st=boss._balanceScale; if(!st) return; VFX.update(dt); if(performance.now()>=st.end){ boss._balanceScale=null; } }
  };

  // 注册天帝技能顺序：包含武器天平、天罚雷击、神域禁制
  SkillSets['boss_tiandi'] = ['balanceScale','thunderSmite','divineSanction'];
})();