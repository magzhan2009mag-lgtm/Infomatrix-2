const API_BASE = "/api";
const APP_STORAGE_KEY = "qc_local_db_v1";

function nowIso() {
  return new Date().toISOString();
}

function seedDatabase() {
  return {
    users: [
      {
        id: 1,
        name: "Demo Participant",
        email: "participant@qc.local",
        password: "123456",
        role: "participant",
        phone: "",
        city: "Almaty",
        favorite_category: "Chess",
        avatar_url: "",
        bio: "",
        goals: "",
        experience: 120,
        bonus_points: 35,
        created_at: "2026-01-10T10:00:00.000Z"
      },
      {
        id: 2,
        name: "Demo Organizer",
        email: "organizer@qc.local",
        password: "123456",
        role: "organizer",
        phone: "",
        city: "Astana",
        favorite_category: "Robotics",
        avatar_url: "",
        bio: "",
        goals: "",
        experience: 220,
        bonus_points: 80,
        created_at: "2026-01-07T10:00:00.000Z"
      },
      {
        id: 3,
        name: "Demo Judge",
        email: "judge@qc.local",
        password: "123456",
        role: "judge",
        phone: "",
        city: "Shymkent",
        favorite_category: "Esports",
        avatar_url: "",
        bio: "",
        goals: "",
        experience: 340,
        bonus_points: 50,
        created_at: "2026-01-03T10:00:00.000Z"
      }
    ],
    competitions: [
      {
        id: 101,
        title: "City Chess Open",
        description: "Open blitz tournament for students and juniors.",
        city: "Almaty",
        category: "Chess",
        competition_type: "Tournament",
        age_group: "14+",
        format: "Оффлайн",
        start_date: "2026-04-20T10:00:00.000Z",
        entry_fee: 3000,
        participants_count: 18,
        image_url: "",
        created_by: 2
      },
      {
        id: 102,
        title: "RoboSprint Cup",
        description: "Fast robotics challenge with autonomous tasks.",
        city: "Astana",
        category: "Robotics",
        competition_type: "Challenge",
        age_group: "16+",
        format: "Гибрид",
        start_date: "2026-05-03T09:00:00.000Z",
        entry_fee: 0,
        participants_count: 27,
        image_url: "",
        created_by: 2
      },
      {
        id: 103,
        title: "Valorant Weekend Bracket",
        description: "Online qualifier with BO3 playoff stage.",
        city: "Online",
        category: "Esports",
        competition_type: "League",
        age_group: "16+",
        format: "Онлайн",
        start_date: "2026-04-12T15:00:00.000Z",
        entry_fee: 5000,
        participants_count: 46,
        image_url: "",
        created_by: 2
      }
    ],
    registrations: [],
    recommendations: [],
    studentQuestions: [],
    latestAdminSummary: null,
    bonusTransactions: [],
    awards: [
      { user_id: 1, title: "Best Tactical Player", competition_name: "City Chess Open", year: 2025 }
    ],
    matches: [
      {
        id: 5001,
        title: "Quarterfinal #1",
        competition_title: "Valorant Weekend Bracket",
        scheduled_at: "2026-04-13T13:00:00.000Z",
        status: "scheduled",
        participant_id: 1,
        participant_name: "Demo Participant",
        points: 0,
        comment: "",
        video_url: ""
      }
    ]
  };
}

function getDb() {
  const raw = localStorage.getItem(APP_STORAGE_KEY);
  if (!raw) {
    const seed = seedDatabase();
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    const seed = seedDatabase();
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

function saveDb(db) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(db));
}

function getCurrentUserFromDb(db) {
  const id = Number(getToken().replace("local-", ""));
  if (!id) return null;
  return db.users.find((u) => u.id === id) || null;
}

function requireAuth(db) {
  const user = getCurrentUserFromDb(db);
  if (!user) {
    throw new Error("Требуется вход в аккаунт.");
  }
  return user;
}

function parseBody(options) {
  if (!options || !options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch (_error) {
    return {};
  }
}

function withRecommendations(user, db) {
  const recommendations = db.recommendations.filter((x) => x.user_id === user.id);
  const awardsCount = db.awards.filter((x) => x.user_id === user.id).length;
  const matchesCount = db.matches.filter((x) => x.participant_id === user.id).length;
  return { ...user, recommendations, awards_count: awardsCount, matches_count: matchesCount };
}

function normalizeStr(value) {
  return String(value || "").toLowerCase().trim();
}

function getAiSettings() {
  return {
    provider: localStorage.getItem("qc_ai_provider") || "auto",
    model: localStorage.getItem("qc_ai_model") || "llama3.1:8b-instruct",
    apiKey: localStorage.getItem("qc_ai_api_key") || ""
  };
}

function saveAiSettings(settings) {
  localStorage.setItem("qc_ai_provider", settings.provider || "auto");
  localStorage.setItem("qc_ai_model", settings.model || "llama3.1:8b-instruct");
  localStorage.setItem("qc_ai_api_key", settings.apiKey || "");
}

function getAiHistory() {
  const raw = localStorage.getItem("qc_ai_chat_history");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return [];
  }
}

function saveAiHistory(history) {
  localStorage.setItem("qc_ai_chat_history", JSON.stringify(history.slice(-24)));
}

async function tryOllamaChat(model, messages) {
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "llama3.1:8b-instruct",
      stream: false,
      messages
    })
  });
  if (!response.ok) throw new Error("Ollama недоступен.");
  const data = await response.json();
  return data && data.message && data.message.content ? String(data.message.content).trim() : "";
}

async function tryOpenRouterChat(model, apiKey, messages) {
  if (!apiKey) throw new Error("Нужен API key для OpenRouter.");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || "openai/gpt-4o-mini",
      messages
    })
  });
  if (!response.ok) throw new Error("OpenRouter недоступен или неверный ключ.");
  const data = await response.json();
  return data && data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || "").trim()
    : "";
}

function localSmartReply(input, user) {
  const text = normalizeStr(input);
  const intro = user ? `${user.name},` : "Отличный вопрос.";
  if (/подготов|олимпиад|соревн/.test(text)) {
    return `${intro} сделай короткий план: 1) 45 минут теории, 2) 90 минут задач, 3) 20 минут разбор ошибок ежедневно. Через неделю сравни прогресс по 10-балльной шкале.`;
  }
  if (/шанс|вероят|побед/.test(text)) {
    return `${intro} шансы растут, если стабилизируешь базовые задачи и скорость. Фокус на повторяемости результата: 3 пробных раунда и анализ после каждого.`;
  }
  if (/резюме|cv/.test(text)) {
    return `${intro} для сильного резюме добавь: конкретный результат, цифры, стек технологий и роль в проекте. Формула: "действие -> инструмент -> измеримый эффект".`;
  }
  return `${intro} я понял запрос. Давай разложим его на цель, ограничения и план из 3 шагов, чтобы быстро получить результат.`;
}

function buildPosterImageUrl(prompt, competitionTitle = "") {
  const fullPrompt = `${prompt}. Competition poster, modern design, bold typography, high contrast, 4k`;
  const seed = Math.abs(
    Array.from(`${competitionTitle}|${prompt}`)
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
}

function generateCommonAnswer(questions) {
  if (!questions.length) {
    return "Пока нет вопросов от учеников. Когда появятся вопросы, я соберу их в единый ответ.";
  }

  const allText = questions.map((q) => normalizeStr(q.text)).join(" ");
  const topics = [];

  if (/дедлайн|срок|когда/.test(allText)) topics.push("сроки и дедлайны");
  if (/документ|сертификат|справк|паспорт|портфолио/.test(allText)) topics.push("документы и требования");
  if (/балл|оценк|критер|результат/.test(allText)) topics.push("оценивание и критерии");
  if (/формат|онлайн|офлайн|гибрид|платформ/.test(allText)) topics.push("формат проведения");
  if (/оплата|взнос|бесплат|стоим/.test(allText)) topics.push("оплата участия");
  if (/команд|индивидуал/.test(allText)) topics.push("тип участия (командный/индивидуальный)");

  const topTopics = topics.length ? topics.slice(0, 4).join(", ") : "общие организационные вопросы";
  return `Мы собрали все вопросы и видим основные темы: ${topTopics}. Общий ответ: 1) актуальные сроки и требования всегда публикуются в карточке соревнования; 2) перед отправкой заявки проверьте заполненность профиля и обязательные документы; 3) критерии оценки и формат этапов одинаковы для всех участников и отображаются заранее; 4) если вопрос индивидуальный, администратор даст точечный комментарий отдельно.`;
}

function localApi(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const [rawPath, rawQuery = ""] = path.split("?");
  const query = new URLSearchParams(rawQuery);
  const db = getDb();
  const body = parseBody(options);

  if (rawPath === "/auth/register" && method === "POST") {
    const email = normalizeStr(body.email);
    if (!email || !body.password || !body.name) throw new Error("Заполни обязательные поля.");
    if (db.users.some((u) => normalizeStr(u.email) === email)) throw new Error("Пользователь уже существует.");
    const id = Math.max(0, ...db.users.map((u) => u.id)) + 1;
    const user = {
      id,
      name: String(body.name).trim(),
      email,
      password: String(body.password),
      role: body.role || "participant",
      phone: "",
      city: body.city || "",
      favorite_category: "",
      avatar_url: "",
      bio: "",
      goals: "",
      experience: 0,
      bonus_points: 0,
      created_at: nowIso()
    };
    db.users.push(user);
    saveDb(db);
    return { token: `local-${id}`, user: withRecommendations(user, db) };
  }

  if (rawPath === "/auth/login" && method === "POST") {
    const email = normalizeStr(body.email);
    const user = db.users.find((u) => normalizeStr(u.email) === email && String(u.password) === String(body.password || ""));
    if (!user) throw new Error("Неверный email или пароль.");
    return { token: `local-${user.id}`, user: withRecommendations(user, db) };
  }

  if (rawPath === "/auth/me" && method === "GET") return withRecommendations(requireAuth(db), db);
  if (rawPath === "/profile/me" && method === "GET") return withRecommendations(requireAuth(db), db);

  if (rawPath === "/profile/me" && method === "PUT") {
    const user = requireAuth(db);
    Object.assign(user, {
      name: body.name ?? user.name,
      phone: body.phone ?? user.phone,
      city: body.city ?? user.city,
      favorite_category: body.favorite_category ?? user.favorite_category,
      avatar_url: body.avatar_url ?? user.avatar_url,
      bio: body.bio ?? user.bio,
      goals: body.goals ?? user.goals
    });
    saveDb(db);
    return withRecommendations(user, db);
  }

  if (rawPath === "/competitions" && method === "GET") {
    let items = [...db.competitions];
    const q = normalizeStr(query.get("q"));
    if (q) items = items.filter((x) => normalizeStr(`${x.title} ${x.description}`).includes(q));
    const city = normalizeStr(query.get("city"));
    const category = normalizeStr(query.get("category"));
    const compType = normalizeStr(query.get("competition_type"));
    const ageGroup = normalizeStr(query.get("age_group"));
    const format = normalizeStr(query.get("format"));
    const date = normalizeStr(query.get("date"));
    const feeType = normalizeStr(query.get("fee_type"));
    if (city) items = items.filter((x) => normalizeStr(x.city) === city);
    if (category) items = items.filter((x) => normalizeStr(x.category) === category);
    if (compType) items = items.filter((x) => normalizeStr(x.competition_type) === compType);
    if (ageGroup) items = items.filter((x) => normalizeStr(x.age_group) === ageGroup);
    if (format) items = items.filter((x) => normalizeStr(x.format) === format);
    if (date) items = items.filter((x) => String(x.start_date).slice(0, 10) === date);
    if (feeType === "free") items = items.filter((x) => Number(x.entry_fee) === 0);
    if (feeType === "paid") items = items.filter((x) => Number(x.entry_fee) > 0);
    return items;
  }

  if (rawPath === "/competitions" && method === "POST") {
    const user = requireAuth(db);
    if (!["organizer", "admin"].includes(user.role)) throw new Error("Только организатор может создавать соревнования.");
    if (!body.title || !body.city || !body.category || !body.start_date) throw new Error("Заполни обязательные поля соревнования.");
    const id = Math.max(100, ...db.competitions.map((x) => x.id)) + 1;
    const item = {
      id,
      title: body.title,
      description: body.description || "",
      city: body.city,
      category: body.category,
      competition_type: body.competition_type || "Tournament",
      age_group: body.age_group || "16+",
      format: body.format || "Оффлайн",
      start_date: body.start_date,
      entry_fee: Number(body.entry_fee || 0),
      participants_count: 0,
      image_url: body.image_url || "",
      created_by: user.id
    };
    db.competitions.push(item);
    saveDb(db);
    return item;
  }

  if (/^\/competitions\/\d+\/register$/.test(rawPath) && method === "POST") {
    const user = requireAuth(db);
    const competitionId = Number(rawPath.split("/")[2]);
    const competition = db.competitions.find((x) => x.id === competitionId);
    if (!competition) throw new Error("Соревнование не найдено.");
    const exists = db.registrations.some((x) => x.user_id === user.id && x.competition_id === competitionId);
    if (exists) throw new Error("Ты уже зарегистрирован на это соревнование.");
    db.registrations.push({ user_id: user.id, competition_id: competitionId, created_at: nowIso() });
    competition.participants_count = Number(competition.participants_count || 0) + 1;
    user.bonus_points = Number(user.bonus_points || 0) + 5;
    db.bonusTransactions.unshift({ user_id: user.id, amount: 5, description: `Регистрация на ${competition.title}`, created_at: nowIso() });
    saveDb(db);
    return { ok: true };
  }

  if (rawPath === "/hall-of-fame/me" && method === "GET") {
    const user = requireAuth(db);
    return {
      profile: withRecommendations(user, db),
      awards: db.awards.filter((x) => x.user_id === user.id),
      matches: db.matches.filter((x) => x.participant_id === user.id)
    };
  }

  if (rawPath === "/live" && method === "GET") {
    return db.competitions.slice(0, 5).map((x, i) => ({
      id: `live-${x.id}`,
      title: `${x.title} Stream`,
      competition_title: x.title,
      city: x.city,
      category: x.category,
      scheduled_at: x.start_date,
      status: i === 0 ? "live" : i === 1 ? "scheduled" : "finished",
      live_url: "#",
      video_url: "#"
    }));
  }

  if (rawPath === "/bonuses/me" && method === "GET") {
    const user = requireAuth(db);
    return {
      profile: { bonus_points: user.bonus_points, experience: user.experience },
      transactions: db.bonusTransactions.filter((x) => x.user_id === user.id)
    };
  }

  if (rawPath === "/judge/matches" && method === "GET") {
    const user = requireAuth(db);
    if (!["judge", "admin"].includes(user.role)) throw new Error("Доступ только для судей.");
    return db.matches;
  }

  if (rawPath === "/judge/score" && method === "POST") {
    const user = requireAuth(db);
    if (!["judge", "admin"].includes(user.role)) throw new Error("Доступ только для судей.");
    const matchId = Number(body.match_id || body.matchId || 0);
    const points = Number(body.points || 0);
    const comment = String(body.comment || "");
    const match = db.matches.find((x) => x.id === matchId);
    if (!match) throw new Error("Матч не найден.");
    match.points = points;
    match.comment = comment;
    match.status = "finished";
    saveDb(db);
    return { ok: true };
  }

  if (rawPath === "/judge/qr-check" && method === "POST") {
    requireAuth(db);
    return { ok: true };
  }

  if (rawPath === "/organizer/services" && method === "GET") {
    requireAuth(db);
    return [
      { name: "Фото и видео съемка", category: "Медиа", price: 35000, unit: "/день" },
      { name: "Судейская панель Pro", category: "Софт", price: 18000, unit: "/турнир" },
      { name: "Трансляция + графика", category: "Broadcast", price: 50000, unit: "/турнир" }
    ];
  }

  if (rawPath === "/organizer/competitions" && method === "GET") {
    const user = requireAuth(db);
    if (!["organizer", "admin"].includes(user.role)) throw new Error("Доступ только для организаторов.");
    return db.competitions.filter((x) => x.created_by === user.id);
  }

  if (/^\/organizer\/competitions\/\d+\/poster$/.test(rawPath) && method === "PATCH") {
    const user = requireAuth(db);
    if (!["organizer", "admin"].includes(user.role)) throw new Error("Доступ только для организаторов.");
    const competitionId = Number(rawPath.split("/")[3]);
    const competition = db.competitions.find((x) => x.id === competitionId && x.created_by === user.id);
    if (!competition) throw new Error("Соревнование не найдено или нет доступа.");
    const prompt = String(body.prompt || "").trim();
    if (!prompt) throw new Error("Нужно описание для генерации постера.");
    const imageUrl = buildPosterImageUrl(prompt, competition.title);
    competition.image_url = imageUrl;
    saveDb(db);
    return { id: competition.id, title: competition.title, image_url: competition.image_url };
  }

  if (rawPath === "/ai/advice" && method === "GET") {
    requireAuth(db);
    const competitionId = Number(query.get("competitionId") || 0);
    const competition = db.competitions.find((x) => x.id === competitionId);
    const title = competition ? competition.title : "соревнованию";
    return {
      advice: `Сфокусируйся на 2-3 ключевых задачах перед ${title}.`,
      weakness: "Проверь тайм-менеджмент и стабильность в последних раундах."
    };
  }

  if (rawPath === "/ai/chances" && method === "GET") {
    const competitionId = Number(query.get("competitionId") || 0);
    const regs = db.registrations.filter((x) => x.competition_id === competitionId);
    return regs.slice(0, 5).map((x, idx) => {
      const user = db.users.find((u) => u.id === x.user_id);
      return { participant: user ? user.name : `Participant ${idx + 1}`, winChance: Math.max(25, 75 - idx * 8) };
    });
  }

  if (rawPath === "/ai/draw" && method === "POST") {
    const names = String(body.participants || body.names || "")
      .split(/,|\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (names.length < 2) throw new Error("Для жеребьевки укажи минимум двух участников.");
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const pairs = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1] || "BYE"]);
    }
    return { pairs };
  }

  if (rawPath === "/ai/weakness" && method === "GET") {
    const user = requireAuth(db);
    return { analysis: `${user.name}, основной фокус: стабильность результата в финальных попытках и контроль времени.` };
  }

  if (rawPath === "/ai/student-question" && method === "POST") {
    const user = requireAuth(db);
    if (!["participant", "spectator"].includes(user.role)) {
      throw new Error("Отправлять вопросы могут ученики/участники.");
    }
    const text = String(body.text || "").trim();
    if (!text) throw new Error("Вопрос не должен быть пустым.");
    const id = Date.now();
    const question = {
      id,
      user_id: user.id,
      user_name: user.name,
      text,
      created_at: nowIso()
    };
    db.studentQuestions.unshift(question);
    saveDb(db);
    return question;
  }

  if (rawPath === "/ai/student-question/my" && method === "GET") {
    const user = requireAuth(db);
    return db.studentQuestions.filter((x) => x.user_id === user.id);
  }

  if (rawPath === "/ai/admin/questions" && method === "GET") {
    const user = requireAuth(db);
    if (!["organizer", "admin"].includes(user.role)) {
      throw new Error("Доступ к общим вопросам только у администратора/организатора.");
    }
    return db.studentQuestions;
  }

  if (rawPath === "/ai/admin/questions/summary" && method === "POST") {
    const user = requireAuth(db);
    if (!["organizer", "admin"].includes(user.role)) {
      throw new Error("Генерировать общий ответ может только администратор/организатор.");
    }
    const summary = generateCommonAnswer(db.studentQuestions);
    db.latestAdminSummary = {
      text: summary,
      created_at: nowIso(),
      created_by: user.name
    };
    saveDb(db);
    return db.latestAdminSummary;
  }

  if (rawPath === "/ai/admin/summary/latest" && method === "GET") {
    requireAuth(db);
    return db.latestAdminSummary;
  }

  throw new Error("Локальный API: маршрут не найден.");
}

function getToken() {
  return localStorage.getItem("qc_token") || "";
}

function setToken(token) {
  localStorage.setItem("qc_token", token);
}

function clearToken() {
  localStorage.removeItem("qc_token");
  localStorage.removeItem("qc_user");
}

function setUser(user) {
  localStorage.setItem("qc_user", JSON.stringify(user));
}

function getUser() {
  const raw = localStorage.getItem("qc_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const shouldUseLocal = window.location.protocol === "file:";
  if (shouldUseLocal) {
    return localApi(path, options);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      if (data && data.error) {
        throw new Error(data.error);
      }
      throw new Error(`Ошибка запроса (${response.status})`);
    }

    return data;
  } catch (_error) {
    return localApi(path, options);
  }
}

function showMessage(containerId, text, isError = false) {

  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = text;
  el.className = isError ? "notice notice-error" : "notice notice-success";
}

function hideMessage(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = "";
  el.className = "notice";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₸`;
}

function competitionMeta(item) {
  const baseTime = item.format === "Онлайн" ? "19:00-21:00" : item.format === "Гибрид" ? "15:00-20:00" : "10:00-18:00";
  const prizeFund = Math.max(50000, Number(item.entry_fee || 0) * 40);
  const quota = item.format === "Онлайн" ? 500 : item.format === "Гибрид" ? 240 : 120;
  const venue = item.format === "Онлайн" ? "Онлайн-платформа QazaqCompetition" : `${item.city}, центральная площадка`;
  return { baseTime, prizeFund, quota, venue };
}

function roleLabel(role) {
  const map = {
    participant: "Участник",
    judge: "Судья",
    organizer: "Организатор",
    spectator: "Зритель",
    admin: "Админ"
  };
  return map[role] || role;
}

function roleHomePath(role) {
  const map = {
    participant: "competitions.html",
    judge: "judge-panel.html",
    organizer: "organizer-panel.html",
    spectator: "live.html",
    admin: "profile.html"
  };
  return map[role] || "index.html";
}

function applyRoleNavigation(user) {
  const links = document.querySelectorAll(".nav a");
  if (!links.length) return;

  links.forEach((link) => {
    link.style.display = "inline-flex";
  });
}

function guardRolePage(user) {
  void user;
}

function injectAuthControls() {
  const mount = document.getElementById("auth-controls");
  if (!mount) return;

  const user = getUser();
  if (!user) {
    mount.innerHTML = `
      <a href="login.html" class="button tiny ghost">Вход</a>
      <a href="register.html" class="button tiny">Регистрация</a>
    `;
    applyRoleNavigation(null);
    return;
  }

  mount.innerHTML = `
    <div class="user-chip">
      <span>${user.name}</span>
      <small>${roleLabel(user.role)}</small>
    </div>
    <button class="button tiny ghost" id="logout-btn" type="button">Выйти</button>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken();
      window.location.href = "index.html";
    });
  }

  applyRoleNavigation(user);
}

async function refreshUser() {
  if (!getToken()) return null;
  try {
    const user = await api("/auth/me");
    setUser(user);
    return user;
  } catch (_error) {
    clearToken();
    return null;
  }
}

async function setupAuthPage() {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage("auth-message");

      const payload = Object.fromEntries(new FormData(registerForm).entries());
      try {
        const data = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setToken(data.token);
        setUser(data.user);
        showMessage("auth-message", "Регистрация успешна. Профиль создан автоматически.");
        setTimeout(() => {
          window.location.href = "profile.html";
        }, 700);
      } catch (error) {
        showMessage("auth-message", error.message, true);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage("auth-message");

      const payload = Object.fromEntries(new FormData(loginForm).entries());
      try {
        const data = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setToken(data.token);
        setUser(data.user);
        showMessage("auth-message", "Вход выполнен.");
        setTimeout(() => {
          window.location.href = roleHomePath(data.user.role);
        }, 700);
      } catch (error) {
        showMessage("auth-message", error.message, true);
      }
    });
  }
}

async function setupCompetitionsPage() {
  const list = document.getElementById("competitions-list");
  if (!list) return;

  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const form = document.getElementById("filters-form");
  const openFiltersBtn = document.getElementById("open-filters-btn");
  const closeFiltersBtn = document.getElementById("close-filters-btn");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");
  const quickCards = document.querySelectorAll(".quick-example-card");
  const filterModal = document.getElementById("filter-modal");
  const filterOverlay = document.getElementById("filter-overlay");

  const filters = {
    q: "",
    city: "",
    category: "",
    competition_type: "",
    age_group: "",
    format: "",
    date: "",
    fee_type: "",
    sort: "date_asc"
  };

  function toggleFilterModal(show) {
    if (!filterModal) return;
    filterModal.classList.toggle("open", show);
    filterModal.setAttribute("aria-hidden", show ? "false" : "true");
  }

  async function loadCompetitions() {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || key === "sort") return;
        params.set(key, value);
      });

      const data = await api(`/competitions${params.toString() ? `?${params.toString()}` : ""}`);
      let items = [...data];

      if (filters.sort === "date_desc") {
        items.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
      } else if (filters.sort === "fee_asc") {
        items.sort((a, b) => Number(a.entry_fee) - Number(b.entry_fee));
      } else if (filters.sort === "fee_desc") {
        items.sort((a, b) => Number(b.entry_fee) - Number(a.entry_fee));
      } else if (filters.sort === "popular") {
        items.sort((a, b) => Number(b.participants_count) - Number(a.participants_count));
      } else {
        items.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      }

      if (!items.length) {
        list.innerHTML = `<p class="muted">По этим фильтрам соревнования не найдены.</p>`;
        return;
      }

      list.innerHTML = items
        .map((item) => {
          const meta = competitionMeta(item);
          return `
          <article class="card competition-card">
            <img src="${item.image_url || "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=900&q=80"}" alt="${item.title}" class="card-photo" />
            <div class="card-body">
              <h3>${item.title}</h3>
              <p>${item.description || "Описание пока не добавлено"}</p>
              <div class="meta-table">
                <div><span class="meta-label">Время проведения</span><strong>${formatDate(item.start_date)} • ${meta.baseTime}</strong></div>
                <div><span class="meta-label">Краткое описание</span><strong>${(item.description || "Описание пока не добавлено").slice(0, 84)}</strong></div>
                <div><span class="meta-label">Призовой фонд</span><strong>${formatMoney(meta.prizeFund)}</strong></div>
                <div><span class="meta-label">Квота участников</span><strong>${meta.quota} мест</strong></div>
                <div><span class="meta-label">Площадка</span><strong>${meta.venue}</strong></div>
                <div><span class="meta-label">Стоимость участия</span><strong>${Number(item.entry_fee) === 0 ? "Бесплатно" : formatMoney(item.entry_fee)}</strong></div>
              </div>
              <div class="meta-row">
                <span>${item.city}</span>
                <span>${item.category}</span>
                <span>${item.competition_type || "Олимпиада"}</span>
                <span>${item.age_group || "16+"}</span>
                <span>${item.format}</span>
                <span>Участников: ${item.participants_count}</span>
              </div>
              <div class="actions-row">
                <button class="button tiny register-btn" data-id="${item.id}" type="button">Зарегистрироваться</button>
                <button class="button tiny ghost advice-btn" data-id="${item.id}" type="button">AI-совет</button>
                <button class="button tiny ghost chance-btn" data-id="${item.id}" type="button">AI-шансы</button>
              </div>
              <div id="ai-result-${item.id}" class="inline-note"></div>
            </div>
          </article>
        `;
        })
        .join("");

      document.querySelectorAll(".register-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api(`/competitions/${btn.dataset.id}/register`, { method: "POST" });
            showMessage("competition-message", "Вы успешно зарегистрированы.");
            loadCompetitions();
          } catch (error) {
            showMessage("competition-message", error.message, true);
          }
        });
      });

      document.querySelectorAll(".advice-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = document.getElementById(`ai-result-${btn.dataset.id}`);
          try {
            const dataAdvice = await api(`/ai/advice?competitionId=${btn.dataset.id}`);
            target.textContent = `AI: ${dataAdvice.advice} | ${dataAdvice.weakness}`;
          } catch (error) {
            target.textContent = error.message;
          }
        });
      });

      document.querySelectorAll(".chance-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = document.getElementById(`ai-result-${btn.dataset.id}`);
          try {
            const dataChances = await api(`/ai/chances?competitionId=${btn.dataset.id}`);
            if (!dataChances.length) {
              target.textContent = "AI: пока недостаточно данных по участникам.";
              return;
            }
            const top = dataChances.slice(0, 3).map((x) => `${x.participant}: ${x.winChance}%`).join(" | ");
            target.textContent = `AI-шансы: ${top}`;
          } catch (error) {
            target.textContent = error.message;
          }
        });
      });
    } catch (error) {
      list.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
    }
  }

  if (openFiltersBtn) {
    openFiltersBtn.addEventListener("click", () => toggleFilterModal(true));
  }

  if (closeFiltersBtn) {
    closeFiltersBtn.addEventListener("click", () => toggleFilterModal(false));
  }

  if (filterOverlay) {
    filterOverlay.addEventListener("click", () => toggleFilterModal(false));
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      filters.q = (searchInput && searchInput.value ? searchInput.value : "").trim();
      loadCompetitions();
    });
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      Object.assign(filters, values);
      filters.q = (searchInput && searchInput.value ? searchInput.value : "").trim();
      toggleFilterModal(false);
      loadCompetitions();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      if (form) form.reset();
      if (searchInput) searchInput.value = "";
      filters.city = "";
      filters.category = "";
      filters.competition_type = "";
      filters.age_group = "";
      filters.format = "";
      filters.date = "";
      filters.fee_type = "";
      filters.sort = "date_asc";
      filters.q = "";
      toggleFilterModal(false);
      loadCompetitions();
    });
  }

  if (quickCards.length) {
    quickCards.forEach((card) => {
      card.addEventListener("click", () => {
        filters.q = card.dataset.q || "";
        filters.city = card.dataset.city || "";
        filters.competition_type = card.dataset.type || "";
        filters.age_group = card.dataset.age || "";
        filters.fee_type = card.dataset.fee || "";
        filters.category = "";
        filters.date = "";
        filters.format = "";
        filters.sort = "date_asc";

        if (searchInput) {
          searchInput.value = filters.q;
        }

        if (form) {
          form.city.value = filters.city;
          form.competition_type.value = filters.competition_type;
          form.age_group.value = filters.age_group;
          form.fee_type.value = filters.fee_type;
          form.category.value = "";
          form.date.value = "";
          form.format.value = "";
          form.sort.value = "date_asc";
        }

        loadCompetitions();
      });
    });
  }

  loadCompetitions();
}

async function setupHallOfFamePage() {
  const mount = document.getElementById("hall-content");
  if (!mount) return;

  try {
    const data = await api("/hall-of-fame/me");
    mount.innerHTML = `
      <div class="stats-grid">
        <article class="card"><h3>${data.profile.name}</h3><p>Роль: ${roleLabel(data.profile.role)}</p></article>
        <article class="card"><h3>${data.profile.experience}</h3><p>Опыт (XP)</p></article>
        <article class="card"><h3>${data.profile.bonus_points}</h3><p>Бонусные баллы</p></article>
      </div>

      <section class="panel">
        <h2>Награды</h2>
        <div class="list-grid">
          ${data.awards.length ? data.awards.map((a) => `<article class="card"><h3>${a.title}</h3><p>${a.competition_name}, ${a.year}</p></article>`).join("") : '<p class="muted">Награды пока не добавлены.</p>'}
        </div>
      </section>

      <section class="panel">
        <h2>История матчей</h2>
        <div class="list-grid">
          ${data.matches.length ? data.matches.map((m) => `<article class="card"><h3>${m.title}</h3><p>${formatDate(m.scheduled_at)} | Баллы: ${m.points}</p><p>${m.comment || "Без комментария"}</p><a class="button tiny ghost" href="${m.video_url || '#'}" target="_blank" rel="noreferrer">Пересмотреть</a></article>`).join("") : '<p class="muted">История матчей пока пустая.</p>'}
        </div>
      </section>
    `;
  } catch (error) {
    mount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
  }
}

async function setupLivePage() {
  const mount = document.getElementById("live-list");
  const featuredMount = document.getElementById("live-featured");
  const liveCountMount = document.getElementById("live-now-count");
  if (!mount) return;

  try {
    const items = await api("/live");
    const normalized = items.map((item) => ({
      ...item,
      status: String(item.status || "").toLowerCase()
    }));
    const liveItems = normalized.filter((item) => item.status === "live");
    const featured = liveItems[0] || normalized[0];

    if (liveCountMount) {
      liveCountMount.textContent = `${liveItems.length} каналов live`;
    }

    if (!items.length) {
      if (featuredMount) {
        featuredMount.innerHTML = '<p class="muted">Главный эфир появится после добавления матчей.</p>';
      }
      mount.innerHTML = '<p class="muted">Эфиры и записи пока не добавлены.</p>';
      return;
    }

    if (featuredMount && featured) {
      const featuredStatusClass = featured.status === "live" ? "is-live" : featured.status === "scheduled" ? "is-scheduled" : "is-finished";
      const featuredStatusLabel = featured.status === "live" ? "LIVE" : featured.status === "scheduled" ? "СКОРО" : "ЗАПИСЬ";
      featuredMount.innerHTML = `
        <article class="live-stage">
          <div class="live-stage-media">
            <span class="live-status ${featuredStatusClass}">${featuredStatusLabel}</span>
            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80" alt="${featured.title}" />
          </div>
          <div class="live-stage-content">
            <h2>${featured.title}</h2>
            <p>${featured.competition_title} | ${featured.city} | ${featured.category}</p>
            <p>${formatDate(featured.scheduled_at)} | Статус: ${featured.status}</p>
            <div class="actions-row">
              <a class="button tiny" href="${featured.live_url || "#"}" target="_blank" rel="noreferrer">Смотреть live</a>
              <a class="button tiny ghost" href="${featured.video_url || "#"}" target="_blank" rel="noreferrer">Открыть запись</a>
            </div>
          </div>
        </article>
      `;
    }

    mount.innerHTML = normalized
      .map(
        (item) => {
          const statusClass = item.status === "live" ? "is-live" : item.status === "scheduled" ? "is-scheduled" : "is-finished";
          const statusLabel = item.status === "live" ? "LIVE" : item.status === "scheduled" ? "СКОРО" : "ЗАПИСЬ";
          return `
        <article class="card video-card twitch-card">
          <div class="video-thumb">
            <span class="live-status ${statusClass}">${statusLabel}</span>
            <img src="https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=900&q=80" alt="${item.title}" class="card-photo" />
          </div>
          <h3>${item.title}</h3>
          <p>${item.competition_title} | ${item.city}</p>
          <p>${formatDate(item.scheduled_at)} | ${item.category}</p>
          <div class="actions-row">
            <a class="button tiny" href="${item.live_url || '#'}" target="_blank" rel="noreferrer">Смотреть live</a>
            <a class="button tiny ghost" href="${item.video_url || '#'}" target="_blank" rel="noreferrer">Открыть запись</a>
          </div>
        </article>
      `;
        }
      )
      .join("");
  } catch (error) {
    if (featuredMount) {
      featuredMount.innerHTML = "";
    }
    mount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
  }
}

async function setupBonusesPage() {
  const mount = document.getElementById("bonuses-content");
  if (!mount) return;

  try {
    const data = await api("/bonuses/me");
    const rows = data.transactions
      .map(
        (item) => `
        <tr>
          <td>${formatDate(item.created_at)}</td>
          <td>${item.description}</td>
          <td class="${item.amount >= 0 ? "plus" : "minus"}">${item.amount > 0 ? "+" : ""}${item.amount}</td>
        </tr>
      `
      )
      .join("");

    mount.innerHTML = `
      <div class="stats-grid">
        <article class="card"><h3>${data.profile.bonus_points}</h3><p>Текущий бонусный баланс</p></article>
        <article class="card"><h3>${data.profile.experience}</h3><p>Текущий опыт</p></article>
      </div>
      <section class="panel">
        <h2>История начислений и списаний</h2>
        <table class="table">
          <thead><tr><th>Дата</th><th>Операция</th><th>Баллы</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">Операций пока нет</td></tr>'}</tbody>
        </table>
      </section>
    `;
  } catch (error) {
    mount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
  }
}

async function setupJudgePage() {
  const matchesMount = document.getElementById("judge-matches");
  const scoreForm = document.getElementById("judge-score-form");
  const qrForm = document.getElementById("judge-qr-form");

  if (!matchesMount) return;

  async function loadMatches() {
    try {
      const items = await api("/judge/matches");
      matchesMount.innerHTML = items.length
        ? items
            .map(
              (item) => `<article class="card"><h3>${item.title}</h3><p>${item.competition_title}</p><p>${formatDate(item.scheduled_at)} | ${item.status}</p><p>Участник: ${item.participant_name || "ожидается"}</p></article>`
            )
            .join("")
        : '<p class="muted">Матчи не назначены.</p>';
    } catch (error) {
      matchesMount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
    }
  }

  if (scoreForm) {
    scoreForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(scoreForm).entries());
        await api("/judge/score", { method: "POST", body: JSON.stringify(payload) });
        showMessage("judge-message", "Оценка сохранена");
        scoreForm.reset();
      } catch (error) {
        showMessage("judge-message", error.message, true);
      }
    });
  }

  if (qrForm) {
    qrForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(qrForm).entries());
        await api("/judge/qr-check", { method: "POST", body: JSON.stringify(payload) });
        showMessage("judge-message", "QR-проверка пройдена, участник отмечен");
        qrForm.reset();
      } catch (error) {
        showMessage("judge-message", error.message, true);
      }
    });
  }

  loadMatches();
}

async function setupOrganizerPage() {
  const listMount = document.getElementById("organizer-list");
  const servicesMount = document.getElementById("services-list");
  const createForm = document.getElementById("competition-create-form");
  const drawForm = document.getElementById("draw-form");
  const posterForm = document.getElementById("poster-form");
  const posterPreviewWrap = document.getElementById("poster-preview-wrap");

  if (!listMount) return;

  async function loadOrganizerData() {
    try {
      const [competitions, services] = await Promise.all([
        api("/organizer/competitions"),
        api("/organizer/services")
      ]);

      listMount.innerHTML = competitions.length
        ? competitions
            .map(
              (item) => `<article class="card"><h3>${item.title}</h3><p><strong>ID:</strong> ${item.id}</p><p>${item.city} | ${item.category} | ${item.format}</p><p>${formatDate(item.start_date)} | ${item.entry_fee} ₸</p><p>${item.description || "Без описания"}</p></article>`
            )
            .join("")
        : '<p class="muted">Пока нет созданных соревнований.</p>';

      servicesMount.innerHTML = services
        .map((s) => `<article class="card"><h3>${s.name}</h3><p>${s.category}</p><p>${s.price} ₸ ${s.unit}</p></article>`)
        .join("");
    } catch (error) {
      listMount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
      if (servicesMount) {
        servicesMount.innerHTML = "";
      }
    }
  }

  if (createForm) {
    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(createForm).entries());
        await api("/competitions", { method: "POST", body: JSON.stringify(payload) });
        showMessage("organizer-message", "Соревнование создано");
        createForm.reset();
        loadOrganizerData();
      } catch (error) {
        showMessage("organizer-message", error.message, true);
      }
    });
  }

  if (drawForm) {
    drawForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(drawForm).entries());
        const draw = await api("/ai/draw", { method: "POST", body: JSON.stringify(payload) });
        const text = draw.pairs.map((pair, idx) => `${idx + 1}. ${pair[0]} vs ${pair[1]}`).join(" | ");
        showMessage("organizer-message", `Жеребьевка: ${text}`);
      } catch (error) {
        showMessage("organizer-message", error.message, true);
      }
    });
  }

  loadOrganizerData();
}

async function setupHomeAiWidget() {
  const mount = document.getElementById("home-ai-analysis");
  if (!mount) return;

  try {
    const data = await api("/ai/weakness");
    mount.textContent = data.analysis;
  } catch (error) {
    mount.textContent = "Войди в аккаунт, чтобы получить персональный AI-анализ.";
  }
}

async function setupProfilePage() {
  const form = document.getElementById("profile-form");
  const mount = document.getElementById("profile-overview");
  if (!form || !mount) return;

  async function loadProfile() {
    try {
      const data = await api("/profile/me");

      form.name.value = data.name || "";
      form.phone.value = data.phone || "";
      form.city.value = data.city || "";
      form.favorite_category.value = data.favorite_category || "";
      form.avatar_url.value = data.avatar_url || "";
      form.bio.value = data.bio || "";
      form.goals.value = data.goals || "";

      mount.innerHTML = `
        <div class="profile-head">
          <img src="${data.avatar_url || "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=500&q=80"}" alt="${data.name}" class="avatar" />
          <div>
            <h2>${data.name}</h2>
            <p>${roleLabel(data.role)} | ${data.email}</p>
            <p>Город: ${data.city || "Не указан"} | Любимая категория: ${data.favorite_category || "Не выбрана"}</p>
          </div>
        </div>
        <div class="stats-grid">
          <article class="card"><h3>${data.experience}</h3><p>Опыт (XP)</p></article>
          <article class="card"><h3>${data.bonus_points}</h3><p>Бонусы</p></article>
          <article class="card"><h3>${data.awards_count}</h3><p>Награды</p></article>
        </div>
        <div class="stats-grid">
          <article class="card"><h3>${data.matches_count}</h3><p>Матчи в истории</p></article>
          <article class="card"><h3>${data.recommendations.length}</h3><p>AI-рекомендации</p></article>
          <article class="card"><h3>${formatDate(data.created_at)}</h3><p>Дата регистрации</p></article>
        </div>
      `;

      const aiMount = document.getElementById("profile-ai-list");
      if (aiMount) {
        aiMount.innerHTML = data.recommendations.length
          ? data.recommendations
              .map((x) => `<article class="card"><p><strong>Совет:</strong> ${x.advice}</p><p><strong>Фокус:</strong> ${x.weakness}</p></article>`)
              .join("")
          : '<p class="muted">AI-рекомендации появятся после взаимодействия с соревнованиями.</p>';
      }
    } catch (error) {
      mount.innerHTML = `<p class="notice notice-error">${error.message}</p>`;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage("profile-message");

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const updated = await api("/profile/me", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setUser({
        ...(getUser() || {}),
        name: updated.name,
        role: updated.role,
        email: updated.email,
        bonus_points: updated.bonus_points,
        experience: updated.experience
      });
      injectAuthControls();
      showMessage("profile-message", "Профиль обновлен");
      loadProfile();
    } catch (error) {
      showMessage("profile-message", error.message, true);
    }
  });

  await loadProfile();
}

async function setupAiChatPage() {
  const liveForm = document.getElementById("ai-live-form");
  const liveMessages = document.getElementById("ai-live-messages");
  const liveNote = document.getElementById("ai-live-note");
  const liveVoiceBtn = document.getElementById("ai-voice-btn");
  const providerSelect = document.getElementById("ai-provider");
  const modelInput = document.getElementById("ai-model");
  const apiKeyInput = document.getElementById("ai-api-key");
  const saveConfigBtn = document.getElementById("ai-config-save");

  const studentForm = document.getElementById("ai-student-form");
  const studentList = document.getElementById("ai-student-questions");
  const latestSummaryMount = document.getElementById("ai-latest-summary");
  const adminList = document.getElementById("ai-admin-questions");
  const adminGenerateBtn = document.getElementById("ai-admin-generate");
  const adminSummaryMount = document.getElementById("ai-admin-summary");
  const studentBlock = document.getElementById("ai-student-block");
  const adminBlock = document.getElementById("ai-admin-block");

  if (!studentForm && !adminGenerateBtn) return;

  const user = getUser();
  if (!user) {
    if (liveNote) liveNote.textContent = "Войди в аккаунт, чтобы использовать AI-функции.";
    return;
  }

  if (posterForm) {
    posterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(posterForm).entries());
        const competitionId = Number(payload.competition_id || 0);
        if (!competitionId) throw new Error("Укажи корректный ID соревнования.");
        const updated = await api(`/organizer/competitions/${competitionId}/poster`, {
          method: "PATCH",
          body: JSON.stringify({ prompt: payload.prompt || "" })
        });
        if (posterPreviewWrap) {
          posterPreviewWrap.innerHTML = `
            <p><strong>Постер сохранен для:</strong> ${updated.title}</p>
            <img src="${updated.image_url}" alt="${updated.title} poster" class="card-photo" style="max-height:240px; border-radius: 12px;" />
          `;
        }
        showMessage("organizer-message", "AI-постер сгенерирован и сохранен в карточку соревнования.");
        await loadOrganizerData();
      } catch (error) {
        showMessage("organizer-message", error.message, true);
      }
    });
  }

  function appendLiveMsg(role, text) {
    if (!liveMessages) return;
    const cls = role === "user" ? "user" : "assistant";
    const item = document.createElement("article");
    item.className = `chat-msg ${cls}`;
    item.innerHTML = `<p>${text}</p>`;
    liveMessages.appendChild(item);
    liveMessages.scrollTop = liveMessages.scrollHeight;
  }

  async function askLiveAi(inputText) {
    const settings = getAiSettings();
    const history = getAiHistory();
    const systemPrompt = `Ты дружелюбный и конкретный AI-ассистент платформы QazaqCompetition. Отвечай на русском, кратко и полезно. Учитывай роль пользователя: ${user.role}.`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: inputText }
    ];

    if (settings.provider === "fallback") {
      const fallback = localSmartReply(inputText, user);
      saveAiHistory([...history, { role: "user", content: inputText }, { role: "assistant", content: fallback }]);
      return { text: fallback, mode: "Встроенный режим" };
    }

    try {
      if (settings.provider === "ollama" || settings.provider === "auto") {
        const out = await tryOllamaChat(settings.model, messages);
        if (out) {
          saveAiHistory([...history, { role: "user", content: inputText }, { role: "assistant", content: out }]);
          return { text: out, mode: "Ollama" };
        }
      }
      if (settings.provider === "openrouter" || settings.provider === "auto") {
        const out = await tryOpenRouterChat(settings.model, settings.apiKey, messages);
        if (out) {
          saveAiHistory([...history, { role: "user", content: inputText }, { role: "assistant", content: out }]);
          return { text: out, mode: "OpenRouter" };
        }
      }
    } catch (_error) {
      // Fallback below
    }

    const fallback = localSmartReply(inputText, user);
    saveAiHistory([...history, { role: "user", content: inputText }, { role: "assistant", content: fallback }]);
    return { text: fallback, mode: "Встроенный режим" };
  }

  if (providerSelect && modelInput && apiKeyInput && saveConfigBtn) {
    const s = getAiSettings();
    providerSelect.value = s.provider;
    modelInput.value = s.model;
    apiKeyInput.value = s.apiKey;
    saveConfigBtn.addEventListener("click", () => {
      saveAiSettings({
        provider: providerSelect.value,
        model: modelInput.value.trim(),
        apiKey: apiKeyInput.value.trim()
      });
      if (liveNote) liveNote.textContent = "AI-настройки сохранены.";
    });
  }

  if (liveForm) {
    liveForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(liveForm).entries());
      const text = String(payload.message || "").trim();
      if (!text) return;
      appendLiveMsg("user", text);
      liveForm.reset();
      if (liveNote) liveNote.textContent = "AI думает...";
      const result = await askLiveAi(text);
      appendLiveMsg("assistant", result.text);
      if (liveNote) liveNote.textContent = `Режим ответа: ${result.mode}`;
    });
  }

  if (liveVoiceBtn && liveForm) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      liveVoiceBtn.disabled = true;
      if (liveNote) liveNote.textContent = "Voice-to-Text не поддерживается в этом браузере.";
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.interimResults = true;
      recognition.continuous = false;

      let listening = false;
      let finalText = "";

      liveVoiceBtn.addEventListener("click", () => {
        if (listening) {
          recognition.stop();
          return;
        }
        finalText = "";
        recognition.start();
      });

      recognition.onstart = () => {
        listening = true;
        liveVoiceBtn.textContent = "⏹ Остановить";
        liveVoiceBtn.classList.add("voice-live");
        if (liveNote) liveNote.textContent = "Слушаю... говорите.";
      };

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += `${chunk} `;
          } else {
            interim += chunk;
          }
        }
        const input = liveForm.querySelector('input[name="message"]');
        if (input) {
          input.value = `${finalText}${interim}`.trim();
        }
      };

      recognition.onend = () => {
        listening = false;
        liveVoiceBtn.textContent = "🎙 Голос в текст";
        liveVoiceBtn.classList.remove("voice-live");
        const input = liveForm.querySelector('input[name="message"]');
        if (input && input.value.trim()) {
          if (liveNote) liveNote.textContent = "Текст распознан, отправляю в AI...";
          liveForm.requestSubmit();
        } else if (liveNote) {
          liveNote.textContent = "Речь не распознана, попробуйте ещё раз.";
        }
      };

      recognition.onerror = () => {
        listening = false;
        liveVoiceBtn.textContent = "🎙 Голос в текст";
        liveVoiceBtn.classList.remove("voice-live");
        if (liveNote) liveNote.textContent = "Ошибка распознавания речи. Проверьте микрофон и разрешение.";
      };
    }
  }

  const isStudent = ["participant", "spectator"].includes(user.role);
  const isAdmin = ["organizer", "admin"].includes(user.role);

  if (studentBlock) studentBlock.hidden = !isStudent;
  if (adminBlock) adminBlock.hidden = !isAdmin;

  async function renderLatestSummary() {
    if (!latestSummaryMount) return;
    const data = await api("/ai/admin/summary/latest");
    latestSummaryMount.textContent = data
      ? `${data.text} (обновлено: ${formatDate(data.created_at)})`
      : "Пока нет общего ответа от администратора.";
  }

  if (isStudent) {
    async function loadMyQuestions() {
      if (!studentList) return;
      const items = await api("/ai/student-question/my");
      if (!items.length) {
        studentList.innerHTML = '<p class="muted">Вы ещё не отправляли вопросы.</p>';
        return;
      }
      studentList.innerHTML = items
        .map((q) => `<article class="chat-msg user"><p>${q.text}</p><small>${formatDate(q.created_at)}</small></article>`)
        .join("");
    }

    studentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(studentForm).entries());
      try {
        await api("/ai/student-question", { method: "POST", body: JSON.stringify({ text: payload.message }) });
        studentForm.reset();
        await loadMyQuestions();
        await renderLatestSummary();
      } catch (error) {
        alert(error.message);
      }
    });

    await loadMyQuestions();
    await renderLatestSummary();
  }

  if (isAdmin) {
    async function loadAllQuestions() {
      if (!adminList) return;
      const items = await api("/ai/admin/questions");
      if (!items.length) {
        adminList.innerHTML = '<p class="muted">Вопросов от учеников пока нет.</p>';
        return;
      }
      adminList.innerHTML = items
        .map((q) => `<article class="chat-msg assistant"><p><strong>${q.user_name}:</strong> ${q.text}</p><small>${formatDate(q.created_at)}</small></article>`)
        .join("");
    }

    if (adminGenerateBtn) {
      adminGenerateBtn.addEventListener("click", async () => {
        try {
          const result = await api("/ai/admin/questions/summary", { method: "POST", body: "{}" });
          if (adminSummaryMount) {
            adminSummaryMount.textContent = `${result.text} (создано: ${formatDate(result.created_at)})`;
          }
        } catch (error) {
          if (adminSummaryMount) adminSummaryMount.textContent = error.message;
        }
      });
    }

    await loadAllQuestions();
    await renderLatestSummary();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await refreshUser();
  guardRolePage(user);
  injectAuthControls();

  await Promise.all([
    setupAuthPage(),
    setupCompetitionsPage(),
    setupHallOfFamePage(),
    setupLivePage(),
    setupBonusesPage(),
    setupJudgePage(),
    setupOrganizerPage(),
    setupHomeAiWidget(),
    setupProfilePage(),
    setupAiChatPage()
  ]);
});


