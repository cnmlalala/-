(function(){
  // 精简入口：依赖各模块通过全局 Game 暴露的接口
  const G = window.Game;
  if (!G) {
    console.error('Game core not loaded');
    return;
  }
  let last = performance.now();
  G.dt = 16;
  G.paused = false;
  if (G.hud && G.hud.pauseBtn) {
    G.hud.pauseBtn.addEventListener('click', () => { G.paused = !G.paused; });
  }
  // 键盘 P 键 控制暂停/继续
  window.addEventListener('keydown', e=>{
    if(e.key==='p' || e.key==='P'){
      G.paused = !G.paused;
    }
  });

  if(!G.hud){ G.hud = { } }
  const modal = document.getElementById('gameOverModal');
  const statPick = document.getElementById('stat-pickups');
  const statKills = document.getElementById('stat-kills');
  const statTime = document.getElementById('stat-time');
  const statEval = document.getElementById('stat-eval');
  const restartBtn = document.getElementById('restart-btn');
  restartBtn.addEventListener('click', ()=>{ location.reload(); });
  let startTime = performance.now();

  function showGameOver(){
    if(window.Game.showGameOverCalled) return; // avoid multiple calls
    window.Game.showGameOverCalled = true;
    // 停止游戏循环绘制但保留暂停标识
    G.paused = true;
    modal.classList.remove('hidden');
    // 统计
    statPick.textContent = `获得法宝：${G.totalTreasures||0} 件`;
    statKills.textContent = `斩杀妖邪：${G.totalKills||0} 只`;
    const survive = Math.floor((performance.now()-startTime)/1000);
    statTime.textContent = `存活时长：${survive} 秒`;
    statEval.textContent = `评价：${genEvaluation(G.totalKills||0, survive, G.totalTreasures||0)}`;
  }

  // 将结算函数暴露到全局，供其他模块调用
  window.Game.showGameOver = showGameOver;

  function genEvaluation(kills, time, pickups){
    const evalParts=[];
    // kills
    if(kills<10) evalParts.push('初入仙门');
    else if(kills<30) evalParts.push('略显锋芒');
    else if(kills<60) evalParts.push('小有所成');
    else if(kills<100) evalParts.push('独当一面');
    else evalParts.push('横扫六合');
    // time
    if(time<30) evalParts.push('电光火石');
    else if(time<60) evalParts.push('一炷香功');
    else if(time<120) evalParts.push('潜心修炼');
    else evalParts.push('参悟天道');
    // pickups
    if(pickups<5) evalParts.push('囊中羞涩');
    else if(pickups<15) evalParts.push('敛财有道');
    else evalParts.push('富甲仙界');
    // 随机拼接 2~3 个
    while(evalParts.length>3) evalParts.splice(Math.floor(Math.random()*evalParts.length),1);
    return evalParts.join(' · ');
  }
  function frame(now){
    G.dt = now - last; last = now;
    if (!G.paused) {
      G.handleMovement(G.dt);
      // 碰撞与边界限制
      if (typeof G.resolveObstacleCollisions === 'function') {
        G.resolveObstacleCollisions();
      }
      G.tryPickup();
      G.updateBuildingsCombat();
      G.updateEnemies(G.dt);
      if (typeof G.enemiesTryPickup === 'function') {
        G.enemiesTryPickup();
      }
      G.resolveObstacleCollisions();
      G.resolveWeaponCollisions();
      G.resolveWeaponBodyCollisions();
      if(typeof G.updateWeaponBalance==='function'){ G.updateWeaponBalance(G.dt); }
      G.updateParticles(G.dt);
      G.updatePickups(G.dt);
      G.updateHUD();
      // 更新技能系统
      if(window.SkillSystem?.update){
        window.SkillSystem.update(G.dt);
      }
      // 新增：Boss技能系统更新（仅屏幕内最近Boss会施放）
      if(window.BossSkillSystem?.update){
        window.BossSkillSystem.update(G.dt);
      }
      if(window.BossSkillVFX?.update){ window.BossSkillVFX.update(G.dt); }
      G.draw();
      // 绘制Boss技能特效（置于场景绘制之后，避免被覆盖）
      if(window.BossSkillVFX?.draw){ window.BossSkillVFX.draw(G.ctx); }
      if(window.Game.MonsterDialogue){
        window.Game.MonsterDialogue.updateDialogue(G.enemies, G.player, G.dt);
      }
    }
    requestAnimationFrame(frame);
  }

  // 初始化
  if (typeof G.spawnEnemies === 'function') G.spawnEnemies();
  if (typeof G.spawnBuildings === 'function') G.spawnBuildings();

  requestAnimationFrame(frame);
})();