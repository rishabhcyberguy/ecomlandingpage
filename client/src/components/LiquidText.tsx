import { useEffect, useRef, useState } from "react";
import type { BufferGeometry, CanvasTexture, Material, Mesh, OrthographicCamera, Raycaster, Scene, ShaderMaterial, Vector2, WebGLRenderer } from "three";

type ThreeNamespace = typeof import("three");

interface LiquidTextProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  className?: string;
}

function createTextTexture(THREE: ThreeNamespace, text: string, fontSize: number, fontFamily: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas text rendering is unavailable.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${fontSize}px ${fontFamily}`;
  const measured = context.measureText(text).width;
  if (measured > canvas.width * 0.9) {
    const adjustedSize = fontSize * ((canvas.width * 0.9) / measured);
    context.font = `900 ${adjustedSize}px ${fontFamily}`;
  }
  context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.9);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const vertexShader = `
  varying vec2 vUv;
  uniform vec3 uDisplacement;
  float easeInOutCubic(float x) {
    return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
  }
  float mapRange(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }
  void main() {
    vUv = uv;
    vec3 displaced = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    float dist = length(uDisplacement - worldPosition.xyz);
    float minDistance = 2.8;
    if (dist < minDistance) {
      float mapped = mapRange(dist, 0.0, minDistance, 1.0, 0.0);
      displaced.z += easeInOutCubic(mapped) * 0.7;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main() {
    gl_FragColor = texture2D(uTexture, vUv);
  }
`;

/** One pointer-reactive hero treatment with real, selectable text in the DOM. */
export default function LiquidText({
  text,
  fontSize = 260,
  fontFamily = '"Barlow Condensed", sans-serif',
  color = "#111110",
  className = "",
}: LiquidTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [staticFallback, setStaticFallback] = useState(true);

  useEffect(() => {
    const current = containerRef.current;
    if (!current) return;
    const container: HTMLSpanElement = current;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let three: ThreeNamespace | null = null;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: OrthographicCamera | null = null;
    let geometry: BufferGeometry | null = null;
    let material: ShaderMaterial | null = null;
    let texture: CanvasTexture | null = null;
    let hitPlane: Mesh | null = null;
    let raycaster: Raycaster | null = null;
    let pointer: Vector2 | null = null;
    let intersection: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationId = 0;
    let visible = document.visibilityState === "visible";
    let reduceMotion = motionPreference.matches;
    let importing = false;
    let initialized = false;
    let disposed = false;

    const cleanupScene = () => {
      if (animationId) window.cancelAnimationFrame(animationId);
      animationId = 0;
      intersection?.disconnect();
      resizeObserver?.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (renderer?.domElement.parentNode === container) container.removeChild(renderer.domElement);
      if (hitPlane) {
        hitPlane.geometry.dispose();
        (hitPlane.material as Material).dispose();
      }
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      renderer = null;
      scene = null;
      camera = null;
      hitPlane = null;
      raycaster = null;
      pointer = null;
      three = null;
      initialized = false;
    };

    const render = () => {
      animationId = 0;
      if (!disposed && visible && !reduceMotion && renderer && scene && camera) renderer.render(scene, camera);
    };
    const scheduleRender = () => {
      if (!disposed && visible && !reduceMotion && renderer && !animationId) animationId = window.requestAnimationFrame(render);
    };

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" || !three || !material || !camera || !hitPlane || !raycaster || !pointer || reduceMotion) return;
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObject(hitPlane);
      if (hit) (material.uniforms.uDisplacement.value as InstanceType<ThreeNamespace["Vector3"]>).copy(hit.point);
      scheduleRender();
    }

    function onPointerLeave() {
      const displacement = material?.uniforms.uDisplacement.value as InstanceType<ThreeNamespace["Vector3"]> | undefined;
      displacement?.set(1000, 1000, 1000);
      scheduleRender();
    }

    function resize() {
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !renderer || !camera) return;
      const cameraDistance = 4.1;
      const nextAspect = bounds.width / bounds.height;
      camera.left = -cameraDistance * nextAspect;
      camera.right = cameraDistance * nextAspect;
      camera.top = cameraDistance;
      camera.bottom = -cameraDistance;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
      scheduleRender();
    }

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible";
      if (visible) scheduleRender();
      else if (animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
      }
    };

    function onMotionChange(event: MediaQueryListEvent) {
      reduceMotion = event.matches;
      setStaticFallback(event.matches || !initialized);
      if (renderer) renderer.domElement.style.display = event.matches ? "none" : "block";
      if (event.matches && animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
      }
      if (!event.matches) {
        if (!initialized) void initialize();
        else scheduleRender();
      }
    }

    async function initialize() {
      if (disposed || reduceMotion || initialized || importing) return;
      importing = true;
      try {
        three = await import("three");
        importing = false;
        if (disposed || reduceMotion || !three) return;
        const THREE = three;
        const bounds = container.getBoundingClientRect();
        if (bounds.width < 4 || bounds.height < 4) {
          setStaticFallback(true);
          return;
        }

        const cameraDistance = 4.1;
        const aspect = bounds.width / bounds.height;
        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-cameraDistance * aspect, cameraDistance * aspect, cameraDistance, -cameraDistance, 0.01, 100);
        camera.position.set(0, 0, 9);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setSize(bounds.width, bounds.height, false);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        container.appendChild(renderer.domElement);

        geometry = new THREE.PlaneGeometry(15, 5.2, 64, 32);
        texture = createTextTexture(THREE, text, fontSize, fontFamily, color);
        material = new THREE.ShaderMaterial({
          uniforms: {
            uTexture: { value: texture },
            uDisplacement: { value: new THREE.Vector3(1000, 1000, 1000) },
          },
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        scene.add(new THREE.Mesh(geometry, material));

        hitPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(500, 500),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hitPlane.position.z = 0.1;
        scene.add(hitPlane);
        raycaster = new THREE.Raycaster();
        pointer = new THREE.Vector2();
        initialized = true;

        intersection = typeof IntersectionObserver !== "undefined"
          ? new IntersectionObserver(([entry]) => {
              visible = entry.isIntersecting && document.visibilityState === "visible";
              if (visible) scheduleRender();
              else if (animationId) {
                window.cancelAnimationFrame(animationId);
                animationId = 0;
              }
            }, { threshold: 0.01 })
          : null;
        intersection?.observe(container);
        resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        resizeObserver?.observe(container);
        container.addEventListener("pointermove", onPointerMove, { passive: true });
        container.addEventListener("pointerleave", onPointerLeave, { passive: true });
        window.addEventListener("resize", resize, { passive: true });
        document.addEventListener("visibilitychange", onVisibilityChange);
        void document.fonts?.ready.then(scheduleRender);
        setStaticFallback(false);
        scheduleRender();
      } catch {
        importing = false;
        cleanupScene();
        if (!disposed) setStaticFallback(true);
      }
    }

    motionPreference.addEventListener("change", onMotionChange);
    if (!reduceMotion) void initialize();

    return () => {
      disposed = true;
      motionPreference.removeEventListener("change", onMotionChange);
      cleanupScene();
    };
  }, [text, fontSize, fontFamily, color]);

  return (
    <span className={`liquid-text ${className}`}>
      <span className="liquid-text__source">{text}</span>
      {staticFallback ? <span aria-hidden="true" className="liquid-text__fallback">{text}</span> : null}
      <span ref={containerRef} className="liquid-text__canvas" aria-hidden="true" />
    </span>
  );
}
