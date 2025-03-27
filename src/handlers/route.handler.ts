import { Request, Response, NextFunction } from "express";

const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";
  res.status(status).json({ success: false, error: true, status, message });
};

export default errorHandler;
