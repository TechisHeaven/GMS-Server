import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import statusCodes from "../utils/status.utils";
import { createError } from "../utils/error.utilts";
import { auth } from "../middleware/auth";
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
router.post(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};
      const { store, customer, items, totalAmount, paymentMethod, notes } =
        req.body;

      if (
        !userId ||
        !store ||
        !customer ||
        !items ||
        !totalAmount ||
        !paymentMethod
      ) {
        return next(
          createError(statusCodes.badRequest, "Missing required fields")
        );
      }

      if (items.length <= 0)
        throw createError(statusCodes.badRequest, "Items are required");

      // Check if all product IDs in items exist in the products collection
      const productIds = items.map((item: { product: string }) => item.product);

      const existingProducts = await mongoose.connection
        .collection("products")
        .find({
          _id: {
            $in: productIds.map(
              (id: string) => new mongoose.Types.ObjectId(id)
            ),
          },
        })
        .toArray();

      if (existingProducts.length !== productIds.length) {
        throw createError(
          statusCodes.badRequest,
          "One or more products in the items do not exist"
        );
      }

      // Validate items structure
      if (
        !customer ||
        !customer.name ||
        !customer.phone ||
        typeof customer.name !== "string" ||
        typeof customer.phone !== "string"
      ) {
        return next(
          createError(statusCodes.badRequest, "Invalid customer structure")
        );
      }

      if (
        !Array.isArray(items) ||
        items.some((item) => !item.product || !item.quantity || !item.price)
      ) {
        return next(
          createError(statusCodes.badRequest, "Invalid items structure")
        );
      }

      const order = new Order({
        store,
        customer,
        items,
        totalAmount,
        paymentMethod,
        notes,
        paymentStatus: "pending", // Initial status before Razorpay verification
        createdAt: new Date(),
      });

      const result = await order.save();

      res.status(statusCodes.created).json(result);
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
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid ID");
      }

      //   const order = await Order.findOne({
      //     _id: new mongoose.Types.ObjectId(id),
      //   }).populate("items.product");
      const order = await mongoose.connection
        .collection("orders")
        .aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(id) } },
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
              as: "storeDetails",
            },
          },
          {
            $unwind: {
              path: "$storeDetails",
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
              as: "storeDetails",
            },
          },
          {
            $unwind: {
              path: "$storeDetails",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $sort: sortOptions,
          },
          {
            $skip: skip,
          },
          {
            $limit: Number(limit),
          },
        ])
        .toArray();

      res.json(orders);
    } catch (error) {
      next(error);
    }
  }
);

// Generate Razorpay order ID
router.post(
  "/:id/create-payment",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid order ID");
      }

      const order = await Order.findById(id);
      if (!order) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      //   const razorpayOrder = await razorpay.orders.create({
      //     amount: order.totalAmount * 100, // Convert to paise
      //     currency: "INR",
      //     receipt: order._id.toString(),
      //     payment_capture: true,
      //   });

      //   const payment = new Payment({
      //     orderId: order._id,
      //     razorpayOrderId: razorpayOrder.id,
      //   });

      //   await payment.save();

      const razorpayOrder = "";
      res.json({ message: "Razorpay order created", razorpayOrder });
    } catch (error) {
      next(error);
    }
  }
);

// Verify Razorpay payment and update order status
router.post(
  "/:id/verify-payment",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } =
        req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid order ID");
      }

      const order = await Order.findById(id);
      if (!order) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      const payment = await Payment.findOne({ razorpayOrderId });
      if (!payment) throw createError(404, "Payment not found");

      // Verify Razorpay Signature
      const crypto = require("crypto");
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        payment.status = "failed";
        await payment.save();
        throw createError(400, "Invalid Razorpay signature");
      }

      // Update payment and order status
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = "completed";
      await payment.save();

      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: "paid",
      });

      res.json({ message: "Payment verified successfully", order });
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
