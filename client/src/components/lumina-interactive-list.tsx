import React, { useEffect, useRef } from 'react';

declare const gsap: any;
declare const THREE: any;

export function Component() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shaderMaterial: any, renderer: any, scene: any, camera: any;
    let slideTextures: any[] = [];
    let texturesLoaded = false;
    let autoSlideTimer: any = null;
    let progressAnimation: any = null;
    let sliderEnabled = false;
    let isTransitioning = false;
    let currentSlideIndex = 0;
    
    (window as any).stopLuminaAnimation = false;

    const SLIDER_CONFIG: any = {
      settings: {
        transitionDuration: 1.2, autoSlideSpeed: 5000, currentEffect: "glass",
        globalIntensity: 1.0, speedMultiplier: 1.0, distortionStrength: 1.0, colorEnhancement: 1.0,
        glassRefractionStrength: 1.0, glassChromaticAberration: 1.0, glassBubbleClarity: 1.0, glassEdgeGlow: 1.0, glassLiquidFlow: 1.0
      }
    };

    const slides = [
      { title: "Ai Lab report Analyser", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/AILabReportAnalyser_DesktopSize_3f161f3f-0678-452f-9c1a-a413994df30a.png?v=1770719872", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/AILabReportAnalyser_MobileSize.png?v=1770719520" },
      { title: "Track Health Parameter", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/NutritionTracker_jpg.jpg?v=1770722505", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/TrackHealthParameter_MobileSize_jpg.jpg?v=1770719520" },
      { title: "Nutrition Tracker", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/TrackHealthParameter_DesktopSize_jpg.jpg?v=1770719871", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/NutritionTrackerMobile_jpg.jpg?v=1770722504" },
      { title: "Diet Recommendations", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/WhatsApp_Image_2026-02-07_at_6.44.25_PM.jpg?v=1770707929", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/2150040498_2__jpg.jpg?v=1770722504" },
      { title: "Supplement Recommendation", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/2150040498_jpg_f6df5fdb-1a8b-4c71-97ec-58643d0dca22.jpg?v=1770722509", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/NutritionTrackerMobile_jpg.jpg?v=1770722504" },
      { title: "Doctor Recommendation", media: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/WhatsApp_Image_2026-02-07_at_6.43.52_PM.jpg?v=1770707929", mediaMobile: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/TrackHealthParameter_MobileSize_jpg.jpg?v=1770719520" }
    ];

    const stopAutoSlideTimer = () => { if (progressAnimation) clearInterval(progressAnimation); if (autoSlideTimer) clearTimeout(autoSlideTimer); progressAnimation = null; autoSlideTimer = null; };

    const initRenderer = async () => {
      const canvas = document.querySelector(".webgl-canvas") as HTMLCanvasElement;
      if (!canvas) return;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
      const fragmentShader = `
        uniform sampler2D uTexture1, uTexture2;
        uniform float uProgress;
        uniform vec2 uResolution, uTexture1Size, uTexture2Size;
        varying vec2 vUv;
        vec2 getCoverUV(vec2 uv, vec2 textureSize) {
          vec2 s = uResolution / textureSize;
          float scale = max(s.x, s.y);
          vec2 scaledSize = textureSize * scale;
          vec2 offset = (uResolution - scaledSize) * 0.5;
          return (uv * uResolution - offset) / scaledSize;
        }
        void main() {
          vec2 uv1 = getCoverUV(vUv, uTexture1Size);
          vec2 uv2 = getCoverUV(vUv, uTexture2Size);
          gl_FragColor = mix(texture2D(uTexture1, uv1), texture2D(uTexture2, uv2), uProgress);
        }
      `;

      shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTexture1: { value: null }, uTexture2: { value: null }, uProgress: { value: 0 },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uTexture1Size: { value: new THREE.Vector2(1, 1) }, uTexture2Size: { value: new THREE.Vector2(1, 1) }
        },
        vertexShader, fragmentShader
      });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial));

      const isMobileDevice = window.innerWidth <= 768;
      const loader = new THREE.TextureLoader();

      for (const s of slides) {
        try {
          const imageUrl = isMobileDevice ? (s.mediaMobile || s.media) : s.media;
          const t = await new Promise<any>((res, rej) => loader.load(imageUrl, (tex: any) => res(tex), undefined, rej));
          t.minFilter = t.magFilter = THREE.LinearFilter;
          t.userData = { size: new THREE.Vector2(t.image.width, t.image.height) };
          slideTextures.push(t);
        } catch { }
      }

      if (slideTextures.length >= 2) {
        shaderMaterial.uniforms.uTexture1.value = slideTextures[0];
        shaderMaterial.uniforms.uTexture2.value = slideTextures[1];
        shaderMaterial.uniforms.uTexture1Size.value = slideTextures[0].userData.size;
        shaderMaterial.uniforms.uTexture2Size.value = slideTextures[1].userData.size;
        texturesLoaded = true;
        sliderEnabled = true;
      }

      const render = () => {
        if ((window as any).stopLuminaAnimation) {
          if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
          }
          return;
        }
        requestAnimationFrame(render);
        renderer.render(scene, camera);
      };
      render();
    };

    const loadScripts = async () => {
      const loadScript = (src: string, globalName: string) => new Promise<void>((res) => {
        if ((window as any)[globalName]) { res(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res();
        document.head.appendChild(s);
      });

      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'THREE');
        await initRenderer();
      } catch (e) {
        console.error('Lumina Load Error:', e);
      }
    };

    loadScripts();

    return () => {
      (window as any).stopLuminaAnimation = true;
      stopAutoSlideTimer();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) Array.isArray(obj.material) ? obj.material.forEach((m: any) => m.dispose()) : obj.material.dispose();
        });
      }
    };
  }, []);

  return (
    <div className="slider-wrapper relative h-[100vh] w-full overflow-hidden" ref={containerRef}>
      <canvas className="webgl-canvas absolute inset-0 h-full w-full"></canvas>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p id="mainTitle" className="text-white text-4xl font-bold uppercase"></p>
      </div>
    </div>
  );
}
