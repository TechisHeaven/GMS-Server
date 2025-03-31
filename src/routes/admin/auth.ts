import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { createError } from "../../utils/error.utilts";
import statusCodes from "../../utils/status.utils";
import Admin from "../../models/AdminUser";
import { auth } from "../../middleware/auth";
import mongoose from "mongoose";

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("fullName").notEmpty(),
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
      }: { email: string; password: string; fullName: string } = req.body;

      const existingUser = await Admin.findOne({ email });
      if (existingUser) {
        throw createError(statusCodes.badRequest, "User Already Exists");
      }

      const user = new Admin({
        email,
        password,
        fullName,
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

      const user = (await Admin.findOne({ email })) as any;
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
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw createError(statusCodes.badRequest, "No token provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    const user = await Admin.findById(decoded.userId).select("-password");
    if (!user) {
      throw createError(statusCodes.notFound, "User not found");
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        address: user.address,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get(
  "/store/me",
  auth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as {
        userId: string;
      };

      if (userId)
        throw createError(statusCodes.badRequest, "UnAuthenticated User");

      const user = await Admin.findById(userId).select("-password");
      if (!user) {
        throw createError(statusCodes.notFound, "User not found");
      }

      const store = await mongoose.connection
        .collection("stores")
        .aggregate([
          { $match: { user: new mongoose.Types.ObjectId(userId) } },
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

      res.json({
        store,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
