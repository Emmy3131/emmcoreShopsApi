const nodemailer = require("nodemailer");

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.url = url;

    // FIXED
    this.firstName = user.firstName || "User";
  }

  // ================= TRANSPORT =================
  createTransport() {
    return nodemailer.createTransport({
      service: "gmail",

      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // ================= SEND EMAIL =================
  async send(subject, message) {
    const mailOptions = {
      from: `EmmCoreShops <${process.env.EMAIL_USERNAME}>`,
      to: this.to,
      subject,
      text: message,
    };

    await this.createTransport().sendMail(mailOptions);
  }

  // ================= PASSWORD RESET =================
  async sendPasswordReset() {
    await this.send(
      "Reset your password",

      `Hello ${this.firstName},

Click the link below to reset your password:

${this.url}

If you did not request this, ignore this email.`
    );
  }
};