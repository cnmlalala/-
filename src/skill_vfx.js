// skill_vfx.js - 技能武器视觉效果模块（不影响普通武器），便于独立调节 (<=500 行)
(function(){
  const G = window.Game;
  const SkillVFX = {
    enableSkillGlow: false,
    normalBaseBlur: 8,
    normalQualityBlurStep: 3,
    skillGlowColor: 'transparent',
    skillGlowBlur: 0,
    // 新增：技能武器长度缩放（用于拉长武器以避免贴图被压扁的观感）
    skillLengthScale: 1.3,
    // 新增：轻微增宽比例（仅作用于技能武器）
    skillWidthScale: 1.1,
    isSkillWeapon(w){ return !!(w && (w.isMoonBlade || w.isSkillWeapon)); },
    getShadowForWeapon(w, actor, enableBlur){
      const QUALITY = G?.QUALITY || [];
      if(this.isSkillWeapon(w)){
        if(!this.enableSkillGlow){
          return { color: this.skillGlowColor, blur: 0 };
        }
        const q = w.quality||0; const color = QUALITY[q]?.color || '#ffffff';
        return { color, blur: this.skillGlowBlur };
      }
      if(!enableBlur){ return { color: 'transparent', blur: 0 }; }
      const q = w.quality||0; const color = QUALITY[q]?.color || '#ffffff';
      const blur = this.normalBaseBlur + q * this.normalQualityBlurStep;
      return { color, blur };
    },
    // 新增：根据贴图原始宽高比与长度缩放，返回绘制宽高，避免被压扁
    getDrawRect(w, sizeBase, img){
      // 默认方形
      let ar = 1;
      if(img && (img.naturalWidth||img.width) && (img.naturalHeight||img.height)){
        const iw = img.naturalWidth||img.width; const ih = img.naturalHeight||img.height;
        if(iw>0 && ih>0){ ar = iw/ih; }
      }
      let dw = sizeBase * ar;
      let dh = sizeBase;
      if(this.isSkillWeapon(w)){
        const kLen = Math.max(1, this.skillLengthScale||1);
        if(ar >= 1){ dw *= kLen; } else { dh *= kLen; }
        // 轻微增宽
        dw *= Math.max(1, this.skillWidthScale||1);
      }
      return { dw, dh };
    },
    setEnableSkillGlow(flag){ this.enableSkillGlow = !!flag; },
    setSkillGlow(color, blur){ this.skillGlowColor = color||'transparent'; this.skillGlowBlur = Math.max(0, blur||0); },
    setSkillLengthScale(scale){ this.skillLengthScale = Math.max(1, scale||1); },
    // 新增：设置技能武器增宽比例
    setSkillWidthScale(scale){ this.skillWidthScale = Math.max(1, scale||1); }
  };
  window.SkillVFX = SkillVFX;
})();