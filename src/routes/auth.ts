import express, { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { auth } from "../middleware/auth";
import { createError } from "../utils/error.utilts";
import statusCodes from "../utils/status.utils";

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

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw createError(statusCodes.badRequest, "User Already Exists");
      }

      const user = new User({
        email,
        password,
        fullName,
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

      const user = (await User.findOne({ email })) as any;
      if (!user) {
        throw createError(statusCodes.badRequest, "Invalid credentials");
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw createError(statusCodes.badRequest, "Invalid credentials");
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
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      throw createError(statusCodes.notFound, "User not found");
    }

    res.json({
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
});

export default router;
