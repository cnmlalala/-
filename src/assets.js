// 资源加载与图集管理（简单版），使用图片素材文件夹下的图片
// 为了快速可视化，这里仅加载主角与几把武器示例。

(function(){
  const base = '图片素材/';
  const paths = {
    player: base + '主角/主角1.png',
    weapon_sword: base + '武器/剑.png',
    weapon_staff: base + '武器/禅杖.png',
    boss_niumo: base + 'BOSS/牛魔王.png',
  };

  const images = {};
  const listeners = [];
  function loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let triedEncode = false;
      img.onload = () => { images[key] = img; resolve(img); notify(); };
      img.onerror = (e)=>{
        if(!triedEncode){
          triedEncode = true;
          const encoded = encodeURI(src);
          if(encoded !== src){
            console.warn('首次加载失败，尝试使用 encodeURI 路径:', encoded);
            img.src = encoded;
            return;
          }
        }
        console.error('图片加载失败:', key, src, e);
        reject(e);
      };
      // 先尝试直接路径
      img.src = src;
    });
  }

  function notify(){ listeners.forEach(fn=>fn()); }

  Promise.all(Object.entries(paths).map(([k,p])=>loadImage(k,p))).catch((err)=>{
    console.warn('部分图片加载失败，继续使用占位渲染', err);
  });

  // 对外暴露
  window.AssetStore = {
    images,
    onReady(fn){ listeners.push(fn); },
    registerImage(name, path){
      paths[name] = path;
      return loadImage(name, path).catch(()=>{
        console.warn('图片加载失败:', name, path);
      });
    }
  };
})();

// 额外资源注册（根据项目图片素材目录）
(function(){
  const prefix = '图片素材/';
  const extras = {
    // 小怪
    minion_rat: prefix + '小怪/小老鼠.png',
    minion_tree: prefix + '小怪/树精.png',
    minion_cute: prefix + '小怪/可爱怪.png',
    minion_swarm: prefix + '小怪/小怪群.png',
    // 新增小怪
    minion_pig: prefix + '小怪/猪精.png',
    minion_shrimp: prefix + '小怪/虾兵.png',
    // 精英
    elite_monk: prefix + '精英怪/和尚.png',
    elite_taoshi: prefix + '精英怪/道士.png',
    elite_xianbing: prefix + '精英怪/仙兵.png',
    elite_tudi: prefix + '精英怪/土地.png',
    // 新增精英
    elite_nvdizi: prefix + '精英怪/女弟子.png',
    elite_monu: prefix + '精英怪/魔女.png',
    // 建筑
    building_temple: prefix + '建筑/寺庙.png',
    building_daoguan: prefix + '建筑/道观.png',
    building_tiangong: prefix + '建筑/天宫.png',
    building_xianshan: prefix + '建筑/仙山.png',
    // 新增建筑
    building_pagoda: prefix + '建筑/宝塔.png',
    // 更多BOSS
    boss_fotuo: prefix + 'BOSS/佛陀.png',
    boss_nvXian: prefix + 'BOSS/女仙.png',
    boss_longwang: prefix + 'BOSS/龙王.png',
    // 新增BOSS
    boss_tiandi: prefix + 'BOSS/天帝.png',
    // 战技
    skill_moonblade: prefix + '战技/月牙刀.png',
    // 天平技能特效图片
    skill_balance_scale: prefix + 'boss技能素材/天平.png',
  };
  const store = window.AssetStore;
  if (store && store.registerImage) {
    Object.entries(extras).forEach(([k,p])=> store.registerImage(k,p));
  } else {
    console.warn('AssetStore 未就绪，额外图片未注册');
  }
})();