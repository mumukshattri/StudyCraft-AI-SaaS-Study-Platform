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

      <style jsx global>{globalCss}</style>
      <style jsx global>{mcCss}</style>
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

  if (!authLoaded) return <main className="mc"><p className="boot">⛏ Loading world...</p>
    <style jsx global>{globalCss}</style><style jsx global>{mcCss}</style></main>;
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

      <style jsx global>{globalCss}</style>
      <style jsx global>{mcCss}</style>
    </main>
  );
}

// ================= STYLES (shared by auth + app) =================
const globalCss = `
  @import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #6b8cff;
    background-image:
      linear-gradient(#8bb0ff 38%, #7aa0ff 38%, #6b8cff 70%, #5a7ae0 70%);
    background-attachment: fixed; image-rendering: pixelated; }
`;

const mcCss = `
  .mc { max-width: 640px; margin: 0 auto; padding: 24px 16px 60px;
    font-family: "Press Start 2P", monospace; color: #fff;
    text-shadow: 2px 2px 0 #000; position: relative; }
  .auth { min-height: 100vh; }
  .boot { text-align: center; font-size: 12px; margin-top: 40vh; color: #ffe9a8; }
  header { text-align: center; margin-bottom: 18px; }
  h1 { font-size: 30px; margin: 0; color: #7CFC00;
    text-shadow: 3px 3px 0 #1a5e00, 4px 4px 0 #000; letter-spacing: 1px;
    animation: bob 3s ease-in-out infinite; }
  .sub { font-size: 8px; line-height: 1.6; color: #ffe9a8; margin-top: 10px; }

  .stats { display: flex; gap: 10px; margin-bottom: 10px; align-items: stretch; }
  .xpbox { flex: 1; display: flex; align-items: center; gap: 8px;
    background: #1d1d1d; border: 4px solid #000; padding: 8px 10px; }
  .lvl { font-size: 9px; color: #55ff55; white-space: nowrap; }
  .xptxt { font-size: 9px; color: #ffd84d; white-space: nowrap; }
  .xpbar { flex: 1; height: 16px; background: #000; border: 2px solid #4a4a4a; padding: 2px; }
  .xpfill { height: 100%;
    background: repeating-linear-gradient(90deg,#7CFC00 0 6px,#5fd400 6px 8px);
    transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .streak { background: #3a1d00; border: 4px solid #000; padding: 8px 12px;
    font-size: 11px; color: #ff9d3d; display: flex; align-items: center; }

  .userbar { display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px; gap: 10px; }
  .who { font-size: 7px; color: #ffe9a8; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; max-width: 70%; }
  .logout { font-family: inherit; font-size: 7px; color: #fff; cursor: pointer;
    background: #6b3030; border: 3px solid #000; padding: 6px 8px; text-shadow: 1px 1px 0 #000; }
  .logout:hover { filter: brightness(1.2); }

  .panel { border: 4px solid #000; padding: 16px; margin-bottom: 20px;
    box-shadow: inset -4px -4px 0 rgba(0,0,0,.35), inset 4px 4px 0 rgba(255,255,255,.15);
    animation: drop .3s cubic-bezier(.2,.8,.2,1); }
  .grass { background: linear-gradient(#7bbf3a 0 14px, #8a5a2b 14px 100%); }
  .stone { background: repeating-linear-gradient(45deg,#8f8f8f 0 8px,#7d7d7d 8px 16px); }
  .wood { background: repeating-linear-gradient(90deg,#6b4326 0 10px,#5a3820 10px 20px); }
  .book { background: #b07a3a;
    background-image: repeating-linear-gradient(0deg,#a06e33 0 6px,#b07a3a 6px 12px); }
  h3 { font-size: 11px; margin: 0 0 14px; display: flex; align-items: center; gap: 10px; }

  input[type=text], input[type=email], input[type=password], input:not([type]), textarea {
    width: 100%; font-family: inherit; font-size: 9px; padding: 10px; margin-bottom: 10px;
    border: 3px solid #000; background: #1d1d1d; color: #fff; outline: none; transition: border-color .15s; }
  textarea:focus, input:focus { border-color: #7CFC00; }
  .check { display: flex; align-items: center; gap: 8px; font-size: 8px;
    color: #fff; margin-bottom: 12px; cursor: pointer; line-height: 1.5; }
  .check input { width: 16px; height: 16px; accent-color: #4caf2f; margin: 0; }

  .btn { font-family: inherit; font-size: 9px; color: #fff; cursor: pointer;
    padding: 12px 14px; border: none; text-shadow: 1px 1px 0 #000;
    box-shadow: inset -4px -4px 0 rgba(0,0,0,.4), inset 4px 4px 0 rgba(255,255,255,.25);
    transition: transform .08s, filter .15s; }
  .btn:hover:not(:disabled) { filter: brightness(1.15); }
  .btn:active { transform: translate(2px, 2px); box-shadow: inset -2px -2px 0 rgba(0,0,0,.4); }
  .btn:disabled { opacity: .6; cursor: wait; }
  .gold { background: #e0a021; } .green { background: #4caf2f; }
  .red { background: #c0392b; } .diamond { background: #22c3d6; }

  .msg { font-size: 8px; color: #fff; margin: 8px 0 0; line-height: 1.6; }
  .msg.err { color: #ff8a8a; }
  .switch { font-size: 8px; color: #9fd0ff; margin: 14px 0 0; cursor: pointer; line-height: 1.6; }
  .switch:hover { color: #fff; }
  .demo { font-size: 7px; color: #cdd1a8; margin: 10px 0 0; line-height: 1.6; opacity: .8; }
  .empty { font-size: 9px; color: #ffe9a8; line-height: 1.7; }
  .notes { font-family: inherit; font-size: 8px; color: #2a1c08; text-shadow: none;
    line-height: 1.9; white-space: pre-wrap; margin: 0; }

  .decklist { display: flex; flex-direction: column; gap: 8px; }
  .deckrow { display: flex; align-items: center; justify-content: space-between;
    background: #1d1d1d; border: 3px solid #000; padding: 10px; cursor: pointer;
    transition: transform .08s, filter .15s; }
  .deckrow:hover { filter: brightness(1.2); transform: translateX(2px); }
  .deckrow.active { border-color: #7CFC00; }
  .dinfo { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
  .dtitle { font-size: 9px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dmeta { font-size: 7px; color: #ffd84d; }
  .del { font-family: inherit; font-size: 11px; background: #6b3030; color: #fff;
    border: 3px solid #000; padding: 6px 8px; cursor: pointer; text-shadow: 1px 1px 0 #000; }
  .del:hover { filter: brightness(1.3); }
  .clearf { font-family: inherit; font-size: 7px; background: #2a4a6a; color: #fff;
    border: 2px solid #000; padding: 4px 6px; cursor: pointer; margin-left: auto; text-shadow: 1px 1px 0 #000; }

  .prog { height: 10px; background: #000; border: 2px solid #555; margin-bottom: 14px; padding: 1px; }
  .progfill { height: 100%; background: #22c3d6; transition: width .3s; }

  .card { background: #c8a165;
    background-image: repeating-linear-gradient(90deg,#b8925a 0 20px,#c8a165 20px 40px),
      repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 20px,transparent 20px 40px);
    border: 4px solid #000; padding: 20px; text-align: center; cursor: pointer;
    box-shadow: inset -5px -5px 0 rgba(0,0,0,.3), inset 5px 5px 0 rgba(255,255,255,.2);
    transition: transform .1s; }
  .card:hover { transform: translateY(-2px); }
  .card.flipped { animation: flip .35s cubic-bezier(.2,.8,.2,1); }
  .deckname { font-size: 8px; color: #3d2a12; text-shadow: none; margin-bottom: 12px; }
  .q { font-size: 12px; color: #2a1c08; text-shadow: none; line-height: 1.6; }
  .hint { font-size: 7px; color: #5a4326; text-shadow: none; margin-top: 14px; }
  .a { font-size: 11px; color: #0a5d00; text-shadow: none; margin-top: 14px;
    line-height: 1.6; border-top: 3px dashed #000; padding-top: 14px; }
  .rates { display: flex; gap: 8px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }

  .popwrap { position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
    pointer-events: none; z-index: 9; }
  .pop { display: block; font-size: 14px; color: #ffd84d;
    text-shadow: 2px 2px 0 #000; animation: rise .9s ease-out forwards; }
  .levelup { position: fixed; top: 40%; left: 0; right: 0; text-align: center;
    font-size: 22px; color: #ffd84d; text-shadow: 3px 3px 0 #000; z-index: 20;
    pointer-events: none; animation: burst 1.5s ease-out forwards; }

  @keyframes drop { from { transform: translateY(-16px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes flip { 0% { transform: perspective(600px) rotateX(-90deg); opacity: .3; }
    100% { transform: perspective(600px) rotateX(0); opacity: 1; } }
  @keyframes rise { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-40px); opacity: 0; } }
  @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes burst { 0% { transform: scale(.5); opacity: 0; } 30% { transform: scale(1.2); opacity: 1; }
    70% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
`;
