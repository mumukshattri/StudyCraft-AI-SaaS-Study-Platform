import { useState, useEffect, useRef } from "react";

// --- Web Audio: chiptune SFX, no files needed ---
function useSfx() {
  const ctx = useRef(null);
  const ac = () => (ctx.current ||= new (window.AudioContext || window.webkitAudioContext)());
  const beep = (freq, dur = 0.09, type = "square", vol = 0.08) => {
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    } catch {}
  };
  return {
    click: () => beep(220, 0.06),
    flip: () => beep(440, 0.07, "triangle"),
    good: () => { beep(523); setTimeout(() => beep(784), 70); },
    easy: () => { beep(659); setTimeout(() => beep(988), 70); setTimeout(() => beep(1319), 140); },
    again: () => beep(160, 0.18, "sawtooth"),
    craft: () => { beep(392, 0.08); setTimeout(() => beep(523, 0.08), 90); setTimeout(() => beep(659, 0.12), 180); },
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.14, "square", 0.1), i * 100)),
    break: () => beep(120, 0.22, "sawtooth"),
  };
}

// ================= AUTH SCREEN =================
function AuthScreen({ onAuthed, sfx }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(""); sfx.click();
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || "Something went wrong"); sfx.break(); return; }
      sfx.craft(); onAuthed(data.user);
    } catch { setErr("Network error — is the server running?"); }
    finally { setBusy(false); }
  };

  return (
    <main className="mc auth">
      <header>
        <h1>⛏ StudyCraft</h1>
        <p className="sub">AI Flashcards &amp; Spaced Repetition — Craft Your Knowledge</p>
      </header>

      <section className="panel grass">
        <h3>{mode === "login" ? "🔑 Log In" : "✨ Sign Up"}</h3>
        <input type="email" placeholder="email@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} onFocus={sfx.click}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <input type="password" placeholder="password (6+ chars)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn gold" disabled={busy} onClick={submit}>
          {busy ? "⏳ ..." : mode === "login" ? "🔑 Enter World" : "✨ Create Character"}
        </button>
        {err && <p className="msg err">✖ {err}</p>}
        <p className="switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); sfx.click(); }}>
          {mode === "login" ? "New here? → Sign up" : "Have an account? → Log in"}
        </p>
        <p className="demo">Demo: demo@studycraft.app / demo1234</p>
      </section>
    </main>
  );
}

// ================= MAIN APP =================
export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [cards, setCards] = useState([]);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pops, setPops] = useState([]);
  const [notes, setNotes] = useState("");
  const [wantNotes, setWantNotes] = useState(true);
  const [levelUp, setLevelUp] = useState(false);
  const [decks, setDecks] = useState([]);
  const [deckFilter, setDeckFilter] = useState(null); // null = study all due
  const sfx = useSfx();

  // Check session on load
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setUser(d.user); setAuthLoaded(true);
      if (d.user) { setXp(d.user.xp); setStreak(d.user.streak); }
    });
  }, []);

  const loadDue = async (deckId = deckFilter) => {
    const url = deckId ? `/api/due?deckId=${deckId}` : "/api/due";
    const r = await fetch(url).then((x) => x.json());
    setCards(r.cards); setXp(r.xp); setStreak(r.streak || 0); setI(0); setShow(false);
  };
  const loadDecks = async () => {
    const r = await fetch("/api/decks").then((x) => x.json());
    setDecks(r.decks || []);
  };
  useEffect(() => { if (user) { loadDue(); loadDecks(); } }, [user]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    sfx.break();
    setUser(null); setCards([]); setDecks([]); setXp(0); setStreak(0);
    setDeckFilter(null); setNotes(""); setMsg("");
  };

  const generate = async () => {
    if (!text.trim()) { setMsg("⛏ Paste some study material first!"); return; }
    setLoading(true); setMsg("⚙ Crafting with AI..."); setNotes("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text, notes: wantNotes }),
      }).then((x) => x.json());
      sfx.craft();
      setMsg(`✔ Crafted ${r.count} cards!`);
      if (r.notes) setNotes(r.notes);
      setText(""); setTitle("");
      setDeckFilter(null);
      loadDue(null); loadDecks();
    } catch {
      setMsg("✖ Something broke — check the server.");
    } finally { setLoading(false); }
  };

  const studyDeck = (deck) => {
    sfx.click();
    setDeckFilter(deck?.id ?? null);
    setNotes(""); setMsg("");
    loadDue(deck?.id ?? null);
    document.querySelector(".stone")?.scrollIntoView({ behavior: "smooth" });
  };

  const deleteDeck = async (deck, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${deck.title}" and its ${deck.cards} cards? This can't be undone.`)) return;
    await fetch(`/api/decks?id=${deck.id}`, { method: "DELETE" });
    sfx.break();
    if (deckFilter === deck.id) { setDeckFilter(null); loadDue(null); }
    loadDecks();
  };

  const popXp = (amt) => {
    const id = Math.round(performance.now());
    setPops((p) => [...p, { id, amt }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };

  const rate = async (rating) => {
    const card = cards[i];
    rating === 0 ? sfx.again() : rating === 3 ? sfx.good() : sfx.easy();
    const r = await fetch("/api/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, rating }),
    }).then((x) => x.json());
    if (Math.floor(r.xp / 100) > Math.floor(xp / 100)) {
      setLevelUp(true); sfx.levelup(); setTimeout(() => setLevelUp(false), 1500);
    }
    popXp(r.xp - xp); setXp(r.xp); setStreak(r.streak);
    if (i + 1 < cards.length) { setI(i + 1); setShow(false); }
    else { setMsg("🏆 Session complete! Come back tomorrow to keep your streak."); loadDue(); loadDecks(); }
  };

  const reveal = () => { if (!show) { setShow(true); sfx.flip(); } };

  if (!authLoaded) return <main className="mc"><p className="boot">⛏ Loading world...</p></main>;
  if (!user) return <AuthScreen onAuthed={setUser} sfx={sfx} />;

  const card = cards[i];
  const level = Math.floor(xp / 100);
  const levelPct = xp % 100;
  const progress = cards.length ? Math.round((i / cards.length) * 100) : 0;
  const activeDeck = deckFilter ? decks.find((d) => d.id === deckFilter) : null;

  return (
    <main className="mc">
      <div className="popwrap">
        {pops.map((p) => <span key={p.id} className="pop">{p.amt >= 0 ? "+" : ""}{p.amt} XP</span>)}
      </div>
      {levelUp && <div className="levelup">⭐ LEVEL UP! ⭐</div>}

      <header>
        <h1>⛏ StudyCraft</h1>
        <p className="sub">AI Flashcards &amp; Spaced Repetition — Craft Your Knowledge</p>
      </header>

      {/* Stats: XP bar + streak + who + logout */}
      <div className="stats">
        <div className="xpbox">
          <span className="lvl">LVL {level}</span>
          <div className="xpbar"><div className="xpfill" style={{ width: `${levelPct}%` }} /></div>
          <span className="xptxt">⚡{xp}</span>
        </div>
        <div className="streak" title="Daily streak">🔥 {streak}</div>
      </div>
      <div className="userbar">
        <span className="who" title={user.email}>🧑‍🌾 {user.email}</span>
        <button className="logout" onClick={logout}>Log out</button>
      </div>

      {/* Crafting table */}
      <section className="panel grass">
        <h3>🧱 Crafting Table</h3>
        <input placeholder="Deck name..." value={title} onChange={(e) => setTitle(e.target.value)} onFocus={sfx.click} />
        <textarea placeholder="Paste your study material here..." rows={4}
          value={text} onChange={(e) => setText(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={wantNotes} onChange={(e) => setWantNotes(e.target.checked)} />
          <span>📜 Also generate AI revision notes</span>
        </label>
        <button className="btn gold" disabled={loading} onClick={generate}>
          {loading ? "⏳ Crafting..." : "⛏ Craft with AI"}
        </button>
        {msg && <p className="msg">{msg}</p>}
      </section>

      {/* AI Notes */}
      {notes && (
        <section className="panel book">
          <h3>📜 AI Revision Notes</h3>
          <pre className="notes">{notes}</pre>
        </section>
      )}

      {/* Deck library */}
      <section className="panel wood">
        <h3>🎒 Your Decks ({decks.length})</h3>
        {decks.length === 0 && <p className="empty">No decks yet — craft one above! 🌱</p>}
        <div className="decklist">
          {decks.map((d) => (
            <div key={d.id} className={`deckrow ${deckFilter === d.id ? "active" : ""}`} onClick={() => studyDeck(d)}>
              <div className="dinfo">
                <span className="dtitle">📦 {d.title}</span>
                <span className="dmeta">{d.cards} cards{d.due > 0 ? ` · ${d.due} due` : " · ✓ done"}</span>
              </div>
              <button className="del" title="Delete deck" onClick={(e) => deleteDeck(d, e)}>🗑</button>
            </div>
          ))}
        </div>
      </section>

      {/* The mines */}
      <section className="panel stone">
        <h3>💎 The Mines — {activeDeck ? activeDeck.title : "All Due"} ({cards.length})
          {activeDeck && <button className="clearf" onClick={() => studyDeck(null)}>← all</button>}
        </h3>
        {cards.length > 0 && (
          <div className="prog"><div className="progfill" style={{ width: `${progress}%` }} /></div>
        )}
        {!card && <p className="empty">No blocks to mine! Craft a deck above. 🌱</p>}
        {card && (
          <div className={`card ${show ? "flipped" : ""}`} onClick={reveal}>
            <div className="deckname">📦 {card.title}</div>
            <div className="q">{card.question}</div>
            {!show && <div className="hint">▸ click block to reveal</div>}
            {show && <div className="a">{card.answer}</div>}
            {show && (
              <div className="rates" onClick={(e) => e.stopPropagation()}>
                <button className="btn red" onClick={() => rate(0)}>💀 Again</button>
                <button className="btn green" onClick={() => rate(3)}>🌿 Good</button>
                <button className="btn diamond" onClick={() => rate(5)}>💎 Easy</button>
              </div>
            )}
          </div>
        )}
      </section>

    </main>
  );
}
