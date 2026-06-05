import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

export const mochaHooks = {
  async beforeAll() {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  },
  async afterAll() {
    await mongoose.disconnect();
    await mongoServer.stop();
  },
};
