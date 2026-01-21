require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Stripe = require("stripe");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------- MIDDLEWARE ----------
app.use(express.json());

// Stripe webhook needs RAW body
app.use(
  "/api/v1/stripe/webhook",
  bodyParser.raw({ type: "application/json" })
);

// ---------- CREATE DEPOSIT ----------
app.post("/api/v1/transaction/deposit-create", async (req, res) => {
  try {
    const { username, orderId, amount } = req.body;

    if (!username || !orderId || !amount) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: `${username}@example.com`,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Account Deposit",
              description: `Deposit for user ${username}`
            },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        username,
        orderId
      },
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`
    });

    return res.json({
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error("Deposit error:", error);
    return res.status(500).json({
      error: "Failed to create checkout session"
    });
  }
});

// ---------- STRIPE WEBHOOK ----------
app.post("/api/v1/stripe/webhook", (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const username = session.metadata.username;
    const orderId = session.metadata.orderId;
    const amountPaid = session.amount_total / 100;

    console.log("✅ PAYMENT CONFIRMED");
    console.log({
      username,
      orderId,
      amountPaid,
      stripeSessionId: session.id
    });

    // 👉 HERE you should:
    // - Mark order as PAID
    // - Credit user balance
    // - Store transaction in database
  }

  res.json({ received: true });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
