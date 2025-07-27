import { request } from "http";
import { PaymentRequest } from "./core.js";

class PaymentClient {
  constructor(defaultURL, fallbackURL) {
    this.defaultURL = defaultURL;
    this.fallbackURL = fallbackURL;
    this.defaultUp = true;
    this.lastCheck = null;
    this.retryDelay = 5000;
    this.minResponseTime = 0;
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
  }

  async sendToDefault(payment) {
    if (!(payment instanceof PaymentRequest)) {
      throw new Error("Invalid payment request");
    }

    if (!(await this.checkDefaultHealth())) {
      throw new Error("Default processor is down or failing");
    }

    return this.send(`${this.defaultURL}/payments`, payment);
  }

  async sendToFallback(payment) {
    if (!(payment instanceof PaymentRequest)) {
      throw new Error("Invalid payment request");
    }

    return this.send(`${this.fallbackURL}/payments`, payment);
  }

  async send(url, payment) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payment);
      
      const req = request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        },
      }, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }
          resolve(responseData);
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Network error: ${err.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(body);
      req.end();
    });
  }

  async checkDefaultHealth() {
    const now = Date.now();
    
    if (this.lastCheck && (now - this.lastCheck) < this.retryDelay) {
      return this.defaultUp;
    }

    try {
      const healthData = await this.performHealthCheck();
      console.log('performHealthCheck result:', healthData); // Debug log
      this.lastCheck = now;
      this.consecutiveFailures = 0;
      this.defaultUp = !healthData.failing;
      this.minResponseTime = healthData.minResponseTime || 0;
      this.retryDelay = 5000;
      
      return this.defaultUp;
    } catch (error) {
      console.log('performHealthCheck error:', error.message); // Debug log
      this.consecutiveFailures++;
      this.lastCheck = now;
      this.defaultUp = false;
      this.retryDelay = Math.min(30000, this.retryDelay * 2);
      return false;
    }
  }

  async performHealthCheck() {
    return new Promise((resolve, reject) => {
      const req = request(`${this.defaultURL}/payments/service-health`, {
        method: "GET"
      }, (res) => {
        if (res.statusCode === 429) {
          const retryAfter = res.headers["retry-after"];
          if (retryAfter && !isNaN(parseInt(retryAfter))) {
            this.retryDelay = parseInt(retryAfter) * 1000;
          }
          reject(new Error("Rate limited"));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Health check failed: ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const healthData = JSON.parse(data);
            resolve(healthData);
          } catch (parseError) {
            reject(new Error("Invalid health check response"));
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Health check network error: ${err.message}`));
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Health check timeout"));
      });

      req.end();
    });
  }

  getStats() {
    return {
      defaultUp: this.defaultUp,
      lastCheck: this.lastCheck,
      retryDelay: this.retryDelay,
      minResponseTime: this.minResponseTime,
      consecutiveFailures: this.consecutiveFailures
    };
  }
}

export { PaymentClient };