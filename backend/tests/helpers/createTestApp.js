// backend/tests/helpers/createTestApp.js
import express from 'express';
import cors from 'cors';
import authRoute from '../../src/routes/auth.route.js';
import homestayRoute from '../../src/routes/homestay.route.js';
import ownerRoute from '../../src/routes/owner.route.js';
import bookingRoute from '../../src/routes/booking.route.js';
import complaintRoute from '../../src/routes/complaint.route.js';
import adminRoute from '../../src/routes/admin.route.js';

/**
 * Creates an isolated Express application instance configured with all routes
 * for integration testing, without starting a persistent network listener.
 */
export function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Chào mừng đến với Homestay API!');
  });

  app.use('/api/auth', authRoute);
  app.use('/api/homestays', homestayRoute);
  app.use('/api/owner', ownerRoute);
  app.use('/api/bookings', bookingRoute);
  app.use('/api/complaints', complaintRoute);
  app.use('/api/admin', adminRoute);

  return app;
}

