// boss_buddha_skills.js - 佛陀技能与被动（<=500行)
(function(){
  const G = window.Game; if(!G || !window.BossSkillSystem){ console.error('[BuddhaSkills] prerequisites missing'); return; }
  const { SkillLib, SkillSets, registerPassive } = window.BossSkillSystem;
  const VFX = window.BossSkillVFX;
  const { player, enemies } = G;

  // 工具
  function inRange(a,b, r){ return Math.hypot(a.x-b.x, a.y-b.y) <= r; }
  function nearbyNPCs(cx,cy,r){ return (enemies||[]).filter(e=>e && e.role!=='boss' && Math.hypot(e.x+0-cx,e.y+0-cy)<=r); }
  // 新增：屏幕可视判断（与 BossSkillCore 一致的简单实现）
  function isOnScreen(x,y,r=0){ const c=G.camera; const left=c.cx - c.viewW/2, top=c.cy - c.viewH/2; const right=left+c.viewW, bottom=top+c.viewH; return x+r>left && x-r<right && y+r>top && y-r<bottom; }

  // 独立命名空间：BuddhaNS（佛陀专属机制与钩子）
  if(!window.BuddhaNS){
    window.BuddhaNS = (function(){
      const NS = {};
      NS.isBuddha = actor => !!(actor && actor.role==='boss' && actor.skin==='boss_fotuo');
      NS.config = {
        orbit: { innerOffset:24, outerOffset:72, innerSpeedMul:0.5, outerSpeedMul:0.7 },
        baseSpinTierMul: 0.8,           // 基于 mid 档位的降速系数
        knockbackMultiplier: 0.55,      // 受击后退缩放（与 collisions.js 保持一致）
        resistances: { },               // 后续可扩展：如对特定异常的抗性
        immunities: { },                // 后续可扩展：如免疫某些减益
        treasureResponses: {
          // 八卦镜：统一走冻结接口，附加浮字
          'baguajing': function(boss){ NS.freezeWeapons(boss, 5000); window.Game?.spawnFloatText?.('佛陀法器凝滞', boss.x, boss.y-26, 'ft-gold'); },
          // 捆仙绳：预留钩子（当前按通用缴械即可，后续可在此处自定义差异化响应）
          'kunsiansheng': function(boss){ /* TODO: 自定义佛陀对捆仙绳的特殊响应 */ },
          // 太极图：封禁禅寂领域20s，并摧毁佛陀的全部武器（品质逆转由 treasures.js 处理）
           'taijitu': function(boss){
             NS.forbidSkill(boss, 'zenField', 20000);
             // 新增：20s 内禁止佛陀武器再生（避免被动立即补齐，保留摧毁效果的可见性）
             NS.lockWeaponRespawn(boss, 20000);
             const G = window.Game;
             const ws = boss.weapons || [];
             for(const w of ws){ if(!w) continue; if(G?.markWeaponDestroyed){ G.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'npc' }); } else { w.alive = false; } }
             G?.spawnFloatText?.('太极禁毁法器', boss.x, boss.y-26, 'ft-gold');
           }
        }
      };
      NS.initMechanics = function(boss){
        if(!NS.isBuddha(boss)) return;
        if(!boss._initBuddha){
          boss._initBuddha = true;
          boss.weaponSpinSpeed = (window.Game?.SPIN_SPEED_TIERS?.mid||0) * NS.config.baseSpinTierMul;
          boss._reverseSpin = true;
          boss._spinInner = boss._spinInner || 0;
          boss._spinOuter = boss._spinOuter || 0;
          boss._spinInnerSpeed = boss._spinInnerSpeed || (boss.weaponSpinSpeed * NS.config.orbit.innerSpeedMul);
          boss._spinOuterSpeed = boss._spinOuterSpeed || (boss.weaponSpinSpeed * NS.config.orbit.outerSpeedMul);
          boss._forbiddenSkills = boss._forbiddenSkills || {}; // 记录技能禁用截止时间
        }
      };
      // 禁用技能接口：在指定时间内阻止施放
      NS.forbidSkill = function(boss, skillId, ms){ if(!NS.isBuddha(boss)) return; const until = performance.now() + (ms||0); boss._forbiddenSkills = boss._forbiddenSkills || {}; boss._forbiddenSkills[skillId] = Math.max(boss._forbiddenSkills[skillId]||0, until); };
      NS.isSkillForbidden = function(boss, skillId){ if(!NS.isBuddha(boss)) return false; const until = boss._forbiddenSkills?.[skillId]||0; return performance.now() < until; };
      // 新增：武器再生锁定（在锁定期内不进行任何补武器行为）
      NS.lockWeaponRespawn = function(boss, ms){ if(!NS.isBuddha(boss)) return; const until = performance.now() + (ms||0); boss._noRegenUntil = Math.max(boss._noRegenUntil||0, until); };
      NS.isWeaponRespawnLocked = function(boss){ if(!NS.isBuddha(boss)) return false; return performance.now() < (boss._noRegenUntil||0); };
      NS.ensureOrbitParamsForWeapons = function(boss, weaponsAlive){
        if(!NS.isBuddha(boss)) return;
        const cfg = NS.config.orbit;
        for(const w of weaponsAlive||[]){ if(!w) continue; w._orbitActor = boss; if((w.orbitOffset||0) >= 60){ w.orbitOffset = cfg.outerOffset; w.spinDir = -1; w.spinMul = cfg.outerSpeedMul; } else { w.orbitOffset = cfg.innerOffset; w.spinDir = 1; w.spinMul = cfg.innerSpeedMul; } }
      };
      NS.accumulateSpin = function(boss, dt){
        if(!NS.isBuddha(boss)) return;
        const now = performance.now();
        const frozen = (boss._spinFrozenUntil||0) > now;
        const innerSpeed = frozen ? 0 : (boss._spinInnerSpeed || boss.weaponSpinSpeed * NS.config.orbit.innerSpeedMul);
        const outerSpeed = frozen ? 0 : (boss._spinOuterSpeed || boss.weaponSpinSpeed * NS.config.orbit.outerSpeedMul);
        boss._spinInner = (boss._spinInner||0) + innerSpeed * dt/1000;
        boss._spinOuter = (boss._spinOuter||0) + outerSpeed * dt/1000;
        boss.weaponSpinSpeed = (window.Game?.SPIN_SPEED_TIERS?.mid||0) * NS.config.baseSpinTierMul;
      };
      NS.getSpin = function(boss, weapon){
        if(!NS.isBuddha(boss)) return (boss.weaponSpin||0);
        return ((weapon?.orbitOffset||0) >= 60) ? (boss._spinOuter||0) : (boss._spinInner||0);
      };
      NS.getDistance = function(boss, weapon){
        if(!NS.isBuddha(boss)) return boss.radius + (weapon?.radius||10) + 6 + (weapon?.orbitOffset||0);
        return boss.radius + 6 + (weapon?.orbitOffset||0);
      };
      NS.knockbackMultiplierFor = function(actor){ return NS.isBuddha(actor) ? NS.config.knockbackMultiplier : 1; };
      // 抗性与免疫接口：用于外部效果系统查询
      NS.isImmuneFor = function(actor, effect){ if(!NS.isBuddha(actor)) return false; return !!NS.config.immunities[effect]; };
      NS.getResistanceFor = function(actor, effect){ if(!NS.isBuddha(actor)) return 1; const v = NS.config.resistances[effect]; return (typeof v==='number' && v>0) ? v : 1; };
      NS.applyEffectDuration = function(actor, effect, baseMs){ const r = NS.getResistanceFor(actor, effect); return Math.max(0, Math.floor(baseMs * r)); };
      NS.freezeWeapons = function(boss, ms=5000){ if(!NS.isBuddha(boss)) return; const now = performance.now(); boss._spinFrozenUntil = Math.max(boss._spinFrozenUntil||0, now + ms); boss._spinInnerSpeed = 0; boss._spinOuterSpeed = 0; boss.weaponSpinSpeed = 0; };
      NS.onTreasureActivate = function(id, boss){ if(!NS.isBuddha(boss)) return; const fn = NS.config.treasureResponses[id]; if(typeof fn==='function'){ fn(boss); } };
      return NS;
    })();
  }
  // 禅寂领域
  SkillLib.zenField = {
    duration: 20000,
    cast(boss){ if(window.BuddhaNS && BuddhaNS.isBuddha(boss) && BuddhaNS.isSkillForbidden(boss,'zenField')){ G.spawnFloatText?.('禅寂领域被封禁', boss.x, boss.y-24, 'ft-purple'); return; } const r=260; VFX.spawnAuraRing(boss.x,boss.y,r,'rgba(255,215,0,0.65)'); G.spawnFloatText('禅寂领域', boss.x, boss.y, 'ft-boss-buddha'); boss._zenField = boss._zenField || { r, tracks: [], hinted: false }; boss._zenField.r = r; boss._zenField.tracks.length = 0; boss._zenField.hinted = false; boss._lastZenRingAt = performance.now(); },
    update(dt,boss){ const st=boss._bossSkillActive; if(!st || st.id!=='zenField') return; if(!isOnScreen(boss.x,boss.y,(boss.radius||24)+20)) return; const now=performance.now(); if(!boss._lastZenRingAt) boss._lastZenRingAt=0; if(now - boss._lastZenRingAt >= 500){ VFX.spawnAuraRing(boss.x,boss.y, boss._zenField?.r||260,'rgba(255,215,0,0.35)'); boss._lastZenRingAt = now; } const r = boss._zenField?.r || 260; const tracks = boss._zenField?.tracks || []; const playerInside = inRange(player, boss, r);
      if(playerInside){ const ws = player.weapons||[]; for(const w of ws){ if(!w||w.alive===false) continue; if(!tracks.some(t=>t.w===w)){ tracks.push({ w, orig: w.quality||0 }); w.quality = Math.max(0, (w.quality||0) - 1); if(!boss._zenField?.hinted){ G.spawnFloatText('武器品质下降', player.x, player.y-24, 'ft-purple'); boss._zenField.hinted = true; } } } } else { for(let i=tracks.length-1;i>=0;i--){ const t=tracks[i]; if(!t.w || t.w.alive===false){ tracks.splice(i,1); continue; } t.w.quality = t.orig; tracks.splice(i,1); } }
      if(now >= st.end){ for(const t of tracks){ if(t.w && t.w.alive!==false){ t.w.quality = t.orig; } } boss._zenField = null; }
    }
  };

  // 佛光普照
  SkillLib.holyLight = {
    duration: 2000,
    cast(boss){ const pillars=[]; const baseAng=boss.weaponSpin||0; for(let i=0;i<5;i++){ const ang=baseAng+ i*(Math.PI*2/5); const dx=Math.cos(ang), dy=Math.sin(ang); const x=boss.x+dx*180, y=boss.y+dy*180; pillars.push({ x,y,vx:dx,vy:dy,color:'rgba(255,215,0,0.95)', thick:10, len:160, tag:'holyLight', blur:8 }); }
      VFX.spawnBeams(pillars, SkillLib.holyLight.duration, boss); G.spawnFloatText('佛光普照', boss.x, boss.y, 'ft-boss-buddha'); if(player){ player.speedMultiplier = Math.min(player.speedMultiplier||1, 0.5); player._speedRecoverAt = performance.now()+SkillLib.holyLight.duration; G.spawnFloatText && G.spawnFloatText('被束缚(减速)', player.x, player.y-24, 'ft-purple'); }
    },
    update(dt,boss){ if(!isOnScreen(boss.x,boss.y,(boss.radius||24)+20)) return; if(player && player._speedRecoverAt && performance.now()>=player._speedRecoverAt){ player.speedMultiplier=1; player._speedRecoverAt=null; }
      // 佛光度化：紫色及以下品质（<=3）武器被光柱覆盖则消失
      const VFX = window.BossSkillVFX; if(!VFX) return; const beamsArr = VFX.beams||[]; const now = performance.now();
      for(const bm of beamsArr){ if(bm.owner !== boss) continue; for(const b of bm.beams||[]){ if(b.tag!=='holyLight') continue; const vlen=Math.hypot(b.vx||0,b.vy||0)||1; const dx=(b.vx||0)/vlen, dy=(b.vy||0)/vlen; const len=b.len||140; const sx=b.x, sy=b.y; const ex=sx + dx*len, ey=sy + dy*len; const thick=(b.thick||8); const halfW = thick*0.5;
          // 检查玩家武器
          for(const w of (player.weapons||[])){
            if(!w || w.alive===false) continue;
            const ang=(w.angle||0)+(player.weaponSpin||0);
            const dist=player.radius+(w.radius||10)+6+(w.orbitOffset||0);
            const wx=player.x+Math.cos(ang)*dist, wy=player.y+Math.sin(ang)*dist;
            // 点到线段的最近距离判断
            const vx = wx - sx, vy = wy - sy; const proj = (vx*dx + vy*dy); const t = Math.max(0, Math.min(1, proj/len)); const cx = sx + dx*len*t, cy = sy + dy*len*t; const d = Math.hypot(wx - cx, wy - cy);
            const threshold = halfW + (w.radius||10);
            if(d <= threshold){ const qp = (w.quality||0); if(qp <= 3){ if(G.markWeaponDestroyed){ G.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' }); } else { w.alive = false; }
                if(!player._lastHolyHintAt || now - player._lastHolyHintAt > 1000){ G.spawnFloatText && G.spawnFloatText('武器度化', player.x, player.y-20, 'ft-gold'); player._lastHolyHintAt = now; }
              }
            }
          }
        }
      }
    }
  };

  // 被动：千手观音（反向旋转+双层旋转）
  registerPassive(function(dt,G){ for(const e of enemies||[]){ if(e && e.role==='boss' && e.skin==='boss_fotuo'){
      if(!isOnScreen(e.x,e.y,(e.radius||24)+20)) continue;
      BuddhaNS.initMechanics(e);
      // 运行时：确保佛陀拥有固定分层与数量（内圈50，外圈70），并分配双层（内层围绕佛陀旋转（半径更大+速度更慢），外圈围绕佛陀反向旋转）
      const ws = e.weapons||[]; let alive = ws.filter(w=>w && w.alive!==false);
      const targetInner = 70, targetOuter = 70; const targetTotal = targetInner + targetOuter;
      if(alive.length < targetTotal && !BuddhaNS.isWeaponRespawnLocked(e)){ let qIdx = 2; for(const w of e.weapons||[]){ if(w && w.alive!==false && (w.quality||0) > qIdx) qIdx = (w.quality||0); } qIdx = Math.min((G.QUALITY?.length||6)-1, Math.max(2, qIdx));
        for(let j=alive.length; j<targetTotal; j++){ const w = G.createWeapon ? G.createWeapon(qIdx) : { id:Math.random().toString(36).slice(2), quality:qIdx, angle:0, radius:10, damage:10+qIdx*6, knockback: qIdx>=2?80:40, alive:true, skin:'weapon_staff' }; e.weapons.push(w); }
        alive = e.weapons.filter(w=>w && w.alive!==false);
      }
      const half = targetInner;
      const innerCount = Math.min(alive.length, half);
      const outerCount = Math.max(0, alive.length - half);
      for(let i=0;i<alive.length;i++){
        const w = alive[i];
        if(!w) continue;
        if(i < half){
          // 内圈：围绕佛陀旋转，增大半径，降低旋转速度
          w._orbitActor = e;
          w.orbitOffset = 24;
          w.spinDir = 1;
          w.spinMul = 0.5;
          const idx = i;
          const denom = Math.max(1, innerCount);
          w.angle = (idx/denom) * Math.PI*2;
        } else {
          // 外圈：围绕佛陀旋转（维持参数），更大半径且反向旋转
          w._orbitActor = e;
          w.orbitOffset = 72; w.spinDir = -1; w.spinMul = 0.7;
          const idx = i - half;
          const denom = Math.max(1, outerCount);
          w.angle = (idx/denom) * Math.PI*2;
        }
      }
      // 统一校正：根据 orbitOffset 强制内外圈方向与参数（由 BuddhaNS 维护）
      BuddhaNS.ensureOrbitParamsForWeapons(e, alive);
      // 独立旋转通道累积（与 NPC 通用 weaponSpin 脱耦合）
      BuddhaNS.accumulateSpin(e, dt);
    } } });

  // 被动：坐禅（每40秒补刀）
  registerPassive(function(dt,G){ const now=performance.now(); for(const e of enemies||[]){ if(!e || e.role!=='boss' || e.skin!=='boss_fotuo') continue; if(!isOnScreen(e.x,e.y,(e.radius||24)+20)) continue; if(!e._lastMeditate) e._lastMeditate=0; if(now - e._lastMeditate >= 40000){ e._lastMeditate = now; const addOne=(actor)=>{ if(actor.skin==='boss_fotuo' && BuddhaNS.isWeaponRespawnLocked(actor)) return; const targetCount = (actor.role==='boss') ? 20 : 12; if(actor.weapons?.length>=targetCount) return; let qIdx = 2; for(const w of actor.weapons||[]){ if(w && w.alive!==false && (w.quality||0) > qIdx) qIdx = (w.quality||0); } qIdx = Math.min((G.QUALITY?.length||6)-1, Math.max(2, qIdx)); const w = G.createWeapon ? G.createWeapon(qIdx) : { id:Math.random().toString(36).slice(2), quality:qIdx, angle:0, radius:10, damage:10+qIdx*6, knockback: qIdx>=2?80:40, alive:true, skin:'weapon_staff' }; if(w){ actor.weapons.push(w); if(actor.skin==='boss_fotuo'){ // 新加入的佛陀武器默认分配到外圈以稳定视觉
            w._orbitActor = actor; w.orbitOffset = 72; w.spinDir = -1; w.spinMul = 0.7; } } };
      addOne(e); const npcs = nearbyNPCs(e.x,e.y,280); for(const n of npcs){ addOne(n); } G.spawnFloatText('坐禅补刀', e.x, e.y, 'ft-boss-buddha'); } } });

  // 注册顺序
  SkillSets['boss_fotuo'] = ['zenField','holyLight'];
})();