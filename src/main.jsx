import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/dm-mono/latin-500.css";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Moon,
  Search,
  Sun,
  Waves,
} from "lucide-react";
import "./style.css";
import specimens from "virtual:whale-manifest";
import { PARTS as keys, shareUrl } from "./mixer";
import { LivingWhale } from "./LivingWhale";

const base = import.meta.env.BASE_URL;
const asset = (path) => base + path.replace(/^\/?/, "");
const labPage = location.pathname.endsWith("/lab.html");
// lab.html always needs the editor. Its chunk is modulepreloaded by the HTML, so
// awaiting it here costs almost nothing and avoids painting a fallback that the
// editor then replaces (a layout shift). The home page never loads it.
const SpliceLab = labPage
  ? (await import("./SpliceLab").catch(() => null))?.SpliceLab
  : null;
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
const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true };

function ExternalLink({ href, label, children }) {
  return (
    <a
      className="external"
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight {...icon} />
    </a>
  );
}

function ImageAsset({ item }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="image-error">Image unavailable</span>
  ) : (
    <img
      src={asset(item.display ?? item.file)}
      alt={`${item.name} spouting whale emoji`}
      width={item.width}
      height={item.height}
      loading="lazy"
      decoding="async"
      className={item.rendering === "pixelated" ? "pixelated" : undefined}
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
  const items = specimens;
  const [query, setQuery] = useState("");
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
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  return (
    <>
      <header className="topbar">
        {/* Progressive blur: each band blurs more than the one below it. */}
        <div className="topbar-blur" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <a className="brand" href={asset("")}>
          <span className="brand-mark">
            <Waves size={18} strokeWidth={2} aria-hidden="true" />
          </span>
          The Whale
        </a>
        <nav aria-label="Main navigation">
          <a href={asset("") + "#collection"}>Collection</a>
          <a
            href={asset("lab.html")}
            aria-current={labPage ? "page" : undefined}
          >
            Splice lab
          </a>
        </nav>
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          <ThemeIcon {...icon} key={theme} className="theme-icon" />
        </button>
      </header>
      <main id="top" className={labPage ? "lab-page" : undefined}>
        {!labPage && (
          <>
            <section className="hero wrap">
              <div className="hero-copy">
                <h1>
                  One whale.
                  <br />
                  <em>Many ways.</em>
                </h1>
                <p className="hero-desc">
                  The spouting whale emoji as each platform draws it, side by
                  side and ready to splice together.
                </p>
                <div className="hero-actions">
                  <a className="button" href="#collection">
                    Browse the collection
                    <ArrowDown {...icon} />
                  </a>
                  <a className="text-link" href={asset("lab.html")}>
                    Open the splice lab
                  </a>
                </div>
              </div>
              <div
                className="hero-art"
                role="img"
                aria-label="The spouting whale emoji, U+1F433, afloat on rippling water"
              >
                <div className="hero-whale" aria-hidden="true">
                  🐳
                </div>
                {/* The sea sits over the whale so its belly reads as submerged;
                    the reflection is two copies blurred progressively deeper. */}
                <div className="hero-sea" aria-hidden="true">
                  <span className="hero-reflection">🐳</span>
                  <span className="hero-reflection deep">🐳</span>
                  <span className="ripple" />
                  <span className="ripple r2" />
                  <span className="ripple r3" />
                </div>
                <span className="hero-code label" aria-hidden="true">
                  U+1F433
                </span>
              </div>
            </section>
            <section className="collection wrap" id="collection">
              <div className="collection-head">
                <div>
                  <h2>The collection</h2>
                  <p>Pick a whale to open it in the splice lab.</p>
                </div>
                <div className="collection-tools">
                  <label className="search">
                    <Search {...icon} />
                    <span className="visually-hidden">Search platforms</span>
                    <input
                      id="search"
                      type="search"
                      placeholder="Find a platform"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <span className="label count" aria-live="polite">
                    <strong>{filtered.length}</strong> of {items.length}
                  </span>
                </div>
              </div>
              {filtered.length ? (
                <div className="specimen-grid">
                  {filtered.map((item) => (
                    <button
                      className="specimen"
                      type="button"
                      key={item.id}
                      onClick={() => choose(item.id)}
                    >
                      <div className="specimen-image">
                        <ImageAsset item={item} />
                      </div>
                      <h3>{item.name}</h3>
                      <ArrowUpRight {...icon} className="specimen-go" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty">
                  No whales found for “{query}”. Try another platform.
                </p>
              )}
            </section>
          </>
        )}
        {labPage &&
          (SpliceLab ? (
            <SpliceLab />
          ) : (
            <p className="wrap empty" role="alert">
              The lab could not be loaded. Please refresh the page.
            </p>
          ))}
        {!labPage && (
          <>
            <section className="sources wrap" id="sources">
              <details>
                <summary>
                  Sources and licenses
                  <ChevronDown {...icon} className="chevron" />
                </summary>
                <p>
                  Emoji artwork belongs to its creators. Each source lists its
                  version and license.
                </p>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{item.version}</span>
                      <span>{item.license}</span>
                      <ExternalLink
                        href={item.source}
                        label={`${item.name} source`}
                      >
                        Source
                      </ExternalLink>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <section className="outro wrap">
              <div>
                <h2>Now splice your own.</h2>
                <p>
                  Take a spout from one platform and a tail from another, then
                  download the result.
                </p>
                <a className="button" href={asset("lab.html")}>
                  Open the splice lab
                  <ArrowRight {...icon} />
                </a>
              </div>
              <LivingWhale />
            </section>
          </>
        )}
      </main>
      <footer>
        <div className="wrap footer-main">
          <a className="brand" href="#top">
            <span className="brand-mark">
              <Waves size={18} strokeWidth={2} aria-hidden="true" />
            </span>
            The Whale
          </a>
          <nav aria-label="Footer">
            <ExternalLink href="https://unicode.org/emoji/charts/full-emoji-list.html">
              Unicode emoji chart
            </ExternalLink>
            <ExternalLink href="https://github.com/roonil03/TheWhale">
              GitHub
            </ExternalLink>
          </nav>
        </div>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
