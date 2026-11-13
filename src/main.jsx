import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { PARTS as keys, initialMix, shareUrl } from "./mixer";
import { drawWhale } from "./compositor";

const base = import.meta.env.BASE_URL;
const asset = (path) => base + path.replace(/^\/?/, "");
const pad = (n) => String(n).padStart(2, "0");

function ImageAsset({ item }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="image-error">Image unavailable</span>
  ) : (
    <img
      src={asset(item.file)}
      alt={`${item.name} spouting whale emoji`}
      width="160"
      height="160"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function App() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "dark",
  );
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]').content =
      next === "light" ? "#f3f8f7" : "#07141e";
    try {
      localStorage.setItem("whale-theme", next);
    } catch {
      // The current session still works when storage is unavailable.
    }
    setTheme(next);
  };
  const [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const [parts, setParts] = useState(null),
    [softness, setSoftness] = useState(20),
    [images, setImages] = useState({});
  const [failed, setFailed] = useState([]),
    [notice, setNotice] = useState(""),
    [exportUrl, setExportUrl] = useState("");
  const canvas = useRef(null),
    lab = useRef(null),
    recipeVersion = useRef(0);
  const invalidateExport = () => {
    recipeVersion.current += 1;
    setExportUrl("");
    setNotice("");
  };
  useEffect(
    () => () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    },
    [exportUrl],
  );
  useEffect(() => {
    fetch(asset("whales/manifest.json"))
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || !data.length) throw Error();
        setItems(data);
        const initial = initialMix(data, location.search);
        setParts(initial.parts);
        setSoftness(initial.softness);
        data.forEach((item) => {
          const img = new Image();
          img.onload = () => setImages((prev) => ({ ...prev, [item.id]: img }));
          img.onerror = () => setFailed((prev) => [...prev, item.id]);
          img.src = asset(item.file);
        });
      })
      .catch(() =>
        setError(
          "The collection could not be loaded. Please try refreshing the page.",
        ),
      );
  }, []);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [items, query],
  );
  const ready = parts && keys.every((key) => images[parts[key]]);
  useEffect(() => {
    if (ready && canvas.current)
      drawWhale(canvas.current, images, parts, softness);
  }, [images, parts, softness, ready]);
  const choose = (id) => {
    invalidateExport();
    setParts(Object.fromEntries(keys.map((key) => [key, id])));
    setNotice("Specimen loaded into the lab.");
    lab.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  const reset = () => {
    invalidateExport();
    setParts(
      Object.fromEntries(
        keys.map((key, i) => [key, items[i % items.length].id]),
      ),
    );
    setSoftness(20);
    setNotice("Lab reset.");
  };
  const shuffle = () => {
    invalidateExport();
    setParts(
      Object.fromEntries(
        keys.map((key) => [
          key,
          items[Math.floor(Math.random() * items.length)].id,
        ]),
      ),
    );
    setNotice("A new combination is ready.");
  };
  const share = async () => {
    const url = shareUrl(location.href, parts, softness);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied to your clipboard.");
    } catch {
      setNotice("Copy this link: " + url);
    }
  };
  const download = () => {
    const version = recipeVersion.current;
    try {
      canvas.current.toBlob((blob) => {
        try {
          if (version !== recipeVersion.current) return;
          if (!blob) throw new Error("PNG creation failed");
          const url = URL.createObjectURL(blob);
          setExportUrl(url);
          const a = document.createElement("a");
          a.download = "the-whale-splice.png";
          a.href = url;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setNotice(
            "Your transparent PNG is ready. If the download did not start, use the link below.",
          );
        } catch {
          setNotice("Could not create the PNG. Please try again.");
        }
      }, "image/png");
    } catch {
      setNotice("Could not create the PNG. Please try again.");
    }
  };
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">◉</span> THE WHALE{" "}
          <span className="brand-divider">/</span>{" "}
          <span className="brand-sub">FIELD GUIDE</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#collection">The collection</a>
          <a href="#lab">Splice lab ↗</a>
        </nav>
        <span className="edition">EST. ONLINE · 01</span>
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
          <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
        </button>
      </header>
      <main id="top">
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="dot" /> AN INTERNET FIELD GUIDE{" "}
              <span className="eyebrow-line" /> U+1F433
            </p>
            <h1>
              One whale.
              <br />
              <em>Many ways</em>
              <br />
              to whale<span className="blue">.</span>
            </h1>
            <p className="hero-desc">
              A small celebration of the world's most wonderfully inconsistent
              sea creature. Same emoji, different oceans.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#collection">
                Explore the collection <span>↘</span>
              </a>
              <a className="text-link" href="#lab">
                Go make a monster ↗
              </a>
            </div>
          </div>
          <div className="hero-art" aria-label="A spouting whale illustration">
            <div className="hero-art-top">
              <span>SPECIMEN / 001</span>
              <span>NOT TO SCALE ↗</span>
            </div>
            <div className="hero-whale">🐳</div>
            <div className="ripple r1" />
            <div className="ripple r2" />
            <div className="ripple r3" />
            <div className="hero-art-bottom">
              <span>SPOTTED IN THE WILD</span>
              <span>THE SPOUTING WHALE</span>
            </div>
          </div>
          <div className="hero-index">
            <span>SCROLL TO DIVE ↓</span>
            <span>FIELD NOTES / VOL. 01</span>
          </div>
        </section>
        <div className="ticker" aria-hidden="true">
          <span>ONE CODE POINT</span>
          <b>✳</b>
          <span>A SEA OF INTERPRETATIONS</span>
          <b>✳</b>
          <span>COLLECT. COMPARE. COMBINE.</span>
          <b>✳</b>
          <span>ONE CODE POINT</span>
        </div>
        <section className="collection wrap" id="collection">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="dot" /> THE COLLECTION
              </p>
              <h2>
                Same whale.
                <br />
                <em>Different waters.</em>
              </h2>
            </div>
            <div className="section-intro">
              <p>
                From friendly to slightly concerned, every platform has its own
                take. Take a closer look, then send one to the lab.
              </p>
              <span>THE SPECIMENS ↓</span>
            </div>
          </div>
          <div className="collection-tools">
            <label htmlFor="search">SEARCH THE COLLECTION</label>
            <div className="search-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                id="search"
                type="search"
                placeholder="Find a platform..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span className="results">
              {pad(filtered.length)} / {pad(items.length)} SPECIMENS
            </span>
          </div>
          {error ? (
            <p className="empty" role="alert">
              {error}
            </p>
          ) : !items.length ? (
            <div
              className="loading-grid"
              role="status"
              aria-label="Loading specimens"
            >
              {Array.from({ length: 4 }, (_, i) => (
                <div className="loading-specimen" key={i}>
                  <span />
                  <i />
                  <span />
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="specimen-grid">
              {filtered.map((item) => (
                <button
                  className="specimen"
                  key={item.id}
                  onClick={() => choose(item.id)}
                >
                  <div className="specimen-meta">
                    <span>FIG. {pad(items.indexOf(item) + 1)}</span>
                    <span>↗</span>
                  </div>
                  <div className="specimen-image">
                    <ImageAsset item={item} />
                  </div>
                  <div className="specimen-label">
                    <div>
                      <span>PLATFORM</span>
                      <h3>{item.name}</h3>
                    </div>
                    <span className="specimen-plus">+</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty">
              No whales found for “{query}”. Try another platform.
            </p>
          )}
          <div className="collection-foot">
            <span>END OF THE LINE / FOR NOW</span>
            <span>SELECT A SPECIMEN TO START SPLICING ↗</span>
          </div>
        </section>
        <section className="lab" id="lab" ref={lab}>
          <div className="wrap">
            <div className="lab-heading">
              <div>
                <p className="eyebrow">
                  <span className="dot yellow" /> THE SPLICE LAB
                </p>
                <h2>
                  Make waves.
                  <br />
                  <em>Make weird.</em>
                </h2>
              </div>
              <p>
                What if every whale had a little bit of every other whale? Pick
                your parts and find out.
              </p>
            </div>
            <div className="lab-grid">
              <div className="lab-preview">
                <div className="preview-top">
                  <span>LIVE SPECIMEN / YOUR CREATION</span>
                  <span className="live">
                    <i /> EXPERIMENT IN PROGRESS
                  </span>
                </div>
                <div className="canvas-wrap">
                  <div className="crosshair c1">+</div>
                  <div className="crosshair c2">+</div>
                  <canvas
                    ref={canvas}
                    aria-label="Preview of your spliced whale"
                  />
                  {!ready && (
                    <div className="canvas-message">
                      {failed.some(
                        (id) => parts && keys.some((key) => parts[key] === id),
                      )
                        ? "A selected image could not be loaded. Choose another specimen."
                        : "Preparing your specimen…"}
                    </div>
                  )}
                </div>
                <div className="preview-bottom">
                  <span>FIG. X / THE IMPROBABLE WHALE</span>
                  <span>NOT FOUND IN NATURE</span>
                </div>
              </div>
              <div className="lab-controls">
                <div className="controls-title">
                  <div>
                    <span>ASSEMBLY INSTRUCTIONS</span>
                    <h3>
                      Choose your parts<span>.</span>
                    </h3>
                  </div>
                  <span className="control-number">01—04</span>
                </div>
                <p className="control-desc">
                  These are experimental image slices, so the seams and
                  surprises are part of the fun.
                </p>
                {parts &&
                  keys.map((key, i) => (
                    <label className="part-row" key={key}>
                      <span>
                        <small>{pad(i + 1)}</small>{" "}
                        {key[0].toUpperCase() + key.slice(1)}
                      </span>
                      <select
                        value={parts[key]}
                        onChange={(e) => {
                          invalidateExport();
                          setParts({ ...parts, [key]: e.target.value });
                        }}
                      >
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                <label className="seam">
                  <span>
                    SOFTEN SEAMS <b>{softness}%</b>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={softness}
                    onChange={(e) => {
                      invalidateExport();
                      setSoftness(Number(e.target.value));
                    }}
                  />
                  <span className="range-ends">
                    <small>SHARP</small>
                    <small>SOFT</small>
                  </span>
                </label>
                <div className="control-actions">
                  <button
                    className="button lime"
                    disabled={!ready}
                    onClick={download}
                  >
                    Download PNG <span>↓</span>
                  </button>
                  <button
                    className="button outline-light"
                    disabled={!parts}
                    onClick={share}
                  >
                    Copy share link <span>↗</span>
                  </button>
                </div>
                <div className="secondary-actions">
                  <button disabled={!parts} onClick={shuffle}>
                    ↝ &nbsp; Shuffle parts
                  </button>
                  <button disabled={!parts} onClick={reset}>
                    ↺ &nbsp; Reset lab
                  </button>
                </div>
                <p className="notice" role="status">
                  {notice}
                </p>
                {exportUrl && (
                  <a
                    className="download-fallback"
                    href={exportUrl}
                    download="the-whale-splice.png"
                  >
                    Save PNG ↗
                  </a>
                )}
              </div>
            </div>
            <div className="lab-foot">
              <span>MADE OF MANY WHALES. BELONGS TO NO OCEAN.</span>
              <span>YOUR CREATION STAYS IN YOUR BROWSER.</span>
            </div>
          </div>
        </section>
        <section className="sources wrap" id="sources">
          <details>
            <summary>
              Specimen sources &amp; licenses <span>+</span>
            </summary>
            <p>
              Emoji artwork belongs to its respective creators. Follow each
              source for version and license information.
            </p>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span>
                    {item.version} · {item.license}
                  </span>
                  <a href={item.source} target="_blank" rel="noreferrer">
                    View source ↗
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </section>
        <section className="outro wrap">
          <div>
            <p className="eyebrow">
              <span className="dot" /> A LITTLE NOTE FROM THE DEEP
            </p>
            <h2>
              Different looks.
              <br />
              <em>Same little whale.</em>
            </h2>
            <p>
              However you see it, there's something wonderful about a tiny whale
              bringing a little more joy to the internet. Thanks for stopping
              by.
            </p>
          </div>
          <img
            src={asset("whale-blueprint.svg")}
            alt="Line drawing of a whale"
            loading="lazy"
            width="800"
            height="400"
          />
        </section>
      </main>
      <footer>
        <div className="wrap footer-main">
          <a className="footer-brand" href="#top">
            THE WHALE<span>.</span>
          </a>
          <p>
            An unofficial field guide to an
            <br />
            extraordinary ordinary emoji.
          </p>
          <div>
            <a
              href="https://unicode.org/emoji/charts/full-emoji-list.html"
              target="_blank"
              rel="noreferrer"
            >
              Unicode emoji chart ↗
            </a>
            <a href="#sources">Specimen sources ↗</a>
            <a
              href="https://github.com/roonil03/TheWhale"
              target="_blank"
              rel="noreferrer"
            >
              Project &amp; sources ↗
            </a>
          </div>
          <a className="back-top" href="#top">
            BACK TO TOP ↑
          </a>
        </div>
        <div className="wrap footer-bottom">
          <span>MADE FOR THE LOVE OF THE WHALE</span>
          <span>U+1F433 · SPOUTING WHALE</span>
          <span>END TRANSMISSION ◉</span>
        </div>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
