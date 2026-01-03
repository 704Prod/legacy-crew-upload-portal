const { app } = require("@azure/functions");
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.http("CreatePaymentIntent", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // Basic CORS support (safe default)
    if (request.method === "OPTIONS") {
      return {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      };
    }

    try {
      const body = await request.json();
      const amount = Number(body.amount);
      const currency = body.currency || "usd";

      if (!amount || Number.isNaN(amount)) {
        return {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing or invalid amount" }),
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        description: body.description,
        metadata: body.metadata,
        automatic_payment_methods: { enabled: true },
      });

      return {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      };
    } catch (err) {
      context.log("CreatePaymentIntent error:", err);
      return {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to create payment intent" }),
      };
    }
  },
});
