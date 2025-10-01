import type p5 from 'p5';
import type { SketchProps, ImgItem } from './sketch-types';

export default function sketch(p: p5, props: SketchProps & { images?: ImgItem[]; cols?: number; rows?: number; glitchEvery?: number }){
  const imgs: p5.Image[] = [];
  let lastGlitch = 0;

  (p as any).cols = Math.max(1, props.cols ?? 6);
  (p as any).rows = Math.max(1, props.rows ?? 4);
  (p as any).glitchEvery = props.glitchEvery ?? 350;

  p.preload = () => {
    (props.images ?? []).forEach(i => imgs.push(p.loadImage(i.src)));
  };

  p.setup = () => {
    p.createCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight);
    p.noStroke();
    p.imageMode(p.CORNER);
  };

  p.windowResized = () => { p.resizeCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight); };

  function drawGrid(){
    const cols = Math.max(1, (p as any).cols);
    const rows = Math.max(1, (p as any).rows);
    const cellW = p.width / cols;
    const cellH = p.height / rows;
    const n = cols * rows;
    for (let i=0;i<n;i++){
      const cx = i % cols; const cy = (i / cols) | 0;
      const x = cx * cellW; const y = cy * cellH;
      const img = imgs.length ? imgs[i % imgs.length] : undefined;
      if (img) p.image(img, x, y, cellW, cellH); else { p.fill(((i*47)%255)); p.rect(x, y, cellW, cellH); }
    }
  }

  function glitch(){
    const bands = 8 + ((p.frameCount>>0) % 8);
    for (let i=0;i<bands;i++){
      const y = p.random(p.height);
      const h = p.random(2, 18);
      const dx = p.random(-40, 40);
      p.copy(p.drawingContext.canvas as any, 0, y, p.width, h, dx, y, p.width, h);
    }
  }

  p.draw = () => {
    drawGrid();
    if (p.millis() - lastGlitch > (p as any).glitchEvery){ glitch(); lastGlitch = p.millis(); }
  };
}
