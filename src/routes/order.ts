import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import { adminAuth, auth } from "../middleware/auth";
import Order from "../models/Order";
import Razorpay from "razorpay";
import Payment from "../models/Payment";

const router = express.Router();

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID as string,
//   key_secret: process.env.RAZORPAY_KEY_SECRET as string,
// });

// Create order
// router.post(
//   "/",
//   auth,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { userId } = req.user || {};
//       const { store, customer, items, totalAmount, paymentMethod, notes } =
//         req.body;

//       if (
//         !userId ||
//         !store ||
//         !customer ||
//         !items ||
//         !totalAmount ||
//         !paymentMethod
//       ) {
//         return next(
//           createError(statusCodes.badRequest, "Missing required fields")
//         );
//       }

//       if (items.length <= 0)
//         throw createError(statusCodes.badRequest, "Items are required");

//       // Check if all product IDs in items exist in the products collection
//       const productIds = items.map((item: { product: string }) => item.product);

//       const existingProducts = await mongoose.connection
//         .collection("products")
//         .find({
//           _id: {
//             $in: productIds.map(
//               (id: string) => new mongoose.Types.ObjectId(id)
//             ),
//           },
//         })
//         .toArray();

//       if (existingProducts.length !== productIds.length) {
//         throw createError(
//           statusCodes.badRequest,
//           "One or more products in the items do not exist"
//         );
//       }

//       // Validate items structure
//       if (
//         !customer ||
//         !customer.name ||
//         !customer.phone ||
//         typeof customer.name !== "string" ||
//         typeof customer.phone !== "string"
//       ) {
//         return next(
//           createError(statusCodes.badRequest, "Invalid customer structure")
//         );
//       }

//       if (
//         !Array.isArray(items) ||
//         items.some((item) => !item.product || !item.quantity || !item.price)
//       ) {
//         return next(
//           createError(statusCodes.badRequest, "Invalid items structure")
//         );
//       }

//       const order = new Order({
//         store,
//         customer,
//         items,
//         totalAmount,
//         paymentMethod,
//         notes,
//         paymentStatus: "pending", // Initial status before Razorpay verification
//         createdAt: new Date(),
//       });

//       const result = await order.save();

//       res.status(statusCodes.created).json(result);
//     } catch (error) {
//       next(error);
//     }
//   }
// );

router.post(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};
      const { orders } = req.body; // Expecting an array of orders

      if (!userId || !Array.isArray(orders) || orders.length === 0) {
        return next(createError(statusCodes.badRequest, "Invalid order data"));
      }

      const createdOrders = [];

      for (const orderData of orders) {
        const { store, customer, items, totalAmount, paymentMethod, notes } =
          orderData;

        if (!store || !customer || !items || !totalAmount || !paymentMethod) {
          throw createError(statusCodes.badRequest, "Missing required fields");
        }

        if (!Array.isArray(items) || items.length <= 0)
          throw createError(statusCodes.badRequest, "Items are required");

        // Validate products
        const productIds = items.map(
          (item) => new mongoose.Types.ObjectId(item.product)
        );
        const existingProducts = await mongoose.connection
          .collection("products")
          .find({
            _id: { $in: productIds },
            store: new mongoose.Types.ObjectId(store),
          })
          .toArray();

        if (existingProducts.length !== productIds.length) {
          throw createError(
            statusCodes.badRequest,
            "One or more products do not exist"
          );
        }

        // Update product quantities
        for (const item of items) {
          const product = existingProducts.find(
            (p) => p._id.toString() === item.product
          );
          if (!product) {
            throw createError(
              statusCodes.badRequest,
              `Product with ID ${item.product} not found`
            );
          }

          if (product.stock < item.quantity) {
            throw createError(
              statusCodes.badRequest,
              `Insufficient quantity for product ${product.name}`
            );
          }

          // Deduct the ordered quantity from the product's stock
        }
        const bulkUpdateOps = items.map((item) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(item.product) },
            update: { $inc: { stock: -item.quantity } },
          },
        }));
        await mongoose.connection
          .collection("products")
          .bulkWrite(bulkUpdateOps);

        // Create order
        const order = new Order({
          store,
          customer: {
            _id: new mongoose.Types.ObjectId(userId),
            ...customer,
          },
          items,
          totalAmount,
          paymentMethod,
          notes,
          paymentStatus: "pending",
          createdAt: new Date(),
        });
        const savedOrder = await order.save();
        createdOrders.push(savedOrder);
      }

      res.status(statusCodes.created).json({
        message: "Orders placed successfully",
        orders: createdOrders,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Fetch order By Id
router.get(
  "/:id",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};
      const { id } = req.params;

      if (!userId) {
        throw createError(statusCodes.badRequest, "User ID is required");
      }

      //   const order = await Order.findOne({
      //     _id: new mongoose.Types.ObjectId(id),
      //   }).populate("items.product");
      const query = mongoose.Types.ObjectId.isValid(id)
        ? { _id: new mongoose.Types.ObjectId(id) }
        : { orderNumber: id };

      const order = await mongoose.connection
        .collection("orders")
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "items",
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
          {
            $unwind: {
              path: "$store",
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .toArray();

      if (!order || order.length === 0) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      res.json(order[0]);
    } catch (error) {
      next(error);
    }
  }
);
// Fetch order By Id
router.get(
  "/:id/id/dashboard",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};
      const { id } = req.params;

      if (!userId) {
        throw createError(statusCodes.badRequest, "User ID is required");
      }

      //   const order = await Order.findOne({
      //     _id: new mongoose.Types.ObjectId(id),
      //   }).populate("items.product");
      const query = mongoose.Types.ObjectId.isValid(id)
        ? { _id: new mongoose.Types.ObjectId(id) }
        : { orderNumber: id };

      const order = await mongoose.connection
        .collection("orders")
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "items",
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
          {
            $unwind: {
              path: "$store",
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .toArray();

      if (!order || order.length === 0) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      res.json(order[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Fetch orders by user Id
router.get(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};

      if (!userId) {
        throw createError(statusCodes.badRequest, "User ID is required");
      }

      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: { [key: string]: 1 | -1 } = {
        [sortBy as string]: sortOrder === "asc" ? 1 : -1,
      };

      const orders = await mongoose.connection
        .collection("orders")
        .aggregate([
          {
            $match: {
              "customer._id": new mongoose.Types.ObjectId(userId),
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
          { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },

          // Unwind items array so each item gets processed separately
          { $unwind: "$items" },

          // Lookup product details for each item
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "items.product",
            },
          },

          // Unwind product array (each product should have only one match)
          {
            $unwind: {
              path: "$items.product",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Group back into a single document with items as an array
          {
            $group: {
              _id: "$_id",
              store: { $first: "$store" },
              customer: { $first: "$customer" },
              items: { $push: "$items" }, // Reconstructing items array
              totalAmount: { $first: "$totalAmount" },
              paymentMethod: { $first: "$paymentMethod" },
              paymentStatus: { $first: "$paymentStatus" },
              status: { $first: "$status" },
              createdAt: { $first: "$createdAt" },
              orderNumber: { $first: "$orderNumber" },
              notes: { $first: "$notes" },
            },
          },

          { $sort: sortOptions },
          { $skip: skip },
          { $limit: Number(limit) },
        ])
        .toArray();

      res.json(orders);
    } catch (error) {
      next(error);
    }
  }
);

// Dashboard Fetch Product
router.get(
  "/all/dashboard",
  adminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: { [key: string]: 1 | -1 } = {
        [sortBy as string]: sortOrder === "asc" ? 1 : -1,
      };

      const orders = await mongoose.connection
        .collection("orders")
        .aggregate([
          {
            $lookup: {
              from: "stores",
              localField: "store",
              foreignField: "_id",
              as: "store",
            },
          },
          { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },

          // Unwind items array so each item gets processed separately
          { $unwind: "$items" },

          // Lookup product details for each item
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "items.product",
            },
          },

          // Unwind product array (each product should have only one match)
          {
            $unwind: {
              path: "$items.product",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Group back into a single document with items as an array
          {
            $group: {
              _id: "$_id",
              store: { $first: "$store" },
              customer: { $first: "$customer" },
              items: { $push: "$items" }, // Reconstructing items array
              totalAmount: { $first: "$totalAmount" },
              paymentMethod: { $first: "$paymentMethod" },
              paymentStatus: { $first: "$paymentStatus" },
              status: { $first: "$status" },
              createdAt: { $first: "$createdAt" },
              orderNumber: { $first: "$orderNumber" },
              notes: { $first: "$notes" },
            },
          },

          { $sort: sortOptions },
          { $skip: skip },
          { $limit: Number(limit) },
        ])
        .toArray();

      res.json(orders);
    } catch (error) {
      next(error);
    }
  }
);

// // Delete order
// router.delete(
//   "/:id",
//   auth,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { id } = req.params;

//       if (!id || !mongoose.Types.ObjectId.isValid(id)) {
//         throw createError(statusCodes.badRequest, "Invalid ID");
//       }

//       const result = await Order.deleteOne({
//         _id: new mongoose.Types.ObjectId(id),
//       });

//       if (result.deletedCount === 0) {
//         throw createError(statusCodes.notFound, "Order not found");
//       }

//       res.status(statusCodes.noContent).send();
//     } catch (error) {
//       next(error);
//     }
//   }
// );

export default router;
