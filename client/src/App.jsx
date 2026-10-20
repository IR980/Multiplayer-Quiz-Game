import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowRight,
  AudioLines,
  Check,
  Clock3,
  Crown,
  Globe2,
  Medal,
  Plus,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const CATEGORIES = [
  "General Knowledge",
  "Science",
  "Sports",
  "Technology",
  "History",
  "Entertainment",
];
const socket = io(SERVER_URL, { autoConnect: true, reconnection: true });

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("en");
  const [questionCount, setQuestionCount] = useState(10);
  const [categories, setCategories] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [answerProgress, setAnswerProgress] = useState({ count: 0, total: 0 });

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setError("");
    };
    const onDisconnect = () => setConnected(false);
    const onError = (e) => setError(e.message || "Something went wrong.");
    const onJoined = (data) => {
      setPlayerId(data.playerId);
      setError("");
    };
    const onUpdate = (data) => {
      setRoom(data);
      if (data.status === "lobby") {
        setSelectedAnswer(null);
        setResult(null);
      }
    };
    const onQuestion = () => {
      setSelectedAnswer(null);
      setResult(null);
      setTimeLeft(15);
      setAnswerProgress({ count: 0, total: 0 });
    };
    const onResult = (data) => {
      setResult(data);
      setSelectedAnswer((v) => v);
    };
    const onProgress = (data) => setAnswerProgress(data);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("app:error", onError);
    socket.on("room:joined", onJoined);
    socket.on("room:update", onUpdate);
    socket.on("question:start", onQuestion);
    socket.on("question:result", onResult);
    socket.on("answer:progress", onProgress);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("app:error", onError);
      socket.off("room:joined", onJoined);
      socket.off("room:update", onUpdate);
      socket.off("question:start", onQuestion);
      socket.off("question:result", onResult);
      socket.off("answer:progress", onProgress);
    };
  }, []);

  useEffect(() => {
    if (!room?.currentQuestion?.endsAt || room.status !== "playing" || result)
      return;
    const tick = () =>
      setTimeLeft(
        Math.max(
          0,
          Math.ceil((room.currentQuestion.endsAt - Date.now()) / 1000),
        ),
      );
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [room?.currentQuestion?.endsAt, room?.status, result]);

  const me = room?.players?.find((p) => p.id === playerId);
  const isHost = room?.hostId === playerId;
  const isAnswered = selectedAnswer !== null;
  const categoriesLabel = categories.length
    ? categories.join(", ")
    : "Mixed categories";
  const createRoom = () => {
    if (!name.trim()) return setError("Enter your name to create a room.");
    socket.emit("room:create", {
      name,
      settings: { language, questionCount, categories },
    });
  };
  const joinRoom = () => {
    if (!name.trim() || !joinCode.trim())
      return setError("Enter your name and room code.");
    socket.emit("room:join", { name, code: joinCode });
  };
  const submitAnswer = (index) => {
    if (isAnswered || result) return;
    setSelectedAnswer(index);
    socket.emit("answer:submit", { answerIndex: index });
  };
  const toggleCategory = (c) =>
    setCategories((old) =>
      old.includes(c) ? old.filter((x) => x !== c) : [...old, c],
    );
  const invite = async () => {
    const url = `${location.origin}/?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(
        `Join my Quiz Battle! Room code: ${room.code}\n${url}`,
      );
      setError("Invite copied to clipboard!");
    } catch {
      setError(`Share room code ${room.code} with your friends.`);
    }
  };

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code) setJoinCode(code.toUpperCase());
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            if (!room) window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="brand-mark">
            <Zap size={20} fill="currentColor" />
          </span>
          <span>
            QUIZ<span className="brand-accent">BATTLE</span>
            <small>LIVE QUIZ ARENA</small>
          </span>
        </a>
        <div className="top-right">
          <span className={`connection ${connected ? "online" : ""}`}>
            <i />
            {connected ? "Server online" : "Connecting…"}
          </span>
          <button
            className="icon-btn"
            title="Language"
            onClick={() => setLanguage((v) => (v === "en" ? "hi" : "en"))}
          >
            <Globe2 size={18} />
            <span>{language === "en" ? "EN" : "HI"}</span>
          </button>
        </div>
      </header>
      <main id="home">
        {!room ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" /> THE ARENA IS OPEN
                </div>
                <h1>
                  Brains on.
                  <br />
                  <span>Game face.</span>
                </h1>
                <p>
                  Challenge your crew. Race the clock. Claim the crown. Your
                  next legendary quiz battle starts here.
                </p>
                <div className="hero-pills">
                  <span>
                    <Users size={15} /> 2–8 players
                  </span>
                  <span>
                    <Clock3 size={15} /> 15 sec per question
                  </span>
                  <span>
                    <ShieldCheck size={15} /> Fair scoring
                  </span>
                </div>
              </div>
              <div className="hero-art">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="hero-crown">
                  <Crown size={66} strokeWidth={1.5} />
                </div>
                <div className="float-card card-score">
                  <Trophy size={17} />
                  <div>
                    <strong>+1,000</strong>
                    <small>POINTS EARNED</small>
                  </div>
                </div>
                <div className="float-card card-streak">
                  <Zap size={17} />
                  <div>
                    <strong>5x streak</strong>
                    <small>ON FIRE</small>
                  </div>
                </div>
                <div className="hero-star star-a">✦</div>
                <div className="hero-star star-b">✧</div>
              </div>
            </section>
            <section className="arena-grid">
              <div className="panel create-panel">
                <div className="panel-icon orange">
                  <Plus size={22} />
                </div>
                <div className="panel-title">
                  <h2>Create a room</h2>
                  <p>You're the host. Set the vibe and invite your rivals.</p>
                </div>
                <label className="field-label">YOUR PLAYER NAME</label>
                <input
                  className="text-input"
                  maxLength={18}
                  placeholder="e.g. QuizMaster99"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                />
                <div className="settings-row">
                  <div>
                    <label className="field-label">QUESTIONS</label>
                    <select
                      className="text-input"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                    >
                      <option value={5}>5 questions</option>
                      <option value={10}>10 questions</option>
                      <option value={15}>15 questions</option>
                      <option value={20}>20 questions</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">LANGUAGE</label>
                    <select
                      className="text-input"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="hi">हिन्दी</option>
                    </select>
                  </div>
                </div>
                <label className="field-label categories-label">
                  CHOOSE CATEGORIES <span>(optional)</span>
                </label>
                <div className="category-list">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCategory(c)}
                      className={`category-chip ${categories.includes(c) ? "active" : ""}`}
                      aria-pressed={categories.includes(c)}
                    >
                      {categories.includes(c) && <Check size={12} />} {c}
                    </button>
                  ))}
                </div>
                <button className="primary-btn full" onClick={createRoom}>
                  Create private room <ArrowRight size={18} />
                </button>
              </div>
              <div className="panel join-panel">
                <div className="panel-icon purple">
                  <Radio size={22} />
                </div>
                <div className="panel-title">
                  <h2>Join the battle</h2>
                  <p>Got a room code? Jump straight into the action.</p>
                </div>
                <label className="field-label">YOUR PLAYER NAME</label>
                <input
                  className="text-input"
                  maxLength={18}
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <label className="field-label code-label">ROOM CODE</label>
                <input
                  className="text-input code-input"
                  maxLength={5}
                  placeholder="ABCDE"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                />
                <button className="secondary-btn full" onClick={joinRoom}>
                  Join room <ArrowRight size={18} />
                </button>
                <div className="join-note">
                  <ShieldCheck size={15} /> Private rooms. Your friends, your
                  rules.
                </div>
              </div>
            </section>
            <section className="how-section">
              <div className="section-heading">
                <span className="eyebrow">THREE STEPS TO GLORY</span>
                <h2>
                  Ready. Set. <span>Outsmart.</span>
                </h2>
              </div>
              <div className="steps-grid">
                <Step
                  n="01"
                  icon={<Users />}
                  title="Bring your crew"
                  text="Create a room and share the 5-character code with up to 7 friends."
                />
                <Step
                  n="02"
                  icon={<AudioLines />}
                  title="Beat the buzzer"
                  text="Answer fast, build streaks, and earn bonus points before time runs out."
                />
                <Step
                  n="03"
                  icon={<Medal />}
                  title="Own the leaderboard"
                  text="Watch scores update live and fight for the winner's crown."
                />
              </div>
            </section>
          </>
        ) : (
          <GameRoom
            room={room}
            me={me}
            playerId={playerId}
            isHost={isHost}
            invite={invite}
            selectedAnswer={selectedAnswer}
            result={result}
            timeLeft={timeLeft}
            answerProgress={answerProgress}
            submitAnswer={submitAnswer}
          />
        )}
      </main>
      <footer>
        <div className="footer-brand">
          <span className="brand-mark small">
            <Zap size={14} fill="currentColor" />
          </span>{" "}
          QUIZ<span className="brand-accent">BATTLE</span>
        </div>
        <span>Think fast. Play fair. Have fun.</span>
        <span className="footer-status">
          <i /> REAL-TIME MULTIPLAYER
        </span>
      </footer>
      {error && (
        <div
          className={`toast ${error.includes("copied") ? "success" : ""}`}
          role="status"
        >
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function Step({ n, icon, title, text }) {
  return (
    <div className="step">
      <div className="step-top">
        <span>{n}</span>
        <div>{icon}</div>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function GameRoom({
  room,
  me,
  playerId,
  isHost,
  invite,
  selectedAnswer,
  result,
  timeLeft,
  answerProgress,
  submitAnswer,
}) {
  const q = room.currentQuestion;
  const myResult = result?.players?.find((p) => p.id === playerId);
  const answered = selectedAnswer !== null;
  return (
    <section className="game-layout">
      <div className="game-topline">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> LIVE ROOM
          </span>
          <h1>
            Battle <span>lobby</span>
          </h1>
        </div>
        <div className="room-code-box">
          <span>ROOM CODE</span>
          <strong>{room.code}</strong>
          <button onClick={invite}>Share invite</button>
        </div>
      </div>
      {room.status === "lobby" && (
        <div className="game-grid">
          <div className="panel lobby-main">
            <div className="lobby-head">
              <div>
                <h2>Waiting for players</h2>
                <p>Get your crew ready. The host starts the match.</p>
              </div>
              <span className="player-count">
                <Users size={16} /> {room.players.length}/8
              </span>
            </div>
            <div className="player-list">
              {room.players.map((p, i) => (
                <div className="player-row" key={p.id}>
                  <div className={`avatar avatar-${i % 5}`}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="player-meta">
                    <strong>
                      {p.name}
                      {p.id === playerId ? " (You)" : ""}
                    </strong>
                    <small>
                      {p.isHost
                        ? "ROOM HOST"
                        : p.ready
                          ? "READY TO PLAY"
                          : "GETTING READY"}
                    </small>
                  </div>
                  {p.isHost ? (
                    <Crown className="player-crown" size={19} />
                  ) : (
                    <span className={`ready-state ${p.ready ? "ready" : ""}`}>
                      {p.ready ? "READY" : "WAITING"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="lobby-actions">
              <button
                className="secondary-btn"
                onClick={() =>
                  socket.emit("player:ready", { ready: !me?.ready })
                }
              >
                {me?.ready ? <RotateCcw size={17} /> : <Check size={17} />}{" "}
                {me?.ready ? "Not ready" : "I’m ready"}
              </button>
              {isHost && (
                <button
                  className="primary-btn"
                  disabled={
                    room.players.length < 2 ||
                    room.players.some((p) => !p.ready)
                  }
                  onClick={() => socket.emit("game:start")}
                >
                  Start battle <ArrowRight size={18} />
                </button>
              )}
            </div>
            {room.players.length < 2 && (
              <p className="helper-text">
                Waiting for at least one more player to join.
              </p>
            )}
          </div>
          <div className="panel room-info">
            <div className="panel-icon orange">
              <Sparkles size={21} />
            </div>
            <h2>Match settings</h2>
            <div className="info-line">
              <span>Format</span>
              <strong>Classic Quiz</strong>
            </div>
            <div className="info-line">
              <span>Questions</span>
              <strong>{room.settings.questionCount}</strong>
            </div>
            <div className="info-line">
              <span>Language</span>
              <strong>
                {room.settings.language === "hi" ? "हिन्दी" : "English"}
              </strong>
            </div>
            <div className="info-line">
              <span>Categories</span>
              <strong>
                {room.settings.categories.length
                  ? room.settings.categories.join(", ")
                  : "Mixed"}
              </strong>
            </div>
            <div className="rule-note">
              <Zap size={17} />
              <span>
                Speed counts. Correct answers earn up to 1,000 base points
                before streak bonuses.
              </span>
            </div>
          </div>
        </div>
      )}
      {room.status === "playing" && (
        <div className="game-grid">
          <div className="panel question-panel">
            {q ? (
              <>
                <div className="question-top">
                  <span className="question-counter">
                    QUESTION {room.questionIndex + 1}{" "}
                    <i>/ {room.totalQuestions}</i>
                  </span>
                  <span className={`timer ${timeLeft <= 5 ? "urgent" : ""}`}>
                    <Clock3 size={16} /> 00:{String(timeLeft).padStart(2, "0")}
                  </span>
                </div>
                <div className="timer-track">
                  <div style={{ width: `${(timeLeft / 15) * 100}%` }} />
                </div>
                <div
                  className="answer-progress"
                  role="progressbar"
                  aria-label="Players who have answered"
                  aria-valuemin={0}
                  aria-valuemax={room.players.length}
                  aria-valuenow={answerProgress.count}
                >
                  <div className="answer-progress-copy">
                    <span>PLAYERS ANSWERED</span>
                    <strong>
                      {answerProgress.count}/{room.players.length}
                    </strong>
                  </div>
                  <div className="answer-progress-track">
                    <div
                      style={{
                        width: `${room.players.length ? (answerProgress.count / room.players.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="question-tags">
                  <span>{q.category}</span>
                  <span className={`difficulty ${q.difficulty}`}>
                    {q.difficulty}
                  </span>
                </div>
                <h2 className="question-text">{q.question}</h2>
                <div className="answer-grid">
                  {q.options.map((option, i) => (
                    <button
                      key={option}
                      className={`answer-option ${selectedAnswer === i ? "selected" : ""} ${result && result.correctIndex === i ? "correct" : ""} ${result && selectedAnswer === i && result.correctIndex !== i ? "wrong" : ""}`}
                      disabled={answered || Boolean(result)}
                      onClick={() => submitAnswer(i)}
                    >
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {option}
                      {result && result.correctIndex === i && (
                        <Check size={18} className="answer-check" />
                      )}
                    </button>
                  ))}
                </div>
                {answered && !result && (
                  <div className="waiting-answer">
                    <span className="spinner" /> Answer locked in. Waiting for
                    the others…
                  </div>
                )}
                {result && (
                  <div className="explanation">
                    <strong>
                      {myResult?.correct ? "Nice one!" : "Answer revealed"}
                    </strong>
                    <p>{result.explanation}</p>
                    <span>
                      {myResult?.correct
                        ? `+${myResult.pointsEarned} points earned`
                        : "Keep going — next question coming up."}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="waiting-next">
                <span className="spinner" />
                <h2>Preparing next question…</h2>
              </div>
            )}
          </div>
          <Leaderboard room={room} playerId={playerId} />
        </div>
      )}
      {room.status === "finished" && (
        <div className="game-grid">
          <div className="panel finish-panel">
            <div className="finish-trophy">
              <Trophy size={48} />
            </div>
            <span className="eyebrow">MATCH COMPLETE</span>
            <h2>
              {room.winner
                ? `${room.winner.name} takes the crown!`
                : "It’s a tie!"}
            </h2>
            <p>What a battle. Here's how everyone finished.</p>
            <div className="final-board">
              {room.players.map((p, i) => (
                <div className="final-row" key={p.id}>
                  <span className="rank">{i === 0 ? "🏆" : `#${i + 1}`}</span>
                  <span>{p.name}</span>
                  <strong>{p.score.toLocaleString()} pts</strong>
                </div>
              ))}
            </div>
            {isHost && (
              <div className="finish-actions">
                <button
                  className="primary-btn"
                  onClick={() => socket.emit("game:rematch")}
                >
                  <RotateCcw size={17} /> Play again
                </button>
                {!room.winner && (
                  <button
                    className="secondary-btn"
                    onClick={() => socket.emit("game:tie-breaker")}
                  >
                    Tie-breaker
                  </button>
                )}
              </div>
            )}
          </div>
          <Leaderboard room={room} playerId={playerId} />
        </div>
      )}
    </section>
  );
}
function Leaderboard({ room, playerId }) {
  return (
    <aside className="panel leaderboard">
      <div className="leaderboard-head">
        <div>
          <span className="eyebrow">THE RANKINGS</span>
          <h2>Leaderboard</h2>
        </div>
        <Trophy size={21} />
      </div>
      <div className="leader-list">
        {room.players.map((p, i) => (
          <div
            className={`leader-row ${p.id === playerId ? "is-me" : ""}`}
            key={p.id}
          >
            <span className={`leader-rank ${i === 0 ? "top-rank" : ""}`}>
              {i === 0 ? <Crown size={15} /> : String(i + 1).padStart(2, "0")}
            </span>
            <div className={`avatar mini avatar-${i % 5}`}>
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="leader-name">
              <strong>
                {p.name}
                {p.id === playerId ? " (You)" : ""}
              </strong>
              <small>
                {p.streak > 1 ? `${p.streak} answer streak` : "Keep it going"}
              </small>
            </div>
            <strong className="leader-score">{p.score.toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <div className="leader-footer">
        <span>
          <span className="live-dot" /> LIVE SCORES
        </span>
        <span>{room.players.length} players</span>
      </div>
    </aside>
  );
}
