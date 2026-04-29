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

    // Store book IDs in metadata to retrieve after payment
    const bookIds = items.map(item => item.id).join(',');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/cart`,
      metadata: {
        book_ids: bookIds
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New route to retrieve session details and book files
router.get('/session/:id', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const bookIds = session.metadata.book_ids.split(',');
    
    // Get book details from Supabase using the IDs
    const supabase = require('../supabase');
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, file_url, cover_url')
      .in('id', bookIds);

    if (error) throw error;

    res.json({ books });
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
