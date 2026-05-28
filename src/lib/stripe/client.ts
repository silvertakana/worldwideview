import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key", {
    apiVersion: "2026-05-27.dahlia",
});
