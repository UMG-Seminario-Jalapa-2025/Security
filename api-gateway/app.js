import express from "express";
import rateLimit from "express-rate-limit";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import cors from "cors";  


const app = express();
app.set('trust proxy', 1);

// Configurar CORS
// app.use(cors({
//   origin: 'http://localhost:5173', 
//   methods: 'GET,POST,PUT,PATCH,DELETE',
//   credentials: true  
// }));
console.log("Antes de implemnetar los cors");
app.use(cors());
// Create a Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});


redisClient.on("error", (error) => {
  console.error("Redis client error:", error);
});

redisClient.on("end", () => {
  console.log("Redis client connection closed");
});


const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});
app.use(apiLimiter);

const authUrl = process.env.AUTH_URL || "http://localhost:3001";

const authMiddleware = async (req, res, next) => {
  console.log("Llamando al authMiddleware");
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).send("Missing authorization header");
  console.log("Antes de hacer el split de auth header");
  const token = authHeader.split(" ")[1];
  let cachedData = await redisClient.get(token);
  if (cachedData) {
    return next();
  }
  try {
    const response = await axios.get(`${authUrl}/verifyToken`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data } = response;

    //Getting data for authorization later on.
    //apps, modulos, recursos y permisos (adjuntarlo al json de verify)
    // Cual es mi criterio de busqueda en la bd.
    //Criterio de busqueda , sessionid=token and userid.
    
    await redisClient.set(token, JSON.stringify(data));
    next();

  

  } catch (error) {
    console.log({ error });
    res.status(401).send("Invalid or expired token");
  }
};

const businessPartnersUrl = process.env.BUSINESS_PARTNERS_URL || "http://business-partners-service:8082";
// Proxy para business-partners-service (incluyendo Swagger) protegido con authMiddleware
app.use(
  "/api/business-partners",
  authMiddleware,
  createProxyMiddleware({
    target: businessPartnersUrl,
    changeOrigin: true,
    pathRewrite: {
      "^/api/business-partners": "",
    },
  })
);

// Set up proxy middleware for each service

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: authUrl,
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth": "",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.method === "POST" && req.headers["content-type"]) {
        proxyReq.setHeader("Content-Type", req.headers["content-type"]);
      }
    },
  })
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
