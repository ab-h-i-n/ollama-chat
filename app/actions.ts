"use server";

// Define the return type for status to ensure consistency
export type InstanceStatus = {
  modelName: string;
  cloudModelName: string | null;
  hasCloudModel: boolean;
  publicIp: string | null;
};

export async function checkStatus(): Promise<InstanceStatus> {
  const modelName = process.env.OLLAMA_MODEL || "dolphin-llama3:8b";
  const hasCloudModel = !!process.env.NVIDIA_API_KEY;
  const cloudModelName = hasCloudModel ? "GPT-OSS-120B" : null;
  const publicIp = process.env.EC2_PUBLIC_IP || null;

  return {
    modelName,
    cloudModelName,
    hasCloudModel,
    publicIp,
  };
}

