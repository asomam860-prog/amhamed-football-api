
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

  return {
    status: response.status,
    data
  };
}

app.get("/", (req, res) => {
  res.json({
    name: "AMHAMED FOOTBALL API",
    status: "online",
    message: "Football server is running!"
  });
});

app.get("/api/football", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to AMHAMED FOOTBALL"
  });
});

// المباريات المباشرة
app.get("/api/football/live", async (req, res) => {
  try {
    const result = await footballRequest("/fixtures?live=all");
    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not get live matches"
    });
  }
});

// مباريات يوم معين
app.get("/api/football/fixtures", async (req, res) => {
  try {
    const date = req.query.date;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Enter date as YYYY-MM-DD"
      });
    }

    const result = await footballRequest(
      `/fixtures?date=${date}`
    );

    res.status(result.status).json(result.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not get fixtures"
    });
  }
});

// تفاصيل المباراة: المعلومات والأحداث والإحصائيات والتشكيلة
app.get("/api/football/details", async (req, res) => {
  try {
    const id = req.query.id;

    if (!id || !/^\d+$/.test(String(id))) {
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
      fixture: fixture.data.response || [],
      events: events.data.response || [],
      statistics: statistics.data.response || [],
      lineups: lineups.data.response || [],
      apiErrors: {
        fixture: fixture.data.errors || [],
        events: events.data.errors || [],
        statistics: statistics.data.errors || [],
        lineups: lineups.data.errors || []
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not get match details"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
        
