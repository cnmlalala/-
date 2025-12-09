// codex_panel.js - 图鉴面板（Boss/精英背景与技能） <=500行
(function(){
  const G = window.Game || {};

  // -----------------------------
  // 数据：Boss与精英图鉴
  // -----------------------------
  const CodexData = {
    bosses: [
      {
        id:'fairy', name:'花怨·女仙', title:'花怨缠骨·谷雨哀情', img:'图片素材/BOSS/女仙.png',
        story:
          '此地是上古碎阵之所，血雨浸花根，怨声缠藤影。她本誓护山护水，如今借战死者的甜香遮住腐朽，用花海引人入梦。\n\n每当夜色落下，花瓣里会浮出那些未说出口的悔——失散的名字，未归的骨。她不再劝人守心，只教人忘心：在藤蔓的温柔里，连遗言都学会了微笑。',
        skills:[
          {name:'花舞缭乱', desc:'残花作刃，甜香遮杀。醉者多以为归乡，醒来时只剩一具向花而眠的躯壳。'},
          {name:'藤蔓缠绕', desc:'藤缠心骨，软语递索。牵到手的那刻，心志已被她系好，一寸一寸地收走。'},
          {name:'自然共鸣', desc:'借山川之气滋养私欲，绿光外柔内毒。战场上的兵器被她点亮，从此只听从她的花意。'}
        ]
      },
      {
        id:'niumo', name:'裂土·牛魔王', title:'裂土焦宴·骨杯枭烈', img:'图片素材/BOSS/牛魔王.png',
        story:
          '这片焦土是他最好的酒席。他以焰换酒、以力求名，收集头骨做杯，向余烬吹嘘旧日义气。裂地之步踏碎誓言，火光里影影绰绰，全是曾经同路的人。\n\n挡路的都成了谈资，逃开的也在下一次被请回火里——他很懂，故事要有结尾，最好是烧到只剩黑。',
        skills:[
          {name:'熔岩震地', desc:'地火是他的债主，每一步都向旁人索取喘息。震裂之下，留给别人的是窒息与迟来的悔。'},
          {name:'火焰风暴', desc:'怒焰裹身，连他自己的誓言也化作灰烬。他说：灰也是一种荣耀。'},
          {name:'蛮牛冲撞', desc:'逞一时之勇，破阵之后只剩碎裂的面子与空壳豪言。烈火里，谁还记得初衷。'},
          {name:'怒火环绕', desc:'以怒为护身，近者灼伤，远者亦被逼屈膝；他最爱看别人低头的样子——像旧友。'}
        ]
      },
      {
        id:'longwang', name:'夺潮·龙王', title:'夺潮雷狱·海陵暴主', img:'图片素材/BOSS/龙王.png',
        story:
          '他用潮汐清账，用雷霆改名。在尸骨与旌旗间，甘霖开始要价，慈悲成了筹码。犯海疆者受罚，不犯者也要被“规整”；他说这是秩序，别人说是沉。\n\n每一场雨都像是审判，每一次退潮都带走几段未完的句子。后来连海也学会了静默，只剩雷在替他说话。',
        skills:[
          {name:'潮汐波动', desc:'用潮清账，失足者被连根拖走，化作他秩序里的供品与注脚。'},
          {name:'大海水', desc:'压顶的不仅是海，更是他的面子与威势；被压的人都学会了屏住呼吸，然后沉下去。'},
          {name:'水龙卷（吸收）', desc:'卷走他人的力与气，转成自己的账面，再拿来讲“平衡”。记账的人从不承认亏。'},
          {name:'暴雨梨花', desc:'雨如箭，欠情者一箭不落；旧账从不漏雨，新冤也被冲得干净。'}
        ]
      },
      {
        id:'buddha', name:'静域·佛陀', title:'静域收渡·光背藏刃', img:'图片素材/BOSS/佛陀.png',
        story:
          '灯影背后的人，也会折戒；金光照不见私心。他以静为笼，收束战场的喧嚣，教人把哭声放下，把仇恨藏好——说是渡，实是收。\n\n许多人坐下时自以为悟，起身时名字被磨平，只记得服从；等到回望， Discover that one lamp is left with the last breath of life.',
        skills:[
          {name:'禅寂领域', desc:'以静为笼，让你以为自悟，实则被困在他布下的秩序里。连冤也被规范成了顺从。'},
          {name:'佛光普照', desc:'一层温光，逐寸剥去你的棱角，叫你“合于善”；合久了，就再难说不。'},
          {name:'坐禅补刀（被动）', desc:'看出你的气息散乱，便在沉默里补上一记，让你以为是自己的错。悔意由你承担，他的手却干净。'}
        ]
      },
      {
        id:'tiandi', name:'锈衡·天帝', title:'锈衡雷狱·九霄枭主', img:'图片素材/BOSS/天帝.png',
        story:
          '久坐高位的秩序执掌者，用锈了的衡器要求众生服从。雷罚成了护权的旗帜，口口声声为天下，实则为他自己端稳天衡。\n\n他最擅改写对错：逆天者受罚，不逆者也要学会低头。战场上的名字他用雷抹去，然后把沉默写成秩序。',
        skills:[
          {name:'天罚雷击', desc:'以“天”为名的警告，多半是叫人看清他坐得多高；抬头久了，脖子会酸。'},
          {name:'神域禁制', desc:'划地为牢，谁越线谁就是错——对错由他一句话改写，冤只管被收纳。'},
          {name:'众生平等', desc:'一时的平等，是他决定谁先低头；抬与压都在他的手上，衡器只管显示结果。'}
        ]
      }
    ],
    elites: [
      {
        name:'残营·仙兵', img:'图片素材/精英怪/仙兵.png',
        stories:[
          '曾护军旗，今为残食。甲胄仍亮，却掩不住眼底的浑浊；杀得越多，影子越长。',
          '兄弟的名字被风吹散，他把它们一块块钉在盾面上；日久，所有名字都变成一个：「存活」。',
          '重回旧营，他低声念纪律，也为自己找借口；旁人说他忠，他心里明白——他只是还想活。',
          '夜半巡逻，他会将陌生人的哭声记成敌情，因为他不敢承认那哭声里也有自己的名字。',
          '他学会用他人的遗物填补自己的胆怯，直到盾背比骨堆还重。'
        ]
      },
      {
        name:'破戒·和尚', img:'图片素材/精英怪/和尚.png',
        stories:[
          '为亡者诵经，也为生者敛财。念珠滚落，心思也随之滚落；经文有慈悲，手却有价码。',
          '战后埋葬的，多是无名，他口中“施主勿执”，手上却卖护身；哭声一停，他便开始数香火钱。',
          '他会告诉你因果，却只讲有利的那段；你以为得度，他不过是在度自己的盘缠。',
          '夜深时，他把破袈裟铺在地上，数着每一道血痕——那是比经卷更实在的布施。',
          '临终的施主抓住他的袖口，却只记得问一句：还有香火钱吗？'
        ]
      },
      {
        name:'祠司·土地', img:'图片素材/精英怪/土地.png',
        stories:[
          '他管一方土地，却拿火把换祭祀。战线拉长，他分坟地也分人心。',
          '血从沟渠淌下，他说那是“治理”，祠庙里香火浓，门外的人却冷。',
          '问他善恶，他指账本：“看这里。”长期以来，他忘了哪一页写的是好。',
          '他把孩子的名字刻在碑下，说他是保佑；只有他知道，那是他保住自己的方法。',
          '他把最柔软的一块地留给自己，叫“风水”——埋下去的，是不敢说的亏心。'
        ]
      },
      {
        name:'名教·女弟子', img:'图片素材/精英怪/女弟子.png',
        stories:[
          '她的剑很冷，为了名她很热。每一次快剑都要想起另一个人，于是刀尖开始挑拣敌人与俘虏。',
          '门口挂着她的名号，像一件漂亮的衣裳；她把规矩说得很好听。',
          '后来她每夜都哭，不是为死者，而是为自己那一寸还没撕破的名。',
          '她在旧碑前停步很久，没敢认出碑上那个名字；因为那人是她亲手送去的。',
          '她在血泊中拾起那枚落泪的玉佩，把它磨亮，继续把自己磨钝。'
        ]
      },
      {
        name:'青符·道士', img:'图片素材/精英怪/道士.png',
        stories:[
          '他一层一层叠咒，把人的命折成纸符。把祟写在黄纸上，再卖给需要“安”的人。',
          '心里自称清，他把“清”写进账目，能卖个好价。',
          '深夜他对着那些符咒发呆，看见的不是神意，是自己越来越像祟的脸。',
          '他替人驱邪，也把自己驱出人群；等到需要人送他最后一程时，只有纸符作伴。',
          '他念咒时声音很稳，只有他自己知道，那是害怕被谁听见真实的颤。'
        ]
      },
      {
        name:'幽魅·魔女', img:'图片素材/精英怪/魔女.png',
        stories:[
          '她把欲望缝在剑缝里，把恐惧藏在衣褶里。她懂人心，也懂怕；她喜欢与影子为伍。',
          '她最爱对死者低语，让他们在自白里承认自己，随后把灵魂轻轻带走。',
          '后来她累了；不是厌倦堕落，是厌倦那些把堕落叫作爱的人。',
          '她放下镜子，镜里只剩她不愿再看的脸——那张脸曾让太多人盲从。',
          '她在坟边试图学会哭，最后只学会了更好地安慰活人。'
        ]
      }
    ]
  };

  // -----------------------------
  // DOM：图鉴面板
  // -----------------------------
  const overlay = document.createElement('div');
  overlay.id = 'codexPanel';
  Object.assign(overlay.style, {
    position:'fixed', left:0, top:0, width:'100%', height:'100%',
    display:'none', alignItems:'center', justifyContent:'center',
    background:'rgba(0,0,0,0.55)', zIndex:50, color:'#fff',
    fontFamily:'KaiTi, serif', pointerEvents:'auto'
  });

  const inner = document.createElement('div');
  inner.className = 'cdx-inner';
  Object.assign(inner.style, {
    background:'rgba(28,18,10,0.94)',
    border:'2px solid #d4af37', borderRadius:'10px',
    boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
    width:'80%', maxWidth:'980px', maxHeight:'82%',
    display:'grid', gridTemplateColumns:'280px 1fr', gap:'0',
    overflow:'hidden'
  });
  overlay.appendChild(inner);

  // 左侧列表
  const left = document.createElement('div');
  Object.assign(left.style, {
    borderRight:'1px solid rgba(212,175,55,0.35)',
    padding:'14px 12px', overflowY:'auto'
  });
  inner.appendChild(left);

  const title = document.createElement('div');
  title.textContent = '【上古战场·山海残卷】';
  Object.assign(title.style, {
    fontSize:'22px', color:'#ffeb8a', textAlign:'center', marginBottom:'8px',
    textShadow:'0 0 6px rgba(249,213,139,0.6)'
  });
  left.appendChild(title);

  // 分类标题
  function mkSectionHeader(txt){
    const h = document.createElement('div');
    h.textContent = txt;
    Object.assign(h.style, {
      fontSize:'18px', color:'#ffcc55', margin:'10px 6px 6px',
      borderBottom:'1px dashed rgba(212,175,55,0.35)', paddingBottom:'4px'
    });
    return h;
  }

  left.appendChild(mkSectionHeader('上古战场·魁首录'));
  const bossList = document.createElement('div'); left.appendChild(bossList);
  left.appendChild(mkSectionHeader('上古战场·群魔簿'));
  const eliteList = document.createElement('div'); left.appendChild(eliteList);

  function mkItem(txt, onClick){
    const d = document.createElement('div');
    d.textContent = txt;
    Object.assign(d.style, {
      fontSize:'16px', padding:'6px 8px', margin:'2px 0', cursor:'pointer',
      borderRadius:'6px'
    });
    d.addEventListener('mouseenter', ()=>{ d.style.background='rgba(255,255,255,0.06)'; });
    d.addEventListener('mouseleave', ()=>{ d.style.background='transparent'; });
    d.addEventListener('click', onClick);
    return d;
  }

  // 将名称解析为派系前缀与主体名
  function parseName(full){
    const i = full.indexOf('·');
    return i>=0 ? { prefix: full.slice(0, i), base: full.slice(i+1) } : { prefix:'', base: full };
  }

  // 徽章样式
  function mkBadge(label){
    const s = document.createElement('span');
    if(!label){ return s; }
    s.textContent = label;
    Object.assign(s.style, {
      display:'inline-block',
      fontSize:'12px',
      padding:'2px 6px',
      margin:'0 8px 0 0',
      color:'#ffffff',
      background:'rgba(255,215,128,0.22)',
      border:'1px solid #d4af37',
      borderRadius:'999px',
      boxShadow:'inset 0 0 4px rgba(212,175,55,0.4)'
    });
    return s;
  }

  // 列表条目（带徽章）
  function mkItemBadge(badgeLabel, mainText, onClick){
    const d = document.createElement('div');
    Object.assign(d.style, {
      fontSize:'16px', padding:'6px 8px', margin:'2px 0', cursor:'pointer',
      borderRadius:'6px'
    });
    const badge = mkBadge(badgeLabel);
    if(badgeLabel){ d.appendChild(badge); }
    const text = document.createElement('span');
    text.textContent = mainText;
    d.appendChild(text);
    d.addEventListener('mouseenter', ()=>{ d.style.background='rgba(255,255,255,0.06)'; });
    d.addEventListener('mouseleave', ()=>{ d.style.background='transparent'; });
    d.addEventListener('click', onClick);
    return d;
  }

  // 右侧详情
  const detail = document.createElement('div');
  Object.assign(detail.style, {
    padding:'18px 22px', overflowY:'auto'
  });
  inner.appendChild(detail);

  const detailTitle = document.createElement('div');
  Object.assign(detailTitle.style, { fontSize:'22px', color:'#ffe7aa', marginBottom:'6px' });
  detail.appendChild(detailTitle);

  const detailSub = document.createElement('div');
  Object.assign(detailSub.style, { fontSize:'16px', color:'#ffd074', marginBottom:'8px' });
  detail.appendChild(detailSub);

  // 新增：角色贴图
  const detailPortrait = document.createElement('img');
  detailPortrait.alt = '角色贴图';
  Object.assign(detailPortrait.style, {
    width:'160px', height:'auto',
    border:'2px solid #d4af37', borderRadius:'8px',
    boxShadow:'0 6px 14px rgba(0,0,0,0.5)',
    margin:'6px 0 12px 18px',
    float:'right',
    background:'rgba(255,255,255,0.04)'
  });
  detail.appendChild(detailPortrait);

  const detailStory = document.createElement('div');
  Object.assign(detailStory.style, { fontSize:'15px', lineHeight:'1.8', color:'#e9e4d8', whiteSpace:'pre-wrap' });
  detail.appendChild(detailStory);

  const skillHeader = document.createElement('div');
  skillHeader.textContent = '【技能】';
  Object.assign(skillHeader.style, { fontSize:'18px', color:'#ffcc55', margin:'12px 0 6px' });
  detail.appendChild(skillHeader);

  const skillList = document.createElement('div');
  detail.appendChild(skillList);

  function renderBoss(b){
    // 标题：徽章 + 主体名 + 标题
    detailTitle.innerHTML = '';
    const nb = parseName(b.name);
    const badge = mkBadge(nb.prefix);
    if(nb.prefix){ detailTitle.appendChild(badge); }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `「${nb.base}」${b.title||''}`;
    detailTitle.appendChild(nameSpan);
    detailSub.textContent = '战场纪述';
    if(b.img){ detailPortrait.src = b.img; detailPortrait.style.display = 'block'; }
    else { detailPortrait.style.display = 'none'; }
    detailStory.textContent = b.story || '';
    skillHeader.style.display = 'block';
    skillList.innerHTML = '';
    for(const s of (b.skills||[])){
      const row = document.createElement('div');
      Object.assign(row.style, { margin:'4px 0', padding:'4px 6px', background:'rgba(255,255,255,0.04)', borderRadius:'6px' });
      const name = document.createElement('div');
      Object.assign(name.style, { fontSize:'16px', color:'#ffd74d', fontWeight:'bold' });
      name.textContent = `· ${s.name}`;
      const desc = document.createElement('div');
      Object.assign(desc.style, { fontSize:'14px', color:'#dcd9c9' });
      desc.textContent = s.desc || '';
      row.appendChild(name); row.appendChild(desc);
      skillList.appendChild(row);
    }
  }

  function renderElite(e){
    // 标题：徽章 + 主体名
    detailTitle.innerHTML = '';
    const ne = parseName(e.name);
    const badge = mkBadge(ne.prefix);
    if(ne.prefix){ detailTitle.appendChild(badge); }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `「${ne.base}」`;
    detailTitle.appendChild(nameSpan);
    detailSub.textContent = '废土逸闻';
    if(e.img){ detailPortrait.src = e.img; detailPortrait.style.display = 'block'; }
    else { detailPortrait.style.display = 'none'; }
    const stories = Array.isArray(e.stories)? e.stories : (e.story? [e.story] : []);
    detailStory.textContent = stories.join('\n\n');
    skillHeader.style.display = 'none';
    skillList.innerHTML = '';
  }

  // 填充列表（使用徽章而非文本前缀）
  CodexData.bosses.forEach((b)=>{
    const nb = parseName(b.name);
    bossList.appendChild(mkItemBadge(nb.prefix, nb.base, ()=>{ renderBoss(b); }));
  });
  CodexData.elites.forEach((e)=>{
    const ne = parseName(e.name);
    eliteList.appendChild(mkItemBadge(ne.prefix, ne.base, ()=>{ renderElite(e); }));
  });

  // 右上角关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    position:'absolute', right:'10px', top:'6px',
    width:'28px', height:'28px', lineHeight:'28px', textAlign:'center',
    color:'#fff', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'8px',
    cursor:'pointer', userSelect:'none'
  });
  overlay.appendChild(closeBtn);
  closeBtn.addEventListener('mouseenter', ()=>{ closeBtn.style.background='rgba(255,255,255,0.16)'; });
  closeBtn.addEventListener('mouseleave', ()=>{ closeBtn.style.background='rgba(255,255,255,0.08)'; });

  document.body.appendChild(overlay);

  // 可见性
  let visible = false;
  function updateVis(){ overlay.style.display = visible? 'flex':'none'; }
  function toggle(){ visible = !visible; updateVis(); }
  function show(){ visible = true; updateVis(); }
  function hide(){ visible = false; updateVis(); }

  // 热键：B 键显示/隐藏
  document.addEventListener('keydown', e=>{
    if(e.key==='b' || e.key==='B'){ toggle(); }
  });
  closeBtn.addEventListener('click', hide);

  // 默认显示第一位Boss以示例
  renderBoss(CodexData.bosses[0]);

  // 暴露接口
  window.CodexPanel = { toggle, show, hide, data: CodexData };
})();