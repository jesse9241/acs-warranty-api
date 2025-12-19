// email.js
const nodemailer = require("nodemailer");

// Sanity check env vars
["EMAIL_USER", "EMAIL_PASS", "SUPPORT_EMAIL"].forEach(v => {
  if (!process.env[v]) {
    throw new Error(`Missing environment variable: ${v}`);
  }
});

// Gmail App Password transport (recommended)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendWarrantyEmail(data) {
  const mailOptions = {
    from: `"ACS Warranty" <${process.env.EMAIL_USER}>`,
    to: process.env.SUPPORT_EMAIL,
    replyTo: data.customerEmail,
    subject: `New Warranty Claim – ${data.customerName}`,
    text: `
New warranty claim submitted:

Customer: ${data.customerName}
Email: ${data.customerEmail}
Phone: ${data.customerPhone || "N/A"}
Source: ${data.source}

Original Order #: ${data.originalOrderNumber}
Original Warranty #: ${data.originalWarrantyNumber}

Product: ${data.product}
UPC: ${data.upc || "N/A"}

Issue:
${data.issueDescription}

Notes:
${data.notes || "None"}
`
  };

  await transporter.sendMail(mailOptions);
  console.log("📧 Warranty email sent for:", data.customerName);
}

module.exports = { sendWarrantyEmail };
