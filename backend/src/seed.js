// Seeds the price list with items from the client's BOQ (Joyville, Manjri). Run: npm run seed
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Item } from './models/index.js';

const N = "No's";
const items = [
  ['Bauhinia blakeana', 'Tree', N], ['Michelia Champaca', 'Tree', N], ['Peltophorum Ferrugineum', 'Tree', N],
  ['Tabebuia rosea', 'Tree', N], ['Mimusops elengi', 'Tree', N], ['Terminalia mantaly', 'Tree', N],
  ['Plumeria obtusa (Singapore Plumeria)', 'Tree', N], ['Grafted Mango', 'Tree', N], ['Kagzi Lemon', 'Tree', N],
  ['Sapota', 'Tree', N], ['Guava', 'Tree', N], ['Papita plants', 'Plant', N],
  ['Garden Soil (Poyata / Red soil)', 'Soil', 'CUM'], ['Stone Gravels 100mm', 'Soil', 'CUM'],
  ['Neemcake Powder', 'Manure', 'KG'], ['Folidol Dust powder', 'Manure', 'KG'],
  ['FYM / Compost', 'Manure', 'Brass'], ['Vermicompost', 'Manure', 'KG'],
  ['Korean Carpet Lawn (Turfing)', 'Lawn', 'S.mt'], ['Semi automatic irrigation system', 'Irrigation', 'S.mt'],
  ['Tree shifting & plantation (pit 1x1x1 m, transport)', 'Service', N],
];

await connectDB(process.env.MONGO_URI);
for (const [name, category, unit] of items) {
  await Item.updateOne({ name }, { $setOnInsert: { name, category, unit, rate: 0 } }, { upsert: true });
}
console.log('Seeded', items.length, 'items');
await mongoose.disconnect();
