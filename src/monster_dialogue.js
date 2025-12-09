// 怪物语言模块：管理怪物在接近/死亡时的台词，便于后续扩展
(function(){
  const LINES_NEAR = {
    minion: [
      '杀了你！',
      '嘿嘿，送死的来了！',
      '受死吧！',
      '血肉，正合我口味……'
    ],
    // 以 角色_体系 为键，方便按 cultivation 精准匹配
    'elite_佛': [
      '苦海无涯，施主，贫僧这尊金刚怒目，便是你的彼岸。'
    ],
    'boss_佛': [
      '慈悲？那不过是香火中泡软的妄念。今日教你看清——佛若不渡，便由我焚天！'
    ],
    'elite_道': [
      '此地乾坤已锁，阁下这身因果，该由我“太上诛魔令”清算。'
    ],
    'boss_道': [
      '求道？求的究竟是天理，还是你心中那点不甘？罢了，斩了你，天道自会告诉我答案。'
    ],
    'elite_魔': [
      '桀桀……好鲜活的元神！主上允我撕你魂魄三分，剩下的，我要腌成魂灯！'
    ],
    'boss_魔': [
      '恨吗？怒吗？你所有挣扎，不过是我心魔道果上一缕新纹。此界，本就是我的食粮。'
    ],
    'elite_妖': [
      '人族？不过是会走路的肥料。这片山林，连风都得遵我的规矩。'
    ],
    'boss_妖': [
      '人族修道？可笑！你们呼吸的灵气，本是我族上古尸骸所化。今日，该还了。'
    ],
    'elite_人': [
      '宗门铁律，逆者皆诛！你这身修为既出自本门，今日——便由老夫亲手废掉！'
    ],
    'boss_人': [
      '仙佛视我为刍狗？那我便以人道伐天！朕之疆土，万法——皆需低眉！'
    ],
    'elite_神': [
      '凡俗之息，也敢玷污南天门？跪下，可留轮回位。'
    ],
    'boss_神': [
      '悲欢？生死？有趣的尘埃戏码。但戏台旧了，该清算了——吾即终焉。'
    ]
  };

  // 临终遗言，根据 skin 关键字或 cultivation+role 匹配
  const DEATH_LINES = {
    // 具体素材关键词
    pig:'这口锅……我不背……',
    shrimp:'咸……还是淡……',
    rat:'奶酪……还没吃到……',
    tree:'化作薪柴……也认了……',
    // 精英/ boss + 体系
    'elite_佛':'我佛……弟子所见，为何是血海，而非莲台……',
    'boss_佛':'呵……原来我参的不是众生疾苦，竟是自己的心魔。可惜，这娑婆世界……早该碎了……',
    'elite_道':'道韵……为何在消散……师兄，我看不到……紫气了……',
    'boss_道':'三尸未斩尽，反被天道噬……原来我等所谓“合道”，不过是……养在笼中的鹤……',
    'elite_魔':'血海……怎么不回应我了……主上……你早把我炼成……耗材？！',
    'boss_魔':'痛快！原来“被斩杀”竟是这般滋味……记住，当你道心再起涟漪时——我便归来。',
    'elite_妖':'年轮……断了……山神老爷……您说的“修行正道”……是骗我的吗……',
    'boss_妖':'血脉记忆里……我族也曾守护此界……罢了，这一局……输给时光，不丢妖……',
    'elite_人':'我守了三百年的规矩……竟困死了自己……快走……宗门大阵……其实是……',
    'boss_人':'寡人错了……错的不是逆天，是把众生……也当成了棋子。这把剑……留给后来者……',
    'elite_神':'我不过是天道刻痕……也会痛吗……',
    'boss_神':'……原来“无趣”，才是吾唯一的缺陷。新生之神……你会尝到味道的……',
    // fallback
    boss:'不可能……我怎会败！',
    elite:'道心……破碎……',
    minion:'饶了我……'
  };

  // 对外接口
  function randomLine(role,cult){
    // 先尝试 role+cult
    const key = `${role}_${cult||''}`;
    if(LINES_NEAR[key]){
      const arr = LINES_NEAR[key];
      return arr[Math.floor(Math.random()*arr.length)];
    }
    // 再退回单纯 role
    const arr = LINES_NEAR[role] || LINES_NEAR.minion;
    return arr[Math.floor(Math.random()*arr.length)];
  }
  function deathLine(e){
    const sk = e.skin||'';
    // 1. 先看具体素材关键词
    for(const k in DEATH_LINES){ if(sk.includes(k)) return DEATH_LINES[k]; }
    // 2. 再看 role+cultivation
    const key = `${e.role||''}_${e.cultivation||''}`;
    if(DEATH_LINES[key]) return DEATH_LINES[key];
    // 3. 按角色退回
    if(e.role==='boss') return DEATH_LINES.boss;
    if(e.role==='elite') return DEATH_LINES.elite;
    return DEATH_LINES.minion;
  }

  // 主说话逻辑：每个敌人持有 speakCooldown，靠近玩家时小概率触发
  function updateDialogue(enemies, player, dt){
    for(const e of enemies){
      if(!e || e.alive === false) continue;
      e._speakCD = (e._speakCD||0) - dt;
      if(e._speakCD>0) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist2 = dx*dx + dy*dy;
      const triggerDist = 300*300;
      if(dist2 < triggerDist){
        // 概率或必然触发
        let chance = 0.02; // 小怪默认 2%
        if(e.role==='elite') chance = 0.18; // 精英较高
        if(e.role==='boss')  {
          if(!e._firstNearSpoken){ chance = 1; e._firstNearSpoken=true; } else chance = 0.6; // 首次必说，其后仍有高概率
        }
        if(Math.random() < chance){
          const line = randomLine(e.role||'minion', e.cultivation);
          const cssClass = (e.role==='boss'?'ft-boss':(e.role==='elite'?'ft-elite':'ft-minion'));
          if(window.Game && typeof window.Game.spawnFloatText==='function'){
            window.Game.spawnFloatText(line, e.x, e.y - (e.radius||16) - 10, cssClass);
          }
          // 重置冷却：Boss长一点，其他正常
          if(e.role==='boss') e._speakCD = 10000;
          else if(e.role==='elite') e._speakCD = 8000;
          else e._speakCD = 6000;
        }
      }
    }
  }

  function speakOnDeath(e){
    const line = deathLine(e);
    const cssClass = (e.role==='boss'?'ft-boss':(e.role==='elite'?'ft-elite':'ft-minion'));
    if(window.Game && typeof window.Game.spawnFloatText==='function'){
      window.Game.spawnFloatText(line, e.x, e.y, cssClass);
    }
  }

  window.Game = window.Game || {};
  window.Game.MonsterDialogue = {
    updateDialogue,
    speakOnDeath
  };
})();