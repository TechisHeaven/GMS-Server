import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import errorHandler from "./handlers/route.handler";
import catchAllRoute from "./handlers/catchAll.handler";
import productRoutes from "./routes/product";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/order";
import storeRoutes from "./routes/store";
import categoriesRoutes from "./routes/categories";
// import orderRoutes from "./src/routes/auth.ts";
// import userRoutes from "./src/routes/auth.ts";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/categories", categoriesRoutes);

// Error handler middleware
app.use(errorHandler);
// Catch-all route for 404 errors
app.use(catchAllRoute);

// MongoDB connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/grocery_dashboard"
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
