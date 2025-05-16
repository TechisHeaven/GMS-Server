import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { createError } from "../../utils/error.utilts";
import statusCodes from "../../utils/status.utils";
import Delivery from "../../models/DeliveryUser";
import { auth, deliveryAuth } from "../../middleware/auth";
import mongoose from "mongoose";

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("phone").notEmpty(),
    body("fullName").notEmpty(),
    body("vehicle").optional(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw createError(statusCodes.badRequest, errors.array());
      }

      const {
        email,
        password,
        fullName,
        vehicle,
      }: {
        email: string;
        password: string;
        fullName: string;
        vehicle: string;
      } = req.body;

      const existingUser = await Delivery.findOne({ email });
      if (existingUser) {
        throw createError(statusCodes.badRequest, "User Already Exists");
      }

      const user = new Delivery({
        email,
        password,
        fullName,
        vehicle,
        role: "user",
      });

      await user.save();

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "24h",
      });

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          vehicle: user.vehicle,
          role: "user",
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw createError(statusCodes.badRequest, errors.array());
      }

      const { email, password }: { email: string; password: string } = req.body;

      const user = (await Delivery.findOne({ email })) as any;
      if (!user) {
        throw createError(statusCodes.badRequest, "User doesn't exists.");
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw createError(statusCodes.badRequest, "Wrong password");
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "24h",
      });

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          vehicle: user.vehicle,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/me",
  deliveryAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as { userId: string };

      const user = await Delivery.findById(userId).select("-password");
      if (!user) {
        throw createError(statusCodes.notFound, "User not found");
      }

      res.json({
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
