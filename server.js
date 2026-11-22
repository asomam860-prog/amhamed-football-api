import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = "https://v3.football.api-sports.io";

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

app.get("/api/football/live", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API key is missing"
      });
    }

    const response = await fetch(`${API_URL}/fixtures?live=all`, {
      headers: {
        "x-apisports-key": API_KEY
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not get live matches"
    });
  }
});

app.get("/api/football/fixtures", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API key is missing"
      });
    }

    const date = req.query.date;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Enter date as YYYY-MM-DD"
      });
    }

    const response = await fetch(
      `${API_URL}/fixtures?date=${date}`,
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not get fixtures"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
                          
