import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendChangeNotification({
  to,
  monitorName,
  monitorUrl,
  oldValue,
  newValue,
  type,
}: {
  to: string;
  monitorName: string;
  monitorUrl: string;
  oldValue: string;
  newValue: string;
  type: "webpage" | "youtube";
}) {
  const subject =
    type === "youtube"
      ? `🎬 New video on ${monitorName}`
      : `🔔 Change detected: ${monitorName}`;

  const html =
    type === "youtube"
      ? `
    <h2>New video detected!</h2>
    <p><strong>Channel:</strong> ${monitorName}</p>
    <p><strong>New video:</strong> ${newValue}</p>
    <p><a href="${monitorUrl}">View channel</a></p>
  `
      : `
    <h2>Value changed!</h2>
    <p><strong>Monitor:</strong> ${monitorName}</p>
    <p><strong>Previous value:</strong> ${oldValue || "(empty)"}</p>
    <p><strong>New value:</strong> ${newValue}</p>
    <p><a href="${monitorUrl}">View page</a></p>
  `;

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    html,
  });
}
