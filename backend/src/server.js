import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRoutes from "./routes/ai.js";
import gradingRoutes from "./routes/grading.js";
import matchRoutes from "./routes/matches.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/grading", gradingRoutes);
app.use("/ai", aiRoutes);
app.use("/matches", matchRoutes);
app.use("/admin", adminRoutes);


app.get("/", (req, res) => {
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
