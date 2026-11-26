import { useEffect, useRef, useState } from "react";

const base = import.meta.env.BASE_URL;

export function LivingWhale() {
  const figure = useRef(null);
  const [paths, setPaths] = useState(null);

  useEffect(() => {
    const element = figure.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let worker;
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      try {
        worker = new Worker(`${base}wasm/whale-worker.js`);
        timer = window.setTimeout(() => worker.terminate(), 30000);
        worker.onmessage = ({ data }) => {
          if (Array.isArray(data.paths) && data.paths.length) setPaths(data.paths);
          window.clearTimeout(timer);
          worker.terminate();
        };
        worker.onerror = () => { window.clearTimeout(timer); worker.terminate(); };
        worker.postMessage("draw");
      } catch {
        // The pre-rendered illustration remains available.
      }
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => { observer.disconnect(); window.clearTimeout(timer); worker?.terminate(); };
  }, []);

  return (
    <figure className="living-whale" ref={figure} aria-label="A line drawing of a spouting whale">
      <div className="living-whale-field" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        {paths ? <svg className="living-whale-svg" viewBox="0 0 900 420" role="presentation">
          <g transform="translate(0 420) scale(1 -1)">
            {paths.map((points, index) => <polyline key={index} points={points} pathLength="1" />)}
          </g>
        </svg> : <img src={`${base}whale-blueprint.svg`} alt="" width="900" height="420" />}
      </div>
      <figcaption><span>FIG. 01 / A WHALE, IN LINES</span><span>BUILT FROM LIGHT &amp; IMAGINATION</span></figcaption>
    </figure>
  );
}
