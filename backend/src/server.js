import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import aiRoutes from "./routes/ai.js";
import gradingRoutes from "./routes/grading.js";
import matchRoutes from "./routes/matches.js";
import adminRoutes from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
