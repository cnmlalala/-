// skill_system.js - 通用战技系统，可供玩家与NPC使用  (<=500 行)
(function(){
  const G = window.Game || (window.Game = {});
  // if(!G){ console.error('[skill_system] Game core not ready'); return; }

  // -------------------- 配置 --------------------
  const SkillConfigs = {
    moonblade:{
      id:'moonblade',
      name:'疯狂转刀',
      desc:'周身化五十柄月牙刀，并附带\u3010劣化\u3011属性',
      bladeCount:36,
      // 略微提升旋转速度
      spinMultiplier:8.0,
      cooldown:10,
      durationByQuality:{ 2:0.2, 3:0.5, 4:1, 5:1.5, 6:2.5, 7:10 }
    },
    // 新增：魔刀千刃（无限持续，按“1”开启/再次按停止）
    magic_blade_thousand:{
      id:'magic_blade_thousand',
      name:'魔刀千刃',
      desc:'与疯狂转刀同款外观，武器触碰NPC武器立即摧毁且不造成击退',
      bladeCount:36,
      spinMultiplier:8.0,
      toggle:true
    }
  };

  // -------------------- 技能运行时数据 --------------------
  const activeSkills = []; // {actor, id, endTime, data}
  function isSkillActiveFor(actor, id){ return activeSkills.some(s=>s.actor===actor && s.id===id); }
  function ensureSkillArray(actor){ if(!actor.skillWeapons) actor.skillWeapons = []; }

  // -------------------- 公共 API --------------------
  const SkillSystem = {
    canActivate(actor, id){
      const cfg = SkillConfigs[id]; if(!cfg) return false;
      if(actor._skillCooldown && actor._skillCooldown>0 && id!=='magic_blade_thousand') return false;
      // 战技进行中不可再触发
      if(isSkillActiveFor(actor, id)) return false;
      // 检查品质要求：至少存在一把蓝色及以上品质（quality>=3）
      const hasQualified = actor?.weapons?.some(w=>w.alive!==false && (w.quality||0) >= 3);
      return id==='magic_blade_thousand' ? true : !!hasQualified;
    },
    trigger(actor, id){
      const cfg = SkillConfigs[id]; if(!cfg){ console.warn('[SkillSystem] 未找到技能:', id); return; }
      if(isSkillActiveFor(actor, id)) return; // 正在进行中不可重复触发
      if(!this.canActivate(actor,id)){ return; }
      // 开启技能（完全独立于普通武器）
      const highestQ = actor.weapons.reduce((m,w)=> w.alive!==false && w.quality>m ? w.quality : m, 0);
      const dur = cfg.durationByQuality[highestQ] || 0.2;
      const start = performance.now();
      ensureSkillArray(actor);
      const skillData = { actor, id, start, endTime: start + dur*1000, cfg };
      // 在独立的 skillWeapons 中生成战技武器
      for(let i=0;i<cfg.bladeCount;i++){
        const w = G.createWeapon ? G.createWeapon(2) : {id:Math.random().toString(36).slice(2), quality:2, angle:0,radius:10,damage:20,knockback:100,alive:true, skin:'skill_moonblade'};
        w.skin = 'skill_moonblade';
        w.degrade = true;
        w.isMoonBlade = true;
        // 视为最高品质，且不可被摧毁，不受 Boss 技能影响（技能期间保持数量与品质不变）
        w.quality = (window.Game && Array.isArray(window.Game.QUALITY)) ? (window.Game.QUALITY.length - 1) : 6;
        w.indestructible = true; // 不可被摧毁
        w.bossImmune = true;     // 不受Boss技能影响（免疫 markWeaponDestroyed）
        w.isSkillWeapon = true;  // 走技能武器视觉缩放/光晕
        w.drawSize = 28;
        w.radius = 26;
        w.spinMul = cfg.spinMultiplier; // 不修改 actor.weaponSpinSpeed，改为每武器倍速
        w._skillTag = 'moonblade';
        actor.skillWeapons.push(w);
      }
      // 均分角度（仅战技武器）
      const n = actor.skillWeapons.length;
      for(let i=0;i<n;i++){ const w = actor.skillWeapons[i]; if(w && w._skillTag==='moonblade'){ w.angle = (i/n)*Math.PI*2; } }
      // 新增：触发后立刻摧毁普通武器，仅保留战技武器显示
      if(actor && Array.isArray(actor.weapons)){
        const list = actor.weapons.slice();
        for(const w of list){ if(w && w.alive!==false){ G.markWeaponDestroyed?.(w, { killer:'playerSkill', victimOwner:'player' }); } }
        actor.weapons = actor.weapons.filter(w=>w.alive!==false);
      }
      // 冷却（不影响拾取与普通武器）
      actor._skillCooldown = cfg.cooldown;
      activeSkills.push(skillData);
      // 提示
      if(actor===G.player){ G.spawnFloatText?.(`${cfg.name}!`, actor.x, actor.y-30); }
    },
    update(dt){
      // 更新冷却
      if(G.player._skillCooldown>0){ G.player._skillCooldown = Math.max(0, G.player._skillCooldown - dt/1000); }
      // 处理进行中的技能
      const now = performance.now();
      for(let i=activeSkills.length-1;i>=0;i--){
        const sk = activeSkills[i];
        if(now >= sk.endTime){
          // 技能结束：仅清理对应战技武器
          const {actor, cfg} = sk;
          const list = actor.skillWeapons||[];
          const kept = [];
          for(const w of list){
            if(w && w._skillTag===cfg.id){
              if(G.markWeaponDestroyed){ G.markWeaponDestroyed(w, { killer:'playerSkill', victimOwner:'player' }); }
            } else { kept.push(w); }
          }
          actor.skillWeapons = kept;
          activeSkills.splice(i,1);
        }
      }
    }
  };

  // 按键监听（玩家专属）
  window.addEventListener('keydown', e=>{
    if(e.key.toLowerCase()==='e'){
      const actor = G.player; const id = 'moonblade';
      // 冷却提示（红色）
      if(actor?._skillCooldown>0){
        const remain = Math.max(0, actor._skillCooldown).toFixed(1);
        G.spawnFloatText?.(`当前战技冷却中，还差 ${remain} 秒`, actor.x, actor.y - 30, 'ft-error');
        return;
      }
      // 武器条件提示（红色）
      const hasQualified = actor?.weapons?.some(w=>w.alive!==false && (w.quality||0) >= 3);
      if(!hasQualified){
        G.spawnFloatText?.('当前持有武器不满足启动条件', actor.x, actor.y - 30, 'ft-error');
        return;
      }
      SkillSystem.trigger(actor, id);
    }
    // 新增：按数字键“1”开启/停止魔刀千刃（兼容主键盘与数字键盘）
    const isKey1 = (e.key==='1' || e.code==='Digit1' || e.code==='Numpad1' || e.keyCode===49);
    if(isKey1){
      const actor = G.player;
      if(!actor){
        const canvas = document.getElementById('gameCanvas');
        const cx = canvas ? canvas.width/2 : 0; const cy = canvas ? canvas.height/2 : 0;
        G.spawnFloatText?.('玩家未就绪，稍候再试', cx, cy, 'ft-error');
        return;
      }
      if(isSkillActiveFor(actor, 'magic_blade_thousand')){ window.SkillSystemStopMagicBladeThousand(actor); }
      else { window.SkillSystemStartMagicBladeThousand(actor); }
    }
  });

  // 为魔刀千刃提供专属触发与停止（无限持续，需人工停止）
  // 开启魔刀千刃（独立于普通武器）
  window.SkillSystemStartMagicBladeThousand = function(actor){
    const G = window.Game; const id = 'magic_blade_thousand';
    const cfg = SkillConfigs[id]; if(!cfg){ console.warn('[SkillSystem] 未找到技能:', id); return; }
    if(isSkillActiveFor(actor, id)) return;
    // 开启无限持续态
    const start = performance.now();
    ensureSkillArray(actor);
    const skillData = { actor, id, start, endTime: Number.POSITIVE_INFINITY, cfg };
    // 生成月牙刀（战技轨道），不影响普通武器
    for(let i=0;i<cfg.bladeCount;i++){
      const w = G.createWeapon ? G.createWeapon(2) : {id:Math.random().toString(36).slice(2), quality:2, angle:0,radius:10,damage:20,knockback:0,alive:true, skin:'skill_moonblade'};
      w.skin = 'skill_moonblade';
      w.degrade = false; // 魔刀千刃不走劣化流程
      w.isMagicBladeThousand = true;
      w.isMoonBlade = true; // 使用同款月牙外观
      w.isSkillWeapon = true; // 走技能武器视觉缩放/光晕
      w.drawSize = 28;
      w.radius = 26;
      w.spinMul = cfg.spinMultiplier; // 使用武器倍速，不改 actor.weaponSpinSpeed
      w._skillTag = 'magic_blade_thousand';
      actor.skillWeapons.push(w);
    }
    const list = actor.skillWeapons.filter(w=>w && w._skillTag==='magic_blade_thousand');
    const n = list.length; for(let i=0;i<n;i++){ list[i].angle = (i/n)*Math.PI*2; }
    // 新增：开启魔刀千刃后立刻摧毁普通武器，仅保留战技武器显示
    if(actor && Array.isArray(actor.weapons)){
      const toDestroy = actor.weapons.slice();
      for(const w of toDestroy){ if(w && w.alive!==false){ G.markWeaponDestroyed?.(w, { killer:'playerSkill', victimOwner:'player' }); } }
      actor.weapons = actor.weapons.filter(w=>w.alive!==false);
    }
    activeSkills.push(skillData);
    if(actor===G.player){ G.spawnFloatText?.(`${cfg.name}!`, actor.x, actor.y-30); }
  };
  // 停止魔刀千刃：仅清理战技武器
  window.SkillSystemStopMagicBladeThousand = function(actor){
    const idx = activeSkills.findIndex(s=>s.actor===actor && s.id==='magic_blade_thousand');
    if(idx>=0){
      const sk = activeSkills[idx]; const {actor:act, cfg} = sk; const G = window.Game;
      const list = act.skillWeapons||[]; const kept = [];
      for(const w of list){
        if(w && w._skillTag==='magic_blade_thousand'){
          if(G.markWeaponDestroyed){ G.markWeaponDestroyed(w, { killer:'playerSkill', victimOwner:'player' }); }
        } else { kept.push(w); }
      }
      act.skillWeapons = kept;
      activeSkills.splice(idx,1);
      if(act===G.player){ G.spawnFloatText?.(`停止${cfg.name}`, act.x, act.y-30); }
    }
  };

  // 暴露到全局
  window.SkillSystem = SkillSystem;
})();