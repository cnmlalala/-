// 碰撞模块
(function(){
  const { world, player, enemies, clamp, QUALITY } = window.Game;

  function resolveObstacleCollisions(){
    // 角色与障碍
    for(const o of world.obstacles){
      // 玩家简单AABB碰撞分离
      const px = player.x, py = player.y, pr = player.radius;
      if(px+pr>o.x && px-pr<o.x+o.w && py+pr>o.y && py-pr<o.y+o.h){
        const dx1 = (o.x - (px+pr));
        const dx2 = ((o.x+o.w) - (px-pr));
        const dy1 = (o.y - (py+pr));
        const dy2 = ((o.y+o.h) - (py-pr));
        const moveX = Math.abs(dx1)<Math.abs(dx2)?dx1:dx2;
        const moveY = Math.abs(dy1)<Math.abs(dy2)?dy1:dy2;
        if(Math.abs(moveX) < Math.abs(moveY)) player.x += moveX; else player.y += moveY;
      }
      // 敌人AABB分离
      for(const e of enemies){
        if(e && e._ghostRush) continue; // 冲撞期间禁用碰撞体积，避免障碍分离造成卡顿
        const ex=e.x, ey=e.y, er=e.radius; if(ex+er>o.x && ex-er<o.x+o.w && ey+er>o.y && ey-er<o.y+o.h){ const dx1=(o.x - (ex+er)); const dx2=((o.x+o.w) - (ex-er)); const dy1=(o.y - (ey+er)); const dy2=((o.y+o.h) - (ey-er)); const moveX=Math.abs(dx1)<Math.abs(dx2)?dx1:dx2; const moveY=Math.abs(dy1)<Math.abs(dy2)?dy1:dy2; if(Math.abs(moveX)<Math.abs(moveY)) e.x+=moveX; else e.y+=moveY; }
      }
    }
    // 地图边缘限制（灰线外不可过）
    player.x = clamp(player.x, player.radius, world.width - player.radius);
    player.y = clamp(player.y, player.radius, world.height - player.radius);
    for(const e of enemies){ e.x = clamp(e.x, e.radius, world.width - e.radius); e.y = clamp(e.y, e.radius, world.height - e.radius); }
    // 敌人之间避让：不重合（简单双向分离）
    for(let i=0;i<enemies.length;i++){
      for(let j=i+1;j<enemies.length;j++){
        const a=enemies[i], b=enemies[j];
        if((a && a._ghostRush) || (b && b._ghostRush)) continue; // 冲撞期间禁用相互分离
        const dx=b.x-a.x, dy=b.y-a.y; const dist=Math.hypot(dx,dy)||0; const sumR=a.radius+b.radius;
        if(dist>0 && dist<sumR){ const nx=dx/dist, ny=dy/dist; const push=(sumR-dist)/2; a.x-=nx*push; a.y-=ny*push; b.x+=nx*push; b.y+=ny*push; a.x=clamp(a.x,a.radius,world.width-a.radius); a.y=clamp(a.y,a.radius,world.height-a.radius); b.x=clamp(b.x,b.radius,world.width-b.radius); b.y=clamp(b.y,b.radius,world.height-b.radius); }
      }
    }
  }

  function resolveWeaponCollisions(){
    // 处理玩家武器与敌人武器、以及玩家武器对敌人本体的碰撞
    const playerWeapons = [ ...(player.weapons||[]), ...(player.skillWeapons||[]) ];
    const now = performance.now();
    // 玩家武器直接命中敌人本体：造成伤害
    for(let ei = enemies.length-1; ei>=0; ei--){
      const e = enemies[ei];
      if(e && e._ghostRush) continue; // 冲撞期间禁用 Boss 本体命中与击退
      for(const pw of playerWeapons){
        if(!pw.alive) continue;
        // 封印或锁定的武器不参与碰撞/伤害（战技免疫）
        if(!(pw.indestructible===true || pw.bossImmune===true)){
          if((pw._sealedUntil||0) > now) continue;
          if(pw._locked) continue;
        }
        const pang = (pw.angle||0) + (player.weaponSpin||0);
        const pdist = player.radius + (pw.radius||10) + 6;
        const px = player.x + Math.cos(pang)*pdist;
        const py = player.y + Math.sin(pang)*pdist;
        const dx = e.x - px, dy = e.y - py; const rr = e.radius + (8 + (pw.quality||0)*2);
        if(dx*dx + dy*dy <= rr*rr){
          // Boss无敌：在 bullRush 期间 0.5s 不受伤害、不被击杀
          if(e.role==='boss' && (e._invUntil||0) > now){
            continue;
          }
          // 命中，造成伤害并击退敌人（魔刀千刃保持不击退）
          const dmg = pw.damage || (10 + (pw.quality||0)*6);
          e.health = (e.health||0) - dmg;
          // 击退敌人
          if(!pw.isMagicBladeThousand){
            const nd = Math.hypot(dx,dy)||1; const nx = dx/nd, ny = dy/nd;
            e.vx += nx * (pw.knockback || 120);
            e.vy += ny * (pw.knockback || 120);
          }
          if(window.Game.spawnSparks){ window.Game.spawnSparks(px, py, 'rgba(255,200,120,0.8)', 8); }
          if(e.health <= 0){
            // 敌人死亡
            enemies.splice(ei,1);
            if(window.Game){
              window.Game.totalKills = (window.Game.totalKills||0)+1;
              if(typeof window.Game.spawnFloatText === 'function'){
                window.Game.spawnFloatText('+1 击杀', window.Game.player.x, window.Game.player.y - 24);
              }
              if(typeof window.Game.dropWeapons === 'function'){
                window.Game.dropWeapons(e.x, e.y, e.role||'minion');
              }
              if(window.Game.MonsterDialogue){
                window.Game.MonsterDialogue.speakOnDeath(e);
              }
            }
            break; // 当前敌人已被移除
          }
        }
      }
    }

    // 玩家武器与敌人武器的碰撞
    for(const e of enemies){
      if(e && e._ghostRush) continue; // 冲撞期间跳过敌人武器互撞，避免多余推挤
      // 玩家武器 vs 敌人武器需要相互撞击与品质判定；佛陀参与碰撞，但位置计算仍用其独立旋转通道
      const enemyWeapons = e.weapons;
      for (const pw of playerWeapons) {
        if(!pw || !pw.alive) continue;
        // 战技免疫封印与锁定
        if(!(pw.indestructible===true || pw.bossImmune===true)){
          if((pw._sealedUntil||0) > now) continue;
          if(pw._locked) continue;
        }
        const pSpinDir = (pw.spinDir==null?1:pw.spinDir);
        const pSpinMul = (pw.spinMul==null?1:pw.spinMul);
        const pang = (pw.angle||0) + (player.weaponSpin||0) * pSpinDir * pSpinMul;
        const pdist = player.radius + (pw.radius||10) + 6 + (pw.orbitOffset||0);
        const px = player.x + Math.cos(pang)*pdist;
        const py = player.y + Math.sin(pang)*pdist;
        for(const ew of enemyWeapons){
          if(!ew || !ew.alive) continue;
          if((ew._sealedUntil||0) > now) continue;
          if(ew._locked) continue;
          if(e._flameStorm && ew._detached){
            continue;
          }
          const isBuddha = (e && e.role==='boss' && e.skin==='boss_fotuo');
          const baseSpin = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getSpin(e, ew) : (e.weaponSpin||0);
          const eang = (ew.angle||0) + baseSpin;
          const edist = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getDistance(e, ew) : (e.radius + (ew.radius||10) + 6 + (ew.orbitOffset||0));
          const ex = e.x + Math.cos(eang)*edist;
          const ey = e.y + Math.sin(eang)*edist;
          const dx = ex - px, dy = ey - py; const d2 = dx*dx + dy*dy;
          const rr = (8 + (pw.quality||0)*2) + (8 + (ew.quality||0)*2);
          if(d2 <= rr*rr){
            // 计算单位向量（从玩家指向敌人）
            const nd = Math.hypot(dx,dy) || 1;
            const nx = dx / nd, ny = dy / nd;
            const basePush = 260;
            const qp = pw.quality||0;
            const qe = ew.quality||0;
            let pushP, pushE;
            // 魔刀千刃：玩家侧武器触碰到NPC武器，立即摧毁对方且不造成击退
            if(pw.isMagicBladeThousand){
              if(ew.alive!==false){ window.Game.markWeaponDestroyed ? window.Game.markWeaponDestroyed(ew) : (ew.alive=false); }
              if(isBuddha && window.BuddhaNS && typeof window.BuddhaNS.lockWeaponRespawn==='function'){
                window.BuddhaNS.lockWeaponRespawn(e, 6000);
                window.Game.spawnFloatText && window.Game.spawnFloatText('法器崩毁', e.x, e.y-24, 'ft-gold');
              }
              pushP = 0; pushE = 0;
            } else {
              const involvesMoonblade = !!(pw.isMoonBlade || ew.isMoonBlade);
              const diff = qp - qe;
              if(diff >= 0){ pushP = Math.max(0, basePush * 0.35 * (1 + diff*0.3)); pushE = Math.max(0, basePush * 0.85 * (1 + diff*0.2)); }
              else { pushP = Math.max(0, basePush * 0.65 * (1 + (-diff)*0.2)); pushE = Math.max(0, basePush * 0.45 * (1 + (-diff)*0.3)); }
              if(involvesMoonblade){ pushP *= 0.85; pushE *= 0.85; }
              e.vx += nx * pushE; e.vy += ny * pushE;
              player.vx -= nx * pushP; player.vy -= ny * pushP;
              // 劣化判定：若其中一个武器带有 degrade 属性，则另一侧记录被击次数；魔刀千刃跳过该流程
              const applyDegrade = (att, target)=>{
                // 战技不可摧毁/免疫时跳过被击次数与摧毁
                if(target && (target.indestructible===true || target.bossImmune===true)) return;
                if(att && att.degrade && target && !target.degrade){
                  target._degradeHits = (target._degradeHits||0) + 1;
                  if(target._degradeHits >= 2){
                    if(window.Game && window.Game.markWeaponDestroyed){
                      const killer = (att===pw) ? 'playerWeapon' : 'npcWeapon';
                      const victimOwner = (target===pw) ? 'player' : 'npc';
                      window.Game.markWeaponDestroyed(target, { killer, victimOwner });
                    } else { target.alive=false; }
                  }
                }
              };
              applyDegrade(pw, ew);
              applyDegrade(ew, pw);
            }
          }
        }
      }
    }
  }
  // 仅处理敌方内部武器互殴（可选），取消武器与角色本体碰撞
  function resolveWeaponBodyCollisions(){
    // 检测敌方武器与玩家本体碰撞 -> 直接判定死亡
    const showGameOver = window.Game && window.Game.showGameOver;
    const now = performance.now();
    for(const e of enemies){
      if(e && e._ghostRush) continue; // 冲撞期间禁用敌人武器对玩家本体命中
      if(!e || !Array.isArray(e.weapons)) continue;
      for(const w of e.weapons){
        if(!w || !w.alive) continue;
        if((w._sealedUntil||0) > now) continue;
        if(w._locked) continue;
        // 火焰风暴期间的分离长柱由 BossSkillSystem 单独处理秒杀，这里跳过普通圆形命中
        if(e._flameStorm && w._detached){
          continue;
        }
        // 角度计算：佛陀使用独立旋转通道，女仙使用 FairyNS，其他敌人使用通用 weaponSpin
        const isBuddha = (e && e.role==='boss' && e.skin==='boss_fotuo');
        const isFairy = (e && e.role==='boss' && e.skin==='boss_nvXian');
        const baseSpin = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getSpin(e, w) : (window.FairyNS && isFairy) ? window.FairyNS.getSpin(e, w) : (e.weaponSpin||0);
        const ang = (w.angle||0) + baseSpin;
        const dist = (window.BuddhaNS && isBuddha) ? window.BuddhaNS.getDistance(e, w) : (e.radius + (w.radius||10) + 6 + (w.orbitOffset||0));
        const wx = e.x + Math.cos(ang)*dist;
        const wy = e.y + Math.sin(ang)*dist;
        const dx = wx - player.x, dy = wy - player.y;
        const rr = (8 + (w.quality||0)*2) + player.radius;
        // 敌人武器命中玩家本体：秒杀（底层逻辑，所有普通武器命中均立即致死；保留宽限期）
        if(dx*dx + dy*dy <= rr*rr){
          if(e._noPlayerKillUntil && performance.now() < e._noPlayerKillUntil){ /* skip kill */ }
          else {
            player.health = 0;
            if(typeof showGameOver === 'function') showGameOver();
            return;
          }
        }
      }
    }

    // 敌人内部武器互殴（品质高者胜）
    const rainbowIndex = (QUALITY && QUALITY.length) ? (QUALITY.length - 1) : 0;
    for(const e of enemies){
      // 佛陀的内外圈武器不互殴，保持独立旋转
      if(e && e.skin==='boss_fotuo') continue;
      // 敌人武器之间互殴销毁（品质高者胜）
      for(let i=0;i<e.weapons.length;i++){
        const wi = e.weapons[i]; if(!wi || !wi.alive) continue;
        if((wi._sealedUntil||0) > now) continue;
        if(wi._locked) continue;
        const ai = (wi.angle||0) + (e.weaponSpin||0);
        const di = e.radius + (wi.radius||10) + 6 + (wi.orbitOffset||0);
        const xi = e.x + Math.cos(ai)*di; const yi = e.y + Math.sin(ai)*di;
        for(let j=i+1;j<e.weapons.length;j++){
          const wj = e.weapons[j]; if(!wj || !wj.alive) continue;
          if((wj._sealedUntil||0) > now) continue;
          if(wj._locked) continue;
          const aj = (wj.angle||0) + (e.weaponSpin||0);
          const dj = e.radius + (wj.radius||10) + 6 + (wj.orbitOffset||0);
          const xj = e.x + Math.cos(aj)*dj; const yj = e.y + Math.sin(aj)*dj;
          const dx = xj - xi, dy = yj - yi; const rr = (8 + (wi.quality||0)*2) + (8 + (wj.quality||0)*2);
          if(dx*dx+dy*dy <= rr*rr){
            if(e.seclusion){ wi.angle += 0.15; wj.angle -= 0.15; }
            else { if((wi.quality||0) >= (wj.quality||0)) { if(window.Game && window.Game.markWeaponDestroyed){ window.Game.markWeaponDestroyed(wj); } else { wj.alive=false; } } else { if(window.Game && window.Game.markWeaponDestroyed){ window.Game.markWeaponDestroyed(wi); } else { wi.alive=false; } } }
          }
        }
      }
    }
  }

  // 暴露 API
  window.Game.resolveObstacleCollisions = resolveObstacleCollisions;
  window.Game.resolveWeaponCollisions = resolveWeaponCollisions;
  window.Game.resolveWeaponBodyCollisions = resolveWeaponBodyCollisions;
})();