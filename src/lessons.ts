// The tutorial's guide: one lesson at a time in a line at the top of the screen, said when its place comes up, ticked off
// when it is done; more said under it once the player has been at it a while or has had to try again; a ring on the
// ground where to go. Only on a level that has lessons.

import * as THREE from 'three';
import type { LessonDesc, Vec2 } from './levels/types';
import type { Sim } from './sim/sim';

/** Seconds at one lesson before the fuller help is said as well. */
const HELP_AFTER = 12;
/** Seconds the tick stays up before the next lesson comes in. */
const TICK_SECONDS = 1.1;

const el = (id: string) => document.getElementById(id) as HTMLElement;

export class LessonGuide {
  private index = 0;
  /** How long the present lesson has been up, seconds; how many times it has had to be tried again. */
  private age = 0;
  private tries = 0;
  /** Counting down while a finished lesson's tick is showing. */
  private ticking = 0;
  /** Whether the crossing's lamps have come on during the present lesson: once they go off again, the train is by. */
  private trainSeen = false;
  private shownHtml = '';
  private readonly strip = el('lesson');
  private readonly step = el('lesson-step');
  private readonly text = el('lesson-text');
  private readonly help = el('lesson-help');
  /** The ring on the ground to make for. */
  readonly ring = new THREE.Group();
  private ringAge = 0;
  /** Called when a lesson is done, and when the last is. */
  onLesson: (finished: number) => void = () => {};

  constructor(private readonly lessons: LessonDesc[]) {
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 40, 1, true), glow);
    wall.position.y = 1.1;
    const floor = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.4, 40), glow);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.08;
    this.ring.add(wall, floor);
    this.ring.visible = false;
    document.body.classList.add('practice');
  }

  /** Back to the first lesson, as at the start. */
  restart(): void {
    this.index = 0;
    this.age = 0;
    this.tries = 0;
    this.ticking = 0;
    this.trainSeen = false;
    this.strip.classList.remove('done');
  }

  /** The lesson being taught, or null when they are all done. */
  get current(): LessonDesc | null {
    return this.lessons[this.index] ?? null;
  }

  /** Something went wrong at the present lesson: it is to be tried again, with more said. Where to put the truck back. */
  mishap(): { pos: Vec2; yaw: number } {
    this.tries++;
    this.age = 0;
    this.trainSeen = false;
    return this.current?.retry ?? this.lessons[0].retry;
  }

  /** Where the arrow should point: the ring, or failing that the delivery bay. */
  goal(sim: Sim): Vec2 | null {
    const lesson = this.current;
    if (!lesson || this.hidden(lesson, sim)) return null;
    if (lesson.done === 'found') {
      const crate = sim.cargo.find((c) => c.bonus && c.body);
      if (crate?.fallen && !crate.held) {
        const p = crate.body!.translation();
        return [p.x, p.z];
      }
      return null;
    }
    return lesson.goal ?? null;
  }

  update(dt: number, sim: Sim, pad: boolean): void {
    this.ringAge += dt;
    if (this.ticking > 0) {
      this.ticking -= dt;
      if (this.ticking > 0) return;
      this.strip.classList.remove('done');
      this.index++;
      this.age = 0;
      this.tries = 0;
      this.trainSeen = false;
    }
    const lesson = this.current;
    if (!lesson) {
      this.show('', '');
      this.ring.visible = false;
      return;
    }
    if (this.done(lesson, sim)) {
      this.ticking = TICK_SECONDS;
      this.strip.classList.add('done');
      this.ring.visible = false;
      this.onLesson(this.index);
      return;
    }
    if (this.hidden(lesson, sim)) {
      this.show('', '');
      this.ring.visible = false;
      return;
    }
    this.age += dt;
    const task = lesson.done === 'found' ? this.fetching(sim, pad) : pad ? lesson.pad : lesson.keys;
    this.show(task, this.tries > 0 || this.age > HELP_AFTER ? lesson.help : '');
    const goal = this.goal(sim);
    this.ring.visible = !!goal;
    if (goal) {
      this.ring.position.set(goal[0], 0, goal[1]);
      // Round something to pick up, small and low, so as not to hide it; round a place to drive to, the truck's size.
      const small = lesson.done === 'found';
      const pulse = (small ? 0.5 : 1) * (1 + Math.sin(this.ringAge * 3) * 0.05);
      this.ring.scale.set(pulse, small ? 0.4 : 1, pulse);
    }
  }

  /** The line at the top: the step's number and its task, and the help beneath when there is some. Empty hides it. */
  private show(task: string, help: string): void {
    const html = task ? `${task}|${help}` : '';
    if (html === this.shownHtml) return;
    this.shownHtml = html;
    this.strip.hidden = !task;
    if (!task) return;
    this.step.textContent = `${this.index + 1} / ${this.lessons.length}`;
    this.text.innerHTML = task;
    this.help.textContent = help;
    this.help.hidden = !help;
    // In again, so that a new line is seen to be new.
    this.strip.classList.remove('in');
    void this.strip.offsetWidth;
    this.strip.classList.add('in');
  }

  /** Not yet reached: its line is left empty until then. Put back to try it again, it is said at once. */
  private hidden(lesson: LessonDesc, sim: Sim): boolean {
    return this.tries === 0 && lesson.from !== undefined && sim.truck.body.translation().z < lesson.from;
  }

  private done(lesson: LessonDesc, sim: Sim): boolean {
    if (lesson.done === 'delivered') return !!sim.result;
    if (lesson.done === 'found') {
      const crate = sim.cargo.find((c) => c.bonus);
      return !!crate && !crate.fallen && !crate.held && sim.driver.mode === 'driving';
    }
    const p = sim.truck.body.translation();
    // Stopped for the train: said to be done there and then, so that the next lesson is up while it goes by.
    const stop = lesson.done.stopBefore;
    if (stop !== undefined && p.z < stop && sim.driver.mode === 'driving') {
      const red = sim.trains.warning(0);
      if (red && p.z > (lesson.from ?? -Infinity) && Math.abs(sim.truck.forwardSpeed()) < 0.5) return true;
      // Or the train has gone by while the truck was still short of the line, however slowly it came: waited, as it should.
      if (red) this.trainSeen = true;
      else if (this.trainSeen) return true;
    }
    return p.z > lesson.done.pastZ && p.y > -0.5 && sim.driver.mode === 'driving';
  }

  /** Fetching what was found in the road, in its parts: out, over to it, up with it, back to the bed, back in. */
  private fetching(sim: Sim, pad: boolean): string {
    const crate = sim.cargo.find((c) => c.bonus);
    const k = (keys: string, controller: string) => `<b>${pad ? controller : keys}</b>`;
    if (!crate?.body) return '貨摔壞了，按 ' + k('R', 'Back') + ' 重來';
    if (sim.driver.mode === 'driving') {
      return Math.abs(sim.truck.forwardSpeed()) > 1.5 ? '前面路邊有一個保險箱：在它旁邊停車' : `按 ${k('C', 'Y')} 下車`;
    }
    if (crate.held) return pad ? '走到車尾，用<b>右搖桿</b>對準車斗，按住 <b>RT</b> 蓄力、放開拋上去' : '走到車尾，滑鼠對準車斗，<b>按住左鍵</b>蓄力、放開拋上去';
    if (crate.fallen) return `走到保險箱旁邊，按 ${k('E', 'B')} 舉起`;
    return `保險箱上車了！回到駕駛座，按 ${k('C', 'Y')} 上車`;
  }
}
