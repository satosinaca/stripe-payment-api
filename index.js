require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Stripe = require("stripe");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(express.json());

// Stripe webhook needs raw body
app.use(
  "/api/v1/stripe/webhook",
  bodyParser.raw({ type: "application/json" })
);

// CREATE DEPOSIT API
app.post("/api/v1/transaction/deposit-create", async (req, res) => {
  try {
    const { username, orderId, amount } = req.body;

    if (!username || !orderId || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Deposit",
              description: `User ${username}`
            },
            unit_amount: amount * 100
          },
          quantity: 1
        }
      ],
      metadata: { username, orderId },
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel"
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: "Stripe error" });
  }
});

// STRIPE WEBHOOK
app.post("/api/v1/stripe/webhook", (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send("Webhook error");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("PAYMENT SUCCESS:", session.metadata);
  }

  res.json({ received: true });
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
