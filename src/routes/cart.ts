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

// Add item to cart
router.post(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { product: productId, quantity } = req.body;

      const { userId } = req.user || {};

      if (!userId || !productId || !quantity) {
        return next(
          createError(statusCodes.badRequest, "Missing required fields")
        );
      }

      // Fetch the product to get the price
      const product = await mongoose.connection
        .collection("products")
        .findOne({ _id: new mongoose.Types.ObjectId(productId) });

      if (!product) {
        return next(createError(statusCodes.notFound, "Product not found"));
      }

      const price = product.price * quantity;

      const cartItem = {
        userId,
        product: new mongoose.Types.ObjectId(productId),
        quantity,
        price,
        createdAt: new Date(),
      };

      const result = await Cart.insertOne(cartItem);

      res.status(statusCodes.created).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Fetch cart items
router.get(
  "/",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user || {};

      if (!userId) {
        throw createError(statusCodes.badRequest, "User ID is required");
      }

      const cartItems = await mongoose.connection
        .collection("carts")
        .aggregate([
          { $match: { userId } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          {
            $lookup: {
              from: "stores",
              localField: "product.store",
              foreignField: "_id",
              as: "product.store",
            },
          },
          { $unwind: "$product.store" },
        ])
        .toArray();

      res.json(cartItems);
    } catch (error) {
      next(error);
    }
  }
);

// Delete cart item
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw createError(statusCodes.notFound, "Cart item ID is required");
      }
      if (!mongoose.Types.ObjectId.isValid(id))
        throw createError(statusCodes.badRequest, "Invalid ID");

      const result = await Cart.deleteOne({
        _id: new mongoose.Types.ObjectId(id),
      });

      if (result.deletedCount === 0) {
        throw createError(statusCodes.notFound, "Cart item not found");
      }

      res.status(statusCodes.noContent).send();
    } catch (error) {
      next(error);
    }
  }
);

// Update cart item
router.put(
  "/:id",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (!id) {
        throw createError(statusCodes.notFound, "Cart item ID is required");
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid ID");
      }
      if (!quantity) {
        throw createError(
          statusCodes.badRequest,
          "Quantity is required to update"
        );
      }

      // Fetch the cart item to get the product ID
      const cartItem = await Cart.findOne({
        _id: new mongoose.Types.ObjectId(id),
      });
      if (!cartItem) {
        throw createError(statusCodes.notFound, "Cart item not found");
      }

      // Fetch the product to get the price
      const product = await mongoose.connection
        .collection("products")
        .findOne({ _id: cartItem.product });
      if (!product) {
        throw createError(statusCodes.notFound, "Product not found");
      }

      const updatedPrice = product.price * quantity;

      const result = await Cart.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { quantity, price: updatedPrice } }
      );

      if (result.matchedCount === 0) {
        throw createError(statusCodes.notFound, "Cart item not found");
      }

      res
        .status(statusCodes.ok)
        .json({ message: "Cart item updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
