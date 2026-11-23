import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = "https://v3.football.api-sports.io";

async function footballRequest(endpoint) {
  if (!API_KEY) {
    throw new Error("API key is missing");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "x-apisports-key": API_KEY
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error("Football API request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function makeQuery(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  return query.toString();
}

function validId(value) {
  return /^\d+$/.test(String(value || "")) &&
    Number(value) > 0;
}

function sendError(res, error, message) {
  console.error(message, error.message);

  res.status(error.status || 500).json({
    success: false,
    message,
    details: error.data?.errors || error.message
  });
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.json({
    name: "AMHAMED FOOTBALL API",
    status: "online",
    message: "Football server is running!",
    version: "2.0"
  });
});

app.get("/api/football", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to AMHAMED FOOTBALL",
    features: [
      "Live matches",
      "Upcoming matches",
      "Previous matches",
      "Teams search",
      "Players search",
      "National teams search",
      "Leagues",
      "Standings",
      "Match details"
    ]
  });
});

// 1. المباريات المباشرة
app.get("/api/football/live", async (req, res) => {
  try {
    const data = await footballRequest("/fixtures?live=all");
    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get live matches");
  }
});

// 2. مباريات يوم معين
app.get("/api/football/fixtures", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Enter date as YYYY-MM-DD"
      });
    }

    const data = await footballRequest(
      `/fixtures?${makeQuery({ date })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get fixtures");
  }
});

// 3. المباريات القادمة
// مثال: /api/football/upcoming?next=20
// مثال: /api/football/upcoming?team=33&next=10
app.get("/api/football/upcoming", async (req, res) => {
  try {
    const next = Number(req.query.next || 20);
    const { team, league, season } = req.query;

    if (!Number.isInteger(next) || next < 1 || next > 100) {
      return res.status(400).json({
        success: false,
        message: "next must be between 1 and 100"
      });
    }

    if (team && !validId(team)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID"
      });
    }

    if (league && !validId(league)) {
      return res.status(400).json({
        success: false,
        message: "Invalid league ID"
      });
    }

    const data = await footballRequest(
      `/fixtures?${makeQuery({
        next,
        team,
        league,
        season
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get upcoming matches");
  }
});

// 4. المباريات السابقة
// مثال: /api/football/previous?last=20
app.get("/api/football/previous", async (req, res) => {
  try {
    const last = Number(req.query.last || 20);
    const { team, league, season } = req.query;

    if (!Number.isInteger(last) || last < 1 || last > 100) {
      return res.status(400).json({
        success: false,
        message: "last must be between 1 and 100"
      });
    }

    if (team && !validId(team)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID"
      });
    }

    if (league && !validId(league)) {
      return res.status(400).json({
        success: false,
        message: "Invalid league ID"
      });
    }

    const data = await footballRequest(
      `/fixtures?${makeQuery({
        last,
        team,
        league,
        season
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get previous matches");
  }
});

// 5. البحث عن الفرق والأندية
// مثال: /api/football/teams/search?q=Real
app.get("/api/football/teams/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search must contain at least 3 characters"
      });
    }

    const data = await footballRequest(
      `/teams?${makeQuery({ search: q })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not search teams");
  }
});

// 6. معلومات فريق محدد
// مثال: /api/football/team?id=33
app.get("/api/football/team", async (req, res) => {
  try {
    const { id, season } = req.query;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid team ID"
      });
    }

    const data = await footballRequest(
      `/teams?${makeQuery({ id, season })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get team information");
  }
});

// 7. البحث عن اللاعبين
// مثال: /api/football/players/search?q=Messi&season=2026
app.get("/api/football/players/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const season = req.query.season || new Date().getFullYear();
    const page = Number(req.query.page || 1);

    if (q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search must contain at least 3 characters"
      });
    }

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page"
      });
    }

    const data = await footballRequest(
      `/players?${makeQuery({ search: q, season, page })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not search players");
  }
});

// 8. لاعبو فريق معين
// مثال: /api/football/players?team=33&season=2026
app.get("/api/football/players", async (req, res) => {
  try {
    const { team } = req.query;
    const season = req.query.season || new Date().getFullYear();
    const page = Number(req.query.page || 1);

    if (!validId(team)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid team ID"
      });
    }

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page"
      });
    }

    const data = await footballRequest(
      `/players?${makeQuery({ team, season, page })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get team players");
  }
});

// 9. البحث عن المنتخبات الوطنية
// مثال: /api/football/national-teams/search?q=Algeria
app.get("/api/football/national-teams/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 3 characters"
      });
    }

    const data = await footballRequest(
      `/teams?${makeQuery({ search: q })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not search national teams");
  }
});

// 10. البلدان المتوفرة في API
// مثال: /api/football/countries?search=Algeria
app.get("/api/football/countries", async (req, res) => {
  try {
    const data = await footballRequest(
      `/countries?${makeQuery({
        search: req.query.search
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get countries");
  }
});

// 11. البحث عن الدوريات
// مثال: /api/football/leagues?search=Premier League
app.get("/api/football/leagues", async (req, res) => {
  try {
    const data = await footballRequest(
      `/leagues?${makeQuery({
        search: req.query.search,
        country: req.query.country,
        season: req.query.season
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get leagues");
  }
});

// 12. ترتيب الدوري
// مثال: /api/football/standings?league=39&season=2026
app.get("/api/football/standings", async (req, res) => {
  try {
    const { league, season } = req.query;

    if (!validId(league) || !season) {
      return res.status(400).json({
        success: false,
        message: "League ID and season are required"
      });
    }

    const data = await footballRequest(
      `/standings?${makeQuery({ league, season })}`
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, "Could not get standings");
  }
});

// 13. تفاصيل المباراة
app.get("/api/football/details", async (req, res) => {
  try {
    const id = req.query.id;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid fixture ID"
      });
    }

    const fixtureId = Number(id);

    const [fixture, events, statistics, lineups] =
      await Promise.all([
        footballRequest(`/fixtures?id=${fixtureId}`),
        footballRequest(`/fixtures/events?fixture=${fixtureId}`),
        footballRequest(`/fixtures/statistics?fixture=${fixtureId}`),
        footballRequest(`/fixtures/lineups?fixture=${fixtureId}`)
      ]);

    res.json({
      success: true,
      fixture: fixture.response || [],
      events: events.response || [],
      statistics: statistics.response || [],
      lineups: lineups.response || [],
      apiErrors: {
        fixture: fixture.errors || [],
        events: events.errors || [],
        statistics: statistics.errors || [],
        lineups: lineups.errors || []
      }
    });
  } catch (error) {
    sendError(res, error, "Could not get match details");
  }
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AMHAMED FOOTBALL API running on port ${PORT}`);
});
  
