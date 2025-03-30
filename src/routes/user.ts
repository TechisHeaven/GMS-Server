import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { createError } from "../utils/error.utilts";
import statusCodes from "../utils/status.utils";

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

export default router;
