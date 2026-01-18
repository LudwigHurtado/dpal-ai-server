import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/ai", aiRoutes);

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`AI server running on port ${port}`);
});
