// 균형 게임 rapier2d 물리 월드 (동적 로딩)
import { BALL_RADIUS_PX, GRAVITY_MS2, LINEAR_DAMPING, PX_PER_M, type Circle, type Gravity, type Point } from './scoring';

type RapierModule = typeof import('@dimforge/rapier2d-compat');
type Rapier = RapierModule['default'];

export const FIXED_STEP_S = 1 / 60;
const MAX_FRAME_S = 0.25;
const MAX_SUBSTEPS = 8;

export interface BallReading {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PhysicsWorld {
  step(dtMs: number, gravity: Gravity): void;
  ball(): BallReading;
  dispose(): void;
}

let loading: Promise<Rapier> | null = null;

export function loadRapier(): Promise<Rapier> {
  if (!loading) {
    loading = (async () => {
      const mod = await import('@dimforge/rapier2d-compat');
      const rapier = (mod.default ?? mod) as Rapier;
      await rapier.init();
      return rapier;
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

export function createPhysics(rapier: Rapier, start: Point, obstacles: readonly Circle[]): PhysicsWorld {
  const world = new rapier.World({ x: 0, y: 0 });
  world.timestep = FIXED_STEP_S;
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(start.x / PX_PER_M, start.y / PX_PER_M)
      .setLinearDamping(LINEAR_DAMPING)
      .setCcdEnabled(true),
  );
  world.createCollider(rapier.ColliderDesc.ball(BALL_RADIUS_PX / PX_PER_M).setRestitution(0.3).setFriction(0.2), body);
  for (const o of obstacles) {
    world.createCollider(rapier.ColliderDesc.ball(o.r / PX_PER_M).setTranslation(o.x / PX_PER_M, o.y / PX_PER_M).setRestitution(0.3));
  }
  let accumulator = 0;
  let alive = true;
  return {
    step(dtMs, gravity) {
      if (!alive) return;
      world.gravity = { x: gravity.x * GRAVITY_MS2, y: gravity.y * GRAVITY_MS2 };
      accumulator += Math.min(Math.max(Number.isFinite(dtMs) ? dtMs : 0, 0) / 1000, MAX_FRAME_S);
      let steps = 0;
      while (accumulator >= FIXED_STEP_S && steps < MAX_SUBSTEPS) {
        world.step();
        accumulator -= FIXED_STEP_S;
        steps++;
      }
      if (steps === MAX_SUBSTEPS) accumulator = 0;
    },
    ball() {
      const t = body.translation();
      const v = body.linvel();
      return { x: t.x * PX_PER_M, y: t.y * PX_PER_M, vx: v.x * PX_PER_M, vy: v.y * PX_PER_M };
    },
    dispose() {
      if (!alive) return;
      alive = false;
      world.free();
    },
  };
}
