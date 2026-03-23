const express = require("express");
const cors = require("cors");

const episodeMirrorRouter = require("./episode-mirror.route");

const app = express();

app.use(
  cors({
    origin: [
      "https://ani.ness.web.id",
      "https://ani.ness.biz.id",
      "http://localhost:3000",
    ],
    methods: ["POST", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", episodeMirrorRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Mirror API listening on port ${port}`);
});
