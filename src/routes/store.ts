import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import Cart from "../models/Cart";
import { adminAuth, auth } from "../middleware/auth";
import Store from "../models/Store";
import { generateStoreCode } from "../utils/random.generate.utils";
import { validateRequiredFieldsWithResult } from "../utils/validate.required.utils";
import Admin from "../models/AdminUser";

const router = express.Router();

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

router.post(
  "/",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        type,
        location,
        contactNumber,
        openingTime,
        closingTime,
        description,
        image,
        banner,
      } = req.body;
      if (!req.user || !req.user.userId) {
        throw createError(
          statusCodes.unauthorized,
          "User authentication required"
        );
      }
      const userId = req.user.userId;
      const requiredFields = [
        "name",
        "type",
        "contactNumber",
        "openingTime",
        "closingTime",
        "description",
      ];
      const validate = validateRequiredFieldsWithResult(
        req.body,
        requiredFields
      );
      if (!validate.isValid) {
        throw createError(
          statusCodes.badRequest,
          `Missing required fields ${validate.missingFields}`
        );
      }

      // Check if store with the same name already exists
      const existingStore = await Store.findOne({ name });
      if (existingStore) {
        throw createError(
          statusCodes.conflict,
          "Store with this name already exists"
        );
      }

      // Generate unique store code
      let storeCode = generateStoreCode();
      while (await Store.findOne({ storeCode })) {
        storeCode = generateStoreCode();
      }

      const newStore = new Store({
        name,
        type,
        location,
        contactNumber,
        openingTime,
        closingTime,
        description,
        image,
        banner,
        user: userId,
        storeCode,
      });

      await Promise.all([
        newStore.save(),
        Admin.findOneAndUpdate(
          { _id: userId },
          {
            role: "store-owner",
          }
        ),
      ]);
      res
        .status(statusCodes.created)
        .json({ message: "Store created successfully", store: newStore });
    } catch (error) {
      next(error);
    }
  }
);

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
