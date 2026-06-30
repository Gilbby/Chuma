// Base URL of the Chuma backend.
// - Local device on same WiFi: http://<your-computer-LAN-IP>:5000/api
// - Via ngrok: https://<subdomain>.ngrok-free.app/api
// Set EXPO_PUBLIC_API_URL in .env to override.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
