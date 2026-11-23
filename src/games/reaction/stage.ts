// 반응속도 테스트 Three.js 배경 렌더러
import { Color, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';

export type StageTone = 'ready' | 'waiting' | 'shown' | 'over';

const TONES: Record<StageTone, string> = {
  ready: '#151a24',
  waiting: '#10131a',
  shown: '#13261c',
  over: '#2a1416',
};

export interface Stage {
  setTone(tone: StageTone): void;
  resize(): void;
  dispose(): void;
}

export function createStage(host: HTMLElement): Stage {
  let renderer: WebGLRenderer | null = null;
  try {
    renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch {
    renderer = null;
  }

  if (!renderer) {
    host.style.background = TONES.ready;
    return {
      setTone: (tone) => {
        host.style.background = TONES[tone];
      },
      resize: () => undefined,
      dispose: () => undefined,
    };
  }

  const gl = renderer;
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  gl.domElement.className = 'stage-canvas';
  host.appendChild(gl.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshBasicMaterial({ color: new Color(TONES.ready) });
  scene.add(new Mesh(geometry, material));

  const render = () => gl.render(scene, camera);

  const resize = () => {
    const { clientWidth, clientHeight } = host;
    if (clientWidth === 0 || clientHeight === 0) return;
    gl.setSize(clientWidth, clientHeight, false);
    render();
  };

  resize();

  return {
    setTone(tone) {
      material.color.set(TONES[tone]);
      render();
    },
    resize,
    dispose() {
      geometry.dispose();
      material.dispose();
      gl.dispose();
      gl.domElement.remove();
    },
  };
}
