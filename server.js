const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'gifts.json');

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { recipients: [], ideas: [], settings: { pinHash: null } };
  }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ---- PIN Lock ----
function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

app.post('/api/lock/set-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{4,6}$/.test(String(pin))) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }
  db.settings = db.settings || {};
  db.settings.pinHash = hashPin(pin);
  saveData(db);
  res.json({ success: true });
});

app.post('/api/lock/unlock', (req, res) => {
  const { pin } = req.body;
  const expected = db.settings?.pinHash;
  if (!expected) return res.json({ unlocked: true });
  res.json({ unlocked: hashPin(String(pin)) === expected });
});

app.post('/api/lock/clear-pin', (req, res) => {
  db.settings = db.settings || {};
  db.settings.pinHash = null;
  saveData(db);
  res.json({ success: true });
});

// ---- Recipients ----
app.get('/api/recipients', (req, res) => {
  res.json(db.recipients);
});

app.post('/api/recipients', (req, res) => {
  const { name, relationship, age, interests, dislikes, allergies, budget } = req.body;
  if (!name || !relationship) {
    return res.status(400).json({ error: 'Name and relationship are required' });
  }
  const recipient = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    relationship: String(relationship).trim(),
    age: age ? parseInt(age) : null,
    interests: Array.isArray(interests) ? interests.map(String) : [],
    dislikes: Array.isArray(dislikes) ? dislikes.map(String) : [],
    allergies: Array.isArray(allergies) ? allergies.map(String) : [],
    budget: Number(budget) || 0,
  };
  db.recipients.push(recipient);
  saveData(db);
  res.status(201).json(recipient);
});

app.put('/api/recipients/:id', (req, res) => {
  const r = db.recipients.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { name, relationship, age, interests, dislikes, allergies, budget } = req.body;
  if (name) r.name = String(name).trim();
  if (relationship) r.relationship = String(relationship).trim();
  r.age = age ? parseInt(age) : null;
  r.interests = Array.isArray(interests) ? interests.map(String) : r.interests;
  r.dislikes = Array.isArray(dislikes) ? dislikes.map(String) : r.dislikes;
  r.allergies = Array.isArray(allergies) ? allergies.map(String) : r.allergies;
  r.budget = budget !== undefined ? Number(budget) : r.budget;
  saveData(db);
  res.json(r);
});

app.delete('/api/recipients/:id', (req, res) => {
  const idx = db.recipients.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = db.recipients.splice(idx, 1);
  db.ideas = db.ideas.filter(i => i.recipientId !== removed.id);
  saveData(db);
  res.json({ success: true });
});

// ---- Gift Ideas ----
const GIFT_CATALOG = [
  { name: 'Artisan Coffee Sampler', category: 'Food & Drink', basePrice: 25, tags: ['coffee', 'food', 'drink', 'gourmet'], reason: 'For the coffee lover who enjoys trying new blends' },
  { name: 'Cozy Wool Throw Blanket', category: 'Home', basePrice: 45, tags: ['cozy', 'home', 'comfort'], reason: 'Perfect for snuggling up during the winter months' },
  { name: 'Bestseller Novel Collection', category: 'Books', basePrice: 30, tags: ['reading', 'books', 'literature'], reason: 'Great for anyone who loves to get lost in a good story' },
  { name: 'Yoga Mat & Accessories Set', category: 'Fitness', basePrice: 55, tags: ['fitness', 'yoga', 'wellness', 'exercise'], reason: 'Supports an active, mindful lifestyle' },
  { name: 'Gardening Tool Kit', category: 'Hobbies', basePrice: 40, tags: ['gardening', 'outdoors', 'hobbies', 'plants'], reason: 'Ideal for green thumbs who love spending time outdoors' },
  { name: 'Gourmet Chocolate Box', category: 'Food & Drink', basePrice: 20, tags: ['chocolate', 'sweets', 'food', 'dessert'], reason: 'A sweet treat for any occasion' },
  { name: 'Puzzle Set (1000pc)', category: 'Hobbies', basePrice: 18, tags: ['puzzles', 'games', 'brain', 'family'], reason: 'Fun for the whole family on cozy nights in' },
  { name: 'Wireless Bluetooth Speaker', category: 'Tech', basePrice: 60, tags: ['music', 'tech', 'gadgets', 'audio'], reason: 'Great sound for music lovers on the go' },
  { name: 'Board Game Night Bundle', category: 'Games', basePrice: 35, tags: ['games', 'family', 'fun', 'kids'], reason: 'Brings everyone together for fun game nights' },
  { name: 'Plush Teddy Bear', category: 'Kids', basePrice: 15, tags: ['kids', 'plush', 'toy', 'cute'], reason: 'A soft, huggable companion for little ones' },
  { name: 'LEGO Building Set', category: 'Kids', basePrice: 50, tags: ['kids', 'building', 'creative', 'toy', 'lego'], reason: 'Sparks creativity and hours of fun building' },
  { name: 'Coloring Book & Marker Set', category: 'Kids', basePrice: 12, tags: ['kids', 'art', 'coloring', 'creative'], reason: 'Encourages artistic expression in young minds' },
  { name: 'Science Experiment Kit', category: 'Kids', basePrice: 30, tags: ['kids', 'science', 'education', 'stem', 'learning'], reason: 'Makes learning fun with hands-on experiments' },
  { name: 'Scented Candle Set', category: 'Home', basePrice: 28, tags: ['candles', 'home', 'cozy', 'relaxation'], reason: 'Creates a warm, relaxing atmosphere at home' },
  { name: 'Cooking Class Gift Card', category: 'Experience', basePrice: 75, tags: ['cooking', 'food', 'experience', 'class'], reason: 'A memorable experience for the food enthusiast' },
  { name: 'Spa Gift Basket', category: 'Self Care', basePrice: 40, tags: ['spa', 'self-care', 'relaxation', 'bath'], reason: 'A pampering treat for someone who deserves relaxation' },
  { name: 'Fitness Tracker', category: 'Tech', basePrice: 80, tags: ['fitness', 'tech', 'health', 'wearable'], reason: 'Helps track activity and stay motivated' },
  { name: 'Movie Night Gift Box', category: 'Food & Drink', basePrice: 35, tags: ['movies', 'popcorn', 'snacks', 'cozy', 'night'], reason: 'Everything needed for the perfect movie night in' },
  { name: 'Personalized Photo Frame', category: 'Personalized', basePrice: 25, tags: ['personalized', 'photo', 'memories', 'home'], reason: 'A meaningful way to display cherished memories' },
  { name: 'Cookbook by Favorite Chef', category: 'Books', basePrice: 22, tags: ['cooking', 'books', 'food', 'recipes'], reason: 'Inspires new culinary adventures in the kitchen' },
  { name: 'Hiking Backpack', category: 'Outdoors', basePrice: 65, tags: ['hiking', 'outdoors', 'adventure', 'travel'], reason: 'Built for adventure on the trails' },
  { name: 'Waterproof Bluetooth Speaker', category: 'Tech', basePrice: 45, tags: ['music', 'tech', 'outdoors', 'waterproof'], reason: 'Takes the music anywhere, even by the pool or beach' },
  { name: 'Knitting Kit', category: 'Hobbies', basePrice: 35, tags: ['knitting', 'crafts', 'hobbies', 'diy'], reason: 'Perfect for crafty hands who love creating' },
  { name: 'Art Supply Set', category: 'Art', basePrice: 40, tags: ['art', 'drawing', 'painting', 'creative'], reason: 'Everything an aspiring artist needs to create' },
  { name: 'Pet Lover Gift Set', category: 'Pets', basePrice: 30, tags: ['pets', 'animals', 'dog', 'cat'], reason: 'For the animal lover in your life' },
  { name: 'Hot Cocoa Gift Set', category: 'Food & Drink', basePrice: 20, tags: ['cocoa', 'hot chocolate', 'cozy', 'winter', 'drink'], reason: 'Warm winter treat for chilly evenings' },
  { name: 'Daily Gratitude Journal', category: 'Books', basePrice: 15, tags: ['journal', 'gratitude', 'mindfulness', 'writing'], reason: 'Encourages daily reflection and positivity' },
  { name: 'Plant Care Kit', category: 'Hobbies', basePrice: 35, tags: ['plants', 'gardening', 'home', 'green'], reason: 'Helps keep indoor plants thriving' },
  { name: 'Wireless Earbuds', category: 'Tech', basePrice: 70, tags: ['tech', 'audio', 'music', 'wireless'], reason: 'Premium sound without the tangled cords' },
  { name: 'Board Game Strategy Guide', category: 'Books', basePrice: 18, tags: ['games', 'strategy', 'books', 'board games'], reason: 'Level up game night with expert tips' },
  { name: 'Kids Science Kit', category: 'Kids', basePrice: 25, tags: ['kids', 'science', 'stem', 'experiments', 'learning'], reason: 'Hands-on learning that makes science exciting' },
  { name: 'Stuffed Animal Collection', category: 'Kids', basePrice: 20, tags: ['kids', 'plush', 'toy', 'stuffed', 'cute'], reason: 'Cuddly friends for imaginative play' },
  { name: 'Outdoor Adventure Kit', category: 'Outdoors', basePrice: 50, tags: ['outdoors', 'adventure', 'hiking', 'camping'], reason: 'Ready for any outdoor adventure' },
  { name: 'Gourmet Tea Collection', category: 'Food & Drink', basePrice: 30, tags: ['tea', 'gourmet', 'drink', 'food', 'relaxation'], reason: 'A soothing collection for tea enthusiasts' },
  { name: 'Smart Home Device', category: 'Tech', basePrice: 50, tags: ['tech', 'smart home', 'gadgets', 'home'], reason: 'Makes everyday life a little easier' },
  { name: 'Baking Kit for Kids', category: 'Kids', basePrice: 22, tags: ['kids', 'baking', 'cooking', 'creative', 'fun'], reason: 'Fun kitchen adventures for little chefs' },
  { name: 'DIY Craft Kit', category: 'Hobbies', basePrice: 28, tags: ['crafts', 'diy', 'creative', 'art', 'hobbies'], reason: 'Unleash creativity with hands-on projects' },
  { name: 'Weighted Blanket', category: 'Home', basePrice: 55, tags: ['cozy', 'home', 'comfort', 'sleep', 'relaxation'], reason: 'Promotes relaxation and better sleep' },
  { name: 'Cookbook Collection', category: 'Books', basePrice: 35, tags: ['cooking', 'books', 'food', 'recipes', 'kitchen'], reason: 'Inspires new dishes and kitchen creativity' },
  { name: 'Fitness Dumbbell Set', category: 'Fitness', basePrice: 45, tags: ['fitness', 'exercise', 'gym', 'health', 'workout'], reason: 'Perfect for home workouts and strength training' },
  { name: 'Kids Art Supply Box', category: 'Kids', basePrice: 18, tags: ['kids', 'art', 'creative', 'drawing', 'coloring'], reason: 'Endless creative fun for young artists' },
  { name: 'Personalized Mug', category: 'Personalized', basePrice: 16, tags: ['personalized', 'mug', 'coffee', 'gift'], reason: 'A thoughtful, practical daily reminder of your love' },
  { name: 'Music Streaming Subscription', category: 'Tech', basePrice: 10, tags: ['music', 'streaming', 'subscription', 'audio'], reason: 'Endless music for every mood and moment' },
  { name: 'Garden Flower Seeds Collection', category: 'Hobbies', basePrice: 12, tags: ['gardening', 'flowers', 'plants', 'outdoors', 'seeds'], reason: 'Brings color and life to any garden' },
  { name: 'Comic Book Collection', category: 'Books', basePrice: 25, tags: ['comics', 'books', 'superhero', 'reading'], reason: 'Epic adventures for the comic book fan' },
  { name: 'Yoga Block & Strap Set', category: 'Fitness', basePrice: 20, tags: ['yoga', 'fitness', 'wellness', 'stretching'], reason: 'Deepens practice and improves flexibility' },
  { name: 'Kids Building Blocks', category: 'Kids', basePrice: 30, tags: ['kids', 'building', 'creative', 'blocks', 'toy'], reason: 'Imaginative construction play for growing minds' },
  { name: 'Gourmet Spice Collection', category: 'Food & Drink', basePrice: 28, tags: ['spices', 'cooking', 'food', 'gourmet', 'kitchen'], reason: 'Elevates every dish with premium flavors' },
  { name: 'Photo Album Scrapbook', category: 'Personalized', basePrice: 22, tags: ['personalized', 'photos', 'memories', 'scrapbook'], reason: 'A beautiful way to preserve precious memories' },
  { name: 'Hiking Boots', category: 'Outdoors', basePrice: 85, tags: ['hiking', 'outdoors', 'shoes', 'adventure', 'boots'], reason: 'Sturdy, comfortable footwear for every trail' },
];

function getRemainingBudget(recipient) {
  const spent = (db.ideas || [])
    .filter(i => i.recipientId === recipient.id && i.status !== 'Idea')
    .reduce((sum, i) => sum + (Number(i.actualPrice) || Number(i.price) || 0), 0);
  return Math.max(0, (Number(recipient.budget) || 0) - spent);
}

function generateIdeasFor(recipient, maxBudget) {
  const remaining = maxBudget !== undefined ? maxBudget : getRemainingBudget(recipient);
  const tags = (recipient.interests || []).map(s => String(s).toLowerCase());
  const dislikes = (recipient.dislikes || []).map(s => String(s).toLowerCase());
  const allergies = (recipient.allergies || []).map(s => String(s).toLowerCase());
  const isKid = recipient.age !== null && recipient.age < 18;

  const candidates = GIFT_CATALOG.map(g => {
    let score = 0;
    const gTags = g.tags.map(t => t.toLowerCase());
    for (const tag of tags) {
      if (gTags.some(t => t.includes(tag) || tag.includes(t))) score += 3;
    }
    if (isKid && g.tags.includes('kids')) score += 3;
    if (!isKid && g.category === 'Kids') score -= 5;
    // Penalize if in dislikes/allergies (simple substring match on name)
    const hay = (g.name + ' ' + g.tags.join(' ')).toLowerCase();
    for (const d of [...dislikes, ...allergies]) {
      if (hay.includes(d.toLowerCase())) score -= 10;
    }
    // Fit budget: prefer closer to remaining
    if (g.basePrice <= remaining) score += 2;
    if (g.basePrice > remaining) score -= 5;
    // Slight preference for variety
    if (g.category === 'Books' || g.category === 'Food & Drink') score += 0.5;
    return { ...g, score, matchedTags: tags.filter(t => g.tags.some(gt => gt.includes(t) || t.includes(gt))) };
  }).filter(c => c.score > 0 && c.basePrice <= remaining);

  candidates.sort((a, b) => b.score - a.score);

  // Pick top 4 diverse
  const selected = [];
  const usedCategories = new Set();
  for (const c of candidates) {
    if (selected.length >= 4) break;
    if (!usedCategories.has(c.category)) {
      selected.push(c);
      usedCategories.add(c.category);
    }
  }
  for (const c of candidates) {
    if (selected.length >= 4) break;
    if (!selected.find(s => s.name === c.name)) {
      selected.push(c);
      usedCategories.add(c.category);
    }
  }

  return selected.map((c, i) => ({
    id: crypto.randomUUID(),
    recipientId: recipient.id,
    name: c.name,
    category: c.category,
    price: c.basePrice,
    reason: c.reason + (c.matchedTags?.length ? ` — matches interest in ${c.matchedTags.join(', ')}` : ''),
    query: encodeURIComponent(c.name + ' buy'),
    url: `https://www.google.com/search?q=${encodeURIComponent(c.name + ' buy')}`,
    status: 'Idea',
    store: null,
    actualPrice: null,
    dateAdded: new Date().toISOString(),
  }));
}

app.get('/api/recipients/:id/ideas', (req, res) => {
  const r = db.recipients.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const ideas = generateIdeasFor(r);
  res.json({ ideas, remainingBudget: getRemainingBudget(r) });
});

app.post('/api/ideas', (req, res) => {
  const { recipientId, name, category, price, reason, query, url } = req.body;
  const r = db.recipients.find(r => r.id === recipientId);
  if (!r) return res.status(404).json({ error: 'Recipient not found' });
  const idea = {
    id: crypto.randomUUID(),
    recipientId,
    name: String(name).trim(),
    category: category || 'Other',
    price: Number(price) || 0,
    reason: reason || '',
    query: query || encodeURIComponent(name),
    url: url || `https://www.google.com/search?q=${encodeURIComponent(name)}`,
    status: 'Idea',
    store: null,
    actualPrice: null,
    dateAdded: new Date().toISOString(),
  };
  db.ideas = db.ideas || [];
  db.ideas.push(idea);
  saveData(db);
  res.status(201).json(idea);
});

app.put('/api/ideas/:id', (req, res) => {
  const idea = (db.ideas || []).find(i => i.id === req.params.id);
  if (!idea) return res.status(404).json({ error: 'Not found' });
  const { name, category, price, reason, status, store, actualPrice, query, url } = req.body;
  if (name) idea.name = String(name).trim();
  if (category) idea.category = category;
  if (price !== undefined) idea.price = Number(price) || 0;
  if (reason !== undefined) idea.reason = reason;
  if (status) idea.status = status;
  if (store !== undefined) idea.store = store;
  if (actualPrice !== undefined) idea.actualPrice = actualPrice;
  if (query !== undefined) idea.query = query;
  if (url !== undefined) idea.url = url;
  if (status && status !== 'Idea' && !idea.actualPrice) {
    idea.actualPrice = idea.price;
  }
  saveData(db);
  res.json(idea);
});

app.delete('/api/ideas/:id', (req, res) => {
  const idx = (db.ideas || []).findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.ideas.splice(idx, 1);
  saveData(db);
  res.json({ success: true });
});

// ---- Dashboard / Stats ----
app.get('/api/stats', (req, res) => {
  const totalBudget = db.recipients.reduce((s, r) => s + (Number(r.budget) || 0), 0);
  const totalSpend = (db.ideas || [])
    .filter(i => i.status !== 'Idea')
    .reduce((s, i) => s + (Number(i.actualPrice) || Number(i.price) || 0), 0);
  const remaining = totalBudget - totalSpend;
  const ideasCount = (db.ideas || []).length;
  const orderedCount = (db.ideas || []).filter(i => i.status === 'Ordered').length;
  const wrappedCount = (db.ideas || []).filter(i => i.status === 'Wrapped').length;

  // Group by store
  const byStore = {};
  for (const i of (db.ideas || [])) {
    if (i.status !== 'Idea' && i.store) {
      byStore[i.store] = byStore[i.store] || { items: [], total: 0 };
      byStore[i.store].items.push(i);
      byStore[i.store].total += Number(i.actualPrice) || Number(i.price) || 0;
    }
  }

  res.json({
    totalBudget,
    totalSpend,
    remaining: Math.max(0, remaining),
    ideasCount,
    orderedCount,
    wrappedCount,
    byStore,
  });
});

app.get('/api/ideas', (req, res) => {
  res.json(db.ideas || []);
});

app.get('/api/ideas/:id', (req, res) => {
  const i = (db.ideas || []).find(i => i.id === req.params.id);
  if (!i) return res.status(404).json({ error: 'Not found' });
  res.json(i);
});

// Seed data endpoint
app.post('/api/seed', (req, res) => {
  db = {
    recipients: [
      {
        id: crypto.randomUUID(),
        name: 'Sarah',
        relationship: 'Mother',
        age: null,
        interests: ['gardening', 'cooking', 'reading'],
        dislikes: ['chocolate'],
        allergies: ['peanuts'],
        budget: 75,
      },
      {
        id: crypto.randomUUID(),
        name: 'Timmy',
        relationship: 'Son',
        age: 8,
        interests: ['lego', 'science', 'space'],
        dislikes: [],
        allergies: [],
        budget: 40,
      },
      {
        id: crypto.randomUUID(),
        name: 'Jake',
        relationship: 'Brother',
        age: null,
        interests: ['hiking', 'music', 'tech'],
        dislikes: ['candy'],
        allergies: [],
        budget: 60,
      },
      {
        id: crypto.randomUUID(),
        name: 'Emma',
        relationship: 'Friend',
        age: null,
        interests: ['yoga', 'art', 'cozy'],
        dislikes: [],
        allergies: ['shellfish'],
        budget: 30,
      },
    ],
    ideas: [],
    settings: {},
  };
  saveData(db);
  res.json({ success: true, count: db.recipients.length });
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`🎄 Christmas Shopper running at http://localhost:${PORT}`);
});

module.exports = server;