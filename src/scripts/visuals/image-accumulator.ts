import type p5 from 'p5';
import type { SketchProps, ImgItem } from './sketch-types';

export default function sketch(p: p5, props: SketchProps & { images?: ImgItem[]; interval?: number; scale?: number }){
  const imgs: p5.Image[] = [];
  let idx = 0; let last = 0;
  (p as any).interval = props.interval ?? 1400;
  (p as any).scale = props.scale ?? 1.0;

  p.preload = () => { for (const it of (props.images ?? [])) imgs.push(p.loadImage(it.src)); };

  p.setup = () => {
    p.createCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight);
    p.background(0); p.imageMode(p.CENTER); p.noStroke();
  };
  p.windowResized = () => p.resizeCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight);

  p.draw = () => {
    if (imgs.length === 0) return;
    if (p.millis() - last > (p as any).interval){
      const img = imgs[idx % imgs.length];
      const w = img.width * (p as any).scale; const h = img.height * (p as any).scale;
      const x = p.random(w*0.5, p.width - w*0.5); const y = p.random(h*0.5, p.height - h*0.5);
      p.push(); p.tint(255, 220); p.image(img, x, y, w, h); p.pop();
      if (p.random() < 0.4){ p.fill(255, 4); p.rect(0, 0, p.width, p.height); }
      idx++; last = p.millis();
    }
  };
}
