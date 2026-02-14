import { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstanceStatusCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

const REGION = process.env.AWS_REGION || "us-east-1";

export const ec2Client = new EC2Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY || "",
    secretAccessKey: process.env.MY_AWS_SECRET_KEY || "",
  },
});

export const INSTANCE_ID = process.env.EC2_INSTANCE_ID || "";

export async function startInstance() {
  if (!INSTANCE_ID) throw new Error("EC2_INSTANCE_ID is not defined");
  const command = new StartInstancesCommand({ InstanceIds: [INSTANCE_ID] });
  return await ec2Client.send(command);
}

export async function stopInstance() {
  if (!INSTANCE_ID) throw new Error("EC2_INSTANCE_ID is not defined");
  const command = new StopInstancesCommand({ InstanceIds: [INSTANCE_ID] });
  return await ec2Client.send(command);
}

export async function getInstanceStatus() {
  if (!INSTANCE_ID) throw new Error("EC2_INSTANCE_ID is not defined");
  
  // DescribeInstanceStatus often returns empty if instance is stopped, so we use DescribeInstances as well/instead
  const command = new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] });
  const response = await ec2Client.send(command);
  
  const instance = response.Reservations?.[0]?.Instances?.[0];
  if (!instance) return "unknown";

  return {
    state: instance.State?.Name || "unknown", // pending | running | shutting-down | terminated | stopping | stopped
    publicIp: instance.PublicIpAddress || null,
  };
}
