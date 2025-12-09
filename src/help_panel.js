// help_panel.js  (<=500 lines)  -- Press 'H' to toggle help window with lore & instructions
(function(){
  const G = window.Game || {};

  // Create help container
  const panel = document.createElement('div');
  panel.id = 'helpPanel';
  panel.innerHTML = `
    <div class="hp-inner">
      <h2>【凡人修仙志·序章】</h2>
      <p>天地灵气复苏，妖邪肆虐，人族岌岌可危。你，肩负镇妖伏魔之命，收集灵兵法宝，破敌斩邪，于无尽妖潮中求得一线成仙契机！</p>

      <h3>【游戏玩法】</h3>
      <p>操纵主角在妖域中穿梭，拾取散落的兵器与法宝，自动御使兵器御敌。击败妖邪可掉落更多兵器。每隔一定时间将出现威力强大的Boss，击败它们以获得稀世法宝。合理使用法宝与战技逆转战局，存活更久，获取更高评价！</p>

      <h3>【快捷键】</h3>
      <ul>
        <li>W A S D：移动</li>
        <li>Space：冲刺/闪避</li>
        <li>E：发动战技「疯狂转刀」</li>
        <li>1：开启/停止战技「魔刀千刃」</li>
        <li>Q：释放已持有法宝</li>
        <li>M：显示/隐藏小地图</li>
        <li>C：修仙进境面板</li>
        <li>H：查看/关闭游戏说明</li>
        <li>P：暂停 / 继续</li>
      </ul>

      <h3>【战技与拾取规则】</h3>
      <ul>
        <li>战技期间只显示战技武器，普通武器会被立即摧毁。</li>
        <li>战技激活时，靠近地图上的武器掉落物将被直接摧毁并显示提示。</li>
        <li>疯狂转刀持续时间随你持有的最高品质提升；魔刀千刃为无限持续，可按「1」停止。</li>
      </ul>

      <p style="text-align:center;margin-top:12px;">按 <span style="color:#ffd700;font-weight:bold;">H</span> 键关闭</p>
    </div>
  `;
  Object.assign(panel.style, {
    position:'fixed', left:0, top:0, width:'100%', height:'100%',
    display:'none', alignItems:'center', justifyContent:'center',
    background:'rgba(0,0,0,0.5)', zIndex:40, color:'#fff',
    fontFamily:'KaiTi,serif'
  });
  const inner = panel.querySelector('.hp-inner');
  Object.assign(inner.style, {
    background:'rgba(30,20,10,0.92)',
    padding:'20px 32px', border:'2px solid #d4af37', borderRadius:'8px',
    maxWidth:'800px', width:'60%', lineHeight:'1.6',
    maxHeight:'80%', overflowY:'auto', textAlign:'left'
  });
  inner.querySelectorAll('h2').forEach(h=>{
    h.style.marginTop='0';
    h.style.textAlign='center';
    h.style.color='#ffeb8a';
  });
  inner.querySelectorAll('h3').forEach(h=>{
    h.style.color='#ffcc55';
  });

  document.body.appendChild(panel);

  let visible = false;
  function updateVis(){ panel.style.display = visible? 'flex':'none'; }

  function toggleHelp(){ visible = !visible; updateVis(); }

  // key listener
  document.addEventListener('keydown', e=>{
    if(e.key==='h' || e.key==='H'){
      toggleHelp();
    }
  });

  // expose for future
  window.HelpPanel = { toggle: toggleHelp, show:()=>{visible=true;updateVis();}, hide:()=>{visible=false;updateVis();} };
})();