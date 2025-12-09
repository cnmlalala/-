// boss_longwang_skills.js - 龙王技能（<=500行）
(function(){
  const G = window.Game; if(!G || !window.BossSkillSystem){ console.error('[LongWangSkills] prerequisites missing'); return; }
  const { SkillLib, SkillSets } = window.BossSkillSystem;
  const { player, enemies } = G;
  function viewRect(){ const c=G.camera; const left=c.cx - c.viewW/2, top=c.cy - c.viewH/2; return { left, top, right:left+c.viewW, bottom:top+c.viewH, width:c.viewW, height:c.viewH }; }
  function qualityColor(q){ const arr=(G.QUALITY||[]); const obj=arr[q]||{}; return obj.spark||obj.color||'rgba(120,180,255,0.9)'; }

  // 保留：潮汐波动
  SkillLib.tidePulse = {
    duration:6000,
    cast(boss){ const now=performance.now(); const ringColor='rgba(120, 215, 255, 0.55)';
      boss._tidePulse = { end: now+6000, nextAt: now + 420, interval: 420, r0: 36, spacing: 34, grow: 220, life: 1800, color: ringColor, rings: [] };
      const r0=boss._tidePulse.r0, spacing=boss._tidePulse.spacing, life=boss._tidePulse.life, grow=boss._tidePulse.grow, color=boss._tidePulse.color;
      const r1=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0, color, life, grow);
      const r2=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0+spacing, color, life, grow);
      const r3=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0+spacing*2, color, life, grow);
      boss._tidePulse.rings.push(r1, r2, r3);
      G.spawnFloatText?.('潮汐波动', boss.x, boss.y-24, 'ft-boss-blue');
    },
    update(dt,boss){ const st=boss._tidePulse; if(!st) return; const now=performance.now();
      // 周期性生成新一组三圈蓝色扩散环
      if(now >= st.nextAt){ st.nextAt = now + st.interval; const r0=st.r0, spacing=st.spacing, life=st.life, grow=st.grow, color=st.color; const r1=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0, color, life, grow); const r2=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0+spacing, color, life, grow); const r3=window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, r0+spacing*2, color, life, grow); st.rings.push(r1,r2,r3); }
      // 推动力：近环边时对玩家施加径向外推
      const band=18, push=210; const dx=player.x-boss.x, dy=player.y-boss.y; const dist=Math.hypot(dx,dy)||1; const nx=dx/dist, ny=dy/dist;
      st.rings = (st.rings||[]).filter(r=>r && r.life>0);
      for(const r of st.rings){ const rc=r.r||st.r0; if(Math.abs(dist - rc) <= band){ const imp = push * dt/1000; player.vx += nx * imp; player.vy += ny * imp; player.x += nx * imp; player.y += ny * imp; } }
      window.BossSkillVFX?.update?.(dt);
      if(now>=st.end){ boss._tidePulse=null; }
    }
  };

  // 大海水：从屏幕一侧出现并贯穿至另一侧的蓝色柱子特效（屏幕锚定，固定宽度，入场/出场动画）
  SkillLib.seaDivide = {
    duration:11000,
    cast(boss){
      const c = G.camera; const W=c.viewW, H=c.viewH;
      // 横向扫屏，从右向左推进；正交轴中心以玩家当前 y 为世界锚点
      const axis = 'x';
      const dir = -1; // 从右往左
      const labelText = '天河断流·瀚海倾覆';
      window.BossSkillVFX?.spawnScreenSweep?.({ owner: boss, axis, dir, thick: 96, color: 'rgba(80,150,255,0.78)', blur: 8, speed: 520, life: this.duration, mode: 'extend', labelText, labelColor: 'rgba(220,240,255,0.98)', labelFont: 'bold 26px KaiTi, serif', centerWorldCoord: (G.player?.y!=null?G.player.y:boss.y), startWorldPos: (G.world?.width||0) });
      boss._seaDivide = { end: performance.now()+this.duration };
      G.spawnFloatText?.('大海水', boss.x, boss.y-24, 'ft-boss-blue');
    },
    update(dt,boss){
      const st=boss._seaDivide; if(!st) return;
      const vfx = window.BossSkillVFX; const sweeps = vfx?.sweeps || []; const s = sweeps.find(s=>s.owner===boss && (s.axis||'x')==='x'); if(!s) return;
      const hw = (s.thick||96)*0.5;
      const x0 = (s.startWorldPos!=null) ? s.startWorldPos : (window.Game.world?.width||0);
      const x1 = (s.worldPos!=null) ? s.worldPos : x0;
      const minX = Math.min(x0,x1), maxX = Math.max(x0,x1);
      const cy = (s.centerWorldCoord!=null) ? s.centerWorldCoord : (window.Game.player?.y||boss.y||0);
      // 仅销毁玩家（角色）武器
      for(const w of player.weapons||[]){ if(!w||w.alive===false) continue; const ang=(w.angle||0)+(player.weaponSpin||0); const dist=player.radius+(w.radius||10)+6; const wx=player.x+Math.cos(ang)*dist; const wy=player.y+Math.sin(ang)*dist; const wr=(w.radius||10)*0.5;
        if(wx >= minX - wr && wx <= maxX + wr && Math.abs(wy - cy) <= hw + wr){ G.markWeaponDestroyed?G.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }):(w.alive=false); }
      }
      if(performance.now()>=st.end){ vfx?.removeSweepsByOwner?.(boss); boss._seaDivide=null; }
    }
  };

  // 水龙卷：吸收当前屏幕范围内的“武器掉落物”（pickups）并储存到队列
  SkillLib.waterTornadoStore = {
    duration:4500,
    cast(boss){ const v=viewRect(); const picks=G.pickups||[]; if(!boss._storedQueue) boss._storedQueue=[]; const now=performance.now();
      // 收缩的蓝色圆圈特效（较大的范围）：三圈同时收缩（略大于屏幕）
      const baseR = Math.max(v.width, v.height) * 0.95; const life=1800; const shrink=-280; const spacing=42; const ringColor='rgba(90,170,255,0.85)';
      window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, baseR, ringColor, life, shrink);
      window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, baseR - spacing, ringColor, life, shrink);
      window.BossSkillVFX?.spawnMagmaRing?.(boss.x, boss.y, Math.max(30, baseR - spacing*2), ringColor, life, shrink);
      // 标记屏幕略大范围内拾取物为“飞向龙王”，靠近后消失；同时把品质入队用于后续释放
      const absorbMargin = Math.max(v.width, v.height) * 0.12; let absorbed=0;
      for(const p of picks){ if(!p) continue; if(p.x > v.left - absorbMargin && p.x < v.right + absorbMargin && p.y > v.top - absorbMargin && p.y < v.bottom + absorbMargin){ p.absBoss = { boss, speed: 900 }; const cnt = p.count || 1; for(let c=0;c<cnt;c++){ boss._storedQueue.push({ q:p.q }); } absorbed += (p.count || 1); G.spawnSparks?.(p.x, p.y, ringColor, 10); } }
      G.spawnFloatText?.(`水龙卷(吸收x${absorbed})`, boss.x, boss.y-24, 'ft-boss-blue');
      boss._waterStoreEnd = now + life;
    },
    update(dt,boss){ const picks=G.pickups||[]; const b=boss; const basePull=900;
      // 驱动屏幕（含边界略外）被标记的拾取物飞向龙王，近身后消失
      for(let i=picks.length-1;i>=0;i--){ const p=picks[i]; if(!p || !p.absBoss || p.absBoss.boss!==b) continue; const dx=b.x - p.x, dy=b.y - p.y; const dist=Math.hypot(dx,dy)||0.01; const pull=p.absBoss.speed||basePull; const vx=dx/dist*pull, vy=dy/dist*pull; p.x += vx*dt/1000; p.y += vy*dt/1000; if(dist < (b.radius||24) + (p.r||18)){ G.spawnSparks?.(p.x, p.y, 'rgba(90,170,255,0.9)', 12); picks.splice(i,1); } }
      window.BossSkillVFX?.update?.(dt);
      if(performance.now()>= (boss._waterStoreEnd||0)){ boss._waterStoreEnd=0; }
    }
  };

  // 暴雨梨花：沿玩家方向直线分批释放已吸收的武器，遵循高品质摧毁低品质的设定
  SkillLib.rainStormRelease = {
    duration:6000,
    cast(boss){ const q=boss._storedQueue||[]; if(!q || q.length===0){ G.spawnFloatText?.('暴雨梨花(无弹)', boss.x, boss.y-24, 'ft-boss-blue'); return; } const dx=(player.x-boss.x), dy=(player.y-boss.y); const d=Math.hypot(dx,dy)||1; const nx=dx/d, ny=dy/d; boss._release={ dir:{nx,ny}, nextAt:performance.now(), interval:400, batch:8, shots:[], end:performance.now()+6000 }; G.spawnFloatText?.('暴雨梨花', boss.x, boss.y-24, 'ft-boss-blue'); },
    update(dt,boss){ const st=boss._release; if(!st) return; const now=performance.now(); const queue=boss._storedQueue||[];
      // 批次生成：更短更窄的胶囊形投射物
      if(now>=st.nextAt && queue.length>0){ const n=Math.min(st.batch, queue.length); const shots=[]; for(let i=0;i<n;i++){ const itm=queue.shift(); const color=qualityColor(itm.q); const speed=380; const vx=st.dir.nx*speed, vy=st.dir.ny*speed; shots.push({ x:boss.x, y:boss.y, vx, vy, speed, q:itm.q, color, life:2500, len:40, thick:5, dist:0, maxDist:800 }); } window.BossSkillVFX?.spawnPetalShots?.(shots); st.shots.push(...shots); st.nextAt = now + st.interval; }
      // 行进、距离消失与碰撞判定（对玩家本体秒杀；对玩家武器产生偏转并按品质影响玩家武器）
      for(const s of st.shots){ s.x += s.vx*dt/1000; s.y += s.vy*dt/1000; s.life -= dt; s.dist += (s.speed||Math.hypot(s.vx,s.vy)) * dt/1000; if(s.life<=0) { s.life=0; continue; }
        // 达到最大射程：还原为拾取物
        if(s.dist >= (s.maxDist||800)){ const pick = { x: s.x, y: s.y, r: 18, q: s.q, count: 1 }; (G.pickups = G.pickups || []).push(pick); s.life=0; continue; }
        const sp=Math.hypot(s.vx||0, s.vy||0)||1; const ux=(s.vx||0)/sp, uy=(s.vy||0)/sp; const half=(s.len||40)/2; const rad=(s.thick||5)/2;
        // 玩家击杀判定（胶囊最近点到玩家距离）
        { let t=((player.x - s.x)*ux + (player.y - s.y)*uy); t=Math.max(-half, Math.min(half, t)); const cx=s.x + ux*t, cy=s.y + uy*t; const dp=Math.hypot(player.x - cx, player.y - cy); if(!(s._noPlayerHitUntil && now < s._noPlayerHitUntil) && dp <= player.radius + rad){ player.health = 0; if(window.Game && window.Game.showGameOver) window.Game.showGameOver(); s.life=0; continue; } }
        // 玩家武器拦截：偏转 + 品质影响（低于投射品质则玩家武器摧毁；同/高品质无影响）
        for(const w of player.weapons||[]){ if(!w||w.alive===false) continue; const ang=(w.angle||0)+(player.weaponSpin||0); const dist=player.radius+(w.radius||10)+6; const wx=player.x+Math.cos(ang)*dist, wy=player.y+Math.sin(ang)*dist; let tw=((wx - s.x)*ux + (wy - s.y)*uy); tw=Math.max(-half, Math.min(half, tw)); const cwx=s.x + ux*tw, cwy=s.y + uy*tw; const dd=Math.hypot(wx - cwx, wy - cwy);
          if(dd < rad + 6){ // 发生接触 -> 偏转
            // 碰撞法线（指向武器的方向），做速度反射
            let nx = (wx - cwx), ny = (wy - cwy); const nl = Math.hypot(nx, ny) || 1; nx/=nl; ny/=nl; const dot = s.vx*nx + s.vy*ny; let rvx = s.vx - 2*dot*nx, rvy = s.vy - 2*dot*ny; const newSp = Math.hypot(rvx, rvy) || sp; rvx = rvx / newSp * sp; rvy = rvy / newSp * sp;
            // 方向优化：反弹后若仍朝向玩家，则改为沿玩家方向的切线运动，避免继续接触玩家
            const dpx = player.x - s.x, dpy = player.y - s.y; const dplen = Math.hypot(dpx, dpy) || 1; const pnx = dpx / dplen, pny = dpy / dplen; if(rvx*pnx + rvy*pny > 0){ // 指向玩家
              const tx = -pny, ty = pnx; // 与玩家方向垂直的单位向量
              const dotT = rvx*tx + rvy*ty; const useSign = (dotT >= 0) ? 1 : -1; rvx = tx * useSign * sp; rvy = ty * useSign * sp;
            }
            s.vx = rvx; s.vy = rvy; s.sinceBounce = 0; s._noPlayerHitUntil = now + 180; // 反弹后短暂无效玩家碰撞，避免同帧误杀
            // 分离以避免同一帧重复碰撞（同时沿远离玩家方向再分离一次，确保不重叠）
            s.x += nx * (rad + 4); s.y += ny * (rad + 4);
            s.x -= pnx * (rad + 6); s.y -= pny * (rad + 6);
            // 品质影响：低于投射品质则摧毁该玩家武器；高于投射品质则摧毁投射物；同品质无影响
            const wq = (w.quality||0), sq = (s.q||0);
            if(wq < sq){ window.Game && window.Game.markWeaponDestroyed ? window.Game.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }) : (w.alive=false); }
            else if(wq > sq){ s.life = 0; }
            // 偏转后结束本次碰撞处理，避免一帧多次偏转
            break;
          }
        }
      }
      st.shots = st.shots.filter(x=>x.life>0);
      window.BossSkillVFX?.update?.(dt);
      if(now>=st.end && queue.length===0 && st.shots.length===0){ boss._release=null; }
    }
  };

  // 注册龙王技能顺序：保留潮汐波动 + 新三技能
  SkillSets['boss_longwang'] = ['tidePulse','seaDivide','waterTornadoStore','rainStormRelease'];
})();