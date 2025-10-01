import type p5 from 'p5';
import type { SketchProps } from './sketch-types';

export default function sketch(p: p5, props: SketchProps & { count?: number; speed?: number; noiseScale?: number }){
  (p as any).count = props.count ?? 240;
  (p as any).speed = props.speed ?? 1.4;
  (p as any).noiseScale = props.noiseScale ?? 0.0018;

  type Pt = { x:number; y:number; a:number };
  let pts: Pt[] = [];

  function reset(){
    pts = [];
    for (let i=0;i<(p as any).count;i++) pts.push({ x: p.random(p.width), y: p.random(p.height), a: p.random(p.TAU) });
  }

  p.setup = () => {
    p.createCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight);
    p.background(0);
    p.strokeWeight(1);
    p.noFill();
    reset();
  };

  p.windowResized = () => { p.resizeCanvas(props.width ?? p.windowWidth, props.height ?? p.windowHeight); reset(); };

  p.draw = () => {
    p.blendMode(p.ADD);
    p.stroke(255, 20);
    const speed = (p as any).speed; const ns = (p as any).noiseScale;
    for (const pt of pts){
      const n = p.noise(pt.x*ns, pt.y*ns, p.frameCount*0.003);
      const ang = n * p.TAU * 2.0; pt.a = ang;
      const nx = pt.x + Math.cos(ang)*speed; const ny = pt.y + Math.sin(ang)*speed;
      p.line(pt.x, pt.y, nx, ny);
      pt.x = (nx + p.width) % p.width; pt.y = (ny + p.height) % p.height;
    }
  };
}
