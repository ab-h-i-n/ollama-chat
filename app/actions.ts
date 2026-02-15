"use server";

import { startInstance, stopInstance, getInstanceStatus } from "@/lib/aws";

// Define the return type for status to ensure consistency
export type InstanceStatus = {
  state: "pending" | "running" | "shutting-down" | "terminated" | "stopping" | "stopped" | "unknown";
  publicIp: string | null;
  modelName: string;
  cloudModelName: string | null;
  hasCloudModel: boolean;
};

export async function toggleInstance(action: "start" | "stop", password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || password !== adminPassword) {
    return { success: false, error: "Invalid password" };
  }

  try {
    if (action === "start") {
      await startInstance();
    } else {
      await stopInstance();
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle instance:", error);
    return { success: false, error: "Failed to perform action" };
  }
}

export async function checkStatus(): Promise<InstanceStatus> {
  const modelName = process.env.OLLAMA_MODEL || "dolphin-llama3:8b";
  const hasCloudModel = !!process.env.HF_TOKEN;
  const cloudModelName = hasCloudModel ? "Kimi-K2.5" : null;

  try {
    const status = await getInstanceStatus();
    if (typeof status === "string") {
      return { state: "unknown", publicIp: null, modelName, cloudModelName, hasCloudModel };
    }
    return {
      state: (status.state as InstanceStatus["state"]) || "unknown",
      publicIp: status.publicIp,
      modelName,
      cloudModelName,
      hasCloudModel,
    };
  } catch (error) {
    console.error("Failed to check status:", error);
    return { state: "unknown", publicIp: null, modelName, cloudModelName, hasCloudModel };
  }
}

