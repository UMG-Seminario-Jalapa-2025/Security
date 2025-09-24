
import express from 'express';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './utils/errorHandler.js';

const app = express();
app.use(express.json());

app.use(adminRoutes);
app.use(errorHandler);

app.listen(process.env.PORT || 8084, () => console.log(`API admin lista en :${process.env.PORT || 8084}`));
