import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.js";
import gradingRoutes from "./routes/grading.js";
import matchRoutes from "./routes/matches.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/grading", gradingRoutes);
app.use("/ai", aiRoutes);
app.use("/matches", matchRoutes);


app.get("/", (req, res) => {
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
