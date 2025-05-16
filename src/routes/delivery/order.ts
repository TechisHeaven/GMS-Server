import express, { NextFunction, Request, Response } from "express";
import { deliveryAuth } from "../../middleware/auth";
import mongoose from "mongoose";
import { createError } from "../../utils/error.utilts";
import statusCodes from "../../utils/status.utils";
import Order from "../../models/Order";
const router = express.Router();

router.get(
  "/",
  deliveryAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        status,
      } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const sortOptions: { [key: string]: 1 | -1 } = {
        [sortBy as string]: sortOrder === "asc" ? 1 : -1,
      };
      const { userId } = req.user as { userId: string };

      // Build match conditions
      const matchConditions: any[] = [
        { status: { $ne: "pending" } },
        { status: { $ne: "order_confirmed" } },
      ];

      // If status is delivered or out_for_delivery, filter by current user
      if (status === "delivered" || status === "out_for_delivery") {
        matchConditions.push(
          { status },
          { deliveryPerson: new mongoose.Types.ObjectId(userId) }
        );
      } else if (status) {
        matchConditions.push({ status });
      }

      const orders = await mongoose.connection
        .collection("orders")
        .aggregate([
          {
            $match: {
              $and: matchConditions,
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
          { $unwind: "$items" },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "items.product",
            },
          },
          {
            $unwind: {
              path: "$items.product",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: "$_id",
              store: { $first: "$store" },
              customer: { $first: "$customer" },
              items: { $push: "$items" },
              totalAmount: { $first: "$totalAmount" },
              paymentMethod: { $first: "$paymentMethod" },
              paymentStatus: { $first: "$paymentStatus" },
              status: { $first: "$status" },
              createdAt: { $first: "$createdAt" },
              orderNumber: { $first: "$orderNumber" },
              notes: { $first: "$notes" },
              deliveryPerson: { $first: "$deliveryPerson" },
            },
          },
          { $sort: sortOptions },
          { $skip: skip },
          { $limit: Number(limit) },
        ])
        .toArray();

      res.json({ orders, message: "Orders fetched successfully" });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  "/:id",
  deliveryAuth,
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
        ? { _id: new mongoose.Types.ObjectId(id), status: { $ne: "pending" } }
        : { orderNumber: id, status: { $ne: "pending" } };

      const order = await mongoose.connection
        .collection("orders")
        .aggregate([
          { $match: query },
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
          // Unwind items to lookup product details for each item
          { $unwind: "$items" },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          {
            $unwind: {
              path: "$productDetails",
              preserveNullAndEmptyArrays: true,
            },
          },
          // Reconstruct items array with quantity and product details
          {
            $group: {
              _id: "$_id",
              store: { $first: "$store" },
              customer: { $first: "$customer" },
              totalAmount: { $first: "$totalAmount" },
              paymentMethod: { $first: "$paymentMethod" },
              paymentStatus: { $first: "$paymentStatus" },
              status: { $first: "$status" },
              createdAt: { $first: "$createdAt" },
              orderNumber: { $first: "$orderNumber" },
              notes: { $first: "$notes" },
              items: {
                $push: {
                  quantity: "$items.quantity",
                  product: "$productDetails",
                },
              },
            },
          },
        ])
        .toArray();

      if (!order || order.length === 0) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      res.json({ order: order[0], message: "Order fetched successfully" });
    } catch (error) {
      next(error);
    }
  }
);
router.put(
  "/:id/status",
  deliveryAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { userId } = req.user as { userId: string };
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw createError(statusCodes.badRequest, "Invalid order ID");
      }

      if (!status || typeof status !== "string") {
        throw createError(statusCodes.badRequest, "Status is required");
      }
      const allowedStatuses = ["out_for_delivery", "delivered", "cancelled"];

      if (!allowedStatuses.includes(status)) {
        throw createError(
          statusCodes.badRequest,
          `Invalid status. Allowed statuses are: ${allowedStatuses.join(", ")}`
        );
      }

      // Fetch the order first
      //   const order = await Order.findById(id);

      //   if (!order) {
      //     throw createError(statusCodes.notFound, "Order not found");
      //   }

      //   // If trying to pick up (set to out_for_delivery)
      //   if (status === "out_for_delivery") {
      //     if (order.status === "out_for_delivery") {
      //       return res.status(statusCodes.badRequest).json({
      //         message: "Order already picked up",
      //       });
      //     }
      //     if (order.deliveryPerson) {
      //       return res.status(statusCodes.badRequest).json({
      //         message: "Order already assigned to a delivery person",
      //       });
      //     }
      //     // Assign deliveryPerson if not already assigned
      //     order.deliveryPerson = userId;
      //   }

      //   order.status = status;

      const order = await Order.findById(id);

      if (!order) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      if (status === "out_for_delivery") {
        if (order.status === "out_for_delivery") {
          res.status(statusCodes.badRequest).json({
            message: "Order already picked up",
          });
          return;
        }
        if (order.deliveryPerson) {
          res.status(statusCodes.badRequest).json({
            message: "Order already assigned to a delivery person",
          });
          return;
        }
      }

      // Prepare update fields
      const updateFields: any = { status };

      if (status === "out_for_delivery") {
        updateFields.deliveryPerson = userId;
      }
      if (status === "delivered") {
        updateFields.paymentStatus = "paid";
      }
      if (status === "cancelled") {
        updateFields.paymentStatus = "failed";
      }

      //   // Update the order status and deliveryPerson/paymentStatus as needed
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      );

      // Update the order status and deliveryPerson
      //   const updatedOrder = await Order.findByIdAndUpdate(
      //     id,
      //     { status, deliveryPerson: userId },
      //     { new: true }
      //   );

      if (!updatedOrder) {
        throw createError(statusCodes.notFound, "Order not found");
      }

      // Populate store, customer, and items.product
      const populatedOrder = await Order.findById(updatedOrder._id)
        .populate("store")
        .populate("customer")
        .populate({
          path: "items.product",
          model: "Product",
        });

      if (!populatedOrder) {
        throw createError(statusCodes.notFound, "Order not found after update");
      }

      // Format items as array of { quantity, product }
      const formattedItems = populatedOrder.items.map((item: any) => ({
        quantity: item.quantity,
        product: item.product,
      }));

      res.json({
        message: "Order status updated successfully",
        order: {
          _id: populatedOrder._id,
          createdAt: populatedOrder.createdAt,
          customer: populatedOrder.customer,
          items: formattedItems,
          notes: populatedOrder.notes,
          orderNumber: populatedOrder.orderNumber,
          paymentMethod: populatedOrder.paymentMethod,
          paymentStatus: populatedOrder.paymentStatus,
          status: populatedOrder.status,
          store: populatedOrder.store,
          totalAmount: populatedOrder.totalAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
