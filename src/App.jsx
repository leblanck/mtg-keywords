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

// ─── Small badge helper ───────────────────────────────────────────────────────
function Badge({ color, border, children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: GRV.bg1, color, border: `1px solid ${border}`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: MONO, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ─── Bottom-sheet Modal with swipe-to-dismiss ─────────────────────────────────
function Modal({ keyword, data, onClose }) {
  const [cards,     setCards]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [visible,   setVisible]   = useState(false);
  const [dragY,     setDragY]     = useState(0);      // live drag offset in px

  const sheetRef    = useRef(null);
  const dragStart   = useRef(null);   // { y, scrollTop } at touch start
  const isDragging  = useRef(false);

  const style       = getStyle(data.category);
  const isEvergreen = EVERGREEN.has(keyword);
  const isAlpha     = ALPHA_ORIGINS.has(data.first_set);

  // Animate in
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Lock body scroll
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
    setDragY(0);
    setTimeout(onClose, 280);
  }

  // ── Swipe-to-dismiss touch handlers ──
  function onTouchStart(e) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    // Only initiate drag when sheet is scrolled to top
    if (sheet.scrollTop > 0) return;
    dragStart.current = { y: e.touches[0].clientY };
    isDragging.current = false;
  }

  function onTouchMove(e) {
    if (!dragStart.current) return;
    const dy = e.touches[0].clientY - dragStart.current.y;
    if (dy < 0) return;                     // don't drag upward
    isDragging.current = true;
    setDragY(dy);
  }

  function onTouchEnd() {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (dragY > 100) {
      handleClose();                         // dismiss if dragged far enough
    } else {
      setDragY(0);                           // snap back
    }
    isDragging.current = false;
  }

  const sheetTransform = visible
    ? `translateY(${dragY}px)`
    : "translateY(100%)";

  const sheetTransition = isDragging.current
    ? "none"                                 // no transition while finger is down
    : "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: visible ? `rgba(13,10,8,${Math.max(0, 0.75 - dragY / 400)})` : "rgba(13,10,8,0)",
        transition: isDragging.current ? "none" : "background 0.28s ease",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: "100%", maxWidth: 640, maxHeight: "92dvh",
          background: GRV.bg,
          borderRadius: "16px 16px 0 0",
          border: `1px solid ${style.border}`,
          borderBottom: "none",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          transform: sheetTransform,
          transition: sheetTransition,
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", cursor: "grab" }}>
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
          <button onClick={handleClose} aria-label="Close" style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", background: GRV.bg1, border: `1px solid ${GRV.bg2}`, borderRadius: 8, cursor: "pointer", color: GRV.fg4, fontSize: 18, flexShrink: 0 }}>
            ✕
          </button>
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

          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, maxWidth: 720, margin: "0 auto" }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ aspectRatio: "0.72", borderRadius: 10, background: GRV.bg1, animation: "pulse 1.4s ease infinite", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.red}`, borderRadius: 8, padding: "12px 14px" }}>
              <span style={{ fontSize: 12, color: GRV.red_b, fontFamily: MONO }}>
                no results — scryfall may not index "{keyword}" as a searchable keyword
              </span>
            </div>
          )}

          {!loading && !error && cards.length === 0 && (
            <div style={{ background: GRV.bg1, border: `1px solid ${GRV.bg3}`, borderRadius: 8, padding: "12px 14px" }}>
              <span style={{ fontSize: 12, color: GRV.fg4, fontFamily: MONO }}>no card images found for this keyword</span>
            </div>
          )}

          {!loading && cards.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, maxWidth: 720, margin: "0 auto" }}>
                {cards.map((card, i) => (
                  <div
                    key={card.id}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{ borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2px solid ${selected === i ? style.accentLine : "transparent"}`, transition: "border-color 0.15s", background: GRV.bg1 }}
                  >
                    <img src={card.image} alt={card.name} style={{ width: "100%", display: "block", borderRadius: 8 }} loading="lazy" />
                  </div>
                ))}
              </div>

              {selected !== null && cards[selected] && (
                <div style={{ marginTop: 12, background: GRV.bg1, border: `1px solid ${GRV.bg2}`, borderRadius: 8, padding: "14px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, marginBottom: 4 }}>{cards[selected].name}</div>
                  {cards[selected].type   && <div style={{ fontSize: 13, color: GRV.fg4, fontFamily: SANS, marginBottom: 4 }}>{cards[selected].type}</div>}
                  {cards[selected].artist && <div style={{ fontSize: 11, color: GRV.bg4, fontFamily: MONO, marginBottom: 12 }}>art by {cards[selected].artist}</div>}
                  <a href={cards[selected].scryfall} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, fontSize: 13, color: style.badgeText, fontFamily: MONO, textDecoration: "none", border: `1px solid ${style.badge}`, borderRadius: 6, padding: "0 16px" }}>
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

// ─── A-Z Index bar ────────────────────────────────────────────────────────────
function AZIndex({ letters, activeLetters, onJump, topOffset = 0 }) {
  // Outer div spans the viewport below the sticky header and centers its child
  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: topOffset,
      height: `calc(100dvh - ${topOffset}px)`,
      zIndex: 50,
      display: "flex", flexDirection: "column",
      alignItems: "flex-end", justifyContent: "center",
      pointerEvents: "none",   // transparent to taps except the pill itself
    }}>
      {/* The visible pill */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "6px 2px",
        background: GRV.bg1 + "cc",
        borderRadius: "8px 0 0 8px",
        border: `1px solid ${GRV.bg2}`,
        borderRight: "none",
        gap: 1,
        pointerEvents: "all",
      }}>
        {letters.map(letter => (
          <button
            key={letter}
            onClick={() => onJump(letter)}
            aria-label={`Jump to ${letter}`}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: activeLetters.has(letter) ? GRV.yellow_b : GRV.bg3,
              padding: "3px 6px",
              lineHeight: 1,
              WebkitTapHighlightColor: "transparent",
              opacity: activeLetters.has(letter) ? 1 : 0.4,
              minWidth: 22, minHeight: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {letter}
          </button>
        ))}
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
      id={`kw-${name}`}
      onClick={onClick}
      style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 8, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 9, animation: "fadeUp 0.25s ease both", animationDelay: `${Math.min(index * 0.02, 0.3)}s`, position: "relative", overflow: "hidden", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = style.accentLine; e.currentTarget.style.background = GRV.bg1; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = style.border;     e.currentTarget.style.background = style.bg; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: style.accentLine }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, lineHeight: 1.3, wordBreak: "break-word" }}>{name}</h3>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isEvergreen && <Badge color={GRV.green_b}  border={GRV.green}>evergreen</Badge>}
          {isAlpha     && <Badge color={GRV.orange_b} border={GRV.orange}>OG</Badge>}
        </div>
      </div>

      <div>
        <span style={{ fontSize: 10, fontWeight: 700, background: style.badgeBg, color: style.badgeText, border: `1px solid ${style.badge}`, borderRadius: 3, padding: "2px 8px", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: MONO }}>
          {data.category}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: GRV.fg2, lineHeight: 1.65, fontFamily: SANS }}>{data.description}</p>

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

// ─── Install banner ──────────────────────────────────────────────────────────
// Shared slide-up wrapper used by both banner variants
function BannerShell({ children, onDismiss }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      display: "flex", justifyContent: "center",
      padding: "0 12px calc(12px + env(safe-area-inset-bottom, 0px))",
      pointerEvents: "none",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: GRV.bg1,
        border: `1px solid ${GRV.yellow}`,
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        transform: visible ? "translateY(0)" : "translateY(120%)",
        transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        pointerEvents: "all",
        overflow: "hidden",
      }}>
        {children(dismiss)}
      </div>
    </div>
  );
}

// Android / Chrome — one-tap install prompt
function InstallBanner({ onInstall, onDismiss }) {
  return (
    <BannerShell onDismiss={onDismiss}>
      {dismiss => (
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>🃏</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, marginBottom: 2 }}>
              add to home screen
            </div>
            <div style={{ fontSize: 11, color: GRV.fg4, fontFamily: SANS, lineHeight: 1.4 }}>
              install MTG Keywords for quick offline access
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button onClick={onInstall} style={{ background: GRV.yellow, border: "none", borderRadius: 6, color: GRV.bg_h, fontFamily: MONO, fontSize: 12, fontWeight: 700, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent" }}>
              install
            </button>
            <button onClick={dismiss} style={{ background: "none", border: `1px solid ${GRV.bg3}`, borderRadius: 6, color: GRV.fg4, fontFamily: MONO, fontSize: 11, padding: "5px 14px", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent" }}>
              not now
            </button>
          </div>
        </div>
      )}
    </BannerShell>
  );
}

// iOS Safari — manual instruction banner (no programmatic prompt available)
function IOSInstallBanner({ onDismiss }) {
  return (
    <BannerShell onDismiss={onDismiss}>
      {dismiss => (
        <div style={{ padding: "14px 16px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>🃏</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO }}>
                add to home screen
              </div>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: GRV.bg4, fontSize: 18, lineHeight: 1, padding: "4px 6px", WebkitTapHighlightColor: "transparent" }}>
              ✕
            </button>
          </div>

          {/* Step-by-step instructions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "⬆️", text: "tap the share button at the bottom of your browser" },
              { icon: "➕", text: 'scroll down and tap "Add to Home Screen"' },
              { icon: "✅", text: 'tap "Add" to confirm' },
            ].map(({ icon, text }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{icon}</div>
                <div style={{ fontSize: 12, color: GRV.fg4, fontFamily: SANS, lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>

          {/* Tip */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${GRV.bg2}`, fontSize: 10, color: GRV.bg4, fontFamily: MONO, lineHeight: 1.5 }}>
            once installed, MTG Keywords works offline and opens without the browser chrome
          </div>
        </div>
      )}
    </BannerShell>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function App() {
  const [query,        setQuery]       = useState("");
  const [filter,       setFilter]      = useState("all");
  const [selected,     setSelected]    = useState(null);
  const [installEvent, setInstallEvent] = useState(null);  // deferred beforeinstallprompt
  const [showBanner,   setShowBanner]  = useState(false);
  const [installed,    setInstalled]   = useState(false);
  const inputRef   = useRef(null);
  const headerRef  = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

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
      || (filter === "ability"   && data.category === "Keyword ability")
      || (filter === "action"    && data.category === "Keyword action")
      || (filter === "evergreen" && EVERGREEN.has(name));
    return matchesSearch && matchesFilter;
  }), [query, filter]);

  // Which letters are represented in the current filtered set
  const activeLetters = useMemo(() => {
    const s = new Set();
    filtered.forEach(([name]) => {
      const ch = name[0].toUpperCase();
      s.add(/[A-Z]/.test(ch) ? ch : "#");
    });
    return s;
  }, [filtered]);

  const FILTERS = [
    { id: "all",       label: "All" },
    { id: "ability",   label: "Abilities" },
    { id: "action",    label: "Actions" },
    { id: "evergreen", label: "Evergreen" },
  ];

  const closeModal = useCallback(() => setSelected(null), []);

  // Measure sticky header height so A-Z bar can clear it
  useEffect(() => {
    if (!headerRef.current) return;
    const update = () => setHeaderHeight(headerRef.current.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Dismiss keyboard on scroll
  useEffect(() => {
    const onScroll = () => { if (inputRef.current) inputRef.current.blur(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js")
      .then(reg => {
        // When a new SW version is waiting, activate it immediately
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              next.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // SW unavailable (HTTP, blocked, etc.) — app works fine without it
      });

    // Reload once when a new SW takes control so we get fresh JS/CSS
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);

  // Detect iOS Safari — it never fires beforeinstallprompt
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
                !window.MSStream;
  const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
                             window.navigator.standalone === true;

  // Capture the browser's beforeinstallprompt (Android/Chrome) or show iOS hint
  useEffect(() => {
    // Already running as an installed PWA — nothing to show
    if (isInStandaloneMode) {
      setInstalled(true);
      return;
    }

    // iOS Safari: show manual-instruction banner after a short delay
    if (isIOS) {
      // Only show once per session — check sessionStorage flag
      if (!sessionStorage.getItem("ios_install_dismissed")) {
        setTimeout(() => setShowBanner(true), 3000);
      }
      return;
    }

    // Android / Chrome / Edge: capture the native install event
    const handler = e => {
      e.preventDefault();
      setInstallEvent(e);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setShowBanner(false);
      setInstalled(true);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShowBanner(false);
    setInstallEvent(null);
  }

  // Jump to the first card starting with a given letter
  function handleAZJump(letter) {
    const target = filtered.find(([name]) => {
      const ch = name[0].toUpperCase();
      return letter === "#" ? !/[A-Z]/.test(ch) : ch === letter;
    });
    if (!target) return;
    const el = document.getElementById(`kw-${target[0]}`);
    if (el) {
      // Offset for the sticky header (~110px)
      const top = el.getBoundingClientRect().top + window.scrollY - 116;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

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
        html { -webkit-text-size-adjust: 100%; }
        body { margin: 0; }

        input[type=text] {
          -webkit-appearance: none;
          appearance: none;
          transition: border-color 0.15s;
          font-size: 16px !important;
        }
        input[type=text]:focus {
          outline: none;
          border-color: ${GRV.yellow} !important;
          box-shadow: 0 0 0 2px ${GRV.yellow}30;
        }

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

        .filter-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .filter-row::-webkit-scrollbar { display: none; }

        /* Hide A-Z bar on very narrow screens to avoid overlap */
        .az-bar { display: flex; }
        @media (max-width: 359px) { .az-bar { display: none; } }

        /* On desktop give the grid right-padding so A-Z bar doesn't overlap */
        @media (min-width: 480px) { .card-grid-wrap { padding-right: 28px; } }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${GRV.bg_h}; }
        ::-webkit-scrollbar-thumb { background: ${GRV.bg3}; border-radius: 2px; }
      `}</style>

      <div style={{ minHeight: "100dvh", background: GRV.bg_h, fontFamily: SANS }}>

        {/* ── Sticky search + filter bar ── */}
        <div ref={headerRef} style={{ position: "sticky", top: 0, zIndex: 100, background: GRV.bg_h, borderBottom: `1px solid ${GRV.bg1}`, padding: "10px 12px 10px", paddingTop: "max(10px, env(safe-area-inset-top))" }}>
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
              style={{ width: "100%", height: 46, paddingLeft: 38, paddingRight: query ? 40 : 14, background: GRV.bg, border: `1px solid ${GRV.bg2}`, borderRadius: 8, color: GRV.fg, fontFamily: MONO }}
            />
            {query && (
              <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: GRV.bg4, fontSize: 20 }}>×</button>
            )}
          </div>

          <div className="filter-row">
            {FILTERS.map(f => (
              <button key={f.id} className="filter-btn" onClick={() => setFilter(f.id)} style={{ background: filter === f.id ? GRV.bg2 : "transparent", borderColor: filter === f.id ? GRV.yellow : GRV.bg2, color: filter === f.id ? GRV.yellow_b : GRV.fg4 }}>
                {f.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: GRV.bg3, fontFamily: MONO, alignSelf: "center", paddingRight: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
              [{filtered.length}]
            </span>
          </div>
        </div>

        {/* ── Page header ── */}
        <div style={{ padding: "24px 16px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.28em", color: GRV.bg4, textTransform: "uppercase", fontFamily: MONO, marginBottom: 8 }}>-- reference grimoire --</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: GRV.yellow_b, fontFamily: MONO, letterSpacing: "0.03em", lineHeight: 1.2 }}>Magic: The Gathering</h1>
          <h2 style={{ margin: "4px 0 14px", fontSize: 14, fontWeight: 400, color: GRV.orange_b, fontFamily: MONO, letterSpacing: "0.1em" }}>Keyword Encyclopedia</h2>
          <div style={{ width: 80, height: 1, background: GRV.bg3, margin: "0 auto 10px" }} />
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
        <div className="card-grid-wrap" style={{ padding: "0 12px 32px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: GRV.bg3 }}>
              <div style={{ fontFamily: MONO, fontSize: 14, marginBottom: 6 }}>-- no results --</div>
              <div style={{ fontSize: 12, color: GRV.bg2 }}>try a different search or filter</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {filtered.map(([name, data], i) => (
                <KeywordCard key={name} name={name} data={data} index={i} onClick={() => setSelected({ name, data })} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "24px 16px", textAlign: "center", borderTop: `1px solid ${GRV.bg1}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 11, color: GRV.bg4, fontFamily: MONO, lineHeight: 1.8 }}>
              Card data and images retrieved from the{" "}
              <a href="https://scryfall.com/docs/api" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>Scryfall API</a>
              {" "}per Scryfall's{" "}
              <a href="https://scryfall.com/docs/api" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>non-commercial use policy</a>.
            </p>
            <p style={{ margin: 0, fontSize: 11, color: GRV.bg4, fontFamily: MONO, lineHeight: 1.8 }}>
              Magic: The Gathering and all card images are property of{" "}
              <a href="https://company.wizards.com" target="_blank" rel="noopener noreferrer" style={{ color: GRV.aqua_b, textDecoration: "none", borderBottom: `1px solid ${GRV.aqua}` }}>Wizards of the Coast</a>
              . Unofficial fan tool — not affiliated with or endorsed by Wizards of the Coast.
            </p>
          </div>
          <div style={{ width: 80, height: 1, background: GRV.bg1, margin: "0 auto 16px" }} />
          <p style={{ margin: 0, fontSize: 11, color: GRV.bg3, fontFamily: MONO, lineHeight: 1.8 }}>
            © {new Date().getFullYear()} Made with ♥ by{" "}
            <a href="https://leblanc.sh" target="_blank" rel="noopener noreferrer" style={{ color: GRV.yellow_b, textDecoration: "none", borderBottom: `1px solid ${GRV.yellow}` }}>LeBlanc Engineering</a>
            {" "}in Maine.
          </p>
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </div>

      {/* ── A-Z index bar ── */}
      <div className="az-bar">
        <AZIndex letters={ALL_LETTERS} activeLetters={activeLetters} onJump={handleAZJump} topOffset={headerHeight} />
      </div>

      {/* ── Bottom-sheet modal ── */}
      {selected && <Modal keyword={selected.name} data={selected.data} onClose={closeModal} />}

      {/* ── PWA install banner ── */}
      {showBanner && !installed && (
        isIOS
          ? <IOSInstallBanner onDismiss={() => {
              sessionStorage.setItem("ios_install_dismissed", "1");
              setShowBanner(false);
            }} />
          : <InstallBanner onInstall={handleInstall} onDismiss={() => setShowBanner(false)} />
      )}
    </>
  );
}