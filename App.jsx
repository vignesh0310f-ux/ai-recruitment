import { useState, useEffect, useRef, useCallback } from "react";

// ─── MATRIX RAIN CANVAS ──────────────────────────────────────────────────────
function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>{}[]|/\\!@#$%^&*";
    const FONT_SIZE = 14;
    let cols = Math.floor(canvas.width / FONT_SIZE);
    let drops = Array.from({ length: cols }, () => Math.random() * -100);
    let speeds = Array.from({ length: cols }, () => 0.3 + Math.random() * 0.7);
    let brightness = Array.from({ length: cols }, () => Math.random());

    let frame = 0;
    let animId;

    const draw = () => {
      frame++;
      cols = Math.floor(canvas.width / FONT_SIZE);

      // Adjust arrays if cols changed
      while (drops.length < cols) { drops.push(Math.random() * -100); speeds.push(0.3 + Math.random() * 0.7); brightness.push(Math.random()); }

      // Fade trail
      ctx.fillStyle = "rgba(0, 0, 0, 0.045)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < cols; i++) {
        const y = Math.floor(drops[i]) * FONT_SIZE;
        if (y < 0 || y > canvas.height + FONT_SIZE) {
          drops[i] += speeds[i];
          continue;
        }

        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const b = brightness[i];

        // Head — bright white-green
        if (Math.floor(drops[i]) === Math.floor(drops[i])) {
          ctx.fillStyle = `rgba(180, 255, 200, ${0.9 + Math.random() * 0.1})`;
          ctx.font = `bold ${FONT_SIZE}px monospace`;
          ctx.fillText(char, i * FONT_SIZE, y);

          // Second char — bright green
          const char2 = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillStyle = `rgba(0, 255, 80, 0.85)`;
          ctx.font = `${FONT_SIZE}px monospace`;
          ctx.fillText(char2, i * FONT_SIZE, y - FONT_SIZE);

          // Third — medium
          const char3 = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillStyle = `rgba(0, 200, 60, 0.6)`;
          ctx.fillText(char3, i * FONT_SIZE, y - FONT_SIZE * 2);
        }

        // Occasional random char refresh in trail
        if (frame % 3 === 0 && Math.random() > 0.96) {
          const randY = Math.floor(Math.random() * (drops[i] - 5)) * FONT_SIZE;
          const dim = 0.08 + Math.random() * 0.15;
          ctx.fillStyle = `rgba(0, ${100 + Math.floor(b * 155)}, ${30 + Math.floor(b * 50)}, ${dim})`;
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SIZE, randY);
        }

        drops[i] += speeds[i];

        if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
          drops[i] = -Math.floor(Math.random() * 20);
          speeds[i] = 0.3 + Math.random() * 0.7;
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        zIndex: 0,
        opacity: 0.55,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const WEIGHTS = { technical: 0.4, applied: 0.3, roleAlignment: 0.2, communication: 0.1 };
const REC_COLORS = {
  "Strong Hire": "#00ff50",
  "Hire": "#00e5a0",
  "Consider": "#ffd54f",
  "Reject": "#ff4444",
};

function getRecommendation(score) {
  if (score >= 80) return "Strong Hire";
  if (score >= 65) return "Hire";
  if (score >= 45) return "Consider";
  return "Reject";
}

// ─── API ──────────────────────────────────────────────────────────────────────
// ─── ROBUST JSON EXTRACTOR ───────────────────────────────────────────────────
function safeParseJSON(raw) {
  // Strip markdown fences
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Try direct parse first
  try { return JSON.parse(text); } catch (_) {}

  // Extract first {...} block (handles extra text before/after)
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }

  // Try to repair truncated JSON by closing open structures
  try {
    let partial = text.slice(start);
    // Count open braces/brackets and close them
    let braces = 0, brackets = 0;
    let inString = false, escape = false;
    for (const ch of partial) {
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      if (ch === "[") brackets++;
      if (ch === "]") brackets--;
    }
    // Close any open string
    if (inString) partial += '"';
    // Close open arrays then objects
    partial += "]".repeat(Math.max(0, brackets));
    partial += "}".repeat(Math.max(0, braces));
    return JSON.parse(partial);
  } catch (_) {}

  throw new Error("Could not parse AI response as JSON. Please try again.");
}

const GEMINI_API_KEY = "AIzaSyAgMAmfz_a4qKUIC7Et_fbldnVcOJE-r_8";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(systemPrompt, userMessage) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function parseJD(jdText) {
  const system = `You are a JD parser. Return ONLY a single valid JSON object, absolutely no markdown, no extra text:
{"roleTitle":"string","seniorityLevel":"string","domain":"string","hardSkills":["string"],"softSkills":["string"],"keyResponsibilities":["string"],"experienceLevel":"string"}`;
  const raw = await callGemini(system, `Parse this Job Description:\n\n${jdText}`);
  return safeParseJSON(raw);
}

async function generateAssessment(parsedJD) {
  const system = `You are a senior technical assessor. Return ONLY a single valid JSON object — no markdown, no explanation, no text outside the JSON.
Schema:
{
  "mcqs": [{"id":"m1","question":"string","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"difficulty":"Easy|Medium|Hard","rubric":"string"}],
  "shortAnswer": [{"id":"s1","question":"string","difficulty":"Medium|Hard","idealAnswer":"string","rubric":"string"}],
  "caseQuestions": [{"id":"c1","scenario":"string","question":"string","difficulty":"Hard","idealAnswer":"string","rubric":"string"}],
  "practicalTask": {"id":"p1","description":"string","deliverable":"string","rubric":"string"}
}
RULES: Generate exactly 9 MCQs, 3 shortAnswer, 2 caseQuestions, 1 practicalTask.
Keep all string values concise (under 200 chars each) to avoid truncation.
Every question must be SPECIFIC to the role — not generic.`;
  const raw = await callGemini(system, `Generate assessment for this role:\n${JSON.stringify(parsedJD)}`);
  return safeParseJSON(raw);
}

async function scoreSubmission(parsedJD, assessment, candidateName, answers) {
  const system = `You are a strict AI evaluator. Return ONLY a single valid JSON object, no markdown, no extra text:
{"candidateName":"string","scores":{"technical":0,"applied":0,"roleAlignment":0,"communication":0},"mcqScore":0,"totalScore":0,"strengths":["string"],"weaknesses":["string"],"recommendation":"Strong Hire|Hire|Consider|Reject","reasoning":"string"}
Rules: all score values are integers 0-100. Be consistent.`;
  const payload = {
    role: parsedJD.roleTitle,
    mcqs: assessment.mcqs.map((q) => ({ id: q.id, correctIndex: q.correctIndex, rubric: q.rubric })),
    shortAnswer: assessment.shortAnswer.map((q) => ({ id: q.id, rubric: q.rubric, idealAnswer: q.idealAnswer })),
    caseQuestions: assessment.caseQuestions.map((q) => ({ id: q.id, rubric: q.rubric, idealAnswer: q.idealAnswer })),
    practicalTask: { id: assessment.practicalTask.id, rubric: assessment.practicalTask.rubric },
    candidateAnswers: answers,
  };
  const raw = await callGemini(system, `Score candidate "${candidateName}":\n${JSON.stringify(payload)}`);
  const result = safeParseJSON(raw);
  result.totalScore = Math.round(
    (result.scores.technical || 0) * WEIGHTS.technical +
    (result.scores.applied || 0) * WEIGHTS.applied +
    (result.scores.roleAlignment || 0) * WEIGHTS.roleAlignment +
    (result.scores.communication || 0) * WEIGHTS.communication
  );
  result.recommendation = getRecommendation(result.totalScore);
  return result;
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const G = {
  card: {
    background: "rgba(0,8,0,0.82)",
    border: "1px solid rgba(0,255,80,0.18)",
    borderRadius: 4,
    padding: 28,
    backdropFilter: "blur(12px)",
    boxShadow: "0 0 30px rgba(0,255,80,0.05), inset 0 0 60px rgba(0,0,0,0.5)",
  },
  btn: {
    background: "transparent",
    color: "#00ff50",
    border: "1px solid #00ff50",
    borderRadius: 2,
    padding: "11px 26px",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: 2,
    textTransform: "uppercase",
    transition: "all 0.2s",
    boxShadow: "0 0 10px rgba(0,255,80,0.1)",
  },
  btnHot: {
    background: "rgba(0,255,80,0.12)",
    color: "#00ff50",
    border: "1px solid #00ff50",
    borderRadius: 2,
    padding: "11px 26px",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: 2,
    textTransform: "uppercase",
    boxShadow: "0 0 20px rgba(0,255,80,0.25)",
  },
  input: {
    background: "rgba(0,20,0,0.7)",
    border: "1px solid rgba(0,255,80,0.25)",
    borderRadius: 2,
    padding: "11px 14px",
    color: "#00ff50",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    fontSize: 13,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    caretColor: "#00ff50",
  },
  label: {
    fontSize: 10,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(0,255,80,0.45)",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    marginBottom: 8,
    display: "block",
  },
  tag: (color) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 2,
    fontSize: 10,
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    fontWeight: 700,
    color,
    border: `1px solid ${color}`,
    background: `${color}15`,
    letterSpacing: 1,
  }),
};

// ─── LOADING ──────────────────────────────────────────────────────────────────
function MatrixLoader({ label }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => d.length >= 4 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 4, color: "#00ff50", fontFamily: "monospace", animation: "flicker 2s infinite" }}>
        {label}{dots}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            width: 4, height: 24,
            background: "#00ff50",
            opacity: 0.3,
            animation: `bar 1s ${i * 0.12}s ease-in-out infinite alternate`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color = "#00ff50" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "rgba(0,255,80,0.5)", fontFamily: "monospace", letterSpacing: 2 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontFamily: "monospace", fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 3, background: "rgba(0,255,80,0.08)", borderRadius: 1 }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 8px ${color}`,
          transition: "width 1.2s ease",
        }} />
      </div>
    </div>
  );
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function Timer({ totalSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  const m = Math.floor(remaining / 60).toString().padStart(2, "0");
  const s = (remaining % 60).toString().padStart(2, "0");
  const pct = (remaining / totalSeconds) * 100;
  const color = pct > 40 ? "#00ff50" : pct > 15 ? "#ffd54f" : "#ff4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 10, color: "rgba(0,255,80,0.4)", letterSpacing: 3, fontFamily: "monospace" }}>TIME</span>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 20, color, fontWeight: 700, letterSpacing: 3, textShadow: `0 0 10px ${color}` }}>
        {m}:{s}
      </span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("landing");
  const [jdText, setJdText] = useState("");
  const [parsedJD, setParsedJD] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [candidateName, setCandidateName] = useState("");
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [recruiterOverrides, setRecruiterOverrides] = useState({});

  function allQuestions() {
    if (!assessment) return [];
    return [
      ...assessment.mcqs.map((q) => ({ ...q, type: "mcq" })),
      ...assessment.shortAnswer.map((q) => ({ ...q, type: "short" })),
      ...assessment.caseQuestions.map((q) => ({ ...q, type: "case" })),
      { ...assessment.practicalTask, type: "practical" },
    ];
  }
  const questions = allQuestions();

  async function handleParseJD() {
    if (!jdText.trim()) { setError("// ERROR: no JD data provided"); return; }
    setError(""); setPhase("loading"); setLoadingMsg("PARSING JD // EXTRACTING ROLE MATRIX");
    try {
      const parsed = await parseJD(jdText);
      setLoadingMsg("GENERATING ASSESSMENT // BUILDING QUESTION MATRIX");
      const assess = await generateAssessment(parsed);
      setParsedJD(parsed); setAssessment(assess); setPhase("setup");
    } catch (e) { setError("// SYSTEM ERROR: " + e.message); setPhase("landing"); }
  }

  function handleStartTest() {
    if (!candidateName.trim()) { setError("// ERROR: candidate identity required"); return; }
    setError(""); setAnswers({}); setCurrentQ(0); setPhase("testing");
  }

  async function handleSubmit() {
    setPhase("loading"); setLoadingMsg("SCORING RESPONSES // RUNNING AI EVALUATION ENGINE");
    try {
      const result = await scoreSubmission(parsedJD, assessment, candidateName, answers);
      setCurrentResult(result);
      setResults((prev) => [...prev.filter((r) => r.candidateName !== candidateName), result].sort((a, b) => b.totalScore - a.totalScore));
      setPhase("result");
    } catch (e) { setError("// SCORING ERROR: " + e.message); setPhase("testing"); }
  }

  const setAnswer = (id, val) => setAnswers((prev) => ({ ...prev, [id]: val }));
  const currentQuestion = questions[currentQ];

  // NAV
  const Nav = ({ right }) => (
    <div style={{
      borderBottom: "1px solid rgba(0,255,80,0.1)",
      padding: "14px 36px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(0,4,0,0.9)",
      backdropFilter: "blur(20px)",
      position: "sticky", top: 0, zIndex: 200,
    }}>
      <div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 16, color: "#00ff50", letterSpacing: 3, textShadow: "0 0 15px #00ff50" }}>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>AI RECRUITMENT</span>
        </div>
        <div style={{ fontSize: 9, color: "rgba(0,255,80,0.35)", fontFamily: "monospace", letterSpacing: 3, marginTop: 2 }}>
          INTELLIGENCE PLATFORM v2.0 // POWERED BY CLAUDE
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>{right}</div>
    </div>
  );

  // LOADING
  if (phase === "loading") return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#00ff50" }}>
      <MatrixRain />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Nav right={null} />
        <MatrixLoader label={loadingMsg} />
      </div>
      <style>{CSS}</style>
    </div>
  );

  // LANDING
  if (phase === "landing") return (
    <div style={{ minHeight: "100vh", background: "#000300", color: "#00ff50" }}>
      <MatrixRain />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Nav right={results.length > 0 ? <button style={G.btn} onClick={() => setPhase("dashboard")}>DASHBOARD [{results.length}]</button> : null} />

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "70px 36px 40px" }}>
          <div style={{ marginBottom: 52 }}>
            <div style={G.label}>// SYSTEM INITIALIZED</div>
            <h1 style={{ fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.05, marginBottom: 20 }}>
              <span style={{
                fontSize: 64,
                fontWeight: 900,
                display: "block",
                background: "linear-gradient(90deg, #00ff50 0%, #00ffaa 40%, #4fc3f7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 40px rgba(0,255,80,0.6))",
                letterSpacing: -2,
              }}>AI RECRUITMENT</span>
              <span style={{
                fontSize: 18,
                fontWeight: 400,
                color: "rgba(0,255,80,0.4)",
                letterSpacing: 6,
                display: "block",
                marginTop: 4,
              }}>INTELLIGENCE PLATFORM</span>
            </h1>
            <p style={{ color: "rgba(0,255,80,0.55)", maxWidth: 500, lineHeight: 1.8, fontSize: 14, fontFamily: "monospace" }}>
              Paste JD → Claude parses, generates precision assessment, scores candidates, delivers structured hiring decision in &lt;60s.
            </p>
          </div>

          <div style={G.card}>
            <div style={G.label}>// INPUT_JD.PARSE</div>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder={`> paste full job description here\n> role title, requirements, responsibilities\n> system will auto-extract and generate assessment_`}
              style={{ ...G.input, minHeight: 220, resize: "vertical", lineHeight: 1.8 }}
            />
            {error && <div style={{ color: "#ff4444", fontSize: 12, marginTop: 8, fontFamily: "monospace" }}>{error}</div>}
            <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={G.btnHot} onClick={handleParseJD}>&gt; GENERATE ASSESSMENT</button>
              <button style={G.btn} onClick={() => setJdText(SAMPLE_JD)}>&gt; LOAD SAMPLE JD</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 24 }}>
            {[
              { code: "01", n: "9+ MCQs", d: "role-specific, difficulty-tagged" },
              { code: "02", n: "AI SCORING", d: "40/30/20/10 weighted rubric" },
              { code: "03", n: "LEADERBOARD", d: "HR dashboard + recruiter overrides" },
            ].map((f) => (
              <div key={f.n} style={{ ...G.card, padding: 18 }}>
                <div style={{ fontSize: 9, color: "rgba(0,255,80,0.3)", fontFamily: "monospace", marginBottom: 6 }}>[{f.code}]</div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", marginBottom: 4, textShadow: "0 0 10px rgba(0,255,80,0.3)" }}>{f.n}</div>
                <div style={{ fontSize: 11, color: "rgba(0,255,80,0.4)", fontFamily: "monospace" }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // SETUP
  if (phase === "setup") return (
    <div style={{ minHeight: "100vh", background: "#000300", color: "#00ff50" }}>
      <MatrixRain />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Nav right={<button style={G.btn} onClick={() => setPhase("landing")}>&lt; NEW JD</button>} />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "54px 36px" }}>
          <div style={G.label}>// ASSESSMENT COMPILED</div>
          <h2 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 26, marginBottom: 16, textShadow: "0 0 20px rgba(0,255,80,0.3)" }}>
            {parsedJD?.roleTitle}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {[parsedJD?.seniorityLevel, parsedJD?.domain, parsedJD?.experienceLevel].filter(Boolean).map((t) => (
              <span key={t} style={G.tag("#00ff50")}>{t}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            <div style={G.card}>
              <div style={G.label}>// REQUIRED SKILLS</div>
              {parsedJD?.hardSkills?.map((sk) => <div key={sk} style={{ fontSize: 12, marginBottom: 5, fontFamily: "monospace", color: "rgba(0,255,80,0.8)" }}>+ {sk}</div>)}
            </div>
            <div style={G.card}>
              <div style={G.label}>// ASSESSMENT STRUCTURE</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2, color: "rgba(0,255,80,0.8)" }}>
                <div>[MCQ]  {assessment?.mcqs?.length} questions</div>
                <div>[SA]   {assessment?.shortAnswer?.length} questions</div>
                <div>[CASE] {assessment?.caseQuestions?.length} questions</div>
                <div>[PRAC] 1 task</div>
              </div>
            </div>
          </div>

          <div style={G.card}>
            <div style={G.label}>// CANDIDATE_ID.INIT</div>
            <input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="> enter candidate full name_"
              style={{ ...G.input, marginBottom: 16 }}
              onKeyDown={(e) => e.key === "Enter" && handleStartTest()}
            />
            {error && <div style={{ color: "#ff4444", fontSize: 12, marginBottom: 12, fontFamily: "monospace" }}>{error}</div>}
            <button style={G.btnHot} onClick={handleStartTest}>&gt; START ASSESSMENT</button>
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // TESTING
  if (phase === "testing" && currentQuestion) {
    const progress = (currentQ / questions.length) * 100;
    const diffColor = currentQuestion.difficulty === "Hard" ? "#ff4444" : currentQuestion.difficulty === "Medium" ? "#ffd54f" : "#00ff50";
    return (
      <div style={{ minHeight: "100vh", background: "#000300", color: "#00ff50" }}>
        <MatrixRain />
        <div style={{ position: "relative", zIndex: 10 }}>
          <Nav right={<Timer totalSeconds={3600} onExpire={handleSubmit} />} />

          <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px" }}>
            {/* Progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontFamily: "monospace", fontSize: 10, color: "rgba(0,255,80,0.4)", letterSpacing: 2 }}>
                <span>Q[{String(currentQ + 1).padStart(2, "0")}/{String(questions.length).padStart(2, "0")}] {candidateName}</span>
                <span style={{ color: diffColor }}>[{currentQuestion.difficulty || "PRACTICAL"}]</span>
              </div>
              <div style={{ height: 2, background: "rgba(0,255,80,0.08)" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "#00ff50", boxShadow: "0 0 8px #00ff50", transition: "width 0.4s ease" }} />
              </div>
            </div>

            <div style={G.card}>
              {/* MCQ */}
              {currentQuestion.type === "mcq" && (
                <div>
                  <div style={G.label}>// MCQ_{currentQuestion.id?.toUpperCase()}</div>
                  <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 24, fontFamily: "monospace", color: "rgba(0,255,80,0.9)" }}>{currentQuestion.question}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {currentQuestion.options.map((opt, i) => {
                      const selected = answers[currentQuestion.id] === i;
                      return (
                        <div key={i} onClick={() => setAnswer(currentQuestion.id, i)} style={{
                          padding: "12px 16px", borderRadius: 2, cursor: "pointer",
                          border: `1px solid ${selected ? "#00ff50" : "rgba(0,255,80,0.12)"}`,
                          background: selected ? "rgba(0,255,80,0.1)" : "rgba(0,20,0,0.5)",
                          transition: "all 0.15s",
                          boxShadow: selected ? "0 0 15px rgba(0,255,80,0.15)" : "none",
                          fontFamily: "monospace",
                        }}>
                          <span style={{ color: selected ? "#00ff50" : "rgba(0,255,80,0.4)", marginRight: 12, fontSize: 11, letterSpacing: 1 }}>[{String.fromCharCode(65 + i)}]</span>
                          <span style={{ fontSize: 13, color: selected ? "#00ff50" : "rgba(0,255,80,0.75)" }}>{opt.replace(/^[A-D]\)\s*/, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentQuestion.type === "short" && (
                <div>
                  <div style={G.label}>// SHORT_ANSWER_{currentQuestion.id?.toUpperCase()}</div>
                  <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 18, fontFamily: "monospace", color: "rgba(0,255,80,0.9)" }}>{currentQuestion.question}</p>
                  <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                    placeholder="> write answer here_" style={{ ...G.input, minHeight: 140, resize: "vertical", lineHeight: 1.8 }} />
                </div>
              )}

              {currentQuestion.type === "case" && (
                <div>
                  <div style={G.label}>// CASE_SCENARIO_{currentQuestion.id?.toUpperCase()}</div>
                  <div style={{ background: "rgba(0,255,80,0.04)", border: "1px solid rgba(0,255,80,0.12)", borderRadius: 2, padding: "14px 16px", marginBottom: 18 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(0,255,80,0.6)", fontFamily: "monospace" }}>{currentQuestion.scenario}</p>
                  </div>
                  <p style={{ fontSize: 14, fontFamily: "monospace", marginBottom: 14, color: "rgba(0,255,80,0.9)" }}>&gt; {currentQuestion.question}</p>
                  <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                    placeholder="> structured response_" style={{ ...G.input, minHeight: 180, resize: "vertical", lineHeight: 1.8 }} />
                </div>
              )}

              {currentQuestion.type === "practical" && (
                <div>
                  <div style={G.label}>// PRACTICAL_TASK</div>
                  <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 14, fontFamily: "monospace", color: "rgba(0,255,80,0.75)" }}>{currentQuestion.description}</p>
                  <div style={{ background: "rgba(0,255,80,0.06)", border: "1px solid rgba(0,255,80,0.2)", borderRadius: 2, padding: "10px 14px", marginBottom: 18, fontSize: 11, color: "#00ff50", fontFamily: "monospace" }}>
                    &gt; DELIVERABLE: {currentQuestion.deliverable}
                  </div>
                  <textarea value={answers[currentQuestion.id] || ""} onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                    placeholder="> submit work here_" style={{ ...G.input, minHeight: 200, resize: "vertical", lineHeight: 1.8 }} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <button style={{ ...G.btn, opacity: currentQ === 0 ? 0.3 : 1 }} disabled={currentQ === 0} onClick={() => setCurrentQ((q) => q - 1)}>&lt; PREV</button>
              {currentQ < questions.length - 1
                ? <button style={G.btnHot} onClick={() => setCurrentQ((q) => q + 1)}>NEXT &gt;</button>
                : <button style={{ ...G.btnHot, borderColor: "#ff4444", color: "#ff4444", background: "rgba(255,68,68,0.1)" }} onClick={handleSubmit}>SUBMIT ASSESSMENT</button>
              }
            </div>
          </div>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  // RESULT
  if (phase === "result" && currentResult) {
    const rec = currentResult.recommendation;
    const recColor = REC_COLORS[rec];
    return (
      <div style={{ minHeight: "100vh", background: "#000300", color: "#00ff50" }}>
        <MatrixRain />
        <div style={{ position: "relative", zIndex: 10 }}>
          <Nav right={
            <div style={{ display: "flex", gap: 10 }}>
              <button style={G.btn} onClick={() => { setCandidateName(""); setPhase("setup"); }}>NEW CANDIDATE</button>
              <button style={G.btnHot} onClick={() => setPhase("dashboard")}>DASHBOARD &gt;</button>
            </div>
          } />

          <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 36px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={G.label}>// EVALUATION_COMPLETE</div>
                <h2 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 28, marginBottom: 6, textShadow: "0 0 20px rgba(0,255,80,0.4)" }}>{currentResult.candidateName}</h2>
                <div style={{ fontSize: 12, color: "rgba(0,255,80,0.5)", fontFamily: "monospace" }}>{parsedJD?.roleTitle}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace", color: recColor, lineHeight: 1, textShadow: `0 0 30px ${recColor}` }}>
                  {currentResult.totalScore}
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,255,80,0.4)", fontFamily: "monospace", marginBottom: 10 }}>/100</div>
                <span style={{ ...G.tag(recColor), fontSize: 12, padding: "5px 14px", letterSpacing: 2 }}>{rec}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={G.card}>
                <div style={G.label}>// SCORE_MATRIX</div>
                <ScoreBar label="TECHNICAL ACCURACY [40%]" value={currentResult.scores.technical} color="#00ff50" />
                <ScoreBar label="APPLIED THINKING [30%]" value={currentResult.scores.applied} color="#4fc3f7" />
                <ScoreBar label="ROLE ALIGNMENT [20%]" value={currentResult.scores.roleAlignment} color="#ffd54f" />
                <ScoreBar label="COMMUNICATION [10%]" value={currentResult.scores.communication} color="#ce93d8" />
                <ScoreBar label="MCQ ACCURACY" value={currentResult.mcqScore || 0} color="#ff8a65" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={G.card}>
                  <div style={G.label}>// STRENGTHS</div>
                  {currentResult.strengths?.map((st) => <div key={st} style={{ fontSize: 12, marginBottom: 6, fontFamily: "monospace", color: "#00ff50" }}>+ {st}</div>)}
                </div>
                <div style={G.card}>
                  <div style={G.label}>// GAPS_DETECTED</div>
                  {currentResult.weaknesses?.map((w) => <div key={w} style={{ fontSize: 12, marginBottom: 6, fontFamily: "monospace", color: "rgba(0,255,80,0.45)" }}>- {w}</div>)}
                </div>
              </div>
            </div>

            <div style={G.card}>
              <div style={G.label}>// AI_REASONING</div>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: "rgba(0,255,80,0.65)", fontFamily: "monospace" }}>{currentResult.reasoning}</p>
            </div>
          </div>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  // DASHBOARD
  if (phase === "dashboard") return (
    <div style={{ minHeight: "100vh", background: "#000300", color: "#00ff50" }}>
      <MatrixRain />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Nav right={<button style={G.btnHot} onClick={() => { setCandidateName(""); setPhase("setup"); }}>&gt; ADD CANDIDATE</button>} />
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 36px" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={G.label}>// CANDIDATE_LEADERBOARD.SORT(SCORE DESC)</div>
            <h2 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 24, textShadow: "0 0 20px rgba(0,255,80,0.3)" }}>
              {parsedJD?.roleTitle} <span style={{ color: "rgba(0,255,80,0.35)", fontSize: 16 }}>// {results.length} evaluated</span>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((r, idx) => {
              const override = recruiterOverrides[r.candidateName];
              const displayRec = override || r.recommendation;
              const recColor = REC_COLORS[displayRec];
              return (
                <div key={r.candidateName} style={{ ...G.card, display: "flex", alignItems: "center", gap: 18, padding: "18px 24px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900, color: idx === 0 ? "#ffd54f" : "rgba(0,255,80,0.2)", width: 28, textShadow: idx === 0 ? "0 0 15px #ffd54f" : "none" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>{r.candidateName}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      {r.strengths?.slice(0, 2).map((st) => (
                        <span key={st} style={{ fontSize: 10, background: "rgba(0,255,80,0.08)", color: "rgba(0,255,80,0.6)", padding: "1px 7px", borderRadius: 2, fontFamily: "monospace" }}>{st}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 54px)", gap: 6, textAlign: "center" }}>
                    {[
                      { l: "TECH", v: r.scores?.technical },
                      { l: "APPL", v: r.scores?.applied },
                      { l: "ROLE", v: r.scores?.roleAlignment },
                      { l: "COMM", v: r.scores?.communication },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#00ff50" }}>{v}</div>
                        <div style={{ fontSize: 9, color: "rgba(0,255,80,0.35)", letterSpacing: 1 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 90 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, fontFamily: "monospace", color: recColor, textShadow: `0 0 15px ${recColor}` }}>{r.totalScore}</div>
                    <span style={{ ...G.tag(recColor), fontSize: 10, letterSpacing: 1 }}>{displayRec}</span>
                  </div>
                  <select value={override || ""} onChange={(e) => setRecruiterOverrides((prev) => ({ ...prev, [r.candidateName]: e.target.value || undefined }))}
                    style={{ ...G.input, width: 130, padding: "6px 10px", fontSize: 11, letterSpacing: 1 }}>
                    <option value="">AI DECISION</option>
                    <option value="Strong Hire">STRONG HIRE</option>
                    <option value="Hire">HIRE</option>
                    <option value="Consider">CONSIDER</option>
                    <option value="Reject">REJECT</option>
                  </select>
                </div>
              );
            })}
            {results.length === 0 && (
              <div style={{ ...G.card, textAlign: "center", padding: 60, color: "rgba(0,255,80,0.3)", fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>
                // NO CANDIDATES EVALUATED YET
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  return <div style={{ background: "#000", minHeight: "100vh" }}><MatrixRain /><style>{CSS}</style></div>;
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
::selection { background: rgba(0,255,80,0.2); color: #00ff50; }
textarea::placeholder, input::placeholder { color: rgba(0,255,80,0.2) !important; }
textarea, input, select { color-scheme: dark; }
select option { background: #000800; color: #00ff50; }
button:hover { opacity: 0.8; transform: translateY(-1px); }
@keyframes flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.4; }
  94% { opacity: 1; }
  96% { opacity: 0.6; }
  97% { opacity: 1; }
}
@keyframes bar {
  from { transform: scaleY(0.3); opacity: 0.3; }
  to { transform: scaleY(1); opacity: 1; }
}
`;

// ─── SAMPLE JD ────────────────────────────────────────────────────────────────
const SAMPLE_JD = `Senior Product Manager – AI/ML Platform
Company: TechCorp Inc. | Location: Remote | Type: Full-Time

About the Role:
We are looking for a Senior Product Manager to lead our AI/ML Platform team. You will own the roadmap for our internal machine learning infrastructure, enabling data scientists and engineers to build, train, and deploy models at scale.

Responsibilities:
- Define and execute the product roadmap for ML infrastructure and tooling
- Partner with ML engineers, data scientists, and platform engineers to prioritize features
- Translate business objectives into clear product requirements and epics
- Drive adoption of internal ML tools across 5+ business units
- Define success metrics and track product performance using data
- Conduct user research with internal stakeholders
- Manage quarterly OKRs and present to executive leadership

Required Skills:
- 5+ years of product management experience, with 2+ years in ML/AI products
- Deep understanding of the ML lifecycle: data preprocessing, model training, evaluation, deployment
- Experience with tools like MLflow, Kubeflow, SageMaker, or similar
- Strong data fluency: SQL, understanding of A/B testing, metrics frameworks
- Excellent written and verbal communication
- Track record of driving 0→1 products in a fast-paced environment

Nice to Have:
- Engineering background (CS degree or coding experience)
- Experience with LLMs, vector databases, or RAG architectures
- Familiarity with enterprise data governance

Seniority: Senior | Experience: 5-8 years | Domain: Product Management / AI-ML`;
