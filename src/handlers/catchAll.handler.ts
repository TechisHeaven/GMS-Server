import { NextFunction, Request, Response } from "express";
import statusCodes from "../utils/status.utils";

export default (req: Request, res: Response) => {
  res
    .status(statusCodes.notFound)
    .json({ error: true, success: false, message: "404 Not Found" });
};
