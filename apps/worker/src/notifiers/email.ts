import nodemailer from "nodemailer";

interface EmailConfig {
  to: string;
}

interface NotificationPayload {
  monitorName: string;
  oldValue: string;
  newValue: string;
  url: string;
  eventType: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendEmailNotification(
  config: EmailConfig,
  payload: NotificationPayload
): Promise<boolean> {
  const isYouTube = payload.eventType.startsWith("youtube.");
  const subject = isYouTube
    ? `🎬 New video on ${payload.monitorName}`
    : `🔔 Change detected: ${payload.monitorName}`;

  const html = `
    <h2>${isYouTube ? "New video detected!" : "Value changed!"}</h2>
    <p><strong>${isYouTube ? "Channel" : "Monitor"}:</strong> ${payload.monitorName}</p>
    ${!isYouTube ? `<p><strong>Previous value:</strong> ${payload.oldValue || "(empty)"}</p>` : ""}
    <p><strong>${isYouTube ? "New video" : "New value"}:</strong> ${payload.newValue}</p>
    <p><a href="${payload.url}">View ${isYouTube ? "channel" : "page"}</a></p>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: config.to,
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}
