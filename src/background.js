// background.js - 背景设置与绘制模块，便于后续扩展
(function(){
  // 势力范围（城镇/宗门等）区域颜色——草绿色
  const BG_FACTION    = '#4a7f3b';
  // 郊外/荒野区域颜色——同样草绿色，使整体统一
  const BG_WILDERNESS = '#4a7f3b';

  // 计算势力范围矩形（可按需修改为更复杂形状或从配置读取）
  function getFactionRect(world){
    const marginX = world.width  * 0.15; // 留15%边界为郊外
    const marginY = world.height * 0.15;
    return {
      x: marginX,
      y: marginY,
      w: world.width  - marginX*2,
      h: world.height - marginY*2
    };
  }

  /**
   * 根据世界坐标返回对应背景颜色
   * @param {number} x 世界坐标X
   * @param {number} y 世界坐标Y
   * @param {object} world 全局 world 对象
   */
  function getColor(x, y, world){
    const rect = getFactionRect(world);
    if(x>=rect.x && x<=rect.x+rect.w && y>=rect.y && y<=rect.y+rect.h){
      return BG_FACTION;
    }
    return BG_WILDERNESS;
  }

  /**
   * 绘制整张地图背景（先郊外，后势力范围），需在摄像机变换生效后调用。
   * @param {CanvasRenderingContext2D} ctx 画布上下文
   * @param {object} world 世界尺寸
   */
  function drawBackground(ctx, world){
    // 绘制郊外背景
    ctx.fillStyle = BG_WILDERNESS;
    ctx.fillRect(0, 0, world.width, world.height);

    // 绘制势力范围矩形
    const r = getFactionRect(world);
    ctx.fillStyle = BG_FACTION;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // 向全局导出，方便其他模块引用/修改
  window.Game = window.Game || {};
  window.Game.Background = {
    BG_FACTION,
    BG_WILDERNESS,
    getColor,
    drawBackground,
    getFactionRect
  };
})();