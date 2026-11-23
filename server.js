import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = "https://v3.football.api-sports.io";

// الاتصال بـ API-Football
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

// إنشاء روابط الطلبات
function makeQuery(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      query.set(key, String(value));
    }
  });

  return query.toString();
}

// التحقق من أرقام المعرفات
function validId(value) {
  return /^\d+$/.test(String(value || "")) &&
    Number(value) > 0;
}

// إرسال الأخطاء
function sendError(res, error, message) {
  console.error(message, error.message);

  res.status(error.status || 500).json({
    success: false,
    message,
    details: error.data?.errors || error.message
  });
}

// =====================================
// تخزين المباريات مؤقتاً
// =====================================

const fixtureCache = new Map();

async function getFixturesByDate(date, filters = {}) {
  const params = makeQuery({
    date,
    team: filters.team,
    league: filters.league,
    season: filters.season
  });

  const cacheKey = params;
  const cached = fixtureCache.get(cacheKey);

  // صلاحية التخزين 5 دقائق
  if (
    cached &&
    Date.now() - cached.time < 5 * 60 * 1000
  ) {
    return cached.data;
  }

  const data = await footballRequest(
    `/fixtures?${params}`
  );

  fixtureCache.set(cacheKey, {
    data,
    time: Date.now()
  });

  return data;
}

// حساب التاريخ حسب عدد الأيام
function shiftDate(days) {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

// =====================================
// الصفحة الرئيسية
// =====================================

app.get("/", (req, res) => {
  res.json({
    name: "AMHAMED FOOTBALL API",
    status: "online",
    message: "Football server is running!",
    version: "2.1"
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

// =====================================
// 1. المباريات المباشرة
// =====================================

app.get("/api/football/live", async (req, res) => {
  try {
    const data = await footballRequest(
      "/fixtures?live=all"
    );

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not get live matches"
    );
  }
});

// =====================================
// 2. مباريات يوم معين
// مثال: /api/football/fixtures?date=2026-11-23
// =====================================

app.get("/api/football/fixtures", async (req, res) => {
  try {
    const { date } = req.query;

    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter date as YYYY-MM-DD"
      });
    }

    const data = await getFixturesByDate(date);

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not get fixtures"
    );
  }
});

// =====================================
// 3. المباريات القادمة
// باستعمال date بدل next
// مثال: /api/football/upcoming?next=30
// =====================================

app.get("/api/football/upcoming", async (req, res) => {
  try {
    const limit = Number(req.query.next || 30);

    const { team, league, season } = req.query;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
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

    const allMatches = [];
    const now = Math.floor(Date.now() / 1000);

    // البحث من اليوم إلى 14 يوماً قادماً
    for (let day = 0; day <= 14; day++) {
      const date = shiftDate(day);

      const data = await getFixturesByDate(date, {
        team,
        league,
        season
      });

      const matches = (data.response || []).filter(
        match =>
          (match.fixture?.timestamp || 0) >= now
      );

      allMatches.push(...matches);

      if (allMatches.length >= limit) {
        break;
      }
    }

    // ترتيب المباريات من الأقرب إلى الأبعد
    allMatches.sort((a, b) =>
      (a.fixture?.timestamp || 0) -
      (b.fixture?.timestamp || 0)
    );

    const response = allMatches.slice(0, limit);

    res.json({
      get: "fixtures",
      parameters: {
        next: String(limit),
        team,
        league,
        season
      },
      errors: [],
      results: response.length,
      paging: {
        current: 1,
        total: 1
      },
      response
    });

  } catch (error) {
    sendError(
      res,
      error,
      "Could not get upcoming matches"
    );
  }
});

// =====================================
// 4. المباريات السابقة
// باستعمال date بدل last
// مثال: /api/football/previous?last=30
// =====================================

app.get("/api/football/previous", async (req, res) => {
  try {
    const limit = Number(req.query.last || 30);

    const { team, league, season } = req.query;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
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

    const allMatches = [];
    const now = Math.floor(Date.now() / 1000);

    // المباريات المنتهية فقط
    const finishedStatuses = [
      "FT",
      "AET",
      "PEN",
      "AWD",
      "WO"
    ];

    // البحث من اليوم إلى 14 يوماً في الماضي
    for (let day = 0; day >= -14; day--) {
      const date = shiftDate(day);

      const data = await getFixturesByDate(date, {
        team,
        league,
        season
      });

      const matches = (data.response || []).filter(
        match =>
          (match.fixture?.timestamp || 0) < now &&
          finishedStatuses.includes(
            match.fixture?.status?.short
          )
      );

      allMatches.push(...matches);

      if (allMatches.length >= limit) {
        break;
      }
    }

    // ترتيب الأحدث أولاً
    allMatches.sort((a, b) =>
      (b.fixture?.timestamp || 0) -
      (a.fixture?.timestamp || 0)
    );

    const response = allMatches.slice(0, limit);

    res.json({
      get: "fixtures",
      parameters: {
        last: String(limit),
        team,
        league,
        season
      },
      errors: [],
      results: response.length,
      paging: {
        current: 1,
        total: 1
      },
      response
    });

  } catch (error) {
    sendError(
      res,
      error,
      "Could not get previous matches"
    );
  }
});

// =====================================
// 5. البحث عن الفرق والأندية
// =====================================

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
    sendError(
      res,
      error,
      "Could not search teams"
    );
  }
});

// =====================================
// 6. معلومات فريق محدد
// =====================================

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
    sendError(
      res,
      error,
      "Could not get team information"
    );
  }
});

// =====================================
// 7. البحث عن اللاعبين
// =====================================

app.get("/api/football/players/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const season =
      req.query.season || new Date().getFullYear();

    const page = Number(req.query.page || 1);

    if (q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search must contain at least 3 characters"
      });
    }

    if (
      !Number.isInteger(page) ||
      page < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page"
      });
    }

    const data = await footballRequest(
      `/players?${makeQuery({
        search: q,
        season,
        page
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not search players"
    );
  }
});

// =====================================
// 8. لاعبو فريق معين
// =====================================

app.get("/api/football/players", async (req, res) => {
  try {
    const { team } = req.query;

    const season =
      req.query.season || new Date().getFullYear();

    const page = Number(req.query.page || 1);

    if (!validId(team)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid team ID"
      });
    }

    if (
      !Number.isInteger(page) ||
      page < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page"
      });
    }

    const data = await footballRequest(
      `/players?${makeQuery({
        team,
        season,
        page
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not get team players"
    );
  }
});

// =====================================
// 9. البحث عن المنتخبات الوطنية
// =====================================

app.get(
  "/api/football/national-teams/search",
  async (req, res) => {
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
      sendError(
        res,
        error,
        "Could not search national teams"
      );
    }
  }
);

// =====================================
// 10. البلدان المتوفرة
// =====================================

app.get("/api/football/countries", async (req, res) => {
  try {
    const data = await footballRequest(
      `/countries?${makeQuery({
        search: req.query.search
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not get countries"
    );
  }
});

// =====================================
// 11. البحث عن الدوريات والبطولات
// =====================================

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
    sendError(
      res,
      error,
      "Could not get leagues"
    );
  }
});

// =====================================
// 12. ترتيب الدوري
// =====================================

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
      `/standings?${makeQuery({
        league,
        season
      })}`
    );

    res.json(data);
  } catch (error) {
    sendError(
      res,
      error,
      "Could not get standings"
    );
  }
});

// =====================================
// 13. تفاصيل المباراة
// الأحداث والإحصائيات والتشكيلات
// =====================================

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

    const [
      fixture,
      events,
      statistics,
      lineups
    ] = await Promise.all([
      footballRequest(
        `/fixtures?id=${fixtureId}`
      ),
      footballRequest(
        `/fixtures/events?fixture=${fixtureId}`
      ),
      footballRequest(
        `/fixtures/statistics?fixture=${fixtureId}`
      ),
      footballRequest(
        `/fixtures/lineups?fixture=${fixtureId}`
      )
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
    sendError(
      res,
      error,
      "Could not get match details"
    );
  }
});

// =====================================
// تشغيل الخادم
// =====================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `AMHAMED FOOTBALL API running on port ${PORT}`
  );
});
  
