// Starter price list (from the Joyville, Manjri BOQ), copied into every new client account
const N = "No's";
export const DEFAULT_ITEMS = [
  ['Bauhinia blakeana', 'Tree', N], ['Michelia Champaca', 'Tree', N], ['Peltophorum Ferrugineum', 'Tree', N],
  ['Tabebuia rosea', 'Tree', N], ['Mimusops elengi', 'Tree', N], ['Terminalia mantaly', 'Tree', N],
  ['Plumeria obtusa (Singapore Plumeria)', 'Tree', N], ['Grafted Mango', 'Tree', N], ['Kagzi Lemon', 'Tree', N],
  ['Sapota', 'Tree', N], ['Guava', 'Tree', N], ['Papita plants', 'Plant', N],
  ['Garden Soil (Poyata / Red soil)', 'Soil', 'CUM'], ['Stone Gravels 100mm', 'Soil', 'CUM'],
  ['Neemcake Powder', 'Manure', 'KG'], ['Folidol Dust powder', 'Manure', 'KG'],
  ['FYM / Compost', 'Manure', 'Brass'], ['Vermicompost', 'Manure', 'KG'],
  ['Korean Carpet Lawn (Turfing)', 'Lawn', 'S.mt'], ['Semi automatic irrigation system', 'Irrigation', 'S.mt'],
  ['Tree shifting & plantation (pit 1x1x1 m, transport)', 'Service', N],
].map(([name, category, unit]) => ({ name, category, unit, rate: 0 }));
