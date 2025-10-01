export type SketchProps = Record<string, any> & {
  width?: number;
  height?: number;
  pixelRatio?: number;
};

export type ImgItem = {
  id: number;
  src: string;
  title?: string;
};
