// boss_niumo_skills.js - 牛魔王技能（<=500行）
(function(){
  const G = window.Game; if(!G || !window.BossSkillSystem){ console.error('[NiuMoSkills] prerequisites missing'); return; }
  const { SkillLib, SkillSets } = window.BossSkillSystem;
  const VFX = window.BossSkillVFX; const { player, enemies } = G;

  SkillLib.magmaQuake = {
    duration:3000,
    cast(boss){ const st={ r:60, growRate:60, end:performance.now()+3000, nextDestroy:0 }; boss._magma=st; st.ringRef=VFX.spawnMagmaRing(boss.x,boss.y,st.r,null,3000,st.growRate); G.spawnFloatText?.('熔岩震地', boss.x, boss.y-24, 'ft-boss-red'); },
    update(dt,boss){ const st=boss._magma; if(!st) return; const now=performance.now(); const rc=st.ringRef? st.ringRef.r : st.r; const d=Math.hypot(player.x-boss.x, player.y-boss.y); if(Math.abs(d-rc)<10){ if(now>=st.nextDestroy){ const picks=(player.weapons||[]).filter(w=>w && w.alive!==false); if(picks.length){ const w=picks[Math.floor(Math.random()*picks.length)]; G.markWeaponDestroyed?G.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }):(w.alive=false); } st.nextDestroy=now+200; } } VFX.update(dt); if(now>=st.end){ boss._magma=null; } }
  };

  SkillLib.flameStorm = {
    duration:5000,
    cast(boss){
      const fixedCount = 12; // 固定数量
      const storm=[]; const baseR = (boss.radius||20) + 46;
      for(let i=0;i<fixedCount;i++){
        const ang = (i/fixedCount)*Math.PI*2;
        const wx = boss.x + Math.cos(ang)*baseR;
        const wy = boss.y + Math.sin(ang)*baseR;
        storm.push({ x:wx, y:wy, r:12, ang, speed:2.8, boss, len:baseR*3, thick:10 });
      }
      boss._flameStorm={ storm, end:performance.now()+5000 };
      boss._flameVfxRef = VFX.spawnFlameStorm(boss.x,boss.y,storm,boss);
      G.spawnFloatText?.('火焰风暴', boss.x, boss.y-24, 'ft-boss-red');
    },
    update(dt,boss){ const fs=boss._flameStorm; if(!fs) return; const now=performance.now();
      if(now>=fs.end){ boss._flameStorm=null; if(boss._flameVfxRef){ boss._flameVfxRef.life = 0; boss._flameVfxRef = null; } boss._noPlayerKillUntil = performance.now()+250; const r = (fs.storm && fs.storm[0]? (fs.storm[0].len||180) : 180); window.TreasureFX?.spawnWorldCircle?.(boss.x, boss.y, r, 'rgba(255,40,40,0.35)', 2000); return; }
      const active = !!(boss._flameVfxRef && boss._flameVfxRef.life>0);
      if(!active){ boss._flameStorm=null; boss._noPlayerKillUntil = performance.now()+250; const r = (fs.storm && fs.storm[0]? (fs.storm[0].len||180) : 180); window.TreasureFX?.spawnWorldCircle?.(boss.x, boss.y, r, 'rgba(255,40,40,0.35)', 2000); return; }
      const spin=2.2*dt/1000*Math.PI; for(const s of fs.storm){ s.ang+=spin; const dist=s.len||180; s.x=boss.x+Math.cos(s.ang)*dist; s.y=boss.y+Math.sin(s.ang)*dist; const x1=boss.x,y1=boss.y,x2=s.x,y2=s.y; const vx=x2-x1,vy=y2-y1; const l2=vx*vx+vy*vy||1; let t=((player.x-x1)*vx+(player.y-y1)*vy)/l2; t=Math.max(0,Math.min(1,t)); const cx=x1+t*vx, cy=y1+t*vy; const dSeg=Math.hypot(player.x-cx, player.y-cy);
        if(dSeg<((s.thick||10)+player.radius*0.5) && active && !(boss._noPlayerKillUntil && performance.now() < boss._noPlayerKillUntil)){
          player.health=0; if(window.Game.showGameOver) window.Game.showGameOver(); return;
        }
      }
      VFX.update(dt);
    }
  };

  SkillLib.bullRush = {
    duration:1200,
    cast(boss){
      const now=performance.now();
      const dx=player.x-boss.x, dy=player.y-boss.y;
      const len=Math.hypot(dx,dy)||1;
      const nx = dx/len, ny = dy/len;
      const end=now+1200;
      const passDist = (player.radius||24) + 80; // 越过玩家的额外距离
      boss._rush={ vx:nx*320, vy:ny*320, nx, ny, passDist, end };
      boss._ghostRush = true; // 冲撞期间禁用碰撞体积
      boss._invUntil = end + 200; // 冲撞期间无敌至结束稍后
      boss._noPlayerKillUntil = end + 200; // 免被玩家武器击杀
      boss._hideWeaponsUntil = end; boss._hideWeapons = true; // 隐藏身上武器
      VFX.spawnRushTrail(boss);
      G.spawnFloatText?.('蛮牛冲撞', boss.x, boss.y-24, 'ft-boss-red');
    },
    update(dt,boss){ const r=boss._rush; if(!r) return; // 位移推进
      boss.x += r.vx * dt/1000; boss.y += r.vy * dt/1000;
      // 判断是否越过玩家一定距离：boss 相对玩家在冲撞方向上的投影超过 passDist
      const relX = boss.x - player.x, relY = boss.y - player.y; const proj = relX*r.nx + relY*r.ny; const now=performance.now(); const shouldStop = (proj >= r.passDist) || (now >= (r.end||0)) || (dt<=0);
      if(!shouldStop){ return; }
      // 结束冲撞：摧毁玩家武器、红光闪烁、恢复展示并生成环绕武器
      boss._hideWeapons = false; boss._hideWeaponsUntil = 0; boss._ghostRush = false; boss._rush = null;
      // 玩家装备武器全部破坏
      for(const w of (player.weapons||[])){ if(!w) continue; if(w.alive!==false){ window.Game.markWeaponDestroyed ? window.Game.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }) : (w.alive=false); } }
      // 红光特效与提示
      window.TreasureFX?.spawnWorldCircle?.(boss.x, boss.y, (boss.radius||24)+120, 'rgba(255,40,40,0.45)', 1600);
      G.spawnFloatText?.('怒火环绕', boss.x, boss.y-26, 'ft-boss-red');
      // 在玩家身后稍远处生成环绕武器
      const nx2 = r.nx, ny2 = r.ny; boss.x = player.x + nx2 * ((player.radius||24) + 40); boss.y = player.y + ny2 * ((player.radius||24) + 40);
      for(let i=0;i<50;i++){ const w = G.createWeapon ? G.createWeapon(4) : {id:Math.random().toString(36).slice(2), quality:4, angle:0, radius:10, damage:30, knockback:100, alive:true, skin:'weapon_sword'}; boss.weapons.push(w); }
      // 统一半径与环绕分配
      for(const w of boss.weapons){ if(!w || w.alive===false) continue; w.radius = (boss.role==='boss' ? 22 : 8) + (w.quality||0) * (boss.role==='boss' ? 6 : 3); }
      window.Game.setEnemyWeaponsQuality?.(boss, 4);
      window.OrbitFX?.spawnOrbitRing?.(boss, { count: 50, radius: (boss.radius||24)+26, itemRadius: 12, spinSpeed: (G.SPIN_SPEED_TIERS?.mid||0), life: 6000 });
    }
  };

  SkillSets['boss_niumo'] = ['magmaQuake','flameStorm','bullRush'];
})();