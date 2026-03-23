import { useState, useMemo, useEffect, useCallback } from "react";
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
  gray:   "#928374",
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

function getStyle(cat) {
  return CATEGORY_STYLES[cat] || { bg: GRV.bg, border: GRV.bg3, accentLine: GRV.bg4, badge: GRV.bg3, badgeBg: GRV.bg1, badgeText: GRV.fg2 };
}

// ─── Scryfall fetch (with sessionStorage cache) ───────────────────────────────
const CACHE_PREFIX = "mtg_kw_cache__";

async function fetchSampleCards(keyword, count = 4) {
  const cacheKey = `${CACHE_PREFIX}${keyword}`;

  // Return cached result if available
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {
    // sessionStorage unavailable — just fetch fresh
  }

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

  // Persist to sessionStorage for the lifetime of this browser tab
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(cards));
  } catch (_) {
    // sessionStorage full or unavailable — silently skip caching
  }

  return cards;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ keyword, data, onClose }) {
  const [cards,    setCards]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const style      = getStyle(data.category);
  const isEvergreen = EVERGREEN.has(keyword);
  const isAlpha     = ALPHA_ORIGINS.has(data.first_set);

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setLoading(true); setError(null); setCards([]); setSelected(null); setFromCache(false);
    const cacheKey = `${CACHE_PREFIX}${keyword}`;
    const isCached = !!sessionStorage.getItem(cacheKey);
    fetchSampleCards(keyword)
      .then(c  => { setCards(c); setFromCache(isCached); setLoading(false); })
      .catch(e => { setError(e.message);                 setLoading(false); });
  }, [keyword]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(13,10,8,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: GRV.bg, border: `1px solid ${style.border}`, borderRadius: 8, width: "100%", maxWidth: 800, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>

        {/* accent bar */}
        <div style={{ height: 3, background: style.accentLine, borderRadius: "8px 8px 0 0" }} />

        {/* header */}
        <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: GRV.yellow_b, fontFamily: "'Share Tech Mono', monospace" }}>{keyword}</h2>
              {isEvergreen && <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color: GRV.green_b,  border: `1px solid ${GRV.green}`,  borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>evergreen</span>}
              {isAlpha     && <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color: GRV.orange_b, border: `1px solid ${GRV.orange}`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>OG</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: style.badgeBg, color: style.badgeText, border: `1px solid ${style.badge}`, borderRadius: 3, padding: "2px 8px", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>
              {data.category}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: GRV.bg4, fontSize: 22, lineHeight: 1, padding: "0 2px", flexShrink: 0, marginTop: 2 }} aria-label="Close">✕</button>
        </div>

        {/* description */}
        <div style={{ padding: "14px 24px 0" }}>
          <p style={{ margin: 0, fontSize: 14.5, color: GRV.fg2, lineHeight: 1.7, fontFamily: "'IBM Plex Sans', sans-serif" }}>{data.description}</p>
          <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace" }}>first printed in</span>
            <span style={{ fontSize: 11, color: GRV.orange_b, fontFamily: "'Share Tech Mono', monospace" }}>{data.first_set}</span>
          </div>
        </div>

        <div style={{ margin: "18px 24px 0", height: 1, background: GRV.bg2 }} />

        {/* sample cards */}
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ fontSize: 11, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
            -- sample cards via scryfall --
          </div>

          {/* skeleton */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ aspectRatio: "0.72", borderRadius: 8, background: GRV.bg1, animation: "pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          {/* error */}
          {!loading && error && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.red}`, borderRadius: 5, padding: "12px 16px" }}>
              <span style={{ fontSize: 12, color: GRV.red_b, fontFamily: "'Share Tech Mono', monospace" }}>
                no results — scryfall may not index "{keyword}" as a searchable keyword
              </span>
            </div>
          )}

          {/* empty */}
          {!loading && !error && cards.length === 0 && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.bg3}`, borderRadius: 5, padding: "12px 16px" }}>
              <span style={{ fontSize: 12, color: GRV.fg4, fontFamily: "'Share Tech Mono', monospace" }}>no card images found for this keyword</span>
            </div>
          )}

          {/* cards grid */}
          {!loading && cards.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {cards.map((card, i) => (
                  <div
                    key={card.id}
                    onClick={() => setSelected(selected === i ? null : i)}
                    title={card.name}
                    style={{
                      cursor: "pointer", borderRadius: 8, overflow: "hidden",
                      border: `2px solid ${selected === i ? style.accentLine : "transparent"}`,
                      transition: "border-color 0.15s, transform 0.15s",
                      transform: selected === i ? "scale(1.03)" : "scale(1)",
                      background: GRV.bg1,
                    }}
                  >
                    <img src={card.image} alt={card.name} style={{ width: "100%", display: "block", borderRadius: 6 }} loading="lazy" />
                  </div>
                ))}
              </div>

              {/* expanded detail row */}
              {selected !== null && cards[selected] && (
                <div style={{ marginTop: 14, background: GRV.bg1, border: `1px solid ${GRV.bg2}`, borderRadius: 6, padding: "14px 16px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: GRV.yellow_b, fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>
                    {cards[selected].name}
                  </div>
                  {cards[selected].type && (
                    <div style={{ fontSize: 12, color: GRV.fg4, fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: 4 }}>
                      {cards[selected].type}
                    </div>
                  )}
                  {cards[selected].artist && (
                    <div style={{ fontSize: 11, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>
                      art by {cards[selected].artist}
                    </div>
                  )}
                  <a
                    href={cards[selected].scryfall}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", fontSize: 11, color: style.badgeText, fontFamily: "'Share Tech Mono', monospace", textDecoration: "none", border: `1px solid ${style.badge}`, borderRadius: 3, padding: "4px 12px" }}
                  >
                    view on scryfall ↗
                  </a>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 10, color: GRV.bg3, fontFamily: "'Share Tech Mono', monospace" }}>
                card images © wizards of the coast · data sourced from scryfall.com
                {fromCache && (
                  <span style={{ marginLeft: 10, color: GRV.aqua_b, fontFamily: "'Share Tech Mono', monospace" }}>
                    · ✓ cached
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
      style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 6, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.25s ease both", animationDelay: `${Math.min(index * 0.025, 0.35)}s`, position: "relative", overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s, background 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = style.accentLine; e.currentTarget.style.background = GRV.bg1; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = style.border;     e.currentTarget.style.background = style.bg; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: style.accentLine, opacity: 0.85 }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: GRV.yellow_b, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.02em", lineHeight: 1.3 }}>{name}</h3>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isEvergreen && <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color: GRV.green_b,  border: `1px solid ${GRV.green}`,  borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>evergreen</span>}
          {isAlpha     && <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color: GRV.orange_b, border: `1px solid ${GRV.orange}`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>OG</span>}
        </div>
      </div>

      <div>
        <span style={{ fontSize: 10, fontWeight: 700, background: style.badgeBg, color: style.badgeText, border: `1px solid ${style.badge}`, borderRadius: 3, padding: "2px 8px", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>
          {data.category}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: GRV.fg2, lineHeight: 1.65, fontFamily: "'IBM Plex Sans', sans-serif" }}>{data.description}</p>

      <div style={{ marginTop: 2, paddingTop: 8, borderTop: `1px solid ${GRV.bg2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace" }}>set:</span>
          <span style={{ fontSize: 11, color: GRV.fg4, fontFamily: "'Share Tech Mono', monospace" }}>{data.first_set}</span>
        </div>
        <span style={{ fontSize: 10, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace" }}>click for details ›</span>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  const allKeywords = Object.entries(MTG_KEYWORDS);
  const totalCount  = allKeywords.length;

  const filtered = useMemo(() => allKeywords.filter(([name, data]) => {
    const q = query.toLowerCase();
    const matchesSearch = !q || name.toLowerCase().includes(q) || data.description.toLowerCase().includes(q) || data.first_set.toLowerCase().includes(q);
    const matchesFilter = filter === "all" || (filter === "ability" && data.category === "Keyword ability") || (filter === "action" && data.category === "Keyword action") || (filter === "evergreen" && EVERGREEN.has(name));
    return matchesSearch && matchesFilter;
  }), [query, filter]);

  const FILTERS = [
    { id: "all",       label: "all" },
    { id: "ability",   label: "abilities" },
    { id: "action",    label: "actions" },
    { id: "evergreen", label: "evergreen" },
  ];

  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Sans:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        * { box-sizing: border-box; }
        input[type=text] { transition: border-color 0.15s; }
        input[type=text]:focus { outline: none; border-color: ${GRV.yellow} !important; box-shadow: 0 0 0 2px ${GRV.yellow}28; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${GRV.bg_h}; }
        ::-webkit-scrollbar-thumb { background: ${GRV.bg3}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: GRV.bg_h, padding: "32px 16px 64px", fontFamily: "'IBM Plex Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ maxWidth: 940, margin: "0 auto 32px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: GRV.bg4, textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>-- reference grimoire --</div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, color: GRV.yellow_b, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.04em", lineHeight: 1.2 }}>Magic: The Gathering</h1>
          <h2 style={{ margin: "6px 0 18px", fontSize: 17, fontWeight: 400, color: GRV.orange_b, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.12em" }}>Keyword Encyclopedia</h2>
          <div style={{ width: 120, height: 1, background: GRV.bg3, margin: "0 auto 14px" }} />
          <p style={{ margin: 0, fontSize: 13, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace" }}>{totalCount} keywords · Alpha through present · click any card for details</p>
        </div>

        {/* Controls */}
        <div style={{ maxWidth: 940, margin: "0 auto 22px" }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke={GRV.bg4} strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke={GRV.bg4} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="search keywords, descriptions, or sets..." value={query} onChange={e => setQuery(e.target.value)} style={{ width: "100%", padding: "11px 16px 11px 38px", background: GRV.bg, border: `1px solid ${GRV.bg2}`, borderRadius: 5, color: GRV.fg, fontSize: 14, fontFamily: "'Share Tech Mono', monospace" }} />
            {query && <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: GRV.bg4, fontSize: 20, padding: "0 4px", lineHeight: 1 }}>×</button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.06em", background: filter === f.id ? GRV.bg2 : "transparent", border: `1px solid ${filter === f.id ? GRV.yellow : GRV.bg2}`, color: filter === f.id ? GRV.yellow_b : GRV.fg4, transition: "all 0.12s" }}>{f.label}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: GRV.bg3, fontFamily: "'Share Tech Mono', monospace" }}>[{filtered.length} results]</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ maxWidth: 940, margin: "0 auto 20px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[{ color: GRV.blue_b, label: "Keyword ability" }, { color: GRV.aqua_b, label: "Keyword action" }].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: GRV.bg4, fontFamily: "'Share Tech Mono', monospace" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: GRV.bg3 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, marginBottom: 6 }}>-- no results --</div>
              <div style={{ fontSize: 12, color: GRV.bg2 }}>try a different search term or filter</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(265px, 1fr))", gap: 12 }}>
              {filtered.map(([name, data], i) => (
                <KeywordCard key={name} name={name} data={data} index={i} onClick={() => setSelected({ name, data })} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ maxWidth: 940, margin: "48px auto 0", textAlign: "center" }}>
          <div style={{ width: 80, height: 1, background: GRV.bg2, margin: "0 auto 14px" }} />
          <p style={{ margin: 0, fontSize: 11, color: GRV.bg3, fontFamily: "'Share Tech Mono', monospace" }}>Magic: The Gathering is property of Wizards of the Coast · unofficial reference tool</p>
        </div>
      </div>

      {selected && <Modal keyword={selected.name} data={selected.data} onClose={closeModal} />}
    </>
  );
}