import { Vector2, type WebGLRenderer } from 'three';

/**
 * A panel of where each frame's time goes, for finding out why a machine somewhere else is slow: shown with F3 (or ?diag in
 * the address), hidden otherwise, and measuring nothing while hidden. Over the last few seconds, kept up to date a slice at
 * a time: frames, the slowest, how fast the game went, the main thread's time split into physics, the rest of the game and
 * handing the picture over, how long the graphics card itself took to draw it, the worker's share; and what the machine is.
 */

/** What the game adds up as it goes (game.ts's timing), ms and counts since the start. */
export interface DiagTiming {
  frames: number;
  physics: number;
  logic: number;
  render: number;
  steps: number;
}

export interface DiagSources {
  renderer: WebGLRenderer;
  timing: DiagTiming;
  level: string;
  quality: () => { choice: string; quality: string };
  physicsDt: () => number;
  threaded: () => boolean;
  /** Summed time the worker spent on its batches, and how many. */
  worker: () => { ms: number; batches: number } | null;
}

/** EXT_disjoint_timer_query_webgl2, as far as it is used here. */
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const QUALITY_NAME: Record<string, string> = { high: '高', medium: '中', low: '低', auto: '自動' };
/** A frame longer than this, ms, is a stutter. */
const STUTTER = 50;
/** Added up in slices this long, ms, and shown over the last WINDOW ms of them: steady numbers, still kept up to date. */
const SLICE = 500;
const WINDOW = 5000;

/** One slice's totals: ms, counts, and the slowest frame in it. */
interface Slice {
  ms: number;
  frames: number;
  physics: number;
  logic: number;
  render: number;
  steps: number;
  gpu: number;
  gpuFrames: number;
  worker: number;
  batches: number;
  slowest: number;
  stutters: number;
}

export class Diagnostics {
  private readonly el: HTMLDivElement;
  private shown = false;
  private readonly gl: WebGL2RenderingContext;
  private readonly timer: TimerExt | null;
  /** Graphics-card timings asked for and not yet back, oldest first. */
  private readonly asked: WebGLQuery[] = [];
  private drawing: WebGLQuery | null = null;
  /** The slice being added up, from when, and the running totals as they stood then. */
  private slice = Diagnostics.emptySlice();
  private from = 0;
  private start: DiagTiming = { frames: 0, physics: 0, logic: 0, render: 0, steps: 0 };
  private workerStart = { ms: 0, batches: 0 };
  /** The last few slices, oldest first: what is shown is all of them together. */
  private slices: Slice[] = [];
  private lastFrame = 0;
  private machine = '';
  private readonly size = new Vector2();

  constructor(private readonly src: DiagSources) {
    this.gl = src.renderer.getContext() as WebGL2RenderingContext;
    this.timer = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    this.el = document.createElement('div');
    this.el.id = 'diag';
    this.el.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:9999;padding:8px 10px;border-radius:4px;background:rgba(10,16,14,.8);color:#e6eedd;' +
      'font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre;pointer-events:none;display:none;max-width:calc(100vw - 32px);overflow:hidden';
    document.body.append(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'F3') return;
      e.preventDefault();
      this.toggle();
    });
    if (new URLSearchParams(location.search).has('diag')) this.toggle();
  }

  toggle(): void {
    this.shown = !this.shown;
    this.el.style.display = this.shown ? 'block' : 'none';
    if (this.shown) {
      this.machine = this.describeMachine();
      this.el.textContent = '診斷：量測中…';
      this.slices = [];
      this.lastFrame = 0;
      this.restart(performance.now());
    }
  }

  /** Around the frame's drawing: the graphics card's own time for it, where the browser tells it. */
  beginDraw(): void {
    if (!this.shown || !this.timer || this.drawing || this.asked.length > 6) return;
    const query = this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
    this.drawing = query;
  }

  endDraw(): void {
    if (!this.drawing || !this.timer) return;
    this.gl.endQuery(this.timer.TIME_ELAPSED_EXT);
    this.asked.push(this.drawing);
    this.drawing = null;
  }

  /**
   * Nothing going on that is the machine's doing (paused, a tab in the background): the slice so far is let go, and the
   * next frame starts a new one. What was shown stays until then.
   */
  rest(): void {
    this.lastFrame = 0;
  }

  /** Once a frame, at its end. */
  frame(now: number): void {
    if (!this.shown) return;
    // The first frame since opening the panel, or since a rest: from here on.
    if (!this.lastFrame) {
      this.lastFrame = now;
      this.restart(now);
      return;
    }
    const gap = now - this.lastFrame;
    this.slice.slowest = Math.max(this.slice.slowest, gap);
    if (gap > STUTTER) this.slice.stutters++;
    this.lastFrame = now;
    this.collectGpu();
    if (now - this.from >= SLICE) this.close(now);
  }

  private static emptySlice(): Slice {
    return { ms: 0, frames: 0, physics: 0, logic: 0, render: 0, steps: 0, gpu: 0, gpuFrames: 0, worker: 0, batches: 0, slowest: 0, stutters: 0 };
  }

  /** The slice done: its totals worked out from the running ones, kept with the last few, and all of them shown. */
  private close(now: number): void {
    const t = this.src.timing, s = this.start, worker = this.src.worker();
    Object.assign(this.slice, {
      ms: now - this.from,
      frames: t.frames - s.frames,
      physics: t.physics - s.physics,
      logic: t.logic - s.logic,
      render: t.render - s.render,
      steps: t.steps - s.steps,
      worker: worker ? worker.ms - this.workerStart.ms : 0,
      batches: worker ? worker.batches - this.workerStart.batches : 0,
    });
    this.slices.push(this.slice);
    if (this.slices.length > WINDOW / SLICE) this.slices.shift();
    this.show();
    this.restart(now);
  }

  private collectGpu(): void {
    if (!this.timer) return;
    const gl = this.gl;
    // A frame the card was interrupted in (the browser's own business) is told as disjoint: its timings are not to be trusted.
    const disjoint = gl.getParameter(this.timer.GPU_DISJOINT_EXT) as boolean;
    while (this.asked.length && gl.getQueryParameter(this.asked[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.asked.shift()!;
      if (!disjoint) {
        this.slice.gpu += (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
        this.slice.gpuFrames++;
      }
      gl.deleteQuery(query);
    }
  }

  private restart(now: number): void {
    this.from = now;
    this.slice = Diagnostics.emptySlice();
    this.start = { ...this.src.timing };
    const worker = this.src.worker();
    this.workerStart = worker ? { ...worker } : { ms: 0, batches: 0 };
  }

  private show(): void {
    const all = Diagnostics.emptySlice();
    for (const slice of this.slices) {
      for (const key of Object.keys(all) as (keyof Slice)[]) {
        all[key] = key === 'slowest' ? Math.max(all.slowest, slice.slowest) : all[key] + slice[key];
      }
    }
    const seconds = all.ms / 1000;
    const frames = Math.max(1, all.frames);
    const physics = all.physics / frames, rest = (all.logic - all.physics) / frames, hand = all.render / frames;
    const main = physics + rest + hand;
    const interval = all.ms / frames;
    const fps = frames / seconds;
    const speed = (all.steps * this.src.physicsDt()) / seconds;
    const gpu = all.gpuFrames ? all.gpu / all.gpuFrames : null;
    const worker = this.src.worker();
    const workerMs = all.worker, batches = all.batches;
    const workerLoad = worker ? workerMs / all.ms : 0;
    const info = this.src.renderer.info.render;
    const f = (n: number, d = 1) => n.toFixed(d);

    let verdict: string;
    if (fps >= 55 && speed >= 0.95) verdict = '順暢';
    else if (gpu !== null && gpu > interval * 0.75) verdict = '顯示卡跟不上（畫畫面太慢）';
    else if (worker && workerLoad > 0.85) verdict = '背景物理跟不上（CPU 太慢）';
    else if (main > interval * 0.75) verdict = `主執行緒太忙（CPU），最多的是${physics >= rest && physics >= hand ? '物理' : rest >= hand ? '遊戲邏輯' : '送出繪圖'}`;
    else verdict = '看不出來：可能是瀏覽器、其他程式或垂直同步';

    const lines = [
      `診斷　最近 ${f(seconds, 0)} 秒平均　F3 關閉`,
      `畫面　${f(fps, 0)} fps　最慢一格 ${f(all.slowest, 0)} ms　卡頓(>${STUTTER}ms) ${all.stutters} 次`,
      `遊戲速度　${f(speed * 100, 0)}%`,
      `每格 ${f(interval)} ms　主執行緒：物理 ${f(physics)}　邏輯 ${f(rest)}　送出繪圖 ${f(hand)}　（共 ${f(main)}）`,
      `顯示卡畫一格　${gpu === null ? (this.timer ? '量測中' : '這個瀏覽器量不到') : `${f(gpu)} ms`}`,
      worker ? `背景物理　每批 ${f(batches ? workerMs / batches : 0)} ms　忙碌 ${f(workerLoad * 100, 0)}%` : '背景物理　沒有使用（物理在主執行緒）',
      `繪圖　draw calls ${info.calls}　三角形 ${f(info.triangles / 1000, 0)}k`,
      `粗估：${verdict}`,
      '',
      this.machineLine(),
      this.machine,
    ];
    this.el.textContent = lines.join('\n');
  }

  /** What changes as it is played: the level, the quality, the picture's size, the physics. */
  private machineLine(): string {
    const { choice, quality } = this.src.quality();
    const size = this.src.renderer.getDrawingBufferSize(this.size);
    const ratio = this.src.renderer.getPixelRatio();
    return (
      `關卡 ${this.src.level}　畫質 ${QUALITY_NAME[quality]}${choice === 'auto' ? '（自動）' : ''}　解析度 ${size.x}×${size.y}（${f2(ratio)}x，螢幕 ${f2(window.devicePixelRatio)}x）\n` +
      `物理 ${Math.round(1 / this.src.physicsDt())} Hz，${this.src.threaded() ? '背景執行緒' : '主執行緒'}`
    );
  }

  /** What the machine is: asked once, when the panel is opened. */
  private describeMachine(): string {
    const gl = this.gl;
    const named = gl.getExtension('WEBGL_debug_renderer_info');
    const card = named ? String(gl.getParameter(named.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const ua = navigator.userAgent;
    const browser = /Edg\/([\d]+)/.exec(ua) ? `Edge ${/Edg\/([\d]+)/.exec(ua)![1]}` : /Firefox\/([\d]+)/.exec(ua) ? `Firefox ${/Firefox\/([\d]+)/.exec(ua)![1]}` : /Chrome\/([\d]+)/.exec(ua) ? `Chrome ${/Chrome\/([\d]+)/.exec(ua)![1]}` : ua.slice(0, 60);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return (
      `CPU ${navigator.hardwareConcurrency ?? '?'} 核心　${browser}${memory ? `　JS 記憶體 ${Math.round(memory.usedJSHeapSize / 1048576)} MB` : ''}\n` +
      `顯示卡 ${card}`
    );
  }
}

function f2(n: number): string {
  return Number(n.toFixed(2)).toString();
}
