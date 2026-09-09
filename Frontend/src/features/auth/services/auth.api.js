import axios from "axios";

const api = axios.create({
  baseURL: "https://hiremind-ai-backend.vercel.app",
  withCredentials: true,
});

export async function register({ username, email, password }) {
  try {
    console.log("REGISTER REQUEST");

    const response = await api.post("/api/auth/register", {
      username,
      email,
      password,
    });

    console.log("REGISTER SUCCESS:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "REGISTER ERROR:",
      err.response?.status,
      err.response?.data || err.message,
    );

    throw err;
  }
}

export async function login({ email, password }) {
  try {
    console.log("LOGIN REQUEST");

    const response = await api.post("/api/auth/login", {
      email,
      password,
    });

    console.log("LOGIN SUCCESS:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err.response?.status,
      err.response?.data || err.message,
    );

    throw err;
  }
}

export async function logout() {
  try {
    console.log("LOGOUT REQUEST");

    const response = await api.get("/api/auth/logout");

    console.log("LOGOUT SUCCESS:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "LOGOUT ERROR:",
      err.response?.status,
      err.response?.data || err.message,
    );

    throw err;
  }
}

export async function getMe() {
  try {
    console.log("GET ME REQUEST");

    const response = await api.get("/api/auth/get-me");

    console.log("GET ME SUCCESS:", response.data);

    return response.data;
  } catch (err) {
    console.error(
      "GET ME ERROR:",
      err.response?.status,
      err.response?.data || err.message,
    );

    throw err;
  }
}
