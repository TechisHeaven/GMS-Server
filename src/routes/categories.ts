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

// Create a new category
router.post(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, image, isFeatured } = req.body;

      if (!name || !description) {
        return next(
          createError(statusCodes.badRequest, "Missing required fields")
        );
      }

      const category = {
        name,
        description,
        image,
        isFeatured: isFeatured || false,
        createdAt: new Date(),
      };

      const result = await mongoose.connection
        .collection("categories")
        .insertOne(category);

      res.status(statusCodes.created).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Fetch all categories with pagination
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    const categories = await mongoose.connection
      .collection("categories")
      .find({})
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .toArray();

    const totalCategories = await mongoose.connection
      .collection("categories")
      .countDocuments();

    res.json({
      categories,
      total: totalCategories,
      page: pageNumber,
      pages: Math.ceil(totalCategories / limitNumber),
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/category/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const category = await mongoose.connection
        .collection("categories")
        .find({ _id: new mongoose.Types.ObjectId(id) })
        .toArray();

      res.json(category[0]);
    } catch (error) {
      next(error);
    }
  }
);
// Fetch featured categories with pagination
router.get(
  "/featured",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const pageNumber = parseInt(page as string, 10);
      const limitNumber = parseInt(limit as string, 10);

      const featuredCategories = await mongoose.connection
        .collection("categories")
        .find({ isFeatured: true })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .toArray();

      const totalFeaturedCategories = await mongoose.connection
        .collection("categories")
        .countDocuments({ isFeatured: true });

      res.json({
        featuredCategories,
        total: totalFeaturedCategories,
        page: pageNumber,
        pages: Math.ceil(totalFeaturedCategories / limitNumber),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update a category
router.put(
  "/:id",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isFeatured } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(createError(statusCodes.badRequest, "Invalid ID"));
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (typeof isFeatured === "boolean") updateData.isFeatured = isFeatured;

      const result = await mongoose.connection
        .collection("categories")
        .updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $set: updateData }
        );

      if (result.matchedCount === 0) {
        throw createError(statusCodes.notFound, "Category not found");
      }

      res.json({ message: "Category updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a category
router.delete(
  "/:id",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(createError(statusCodes.badRequest, "Invalid ID"));
      }

      const result = await mongoose.connection
        .collection("categories")
        .deleteOne({ _id: new mongoose.Types.ObjectId(id) });

      if (result.deletedCount === 0) {
        throw createError(statusCodes.notFound, "Category not found");
      }

      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
