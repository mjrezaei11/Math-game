"use strict";

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const rand = (n) => Math.floor(Math.random() * n);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

/* ---------- settings: theme + sound ---------- */
let soundOn = store.get("ng_sound", true);
const applyTheme = (dark) => document.documentElement.dataset.theme = dark ? "dark" : "light";

// Simple Web Audio beep (no assets)
let ac;
function beep(freq = 660, ms = 90) {
  if (!soundOn) return;
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.setValueAtTime(0.08, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + ms / 1000);
}
const ok = () => beep(880, 100);
const fail = () => beep(220, 180);

/* ---------- navigation ---------- */
function show(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === page));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  if (page === "scores") renderScores();
}
document.querySelectorAll(".nav-btn").forEach((b) => b.onclick = () => show(b.dataset.page));
document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => show("games"));
document.querySelectorAll("[data-goto]").forEach((c) => c.onclick = (e) => {
  if (e.target.tagName !== "BUTTON") show("games");
});

/* ---------- best scores ---------- */
const BESTS = { guess: "ng_best_guess", math: "ng_best_math", memory: "ng_best_memory" };
function saveBest(key, value, lowerIsBetter = false) {
  const cur = store.get(BESTS[key], null);
  const better = cur === null || (lowerIsBetter ? value < cur : value > cur);
  if (better) store.set(BESTS[key], value);
  return store.get(BESTS[key], null);
}
function renderScores() {
  $("scoreGuess").textContent = store.get(BESTS.guess, null) ?? "-";
  $("scoreMath").textContent = store.get(BESTS.math, null) ?? "-";
  $("scoreMemory").textContent = store.get(BESTS.memory, null) ?? "-";
  $("guessBest").textContent = store.get(BESTS.guess, "-") + (store.get(BESTS.guess) ? " tries" : "");
  $("mathBest").textContent = store.get(BESTS.math, "-");
  $("memoryBest").textContent = store.get(BESTS.memory, "-");
}
$("clearScores").onclick = () => {
  Object.values(BESTS).forEach((k) => localStorage.removeItem(k));
  renderScores();
};
/* =======================================================
   1. NUMBER GUESSING
   ======================================================= */
const g = { secret: 0, tries: 0, over: true };

function guessStart() {
  g.secret = rand(100) + 1;
  g.tries = 0;
  g.over = false;
  $("guessAttempts").textContent = "0";
  $("guessInput").value = "";
  $("guessInput").disabled = false;
  $("guessSubmit").disabled = false;
  $("guessInput").focus();
  setHint("guessHint", "Guess a number between 1 and 100.");
}

function setHint(id, text, cls = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "hint " + cls;
}

function guessSubmit() {
  if (g.over) return;
  const v = Number($("guessInput").value);
  if (!Number.isInteger(v) || v < 1 || v > 100) {
    setHint("guessHint", "Enter a whole number 1-100.", "bad");
    fail();
    return;
  }
  g.tries++;
  $("guessAttempts").textContent = g.tries;
  $("guessInput").value = "";

  if (v === g.secret) {
    g.over = true;
    const best = saveBest("guess", g.tries, true);
    setHint("guessHint", `Correct! ${v} in ${g.tries} tries. Best: ${best}.`, "good");
    ok();
    $("guessInput").disabled = true;
    $("guessSubmit").disabled = true;
  } else {
    setHint("guessHint", v < g.secret ? `${v} is too low.` : `${v} is too high.`);
    beep(v < g.secret ? 440 : 330, 70);
  }
  renderScores();
}

$("guessStart").onclick = guessStart;
$("guessRestart").onclick = guessStart;
$("guessSubmit").onclick = guessSubmit;
$("guessInput").addEventListener("keydown", (e) => e.key === "Enter" && guessSubmit());

/* =======================================================
   2. QUICK MATH  (10 questions, 10s each)
   ======================================================= */
const m = { i: 0, score: 0, streak: 0, best: 0, answer: 0, timer: null, left: 0, over: true };

function newQuestion() {
  clearInterval(m.timer);
  const ops = ["+", "-", "*"];
  const op = ops[rand(3)];
  let a = rand(20) + 1, b = rand(20) + 1;
  if (op === "-" && b > a) [a, b] = [b, a];
  if (op === "*") { a = rand(10) + 2; b = rand(10) + 2; }
  m.answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  $("mathIndex").textContent = m.i + 1;
  setHint("mathQuestion", `${a} ${op} ${b} = ?`);
  m.left = 10;
  m.timer = setInterval(() => {
    if (--m.left <= 0) { clearInterval(m.timer); mathAnswer(true); }
  }, 1000);
}

function mathStart() {
  clearInterval(m.timer);
  Object.assign(m, { i: 0, score: 0, streak: 0, best: 0, over: false });
  $("mathScore").textContent = "0";
  $("mathStreak").textContent = "0";
  $("mathIndex").textContent = "0";
  $("mathInput").value = "";
  $("mathInput").disabled = false;
  $("mathSubmit").disabled = false;
  $("mathInput").focus();
  newQuestion();
}

function mathAnswer(timeout = false) {
  if (m.over) return;
  const v = Number($("mathInput").value);
  const correct = !timeout && v === m.answer;

  if (correct) {
    m.streak++;
    m.best = Math.max(m.best, m.streak);
    m.score += 10 + (m.streak - 1) * 2; // streak bonus
    ok();
  } else {
    m.streak = 0;
    fail();
  }
  $("mathScore").textContent = m.score;
  $("mathStreak").textContent = m.streak;
  $("mathInput").value = "";
  m.i++;

  if (m.i >= 10) {
    m.over = true;
    clearInterval(m.timer);
    saveBest("math", m.score);
    setHint("mathQuestion", `Done! Score ${m.score}, best streak ${m.best}.`, "good");
    $("mathInput").disabled = true;
    $("mathSubmit").disabled = true;
    renderScores();
  } else {
    newQuestion();
  }
}

$("mathStart").onclick = mathStart;
$("mathRestart").onclick = mathStart;
$("mathSubmit").onclick = () => mathAnswer();
$("mathInput").addEventListener("keydown", (e) => e.key === "Enter" && mathAnswer());

/* =======================================================
   3. NUMBER MEMORY  (growing digit sequence)
   ======================================================= */
const mem = { level: 0, seq: "", over: true, phase: "idle", timer: null, run: 0 };

function memoryStart() {
  clearTimeout(mem.timer); // cancel stale reveal/next-level from previous run
  mem.run++; // invalidate callbacks already queued
  mem.level = 0;
  mem.seq = ""; // fresh sequence, not appended to old one
  mem.over = false;
  mem.phase = "show";
  $("memoryLevel").textContent = "0";
  $("memoryDigits").textContent = "-";
  $("memoryInput").value = "";
  $("memoryInput").disabled = true;
  $("memorySubmit").disabled = true;
  nextLevel();
}

function nextLevel() {
  const run = mem.run;
  mem.level++;
  // sequence = previous + one new digit
  let seq = mem.seq;
  while (seq.length < mem.level) seq += rand(10);
  mem.seq = seq;
  $("memoryLevel").textContent = mem.level;
  $("memoryDigits").textContent = mem.seq;
  setHint("memoryHint", "Memorize...");
  mem.phase = "show";

  mem.timer = setTimeout(() => {
    if (run !== mem.run) return; // restarted meanwhile, drop this callback
    $("memoryDigits").textContent = "?";
    setHint("memoryHint", "Repeat the digits.");
    $("memoryInput").value = "";
    $("memoryInput").disabled = false;
    $("memorySubmit").disabled = false;
    $("memoryInput").focus();
    mem.phase = "input";
  }, 600 + mem.level * 450);
}

function memorySubmit() {
  if (mem.over || mem.phase !== "input") return;
  const run = mem.run;
  const v = $("memoryInput").value.trim();
  if (v === mem.seq) {
    ok();
    setHint("memoryHint", "Correct!", "good");
    $("memoryInput").disabled = true;
    $("memorySubmit").disabled = true;
    setTimeout(() => { if (mem.run === run) nextLevel(); }, 700);
  } else {
    mem.over = true;
    fail();
    const score = mem.level - 1;
    const best = saveBest("memory", score);
    $("memoryDigits").textContent = mem.seq;
    setHint("memoryHint", `Wrong. Sequence was ${mem.seq}. Level ${score}, best ${best}.`, "bad");
    $("memoryInput").disabled = true;
    $("memorySubmit").disabled = true;
    renderScores();
  }
}

$("memoryStart").onclick = memoryStart;
$("memoryRestart").onclick = memoryStart;
$("memorySubmit").onclick = memorySubmit;
$("memoryInput").addEventListener("keydown", (e) => e.key === "Enter" && memorySubmit());

/* ---------- settings wiring ---------- */
const themeToggle = $("themeToggle"), soundToggle = $("soundToggle");
themeToggle.checked = store.get("ng_dark", true);
soundToggle.checked = soundOn;
applyTheme(themeToggle.checked);

themeToggle.onchange = () => {
  applyTheme(themeToggle.checked);
  store.set("ng_dark", themeToggle.checked);
};
soundToggle.onchange = () => {
  soundOn = soundToggle.checked;
  store.set("ng_sound", soundOn);
  ok();
};

/* ---------- init ---------- */
renderScores();
show("home");
