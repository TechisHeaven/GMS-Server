import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import Cart from "../models/Cart";
import { auth } from "../middleware/auth";

const router = express.Router();

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}
// Fetch store details
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw createError(statusCodes.badRequest, "Store ID is required");
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(statusCodes.badRequest, "Invalid Store ID");
    }

    const store = await mongoose.connection
      .collection("stores")
      .findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!store) {
      throw createError(statusCodes.notFound, "Store not found");
    }

    res.json(store);
  } catch (error) {
    next(error);
  }
});

// Fetch top stores
router.get(
  "/top/store",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 5 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const topStores = await mongoose.connection
        .collection("stores")
        .find()
        .sort({ rating: -1 })
        .skip(skip)
        .limit(Number(limit))
        .toArray();

      res.json(topStores);
    } catch (error) {
      next(error);
    }
  }
);

// Fetch all stores
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await mongoose.connection
      .collection("stores")
      .find()
      .toArray();

    res.json(stores);
  } catch (error) {
    next(error);
  }
});

// Fetch all products by store ID with sorting and pagination
router.get(
  "/:id/products",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        sortBy = "name",
        order = "asc",
        page = 1,
        limit = 10,
      } = req.query;

      if (!id) {
        throw createError(statusCodes.badRequest, "Store ID is required");
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid Store ID");
      }

      const sortOrder = order === "desc" ? -1 : 1;
      const skip = (Number(page) - 1) * Number(limit);

      const products = await mongoose.connection
        .collection("products")
        .find({ store: new mongoose.Types.ObjectId(id) })
        .sort({ [sortBy as string]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .toArray();

      res.json(products);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
