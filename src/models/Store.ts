import mongoose, { Schema, Document } from "mongoose";

export interface IStore extends Document {
  name: string;
  type: string;
  location?: string;
  contactNumber: string;
  openingTime: string;
  closingTime: string;
  rating?: number;
  description: string;
  image?: string;
  banner?: string;
  user: string;
  storeCode: string; // Store Code for joining
}

const StoreSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["grocery", "convenience", "supermart"],
      required: true,
    },
    location: { type: String, required: false, default: null },
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
    contactNumber: { type: String, required: true },
    rating: { type: Number, default: null },
    description: { type: String, required: true },
    image: { type: String, required: false, default: null },
    banner: { type: String, required: false, default: null },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true,
    },
    storeCode: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IStore>("Store", StoreSchema);
