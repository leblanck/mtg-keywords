import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import MTG_KEYWORDS from "./mtgKeywords.js";

// ─── Gruvbox Dark Hard palette ────────────────────────────────────────────────
const GRV = {
  bg_h:   "#1d2021",
  bg:     "#282828",
  bg1:    "#3c3836",
  bg2:    "#504945",
  bg3:    "#665c54",
  bg4:    "#7c6f64",
  fg:     "#ebdbb2",
  fg2:    "#d5c4a1",
  fg4:    "#a89984",
  red:    "#cc241d", red_b:    "#fb4934",
  green:  "#98971a", green_b:  "#b8bb26",
  yellow: "#d79921", yellow_b: "#fabd2f",
  blue:   "#458588", blue_b:   "#83a598",
  aqua:   "#689d6a", aqua_b:   "#8ec07c",
  orange: "#d65d0e", orange_b: "#fe8019",
};

const CATEGORY_STYLES = {
  "Keyword ability": {
    bg: GRV.bg, border: GRV.blue, accentLine: GRV.blue_b,
    badge: GRV.blue, badgeBg: GRV.bg1, badgeText: GRV.blue_b,
  },
  "Keyword action": {
    bg: GRV.bg, border: GRV.aqua, accentLine: GRV.aqua_b,
    badge: GRV.aqua, badgeBg: GRV.bg1, badgeText: GRV.aqua_b,
  },
};

const EVERGREEN     = new Set(["Flying","Trample","Haste","First Strike","Double Strike","Deathtouch","Lifelink","Vigilance","Reach","Flash","Menace","Hexproof","Indestructible","Prowess","Defender"]);
const ALPHA_ORIGINS = new Set(["Alpha","Beta","Unlimited"]);
const MONO          = "'Share Tech Mono', monospace";
const SANS          = "'IBM Plex Sans', sans-serif";

function getStyle(cat) {
  return CATEGORY_STYLES[cat] || { bg: GRV.bg, border: GRV.bg3, accentLine: GRV.bg4, badge: GRV.bg3, badgeBg: GRV.bg1, badgeText: GRV.fg4 };
}

// ─── Scryfall fetch (sessionStorage cache) ────────────────────────────────────
const CACHE_PREFIX = "mtg_kw_cache__";

async function fetchSampleCards(keyword, count = 4) {
  const cacheKey = `${CACHE_PREFIX}${keyword}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const q   = encodeURIComponent(`keyword:"${keyword}" is:paper`);
  const url = `https://api.scryfall.com/cards/search?q=${q}&order=edhrec&unique=cards&page=1`;
  const res = await fetch(url, { headers: { "User-Agent": "MTGKeywordEncyclopedia/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`scryfall returned ${res.status}`);
  const json = await res.json();

  const cards = json.data.slice(0, count).map(card => {
    const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris ?? null;
    return {
      id:       card.id,
      name:     card.name,
      image:    uris?.normal ?? uris?.large ?? null,
      artist:   card.artist ?? "",
      scryfall: card.scryfall_uri ?? `https://scryfall.com/card/${card.id}`,
      type:     card.type_line ?? "",
    };
  }).filter(c => c.image);

  try { sessionStorage.setItem(cacheKey, JSON.stringify(cards)); } catch (_) {}
  return cards;
}

// ─── Bottom-sheet Modal (mobile-first) ───────────────────────────────────────
function Modal({ keyword, data, onClose }) {
  const [cards,     setCards]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [visible,   setVisible]   = useState(false);   // drives slide-in animation
  const sheetRef = useRef(null);

  const style       = getStyle(data.category);
  const isEvergreen = EVERGREEN.has(keyword);
  const isAlpha     = ALPHA_ORIGINS.has(data.first_set);

  // Animate in
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const h = e => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Fetch cards
  useEffect(() => {
    setLoading(true); setError(null); setCards([]); setSelected(null); setFromCache(false);
    const cacheKey = `${CACHE_PREFIX}${keyword}`;
    const isCached = !!sessionStorage.getItem(cacheKey);
    fetchSampleCards(keyword)
      .then(c  => { setCards(c); setFromCache(isCached); setLoading(false); })
      .catch(e => { setError(e.message);                 setLoading(false); });
  }, [keyword]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: visible ? "rgba(13,10,8,0.75)" : "rgba(13,10,8,0)",
        transition: "background 0.28s ease",
        display: "flex", alignItems: "flex-end",     // sheet rises from bottom
      }}
    >
      {/* Sheet */}
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "92dvh",
          background: GRV.bg,
          borderRadius: "16px 16px 0 0",
          border: `1px solid ${style.border}`,
          borderBottom: "none",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
          // safe area padding for phones with home bar
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: GRV.bg3 }} />
        </div>

        {/* Top accent line */}
        <div style={{ height: 2, background: style.accentLine, margin: "0 16px", borderRadius: 2 }} />

        {/* Header */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, wordBreak: "break-word" }}>
                {keyword}
              </h2>
              {isEvergreen && <Badge color={GRV.green_b}  border={GRV.green}>evergreen</Badge>}
              {isAlpha     && <Badge color={GRV.orange_b} border={GRV.orange}>OG</Badge>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: style.badgeBg, color: style.badgeText, border: `1px solid ${style.badge}`, borderRadius: 3, padding: "3px 8px", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: MONO }}>
              {data.category}
            </span>
          </div>
          {/* Large tap target close button */}
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", background: GRV.bg1, border: `1px solid ${GRV.bg2}`, borderRadius: 8, cursor: "pointer", color: GRV.fg4, fontSize: 18, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Description */}
        <div style={{ padding: "14px 16px 0" }}>
          <p style={{ margin: 0, fontSize: 15, color: GRV.fg2, lineHeight: 1.7, fontFamily: SANS }}>
            {data.description}
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO }}>first printed in</span>
            <span style={{ fontSize: 11, color: GRV.orange_b, fontFamily: MONO }}>{data.first_set}</span>
          </div>
        </div>

        <div style={{ margin: "16px 16px 0", height: 1, background: GRV.bg2 }} />

        {/* Sample cards */}
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, color: GRV.bg4, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            -- sample cards via scryfall --
          </div>

          {/* Skeletons */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ aspectRatio: "0.72", borderRadius: 10, background: GRV.bg1, animation: "pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.red}`, borderRadius: 8, padding: "12px 14px" }}>
              <span style={{ fontSize: 12, color: GRV.red_b, fontFamily: MONO }}>
                no results — scryfall may not index "{keyword}" as a searchable keyword
              </span>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && cards.length === 0 && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.bg3}`, borderRadius: 8, padding: "12px 14px" }}>
              <span style={{ fontSize: 12, color: GRV.fg4, fontFamily: MONO }}>no card images found for this keyword</span>
            </div>
          )}

          {/* Cards — 2-column grid on mobile */}
          {!loading && cards.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {cards.map((card, i) => (
                  <div
                    key={card.id}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{
                      borderRadius: 10, overflow: "hidden", cursor: "pointer",
                      border: `2px solid ${selected === i ? style.accentLine : "transparent"}`,
                      transition: "border-color 0.15s",
                      background: GRV.bg1,
                      // min tap target height handled by the card image itself
                    }}
                  >
                    <img src={card.image} alt={card.name} style={{ width: "100%", display: "block", borderRadius: 8 }} loading="lazy" />
                  </div>
                ))}
              </div>

              {/* Selected card detail */}
              {selected !== null && cards[selected] && (
                <div style={{ marginTop: 12, background: GRV.bg1, border: `1px solid ${GRV.bg2}`, borderRadius: 8, padding: "14px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, marginBottom: 4 }}>
                    {cards[selected].name}
                  </div>
                  {cards[selected].type && (
                    <div style={{ fontSize: 13, color: GRV.fg4, fontFamily: SANS, marginBottom: 4 }}>
                      {cards[selected].type}
                    </div>
                  )}
                  {cards[selected].artist && (
                    <div style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO, marginBottom: 12 }}>
                      art by {cards[selected].artist}
                    </div>
                  )}
                  {/* Full-width tappable link */}
                  <a
                    href={cards[selected].scryfall}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, fontSize: 13, color: style.badgeText, fontFamily: MONO, textDecoration: "none", border: `1px solid ${style.badge}`, borderRadius: 6, padding: "0 16px" }}
                  >
                    view on scryfall ↗
                  </a>
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 10, color: GRV.bg3, fontFamily: MONO, lineHeight: 1.6 }}>
                card images © wizards of the coast · data from scryfall.com
                {fromCache && <span style={{ marginLeft: 8, color: GRV.aqua_b }}>· ✓ cached</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small badge helper ───────────────────────────────────────────────────────
function Badge({ color, border, children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color, border: `1px solid ${border}`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: MONO, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ─── Keyword card tile ────────────────────────────────────────────────────────
function KeywordCard({ name, data, index, onClick }) {
  const style       = getStyle(data.category);
  const isEvergreen = EVERGREEN.has(name);
  const isAlpha     = ALPHA_ORIGINS.has(data.first_set);

  return (
    <div
      onClick={onClick}
      // min-height 44px guaranteed by padding; full-width tap area
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 8,
        padding: "14px 14px 12px",
        display: "flex", flexDirection: "column", gap: 9,
        animation: "fadeUp 0.25s ease both",
        animationDelay: `${Math.min(index * 0.02, 0.3)}s`,
        position: "relative", overflow: "hidden",
        cursor: "pointer",
        // active state feedback for touch
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = style.accentLine; e.currentTarget.style.background = GRV.bg1; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = style.border;     e.currentTarget.style.background = style.bg; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: style.accentLine }} />

      {/* Name row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, lineHeight: 1.3, wordBreak: "break-word" }}>
          {name}
        </h3>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isEvergreen && <Badge color={GRV.green_b}  border={GRV.green}>evergreen</Badge>}
          {isAlpha     && <Badge color={GRV.orange_b} border={GRV.orange}>OG</Badge>}
        </div>
      </div>

      {/* Category badge */}
      <div>
        <span style={{ fontSize: 10, fontWeight: 700, background: style.badgeBg, color: style.badgeText, border: `1px solid ${style.badge}`, borderRadius: 3, padding: "2px 8px", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: MONO }}>
          {data.category}
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13.5, color: GRV.fg2, lineHeight: 1.65, fontFamily: SANS }}>
        {data.description}
      </p>

      {/* Footer row */}
      <div style={{ paddingTop: 8, borderTop: `1px solid ${GRV.bg2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO }}>set:</span>
          <span style={{ fontSize: 11, color: GRV.fg4, fontFamily: MONO }}>{data.first_set}</span>
        </div>
        <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO }}>tap ›</span>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  const allKeywords = Object.entries(MTG_KEYWORDS);
  const totalCount  = allKeywords.length;

  const filtered = useMemo(() => allKeywords.filter(([name, data]) => {
    const q = query.toLowerCase();
    const matchesSearch = !q
      || name.toLowerCase().includes(q)
      || data.description.toLowerCase().includes(q)
      || data.first_set.toLowerCase().includes(q);
    const matchesFilter =
      filter === "all"
      || (filter === "ability"  && data.category === "Keyword ability")
      || (filter === "action"   && data.category === "Keyword action")
      || (filter === "evergreen" && EVERGREEN.has(name));
    return matchesSearch && matchesFilter;
  }), [query, filter]);

  const FILTERS = [
    { id: "all",       label: "All" },
    { id: "ability",   label: "Abilities" },
    { id: "action",    label: "Actions" },
    { id: "evergreen", label: "Evergreen" },
  ];

  const closeModal = useCallback(() => setSelected(null), []);

  // Dismiss keyboard on scroll (common mobile UX pattern)
  useEffect(() => {
    const onScroll = () => { if (inputRef.current) inputRef.current.blur(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Sans:wght@400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity: 0.35; }
          50%      { opacity: 0.7; }
        }

        *, *::before, *::after { box-sizing: border-box; }

        /* Prevent font size bump on orientation change in iOS */
        html { -webkit-text-size-adjust: 100%; }

        body { margin: 0; }

        /* Smooth momentum scrolling on iOS */
        .scroll-area { -webkit-overflow-scrolling: touch; }

        input[type=text] {
          -webkit-appearance: none;
          appearance: none;
          transition: border-color 0.15s;
          /* Prevent iOS zoom on focus (font-size must be >= 16px) */
          font-size: 16px !important;
        }
        input[type=text]:focus {
          outline: none;
          border-color: ${GRV.yellow} !important;
          box-shadow: 0 0 0 2px ${GRV.yellow}30;
        }

        /* Filter buttons — large tap targets */
        .filter-btn {
          min-height: 40px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-family: ${MONO};
          letter-spacing: 0.05em;
          transition: all 0.12s;
          -webkit-tap-highlight-color: transparent;
          border: 1px solid;
          white-space: nowrap;
        }

        /* Hide scrollbar on filter row but keep it scrollable */
        .filter-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .filter-row::-webkit-scrollbar { display: none; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${GRV.bg_h}; }
        ::-webkit-scrollbar-thumb { background: ${GRV.bg3}; border-radius: 2px; }
      `}</style>

      <div style={{ minHeight: "100dvh", background: GRV.bg_h, fontFamily: SANS }}>

        {/* ── Sticky search + filter bar ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: GRV.bg_h,
          borderBottom: `1px solid ${GRV.bg1}`,
          padding: "10px 12px 10px",
          // Safe area top (notch phones)
          paddingTop: "max(10px, env(safe-area-inset-top))",
        }}>
          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke={GRV.bg4} strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke={GRV.bg4} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="search keywords, descriptions, sets…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              style={{
                width: "100%",
                height: 46,
                paddingLeft: 38, paddingRight: query ? 40 : 14,
                background: GRV.bg,
                border: `1px solid ${GRV.bg2}`,
                borderRadius: 8,
                color: GRV.fg,
                fontFamily: MONO,
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                aria-label="Clear search"
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: GRV.bg4, fontSize: 20 }}
              >×</button>
            )}
          </div>

          {/* Filter chips — horizontal scroll */}
          <div className="filter-row">
            {FILTERS.map(f => (
              <button
                key={f.id}
                className="filter-btn"
                onClick={() => setFilter(f.id)}
                style={{
                  background:   filter === f.id ? GRV.bg2        : "transparent",
                  borderColor:  filter === f.id ? GRV.yellow      : GRV.bg2,
                  color:        filter === f.id ? GRV.yellow_b    : GRV.fg4,
                }}
              >
                {f.label}
              </button>
            ))}
            {/* Result count pinned to right of scroll area */}
            <span style={{ marginLeft: "auto", fontSize: 12, color: GRV.bg3, fontFamily: MONO, alignSelf: "center", paddingRight: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
              [{filtered.length}]
            </span>
          </div>
        </div>

        {/* ── Page header ── */}
        <div style={{ padding: "24px 16px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.28em", color: GRV.bg4, textTransform: "uppercase", fontFamily: MONO, marginBottom: 8 }}>
            -- reference grimoire --
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, letterSpacing: "0.03em", lineHeight: 1.2 }}>
            Magic: The Gathering
          </h1>
          <h2 style={{ margin: "4px 0 14px", fontSize: 14, fontWeight: 400, color: GRV.orange_b, fontFamily: MONO, letterSpacing: "0.1em" }}>
            Keyword Encyclopedia
          </h2>
          <div style={{ width: 80, height: 1, background: GRV.bg3, margin: "0 auto 10px" }} />

          {/* Legend inline with count */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {[{ color: GRV.blue_b, label: "Ability" }, { color: GRV.aqua_b, label: "Action" }].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, background: color, borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO }}>{label}</span>
              </div>
            ))}
            <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO }}>{totalCount} total · tap any card</span>
          </div>
        </div>

        {/* ── Card grid ── */}
        <div style={{ padding: "0 12px 32px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: GRV.bg3 }}>
              <div style={{ fontFamily: MONO, fontSize: 14, marginBottom: 6 }}>-- no results --</div>
              <div style={{ fontSize: 12, color: GRV.bg2 }}>try a different search or filter</div>
            </div>
          ) : (
            // Single column on narrow screens, 2-col on wider phones/tablets
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {filtered.map(([name, data], i) => (
                <KeywordCard
                  key={name} name={name} data={data} index={i}
                  onClick={() => setSelected({ name, data })}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "24px 16px", textAlign: "center", borderTop: `1px solid ${GRV.bg1}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 11, color: GRV.bg4, fontFamily: MONO, lineHeight: 1.8 }}>
              Card data and images retrieved from the{" "}
              <a href="https://scryfall.com/docs/api" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>
                Scryfall API
              </a>
              {" "}per Scryfall's{" "}
              <a href="https://scryfall.com/docs/api" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>
                non-commercial use policy
              </a>.
            </p>
            <p style={{ margin: 0, fontSize: 11, color: GRV.bg4, fontFamily: MONO, lineHeight: 1.8 }}>
              Magic: The Gathering and all card images are property of{" "}
              <a href="https://company.wizards.com" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>
                Wizards of the Coast
              </a>
              . Unofficial fan tool — not affiliated with or endorsed by Wizards of the Coast.
            </p>
          </div>

          <div style={{ width: 80, height: 1, background: GRV.bg1, margin: "0 auto 16px" }} />

          <p style={{ margin: 0, fontSize: 11, color: GRV.bg3, fontFamily: MONO, lineHeight: 1.8 }}>
            © {new Date().getFullYear()} Made with ♥ by{" "}
            <a href="https://leblanc.sh" target="_blank" rel="noopener noreferrer" style={{ color: GRV.yellow_b, textDecoration: "none", borderBottom: `1px solid ${GRV.yellow}` }}>
              LeBlanc Engineering
            </a>
            {" "}in Maine.
          </p>

          {/* Bottom safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </div>

      {/* Bottom-sheet modal */}
      {selected && <Modal keyword={selected.name} data={selected.data} onClose={closeModal} />}
    </>
  );
}