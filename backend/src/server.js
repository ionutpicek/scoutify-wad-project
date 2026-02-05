import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRoutes from "./routes/ai.js";
import gradingRoutes from "./routes/grading.js";
import matchRoutes from "./routes/matches.js";
import adminRoutes from "./routes/admin.js";
import teamRoutes from "./routes/teams.js";
import playerRoutes from "./routes/players.js";
import statsRoutes from "./routes/stats.js";
import userRoutes from "./routes/users.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/grading", gradingRoutes);
app.use("/ai", aiRoutes);
app.use("/matches", matchRoutes);
app.use("/admin", adminRoutes);
app.use("/teams", teamRoutes);
app.use("/players", playerRoutes);
app.use("/stats", statsRoutes);
app.use("/users", userRoutes);


app.get("/", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
