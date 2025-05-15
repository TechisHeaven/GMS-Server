import jwt from "jsonwebtoken";
import User from "../models/User";
import { NextFunction, Request, Response } from "express";
import { createError } from "../utils/error.utilts";
import statusCodes from "../utils/status.utils";
import Admin from "../models/AdminUser";

export const auth = async (req: any, res: any, next: NextFunction) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw createError(statusCodes.unauthorized, "Authentication required");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (err) {
      throw createError(statusCodes.unauthorized, "Invalid Token");
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      throw createError(statusCodes.unauthorized, "User not found");
    }

    req.user = { userId: user._id };
    next();
  } catch (error) {
    next(error);
    // throw createError(statusCodes.unauthorized, "Invalid Token");
  }
};
export const adminAuth = async (req: any, res: any, next: NextFunction) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw createError(statusCodes.unauthorized, "Authentication required");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (err) {
      throw createError(statusCodes.unauthorized, "Invalid Token");
    }

    const user = await Admin.findById(decoded.userId);

    if (!user) {
      throw createError(statusCodes.unauthorized, "User not found");
    }

    req.user = { userId: user._id, storeId: user.store };
    next();
  } catch (error) {
    next(error);
    // throw createError(statusCodes.unauthorized, "Invalid Token");
  }
};

export const checkRole = (roles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      throw createError(statusCodes.forbidden, "Access Denied");
    }
    next();
  };
};
