import express from "express";

const defaultApp = express();
defaultApp.use(express.json());

// Simulate default processor (80% success, 20% failure for realism)
defaultApp.get("/payments/service-health", (req, res) => {
  const failing = Math.random() < 0.2;
  res.json({ failing });
});

defaultApp.post("/payments", (req, res) => {
  if (Math.random() < 0.2) {
    res.status(429).send("Too Many Requests");
  } else {
    res.status(200).send();
  }
});

defaultApp.listen(8001, () => console.log("Mock default processor on port 8001"));

const fallbackApp = express();
fallbackApp.use(express.json());

// Simulate fallback processor (always up for simplicity)
fallbackApp.get("/payments/service-health", (req, res) => res.json({ failing: false }));

fallbackApp.post("/payments", (req, res) => res.status(200).send());

fallbackApp.listen(8002, () => console.log("Mock fallback processor on port 8002"));