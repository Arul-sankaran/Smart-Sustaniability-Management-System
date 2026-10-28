import axios from "axios";

const API = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    "https://sustainability-outcome-measurement-system.onrender.com/api",
});

API.interceptors.request.use((req) => {

  const storedUser = localStorage.getItem("user");

  if (storedUser && storedUser !== "undefined") {
    const user = JSON.parse(storedUser);

    if (user?.token) {
      req.headers.Authorization = `Bearer ${user.token}`;
    }
  }

  return req;
});

export default API;