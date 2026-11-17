/// <reference lib="webworker" />
import { PHYSICS } from '../config';
import { LEVELS } from '../levels';
import { Recorder } from './record';
import { RECORDED_OPS, type StepRecord } from './schema';
import { Sim } from './sim';
import type { FootInput } from './driver';
import type { DriveInput } from './truck';

/**
 * The simulation in a worker of its own: the level made again here from its name, stepped as the main thread asks, and
 * each step's record sent back to the replica there. It keeps no clock: it does what it is asked, in order, and answers.
 */

/** What the main thread asks of it, in the order the game did these things. */
export type Op =
  | { op: 'step'; drive: DriveInput; foot: FootInput }
  | { op: 'reset' }
  | { op: 'backToSave' }
  | { op: 'teleport'; x: number; z: number; yaw: number; floor?: number }
  | { op: 'honk' }
  | { op: 'shut'; shut: boolean }
  | { op: 'rate'; dt: number };

export type ToWorker = { kind: 'start'; level: string; dt: number; slow?: number } | { kind: 'run'; ops: Op[] };
/** Back: the first record, everything; then, for each batch of ops, a record after each of them. */
export type FromWorker = { kind: 'started'; record: StepRecord } | { kind: 'ran'; records: StepRecord[]; took: number } | { kind: 'failed'; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let sim: Sim | null = null;
let recorder: Recorder | null = null;
/** For testing a slow machine: the worker takes this many times as long as it needs. The browser's own slowing of the page leaves workers alone. */
let slow = 1;

function post(message: FromWorker, records: StepRecord[]): void {
  scope.postMessage(message, records.map((r) => r.poses.buffer as ArrayBuffer));
}

function run(op: Op): void {
  const s = sim!;
  switch (op.op) {
    case 'step': s.step(op.drive, op.foot); break;
    case 'reset': s.reset(); break;
    case 'backToSave': s.backToSave(); break;
    case 'teleport': s.teleport(op.x, op.z, op.yaw, op.floor); break;
    case 'honk': s.honk(); break;
    case 'shut': s.finishShut = op.shut; break;
    case 'rate': PHYSICS.dt = op.dt; break;
  }
}

scope.onmessage = async ({ data }: MessageEvent<ToWorker>) => {
  try {
    if (data.kind === 'start') {
      PHYSICS.dt = data.dt;
      slow = data.slow ?? 1;
      sim = await Sim.create(LEVELS[data.level]());
      recorder = new Recorder(sim);
      const record = recorder.record();
      post({ kind: 'started', record }, [record]);
      return;
    }
    const began = performance.now();
    const records: StepRecord[] = [];
    for (const op of data.ops) {
      run(op);
      if (RECORDED_OPS.includes(op.op)) records.push(recorder!.record());
    }
    const took = performance.now() - began;
    if (slow > 1) for (const until = performance.now() + took * (slow - 1); performance.now() < until;);
    post({ kind: 'ran', records, took: performance.now() - began }, records);
  } catch (e) {
    scope.postMessage({ kind: 'failed', message: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) } satisfies FromWorker);
  }
};
