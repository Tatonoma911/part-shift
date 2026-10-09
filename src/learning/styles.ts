/**
 * Styles for the learning layer, injected once as a <style> tag so the single-file
 * artifact build keeps them. Brand rules: ui/BRAND_UI.md (ceramic plates with cut
 * corners and a cyan seam, caps captions «X // Y», Unbounded + Golos Text).
 */
const CSS = `
.psl-layer{position:fixed;inset:0;z-index:50;display:flex;justify-content:center;align-items:stretch;
  background:rgba(11,17,23,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  font-family:"Golos Text",system-ui,-apple-system,"Segoe UI",sans-serif;color:#10171C;
  animation:psl-fade .2s ease-out;-webkit-tap-highlight-color:transparent;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.psl-layer *{box-sizing:border-box}
@keyframes psl-fade{from{opacity:0}to{opacity:1}}
@keyframes psl-rise{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}
@keyframes psl-pop{0%{transform:scale(.92);opacity:0}100%{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.psl-layer,.psl-layer *{animation:none!important;transition:none!important}}

.psl-sheet{position:relative;width:100%;max-width:480px;height:100%;display:flex;flex-direction:column;
  background:linear-gradient(180deg,#DFEEF3 0%,#EDF4F5 38%,#F4F7F7 100%);
  box-shadow:0 0 0 1px rgba(17,90,128,.15),0 30px 80px rgba(11,17,23,.4);animation:psl-rise .28s cubic-bezier(.2,.8,.2,1)}
.psl-head{flex:none;padding:calc(14px + env(safe-area-inset-top)) 16px 10px;display:flex;align-items:center;gap:10px}
.psl-head-text{flex:1;min-width:0}
.psl-caps{font-family:Unbounded,"Golos Text",sans-serif;font-weight:700;font-size:10px;letter-spacing:.14em;color:#115A80;text-transform:uppercase}
.psl-title{font-family:Unbounded,"Golos Text",sans-serif;font-weight:800;font-size:22px;line-height:1.15;margin:3px 0 0;letter-spacing:-.01em}
.psl-title b{color:#007E89;font-weight:900}
.psl-btn-icon{flex:none;width:44px;height:44px;border:0;cursor:pointer;display:grid;place-items:center;
  background:#10171C;color:#fff;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psl-btn-icon:active{transform:scale(.95)}
.psl-btn-icon svg{width:20px;height:20px}
.psl-btn-icon.light{background:rgba(16,23,28,.08);color:#10171C}
.psl-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px calc(24px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.psl-body::-webkit-scrollbar{width:0}

.psl-plate{position:relative;background:#fff;padding:14px;
  clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)}
.psl-plate::after{content:"";position:absolute;inset:4px;pointer-events:none;border:1.5px solid rgba(87,216,242,.85);
  clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px)}

.psl-hero{display:flex;gap:12px;align-items:center;margin:6px 0 14px;padding:14px;cursor:pointer;
  background:linear-gradient(120deg,#10171C 0%,#163445 100%);color:#fff;
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.psl-hero .psl-caps{color:#57D8F2}
.psl-hero-title{font-family:Unbounded,sans-serif;font-weight:800;font-size:17px;margin-top:3px}
.psl-hero-sub{font-size:13px;opacity:.8;margin-top:3px}
.psl-hero-go{margin-left:auto;flex:none;width:46px;height:46px;display:grid;place-items:center;background:#007E89;
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psl-hero-go svg{width:20px;height:20px}
.psl-hero canvas,.psl-hero img{width:56px;height:56px;image-rendering:pixelated;flex:none}

.psl-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.psl-card{position:relative;border:0;text-align:left;cursor:pointer;background:#fff;padding:12px 12px 12px;min-height:118px;
  display:flex;flex-direction:column;gap:6px;font:inherit;color:inherit;
  clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
  box-shadow:inset 0 -3px 0 rgba(17,90,128,.12);transition:transform .12s}
.psl-card:active{transform:scale(.97)}
.psl-card-icon{width:40px;height:40px;image-rendering:pixelated;object-fit:contain}
.psl-card-title{font-family:Unbounded,sans-serif;font-weight:700;font-size:13.5px;line-height:1.2}
.psl-card-sub{font-size:12px;color:#5B6B75;line-height:1.3}
.psl-card-prog{position:absolute;right:12px;top:12px;font-family:Unbounded,sans-serif;font-size:9px;font-weight:700;letter-spacing:.1em;color:#007E89}
.psl-card-prog.done{color:#fff;background:#007E89;padding:3px 6px}

.psl-list{display:flex;flex-direction:column;gap:8px}
.psl-row{display:flex;gap:12px;align-items:center;border:0;background:#fff;padding:10px 12px;cursor:pointer;text-align:left;font:inherit;color:inherit;
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);transition:transform .12s}
.psl-row:active{transform:scale(.98)}
.psl-thumb{flex:none;width:52px;height:52px;display:grid;place-items:center;background:#EDF4F5;overflow:hidden}
.psl-thumb img,.psl-thumb canvas{max-width:100%;max-height:100%;image-rendering:pixelated}
.psl-row-name{font-weight:700;font-size:15px}
.psl-row-desc{font-size:12.5px;color:#5B6B75;line-height:1.3;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.psl-row-meta{margin-left:auto;flex:none;display:flex;align-items:center;gap:6px}
.psl-dot{width:8px;height:8px;background:#57D8F2;transform:rotate(45deg)}
.psl-play{width:26px;height:26px;display:grid;place-items:center;background:#007E89;color:#fff;
  clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.psl-play svg{width:12px;height:12px}

.psl-clip{position:relative;width:100%;cursor:pointer;background:#0B1117;overflow:hidden;
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.psl-clip canvas{display:block;width:100%;height:auto}
.psl-clip-cap{position:absolute;left:50%;bottom:12px;transform:translate(-50%,8px);max-width:calc(100% - 24px);
  padding:8px 14px;background:rgba(16,23,28,.88);color:#fff;font-weight:700;font-size:14px;line-height:1.25;text-align:center;
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);border-left:3px solid #57D8F2}
.psl-clip-cap.on{opacity:1;transform:translate(-50%,0)}
.psl-clip-cap.top{bottom:auto;top:12px}
.psl-clip-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:#57D8F2;transform-origin:left;transform:scaleX(0)}

.psl-entry-visual{margin:4px 0 14px}
.psl-sprite{display:grid;place-items:center;height:190px;background:radial-gradient(circle at 50% 70%,#fff 0%,#EDF4F5 60%,#DFEEF3 100%);
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.psl-sprite canvas,.psl-sprite img{image-rendering:pixelated;max-height:170px}
.psl-glyph{font-family:Unbounded,sans-serif;font-weight:800;font-size:64px}
.psl-h{font-family:Unbounded,sans-serif;font-weight:800;font-size:21px;line-height:1.2;margin:0 0 8px}
.psl-p{font-size:15.5px;line-height:1.45;margin:0 0 10px}
.psl-sub{font-family:Unbounded,sans-serif;font-weight:700;font-size:10px;letter-spacing:.14em;color:#115A80;text-transform:uppercase;margin:16px 0 8px}
.psl-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.psl-stat{background:#fff;padding:8px 10px;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.psl-stat-k{font-size:11px;color:#5B6B75}
.psl-stat-v{font-family:Unbounded,sans-serif;font-weight:800;font-size:15px;margin-top:2px}
.psl-tip{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;background:rgba(232,163,58,.14);border-left:3px solid #E8A33A;font-size:14px;line-height:1.4}
.psl-tip b{font-family:Unbounded,sans-serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#B5761A;flex:none;margin-top:2px}
.psl-chips{display:flex;flex-wrap:wrap;gap:6px}
.psl-chip{border:0;cursor:pointer;font:inherit;font-weight:600;font-size:13px;padding:8px 12px;background:rgba(16,23,28,.07);color:#10171C;
  clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.psl-chip:active{transform:scale(.96)}

.psl-steps{display:flex;gap:5px;margin:2px 0 12px}
.psl-steps i{flex:1;height:4px;background:rgba(17,90,128,.18)}
.psl-steps i.on{background:#007E89}
.psl-steps i.seen{background:#57D8F2}
.psl-nav{display:flex;gap:8px;margin-top:16px}
.psl-btn{flex:1;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:16px;padding:15px 16px;color:#fff;background:#007E89;
  box-shadow:inset 0 -4px 0 rgba(11,17,23,.35);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
.psl-btn.ghost{background:rgba(16,23,28,.08);color:#10171C;box-shadow:none}
.psl-btn.dark{background:#10171C}
.psl-btn:active{transform:translateY(1px)}
.psl-btn:disabled{opacity:.35;cursor:default}

.psl-coach-wrap{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(11,17,23,.5);animation:psl-fade .2s;font-family:"Golos Text",system-ui,sans-serif;color:#10171C}
.psl-coach{width:100%;max-width:400px;max-height:100%;overflow:auto;animation:psl-pop .25s cubic-bezier(.2,.8,.2,1)}
.psl-coach .psl-clip{margin:10px 0 12px}
.psl-check{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#5B6B75;margin-top:10px;cursor:pointer}
.psl-check input{accent-color:#007E89;width:16px;height:16px}

.psl-fab{position:fixed;z-index:40;right:max(12px,env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));
  width:44px;height:44px;border:0;cursor:pointer;display:grid;place-items:center;background:#F4F7F7;color:#115A80;
  font-family:Unbounded,sans-serif;font-weight:900;font-size:18px;box-shadow:0 4px 14px rgba(11,17,23,.2);
  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
`;

let injected = false;
export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const tag = document.createElement('style');
  tag.dataset.partshift = 'learning';
  tag.textContent = CSS;
  document.head.append(tag);
}
