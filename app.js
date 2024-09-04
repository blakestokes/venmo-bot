import venmo from './venmo.js';
import * as dotenv from 'dotenv';

dotenv.config();

const amount = 10;
// Can include multiple users
const users = ["@User-Venmo-Id"];
const note = 'Test Note';

venmo.request({
  "amount": amount,
  "users": users,
  "note": note
});