import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import Product from "../models/Product";

const router = express.Router();

// Product Fetch with Pagination and Filters
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      ...filters
    } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sort: { [sortBy as string]: order === "asc" ? 1 : -1 },
      skip: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
    };

    const products = await mongoose.connection
      .collection("products")
      .find(filters)
      .sort([[sortBy as string, order === "asc" ? 1 : -1]])
      .skip(options.skip)
      .limit(options.limit)
      .toArray();

    res.json(products);
  } catch (error) {
    next(error);
  }
});
// Product Fetch with Id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw createError(statusCodes.badRequest, "Invalid Product ID");
    const product = await mongoose.connection
      .collection("products")
      .aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        {
          $lookup: {
            from: "stores",
            localField: "store",
            foreignField: "_id",
            as: "store",
          },
        },
        { $unwind: "$store" },
      ])
      .next();

    if (!product) {
      throw createError(statusCodes.notFound, "Product Not Found");
    }
    res.json(product);
  } catch (error: any) {
    next(error);
  }
});
// Product Fetch By Catogory
router.get(
  "/category/:category",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const { category } = req.params;

      const options = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: { [sortBy as string]: order === "asc" ? 1 : -1 },
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
      };

      let filters = {};

      if (mongoose.Types.ObjectId.isValid(category)) {
        const categoryDocument = await mongoose.connection
          .collection("categories")
          .findOne({
            $or: [
              { name: category },
              { _id: new mongoose.Types.ObjectId(category) },
            ],
          });

        if (!categoryDocument) {
          throw createError(statusCodes.notFound, "Category Not Found");
        }
        filters = {
          "categories._id": categoryDocument._id,
          "categories.name": categoryDocument.name,
          status: "active", // Ensure only active products are fetched
        };
      } else {
        filters = {
          $and: [
            { status: "active" }, // Ensure only active products are fetched
            { category },
          ],
        };
      }

      const products = await mongoose.connection
        .collection("products")
        .find(filters)
        .sort([[sortBy as string, order === "asc" ? 1 : -1]])
        .skip(options.skip)
        .limit(options.limit)
        .toArray();

      res.json(products);
    } catch (error) {
      next(error);
    }
  }
);
// Product Related Products
router.get(
  "/:id/related",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id))
        throw createError(statusCodes.badRequest, "Invalid Product ID");

      const product = await mongoose.connection
        .collection("products")
        .findOne({ _id: new mongoose.Types.ObjectId(id) });

      if (!product) {
        throw createError(statusCodes.notFound, "Product Not Found");
      }

      const { category, tags = [] } = product;

      const relatedFilters: any = {
        _id: { $ne: new mongoose.Types.ObjectId(id) }, // Exclude the current product
        status: "active", // Ensure only active products are fetched
      };

      if (category) {
        relatedFilters.category = category;
      }

      if (tags.length > 0) {
        relatedFilters.tags = { $in: tags };
      }

      const relatedProducts = await mongoose.connection
        .collection("products")
        .find(relatedFilters)
        .limit(10) // Limit the number of related products
        .toArray();

      res.json(relatedProducts);
    } catch (error) {
      next(error);
    }
  }
);
// Featured Products Fetch
router.get(
  "/featured-products/top",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const options = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: { [sortBy as string]: order === "asc" ? 1 : -1 },
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
      };

      const featuredProducts = await mongoose.connection
        .collection("products")
        .find({ isFeatured: true, status: "active" }) // Fetch only featured and active products
        .sort([[sortBy as string, order === "asc" ? 1 : -1]])
        .skip(options.skip)
        .limit(options.limit)
        .toArray();

      res.json(featuredProducts);
    } catch (error) {
      next(error);
    }
  }
);
// Weekly Best Selling Products Fetch
router.get(
  "/weekly-best-selling",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "salesCount",
        order = "desc",
      } = req.query;

      const options = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort: { [sortBy as string]: order === "asc" ? 1 : -1 },
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
      };

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weeklyBestSellingProducts = await mongoose.connection
        .collection("products")
        .find({
          status: "active", // Ensure only active products are fetched
          lastSoldDate: { $gte: oneWeekAgo }, // Filter products sold in the last week
        })
        .sort([[sortBy as string, order === "asc" ? 1 : -1]])
        .skip(options.skip)
        .limit(options.limit)
        .toArray();

      res.json(weeklyBestSellingProducts);
    } catch (error) {
      next(error);
    }
  }
);

// Fetch Current Product in Other Stores
router.get(
  "/:id/other-stores",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id))
        throw createError(statusCodes.badRequest, "Invalid Product ID");

      const product = await mongoose.connection
        .collection("products")
        .findOne({ _id: new mongoose.Types.ObjectId(id) });

      if (!product) {
        throw createError(statusCodes.notFound, "Product Not Found");
      }

      const options = {
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
        limit: parseInt(limit as string, 10),
      };

      const otherStoresProducts = await mongoose.connection
        .collection("products")
        .aggregate([
          {
            $match: {
              sku: product.sku,
              _id: { $ne: product._id },
            },
          }, // Match products with the same SKU, different IDs, and price not more than the current product
          {
            $lookup: {
              from: "stores", // Join with the stores collection
              localField: "store",
              foreignField: "_id",
              as: "storeDetails",
            },
          },
          { $unwind: "$storeDetails" }, // Unwind the store details array
          { $project: { _id: 1, storeDetails: 1, price: 1 } }, // Include only product ID, store details, and price
          { $skip: options.skip },
          { $limit: options.limit },
        ])
        .toArray();

      res.json(otherStoresProducts);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
