import { request } from "http";

async function getSummary() {
  const url = `http://localhost:9999/payments-summary`;
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET" }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function monitor() {
  const startTime = new Date();
  console.log("Starting API monitor...");

  while (true) {
    try {
      const res = await getSummary();
      if (res.status === 200) {
        const { default: def, fallback, unprocessed } = res.body;
        console.log(`[${new Date().toISOString()}] API Status: UP`);
        console.log(`Uptime: ${Math.floor((new Date() - startTime) / 1000)} seconds`);
        console.log(`Payments - Default: ${def.totalRequests} ($${def.totalAmount.toFixed(2)})`);
        console.log(`Payments - Fallback: ${fallback.totalRequests} ($${fallback.totalAmount.toFixed(2)})`);
        console.log(`Payments - Unprocessed: ${unprocessed.totalRequests} ($${unprocessed.totalAmount.toFixed(2)})`);
      } else {
        console.log(`[${new Date().toISOString()}] API Status: DOWN (Status: ${res.status})`);
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] API Status: ERROR (${error.message})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5 seconds
  }
}

monitor().catch(console.error);