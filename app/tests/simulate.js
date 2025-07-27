import { request } from "http";

function generateUUID() {
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

async function sendPayment() {
  const amount = Math.random() * 1000 + 10;
  const body = JSON.stringify({
    correlationId: generateUUID(),
    amount,
  });

  return new Promise((resolve, reject) => {
    const req = request("http://localhost:9999/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function getSummary(from, to) {
  const url = `http://localhost:9999/payments-summary${from ? `?from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET" }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function simulatePayments() {
  console.log("Starting payment simulation...");
  let count = 0;
  while (true) {
    try {
      const res = await sendPayment();
      console.log(`Payment ${++count}: Status ${res.status} - ${JSON.stringify(res.body)}`);
    } catch (error) {
      console.error(`Payment ${++count}: Failed - ${error.message}`);
    }

    // Every 10 payments, check summary
    if (count % 10 === 0) {
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 3600000).toISOString(); 
        const res = await getSummary(from);
        console.log(`Summary at ${count} payments:`, res.body);
      } catch (error) {
        console.error("Summary failed:", error.message);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

simulatePayments().catch(console.error);