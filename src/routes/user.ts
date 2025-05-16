import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { createError } from "../utils/error.utilts";
import statusCodes from "../utils/status.utils";
import { adminAuth, auth } from "../middleware/auth";
import Order from "../models/Order";

const router = express.Router();

// Update User
router.put(
  "/",
  [
    body("address").optional(),
    body("phoneNumber").optional(),
    body("fullName").optional(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        throw createError(statusCodes.badRequest, "No token provided");
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw createError(statusCodes.badRequest, errors.array());
      }

      const {
        address,
        phoneNumber,
        fullName,
      }: { address?: string; phoneNumber?: string; fullName?: string } =
        req.body;

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw createError(statusCodes.notFound, "User not found");
      }
      if (address) {
        user.address = address as {
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pin?: string | null;
          country?: string | null;
        };
      } else {
        if (phoneNumber) user.phoneNumber = parseInt(phoneNumber, 10);
        if (fullName) user.fullName = fullName;
      }

      await user.save();

      res.json({
        message: "User updated successfully",
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          address: user.address,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Fetch Customers Who Bought Products
router.get(
  "/customers",
  adminAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      const storeId = user?.storeId;
      if (!storeId) {
        throw createError(statusCodes.badRequest, "Store ID not found");
      }
      // Fetch all orders for the store and populate customer
      const orders = await Order.find({ store: storeId }).populate("customer");

      // Map to store unique customers and aggregate their data
      const customerMap = new Map<
        string,
        {
          id: any;
          name: string;
          email: string;
          phone: string;
          shippingAddress: string;
          lastPurchased: Date;
          totalAmountRevenue: number;
        }
      >();

      for (const order of orders) {
        const customer = order.customer;
        if (!customer || !customer._id) continue;
        const customerId = customer._id.toString();

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customer._id,
            name: customer.name || "Unknown Name",
            email: customer.email || "Unknown Email",
            phone: customer.phone || "Unknown Phone Number",
            shippingAddress: customer.shippingAddress || "Unknown Address",
            lastPurchased: order.createdAt,
            totalAmountRevenue: order.totalAmount,
          });
        } else {
          const entry = customerMap.get(customerId)!;
          // Update lastPurchased if this order is newer
          if (order.createdAt > entry.lastPurchased) {
            entry.lastPurchased = order.createdAt;
          }
          // Add to totalAmountRevenue
          entry.totalAmountRevenue += order.totalAmount;
        }
      }

      const customers = Array.from(customerMap.values());

      res.json({
        message: "Customers fetched successfully",
        customers,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
