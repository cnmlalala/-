// boss_fairy_skills.js - 女仙技能（<=500行）
(function(){
  const G = window.Game; if(!G || !window.BossSkillSystem){ console.error('[FairySkills] prerequisites missing'); return; }
  const { SkillLib, SkillSets } = window.BossSkillSystem;
  const VFX = window.BossSkillVFX;
  const { player, enemies } = G;

  // 新增：女仙 Boss 武器旋转解耦合模块 FairyNS（独立于通用 weaponSpin）
  window.FairyNS = (function(){
    const NS = {};
    NS.isFairy = (boss)=>!!boss && boss.role==='boss' && boss.skin==='boss_nvXian';
    NS.config = {
      baseSpinTierMul: 2.25,   // 基础旋转速度相对 tier 的倍率（降低一部分）
      seclusionMul: 10,        // 隐居状态（seclusion）时的加速倍率（原逻辑中 *10）
    };
    // 累加女仙的专属旋转值（boss._spin），不使用通用 boss.weaponSpin
    NS.accumulateSpin = function(boss, dt){
      if(!NS.isFairy(boss)) return;
      const tiers = (G?.SPIN_SPEED_TIERS)||{};
      const baseTier = boss.weaponSpinSpeed || tiers.mid || 0;
      const mul = NS.config.baseSpinTierMul * (boss.seclusion ? NS.config.seclusionMul : 1);
      const spd = baseTier * mul;
      boss._spin = (boss._spin||0) + spd * dt/1000;
    };
    // 读取女仙的旋转值
    NS.getSpin = function(boss, weapon){
      if(!NS.isFairy(boss)) return (boss.weaponSpin||0);
      return boss._spin||0;
    };
    return NS;
  })();

  function destroyPlayerWeaponSafe(w){
    if(!w) return;
    if(window.Game && typeof window.Game.markWeaponDestroyed==='function'){
      window.Game.markWeaponDestroyed(w, { killer:'npcSkill', victimOwner:'player' });
    } else {
      w.alive = false;
    }
  }

  // 花舞缭乱：多彩弹幕，粉色秒杀（圆点对玩家本体与玩家武器均生效）
  SkillLib.flowerChaos = {
    duration: 2500,
    cast(boss){
      const shots=[];
      const colors=['rgba(255,160,220,0.95)','rgba(120,200,255,0.9)','rgba(255,220,120,0.9)','rgba(160,255,160,0.9)'];
      const qMapByColorIndex = [6,3,4,2]; // 粉、蓝、黄、绿对应品质
      for(let i=0;i<56;i++){
        const ang=(Math.random()*Math.PI*2);
        const sp=120+Math.random()*90;
        const col = colors[i%colors.length];
        const sq = qMapByColorIndex[i%colors.length];
        shots.push({ x: boss.x, y: boss.y, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp, color: col, killer: (i%7===0), radius: 5, quality: sq });
      }
      VFX.spawnPetalShots(shots);
      boss._shots = shots;
      boss._shotEnd = performance.now()+2500;
      // 技能提示
      window.Game?.spawnFloatText?.('花舞缭乱', boss.x, boss.y-24, 'ft-boss-green');
    },
    update(dt,boss){
      const list=boss._shots||[];
      const now = performance.now();
      for(const s of list){
        if(!s || s.life===0) continue;
        s.x += s.vx * dt/1000;
        s.y += s.vy * dt/1000;
        const sr = s.radius||5;
        // 对玩家本体生效：所有颜色命中均秒杀
        if(Math.hypot(s.x-player.x, s.y-player.y) < (player.radius||18) + sr){
          player.health = 0;
          if(window.Game && typeof window.Game.showGameOver==='function'){ window.Game.showGameOver(); }
          s.life = 0; // 命中后该弹点消失
          continue;
        }
        // 对玩家武器生效：命中则摧毁该武器，但弹点不消失
        const ws = player.weapons||[];
        for(const w of ws){
          if(!w || w.alive===false) continue;
          const pang=(w.angle||0) + (player.weaponSpin||0);
          const dist=(player.radius||18) + (w.radius||10) + Math.max(0,w.orbitOffset||0) + 6;
          const wx = player.x + Math.cos(pang)*dist;
          const wy = player.y + Math.sin(pang)*dist;
          const wr = (w.radius||10)*0.5;
          if(Math.hypot(s.x-wx, s.y-wy) <= (wr + sr)){
            const sq = (s.quality||0);
            const wq = (w.quality||0);
            if(sq > wq){
              // 花瓣品质更高：摧毁玩家武器，花瓣继续存在
              destroyPlayerWeaponSafe(w);
            } else {
              // 玩家武器品质更高或相等：抹消花瓣（同品质花瓣消失武器不变）
              s.life = 0;
            }
            break;
          }
        }
        // 仅命中玩家本体时让弹点消失；其他情况保持运动
      }
      if(now>=boss._shotEnd){ boss._shots=[]; }
    }
  };

  // 藤蔓缠绕：周期束缚一秒，停转+禁技（视觉为闪电/藤蔓形，透明度更低，带渐变）
  SkillLib.vineLockNew = {
    duration: 6000,
    cast(boss){ const now = performance.now(); boss._vineNext = now; boss._vineTargets = [player]; boss._vineRemain = 3; boss._vineInterval = 600; 
      // 技能提示
      window.Game?.spawnFloatText?.('藤蔓缠绕', boss.x, boss.y-24, 'ft-boss-green');
    },
    update(dt,boss){
      const now=performance.now();
      if((boss._vineRemain||0) > 0 && now>= (boss._vineNext||0)){
        boss._vineNext = now + (boss._vineInterval||600);
        const beams=[];
        for(const tgt of boss._vineTargets){
          const vx = tgt.x-boss.x, vy = tgt.y-boss.y;
          const len = Math.hypot(vx,vy);
          beams.push({ x: boss.x, y: boss.y, vx, vy, thick: 4, len, color:'rgba(60,200,140,0.55)', blur: 1.5, shape:'zigzag', jitter: 9, gradColors:['rgba(60,200,140,0.25)','rgba(220,255,220,0.85)'] });
          tgt._rootTill = Math.max(tgt._rootTill||0, now+1500);
        }
        VFX.spawnBeams(beams, undefined, boss);
        boss._vineRemain = Math.max(0, (boss._vineRemain||1) - 1);
      }
      if(player){
        const rooted = (player._rootTill||0)>now;
        // 管理移动与禁技
        player.canMove = !rooted;
        player._skillSilenced = rooted;
        // 修复：束缚期间暂时将玩家武器旋转速度置0，但在结束后恢复原值
        if(rooted){
          if(player._spinBackup == null) player._spinBackup = player.weaponSpinSpeed;
          player.weaponSpinSpeed = 0;
        } else {
          if(player._spinBackup != null){
            player.weaponSpinSpeed = player._spinBackup;
            player._spinBackup = null;
          }
        }
      }
    }
  };

  // 自然共鸣：大型绿色圈，回血并补刀；持续提升自身与周边NPC武器品质与数量
  SkillLib.natureResonanceNew = {
    duration: 10000,
    cast(boss){
      boss._nrEnd = performance.now()+10000;
      boss._nrR = 300;
      boss._nrNextTick = performance.now() + 700;
      boss._nrQBase = Math.max(1, (boss.maxQuality||3));
      // 提高透明度（更轻薄）：降低 alpha；绿色光环持续5s
      VFX.spawnAuraRing(boss.x,boss.y,boss._nrR,'rgba(80,220,120,0.25)', 5000);
      // 技能提示
      window.Game?.spawnFloatText?.('自然共鸣', boss.x, boss.y-24, 'ft-boss-green');
      // 不生成光点（按用户要求）
    },
    update(dt,boss){
      const now=performance.now();
      const r=boss._nrR||280;
      // 周边NPC回血与补刀（回血每帧进行；新增武器仅在 tick 触发，避免卡顿）
      for(const e of enemies||[]){
        if(!e || e.role==='boss') continue;
        const inRange = Math.hypot(e.x-boss.x, e.y-boss.y) <= r;
        if(inRange){
          e.health = Math.min(e.maxHealth||100, (e.health||50) + 6*dt/1000);
          const cap = 60;
          const allowAdd = now >= (boss._nrNextTick||0);
          if(allowAdd && e.weapons){
            let aliveCount = 0; for(const w of e.weapons){ if(w && w.alive!==false) aliveCount++; }
            if(aliveCount < cap){
              const q = Math.min(7, (e.maxQuality||3));
              const w = G.createEnemyWeapon ? G.createEnemyWeapon(q) : { id:Math.random().toString(36).slice(2), quality:q, angle:0, radius:10, damage:8+q*5, knockback: q>=2?70:35, alive:true, skin:'weapon_sword' };
              if(w) e.weapons.push(w);
              // 新增后统一提升品质与重排（即使品质不变，也会重算角度与半径）
              if(window.Game && typeof window.Game.setEnemyWeaponsQuality==='function'){
                window.Game.setEnemyWeaponsQuality(e, q);
              }
            }
          }
        }
      }
      if(now >= (boss._nrNextTick||0)){
        boss._nrNextTick = now + 700;
        const nextQ = Math.min(7, (boss._nrQBase||3) + Math.floor((now - (boss._nrEnd-10000))/700));
        // 同时提升女仙自身的武器数量（至上限），新增后统一一次性重排与钛质，减少卡顿
        const capBoss = boss.maxWeapons || 50;
        if(Array.isArray(boss.weapons)){
          let aliveCountBoss = 0; for(const w of boss.weapons){ if(w && w.alive!==false) aliveCountBoss++; }
          if(aliveCountBoss < capBoss){
            const w = G.createEnemyWeapon ? G.createEnemyWeapon(nextQ) : { id:Math.random().toString(36).slice(2), quality: nextQ, angle:0, radius:10, damage:8+nextQ*5, knockback: nextQ>=2?70:35, alive: true, skin:'weapon_staff' };
            boss.weapons.push(w);
            // 提示：新增武器
            if(window.Game && typeof window.Game.spawnFloatText==='function'){
              window.Game.spawnFloatText('自然共鸣：新增武器', boss.x, boss.y-24, 'ft-boss-green');
            }
          }
        }
        // 统一提升品质与重排（仅一次调用）
        if(window.Game && typeof window.Game.setEnemyWeaponsQuality==='function'){
          window.Game.setEnemyWeaponsQuality(boss, nextQ);
        }
      }
      if(now >= (boss._nrEnd||0)){
        // 光环结束，但已提升的品质与新增武器保持永久
        boss._nrEnd = 0; boss._nrNextTick = 0;
        // 固化上限：记录当前最大品质与武器数量
        const currentMaxQ = (boss.weapons||[]).reduce((m,w)=> (w && w.alive!==false && (w.quality||0)>m) ? (w.quality||0) : m, 0);
        boss.maxQuality = Math.max(boss.maxQuality||0, currentMaxQ||0);
        const aliveCountBoss2 = (boss.weapons||[]).reduce((c,w)=> c + ((w && w.alive!==false) ? 1 : 0), 0);
        boss.maxWeapons = Math.max(boss.maxWeapons||0, aliveCountBoss2);
        // 加锁：防止后续 fillWeaponsForRole 重置
        boss._lockWeapons = true;
      }
    }
  };

  // 技能集
  SkillSets['boss_nvXian'] = ['flowerChaos','vineLockNew','natureResonanceNew'];

  // 补充：被动钩子，确保自然共鸣结束后即使调度器提前清空 _bossSkillActive，也会完成固化与加锁
  registerPassive(function(dt, G){
    const now = performance.now();
    for(const e of (G.enemies||[])){
      if(!e || e.role!=='boss' || e.skin!=='boss_nvXian') continue;
      if((e._nrEnd||0) > 0 && now >= e._nrEnd){
        if(!e._nrFinalized){
          e._nrFinalized = true;
          e._nrEnd = 0; e._nrNextTick = 0;
          const currentMaxQ = (e.weapons||[]).reduce((m,w)=> (w && w.alive!==false && (w.quality||0)>m) ? (w.quality||0) : m, 0);
          const aliveCount = (e.weapons||[]).reduce((c,w)=> c + ((w && w.alive!==false) ? 1 : 0), 0);
          e.maxQuality = Math.max(e.maxQuality||0, currentMaxQ||0);
          e.maxWeapons = Math.max(e.maxWeapons||0, aliveCount);
          e._lockWeapons = true;
          if(window.Game && typeof window.Game.setEnemyWeaponsQuality==='function'){
            window.Game.setEnemyWeaponsQuality(e, e.maxQuality||3);
          }
          window.Game?.spawnFloatText?.('自然共鸣：固化武器与品质', e.x, e.y-24, 'ft-boss-green');
        }
      }
    }
  });
})();