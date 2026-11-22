
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
