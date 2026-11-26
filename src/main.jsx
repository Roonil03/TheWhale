import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { PARTS as keys, shareUrl } from "./mixer";
const SpliceLab = lazy(() =>
  import("./SpliceLab").then((module) => ({ default: module.SpliceLab })),
);
import { LivingWhale } from "./LivingWhale";

const base = import.meta.env.BASE_URL;
const asset = (path) => base + path.replace(/^\/?/, "");
const labPage = location.pathname.endsWith("/lab.html");
if (
  !labPage &&
  keys.some((key) => new URLSearchParams(location.search).has(key))
) {
  location.replace(`${asset("lab.html")}${location.search}${location.hash}`);
}
const labUrl = (id) =>
  shareUrl(
    new URL(asset("lab.html"), location.href).href,
    Object.fromEntries(keys.map((key) => [key, id])),
    20,
  );
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
  useEffect(() => {
    if (labPage) return;
    // Revalidate the collection after Pages releases while retaining HTTP caching.
    fetch(asset("whales/manifest.json"), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || !data.length) throw Error();
        setItems(data);
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
        `${item.name} ${item.version}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [items, query],
  );
  const choose = (id) => {
    location.assign(labUrl(id));
  };
  return (
    <>
      <header className="topbar">
        <a className="brand" href={asset("")}>
          <span className="desktop-copy">
            <span className="brand-mark">◉</span> THE WHALE{" "}
            <span className="brand-divider">/</span>{" "}
            <span className="brand-sub">FIELD GUIDE</span>
          </span>
          <span className="mobile-copy">
            <span className="brand-mark" aria-hidden="true">≋</span> The Whale
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href={asset("") + "#collection"}>
            <span className="desktop-copy">The collection</span>
            <span className="mobile-copy">Collection</span>
          </a>
          <a href={asset("lab.html")} aria-current={labPage ? "page" : undefined}>
            <span className="desktop-copy">Splice lab ↗</span>
            <span className="mobile-copy">Splice lab</span>
          </a>
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
      <main id="top" className={labPage ? "lab-page" : undefined}>
        {!labPage && (
          <>
            <section className="hero wrap">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span className="dot" /> AN INTERNET FIELD GUIDE{" "}
                  <span className="eyebrow-line" /> U+1F433
                </p>
                <h1>
                  One whale.
                  <br />
                  <em>Many ways<span className="mobile-copy">.</span></em>
                  <span className="desktop-copy">
                    <br />
                    to whale<span className="blue">.</span>
                  </span>
                </h1>
                <p className="hero-desc">
                  <span className="desktop-copy">
                    A small celebration of the world's most wonderfully
                    inconsistent sea creature. Same emoji, different oceans.
                  </span>
                  <span className="mobile-copy">
                    The spouting whale emoji as each platform draws it, side by
                    side and ready to splice together.
                  </span>
                </p>
                <div className="hero-actions">
                  <a className="button primary" href="#collection">
                    <span className="desktop-copy">Explore the collection</span>
                    <span className="mobile-copy">Browse the collection</span>
                    <span aria-hidden="true">↘</span>
                  </a>
                  <a className="text-link" href={asset("lab.html")}>
                    <span className="desktop-copy">Go make a monster ↗</span>
                    <span className="mobile-copy">Open the splice lab</span>
                  </a>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="A spouting whale illustration"
              >
                <div className="hero-art-top">
                  <span>SPECIMEN / 001</span>
                  <span>NOT TO SCALE ↗</span>
                </div>
                <div className="hero-whale">🐳</div>
                <span className="mobile-copy hero-reflection" aria-hidden="true">
                  🐳
                </span>
                <span className="mobile-copy hero-code" aria-hidden="true">
                  U+1F433
                </span>
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
                    <span className="desktop-copy">
                      Same whale.
                      <br />
                      <em>Different waters.</em>
                    </span>
                    <span className="mobile-copy">The collection</span>
                  </h2>
                </div>
                <div className="section-intro">
                  <p>
                    <span className="desktop-copy">
                      From friendly to slightly concerned, every platform has its
                      own take. Take a closer look, then send one to the lab.
                    </span>
                    <span className="mobile-copy">
                      Pick a whale to open it in the splice lab.
                    </span>
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
                <span className="results" aria-live="polite">
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
          </>
        )}
        {labPage && (
          <Suspense fallback={<p className="wrap">Opening the lab…</p>}>
            <SpliceLab />
          </Suspense>
        )}
        {!labPage && (
          <>
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
                  However you see it, there's something wonderful about a tiny
                  whale bringing a little more joy to the internet. Thanks for
                  stopping by.
                </p>
              </div>
              <LivingWhale />
            </section>
          </>
        )}
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
            <a href={asset("") + "#sources"}>Specimen sources ↗</a>
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
