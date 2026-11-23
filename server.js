
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.HIGHLIGHTLY_API_KEY;
const API_URL = "https://soccer.highlightly.net";

const cache = new Map();
const CACHE_TIME = 60 * 1000;

function todayInAlgeria(offset = 0) {
  const now = new Date();
  const dateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);

  return date.toISOString().slice(0, 10);
}

async function footballRequest(path, params = {}) {
  if (!API_KEY) {
    throw new Error("HIGHLIGHTLY_API_KEY is missing in Render");
  }

  const url = new URL(`${API_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TIME) {
    return cached.data;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": API_KEY
    }
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(
      data.message || `Highlightly error ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  cache.set(cacheKey, {
    time: Date.now(),
    data
  });

  return data;
}

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.response)) return data.response;
  return [];
}

function isLive(match) {
  const state = String(
    match?.state?.description || ""
  ).toLowerCase();

  return [
    "first half",
    "second half",
    "half time",
    "extra time",
    "break time",
    "penalties",
    "in progress",
    "interrupted"
  ].includes(state);
}

function isFinished(match) {
  const state = String(
    match?.state?.description || ""
  ).toLowerCase();

  return [
    "finished",
    "finished after penalties",
    "finished after extra time",
    "awarded"
  ].includes(state);
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Highlightly error:", error.message);

      res.status(error.status || 500).json({
        success: false,
        message: error.message,
        details: error.data || null
      });
    }
  };
}

// Server status
app.get("/", (req, res) => {
  res.json({
    name: "AMHAMED FOOTBALL API",
    status: "online",
    provider: "Highlightly",
    version: "3.0"
  });
});

app.get("/api/football", (req, res) => {
  res.json({
    name: "AMHAMED FOOTBALL API",
    status: "online",
    provider: "Highlightly",
    version: "3.0"
  });
});

// Test Highlightly connection
app.get(
  "/api/football/test-highlightly",
  asyncRoute(async (req, res) => {
    const data = await footballRequest("/matches", {
      date: todayInAlgeria(),
      timezone: "Africa/Algiers",
      limit: 5
    });

    res.json({
      success: true,
      provider: "Highlightly",
      result: data
    });
  })
);

// Matches for a specific date
app.get(
  "/api/football/fixtures",
  asyncRoute(async (req, res) => {
    const date = req.query.date || todayInAlgeria();

    const data = await footballRequest("/matches", {
      date,
      timezone: "Africa/Algiers",
      limit: 100
    });

    res.json(data);
  })
);

// Live matches
app.get(
  "/api/football/live",
  asyncRoute(async (req, res) => {
    const data = await footballRequest("/matches", {
      date: todayInAlgeria(),
      timezone: "Africa/Algiers",
      limit: 100
    });

    const matches = getList(data).filter(isLive);

    res.json({
      data: matches,
      total: matches.length
    });
  })
);

// Upcoming matches: today and tomorrow
app.get(
  "/api/football/upcoming",
  asyncRoute(async (req, res) => {
    const dates = [
      todayInAlgeria(),
      todayInAlgeria(1)
    ];

    const results = await Promise.all(
      dates.map(date =>
        footballRequest("/matches", {
          date,
          timezone: "Africa/Algiers",
          limit: 100
        })
      )
    );

    const matches = results
      .flatMap(getList)
      .filter(match => !isLive(match) && !isFinished(match));

    res.json({
      data: matches,
      total: matches.length
    });
  })
);

// Previous matches: yesterday and today
app.get(
  "/api/football/previous",
  asyncRoute(async (req, res) => {
    const dates = [
      todayInAlgeria(-1),
      todayInAlgeria()
    ];

    const results = await Promise.all(
      dates.map(date =>
        footballRequest("/matches", {
          date,
          timezone: "Africa/Algiers",
          limit: 100
        })
      )
    );

    const matches = results
      .flatMap(getList)
      .filter(isFinished);

    res.json({
      data: matches,
      total: matches.length
    });
  })
);

// Search teams
app.get(
  "/api/football/teams/search",
  asyncRoute(async (req, res) => {
    const q = req.query.q || "";

    const data = await footballRequest("/teams", {
      name: q,
      limit: 30
    });

    res.json(data);
  })
);

// Search national teams
app.get(
  "/api/football/national-teams/search",
  asyncRoute(async (req, res) => {
    const q = req.query.q || "";

    const data = await footballRequest("/teams", {
      name: q,
      type: "national",
      limit: 50
    });

    res.json(data);
  })
);

// Team details
app.get(
  "/api/football/team",
  asyncRoute(async (req, res) => {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        message: "Team id is required"
      });
    }

    const data = await footballRequest(`/teams/${id}`);
    res.json(data);
  })
);

// Search players
app.get(
  "/api/football/players/search",
  asyncRoute(async (req, res) => {
    const q = req.query.q || "";

    const data = await footballRequest("/players", {
      name: q,
      limit: 30
    });

    res.json(data);
  })
);

// Players by team
app.get(
  "/api/football/players",
  asyncRoute(async (req, res) => {
    const team = req.query.team;

    if (!team) {
      return res.status(400).json({
        message: "Team id is required"
      });
    }

    const data = await footballRequest("/players", {
      teamId: team,
      limit: 100
    });

    res.json(data);
  })
);

// Countries
app.get(
  "/api/football/countries",
  asyncRoute(async (req, res) => {
    const search = req.query.search || "";

    const data = await footballRequest("/countries", {
      name: search
    });

    res.json(data);
  })
);

// Leagues
app.get(
  "/api/football/leagues",
  asyncRoute(async (req, res) => {
    const params = {
      leagueName: req.query.search || "",
      countryName: req.query.country || "",
      season: req.query.season || ""
    };

    const data = await footballRequest("/leagues", params);
    res.json(data);
  })
);

// League standings
app.get(
  "/api/football/standings",
  asyncRoute(async (req, res) => {
    const leagueId = req.query.league || req.query.leagueId;
    const season = req.query.season;

    if (!leagueId || !season) {
      return res.status(400).json({
        message: "League id and season are required"
      });
    }

    const data = await footballRequest("/standings", {
      leagueId,
      season
    });

    res.json(data);
  })
);

// Match details: match, events, statistics and lineups
app.get(
  "/api/football/details",
  asyncRoute(async (req, res) => {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        message: "Match id is required"
      });
    }

    const [match, events, statistics, lineups] =
      await Promise.all([
        footballRequest(`/matches/${id}`),
        footballRequest(`/events/${id}`),
        footballRequest(`/statistics/${id}`),
        footballRequest(`/lineups/${id}`)
      ]);

    res.json({
      match,
      events,
      statistics,
      lineups
    });
  })
);

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(
    `AMHAMED FOOTBALL API running on port ${PORT}`
  );
});
            
