import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import Product from "../models/Product";
import { adminAuth } from "../middleware/auth";

const router = express.Router();
// Create a new product
router.post(
  "/",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productData = req.body;
      const { storeId } = req.user as { userId: string; storeId: string };

      // Validate required fields
      if (!productData.name || !storeId || !productData.price) {
        throw createError(statusCodes.badRequest, "Missing required fields");
      }

      // Validate store ID
      if (!mongoose.Types.ObjectId.isValid(storeId)) {
        throw createError(statusCodes.badRequest, "Invalid Store ID");
      }

      // Validate categories
      if (
        productData.categories &&
        !Array.isArray(productData.categories) &&
        productData.categories.some(
          (category: any) =>
            !category._id || !mongoose.Types.ObjectId.isValid(category._id)
        )
      ) {
        throw createError(statusCodes.badRequest, "Invalid Category IDs");
      }

      const categories = productData.categories.map((category: any) => ({
        _id: new mongoose.Types.ObjectId(category._id),
        name: category.name,
      }));
      const newProduct = new Product({
        ...productData,
        categories,
        store: storeId,
        isFeatured: productData.isFeatured || false,
        createdAt: new Date(),
      });

      await newProduct.save();

      res.status(statusCodes.created).json(newProduct);
    } catch (error) {
      next(error);
    }
  }
);

// Update an existing product
router.put(
  "/:id",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const productData = req.body;
      const { storeId } = req.user as { userId: string; storeId: string };

      // Validate product ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid Product ID");
      }

      // Validate store ID if provided
      if (storeId && !mongoose.Types.ObjectId.isValid(storeId)) {
        throw createError(statusCodes.badRequest, "Invalid Store ID");
      }

      // Validate categories if provided
      if (
        productData.categories &&
        !Array.isArray(productData.categories) &&
        productData.categories.some(
          (category: any) =>
            !category._id || !mongoose.Types.ObjectId.isValid(category._id)
        )
      ) {
        throw createError(statusCodes.badRequest, "Invalid Category IDs");
      }

      const updatedProduct = await mongoose.connection
        .collection("products")
        .findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(id) },
          { $set: productData },
          { returnDocument: "after" }
        );

      if (!updatedProduct) {
        throw createError(statusCodes.notFound, "Product Not Found");
      }

      res.json(updatedProduct);
    } catch (error) {
      next(error);
    }
  }
);
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

// Fetch Multiple Products by IDs with Store Populate
router.post(
  "/by-ids",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;

      if (
        !Array.isArray(ids) ||
        ids.some((id) => !mongoose.Types.ObjectId.isValid(id))
      ) {
        throw createError(statusCodes.badRequest, "Invalid Product IDs");
      }

      const products = await mongoose.connection
        .collection("products")
        .aggregate([
          {
            $match: {
              _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
            },
          },
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
        .toArray();

      res.json(products);
    } catch (error) {
      next(error);
    }
  }
);
// Product Fetch with Id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw createError(statusCodes.badRequest, "Invalid Product ID");
    // const product = await mongoose.connection
    //   .collection("products")
    //   .aggregate([
    //     { $match: { _id: new mongoose.Types.ObjectId(id) } },
    //     {
    //       $lookup: {
    //         from: "stores",
    //         localField: "store",
    //         foreignField: "_id",
    //         as: "store",
    //       },
    //     },
    //     { $unwind: "$store" },
    //   ])
    //   .next();
    const product = await Product.findById(id).populate("store");
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

      const featuredProducts = await Product.find({
        isFeatured: true,
        status: "active",
      }) // Fetch only featured and active products
        .populate("store") // Populate the store field
        .sort({ [sortBy as string]: order === "asc" ? 1 : -1 })
        .skip(options.skip)
        .limit(options.limit);

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

// Product Fetch with Pagination and Filters
router.get(
  "/dashboard/all",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
      };

      const { storeId } = req.user as { userId: string; storeId: string };
      const products = await mongoose.connection
        .collection("products")
        .find({ ...filters, store: new mongoose.Types.ObjectId(storeId) })
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

// Search Products by Name, Categories, or Tags
router.get(
  "/search/product",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        query = "",
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const options = {
        skip:
          (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
        limit: parseInt(limit as string, 10),
        sort: { [sortBy as string]: order === "asc" ? 1 : -1 },
      };

      const searchQuery = query as string;

      const filters = {
        $or: [
          { name: { $regex: searchQuery, $options: "i" } }, // Search by name (case-insensitive)
          { "categories.name": { $regex: searchQuery, $options: "i" } }, // Search by category name
          { tags: { $regex: searchQuery, $options: "i" } }, // Search by tags
        ],
        status: "active", // Ensure only active products are fetched
      };

      const stores = await mongoose.connection
        .collection("stores")
        .find({
          name: { $regex: searchQuery, $options: "i" },
        })
        .project({
          _id: 1,
          name: 1,
          type: 1,
          image: 1,
          banner: 1,
          description: 1,
        })
        .toArray();

      const products = await mongoose.connection
        .collection("products")
        .find(filters)
        .sort([[sortBy as string, order === "asc" ? 1 : -1]])
        .skip(options.skip)
        .limit(options.limit)
        .toArray();

      res.json({ stores, products });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
