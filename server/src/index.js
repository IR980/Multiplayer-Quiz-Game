import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { Server } from "socket.io";
import { QUESTIONS } from "./questions.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || "*" }));
app.use(express.json());
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "quiz-battle-server", rooms: rooms.size }),
);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN?.split(",") || "*",
    methods: ["GET", "POST"],
  },
});
const rooms = new Map();
const PORT = Number(process.env.PORT || 4000);
const MAX_PLAYERS = 8;
const QUESTION_MS = 15_000;
const REVEAL_MS = 5_000;

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[randomInt(chars.length)]).join(
      "",
    );
  } while (rooms.has(code));
  return code;
}
function publicQuestion(q, language = "en") {
  return {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    question: language === "hi" && q.hi ? q.hi : q.question,
    options: language === "hi" && q.hiOptions ? q.hiOptions : q.options,
  };
}
function leaderboard(room) {
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      streak: p.streak,
      ready: p.ready,
      connected: p.connected,
      isHost: p.id === room.hostId,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.streak - a.streak ||
        a.name.localeCompare(b.name),
    );
}
function snapshot(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: leaderboard(room),
    settings: room.settings,
    questionIndex: room.questionIndex,
    totalQuestions: room.questions.length,
    currentQuestion: room.currentQuestion
      ? {
          ...publicQuestion(room.currentQuestion, room.settings.language),
          endsAt: room.endsAt,
          questionNumber: room.questionIndex + 1,
        }
      : null,
    answerCount: room.answers.size,
    answerTotal: room.players.size,
    lastResult: room.lastResult,
    winner: room.winner || null,
  };
}
function publish(room) {
  io.to(room.code).emit("room:update", snapshot(room));
}
function stopTimers(room) {
  clearTimeout(room.questionTimer);
  clearTimeout(room.nextTimer);
  room.questionTimer = null;
  room.nextTimer = null;
}
function selectQuestions(settings) {
  let pool = QUESTIONS.filter(
    (q) =>
      !settings.categories?.length || settings.categories.includes(q.category),
  );
  if (pool.length < settings.questionCount) pool = [...QUESTIONS];
  // Mix difficulty progressively while keeping a varied pool.
  const easy = pool
    .filter((q) => q.difficulty === "easy")
    .sort(() => Math.random() - 0.5);
  const medium = pool
    .filter((q) => q.difficulty === "medium")
    .sort(() => Math.random() - 0.5);
  const hard = pool
    .filter((q) => q.difficulty === "hard")
    .sort(() => Math.random() - 0.5);
  const mixed = [];
  while (easy.length || medium.length || hard.length)
    mixed.push(...[easy.shift(), medium.shift(), hard.shift()].filter(Boolean));
  return mixed.slice(0, settings.questionCount);
}
function endQuestion(room) {
  if (!room.currentQuestion || room.status !== "playing") return;
  const q = room.currentQuestion;
  const resultPlayers = leaderboard(room).map((p) => ({
    ...p,
    answered: room.answers.has(p.id),
    correct: room.answers.get(p.id)?.correct ?? false,
    pointsEarned: room.answers.get(p.id)?.points ?? 0,
    answerIndex: room.answers.get(p.id)?.answerIndex ?? null,
  }));
  room.lastResult = {
    question: publicQuestion(q, room.settings.language),
    correctIndex: q.answer,
    explanation:
      room.settings.language === "hi" && q.hiExplanation
        ? q.hiExplanation
        : q.explanation,
    players: resultPlayers,
  };
  publish(room);
  io.to(room.code).emit("question:result", room.lastResult);
  room.nextTimer = setTimeout(() => advance(room), REVEAL_MS);
}
function askQuestion(room) {
  if (room.questionIndex >= room.questions.length) return finishGame(room);
  room.currentQuestion = room.questions[room.questionIndex];
  room.answers = new Map();
  room.endsAt = Date.now() + QUESTION_MS;
  room.lastResult = null;
  publish(room);
  io.to(room.code).emit("question:start", {
    question: publicQuestion(room.currentQuestion, room.settings.language),
    questionNumber: room.questionIndex + 1,
    totalQuestions: room.questions.length,
    endsAt: room.endsAt,
    durationMs: QUESTION_MS,
  });
  room.questionTimer = setTimeout(() => endQuestion(room), QUESTION_MS);
}
function advance(room) {
  room.nextTimer = null;
  room.questionIndex += 1;
  askQuestion(room);
}
function finishGame(room) {
  stopTimers(room);
  room.status = "finished";
  room.currentQuestion = null;
  const board = leaderboard(room);
  const tied = board.length > 1 && board[0].score === board[1].score;
  room.winner = tied ? null : board[0] || null;
  publish(room);
  io.to(room.code).emit("game:finished", {
    leaderboard: board,
    winner: room.winner,
    tied,
    message: tied
      ? "Match tied. Host can start a tie-breaker round."
      : `${room.winner?.name || "Nobody"} wins!`,
  });
}
function cleanName(name) {
  return String(name || "")
    .trim()
    .replace(/[<>\u0000-\u001f]/g, "")
    .slice(0, 18);
}
function error(socket, message) {
  socket.emit("app:error", { message });
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, settings = {} } = {}) => {
    const clean = cleanName(name);
    if (!clean) return error(socket, "Enter a player name first.");
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      status: "lobby",
      settings: {
        questionCount: Math.min(
          20,
          Math.max(5, Number(settings.questionCount) || 10),
        ),
        language: settings.language === "hi" ? "hi" : "en",
        categories: Array.isArray(settings.categories)
          ? settings.categories.filter((c) =>
              [
                "General Knowledge",
                "Science",
                "Sports",
                "Technology",
                "History",
                "Entertainment",
              ].includes(c),
            )
          : [],
      },
      questions: [],
      questionIndex: -1,
      currentQuestion: null,
      answers: new Map(),
      endsAt: null,
      lastResult: null,
      winner: null,
      questionTimer: null,
      nextTimer: null,
    };
    room.players.set(socket.id, {
      id: socket.id,
      name: clean,
      score: 0,
      streak: 0,
      ready: true,
      connected: true,
    });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:joined", { code, playerId: socket.id });
    publish(room);
  });
  socket.on("room:join", ({ code, name } = {}) => {
    const room = rooms.get(
      String(code || "")
        .trim()
        .toUpperCase(),
    );
    const clean = cleanName(name);
    if (!clean) return error(socket, "Enter a player name first.");
    if (!room)
      return error(socket, "Room not found. Check the code and try again.");
    if (room.status !== "lobby")
      return error(socket, "This match has already started.");
    if (room.players.size >= MAX_PLAYERS)
      return error(socket, "This room is full (maximum 8 players).");
    if (
      [...room.players.values()].some(
        (p) => p.name.toLowerCase() === clean.toLowerCase(),
      )
    )
      return error(
        socket,
        "That name is already in this room. Choose another.",
      );
    room.players.set(socket.id, {
      id: socket.id,
      name: clean,
      score: 0,
      streak: 0,
      ready: false,
      connected: true,
    });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.emit("room:joined", { code: room.code, playerId: socket.id });
    publish(room);
  });
  socket.on("player:ready", ({ ready } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.id);
    if (!p || room.status !== "lobby") return;
    p.ready = Boolean(ready);
    publish(room);
  });
  socket.on("game:start", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return error(socket, "Join a room first.");
    if (room.hostId !== socket.id)
      return error(socket, "Only the host can start the match.");
    if (room.status !== "lobby")
      return error(socket, "This match has already started.");
    if (room.players.size < 2)
      return error(socket, "At least two players are required to start.");
    if ([...room.players.values()].some((p) => !p.ready))
      return error(socket, "Everyone must be ready before the match starts.");
    room.status = "playing";
    room.questions = selectQuestions(room.settings);
    room.questionIndex = 0;
    room.players.forEach((p) => {
      p.score = 0;
      p.streak = 0;
    });
    publish(room);
    askQuestion(room);
  });
  socket.on("answer:submit", ({ answerIndex } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const p = room?.players.get(socket.id);
    if (!room || !p || room.status !== "playing" || !room.currentQuestion)
      return;
    if (room.answers.has(socket.id))
      return error(socket, "Your answer has already been submitted.");
    if (Date.now() >= room.endsAt)
      return error(socket, "Time is up for this question.");
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3)
      return error(socket, "Invalid answer selection.");
    const correct = answerIndex === room.currentQuestion.answer;
    let points = 0;
    if (correct) {
      const remaining = Math.max(0, room.endsAt - Date.now());
      p.streak += 1;
      const streakBonus =
        p.streak >= 10 ? 500 : p.streak >= 5 ? 250 : p.streak >= 3 ? 100 : 0;
      points = 500 + Math.round((500 * remaining) / QUESTION_MS) + streakBonus;
      p.score += points;
    } else p.streak = 0;
    room.answers.set(socket.id, {
      answerIndex,
      correct,
      points,
      answeredAt: Date.now(),
    });
    io.to(room.code).emit("answer:progress", {
      count: room.answers.size,
      total: room.players.size,
    });
    if (room.answers.size >= room.players.size) {
      stopTimers(room);
      endQuestion(room);
    } else publish(room);
  });
  socket.on("game:tie-breaker", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.status !== "finished")
      return;
    const board = leaderboard(room);
    if (board.length < 2 || board[0].score !== board[1].score)
      return error(
        socket,
        "A tie-breaker is only available when the top score is tied.",
      );
    room.status = "playing";
    room.questions = [
      QUESTIONS.filter((q) => q.difficulty === "hard")[
        Math.floor(
          Math.random() *
            QUESTIONS.filter((q) => q.difficulty === "hard").length,
        )
      ],
    ];
    room.questionIndex = 0;
    room.questions[0] = {
      ...room.questions[0],
      answer: room.questions[0].answer,
    };
    room.players.forEach((p) => {
      p.score = p.score === board[0].score ? 0 : -1000000;
      p.streak = 0;
    });
    askQuestion(room);
  });
  socket.on("game:rematch", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.status !== "finished")
      return;
    room.status = "lobby";
    room.questions = [];
    room.questionIndex = -1;
    room.lastResult = null;
    room.winner = null;
    room.players.forEach((p) => {
      p.score = 0;
      p.streak = 0;
      p.ready = p.id === room.hostId;
    });
    publish(room);
  });
  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket, true));
});
function leaveRoom(socket, disconnected = false) {
  const code = socket.data.roomCode;
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(socket.id);
  if (player && room.status === "playing") {
    player.connected = false;
    player.name = `${player.name} (disconnected)`;
    publish(room);
  } else if (player) room.players.delete(socket.id);
  socket.leave(code);
  delete socket.data.roomCode;
  if (room.players.size === 0) {
    stopTimers(room);
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  if (
    !disconnected &&
    room.status === "playing" &&
    room.answers.size >= room.players.size
  ) {
    stopTimers(room);
    endQuestion(room);
  }
  publish(room);
}
httpServer.listen(PORT, () =>
  console.log(`Quiz Battle server listening on http://localhost:${PORT}`),
);
