import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { sql } from './config/db.js';
dotenv.config();

// ✅ Correct PagBank Sandbox endpoint (new API)
const SANDBOX_URL = 'https://sandbox.api.pagseguro.com/checkouts';
const TOKEN = process.env.PAGSEGURO_SANDBOX_TOKEN;

/**
 * Create a PagBank Checkout session
 */
export async function createCheckout(req, res) {
  try {
    const { referenceId, customer, items, redirectUrls } = req.body;

    // Validate required fields
    if (!referenceId || !customer || !items || items.length === 0) {
      console.error('❌ Missing required fields:', { referenceId, customer, items, redirectUrls });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!TOKEN) {
      console.error('❌ PAGSEGURO_SANDBOX_TOKEN not set in .env');
      return res.status(500).json({ success: false, message: 'PagBank API token missing' });
    }

    // ✅ Append referenceId to redirect URL for frontend success tracking
    const redirectUrl = `https://redirecturl-ppv3.onrender.com/redirect/success`;

    const payload = {
      reference_id: referenceId,
      customer,
      items,
      notification_urls: [process.env.PAGSEGURO_NOTIFICATION_URL],
      redirect_url: redirectUrl,
    };

    console.log('📦 Sending payload to PagBank API:\n', JSON.stringify(payload, null, 2));

    const response = await fetch(SANDBOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    // Try to parse JSON — fallback to HTML log if not possible
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('⚠️ PagBank returned non-JSON (likely an HTML error page):');
      console.error(text);
      return res.status(502).json({
        success: false,
        message: 'Invalid response from PagBank (HTML instead of JSON)',
      });
    }

    console.log('✅ PagBank API response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ PagBank API returned error:', data);
      return res.status(response.status).json({ success: false, data });
    }

    // Extract checkout URL
    const checkoutUrl = data.links?.find(l => l.rel === 'PAY')?.href || null;

    if (!checkoutUrl) {
      console.warn('⚠️ No checkout URL returned by PagBank.');
    }

    return res.status(200).json({
      success: true,
      checkoutUrl,
      data,
    });
  } catch (error) {
    console.error('💥 Error in createCheckout:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Create reservation and initiate payment
 */
export async function createReservationAndPayment(req, res) {
  try {
    const { quarto_id, hospedes, inicio, fim, preco_total, customer, items } = req.body;

    if (!quarto_id || !hospedes || !inicio || !fim || !preco_total || !customer || !items) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const referenceId = `reserva_${Date.now()}`;

    // Create reservation in the database with PENDING_PAYMENT status
    const [reservation] = await sql`
      INSERT INTO reservas (quarto_id, hospedes, inicio, fim, preco_total, reservado_em, status, reference_id)
      VALUES (${quarto_id}, ${hospedes}, ${inicio}, ${fim}, ${preco_total}, NOW(), 'PENDING_PAYMENT', ${referenceId})
      RETURNING *;
    `;

    // Call PagBank API to create checkout session
    const payload = {
      reference_id: referenceId,
      customer,
      items,
      notification_urls: [process.env.PAGSEGURO_NOTIFICATION_URL],
      redirect_url: `hotelbrasileiro://reservas/reservaFinish`,
    };

    const response = await fetch(SANDBOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.links) {
      console.error('PagBank error:', data);
      return res.status(500).json({ success: false, message: 'Failed to create PagBank checkout' });
    }

    const checkoutUrl = data.links.find((l) => l.rel === 'PAY')?.href;

    return res.status(200).json({ success: true, checkoutUrl });
  } catch (error) {
    console.error('Error creating reservation and payment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Handle PagBank payment notifications
 */
export async function handleNotification(req, res) {
  try {
    const notification = req.body;
    const referenceId = notification.reference_id;
    const status = notification.charges?.[0]?.status || 'UNKNOWN';

    if (!referenceId || !status) {
      return res.status(400).json({ success: false, message: 'Invalid notification payload' });
    }

    // Update reservation status in the database
    await sql`
      UPDATE reservas
      SET status = ${status}
      WHERE reference_id = ${referenceId};
    `;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Get payment status by reference ID
 */
export async function getPaymentStatus(req, res) {
  try {
    const { referenceId } = req.params;

    if (!referenceId) {
      return res.status(400).json({ success: false, message: 'Reference ID is required' });
    }

    const [reservation] = await sql`
      SELECT status FROM reservas WHERE reference_id = ${referenceId};
    `;

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    res.status(200).json({ success: true, status: reservation.status });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
