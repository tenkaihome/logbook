const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log('Stripe Key Loaded:', process.env.STRIPE_SECRET_KEY ? 'Yes (starts with ' + process.env.STRIPE_SECRET_KEY.slice(0, 7) + ')' : 'No');

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body;

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title,
          images: [item.cover_url],
        },
        unit_amount: Math.round(parseFloat(item.price.replace('$', '')) * 100),
      },
      quantity: item.quantity,
    }));

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${frontendUrl}/success`,
      cancel_url: `${frontendUrl}/cart`,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
